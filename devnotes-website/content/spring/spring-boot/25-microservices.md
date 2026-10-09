---
title: Spring Boot Microservices
subtitle: Monolith vs microservices, database per service, sync vs async communication, Eureka, API Gateway, Config Server, OpenFeign, load balancing, Resilience4j, tracing, Saga and idempotency.
order: 25
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Microservices are one of the most important topics for 5–10 years Java Spring Boot developers — most large enterprises (Netflix, Amazon, Uber, Spotify, LinkedIn, Walmart, PayPal, Adobe) have moved from monolithic applications to microservices.

Interviewers frequently ask: What are microservices? Monolith vs microservices? What are service discovery and Eureka? What are an API gateway and a config server? What is OpenFeign? What are circuit breakers and Resilience4j? What is distributed tracing? What is the Saga pattern? What is idempotency? How do microservices communicate, and how do transactions work across them?

## What is a Monolithic Application?

One large application where **every module is deployed together**:

```buckets E-commerce monolith — everything runs inside one application
One application: User module, Order module, Payment module, Inventory module, Notification module
Database: One shared database
```

### Problems with a Monolith

Suppose only the payment module has high traffic. You still have to scale the **entire application** — more CPU, more memory, higher cost. Other problems: slow deployments, a large codebase, difficult scaling and maintenance, technology lock-in, and one failure can affect the whole application.

## What are Microservices?

Microservices split the application into **multiple independent services**:

```flow
Client
Gateway
User · Order · Payment · Inventory · Notification services
Each service has its own database
```

Each service has its **own code**, its **own deployment**, its **own database**, and can **scale independently**.

### Monolith vs Microservices

**Interview favourite.**

| Monolith | Microservices |
| --- | --- |
| Single application | Multiple applications |
| Single deployment | Independent deployments |
| Shared database | Database per service |
| Scale the entire app | Scale only the required service |
| Easier to start | Better for large systems |
| Tightly coupled | Loosely coupled |

## Typical Microservice Architecture

```flow
Internet
Load balancer
API gateway
User MS · Order MS · Payment MS · Inventory MS
User DB · Order DB · Payment DB · Inventory DB
```

## Why Separate Databases?

❌ **Wrong:** all services → one database. Problems: tight coupling, schema conflicts and shared failures.

✅ **Correct:** User Service → User database; Order Service → Order database. **Each service owns its data.**

## Service Communication

Microservices communicate using REST APIs, gRPC, Kafka or RabbitMQ — in two styles:

| Synchronous (e.g. REST) | Asynchronous (e.g. Kafka) |
| --- | --- |
| Order → Payment → Inventory over HTTP | Order → Kafka topic → Notification |
| ✅ Simple, immediate response | ✅ Loose coupling, better scalability and fault tolerance |
| ❌ Tight runtime dependency, higher latency, cascading failures | ❌ Eventual consistency, more operational complexity |

## Service Discovery

> [!QUESTION] How does Order Service know where Payment Service is running?
> Instead of hard-coding `http://10.1.2.5:8080`, microservices use **service discovery**.

### Eureka Server

Spring Cloud Netflix **Eureka**:

```flow
Payment Service starts
Registers with Eureka (status UP)
Order Service asks Eureka for payment-service
Gets an address
Calls Payment Service
```

Eureka maintains a **registry** of available service instances.

> [!TIP]
> On Kubernetes, the platform's own service discovery (Services + DNS) often replaces Eureka.

## API Gateway

**Interview favourite.** Instead of the client calling User, Order and Payment services directly:

```flow-h
Client
API gateway
Microservices
```

Gateway responsibilities: routing, authentication, authorization, rate limiting, logging, SSL termination and request filtering. A popular choice is **Spring Cloud Gateway**.

```flow-h
Client
Gateway
Authentication
Routing
Service
```

## Config Server

Imagine 100 microservices that all need a database URL, JWT secret, Kafka URL and Redis URL. Storing these in every application is a bad idea. Instead:

```flow-h Centralized configuration
Git repository
Config Server
All microservices
```

## OpenFeign

**Interview favourite.** Without Feign you write manual HTTP calls with `RestTemplate`/`RestClient`. With Feign:

```java
@FeignClient(name = "payment-service")
public interface PaymentClient {

    @PostMapping("/pay")
    PaymentResponse pay(@RequestBody PaymentRequest request);
}
```

Spring generates the client implementation automatically (enable it with **`@EnableFeignClients`**). Benefits: less boilerplate, better readability, and integration with service discovery and load balancing.

## Load Balancing

Payment Service runs as instances 1, 2 and 3; the client-side load balancer **chooses one instance** per call. Modern Spring Cloud uses **Spring Cloud LoadBalancer** (it replaced Netflix Ribbon).

## Circuit Breaker

One of the most asked interview questions.

**Problem:** Order Service calls Payment Service, which is **down**. Order keeps retrying, threads become blocked, and the entire system slows down.

### Resilience4j Circuit Breaker

```flow
CLOSED — calls flow normally
: failure rate exceeds the threshold
OPEN — calls are blocked / fallback
: after a wait duration
HALF_OPEN — a few test calls allowed
? Test calls succeed? | Yes: back to CLOSED | No: back to OPEN
```

Benefits: prevents cascading failures, improves resilience and enables graceful recovery.

### Retry

Sometimes failures are temporary: *call failed → retry → retry → success*. Resilience4j supports configurable retry policies (with backoff).

### Timeout

**Never wait forever.** E.g. Order Service waits at most 2 seconds for Payment Service → timeout → fallback. Always configure sensible timeouts.

