---
title: Retention, Log Compaction & Storage
subtitle: How partitions are stored as segment files, time- and size-based retention, the delete vs compact cleanup policies, how compaction keeps the latest value per key, tombstones, compacted topics as state, tiered storage, and important topic settings.
order: 9
---

## Introduction

Kafka keeps data after it's consumed — but not forever, unless you ask it to. **Retention** decides how long, and **log compaction** offers a different model: keep only the **latest value for each key**. Both are configured per topic.

## How a Partition Is Stored

Each partition is a directory of **segment files** on the broker's disk:

```tree
/var/kafka-logs/orders-0
  00000000000000000000.log | records, offsets 0 to 1,048,575
  00000000000000000000.index | offset → file position
  00000000000000000000.timeindex | timestamp → offset
  00000000000001048576.log | next segment
  00000000000001048576.index
  00000000000002097152.log | active segment — new records are appended here
```

- Only the **active** segment receives writes; older segments are read-only.
- A segment rolls when it reaches `segment.bytes` (1 GB by default) or `segment.ms` (7 days).
- Retention and compaction work on **whole closed segments**, never the active one.
- The `.index` and `.timeindex` files let consumers seek to an offset or timestamp quickly.

## Cleanup Policies

| `cleanup.policy` | Behaviour | Typical use |
| --- | --- | --- |
| `delete` (default) | Remove whole segments older than the retention time or beyond the size limit | Event streams — orders, clicks, logs |
| `compact` | Keep at least the latest record for each key | Current state — user profiles, prices, configuration |
| `compact,delete` | Compact, and also delete by time/size | Latest-per-key with a maximum age |

## Time- and Size-Based Retention

| Setting | Default | Meaning |
| --- | --- | --- |
| `retention.ms` | 604800000 (**7 days**) | Delete segments whose newest record is older than this; `-1` = keep forever |
| `retention.bytes` | `-1` (unlimited) | Maximum size **per partition**; oldest segments are deleted first |
| `log.retention.check.interval.ms` (broker) | 5 minutes | How often the broker checks |

```bash
./kafka-configs.sh --bootstrap-server localhost:9092 --alter \
  --entity-type topics --entity-name clickstream \
  --add-config retention.ms=86400000,retention.bytes=10737418240   # 1 day, 10 GB per partition
```

> [!NOTE]
> Deletion is approximate. A segment is removed only when **all** its records are past retention, and only after it has rolled, so data can stay somewhat longer than `retention.ms`. Plan disk capacity for **retention + one segment** per partition, times the replication factor.

> [!WARNING]
> If a consumer group lags behind by more than the retention period, the records it hasn't read are **deleted before it gets to them**. On restart, its committed offset is out of range and `auto.offset.reset` kicks in. Size retention to comfortably exceed the longest outage you need to recover from.

## Log Compaction

With `cleanup.policy=compact`, Kafka guarantees it keeps **at least the most recent record for every key**. Older records for the same key are eventually removed.

### Before Compaction

```buckets
Offsets 0–6: K1=Bangalore, K2=Delhi, K1=Mysore, K3=Pune, K2=Chennai, K1=Hyderabad, K3=null
```

### After Compaction

```buckets
Kept: K2=Chennai (offset 4), K1=Hyderabad (offset 5), K3=null tombstone (offset 6)
```

| Key | Records before | Kept |
| --- | --- | --- |
| K1 | Bangalore, Mysore, Hyderabad | Hyderabad |
| K2 | Delhi, Chennai | Chennai |
| K3 | Pune, then `null` | `null` — a tombstone, removed later |

Properties of compaction:

- **Offsets never change** — kept records keep their original offsets; there are simply gaps.
- **Order is preserved** — the surviving records stay in offset order.
- It runs **in the background** on closed segments (the *log cleaner*), so recent duplicates exist until it runs.
- A consumer reading from the beginning still sees **every key's latest value**.

### Tombstones — Deleting a Key

To delete a key from a compacted topic, produce a record with that key and a **`null` value** — a *tombstone*. Compaction removes older values for the key, and the tombstone itself is removed after `delete.retention.ms` (24 hours by default), giving consumers time to see the deletion.

```java
producer.send(new ProducerRecord<>("customer-profiles", "C-42", null));   // delete C-42
```

