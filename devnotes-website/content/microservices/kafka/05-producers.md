---
title: Kafka Producers
subtitle: The producer send pipeline, a Java producer with sync and async sends and callbacks, serializers, partitioning, batching with linger.ms and batch.size, compression, acks, retries, idempotence and ordering, and the key producer settings.
order: 5
---

## Introduction

A **producer** writes records to Kafka. Sending looks like one method call, but behind it is a pipeline of serialization, partitioning, batching, compression, retries and acknowledgements. Understanding that pipeline explains most producer settings and interview questions.

## The Send Pipeline

```flow
send(record)
Serialize key and value into bytes
Partitioner chooses the partition
Record added to a batch for that partition (RecordAccumulator)
Sender thread sends full or expired batches to the partition leaders
Broker writes, replicates per acks, and responds
Callback runs — success with metadata, or an exception
```

`send()` is **asynchronous**: it adds the record to an in-memory buffer and returns a `Future` immediately. A background **sender thread** ships batches to brokers.

## A Plain Java Producer

```xml
<dependency>
    <groupId>org.apache.kafka</groupId>
    <artifactId>kafka-clients</artifactId>
    <version>4.1.0</version>
</dependency>
```

```java
Properties props = new Properties();
props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
props.put(ProducerConfig.ACKS_CONFIG, "all");

try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {

    ProducerRecord<String, String> record =
            new ProducerRecord<>("orders", "ORD-1001", "{\"status\":\"PLACED\"}");

    producer.send(record, (metadata, exception) -> {
        if (exception == null) {
            System.out.printf("Sent to %s-%d at offset %d%n",
                    metadata.topic(), metadata.partition(), metadata.offset());
        } else {
            System.err.println("Send failed: " + exception.getMessage());
        }
    });
}   // close() flushes buffered records before shutting down
```

```output
Sent to orders-2 at offset 17
```

> [!TIP]
> A `KafkaProducer` is **thread-safe** and expensive to create. Create **one per application** (or per configuration) and share it — never one per message. Always `close()` it on shutdown so buffered records are flushed.

### Three Ways to Send

| Style | Code | Trade-off |
| --- | --- | --- |
| Fire and forget | `producer.send(record)` | Fastest; failures are silently lost unless you check them |
| Synchronous | `producer.send(record).get()` | Simple error handling; one round trip per record — very slow |
| **Asynchronous with callback** | `producer.send(record, callback)` | Fast and you still see every failure — the usual choice |

> [!WARNING]
> Callbacks run on the producer's **I/O thread**. Keep them short — no database calls or blocking work — or you'll slow down every send.

### Headers

```java
ProducerRecord<String, String> record = new ProducerRecord<>("orders", "ORD-1001", json);
record.headers().add("eventType", "OrderPlaced".getBytes(StandardCharsets.UTF_8));
record.headers().add("traceId", traceId.getBytes(StandardCharsets.UTF_8));
```

## Serializers

Kafka stores bytes; serializers convert your objects:

| Serializer | Use |
| --- | --- |
| `StringSerializer`, `IntegerSerializer`, `LongSerializer`, `ByteArraySerializer` | Simple types |
| JSON serializer (Spring Kafka's `JsonSerializer`, or Jackson yourself) | Readable, flexible, no schema enforcement |
| Avro / Protobuf / JSON Schema serializers with Schema Registry | Compact, typed, schema evolution (see *Schemas & Serialization*) |

## Partitioning

| Record | Partition |
| --- | --- |
| Partition set explicitly | That one |
| Has a key | `murmur2(key) % partitions` — same key, same partition |
| No key | **Sticky partitioning** — fill a batch for one partition, then switch (since Kafka 2.4, improved in 3.3) |

You can plug in a custom `Partitioner`, but a good key is almost always enough.

## Batching: linger.ms and batch.size

Sending records one by one wastes network round trips. The producer groups records per partition into **batches**.

| Setting | Default | Meaning |
| --- | --- | --- |
| `batch.size` | 16384 (16 KB) | Maximum size of a batch per partition |
| `linger.ms` | 5 ms (Kafka 4.0+; 0 in earlier versions) | How long to wait for more records before sending a non-full batch |
| `buffer.memory` | 32 MB | Total memory for unsent records |
| `max.block.ms` | 60 s | How long `send()` blocks when the buffer is full or metadata is unavailable |

A batch is sent when it's **full** or when **`linger.ms` expires**, whichever comes first. Raising `linger.ms` (e.g. 10–50 ms) and `batch.size` (e.g. 64–256 KB) improves throughput at the cost of a little latency.

## Compression

```java
props.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");   // none, gzip, snappy, lz4, zstd
```

| Codec | Characteristics |
| --- | --- |
| `none` | Default; no CPU cost, most bytes |
| `snappy` / `lz4` | Fast, good ratio — common choices |
| `zstd` | Best ratio with good speed |
| `gzip` | Good ratio, highest CPU |

Compression works on whole **batches**, so it's more effective with batching enabled. Brokers store the compressed batches as-is and consumers decompress them.

## Acknowledgements (acks)

| `acks` | Success means… | Durability |
| --- | --- | --- |
| `0` | Sent | None — lost on any failure |
| `1` | Leader wrote it | Lost if the leader fails before replication |
| `all` | All in-sync replicas have it | Strongest — combine with `min.insync.replicas=2` |

Default since Kafka 3.0: **`acks=all`**.

## Retries and Delivery Timeout

Transient errors (leader changes, network blips, `NotEnoughReplicas`) are retried automatically:

| Setting | Default | Meaning |
| --- | --- | --- |
| `retries` | `Integer.MAX_VALUE` | Retry attempts — effectively bounded by the timeout below |
| `retry.backoff.ms` | 100 ms | Wait between retries (with exponential back-off up to `retry.backoff.max.ms`) |
| `delivery.timeout.ms` | 120000 (2 min) | Total time allowed for a send, including retries — then the callback gets an error |
| `request.timeout.ms` | 30000 | How long to wait for a single broker response |

Non-retriable errors (`RecordTooLargeException`, serialization errors, authorization failures) fail immediately.

## Idempotence and Ordering

Retries create a risk: the broker writes a batch, the acknowledgement is lost, the producer retries, and the batch is written **twice**. An **idempotent producer** prevents this:

- the broker assigns the producer an ID, and the producer numbers each batch per partition;
- the broker discards batches it has already written (same producer ID + sequence number).

```java
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);   // default since Kafka 3.0
```

Idempotence also **preserves ordering** during retries, provided `max.in.flight.requests.per.connection` ≤ 5 (the default is 5). Without idempotence, a retried batch could land after a later one.

| Setting | Default (Kafka 3.0+) |
| --- | --- |
| `enable.idempotence` | `true` |
| `acks` | `all` |
| `retries` | `Integer.MAX_VALUE` |
| `max.in.flight.requests.per.connection` | 5 |

> [!IMPORTANT]
> Idempotence removes duplicates caused by **producer retries** within a session. It doesn't stop your **application** from calling `send()` twice for the same business event (for example after a crash and restart). For that you need transactions, the outbox pattern, or idempotent consumers — see *Delivery Semantics & Exactly-Once*.

## Message Size

The default maximum record batch size on brokers is about **1 MB** (`message.max.bytes`), with matching producer (`max.request.size`) and topic (`max.message.bytes`) limits. For large payloads (files, images), store them in object storage (S3, Azure Blob) and send a **reference** in the event — the *claim-check* pattern.

## Key Producer Settings

| Goal | Settings |
| --- | --- |
| **Durability** | `acks=all`, `enable.idempotence=true`, topic `min.insync.replicas=2` |
| **Throughput** | Larger `batch.size`, `linger.ms` 10–50, `compression.type=lz4` or `zstd` |
| **Low latency** | Small `linger.ms`, smaller batches |
| **Bounded failure time** | `delivery.timeout.ms`, `max.block.ms` |

## Interview Questions

### Is KafkaProducer.send() synchronous?

No. It appends the record to a buffer and returns a `Future`; a background sender thread transmits batches. Call `.get()` to block, or pass a callback to handle the result asynchronously.

### What do linger.ms and batch.size control?

Batching. A batch is sent when it reaches `batch.size` or when `linger.ms` has passed since it was opened, whichever comes first. Larger values improve throughput and compression at the cost of latency.

### What is an idempotent producer?

A producer whose batches carry a producer ID and sequence numbers, so the broker can discard duplicates caused by retries. It's enabled by default since Kafka 3.0 and also keeps per-partition ordering during retries.

### What are the acks options?

`0` (no acknowledgement), `1` (leader only) and `all` (all in-sync replicas). `all` with `min.insync.replicas=2` is the durable choice.

### How do you guarantee ordering for related events?

Give them the same key so they go to the same partition, and keep idempotence enabled (or `max.in.flight.requests.per.connection=1` without it) so retries can't reorder batches.

### How do you send large messages?

Avoid it: store the payload externally and send a reference (claim check). If you must, raise `max.request.size`, broker `message.max.bytes` and topic `max.message.bytes` together, and compress.

## Common Mistakes

- ❌ **Creating a producer per message** or per request.
- ❌ **Fire-and-forget without checking failures.**
- ❌ **Blocking with `.get()` on every send** in a high-volume path.
- ❌ **Slow work inside callbacks.**
- ❌ **Forgetting `close()` / `flush()`** on shutdown — buffered records are lost.
- ❌ **Disabling idempotence** while keeping retries and several in-flight requests — duplicates and reordering.

## Key Takeaways

- ✅ `send()` is asynchronous; records are batched per partition and sent by a background thread.
- ✅ Use one shared, thread-safe producer, and an async send with a callback.
- ✅ The key decides the partition; no key means sticky partitioning.
- ✅ `linger.ms`, `batch.size` and compression tune throughput.
- ✅ Defaults since Kafka 3.0: `acks=all`, idempotence on, effectively unlimited retries bounded by `delivery.timeout.ms`.
- ✅ Idempotence prevents retry duplicates — not application-level duplicates.
