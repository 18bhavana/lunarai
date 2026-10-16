---
title: Microservices Interview Questions & Scenarios
subtitle: The most-asked microservices interview questions, real-world design and troubleshooting scenarios, a reference architecture for an e-commerce platform, the pattern catalogue, and a quick revision sheet.
order: 12
---

## Introduction

This chapter brings the topic together for interviews — quick answers to the classic questions, scenarios that test judgement, a reference architecture to sketch on a whiteboard, and a revision table.

> [!TIP]
> In microservices interviews, **trade-offs win points**. Say what you'd choose, why, and what it costs: "We used choreography with Kafka because the flow had three steps; for longer flows we'd move to an orchestrator."

## Interview Questions

### 1. What is a microservice?

A small, independently deployable service that owns one business capability and its data, communicating with other services over APIs or events.

### 2. Monolith vs microservices — which would you choose?

A well-structured (modular) monolith for small teams and new products with unclear boundaries; microservices when multiple teams need to deploy independently, parts of the system have very different scaling needs, and the organisation has strong automation and observability.

### 3. How do you identify service boundaries?

By business capability and DDD bounded contexts — group what changes together, keep each service ownable by one team, and give each its own data.

### 4. How do services communicate?

Synchronously (REST, gRPC) when an immediate answer is needed, asynchronously (Kafka, RabbitMQ) for events and workflows — with timeouts, retries and circuit breakers on synchronous calls.

### 5. What is service discovery?

A registry (Eureka) or platform feature (Kubernetes Services) that maps service names to the current healthy instances, combined with load balancing.

### 6. What does an API gateway do?

Provides a single entry point that handles routing, authentication, rate limiting, load balancing, resilience and observability for client traffic.

### 7. How do you handle distributed transactions?

With sagas — local transactions plus compensations — coordinated by events (choreography) or an orchestrator, events published through a transactional outbox, and idempotent consumers.

### 8. How do you prevent cascading failures?

Timeouts, bounded retries with back-off and jitter, circuit breakers, bulkheads, rate limiting and fallbacks (Resilience4j), plus asynchronous communication where possible.

### 9. How do you secure microservices?

OAuth2/OIDC with an authorization server, JWT access tokens validated at the gateway and by every service (zero trust), object-level authorization, client-credentials tokens or mTLS for service-to-service calls, and TLS everywhere.

### 10. How do you trace a request across services?

Distributed tracing with Micrometer Tracing / OpenTelemetry: a trace ID propagated in headers through HTTP and Kafka, spans exported to Zipkin/Jaeger/Tempo, and the same trace ID in every log line.

### 11. How do you manage configuration?

Externalized configuration — Spring Cloud Config backed by Git, or Kubernetes ConfigMaps — with secrets in Vault or a cloud secret manager, and refresh via `@RefreshScope` or a rollout.

### 12. How do you deploy without downtime?

Rolling, blue-green or canary deployments with readiness probes and graceful shutdown, backward-compatible APIs and events, and expand–contract database migrations.

### 13. How do you test microservices?

A pyramid: many unit tests, integration tests with Testcontainers, consumer-driven contract tests between services, and a small number of end-to-end tests.

### 14. What is the database-per-service pattern, and its drawbacks?

Each service owns its own database, giving loose coupling and independent schemas — but losing cross-service joins and ACID transactions, which are replaced by API composition, CQRS views and sagas.

### 15. What's a distributed monolith?

Services that can't be deployed independently because of shared databases, tight synchronous coupling or shared libraries and release schedules.

## Scenario Questions

### "The payment service is down. What happens to checkout?"

Without protection, order-service threads pile up waiting and checkout fails, possibly taking other features down. With resilience: a timeout fails fast, the circuit breaker opens after repeated failures, and a fallback accepts the order as *payment pending*; an event or retry job charges the customer once payment recovers, and the user is told the order is being confirmed.

### "A request takes 8 seconds. How do you find out why?"

Open the trace for a slow request (Zipkin/Jaeger) to see which span is slow; check that service's metrics (latency percentiles, connection-pool and thread-pool saturation, GC) and its logs filtered by the trace ID; then fix the cause — a slow query, missing index, sequential calls that could be parallel, or a dependency without a timeout.

### "Two services share a database. Is that a problem?"

Yes — they're coupled at the schema level: a change by one team can break the other, and they can't scale or deploy independently. Assign the data to one owner; the other gets it through an API or by keeping its own copy updated from events.

