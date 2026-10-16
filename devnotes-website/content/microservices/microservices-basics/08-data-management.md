---
title: Data Management in Microservices
subtitle: Database per service and its consequences, why distributed transactions don't fit, sagas, the transactional outbox, eventual consistency, API composition, CQRS and read models, event sourcing, and handling queries that span services.
order: 8
---

## Introduction

In a monolith, one database transaction keeps everything consistent and one SQL join answers any question. Splitting data across services takes both away. This chapter covers the patterns that replace them.

## The Consequences of Database per Service

| You lose | You need instead |
| --- | --- |
| ACID transactions across entities in different services | **Sagas** and eventual consistency |
| Joins across services' tables | **API composition** or **CQRS read models** |
| Foreign keys across services | References by ID, validated by the owning service |
| One schema to change | Versioned APIs and events |

## Why Not Distributed Transactions?

**Two-phase commit (2PC)** can coordinate a transaction across databases, but in microservices it:

- **holds locks** in every participant until the coordinator decides — slow and contention-prone;
- **blocks** if the coordinator fails at the wrong moment;
- reduces **availability** — all participants must be up at once;
- isn't supported by many message brokers and NoSQL stores.

So microservices accept **eventual consistency** and use sagas.

## Sagas

A **saga** is a sequence of local transactions, one per service; if a step fails, **compensating transactions** undo the earlier steps.

```flow
Order service creates the order — PENDING
Payment service charges the customer
Inventory service reserves stock
? Every step succeeded? | Yes: order CONFIRMED | No: compensate — refund payment, cancel order
```

| Choreography | Orchestration |
| --- | --- |
| Services react to each other's events | A central orchestrator sends commands |
| No central coordinator; loosely coupled | Flow is explicit and easy to follow |
| Best for short flows | Best for long or complex flows |

The full pattern — compensations, both styles, idempotency and pitfalls — is in the [Saga pattern chapter](/design-patterns/essential-patterns/saga/).

## Publishing Events Reliably: the Outbox

A service that saves data **and** publishes an event can't do both atomically with a database and Kafka. The **transactional outbox** writes the event to an `outbox` table in the same database transaction, and a relay (a poller or Debezium CDC) publishes it.

```flow-h
Business update + outbox row — one DB transaction
Relay reads the outbox
Event published to Kafka
```

See [Delivery Semantics & Exactly-Once](/microservices/kafka/delivery-semantics-exactly-once/) for the details. Because the relay is at-least-once, **consumers must be idempotent**.

## Eventual Consistency

After an order is placed, the inventory service may update a second later. During that window, different services show different states — the system is **eventually consistent**.

Making it work for users:

- **Show intermediate states** honestly — "Order received, confirming payment…".
- **Read your own writes** — return the created resource in the response, or read from the owning service right after a write.
- **Design idempotent, order-tolerant consumers** (version numbers, timestamps).
- **Define acceptable staleness** per feature — a product listing can be minutes old; an account balance can't.

## Querying Across Services

*"Show a customer's orders with product names and shipment status"* needs data from three services.

### API Composition

A composer (gateway, BFF or a dedicated service) calls each owner and joins the results in memory:

```flow
Composer receives the request
Calls Order, Product and Shipping services in parallel
Joins the results in memory
Returns one response
```

Simple, but latency is the slowest call, availability depends on every service, and it doesn't suit large datasets or complex filtering.

### CQRS — Command Query Responsibility Segregation

Separate the **write model** (commands, owned by each service) from **read models** built for queries. Services publish events; a query service consumes them and maintains a **denormalized view**:

```flow
Order, Product and Shipping services publish events
Order-history query service consumes them
Updates a denormalized customer_order_view table or a search index
Queries read the view directly — fast and simple
```

| Benefits | Costs |
| --- | --- |
| Fast, query-specific views (SQL, Elasticsearch, Redis) | Read models are eventually consistent |
| Read and write sides scale independently | More moving parts — events, projections, rebuilds |
| No cross-service joins at query time | Must handle duplicates and out-of-order events |

## Event Sourcing

Instead of storing current state, **store every change as an event** and derive state by replaying them:

```buckets
Account A-1: Opened, Deposited 1000, Withdrew 200, Deposited 500
```

Current balance = replay → **1300**.

| Benefits | Costs |
| --- | --- |
| Complete audit history by design | Unfamiliar model; harder queries (needs CQRS views) |
| Rebuild state or new views at any time | Event schema evolution must be handled carefully |
| Natural fit with event-driven systems | Replays can be slow — use snapshots |

Event sourcing suits domains where history matters (banking ledgers, audits, booking systems) — it's not a default choice for every service. Frameworks: Axon, EventStoreDB; Kafka is often the transport rather than the event store.

## Data Ownership and Shared Reference Data

- Each piece of data has **one owning service** — the only one that writes it.
- Other services keep **read-only copies** of the fields they need, updated from events.
- Small, rarely-changing reference data (countries, currencies) can be published on a compacted Kafka topic for every service to cache.

## Interview Questions

### How do you maintain consistency across microservices?

With sagas of local transactions and compensating actions, events published reliably through a transactional outbox, idempotent consumers, and accepting eventual consistency where the business allows it.

### Why not use distributed transactions (2PC)?

They hold locks across services, block on coordinator failure, reduce availability and aren't supported by many brokers and databases.

### How do you query data that lives in several services?

API composition for simple cases; CQRS read models — denormalized views built from events — for complex or high-volume queries.

### What is CQRS?

Separating the write side (commands updating the owning services) from read-optimised query models, usually kept up to date asynchronously from events.

### What is event sourcing?

Persisting every state change as an immutable event and rebuilding state by replaying events, giving full history at the cost of a more complex model.

### What is eventual consistency, and how do you handle it in a UI?

Different services converge to a consistent state after a short delay. Show intermediate states, return the written data immediately, and set staleness expectations per feature.

## Key Takeaways

- ✅ Database per service removes cross-service transactions and joins.
- ✅ Sagas with compensations replace distributed transactions.
- ✅ The transactional outbox publishes events reliably; consumers must be idempotent.
- ✅ Use API composition for simple cross-service queries and CQRS read models for complex ones.
- ✅ Event sourcing stores history as events — powerful, but not a default.
