---
title: Introduction to Apache Kafka
subtitle: What event streaming is, why systems use Kafka instead of direct API calls, publish–subscribe vs queues, real-world use cases, and how Kafka compares with RabbitMQ and cloud services.
order: 1
---

## Introduction

> [!NOTE]
> **Interview importance:** high for microservices roles. Kafka appears in most modern backend job descriptions, and interviewers expect you to explain partitions, consumer groups, offsets and delivery guarantees — not just "it's a message queue".

**Apache Kafka** is a distributed **event-streaming platform**. Applications **publish** streams of events to Kafka, Kafka **stores** them durably and in order, and other applications **subscribe** to and **process** those events — in real time or later.

It was created at LinkedIn in 2010, open-sourced in 2011, and is now an Apache project used by most large technology companies.

## What Is an Event?

An event (also called a record or message) is a fact that something happened:

```json
{
  "eventType": "OrderPlaced",
  "orderId": "ORD-1001",
  "customerId": "C-42",
  "amount": 2499.00,
  "timestamp": "2026-10-15T10:15:30Z"
}
```

Events are **immutable** — you don't change "order placed"; you publish a new event such as "order cancelled".

## The Problem Kafka Solves

Without a messaging system, services call each other directly:

```flow-h
Order service
Payment, Inventory, Email, Analytics, Fraud — called one by one
```

This creates problems:

- **Tight coupling** — the order service must know every consumer and change whenever one is added.
- **Cascading failures** — if the email service is down, placing an order fails or slows down.
- **Load spikes** — a sale-day burst hits every downstream service at once.
- **No replay** — once a call is made, there's no history to reprocess.

With Kafka, the producer publishes once and each consumer reads independently:

```flow
Order service publishes OrderPlaced to the orders topic
Kafka stores the event durably
Payment, Inventory, Email, Analytics and Fraud each read it at their own pace
```

| Without Kafka | With Kafka |
| --- | --- |
| Producer knows every consumer | Producer only knows the topic |
| A slow consumer slows the producer | Consumers read at their own pace |
| Downstream outage = failure | Events wait in Kafka until the consumer recovers |
| No history | Events are retained and can be replayed |

## Kafka's Three Capabilities

| Capability | Meaning |
| --- | --- |
| **Publish and subscribe** | Write and read streams of events, like a messaging system |
| **Store** | Keep events durably and fault-tolerantly for as long as you configure (hours, days, forever) |
| **Process** | Transform, join and aggregate streams as they occur (Kafka Streams, Flink, ksqlDB) |

## Why Kafka Is Fast and Scalable

- **Append-only log** — writes go to the end of a file, which disks and the OS page cache handle extremely efficiently.
- **Partitioning** — a topic is split into partitions spread across brokers, so reads and writes scale horizontally.
- **Batching and compression** — producers send records in compressed batches.
- **Zero-copy reads** — brokers send data from the page cache to the network without copying it through the application.
- **Pull-based consumers** — consumers fetch at their own speed; the broker doesn't track per-message delivery state.

A modest cluster handles **hundreds of thousands to millions of events per second**.

## Messaging Models

### Point-to-Point (Queue)

Each message is consumed by **one** consumer and then removed — like a job queue.

### Publish–Subscribe

Each message is delivered to **every** subscriber.

### Kafka Does Both

Kafka uses **consumer groups**:

- consumers in the **same** group share the work — each event goes to one consumer in the group (queue-like);
- **different** groups each receive every event independently (pub/sub-like).

```tree
orders topic
  payment-service group | every event, shared among its instances
  email-service group | every event, shared among its instances
  analytics group | every event, read later in bulk
```

And unlike a traditional queue, reading a message doesn't delete it — it stays until its **retention** period ends, so new consumers can start from the beginning.

## Common Use Cases

| Use case | Example |
| --- | --- |
| **Microservice communication** | `OrderPlaced` triggers payment, inventory and notification services |
| **Event-driven architecture / sagas** | Choreographed sagas across services (see the Saga pattern chapter) |
| **Activity tracking** | Page views, clicks and searches feeding analytics |
| **Log and metrics aggregation** | Application logs from thousands of servers to Elasticsearch |
| **Change data capture (CDC)** | Database changes streamed with Debezium to other systems |
| **Stream processing** | Real-time fraud detection, recommendations, alerts |
| **Data pipelines** | Moving data into data lakes and warehouses |
| **IoT and telemetry** | Sensor readings from vehicles and devices |

## Kafka vs Other Messaging Systems

| | Apache Kafka | RabbitMQ | Cloud services (Amazon Kinesis / SQS, Google Pub/Sub, Azure Event Hubs) |
| --- | --- | --- | --- |
| Model | Distributed, partitioned, replicated **log** | Message **broker** with exchanges and queues | Managed streaming or queuing |
| After consumption | Messages **retained** (replayable) | Messages removed once acknowledged | Varies — Kinesis/Event Hubs retain; SQS removes |
| Ordering | Per partition | Per queue (with one consumer) | Per shard/partition |
| Throughput | Very high | High, lower than Kafka at scale | High, with per-shard/quota limits |
| Routing | Topic + key | Flexible routing (direct, topic, fanout, headers) | Limited |
| Operations | You run it (or use Confluent Cloud, Amazon MSK, Aiven…) | You run it (or a hosted service) | Fully managed, vendor-specific |
| Best for | Event streaming, high volume, replay, many consumers | Task queues, complex routing, request/reply | Teams standardised on one cloud |

## Limitations

- **Operational complexity** — a production cluster needs capacity planning, monitoring and upgrades (managed services reduce this).
- **Ordering only within a partition**, not across a whole topic.
- **Not a database** — no ad-hoc queries; you read sequentially by offset.
- **Not ideal for per-message routing, priorities or delays** — a traditional broker suits those better.
- **Large messages** (several MB) hurt performance; store the payload elsewhere and send a reference.

## Interview Questions

### What is Apache Kafka?

A distributed event-streaming platform that lets applications publish, durably store and subscribe to streams of events, with high throughput, horizontal scalability and fault tolerance.

### Why use Kafka instead of direct REST calls between services?

It decouples producers from consumers, absorbs load spikes, keeps working when consumers are down, lets many consumers read the same events independently, and keeps a replayable history.

### Is Kafka a queue or pub/sub?

Both. Consumers in the same group share partitions (queue semantics), while different groups each receive every event (pub/sub semantics).

### Does Kafka delete a message after it's consumed?

No. Messages stay until the topic's retention time or size limit is reached (or are compacted), regardless of who has read them.

### Kafka vs RabbitMQ?

Kafka is a replicated, partitioned log optimised for high-throughput streaming and replay; RabbitMQ is a traditional broker with flexible routing where messages are removed once acknowledged. Use Kafka for event streams and data pipelines, RabbitMQ for task queues and complex routing.

## Key Takeaways

- ✅ Kafka is a distributed event-streaming platform: publish, store and process events.
- ✅ It decouples services — producers write to topics without knowing who reads them.
- ✅ Messages are retained and replayable, not deleted on consumption.
- ✅ Consumer groups give both queue and pub/sub semantics.
- ✅ It's fast thanks to append-only logs, partitioning, batching, compression and zero-copy.
- ✅ Ordering is guaranteed only within a partition.
