---
title: Kafka Core Concepts
subtitle: Records, topics, partitions and offsets, how keys decide partitions and ordering, brokers and clusters, producers, consumers and consumer groups, and how they all fit together.
order: 2
---

## Introduction

Kafka has a small vocabulary, and every advanced topic builds on it. This chapter defines each term precisely and shows how they connect.

```tree
Kafka cluster
  Broker 1, Broker 2, Broker 3 | servers that store data
    Topic: orders | a named stream of events
      Partition 0 | ordered, append-only log
      Partition 1
      Partition 2
        Record at offset 0, 1, 2… | key, value, headers, timestamp
```

## Record (Message / Event)

A **record** is the unit of data in Kafka:

| Field | Description |
| --- | --- |
| **Key** | Optional. Decides the partition and therefore ordering (e.g. `orderId`) |
| **Value** | The payload — JSON, Avro, Protobuf or raw bytes |
| **Headers** | Optional key/value metadata (trace IDs, event type, source) |
| **Timestamp** | Creation time (set by the producer) or log-append time (set by the broker) |
| **Offset** | Assigned by the broker — the record's position in its partition |

Kafka stores keys and values as **bytes**; producers and consumers use **serializers** and **deserializers** to convert objects.

## Topic

A **topic** is a named, logical stream of related events — like a table name for events: `orders`, `payments`, `user-signups`.

- Producers write to topics; consumers read from them.
- A topic can have any number of producers and consumer groups.
- Naming convention example: `<domain>.<entity>.<event>` — `shop.orders.placed`.

## Partition

Each topic is split into one or more **partitions**. A partition is an **ordered, immutable, append-only log**:

```buckets
P0: offset 0, offset 1, offset 2, offset 3, offset 4
P1: offset 0, offset 1, offset 2
P2: offset 0, offset 1, offset 2, offset 3
```

Partitions are what make Kafka scale:

- **Parallelism** — different partitions live on different brokers and are consumed by different consumers.
- **Ordering** — records are strictly ordered **within** a partition, never across partitions.
- **Capacity** — a topic's throughput grows with its number of partitions.

> [!IMPORTANT]
> Kafka guarantees ordering **only within a single partition**. If you need all events for one order to be processed in order, give them the **same key** so they land in the same partition.

## Offset

An **offset** is a record's sequential position within its partition: 0, 1, 2, … It never changes and is never reused.

- Offsets are **per partition** — partition 0 and partition 1 both have an offset 5.
- A record is identified by **topic + partition + offset**.
- Consumers track their progress by **committing offsets** — "I've processed partition 2 up to offset 41".

## How a Key Picks a Partition

| Situation | Partition chosen |
| --- | --- |
| Partition given explicitly | That partition |
| Record has a **key** | `hash(key) % number of partitions` (murmur2 hash) — the same key always goes to the same partition |
| **No key** | The producer fills a batch for one partition, then moves to another ("sticky" partitioning) to spread load evenly |

```refs
key = ORD-1, key = ORD-7 -> Partition 0 | all events for these orders, in order
key = ORD-2 -> Partition 1
key = ORD-3, key = ORD-5 -> Partition 2
```

> [!WARNING]
> Adding partitions to an existing topic changes `hash(key) % partitions`, so a key can start landing in a **different partition** — breaking per-key ordering for in-flight data. Choose the partition count carefully up front; increase it only when you understand the impact. (Partitions can never be decreased.)

### Choosing a Good Key

- ✅ An entity ID whose events must stay ordered — `orderId`, `accountId`, `customerId`.
- ❌ A low-cardinality value like `country` or `status` — a few keys get most traffic and create **hot partitions**.
- ❌ A random UUID per event when ordering matters — events for the same entity scatter.

## Broker and Cluster

A **broker** is a Kafka server. It stores partition data on disk and serves producer and consumer requests. A **cluster** is a group of brokers working together.

- Each partition is **replicated** on several brokers (the *replication factor*, typically 3).
- One replica is the **leader** — it handles all reads and writes for that partition; the others are **followers** that copy it.
- If a leader's broker fails, a follower becomes the new leader.
- Clients connect using **bootstrap servers** — any one or two brokers — and discover the rest of the cluster from them.

Replication and the KRaft controller are covered in *Kafka Architecture, KRaft & Replication*.

## Producer

A **producer** is an application that writes records to topics. It decides the key, serializes the record, chooses the partition and sends records in batches to the partition leaders.

## Consumer

A **consumer** reads records from topics by **polling** — it asks the broker for the next records after its current offset. Kafka is **pull-based**: consumers control their own pace.

## Consumer Group

A **consumer group** is a set of consumers that share the work of reading a topic. Each partition is assigned to **exactly one consumer in the group** at a time.

```refs
Consumer A -> Partitions 0 and 1
Consumer B -> Partition 2
Consumer C -> Partition 3
```

| Consumers in the group vs partitions | Result |
| --- | --- |
| Fewer consumers than partitions | Some consumers read several partitions |
| Equal numbers | One partition each — maximum parallelism |
| **More consumers than partitions** | Extra consumers sit **idle** |

> [!TIP]
> The partition count is the **upper limit on parallelism** within one consumer group. A topic with 6 partitions can be processed by at most 6 consumers of the same group at once.

Different consumer groups are completely independent: each has its own committed offsets and receives every record.

## Retention

Kafka keeps records for a configured time or size — by default **7 days** (`retention.ms`) — whether or not they've been consumed. After that, old log segments are deleted. Alternatively, a **compacted** topic keeps the latest record for each key (see *Retention, Compaction & Storage*).

## Putting It Together

```flow
Producer serializes the event and picks a partition from the key
Leader replica of that partition appends it at the next offset
Follower replicas copy it
Consumer group members poll their assigned partitions
Each consumer processes the records and commits its offset
```

## Interview Questions

### What is a partition, and why does Kafka use them?

An ordered, append-only log that holds part of a topic's data. Partitions spread a topic across brokers for scalability and let multiple consumers read in parallel.

### What is an offset?

The sequential ID of a record within a partition. Consumers commit offsets to record how far they've processed.

### How does Kafka guarantee ordering?

Only within a partition. Records with the same key go to the same partition, so they're consumed in the order they were produced.

### What happens if a consumer group has more consumers than partitions?

The extra consumers receive no partitions and stay idle until a rebalance gives them one.

### How is the partition chosen for a record?

An explicit partition if given; otherwise `murmur2(key) % partitions` for keyed records; for records without a key, the producer's sticky partitioner fills batches for one partition at a time.

### Can you reduce the number of partitions of a topic?

No. You can only increase it — and doing so changes which partition a key maps to.

## Common Mistakes

- ❌ **Expecting ordering across a whole topic.**
- ❌ **Using a low-cardinality key**, creating hot partitions.
- ❌ **Adding consumers beyond the partition count** and expecting more throughput.
- ❌ **Increasing partitions casually** on a topic that relies on key ordering.
- ❌ **Treating offsets as global** — they're per partition.

## Key Takeaways

- ✅ A record has a key, value, headers, timestamp and an offset.
- ✅ Topics are split into partitions — ordered, append-only logs and the unit of parallelism.
- ✅ The key decides the partition; same key → same partition → ordered.
- ✅ Brokers store replicated partitions; one replica is the leader.
- ✅ In a consumer group, each partition goes to exactly one consumer; different groups read independently.
- ✅ Records are retained by time or size, not deleted on consumption.
