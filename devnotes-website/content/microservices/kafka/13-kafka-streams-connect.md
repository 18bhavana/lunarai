---
title: Kafka Streams & Kafka Connect
subtitle: Stream processing with Kafka Streams — KStream vs KTable, stateless and stateful operations, aggregations, windowing, joins and state stores — plus Kafka Connect source and sink connectors, change data capture with Debezium, and when to use each tool.
order: 13
---

## Introduction

Producers and consumers move events. Two parts of the Kafka ecosystem go further:

- **Kafka Streams** — a Java library for **processing** streams: filtering, transforming, aggregating and joining events in real time.
- **Kafka Connect** — a framework for **moving data** between Kafka and other systems (databases, S3, Elasticsearch) with configuration instead of code.

## Kafka Streams

Kafka Streams is a **library**, not a cluster: you add it to an ordinary Java (or Spring Boot) application, and it consumes from topics, processes the data and writes results back to topics. Scale it by running more instances — they share the work like a consumer group.

```xml
<dependency>
    <groupId>org.apache.kafka</groupId>
    <artifactId>kafka-streams</artifactId>
</dependency>
```

### KStream vs KTable

| `KStream` | `KTable` |
| --- | --- |
| A stream of **events** — every record is a new fact | A **changelog** — the latest value per key |
| `OrderPlaced`, `OrderPlaced`, `OrderPlaced`… | Current balance per account |
| Like an append-only log / INSERTs | Like a table / UPSERTs |
| Backed by a regular topic | Backed by a compacted topic |

```flow-h
Stream of events (KStream)
: aggregate by key
Table of current values (KTable)
: changes
Stream of updates
```

This **stream–table duality** is the core idea: aggregating a stream gives a table, and a table's changes form a stream.

### Stateless Operations

```java
StreamsBuilder builder = new StreamsBuilder();

KStream<String, OrderPlaced> orders = builder.stream("orders");

orders.filter((orderId, order) -> order.amount().compareTo(new BigDecimal("50000")) > 0)
      .mapValues(order -> new HighValueOrder(order.orderId(), order.customerId(), order.amount()))
      .to("high-value-orders");
```

`filter`, `map`, `mapValues`, `flatMap`, `branch`/`split`, `merge` and `peek` process each record independently.

### Stateful Operations — Aggregations

```java
KTable<String, Long> ordersPerCustomer = orders
        .groupBy((orderId, order) -> order.customerId())   // re-key by customer (causes a repartition)
        .count(Materialized.as("orders-per-customer-store"));

ordersPerCustomer.toStream().to("orders-per-customer");
```

State lives in a **local state store** (RocksDB by default) on each instance, and every change is also written to an internal **compacted changelog topic**. If an instance fails, another instance rebuilds the store from the changelog — so state is fault-tolerant.

### Windowing

Aggregate over time windows — for example, orders per customer every 5 minutes:

```java
orders.groupBy((id, order) -> order.customerId())
      .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
      .count()
      .toStream()
      .filter((windowedCustomer, count) -> count > 10)      // possible fraud: >10 orders in 5 minutes
      .map((windowedCustomer, count) -> KeyValue.pair(windowedCustomer.key(), count))
      .to("suspicious-customers");
```

| Window | Behaviour |
| --- | --- |
| **Tumbling** | Fixed, non-overlapping (every 5 minutes) |
| **Hopping** | Fixed size, overlapping (5-minute windows every minute) |
| **Sliding** | Defined by the time difference between records |
| **Session** | Activity periods separated by inactivity gaps |

### Joins

```java
KTable<String, Customer> customers = builder.table("customers");   // compacted topic

KStream<String, EnrichedOrder> enriched = orders
        .selectKey((orderId, order) -> order.customerId())         // join key must match
        .join(customers, (order, customer) -> new EnrichedOrder(order, customer.name(), customer.tier()));

enriched.to("orders-enriched");
```

Stream–stream, stream–table and table–table joins are supported. Joined topics must be **co-partitioned** (same key and partition count), or use a `GlobalKTable` for small reference data replicated to every instance.

### Running It

```java
Properties props = new Properties();
props.put(StreamsConfig.APPLICATION_ID_CONFIG, "order-analytics");      // also the consumer group ID
props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);

KafkaStreams streams = new KafkaStreams(builder.build(), props);
streams.start();
Runtime.getRuntime().addShutdownHook(new Thread(streams::close));
```

In Spring Boot, `@EnableKafkaStreams` and a `StreamsBuilder` bean configure this from `spring.kafka.streams.*`.

