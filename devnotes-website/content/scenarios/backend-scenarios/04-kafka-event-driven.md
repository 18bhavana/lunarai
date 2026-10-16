---
title: Kafka & Event-Driven Scenarios
subtitle: "Scenario questions 31–40: growing consumer lag, duplicate processing, poison messages, retry topics and DLQs, high-throughput consumers, crashes before offset commits, the outbox pattern, ordering across partitions, slow consumers and absorbing event spikes."
order: 4
---

## Introduction

Kafka gives you **at-least-once delivery** by default. Every consumer must therefore expect duplicates, handle failures without blocking its partition, and keep up with the incoming rate. The [Kafka Masterclass](/microservices/kafka/introduction-to-kafka/) covers the internals. These answers apply them to production problems.

## Scenario Questions

### Q31. Your Kafka consumer lag keeps increasing even though the consumer is running. How would you troubleshoot it?

Lag grows when **messages arrive faster than they're processed**, or when processing has stalled.

**Check:**

1. **Lag per partition** (`kafka-consumer-groups.sh --describe --group orders`, Burrow, or the `kafka_consumergroup_lag` metric). Is lag on **all** partitions (throughput) or **one** (a stuck message, or a hot key)?
2. **Is the offset moving at all?** If not, the consumer may be stuck: a poison message being retried forever, a deadlock, or a blocked downstream call. Take a thread dump.
3. **Rebalancing loops.** If processing a batch takes longer than `max.poll.interval.ms` (5 minutes by default), the consumer is kicked out of the group, its partitions are reassigned, and work restarts. Look for `CommitFailedException` and frequent "Revoking partitions" log lines.
4. **Processing time per record:** slow database writes, HTTP calls, or a lack of batching.
5. **Parallelism:** the number of consumers compared with the number of partitions. Consumers beyond the partition count sit idle; `concurrency` in Spring Kafka sets threads per instance.
6. **Producer side:** a traffic spike, or a hot key sending most of the data to one partition.

**Fixes:** fix the slow dependency, batch database writes, increase partitions **and** consumers, reduce `max.poll.records` or increase `max.poll.interval.ms` to stop rebalance loops, send poison messages to a DLT (Q33), and spread hot keys out. See [Offsets & Rebalancing](/microservices/kafka/offsets-rebalancing/).

### Q32. A Kafka consumer processes the same message multiple times. How would you prevent duplicate business operations?

Duplicates are **expected** with at-least-once delivery. They come from retries after a crash or rebalance before the offset commit, producer retries, or upstream republishing. Make processing **idempotent**:

1. **A unique event ID** in every message (a header or field). Record processed IDs **in the same database transaction** as the business change:

```java
@KafkaListener(topics = "payments")
@Transactional
public void on(PaymentCompleted event) {
    if (!processedEvents.tryInsert(event.eventId())) {   // INSERT … with a unique constraint; false if it exists
        return;                                          // duplicate: skip
    }
    orderService.markPaid(event.orderId());
}
```

2. **Naturally idempotent operations:** "set status = PAID" (and ignore it if already PAID) instead of "increment balance", or upserts keyed by business ID.
3. **Unique constraints** on business keys (`payment_id`) as a safety net.
4. **On the producer side,** `enable.idempotence=true` (the default since Kafka 3.0) prevents duplicates caused by producer retries **within Kafka**. It doesn't solve consumer-side duplicates.

Kafka transactions (exactly-once) only cover **Kafka-to-Kafka** pipelines. When the side effect is a database write, an idempotent consumer is the practical answer. See [Delivery Semantics & Exactly-Once](/microservices/kafka/delivery-semantics-exactly-once/).

### Q33. Your consumer repeatedly fails to process one message. How would you handle poison messages?

A **poison message** can never succeed: it's malformed, fails deserialisation, or has invalid data. Retrying it forever **blocks the partition**, and every message behind it waits.

**Handle it:**

- **Classify errors.** Transient ones (database down, timeout) are retried with backoff. Permanent ones (validation, deserialisation) are **not retried**: send them straight to a **dead letter topic**.
- **Fail deserialisation safely** with `ErrorHandlingDeserializer`, so a corrupt payload doesn't crash the consumer loop:

```properties
spring.kafka.consumer.value-deserializer=org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
spring.kafka.consumer.properties.spring.deserializer.value.delegate.class=org.springframework.kafka.support.serializer.JsonDeserializer
```

- **Bounded retries, then the DLT:**

```java
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template);   // publishes to <topic>-dlt
    var backOff = new ExponentialBackOffWithMaxRetries(3);         // 1 s, 2 s, 4 s, then the DLT
    backOff.setInitialInterval(1000L);
    backOff.setMultiplier(2.0);
    var handler = new DefaultErrorHandler(recoverer, backOff);
    handler.addNotRetryableExceptions(ValidationException.class, DeserializationException.class);
    return handler;
}
```

