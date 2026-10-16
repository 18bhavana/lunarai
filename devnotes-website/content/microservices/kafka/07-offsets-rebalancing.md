---
title: Offset Management & Rebalancing
subtitle: How committed offsets work, auto-commit and its risks, commitSync vs commitAsync, committing per record or per batch, seeking and replaying, what triggers a rebalance, eager vs cooperative rebalancing, static membership, and Kafka 4's new consumer group protocol.
order: 7
---

## Introduction

Offsets are how a consumer group remembers its progress. **When** you commit them decides whether a crash causes duplicates or lost messages. **Rebalancing** — redistributing partitions when the group changes — is the other source of surprises. Both are favourite interview topics.

## Committed Offsets

A consumer group commits, for each partition, **the offset of the next record it wants to read**. Commits are stored in Kafka's internal topic **`__consumer_offsets`**.

```buckets
Partition 0: offset 40 processed, offset 41 processed, offset 42 processed, offset 43 next
```

After processing offset 42, the group commits **43**. If the consumer restarts, or the partition moves to another consumer, reading resumes at 43.

| Term | Meaning |
| --- | --- |
| **Current position** | The next offset `poll()` will return for this consumer (in memory) |
| **Committed offset** | The position saved in `__consumer_offsets` — where the group resumes after a restart or rebalance |
| **Log-end offset** | Where the next produced record will go |
| **Lag** | Log-end offset − committed offset |

## When You Commit Decides the Guarantee

```flow
? Commit before or after processing? | Before: a crash after the commit loses the records — at-most-once | After: a crash before the commit reprocesses them — at-least-once
```

**At-least-once — commit after processing — is the usual choice**, combined with consumers that can handle the occasional duplicate (see *Delivery Semantics & Exactly-Once*).

## Auto-Commit

With `enable.auto.commit=true` (the default), the consumer commits the offsets returned by previous `poll()` calls every `auto.commit.interval.ms` (5 s) — the commit happens **inside `poll()`**.

| Benefit | Risk |
| --- | --- |
| No code needed | If you process records **asynchronously** (hand off to another thread) and then poll again, offsets can be committed before processing finishes → **lost messages** on a crash |
| At-least-once **if** you process everything synchronously before the next `poll()` | A crash up to 5 s after processing means those records are reprocessed → duplicates |