### Bulkhead

**Problem:** a slow Payment Service consumes all threads and the entire application blocks. A **bulkhead** isolates dependencies (separate thread pools or concurrency limits for payment, inventory, notification), so one failing dependency can't consume all resources.

## Distributed Tracing

One request flows through Gateway → Order → Payment → Inventory → Notification. **How do you trace it?** Use **OpenTelemetry**, **Zipkin** or **Jaeger**: each request receives a **trace ID** that's propagated to every service, so the entire request can be followed end to end.

> [!NOTE]
> In Spring Boot 3, tracing is provided by **Micrometer Tracing** (the successor to Spring Cloud Sleuth), with OpenTelemetry or Brave bridges.

## Event-Driven Architecture

Instead of Order calling Notification directly, Order **publishes an event**:

```flow-h Services become loosely coupled
Order Service
Publish event
Kafka
Notification Service
Email
```

## Saga Pattern

**Interview favourite.** Traditional database transactions don't span multiple independent microservices. Instead, use a **Saga**:

```flow
Create order
Reserve inventory
? Take payment — success? | Yes: Ship order | No: Cancel inventory → cancel order
```

Each service performs a **compensating action** to undo its local step.

### Choreography vs Orchestration

| Choreography | Orchestration |
| --- | --- |
| Each service reacts to events (Order → Inventory → Payment → Shipping) | A central saga orchestrator tells Order, Payment, Inventory and Shipping what to do |
| No central coordinator | One coordinator controls the workflow |

## Distributed Transactions

Microservices generally **avoid two-phase commit (2PC)** because of its complexity and impact on availability. The preferred approach:

```flow-h
Local transaction
Publish event
Next service
Compensating action on failure
```

## Idempotency

**Interview favourite.** A user clicks **Pay Now** five times — payment should occur **only once**.

```flow
Request with idempotency key
? Already processed? | Yes: Return the previous result | No: Process and store the result
```

Common in payment systems.

## Database Per Service

❌ Never let Order Service query the Payment database directly. ✅ Order Service calls the **Payment API**. Each service owns its database.

## Independent Deployment

Deploying Payment v2 requires **no deployment** of Order Service.

## Common Spring Cloud Components

| Component | Purpose |
| --- | --- |
| Eureka | Service discovery |
| Spring Cloud Gateway | API gateway |
| Config Server | Centralized configuration |
| OpenFeign | Declarative REST client |
| Spring Cloud LoadBalancer | Client-side load balancing |
| Resilience4j | Circuit breaker, retry, bulkhead |
| Spring Cloud Bus | Configuration refresh events |
| OpenTelemetry | Distributed tracing |

## Internal Request Flow

```flow
Client
API gateway
Authentication
Service discovery
Load balancer
Microservice
Database
Kafka event
Other services
```

## Common Mistakes

- ❌ **Shared database** — each service should own its own data.
- ❌ **Synchronous calls everywhere** — too many REST hops increase latency and cause cascading failures; use async messaging where appropriate.
- ❌ **No circuit breaker** — a failing downstream service can take down the whole system.
- ❌ **No timeouts** — remote calls without connection/read timeouts can block threads indefinitely.
- ❌ **Ignoring idempotency** — payment APIs must safely handle retries.
- ❌ **No observability** — without logs, metrics and traces, production debugging is extremely difficult.

## Enterprise Architecture

```flow
Internet
Load balancer
Spring Cloud Gateway — authentication / JWT
Eureka server
User · Order · Payment · Inventory · Notification microservices
User DB · Order DB · Payment DB · Inventory DB · Kafka
Prometheus · Grafana · OpenTelemetry
```

## Interview Questions

### Q1. What is a microservice?

A small, independently deployable service that owns a specific business capability and communicates with other services over well-defined APIs or messaging.

### Q2. Monolith vs microservices?

| Monolith | Microservices |
| --- | --- |
| Single deployment | Independent deployments |
| Shared codebase | Separate services |
| Easier initially | Better scalability and team autonomy |

### Q3. What is service discovery?

A mechanism that lets services locate each other dynamically without hard-coded addresses.

### Q4. What is Eureka?

A service registry where microservices register themselves and discover other services.

### Q5. Why use an API gateway?

To provide a single entry point for routing, authentication, rate limiting, logging and other cross-cutting concerns.

### Q6. What is OpenFeign?

A declarative HTTP client that lets you call REST services through Java interfaces.

### Q7. What is a circuit breaker?

A resilience pattern that temporarily stops calls to a failing service to prevent cascading failures.

### Q8. What is the Saga pattern?

A distributed-transaction pattern where each service performs a local transaction and, if necessary, executes compensating actions instead of relying on a global transaction.

### Q9. What is idempotency?

The property that lets the same request be safely retried multiple times while producing the effect only once.

### Q10. Why should each microservice have its own database?

To maintain loose coupling, independent deployments and clear ownership of data.

## Key Takeaways

- ✅ Microservices split a large application into independently deployable services.
- ✅ Each service owns its database and exposes APIs instead of sharing data.
- ✅ API gateways centralize routing, authentication and cross-cutting concerns.
- ✅ Service discovery removes hard-coded service addresses.
- ✅ OpenFeign simplifies service-to-service REST calls.
- ✅ Resilience4j provides circuit breakers, retries, bulkheads and timeouts.
- ✅ Sagas and idempotency handle distributed business processes safely.
- ✅ Observability — metrics, logs and distributed tracing — is critical in production.
