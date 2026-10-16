---
title: Delivery Semantics & Exactly-Once
subtitle: At-most-once, at-least-once and exactly-once, where duplicates and losses come from, idempotent producers, Kafka transactions and read_committed, exactly-once stream processing, idempotent consumers, and the transactional outbox pattern.
order: 8
---

## Introduction

> [!NOTE]
> **Interview importance:** very high. *"How do you guarantee exactly-once processing with Kafka?"* separates candidates who've only used Kafka from those who understand it.

Failures happen at every step — the producer, the network, the broker, the consumer. **Delivery semantics** describe what happens to a message when they do.

## The Three Guarantees

| Guarantee | Meaning | Lost? | Duplicated? |
| --- | --- | --- | --- |
| **At-most-once** | Each message is processed zero or one times | Possible | Never |
| **At-least-once** | Each message is processed one or more times | Never | Possible |
| **Exactly-once** | Each message affects the result exactly once | Never | Never |

**At-least-once is Kafka's practical default** for well-configured applications, and the most common production choice.

## Where Losses and Duplicates Come From

| Stage | Loss | Duplicate |
| --- | --- | --- |
| **Producer → broker** | `acks=0`/`1` and a leader failure; ignoring send errors | Retry after a lost acknowledgement (prevented by idempotence) |
| **Broker** | Replication factor 1, `min.insync.replicas=1`, unclean leader election | — |
| **Consumer** | Committing offsets **before** processing | Crash **after** processing but **before** committing; rebalances |
| **Application** | — | Re-sending the same business event after a restart |

## At-Most-Once

Commit first, then process:

```java
ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
consumer.commitSync();             // commit before processing
records.forEach(this::process);    // a crash here loses these records
```

Acceptable only where occasional loss is fine — metrics sampling, non-critical telemetry.

## At-Least-Once

Producer: `acks=all`, idempotence on, retries on, and handle send failures. Consumer: **process, then commit**:

```java
ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
records.forEach(this::process);
consumer.commitSync();             // a crash before this line → records are reprocessed
```

Nothing is lost, but a crash or rebalance between processing and committing means some records are **processed twice**. So at-least-once must be paired with **idempotent processing**.

## Idempotent Consumers

Make processing a record twice have the same effect as processing it once:

| Technique | Example |
| --- | --- |
| **Natural idempotency** | `UPDATE orders SET status = 'PAID' WHERE id = ?` — running it twice changes nothing |
| **Upserts** | `INSERT … ON DUPLICATE KEY UPDATE` / `MERGE` keyed by the event or entity ID |
| **Processed-events table** | Store each event ID in a table with a unique constraint, in the **same database transaction** as the business change; skip if it already exists |
| **Version checks** | Only apply an event whose version is newer than the stored one |

```java
@Transactional
public void handle(OrderPaidEvent event) {
    if (processedEvents.existsById(event.eventId())) {
        return;                                    // duplicate — already handled
    }
    orders.markPaid(event.orderId());
    processedEvents.save(new ProcessedEvent(event.eventId()));   // unique constraint on eventId
}
```

> [!TIP]
> Give every event a unique **event ID** (a UUID set by the producer, carried in the payload or a header). It's what makes deduplication possible downstream.

## Exactly-Once Inside Kafka

Kafka provides exactly-once semantics (**EOS**) for **read-process-write** pipelines where both input and output are Kafka topics.

### Part 1 — Idempotent Producer

Prevents duplicates from producer retries within a producer session (producer ID + sequence numbers). Enabled by default since Kafka 3.0. See *Kafka Producers*.

### Part 2 — Transactions

A transactional producer writes to **several partitions and commits consumer offsets atomically** — all or nothing:

```java
props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "payment-processor-1");   // stable per instance
KafkaProducer<String, String> producer = new KafkaProducer<>(props);
producer.initTransactions();

while (running) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    if (records.isEmpty()) continue;

    producer.beginTransaction();
    try {
        for (ConsumerRecord<String, String> record : records) {
            producer.send(new ProducerRecord<>("payments-processed", record.key(), transform(record.value())));
        }
        // commit the consumer's offsets as part of the same transaction
        producer.sendOffsetsToTransaction(nextOffsets(records), consumer.groupMetadata());
        producer.commitTransaction();
    } catch (ProducerFencedException e) {
        producer.close();          // another instance with the same transactional.id took over
        throw e;
    } catch (KafkaException e) {
        producer.abortTransaction();   // nothing from this batch becomes visible; it will be reprocessed
    }
}
```

| Concept | Purpose |
| --- | --- |
| `transactional.id` | Stable identity across restarts; lets Kafka **fence** "zombie" instances that still use the old producer |
| Transaction coordinator | A broker that manages each transaction's state in `__transaction_state` |
| Commit markers | Special records written to each partition marking the transaction committed or aborted |

### Part 3 — read_committed Consumers

Downstream consumers must ignore records from aborted or still-open transactions:

```java
props.put(ConsumerConfig.ISOLATION_LEVEL_CONFIG, "read_committed");   // default is read_uncommitted
```

```flow
Consume from orders
Process
Produce to payments-processed — inside a transaction
Send consumer offsets — inside the same transaction
? Commit succeeded? | Yes: output and offsets become visible together | No: abort — nothing visible, batch reprocessed
```

### Kafka Streams

Kafka Streams wraps all of this behind one setting:

```java
props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);
```

## The Limit of Exactly-Once

> [!IMPORTANT]
> Kafka's exactly-once guarantee covers **Kafka-to-Kafka** pipelines. It can't make an external side effect — inserting into a database, calling a payment API, sending an email — happen exactly once. For those, use **at-least-once delivery + idempotent consumers**, or store the offsets in the same database transaction as the result.

### Storing Offsets with the Result

If the output goes to a relational database, commit the **offsets in that database** in the same transaction, and on startup `seek()` to them (using a `ConsumerRebalanceListener`). The result and the progress marker then succeed or fail together.

## The Transactional Outbox Pattern

The opposite problem: a service must **update its database and publish an event**. Doing both directly isn't atomic:

```java
// ❌ Dual write — if the send fails (or the app crashes) after the commit, the event is lost;
// if you send first and the DB commit fails, you've announced something that didn't happen
orderRepository.save(order);
kafkaTemplate.send("orders", order.getId(), new OrderPlaced(order));
```

**Outbox:** write the event to an `outbox` table **in the same database transaction** as the business change, and let a separate process publish it:

```flow
Transaction — insert the order and insert the OrderPlaced row into the outbox table
Relay — a poller or CDC (Debezium) reads new outbox rows
Relay publishes each event to Kafka
Relay marks the row as sent — at-least-once, so consumers stay idempotent
```

The database transaction guarantees the event is recorded if — and only if — the order is. Debezium's outbox event router is a common implementation. This is the standard way to publish events reliably from microservices and sagas.

## Choosing a Guarantee

| Need | Approach |
| --- | --- |
| Occasional loss is fine; lowest overhead | At-most-once |
| No loss; duplicates handled by the consumer | **At-least-once + idempotent consumers** (the most common) |
| Kafka-to-Kafka transformation with no duplicates in the output | Transactions / Kafka Streams `exactly_once_v2` |
| Database change + event publication | Transactional outbox |
| Kafka → database exactly once | Idempotent writes, or offsets stored in the same DB transaction |

## Interview Questions

### What delivery semantics does Kafka support?

At-most-once (commit before processing), at-least-once (commit after processing — the common default) and exactly-once (idempotent producers + transactions + `read_committed` consumers, for Kafka-to-Kafka pipelines).

### How do duplicates occur in Kafka?

Producer retries without idempotence, consumers crashing or rebalancing after processing but before committing offsets, and applications re-sending events after a restart.

### How do you achieve exactly-once processing?

Within Kafka: enable idempotence, use a transactional producer that sends output records and the consumer's offsets in one transaction (`sendOffsetsToTransaction`), and read with `isolation.level=read_committed` — or use Kafka Streams with `exactly_once_v2`. With external systems: at-least-once delivery plus idempotent consumers, or storing offsets atomically with the result.

### What is an idempotent consumer?

A consumer whose processing produces the same result if a record is handled more than once — via upserts, natural idempotency or a processed-event-ID table with a unique constraint.

### What is the transactional outbox pattern?

Writing an event into an outbox table in the same database transaction as the business change, then publishing it to Kafka from that table (by polling or CDC). It avoids the unreliable "dual write" of database plus Kafka.

### What is a zombie producer, and how does Kafka fence it?

An old instance that's still running after a replacement started (e.g. after a long GC pause). With the same `transactional.id`, the new producer's `initTransactions()` bumps an epoch; the old producer gets `ProducerFencedException` and can't commit.

### What does isolation.level=read_committed do?

The consumer only returns records from committed transactions (and non-transactional records), skipping aborted ones and waiting for open transactions to finish.

## Common Mistakes

- ❌ **Claiming Kafka gives exactly-once end to end** with external databases or APIs.
- ❌ **At-least-once without idempotent consumers** — double charges, duplicate emails.
- ❌ **Dual writes** to the database and Kafka without an outbox.
- ❌ **Transactional producers with `read_uncommitted` consumers** — aborted data is still read.
- ❌ **A random `transactional.id` per start** — zombies can't be fenced.
- ❌ **No event IDs**, making deduplication impossible.

## Key Takeaways

- ✅ At-most-once, at-least-once and exactly-once differ in what happens on failure.
- ✅ At-least-once + idempotent consumers is the standard production approach.
- ✅ Kafka EOS = idempotent producer + transactions + `read_committed`, for Kafka-to-Kafka pipelines.
- ✅ `sendOffsetsToTransaction` commits output and consumer progress atomically.
- ✅ Use the transactional outbox to publish events reliably alongside database changes.