- **Monitor and alert on the DLT.** Store the failure reason in headers (Spring adds `kafka_dlt-exception-message` and the original topic, partition and offset), fix the cause, then **replay** the messages from the DLT.

### Q34. How would you implement retry topics and a Dead Letter Queue (DLQ) in Kafka?

**Non-blocking retries** move a failed message to a separate retry topic, so the main partition keeps flowing:

```flow-h
orders
orders-retry-1000 (after 1 s)
orders-retry-4000 (after 4 s)
orders-retry-16000 (after 16 s)
orders-dlt
```

Spring Kafka's `@RetryableTopic` creates the topics and the routing for you:

```java
@RetryableTopic(
        attempts = "4",                                            // 1 original + 3 retries
        backoff = @Backoff(delay = 1000, multiplier = 4.0),
        exclude = {ValidationException.class})                     // permanent errors go straight to the DLT
@KafkaListener(topics = "orders", groupId = "order-processor")
public void process(OrderEvent event) {
    orderService.handle(event);
}

@DltHandler
public void dlt(OrderEvent event, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
    log.error("Order {} moved to DLT from {}", event.id(), topic);
    alerting.notify(event);
}
```

**Things to know:**

- Retry topics **give up ordering** for retried messages. If strict per-key order matters, use **blocking retries** (`DefaultErrorHandler`) instead.
- The consumer must be **idempotent**, because a message can be processed again after partial success.
- Use DLT metadata headers for diagnosis, and build a **replay tool** that republishes DLT messages to the main topic once the bug is fixed.
- Monitor the DLT size and alert on new entries.

See [Error Handling, Retries & DLT](/microservices/kafka/error-handling-retries-dlt/).

### Q35. Your Kafka consumer processes millions of transactions daily. How would you improve throughput?

Millions per day is about 12–100 messages per second on average, but **peaks** matter. Tune both Kafka and the processing:

**Parallelism**

- **More partitions** allow more consumers. Set Spring Kafka `concurrency` up to the number of partitions per instance, and scale instances.
- If ordering only matters per key, parallelise **within** a partition with tools like Confluent's Parallel Consumer, which keeps per-key order.

**Batching**

- **Batch listeners** process `List<ConsumerRecord>` and write to the database with JDBC batching or `INSERT … VALUES (…), (…)`:

```java
@KafkaListener(topics = "transactions", batch = "true")
public void onBatch(List<TransactionEvent> events) {
    transactionWriter.insertAll(events);   // JdbcTemplate.batchUpdate, or saveAll with hibernate.jdbc.batch_size
}
```

- Tune `max.poll.records` (for example 500), `fetch.min.bytes` and `fetch.max.wait.ms` to fetch larger chunks.

**Processing**

- Remove per-message remote calls: cache reference data, or bulk-fetch it for the whole batch.
- Make the database fast: indexes, batched writes, and no row-by-row transactions.
- Use efficient serialisation (Avro or Protobuf instead of large JSON) and compression (`lz4`, `zstd`).

**Producer side:** `linger.ms` (5–20 ms), `batch.size`, compression, and `acks=all` with idempotence for safety.

Measure messages per second per partition, and watch lag, processing time and rebalances. See [Performance, Monitoring & Security](/microservices/kafka/performance-monitoring-security/).

### Q36. A consumer processes an event and updates the database, but crashes before committing the Kafka offset. What happens when it restarts?

The offset wasn't committed, so after the restart (or after the partition is reassigned to another consumer) it **resumes from the last committed offset** and **processes the same event again**.

```flow
Poll offset 100
Process — database updated ✅
Crash before the offset commit ❌
Restart — committed offset is still 100
Event 100 is processed AGAIN
```

That's **at-least-once delivery**, and it's why consumers must be **idempotent** (Q32): the second processing must detect the event (a processed-event table or a unique key) and skip it, or produce the same result.

**Alternatives and refinements:**