> [!TIP]
> **Interactive queries** let you read a state store directly over REST — for example, "how many orders has customer C-42 placed?" — without writing the result to a database.

## Kafka Connect

Kafka Connect runs **connectors** — reusable plugins that copy data in or out of Kafka:

```flow-h
Source systems — MySQL, PostgreSQL, MongoDB, files
Source connectors
Kafka topics
Sink connectors
Targets — Elasticsearch, S3, Snowflake, BigQuery, another DB
```

| Source connector | Sink connector |
| --- | --- |
| External system → Kafka | Kafka → external system |
| Debezium (CDC), JDBC source, file, MQTT | Elasticsearch, S3, JDBC sink, HTTP, BigQuery |

Connectors are configured with JSON and submitted to the Connect cluster's REST API — no application code:

```json
{
  "name": "orders-elasticsearch-sink",
  "config": {
    "connector.class": "io.confluent.connect.elasticsearch.ElasticsearchSinkConnector",
    "topics": "orders-enriched",
    "connection.url": "http://elasticsearch:9200",
    "key.ignore": "false",
    "tasks.max": "3"
  }
}
```

Connect handles offsets, scaling (tasks), retries, dead-letter queues and **Single Message Transforms (SMTs)** — simple per-record changes such as renaming fields or routing to different topics.

### Change Data Capture with Debezium

**Debezium** source connectors read a database's **transaction log** (MySQL binlog, PostgreSQL WAL) and publish every insert, update and delete as an event:

```json
{
  "op": "u",
  "before": { "id": 42, "status": "PLACED" },
  "after":  { "id": 42, "status": "PAID" },
  "source": { "table": "orders", "db": "shop" },
  "ts_ms": 1760521530000
}
```

Uses:

- **The transactional outbox** — Debezium publishes rows from an `outbox` table reliably (see *Delivery Semantics & Exactly-Once*).
- **Keeping search indexes and caches in sync** with the database.
- **Breaking up monoliths** — new services consume the old database's changes.
- **Feeding data warehouses** in near real time.

Unlike polling with `SELECT … WHERE updated_at > ?`, log-based CDC captures **every** change (including deletes) with low latency and no extra load from queries.

## Choosing a Tool

| Need | Use |
| --- | --- |
| Business logic reacting to individual events | Plain consumers / `@KafkaListener` |
| Transform, filter, aggregate, join or window streams in Java | **Kafka Streams** |
| SQL-like stream processing | ksqlDB or Apache Flink SQL |
| Large-scale, complex stream processing across many sources | **Apache Flink** |
| Move data between Kafka and databases or storage, with no custom code | **Kafka Connect** |
| Stream database changes as events | **Debezium** (on Kafka Connect) |

## Interview Questions

### What is Kafka Streams?

A Java library for building stream-processing applications that read from Kafka, process data (stateless or stateful, with windows and joins) and write back to Kafka, with fault-tolerant local state and exactly-once support.

### What is the difference between a KStream and a KTable?

A KStream is a stream of independent events (inserts); a KTable represents the latest value for each key (upserts), backed by a compacted topic.

### Where does Kafka Streams keep state, and how is it fault-tolerant?

In local state stores (RocksDB) on each instance, with every change also written to a compacted changelog topic; a replacement instance restores the store from that topic.

### What is Kafka Connect?

A framework and runtime for moving data between Kafka and external systems using source and sink connectors configured through a REST API, without writing code.

### What is CDC, and how does Debezium do it?

Change data capture: turning database changes into events. Debezium reads the database's transaction log and publishes each insert, update and delete to Kafka.

### When would you use Kafka Streams instead of a plain consumer?

When you need stateful processing — aggregations, windows or joins — with built-in fault-tolerant state and exactly-once guarantees, rather than per-event business logic.

## Common Mistakes

- ❌ **Joining topics that aren't co-partitioned.**
- ❌ **Writing custom producer/consumer code** for data movement that a connector already handles.
- ❌ **Polling the database for changes** instead of using log-based CDC.
- ❌ **Unbounded state** — aggregations without windows or retention on high-cardinality keys.
- ❌ **Changing `application.id`** casually — it resets the Streams app's offsets and state.

## Key Takeaways

- ✅ Kafka Streams is a library for real-time processing inside your own application.
- ✅ KStream = events; KTable = latest value per key; aggregating a stream yields a table.
- ✅ State lives in RocksDB stores backed by compacted changelog topics.
- ✅ Kafka Connect moves data in and out of Kafka with configuration, not code.
- ✅ Debezium streams database changes from the transaction log — the backbone of CDC and the outbox pattern.