### "How would you split our monolith?"

Map business capabilities and bounded contexts; pick an edge capability with clear boundaries and real benefit (independent scaling or frequent change); put a gateway in front (strangler fig); extract it with its own data, using events to sync during the transition; repeat. Invest in CI/CD, observability and contract tests first.

### "Orders sometimes appear without a matching payment record."

A dual write: the order service saved the order and then failed to publish the event (or vice versa). Use a transactional outbox so the event is recorded in the same database transaction, make consumers idempotent, and add a reconciliation job to detect anything stuck.

### "After each deployment, some requests fail for a minute."

Likely causes: pods receiving traffic before they're ready (missing or wrong readiness probe), pods killed before finishing in-flight requests (no graceful shutdown or too short a grace period), or a backward-incompatible change while old and new versions run together. Fix probes, enable graceful shutdown, and keep APIs, events and schemas backward compatible.

### "One customer's request can see another customer's order."

Broken object-level authorization: the service checks that a token is valid but not that the order belongs to the caller. Enforce ownership checks in the service (compare the token's subject or tenant with the resource), not just at the gateway.

### "Service A calls B, B calls C, C calls D — and it's slow and fragile."

Long synchronous chains multiply latency and failure probability. Cache or replicate the data A needs, call independent services in parallel, move non-blocking work to events, and revisit boundaries if services are always called together.

## A Reference Architecture

```flow
Web and mobile clients
CDN and WAF
API gateway — auth, rate limiting, routing
Order, Catalog, Payment, Inventory and User services — each with its own database
Kafka — OrderPlaced, PaymentCompleted, StockReserved events
Notification, Search and Analytics services — consumers
Observability — logs, metrics, traces; Config and Secrets; Kubernetes
```

Talking points: database per service; synchronous calls only for queries; events for state changes; an outbox for reliable publishing; sagas for checkout; Resilience4j on every client; OAuth2 resource servers; tracing everywhere; one pipeline per service.

## The Pattern Catalogue

| Problem | Pattern |
| --- | --- |
| Single entry point | API gateway, BFF |
| Finding instances | Service discovery (client- or server-side) |
| Configuration | Externalized / centralized configuration |
| Partial failures | Timeout, retry, circuit breaker, bulkhead, fallback |
| Data ownership | Database per service |
| Cross-service transactions | Saga (choreography / orchestration) |
| Reliable event publishing | Transactional outbox, CDC |
| Cross-service queries | API composition, CQRS |
| History and audit | Event sourcing |
| Migration | Strangler fig |
| Observability | Log aggregation, distributed tracing, health check API |
| Security | Access tokens, zero trust, mTLS |
| Deployment | Service per container, blue-green, canary |

## Quick Revision

| Topic | Remember |
| --- | --- |
| Microservice | Independently deployable, owns one capability and its data |
| When not to | Small team, unclear domain, little automation — use a modular monolith |
| Boundaries | Business capability + bounded context; high cohesion, loose coupling |
| Communication | Sync (REST/gRPC) for answers, async (Kafka) for reactions; always timeouts |
| Clients | `RestClient`, `WebClient`, OpenFeign / `@HttpExchange` |
| Discovery | Eureka + Spring Cloud LoadBalancer (`@LoadBalanced`, `lb://`) or Kubernetes Services |
| Gateway | Spring Cloud Gateway: routes, predicates, filters; auth, rate limits, resilience |
| Config | Spring Cloud Config (Git), `spring.config.import`, `@RefreshScope`, Bus; or ConfigMaps |
| Resilience | Resilience4j: Retry → CircuitBreaker → RateLimiter → TimeLimiter → Bulkhead |
| Data | DB per service, sagas, outbox, CQRS, event sourcing, eventual consistency |
| Security | OAuth2/OIDC, JWT resource servers, zero trust, client credentials, mTLS |
| Observability | Logs + metrics (Micrometer/Prometheus) + traces (Micrometer Tracing/OTel) |
| Deployment | Docker layers, Kubernetes probes, graceful shutdown, canary, expand–contract |

## Key Takeaways

- ✅ Lead with trade-offs: microservices buy independence at the cost of distributed complexity.
- ✅ Most scenario answers combine: clear ownership, timeouts and circuit breakers, events + outbox, idempotency, tracing.
- ✅ Know the Spring Cloud building blocks and their Kubernetes equivalents.
- ✅ Security and observability are designed in from the start, not added later.