- Commit the offset **after** processing (Spring Kafka's default `AckMode.BATCH`, or `RECORD`). Committing **before** processing gives at-most-once delivery: messages can be **lost** on a crash.
- **Store the offset in the database** in the same transaction as the business update, and seek to it on startup. That gives effectively-once processing for that database.
- **Kafka transactions** (exactly-once) only help when the output is also Kafka.

### Q37. How would you ensure that an order event is not lost between a database transaction and publishing to Kafka?

This is the **dual-write problem**: if you save the order and then publish, a crash in between loses the event. If you publish first and the transaction rolls back, the event describes something that never happened.

**Solution: the transactional outbox.**

```java
@Transactional
public Order placeOrder(PlaceOrder cmd) {
    Order order = orderRepository.save(Order.from(cmd));
    outboxRepository.save(new OutboxEvent(
            UUID.randomUUID(), "Order", order.getId(), "OrderPlaced", toJson(order)));
    return order;   // both rows commit together, or neither does
}
```

A separate relay publishes the outbox rows to Kafka:

- **A polling publisher:** a scheduled job reads unsent rows (`SELECT … FOR UPDATE SKIP LOCKED`), publishes them, and marks them sent.
- **Change data capture:** **Debezium** reads the database's transaction log and streams outbox inserts to Kafka. That gives lower latency and no polling, and the Outbox Event Router handles routing.

```flow-h
Business tables + outbox (one DB transaction)
Relay: poller or Debezium
Kafka topic
Consumers (idempotent)
```

The relay may publish a row more than once (for example, it crashes after publishing but before marking it sent), so consumers deduplicate by event ID. Use the aggregate ID (`orderId`) as the **message key** to keep per-order ordering.

### Q38. How would you maintain event ordering when processing multiple Kafka partitions?

Kafka guarantees order **only within a partition**. Design so that the events that need ordering land in the **same partition**:

- **Use the entity ID as the message key** (`orderId`, `accountId`). All events for one order go to one partition and stay in order, while different orders are processed in parallel.
- **Producer settings:** with `enable.idempotence=true` (the default), Kafka keeps order even with retries and up to 5 in-flight requests.
- **Consumer side:** keep **one thread per partition**, or a per-key ordered executor. Don't hand records from one partition to a thread pool that could reorder them.
- **Retries:** non-blocking retry topics break per-key ordering. Use blocking retries when order matters, or pause processing of that key.
- **Changing the partition count** remaps keys to new partitions, so plan the partition count up front.
- **Global ordering** across all events needs a single partition, which limits throughput. It's rarely truly required.
- **Defensive consumers:** include a **version or sequence number** in events and ignore stale ones (`if event.version <= current.version → skip`). That also protects against duplicates and replays.

### Q39. Kafka is healthy, but consumers are processing messages slowly. What metrics and application-level issues would you investigate?

**Kafka and consumer metrics:**

- consumer lag per partition, and its trend;
- `records-consumed-rate`, `fetch-latency-avg`, and `records-per-request-avg`;
- poll intervals and the time between polls (`time-between-poll-avg`, `poll-idle-ratio-avg`): low idle means processing is the bottleneck;
- the rebalance rate and the commit latency;
- Spring Kafka listener timing through Micrometer (`spring.kafka.listener`).

**Application issues:**

- **Slow per-message work:** synchronous HTTP calls, unbatched database writes, a transaction per message, or slow serialisation.
- **Database bottlenecks:** lock contention, missing indexes, a small pool for the listener concurrency.
- **Too little parallelism:** low `concurrency`, or fewer consumers than partitions.
- **Hot partitions:** one key holds most of the traffic.
- **GC pauses** or CPU throttling in containers.
- **Blocking retries** on failing messages that hold up the partition.
- **Logging too much,** such as logging every payload synchronously.
- **Large messages** that take long to deserialise.

Profile one listener with async-profiler or JFR, trace the downstream calls, and use batch processing where possible (Q35).

### Q40. How would you handle a sudden spike in incoming events without overwhelming the database?

Kafka is already a **buffer**: messages wait safely in the topic. The goal is to **consume at the rate the database can sustain**, not at the rate events arrive.

- **Cap the consumer concurrency** (and instances) at what the database can handle. Lag will grow temporarily, and that's fine.
- **Batch writes:** fewer, larger transactions with multi-row inserts.
- **Backpressure:** pause the listener container when database latency or the pool's pending count rises, and resume when it recovers:

```java
registry.getListenerContainer("ordersListener").pause();    // offsets are kept
registry.getListenerContainer("ordersListener").resume();
```

- **Rate limiting** in the consumer (for example a Resilience4j `RateLimiter`, or tokens per second).
- **Coalescing:** if only the latest state matters (prices, positions), collapse multiple updates per key before writing, or use a compacted topic.
- **Prioritise:** separate topics for critical and bulk events, with their own consumers.
- **Scale the database tier** if the spike is the new normal: write-optimised storage, sharding, or moving analytics to a separate store.
- **Monitor and alert on lag**, so a sustained spike gets attention before retention deletes unprocessed data.

## Key Takeaways

- ✅ Lag on all partitions means throughput; lag on one means a stuck message or a hot key.
- ✅ At-least-once delivery means idempotent consumers keyed by event ID.
- ✅ Poison messages go to a DLT; retry transient errors with backoff, and permanent errors not at all.
- ✅ The outbox pattern solves the dual-write problem between the database and Kafka.
- ✅ Order holds per partition: key by entity ID and keep one thread per partition.
- ✅ Kafka absorbs spikes; consume at the database's pace with batching and backpressure.
