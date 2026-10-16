---
title: Message Queues & Asynchronous Processing
subtitle: Why move work off the request path, queues vs event streams, point-to-point and publish–subscribe, back-pressure and load levelling, delivery guarantees, ordering, idempotency, dead-letter queues, and choosing Kafka, RabbitMQ or SQS.
order: 9
---

## Introduction

Not everything has to happen while the user waits. Sending emails, resizing images, generating PDFs or updating analytics can happen **asynchronously**: the request records the work and returns, and background workers process it. **Message queues** and **event streams** make this reliable.

## Synchronous vs Asynchronous Processing

```flow-h
Sync: request — resize image (3 s) — save — respond — user waits 3 s
```

```flow-h
Async: request — save and enqueue job — respond in 50 ms — worker resizes later
```

| Benefit | Example |
| --- | --- |
| **Faster responses** | Return "upload received" immediately |
| **Load levelling** | A sale spike fills the queue; workers drain it at a steady pace |
| **Decoupling** | The producer doesn't know or care which services consume the message |
| **Resilience** | If the email service is down, messages wait in the queue instead of failing requests |
| **Independent scaling** | Add workers when the queue grows |

## Queues vs Event Streams

| Message queue (RabbitMQ, SQS, ActiveMQ) | Event stream / log (Kafka, Kinesis, Pulsar) |
| --- | --- |
| A message is consumed by **one** worker, then **removed** | Events are **retained**; many consumer groups read independently |
| Great for **jobs and tasks** — "resize this image" | Great for **facts many systems react to** — "order placed" |
| Per-message acknowledgement and redelivery | Consumers track offsets; replay is possible |
| Flexible routing (exchanges, topics, priorities, delays) | Ordering per partition; very high throughput |

### Messaging Models

```tree
Point-to-point (work queue)
  Queue → Worker 1 or Worker 2 or Worker 3 | each message handled once
Publish–subscribe
  Topic → Email service, Analytics service, Fraud service | each receives every message
```

## Back-Pressure and Load Levelling

A queue absorbs bursts:

```flow
Black Friday: 20,000 orders per second arrive
Orders are accepted and queued
Workers process 5,000 per second
Queue grows, then drains over the following minutes
Database never sees more than it can handle
```

Watch the **queue depth / consumer lag**: if it keeps growing, add workers (or fix slow processing). Bound queues where necessary and reject or shed load gracefully rather than run out of memory.

## Delivery Guarantees

| Guarantee | Meaning |
| --- | --- |
| At-most-once | May be lost, never duplicated |
| **At-least-once** | Never lost, may be duplicated — the common default |
| Exactly-once | Each message has effect once — only within specific systems (e.g. Kafka transactions); end to end it needs idempotent consumers |

> [!IMPORTANT]
> Assume **every message can arrive twice**. Make consumers **idempotent** — use a message or event ID, upserts, or a processed-messages table — so duplicates are harmless. See [Delivery Semantics & Exactly-Once](/microservices/kafka/delivery-semantics-exactly-once/).

## Ordering

- Most queues give **no ordering** across concurrent consumers.
- Kafka orders messages **within a partition** — use the entity ID as the key.
- SQS FIFO queues and RabbitMQ single-consumer queues preserve order at lower throughput.
- If strict global order isn't required, design consumers to tolerate reordering (version numbers, timestamps).

## Failures and Dead-Letter Queues

```flow
Worker fails to process a message
Message is retried with back-off — redelivered or retry queue
? Still failing after N attempts? | Yes: move it to a dead-letter queue (DLQ) and alert | No: processed successfully
```

A **dead-letter queue** stops one bad message (a *poison pill*) from blocking everything else. Monitor DLQs, fix the cause, and replay.

## Common Asynchronous Patterns

| Pattern | Example |
| --- | --- |
| **Background jobs** | Video transcoding, report generation, bulk email |
| **Fan-out** | One `OrderPlaced` event → email, inventory, analytics, loyalty |
| **Event-driven microservices** | Services react to each other's events (choreographed sagas) |
| **Request–reply over messaging** | Long-running work; the result is published to a reply queue or the client polls a status URL |
| **Scheduled / delayed work** | "Send a reminder in 24 hours" — delayed queues or scheduled jobs |
| **Outbox** | Reliable publication alongside a database change |

### Telling the Client the Result

For long jobs, return **202 Accepted** with a status URL:

```http
POST /api/reports        →  202 Accepted
Location: /api/reports/7f3a/status

GET /api/reports/7f3a/status  →  {"status": "PROCESSING"}
GET /api/reports/7f3a/status  →  {"status": "DONE", "downloadUrl": "…"}
```

Or push the result with WebSockets, server-sent events, a webhook or a notification.

## Choosing a Technology

| Need | Good fit |
| --- | --- |
| Event streaming, many consumers, replay, very high throughput | **Apache Kafka** (see the [Kafka Masterclass](/microservices/kafka/)) |
| Task queues, flexible routing, priorities, per-message acks | **RabbitMQ** |
| Fully managed queue with minimal operations on AWS | **Amazon SQS** (+ SNS for pub/sub) |
| Managed pub/sub on GCP / Azure | Google Pub/Sub, Azure Service Bus / Event Hubs |
| Simple background jobs inside one app | A Redis-backed job queue or a database table with a scheduler |

## Interview Questions

### Why use a message queue?

To move slow work off the request path, absorb load spikes, decouple producers from consumers, keep working when consumers are down, and scale workers independently.

### Queue vs event stream?

In a queue, each message is processed by one consumer and removed — ideal for tasks. In an event stream like Kafka, events are retained and read independently by many consumer groups — ideal for facts many systems react to, and replay.

### How do you handle duplicate messages?

Make consumers idempotent: deduplicate by message ID, use upserts or natural idempotency, or record processed IDs in the same transaction as the side effect.

### What is a dead-letter queue?

A separate queue for messages that repeatedly fail processing, so they don't block others and can be inspected and replayed.

### How does a client get the result of an asynchronous job?

Return 202 Accepted with a status URL to poll, or notify the client via WebSockets, server-sent events, webhooks or push notifications.

## Key Takeaways

- ✅ Asynchronous processing makes responses fast and systems resilient to spikes and outages.
- ✅ Queues suit tasks for one worker; event streams suit facts for many consumers, with replay.
- ✅ Expect at-least-once delivery — make consumers idempotent.
- ✅ Ordering is limited (per partition or per FIFO queue); design for it.
- ✅ Retry with back-off, then dead-letter; monitor queue depth and lag.
