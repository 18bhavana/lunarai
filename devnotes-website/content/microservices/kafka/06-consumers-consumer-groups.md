---
title: Kafka Consumers & Consumer Groups
subtitle: The poll loop, a Java consumer, deserializers, consumer groups and the group coordinator, partition assignment strategies, scaling consumers, auto.offset.reset, the key consumer settings, and processing records safely with multiple threads.
order: 6
---

## Introduction

A **consumer** reads records from Kafka by **polling**. Consumers that share a `group.id` form a **consumer group** and divide the topic's partitions between them. This chapter covers the consumer loop and how groups distribute work; committing offsets and rebalancing get their own chapter next.

## The Poll Loop

```flow
subscribe(topics)
poll(timeout) — fetch the next batch of records from assigned partitions
Process each record
Commit offsets — automatically or manually
Loop back to poll
```

## A Plain Java Consumer

```java
Properties props = new Properties();
props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
props.put(ConsumerConfig.GROUP_ID_CONFIG, "email-service");
props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
    consumer.subscribe(List.of("orders"));

    while (running) {
        ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
        for (ConsumerRecord<String, String> record : records) {
            System.out.printf("partition=%d offset=%d key=%s value=%s%n",
                    record.partition(), record.offset(), record.key(), record.value());
            sendEmail(record.value());
        }
    }
}
```

```output
partition=0 offset=41 key=ORD-2 value={"status":"PLACED"}
partition=2 offset=17 key=ORD-1 value={"status":"PLACED"}
partition=2 offset=18 key=ORD-1 value={"status":"PAID"}
```

`poll()` does much more than fetch: it joins the group, sends heartbeats (on a background thread), triggers rebalances and, with auto-commit, commits offsets.

> [!WARNING]
> `KafkaConsumer` is **not thread-safe**. Use each consumer from a single thread. To stop it from another thread, call `consumer.wakeup()` — the next `poll()` throws `WakeupException`, which you catch to close cleanly.

```java
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    running = false;
    consumer.wakeup();
}));
```

## Consumer Groups

All consumers with the same `group.id` share the topic. A broker acting as the **group coordinator** tracks the members and their partition assignments.

```refs
Consumer 1 -> P0, P1
Consumer 2 -> P2, P3
Consumer 3 -> P4, P5
```

### Scaling a Group

| Group size (6-partition topic) | Partitions per consumer |
| --- | --- |
| 1 consumer | All 6 |
| 2 consumers | 3 each |
| 3 consumers | 2 each |
| 6 consumers | 1 each — maximum parallelism |
| 8 consumers | 6 get one partition each; **2 are idle** |

Adding consumers increases throughput only up to the partition count. When consumers join, leave or crash, the group **rebalances** — partitions are redistributed (see the next chapter).

### Multiple Groups

```tree
orders topic
  group email-service | 2 consumers share the partitions
  group analytics | 1 consumer reads all partitions
  group fraud-check | 3 consumers share the partitions
```

Each group has its own offsets and receives **every** record, independently.

## Partition Assignment Strategies

The assignor decides which consumer gets which partitions (`partition.assignment.strategy`):

| Assignor | Behaviour |
| --- | --- |
| `RangeAssignor` | Contiguous ranges per topic — can be uneven across several topics |
| `RoundRobinAssignor` | Spreads partitions evenly one by one |
| `StickyAssignor` | Even, and keeps existing assignments as much as possible during rebalances |
| `CooperativeStickyAssignor` | Sticky **and** incremental — only moved partitions pause during a rebalance |

The default is `[RangeAssignor, CooperativeStickyAssignor]`. With Kafka 4's new consumer group protocol (`group.protocol=consumer`), assignment moves to the broker and is incremental by default — covered in the next chapter.

## Where Does a New Group Start? auto.offset.reset

When a group has **no committed offset** for a partition (a brand-new group, or its offsets expired), `auto.offset.reset` decides where to start:

| Value | Starts at |
| --- | --- |
| `latest` (default) | Only records produced from now on |
| `earliest` | The oldest available record |
| `none` | Throws an exception — useful when you want to set offsets explicitly |