### Compaction Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `min.cleanable.dirty.ratio` | 0.5 | Compact when at least 50% of the log is "dirty" (overwritten) |
| `min.compaction.lag.ms` | 0 | Minimum age before a record can be compacted away |
| `max.compaction.lag.ms` | unlimited | Maximum time a record can stay uncompacted |
| `delete.retention.ms` | 86400000 (1 day) | How long tombstones are kept |
| `segment.ms` | 7 days | Lower it so segments close (and become compactable) sooner |

### Where Compaction Is Used

- **`__consumer_offsets`** — Kafka's own offsets topic is compacted: only the latest offset per group and partition matters.
- **Kafka Streams changelog topics** and **KTables** — restoring local state.
- **Reference data** — product catalogue, prices, currency rates, feature flags.
- **CDC topics** keyed by primary key — the latest row state.

## Topics as a Source of Truth

With compaction (or `retention.ms=-1`), a topic can be the system of record:

- **Event sourcing** — a never-deleted event log rebuilt into state when needed.
- **State snapshots** — a compacted topic holding the current state of every entity; a new service can bootstrap its own view by reading it from the beginning.

## Tiered Storage

Keeping weeks or months of data on broker disks is expensive. **Tiered storage** (production-ready in Kafka 3.9) moves closed segments to cheap **object storage** (Amazon S3, GCS, Azure Blob) while recent data stays on local disk:

```flow-h
Recent segments on broker disk — hot
Older segments in object storage — cold
Consumers read both transparently
```

```properties
# broker
remote.log.storage.system.enable=true

# topic: keep 1 day on local disk, 90 days in total (the rest in object storage)
remote.storage.enable=true
local.retention.ms=86400000
retention.ms=7776000000
```

Benefits: long retention at low cost, faster broker replacement and rebalancing (less local data to copy), and independent scaling of storage and compute.

## Other Important Topic Settings

| Setting | Purpose |
| --- | --- |
| `max.message.bytes` | Largest record batch the topic accepts (~1 MB default) |
| `min.insync.replicas` | Minimum ISR size for `acks=all` writes |
| `message.timestamp.type` | `CreateTime` (producer's) or `LogAppendTime` (broker's) |
| `compression.type` | `producer` (keep the producer's codec) or a specific codec |
| `unclean.leader.election.enable` | Availability vs data-loss trade-off |

## Interview Questions

### How long does Kafka keep messages?

Per topic: by default 7 days (`retention.ms`), optionally limited by size per partition (`retention.bytes`), or forever with `retention.ms=-1`. Consumption doesn't affect retention.

### What is log compaction?

A cleanup policy that keeps at least the latest record for each key and removes older ones, so the topic holds the current state of every key rather than its full history.

### What is a tombstone?

A record with a key and a `null` value in a compacted topic, signalling deletion of that key. It's removed after `delete.retention.ms`.

### Do offsets change after compaction?

No. Surviving records keep their original offsets; the removed records leave gaps.

### What happens if a consumer falls behind retention?

The unread records are deleted; its committed offset becomes invalid and it resets according to `auto.offset.reset`, skipping (or replaying) data.

### What is tiered storage?

Offloading closed log segments to object storage such as S3 while keeping recent data on broker disks, enabling long retention cheaply. Production-ready since Kafka 3.9.

## Common Mistakes

- ❌ **Assuming messages are deleted once consumed.**
- ❌ **Retention shorter than a possible consumer outage.**
- ❌ **Compacted topics with `null` or random keys** — compaction needs meaningful keys.
- ❌ **Expecting compaction to happen immediately** — it only works on closed segments, in the background.
- ❌ **Forgetting `retention.bytes` is per partition**, not per topic.
- ❌ **Not accounting for replication** when sizing disks.

## Key Takeaways

- ✅ Partitions are stored as segment files; retention and compaction act on closed segments.
- ✅ `cleanup.policy=delete` removes data by time (`retention.ms`, 7 days default) or size.
- ✅ `cleanup.policy=compact` keeps the latest value per key; `null` values are tombstones.
- ✅ Compaction preserves offsets and order.
- ✅ `__consumer_offsets` and Kafka Streams state rely on compaction.
- ✅ Tiered storage makes long retention affordable.
