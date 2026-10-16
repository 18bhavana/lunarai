---
title: Kafka Interview Masterclass
subtitle: The most-asked Kafka interview questions with crisp answers, real-world design scenarios (ordering, duplicates, poison pills, lag, outbox, sagas), event-driven patterns, and a one-page quick revision sheet.
order: 15
---

## Introduction

This chapter brings the whole topic together for interviews: rapid-fire fundamentals, the scenario questions senior interviewers love, the event-driven patterns Kafka enables, and a revision sheet for the night before.

> [!TIP]
> Answer Kafka questions in layers: **definition → how it works internally → configuration → trade-off → what you did in a real project.** "We used `acks=all` with `min.insync.replicas=2` because payment events couldn't be lost" beats reciting a definition.

## Interview Questions

### 1. Explain Kafka's architecture in one minute.

A cluster of brokers stores topics split into partitions. Each partition is an ordered, append-only log replicated across brokers, with one leader handling reads and writes and followers copying it. A KRaft controller quorum manages metadata and leader election (ZooKeeper was removed in Kafka 4.0). Producers write records — routed to partitions by key — and consumers in consumer groups poll partitions and commit offsets to track progress. Records are retained by time or size, not deleted on consumption.

### 2. How does Kafka achieve high throughput?

Sequential appends to log segments, the OS page cache, batching and compression on the producer, zero-copy transfer from page cache to network, partitioning across brokers, and pull-based consumers.

### 3. How is ordering guaranteed?

Only within a partition. Use the entity ID as the key so related events go to the same partition, and keep the idempotent producer enabled so retries can't reorder batches.

### 4. What is the relationship between partitions and consumers?

Within one consumer group, each partition is assigned to exactly one consumer; a consumer can have several partitions. Parallelism per group is capped at the partition count; extra consumers are idle.

### 5. What happens when a consumer dies?

It stops heartbeating; after `session.timeout.ms` the coordinator removes it and rebalances, giving its partitions to other members, which resume from the last committed offsets — so records processed but not committed are reprocessed.

### 6. What are the delivery guarantees?

At-most-once (commit before processing), at-least-once (commit after processing — the usual choice, with idempotent consumers) and exactly-once (idempotent producer + transactions + `read_committed`, for Kafka-to-Kafka processing).

### 7. What do acks=all and min.insync.replicas=2 achieve?

A write is acknowledged only once at least two in-sync replicas have it; if fewer are in sync, the write fails rather than becoming under-replicated. With RF = 3, the topic stays writable with one broker down.

### 8. What is an idempotent producer?

A producer whose batches carry a producer ID and per-partition sequence numbers so brokers discard duplicates from retries. On by default since Kafka 3.0.

### 9. What is a rebalance, and how do you minimise its impact?

Redistribution of partitions among a group's consumers when members join, leave, fail or exceed `max.poll.interval.ms`. Minimise impact with the cooperative sticky assignor or the new Kafka 4 group protocol, static membership, fast processing per poll and graceful shutdowns.

### 10. What is log compaction?

A cleanup policy that keeps the latest record per key and removes older ones; `null` values (tombstones) delete keys. Used for state such as `__consumer_offsets` and Kafka Streams changelogs.

### 11. What is consumer lag?

The difference between a partition's log-end offset and the group's committed offset — records waiting to be processed. The key health metric for consumers.

### 12. Kafka vs RabbitMQ?

Kafka is a replicated, partitioned, replayable log for high-throughput event streaming with many independent consumers; RabbitMQ is a broker with flexible routing where messages are removed when acknowledged — better for task queues, priorities and request/reply.

### 13. What replaced ZooKeeper?

KRaft — Kafka's built-in Raft-based metadata quorum. Production-ready since 3.3; the only option from 4.0.

### 14. How do you handle messages that fail processing?

Bounded retries with exponential back-off for transient errors, immediate routing of permanent errors to a dead-letter topic with error headers, alerting on the DLT and a replay tool.

### 15. What is the transactional outbox?

Writing the event to an outbox table in the same database transaction as the business change, then publishing it to Kafka from the table (polling or Debezium CDC) — avoiding unreliable dual writes.

## Scenario Questions