Once offsets are committed, the group always resumes from them.

> [!NOTE]
> Committed offsets for an inactive group are deleted after `offsets.retention.minutes` (7 days by default). A group that's been stopped for longer falls back to `auto.offset.reset` when it restarts.

## Key Consumer Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `group.id` | — | The consumer group |
| `enable.auto.commit` | `true` | Commit offsets automatically during `poll()` |
| `auto.commit.interval.ms` | 5000 | How often auto-commit happens |
| `max.poll.records` | 500 | Maximum records returned by one `poll()` |
| `max.poll.interval.ms` | 300000 (5 min) | Maximum time between polls before the consumer is considered failed and removed from the group |
| `session.timeout.ms` | 45000 | Heartbeat timeout before the coordinator marks the consumer dead |
| `heartbeat.interval.ms` | 3000 | How often heartbeats are sent |
| `fetch.min.bytes` / `fetch.max.wait.ms` | 1 byte / 500 ms | Batching on the fetch side |
| `isolation.level` | `read_uncommitted` | Set `read_committed` to skip aborted transactional records |

### max.poll.interval.ms — the Classic Trap

Heartbeats run on a background thread, so a consumer can be "alive" yet stuck. If processing one `poll()` batch takes longer than `max.poll.interval.ms`, the consumer is kicked out of the group, its partitions are reassigned, and its commit fails — the same records are reprocessed by another consumer, **again and again**.

Fixes:

- reduce `max.poll.records` so each batch finishes sooner;
- make processing faster (batch database writes, avoid slow external calls);
- raise `max.poll.interval.ms` if processing is legitimately slow;
- move very slow work to another system (e.g. a job queue).

## Processing with Multiple Threads

The partition count limits parallelism per group. When processing is slow (calls to other services), options are:

1. **More partitions and consumers** — the simplest, keeps per-key ordering.
2. **Spring Kafka `concurrency`** — several consumer threads in one application instance (each with its own consumer).
3. **Hand off to a worker pool** — one consumer thread, many workers. Ordering per key and correct offset commits become **your** responsibility; libraries such as Confluent's *Parallel Consumer* do this safely.

## Interview Questions

### What is a consumer group?

A set of consumers sharing a `group.id` that divide a topic's partitions between them, so each partition is consumed by exactly one member, while each group as a whole receives every record.

### Why are there idle consumers in my group?

The group has more consumers than the topic has partitions; each partition can be assigned to only one consumer in the group.

### What does auto.offset.reset do?

It decides where a group starts when it has no committed offset for a partition: `latest` (default), `earliest` or `none` (error).

### What is max.poll.interval.ms?

The maximum time allowed between `poll()` calls. If processing a batch exceeds it, the consumer is considered failed, it leaves the group, and its partitions are reassigned.

### Is KafkaConsumer thread-safe?

No. Each instance must be used by one thread; only `wakeup()` may be called from another thread.

### How do you increase consumer throughput?

Add partitions and consumers (up to the partition count), speed up per-record processing, tune `max.poll.records` and fetch sizes, use Spring Kafka concurrency, or process in parallel with careful offset management.

## Common Mistakes

- ❌ **Sharing one `KafkaConsumer` across threads.**
- ❌ **Slow processing per poll** exceeding `max.poll.interval.ms` — endless rebalances and reprocessing.
- ❌ **Expecting a new group to read old data** with the default `auto.offset.reset=latest`.
- ❌ **More consumers than partitions** for "more throughput".
- ❌ **Not closing consumers** on shutdown — the group waits for the session timeout before reassigning partitions.

## Key Takeaways

- ✅ Consumers poll; `poll()` also handles group membership and (by default) offset commits.
- ✅ A partition is assigned to exactly one consumer per group; parallelism ≤ partitions.
- ✅ Different groups consume independently with their own offsets.
- ✅ `auto.offset.reset` applies only when no committed offset exists.
- ✅ Keep each poll batch well within `max.poll.interval.ms`.
- ✅ `KafkaConsumer` is single-threaded; scale with partitions, consumers or careful worker pools.
