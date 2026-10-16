---
title: Decomposing into Services & Domain-Driven Design
subtitle: Splitting by business capability, bounded contexts and ubiquitous language, aggregates, database per service, sizing services, coupling and cohesion, and the anti-patterns that create a distributed monolith.
order: 2
---

## Introduction

The hardest part of microservices isn't Spring Cloud — it's deciding **where the boundaries go**. Good boundaries let teams work independently; bad ones create chatty services that must change and deploy together. **Domain-Driven Design (DDD)** gives the vocabulary for drawing them.

## Decompose by Business Capability

A **business capability** is something the business does to create value: *take orders*, *process payments*, *manage inventory*, *ship parcels*, *notify customers*.

```tree
E-commerce business
  Catalogue | products, categories, search
  Ordering | carts, orders, checkout
  Payments | charges, refunds
  Inventory | stock levels, reservations
  Shipping | shipments, tracking
  Customer | profiles, addresses
  Notifications | email, SMS, push
```

Each capability is a candidate service. Capabilities change slowly, so service boundaries stay stable even as features change.

> [!WARNING]
> Don't split by **technical layer** (a "controller service", a "database service") or by **entity alone** (a "Product service" that every other service calls for every request). Both create services that can't do anything useful on their own.

## Bounded Contexts

In DDD, a **bounded context** is a boundary within which a model and its terms have one precise meaning. The same word can mean different things in different contexts:

| Context | "Product" means… |
| --- | --- |
| Catalogue | Name, description, images, categories |
| Inventory | SKU, warehouse location, quantity on hand |
| Pricing | Base price, discounts, tax rules |
| Shipping | Weight, dimensions, hazardous flag |

Forcing one giant shared `Product` model on everyone couples all teams. Instead, each bounded context has its **own model** of a product, linked by a shared ID. A bounded context is usually the right size for **one service** (or a small group of services owned by one team).

### Ubiquitous Language

Inside a bounded context, developers and domain experts use the **same terms** in conversations, code and documentation — `Order.place()`, `Shipment.dispatch()` — so the code reflects how the business actually talks.

## Aggregates

An **aggregate** is a cluster of objects treated as one unit for changes, with one **aggregate root** that guards its rules:

```tree
Order — aggregate root
  OrderLine
  OrderLine
  ShippingAddress — value object
```

- Outside code changes an order only through the root (`order.addLine(...)`, `order.cancel()`), which enforces invariants such as "a shipped order can't be cancelled".
- **One transaction changes one aggregate.** Changes to other aggregates — especially in other services — happen through events.
- Aggregates reference each other **by ID**, not by object: an `Order` holds a `customerId`, not a `Customer`.

## Database per Service

Each service **owns its data**. No other service reads or writes its tables:

```refs
Order service -> orders DB | only the order service touches it
Payment service -> payments DB
Inventory service -> inventory DB
```

| Shared database | Database per service |
| --- | --- |
| Easy joins and transactions | No cross-service joins or transactions |
| A schema change can break several services | Each team evolves its schema freely |
| Services coupled at the data level | Services coupled only through APIs and events |
| One database bottleneck | Each service picks and scales its own store |

How do services get data they don't own?

- **Ask for it** — call the owning service's API.
- **Keep a local copy** — subscribe to the owner's events and store the fields you need (e.g. the order service keeps customer names from `CustomerUpdated` events).
- **Compose it** — a gateway or "backend for frontend" calls several services and merges the results.

Cross-service workflows use **sagas** instead of distributed transactions — see *Data Management in Microservices* and the [Saga pattern](/design-patterns/essential-patterns/saga/).

## Sizing Services

| Too big | Too small ("nanoservices") |
| --- | --- |
| Several teams share it; deployments need coordination | Every feature touches several services |
| Mixed responsibilities and scaling needs | Chatty network calls for simple operations |
| Becoming a monolith again | Operational overhead per tiny service |

Heuristics:

- One **bounded context** per service as a starting point.
- **One team** can own it fully.
- Things that **change together** stay together (high cohesion).
- A typical user request is handled by **one or a few** services, not ten.

## Coupling and Cohesion

| Aim for | Avoid |
| --- | --- |
| **High cohesion** — related behaviour and data in the same service | Logic for one capability scattered across services |
| **Loose coupling** — services interact through stable, versioned contracts | Sharing databases, internal classes or deployment schedules |
| Asynchronous events where possible | Long chains of synchronous calls |

## Anti-Patterns

- ❌ **Shared database** — services coupled through tables.
- ❌ **Distributed monolith** — services that must be released together.
- ❌ **Chatty services** — dozens of calls per request.
- ❌ **Entity services** — a "Customer service" that is only CRUD over one table, called by everyone.
- ❌ **Shared domain library** — one JAR of domain classes used by all services; every change forces everyone to upgrade. (Sharing small technical libraries — logging, security config — is fine.)

## Interview Questions

### How do you decide service boundaries?

Decompose by business capability and DDD bounded contexts: group behaviour and data that change together, keep each service ownable by one team, and make sure a typical request touches few services.

### What is a bounded context?

A DDD boundary within which a domain model and its terms have one consistent meaning. Different contexts may model the same concept (like "Product") differently.

### What is an aggregate?

A cluster of domain objects changed as one unit through an aggregate root that enforces invariants; one transaction modifies one aggregate, and aggregates refer to each other by ID.

### Why should each service have its own database?

So services are loosely coupled: each team can change its schema and choose its storage independently, and no service can break another by touching its tables.

### How does a service get data owned by another service?

By calling its API, by maintaining a local read copy updated from the owner's events, or through API composition at a gateway or BFF.

## Key Takeaways

- ✅ Draw boundaries around business capabilities and bounded contexts, not technical layers.
- ✅ Each bounded context has its own model and ubiquitous language.
- ✅ Aggregates define transactional consistency boundaries; reference other aggregates by ID.
- ✅ Database per service is essential for independence.
- ✅ Aim for high cohesion and loose coupling; avoid chatty, entity-only and shared-database services.