For anything important, most teams **disable auto-commit** and commit explicitly. (Spring Kafka does this for you — it disables Kafka's auto-commit and commits through its listener container.)

## Manual Commits

```java
props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
```

### commitSync — Commit After Each Batch

```java
while (running) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    for (ConsumerRecord<String, String> record : records) {
        process(record);
    }
    consumer.commitSync();   // commits the offsets after the last polled records; retries until success or fatal error
}
```

### commitAsync — Non-Blocking

```java
consumer.commitAsync((offsets, exception) -> {
    if (exception != null) log.warn("Commit failed for {}", offsets, exception);
});
```

| `commitSync()` | `commitAsync()` |
| --- | --- |
| Blocks until the broker confirms | Returns immediately |
| Retries on retriable errors | **No retry** — a later commit would be overwritten by a retried older one |
| Lower throughput | Higher throughput |

A common pattern: `commitAsync()` in the loop for speed, and `commitSync()` once on shutdown or before partitions are revoked.

```java
try {
    while (running) {
        ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
        records.forEach(this::process);
        consumer.commitAsync();
    }
} catch (WakeupException e) {
    // shutting down
} finally {
    try {
        consumer.commitSync();   // final, reliable commit
    } finally {
        consumer.close();
    }
}
```

### Committing Specific Offsets

To commit part-way through a large batch, pass explicit offsets — remember to commit **offset + 1**:

```java
Map<TopicPartition, OffsetAndMetadata> offsets = Map.of(
        new TopicPartition(record.topic(), record.partition()),
        new OffsetAndMetadata(record.offset() + 1));
consumer.commitSync(offsets);
```

## Seeking and Replaying

A consumer can move its position at any time:

```java
consumer.seekToBeginning(consumer.assignment());
consumer.seek(new TopicPartition("orders", 2), 500);

// Jump to the first offset at or after a timestamp
Map<TopicPartition, OffsetAndTimestamp> found = consumer.offsetsForTimes(
        Map.of(new TopicPartition("orders", 2), yesterdayMillis));
```

Use seeking to reprocess after a bug fix, or to skip a known-bad record. For whole groups, the CLI's `--reset-offsets` does the same (see *Running Kafka Locally & the CLI*).

## Rebalancing

A **rebalance** redistributes partitions among the consumers in a group. It's triggered when:

- a consumer **joins** the group (new instance, scale-up, deployment);
- a consumer **leaves** cleanly (`close()`) or **fails** (missed heartbeats → `session.timeout.ms`);
- a consumer exceeds **`max.poll.interval.ms`** and is removed;
- the subscribed topics change (partitions added, a new topic matches a pattern subscription).

### Eager vs Cooperative Rebalancing

| Eager (stop-the-world) | Cooperative (incremental) |
| --- | --- |
| **All** consumers give up **all** partitions, then everything is reassigned | Only partitions that actually move are revoked; others keep processing |
| Whole group pauses during every rebalance | Minimal disruption |
| `RangeAssignor`, `RoundRobinAssignor`, `StickyAssignor` | `CooperativeStickyAssignor` |

```flow
Consumer C joins a group of A and B
Eager — A and B revoke everything, the group pauses, all partitions are reassigned
Cooperative — only the partitions that move to C are revoked; A and B keep the rest and continue
```

### Reacting to Rebalances

Commit what you've processed before losing a partition:

```java
consumer.subscribe(List.of("orders"), new ConsumerRebalanceListener() {
    @Override
    public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
        consumer.commitSync(currentOffsets);   // don't lose progress on partitions being taken away
    }

    @Override
    public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
        // optionally seek to offsets stored elsewhere (e.g. in your database)
    }
});
```

### Static Membership

Every deployment or restart normally triggers two rebalances (leave + rejoin). Setting **`group.instance.id`** to a stable value per instance (e.g. the Kubernetes pod name) makes the consumer a **static member**: a restart within `session.timeout.ms` gets its old partitions back **without** a rebalance.

```java
props.put(ConsumerConfig.GROUP_INSTANCE_ID_CONFIG, System.getenv("HOSTNAME"));
```

### Kafka 4: the New Consumer Group Protocol

Kafka 4.0 made the **next-generation consumer rebalance protocol** (KIP-848) generally available:

```java
props.put(ConsumerConfig.GROUP_PROTOCOL_CONFIG, "consumer");   // default is still "classic"
```

- The **broker** (group coordinator) computes assignments instead of a client "leader".
- Rebalances are **incremental** by design — no global synchronization barrier.
- Much faster and more stable rebalancing for large groups; assignors are configured on the server side (`group.remote.assignor`).

> [!NOTE]
> The new protocol needs Kafka 4.0+ brokers and recent clients. The classic protocol remains the default and is still what most existing applications use.

## Avoiding Rebalance Storms

- Keep each poll's processing well under `max.poll.interval.ms` (lower `max.poll.records`).
- Use the `CooperativeStickyAssignor` (or the new protocol).
- Use static membership for rolling deployments.
- Close consumers gracefully on shutdown so partitions move immediately.
- Avoid very short `session.timeout.ms` values in environments with GC pauses or noisy networks.

## Interview Questions

### Where are consumer offsets stored?

In the internal compacted topic `__consumer_offsets` on the Kafka brokers (in very old versions, in ZooKeeper).

### What offset does a consumer commit?

The offset of the **next** record to read — the last processed offset plus one.

### What's the risk of auto-commit?

Offsets can be committed before records are actually processed (for example, when processing is asynchronous), losing records on a crash; and a crash shortly after processing causes duplicates.

### commitSync vs commitAsync?

`commitSync` blocks and retries until success; `commitAsync` returns immediately and doesn't retry. Use async in the loop and a final sync commit on shutdown or partition revocation.

### What triggers a rebalance?

Consumers joining, leaving or failing (missed heartbeats), exceeding `max.poll.interval.ms`, and changes in the subscribed topics' partitions.

### What is cooperative rebalancing?

An incremental protocol (`CooperativeStickyAssignor`) where only partitions that need to move are revoked, so the rest of the group keeps processing instead of pausing.

### What is static membership?

Assigning a stable `group.instance.id` to each consumer so a restart within the session timeout doesn't trigger a rebalance.

### What does KIP-848 change?

It moves partition assignment to the broker and makes rebalances incremental and much faster; enabled with `group.protocol=consumer`, generally available in Kafka 4.0.

## Common Mistakes

- ❌ **Committing before processing** when you need at-least-once.
- ❌ **Auto-commit with asynchronous processing.**
- ❌ **Committing `record.offset()` instead of `record.offset() + 1`** — the last record is reprocessed after every restart.
- ❌ **Retrying `commitAsync` failures** blindly — an old offset can overwrite a newer one.
- ❌ **Ignoring rebalance callbacks** — progress on revoked partitions is lost.
- ❌ **Long processing per poll**, causing repeated rebalances.

## Key Takeaways

- ✅ Committed offsets live in `__consumer_offsets` and mark the next record to read.
- ✅ Commit after processing for at-least-once; commit before for at-most-once.
- ✅ Disable auto-commit when processing isn't strictly synchronous; use `commitAsync` + a final `commitSync`.
- ✅ Rebalances happen on joins, leaves, failures and poll timeouts.
- ✅ Cooperative rebalancing, static membership and Kafka 4's new protocol reduce disruption.
