---
title: Microservices & Distributed Systems Scenarios
subtitle: "Scenario questions 21–30: failed payments after order creation, lost payment confirmations, cascading failures, Resilience4j circuit breakers, retries without retry storms, consistency across services, Saga vs distributed transactions, distributed monoliths, gateway debugging and distributed tracing."
order: 3
---

## Introduction

In a distributed system, **partial failure is normal**: the network drops messages, services restart, and calls time out without telling you whether they succeeded. These scenarios test whether you design for that, using sagas, idempotency, resilience patterns and observability. For background, see the [Microservices Fundamentals](/microservices/microservices-basics/introduction-to-microservices/) topic, especially [Resilience Patterns](/microservices/microservices-basics/resilience-patterns/) and [Data Management](/microservices/microservices-basics/data-management/).

## Scenario Questions

### Q21. Your Order Service creates an order, but the Payment Service fails. How would you handle the order's state?

Model the order as a **state machine**, and never pretend a step succeeded:

```flow
PENDING_PAYMENT — order saved, payment requested
? Payment result | Yes: PAID → CONFIRMED | No: PAYMENT_FAILED → CANCELLED (release reserved stock)
```

- Create the order as `PENDING_PAYMENT`, not `CONFIRMED`.
- If payment **definitely fails** (card declined), move the order to `PAYMENT_FAILED`/`CANCELLED` and run **compensations**: release the inventory reservation and notify the user.
- If the result is **unknown** (a timeout), don't cancel blindly. The payment might have gone through. Mark it `PAYMENT_UNKNOWN`, then **query the payment provider** using the order's idempotency key, or wait for its webhook or event. A reconciliation job resolves orders that stay stuck.
- Let the user retry the payment with the same order (and a new payment attempt ID).
- Use **events** (`OrderCreated` → `PaymentCompleted` / `PaymentFailed`) published through the **outbox pattern**, so state changes and messages can't diverge.

This is a **saga**: a sequence of local transactions with compensating actions instead of one distributed transaction.

### Q22. Payment succeeds, but the Order Service never receives the payment confirmation. How would you recover without charging the customer twice?

1. **Idempotent payment requests.** The Order Service sends a stable idempotency key (for example the `orderId`) with every payment request. The payment service or provider returns the **existing result** instead of charging again. Stripe, Razorpay and most other providers support this.
2. **Reliable delivery of the confirmation.** The Payment Service writes `PaymentCompleted` to an **outbox table** in the same transaction as the payment record, and a relay publishes it to Kafka until it succeeds. Consumers handle redeliveries **idempotently** (Q32).
3. **Recovery paths for missed confirmations.** The Order Service **queries** payment status for orders stuck in `PENDING_PAYMENT` past a timeout. Provider **webhooks** with retries are deduplicated by event ID. A periodic **reconciliation job** compares the provider's records with orders and fixes mismatches.
4. **Never charge again just because the confirmation is missing.** Check status first. If the order can't be fulfilled, **refund** rather than leaving the money taken.

### Q23. One microservice goes down, and several other services start failing. How would you prevent a cascading failure?

The cascade happens because callers **wait** (holding threads and connections) and **retry** (multiplying the load). Break the chain:

- **Timeouts** on every remote call, so nobody waits forever.
- **Circuit breakers:** stop calling a failing service and fail fast. Half-open probes detect recovery.
- **Bulkheads:** separate thread pools or concurrency limits per dependency, so one bad dependency can't use all of the capacity.
- **Fallbacks:** cached data, defaults, or reduced functionality. A product page without recommendations is better than an error page.
- **Retries with limits, exponential backoff and jitter,** and only for idempotent operations (Q25).
- **Asynchronous communication** for work that doesn't need an immediate answer: if the email service is down, the queue holds the messages.
- **Load shedding and rate limiting:** reject excess work early (429/503) instead of collapsing.
- **Health checks and autoscaling,** so failed instances are replaced and traffic avoids them.
- **Avoid long synchronous chains.** A → B → C → D multiplies the failure probability and the latency.

Test it with **chaos engineering**: kill a dependency in staging and confirm the rest of the system stays up.

### Q24. How would you implement a Circuit Breaker pattern in Spring Boot using Resilience4j?

```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

```yaml
resilience4j:
  circuitbreaker:
    instances:
      inventory:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 20
        minimum-number-of-calls: 10
        failure-rate-threshold: 50              # open when 50% of calls fail
        slow-call-duration-threshold: 2s
        slow-call-rate-threshold: 50            # or when 50% of calls are slow
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3
        record-exceptions:
          - java.io.IOException
          - org.springframework.web.client.ResourceAccessException
        ignore-exceptions:
          - com.example.BusinessValidationException