### "Events for the same order are processed out of order. Why, and how do you fix it?"

Likely causes: no key or a non-entity key (events spread across partitions); partitions were added, changing key placement; non-blocking retries (`@RetryableTopic`) let later events overtake a failing one; or the consumer processes records in parallel threads. Fix: key by `orderId`; keep idempotence on; use blocking retries where order matters; process each partition (or each key) sequentially; and make consumers tolerate out-of-order events with version numbers where needed.

### "Customers are charged twice. How do you prevent duplicate processing?"

At-least-once delivery means a crash or rebalance between processing and committing redelivers records. Make the consumer idempotent: include an `eventId` in every event and record processed IDs in a table with a unique constraint **in the same transaction** as the charge, or use the payment provider's idempotency key. Also ensure the producer is idempotent and events are published via an outbox, not re-sent on retry.

### "One bad message stopped our consumer and lag keeps growing."

A poison pill: the listener keeps retrying the same record, blocking its partition. Configure bounded retries (`DefaultErrorHandler` with a back-off), mark validation and deserialization errors as non-retryable, wrap deserializers in `ErrorHandlingDeserializer`, and publish failures to a dead-letter topic — then fix and replay.

### "Consumer lag is growing during peak hours."

Check whether consumers are healthy (rebalancing loops, errors, stuck threads). If they're simply too slow: scale consumers up to the partition count (and add partitions if already at the limit), batch database writes, remove slow synchronous calls from the hot path, tune `max.poll.records` and fetch sizes, and consider async or parallel processing per key. Monitor lag per partition — a single hot partition points to a skewed key.

### "We keep seeing rebalances and duplicate processing."

Processing a poll batch takes longer than `max.poll.interval.ms`, so the consumer is kicked out, its commit fails and another consumer reprocesses the batch. Reduce `max.poll.records`, speed up processing, raise `max.poll.interval.ms` if justified, and use static membership and the cooperative assignor to reduce deployment rebalances.

### "How would you guarantee an event is published whenever an order is saved?"

Use the transactional outbox: save the order and an `OrderPlaced` outbox row in one database transaction; a relay (Debezium or a poller) publishes outbox rows to Kafka and marks them sent. Consumers deduplicate by `eventId` because the relay is at-least-once.

### "Design a choreographed saga for order → payment → inventory with Kafka."

```flow
Order service saves the order as PENDING and publishes OrderCreated via its outbox
Payment service consumes it, charges the customer, publishes PaymentCompleted or PaymentFailed
Inventory service reserves stock, publishes InventoryReserved or InventoryFailed
Order service marks the order CONFIRMED — or, on any failure event, triggers compensations
```

Each service performs a local transaction and publishes events through an outbox; failures publish events that trigger **compensating actions** (refund payment, release stock, cancel order). Key by `orderId` for ordering, make every handler idempotent, and use a correlation ID header for tracing. For long or complex flows, prefer an **orchestrator** (see the Saga pattern chapter).

### "A new analytics service needs all historical orders."

If retention allows, start a new consumer group with `auto.offset.reset=earliest` (or reset its offsets to the beginning) and replay. If the data must be available indefinitely, keep a compacted "latest state" topic or set long retention / tiered storage, or bootstrap from a database snapshot and then consume from a known offset.

### "How do you handle a schema change without breaking consumers?"

Use a Schema Registry with BACKWARD (or FULL) compatibility; add new fields as optional with defaults; never rename or retype fields in place; upgrade consumers first for backward-compatible changes; and introduce a new topic or event version for breaking changes.

### "A broker died. What happens to producers and consumers?"

For partitions it led, the controller elects new leaders from the ISR within seconds; clients get errors such as `NotLeaderOrFollower`, refresh metadata and retry against the new leaders. With RF = 3 and `min.insync.replicas=2`, no acknowledged data is lost and writes continue. The broker rejoins as a follower when it returns.

## Event-Driven Patterns with Kafka

| Pattern | Idea |
| --- | --- |
| **Event notification** | Publish "something happened"; consumers fetch details if needed |
| **Event-carried state transfer** | Events carry the data consumers need, reducing calls between services |
| **Event sourcing** | The log of events is the source of truth; state is rebuilt by replaying it |
| **CQRS** | Commands update the write model; events build separate read models (search index, dashboards) |
| **Transactional outbox** | Reliable event publication alongside a database change |
| **Saga (choreography)** | A distributed workflow coordinated by events, with compensations |
| **CDC** | Database changes streamed as events (Debezium) |
| **Claim check** | Store large payloads externally; send a reference in the event |
| **Dead-letter topic** | Park records that can't be processed |

## Quick Revision

| Topic | Remember |
| --- | --- |
| Kafka | Distributed, replicated, partitioned commit log for event streaming |
| Topic / partition / offset | Named stream / ordered log and unit of parallelism / position in a partition |
| Ordering | Per partition only — same key → same partition |
| Partitioner | `murmur2(key) % partitions`; no key → sticky batching |
| Consumer group | Each partition → one consumer per group; parallelism ≤ partitions |
| Retention | Default 7 days; not deleted on consumption |
| Compaction | Latest value per key; `null` = tombstone |
| KRaft | Replaced ZooKeeper; only mode in Kafka 4.0 |
| Replication | Leader + followers; ISR; high watermark |
| Durability | RF 3, `min.insync.replicas=2`, `acks=all` |
| Producer defaults (3.0+) | `acks=all`, `enable.idempotence=true`, retries ≈ ∞ within `delivery.timeout.ms` |
| Batching | `linger.ms` (5 ms default in 4.0), `batch.size` 16 KB, compression lz4/zstd |
| Consumer defaults | `auto.offset.reset=latest`, `enable.auto.commit=true`, `max.poll.records=500`, `max.poll.interval.ms=5 min` |
| Offsets | Stored in `__consumer_offsets`; commit = next offset to read |
| Commit timing | Before processing = at-most-once; after = at-least-once |
| Rebalance | On join/leave/failure/poll timeout; cooperative sticky; static membership; KIP-848 |
| Exactly-once | Idempotence + transactions + `sendOffsetsToTransaction` + `read_committed` (Kafka-to-Kafka) |
| External side effects | At-least-once + idempotent consumers; outbox for publishing |
| Errors | Bounded back-off, non-retryable exceptions, DLT, `ErrorHandlingDeserializer` |
| Blocking vs non-blocking retries | `DefaultErrorHandler` keeps order; `@RetryableTopic` doesn't |
| Schemas | Registry + Avro/Protobuf; BACKWARD default; optional fields with defaults |
| Streams | KStream = events, KTable = latest per key; RocksDB + changelog topics |
| Connect / CDC | Source and sink connectors; Debezium reads the DB transaction log |
| Monitoring | Consumer lag, under-replicated partitions, disk, latency, DLT arrivals |
| Security | TLS + SASL/mTLS + ACLs |

## Practice Problems

**Easy**

1. Run Kafka locally, create a 3-partition topic, and produce keyed messages from the console.
2. Consume with two consumers in the same group and observe the partition split.
3. Write a Java producer with an async callback that prints partition and offset.
4. Describe a consumer group and explain each column of the output.

**Medium**

1. Build a Spring Boot service that publishes `OrderPlaced` events and another that consumes them.
2. Switch the consumer to manual acknowledgement and simulate a crash before acknowledging.
3. Add a `DefaultErrorHandler` with exponential back-off and a dead-letter topic.
4. Create a compacted topic, write several values per key plus a tombstone, and inspect the result.

**Interview level**

1. Implement an idempotent consumer with a processed-events table.
2. Implement the transactional outbox with Debezium.
3. Build a Kafka Streams app counting orders per customer in 5-minute windows.
4. Design the topics, keys, partition counts and retry strategy for a food-delivery platform.
5. Explain, with configuration, how you'd make a payment pipeline lose nothing and charge no one twice.

## Key Takeaways

- ✅ Answer in layers: concept → internals → configuration → trade-off → real experience.
- ✅ Most scenarios reduce to keys and ordering, offset commit timing, idempotency, poison pills, lag, and the outbox.
- ✅ Know the modern defaults: KRaft, `acks=all`, idempotence, cooperative rebalancing.
- ✅ Kafka's exactly-once covers Kafka-to-Kafka; everything else needs idempotent consumers.
- ✅ Use the quick revision table before the interview.