```

```java
@Service
public class InventoryClient {

    @CircuitBreaker(name = "inventory", fallbackMethod = "stockFallback")
    public StockResponse getStock(String sku) {
        return restClient.get().uri("/stock/{sku}", sku).retrieve().body(StockResponse.class);
    }

    private StockResponse stockFallback(String sku, Throwable ex) {
        return StockResponse.unknown(sku);   // or cached data
    }
}
```

**States:**

```flow-h
CLOSED — calls pass, failures counted
OPEN — calls rejected immediately (CallNotPermittedException) for 30 s
HALF_OPEN — a few trial calls; success → CLOSED, failure → OPEN
```

**Good practice:**

- Combine it with a **timeout** (a client read timeout, or `@TimeLimiter` for async calls) and, carefully, a **retry**. The default aspect order, from outermost to innermost, is Retry → CircuitBreaker → RateLimiter → TimeLimiter → Bulkhead → your call.
- **Ignore business exceptions** such as 4xx validation errors. They don't mean the service is unhealthy.
- Monitor breaker states through Actuator (`/actuator/circuitbreakers`) and Micrometer, and alert when a breaker opens.
- Spring Cloud CircuitBreaker offers the same abstraction over Resilience4j if you prefer it.

### Q25. A downstream service is temporarily unavailable. How would you implement retries without creating a retry storm?

A **retry storm** happens when every client retries immediately, in lockstep, often at several layers (gateway, service A and service B each retrying three times means 27 attempts). The struggling service gets more traffic exactly when it can least handle it.

**Retry safely:**

- Retry only **transient** failures (timeouts, 503, connection reset), never 4xx client errors.
- Retry only **idempotent** operations, or use idempotency keys.
- Use **few attempts** (2–3) with **exponential backoff** and **random jitter**:

```yaml
resilience4j:
  retry:
    instances:
      inventory:
        max-attempts: 3
        wait-duration: 200ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        enable-randomized-wait: true
        randomized-wait-factor: 0.5
        retry-exceptions:
          - java.io.IOException
```

- Retry at **one layer only**, usually the caller closest to the failure.
- Put a **circuit breaker** around retries, so once the service is clearly down you stop trying.
- Use a **retry budget**: cap retries at a fraction of normal traffic (for example 10%).
- Respect `Retry-After` headers and 429 responses.
- For work that doesn't need an immediate answer, **move retries to a queue** (Kafka retry topics, delayed messages) instead of retrying synchronously.

### Q26. How would you maintain data consistency when a business transaction spans multiple microservices?

Each service owns its database, so there's no single ACID transaction. Use **eventual consistency** with guarantees:

1. **Saga pattern:** each service runs a local transaction and publishes an event. If a later step fails, earlier steps are undone by **compensating transactions** (refund the payment, release the stock). With **choreography**, services react to each other's events: simple, but the flow is spread across services. With **orchestration**, a central orchestrator (an order saga service, or tools like Temporal or Camunda) tells each service what to do and tracks state, which is clearer for complex flows.
2. **Transactional outbox:** write the business change and the outgoing event in the **same local transaction**, then relay events to Kafka (a polling publisher, or Debezium CDC). This prevents "saved but not published" and "published but not saved".
3. **Idempotent consumers:** messages may arrive more than once, so deduplicate them by event ID.
4. **Semantic locks and states:** mark records `PENDING` while a saga is running, so other operations know they aren't final.
5. **Reconciliation jobs** to detect and fix anything that drifted.

```flow
Order Service — create order PENDING + outbox event (one local transaction)
Inventory Service — reserve stock, publish StockReserved
Payment Service — charge, publish PaymentCompleted (or PaymentFailed → compensations)
Order Service — mark CONFIRMED (or CANCELLED)
```

### Q27. When would you use the Saga pattern instead of a distributed database transaction?

Almost always in microservices. **Two-phase commit (2PC/XA)** across services:

- needs every participant to support XA (Kafka, most NoSQL stores and REST APIs don't);
- **holds locks** across network calls, which hurts throughput and availability;
- **blocks** if the coordinator fails at the wrong moment;
- couples services tightly at the infrastructure level.

**Use a saga when:**

- the operation spans services with **separate databases**, or external systems such as payment providers and email;
- steps can take a long time (seconds, or days for approvals);
- availability and scalability matter more than immediate consistency;
- each step has a meaningful **compensation**.

**2PC (or simply one database) can still make sense when:**

- everything lives in **one database**: then use a normal local transaction and reconsider the service boundaries;
- a legacy, tightly coupled system already relies on XA, at low volume.

If two services constantly need a shared transaction, that's a sign they **belong together** in one service.

### Q28. Your microservices are becoming tightly coupled and behaving like a distributed monolith. How would you fix the architecture?

**Signs:** services must be deployed together, one change touches many services, long synchronous call chains, shared databases, and shared domain libraries that force lockstep upgrades.

**Fixes:**

- **Redraw the boundaries around business capabilities** (bounded contexts from DDD). Merge services that always change together, and split ones that hold unrelated responsibilities.
- **One database per service.** Others get the data through APIs or events, never through each other's tables.
- **Prefer asynchronous events** for notifications between domains, so the publisher doesn't need to know its consumers.
- **Own your data copies:** keep the fields you need, updated from events, instead of calling another service on every request.
- **Stable, versioned contracts** (OpenAPI, Avro or Protobuf with a schema registry) and **consumer-driven contract tests** (Pact, Spring Cloud Contract), so services can deploy independently.
- **Thin shared libraries:** only cross-cutting utilities, never shared domain models.
- **Independent pipelines and releases** for each service.

Sometimes the honest answer is that a **modular monolith** fits the team better. Microservices are worth their cost only when independent deployment and scaling matter.

### Q29. An API Gateway is operational, but requests to one particular service are failing. How would you debug the issue?

Follow the request hop by hop:

1. **The status code and who returned it.** `404` usually means a route mismatch. `502`/`503` means the gateway can't reach a healthy instance. `504` means the service is too slow (gateway timeout). `401`/`403` comes from a gateway auth filter or from the service itself.
2. **Gateway routing configuration:** path predicates, `StripPrefix` or rewrite filters, the target URI (`lb://order-service`), and recent config changes.
3. **Service discovery:** are instances registered and healthy in Eureka, Consul or Kubernetes? Do they have the right names and ports?
4. **Call the service directly**, bypassing the gateway (`curl` inside the cluster). If that works, the problem is the gateway configuration, headers or network policy. If it fails, it's the service.
5. **Gateway and service logs, using the trace ID** that the gateway propagated.
6. **Gateway filters:** auth token relay, header size limits, CORS, rate limits or circuit breakers configured for that route.
7. **Network:** Kubernetes service selectors, network policies, TLS between gateway and service, DNS.
8. **Timeouts:** the gateway's response timeout compared with the service's actual latency.

Gateway metrics (`spring.cloud.gateway.requests` by route and status) quickly show whether only that route is failing.

### Q30. How would you trace one request across five microservices and identify which service introduced the latency?

Use **distributed tracing**:

- The first service (or the gateway) creates a **trace ID**. Every hop creates a **span** (with start time and duration) and passes the context on in headers (W3C `traceparent`). That includes HTTP calls and Kafka messages.
- In Spring Boot 3, **Micrometer Tracing** with an OpenTelemetry or Brave bridge does this automatically for `RestClient`, `WebClient`, `RestTemplate` (when built from the auto-configured builder), Kafka templates and listeners, and JDBC (with datasource-micrometer).

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

```properties
management.tracing.sampling.probability=0.1
logging.pattern.level=%5p [${spring.application.name:},%X{traceId:-},%X{spanId:-}]
```

- Export spans to **Jaeger, Zipkin, Grafana Tempo** or a commercial APM. The **waterfall view** shows each service's span, so you can see whether the latency is inside a service (its own work or a DB span) or between services (network and queuing).
- Include the **trace ID in every log line** (MDC), so you can jump from a slow span to that service's logs.
- Add **custom spans** for important internal steps (`@Observed`, or the `Observation` API).
- Sample a small percentage of normal traffic, but keep more traces for **errors and slow requests** (tail-based sampling in the OpenTelemetry Collector).

See [Observability](/microservices/microservices-basics/observability/).

## Key Takeaways

- ✅ Model long-running business flows as state machines and sagas with compensations.
- ✅ Idempotency keys, the outbox pattern and reconciliation prevent double charges and lost events.
- ✅ Timeouts, circuit breakers, bulkheads, fallbacks and careful retries stop cascades.
- ✅ Retry with backoff and jitter at one layer, inside a circuit breaker.
- ✅ Fix distributed monoliths with better boundaries, owned data, events and contracts.
- ✅ Distributed tracing with propagated trace IDs pinpoints latency.
