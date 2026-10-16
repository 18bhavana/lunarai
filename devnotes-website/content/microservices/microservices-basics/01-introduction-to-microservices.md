---
title: Introduction to Microservices
subtitle: Monolith vs microservices, what makes a service "micro", the real benefits and costs, the Spring Cloud toolbox, when microservices are the wrong choice, and the modular monolith alternative.
order: 1
---

## Introduction

> [!NOTE]
> **Interview importance:** very high. Almost every backend role mentions microservices, and interviewers check whether you understand the **trade-offs**, not just the buzzwords.

A **microservices architecture** builds one application as a set of **small, independently deployable services**, each owning one business capability and its own data, communicating over the network through APIs or events.

## The Monolith

A **monolith** is one deployable unit containing every feature:

```tree
shop.jar
  Orders module
  Payments module
  Inventory module
  Users module
  Notifications module
  One shared database
```

Monoliths are **not bad**. They're simple to build, test, deploy and debug, and most successful products start as one. Problems appear as the codebase and team grow:

| Growing pain | Effect |
| --- | --- |
| One huge codebase | Slow builds, hard to understand, tangled dependencies |
| One deployment | A one-line change redeploys everything; releases need coordination |
| One scaling unit | You must scale the whole app even if only search is busy |
| One technology stack | Hard to adopt a new framework or language for one part |
| Shared failure domain | A memory leak in reports can crash checkout |
| Many teams, one repo | Merge conflicts and release trains slow everyone down |

## Microservices

```flow-h
Client
API gateway
Order, Payment, Inventory, User, Notification services
Each service with its own database
```

```tree
Shop platform
  Order service | orders DB
  Payment service | payments DB
  Inventory service | inventory DB
  User service | users DB
  Notification service | no DB, consumes events
```

### Characteristics

- **Organised around business capabilities** — "payments", not "the database layer".
- **Independently deployable** — release a service without touching the others.
- **Own their data** — no other service reads or writes its database directly.
- **Communicate over the network** — REST/gRPC calls or asynchronous events (Kafka).
- **Small enough for one team** to own end to end ("you build it, you run it").
- **Decentralised** — each service can choose the right tools for its job.
- **Designed for failure** — any call can fail, so services use timeouts, retries and circuit breakers.

> [!TIP]
> "Micro" is about **independence and a single responsibility**, not lines of code. A good test: can one team change, test and deploy this service **without coordinating with other teams**?

## Benefits

| Benefit | How |
| --- | --- |
| **Independent deployment** | Small, frequent, low-risk releases per service |
| **Independent scaling** | Run 20 instances of search, 2 of user profile |
| **Fault isolation** | A failing recommendation service doesn't stop checkout (if designed well) |
| **Team autonomy** | Teams own services end to end and move at their own pace |
| **Technology flexibility** | Use the best tool per service (Java for payments, Python for ML) |
| **Easier to understand** | Each codebase is small and focused |

## Costs — the "Microservice Premium"

| Cost | What it means |
| --- | --- |
| **Distributed-system complexity** | Network latency, partial failures, timeouts, retries |
| **Data consistency** | No cross-service transactions — sagas and eventual consistency instead |
| **Operational overhead** | Many deployments, pipelines, configs, dashboards and alerts |
| **Harder debugging** | One request spans many services — you need distributed tracing |
| **Testing complexity** | Integration and contract testing across services |
| **Network cost** | An in-process call (nanoseconds) becomes an HTTP call (milliseconds) |
| **Duplication** | Shared concerns (auth, logging) must be handled consistently everywhere |

> [!WARNING]
> **A distributed monolith** is the worst of both worlds: services that must be deployed together, share a database, or call each other synchronously in long chains. You pay the complexity of microservices without getting their independence.

## When Microservices Are the Wrong Choice

- A **new product** whose domain boundaries aren't clear yet — boundaries drawn too early are expensive to move.
- A **small team** (one or two teams) — the operational overhead outweighs the benefits.
- **No automation** — without CI/CD, containers, monitoring and tracing, microservices are painful.
- **Tightly coupled data** that's constantly queried and updated together.

### The Modular Monolith

A middle ground: one deployable application with **strictly separated modules** (own packages, clear interfaces, no shared tables between modules). It keeps deployment simple while preparing clean boundaries — modules can later be extracted into services. Spring Modulith supports this style in Spring Boot.

## Monolith vs Microservices

| | Monolith | Microservices |
| --- | --- | --- |
| Deployment | One unit | Many independent units |
| Scaling | Whole application | Per service |
| Data | One shared database | Database per service |
| Transactions | Local ACID transactions | Sagas, eventual consistency |
| Communication | In-process method calls | Network calls and events |
| Failure | Can take down everything | Isolated, if designed for it |
| Complexity | In the code | In the infrastructure and interactions |
| Best for | Small teams, early products | Large organisations, independent teams, varied scaling needs |

## The Spring Cloud Toolbox

| Concern | Typical Spring / cloud solution | Chapter |
| --- | --- | --- |
| Calling other services | `RestClient`, `WebClient`, OpenFeign, gRPC | Inter-Service Communication |
| Finding services | Eureka, Spring Cloud LoadBalancer, Kubernetes DNS | Service Discovery |
| Single entry point | Spring Cloud Gateway | API Gateway |
| Central configuration | Spring Cloud Config, Kubernetes ConfigMaps | Config Server |
| Resilience | Resilience4j (circuit breaker, retry, bulkhead) | Resilience Patterns |
| Async messaging | Kafka, RabbitMQ (Spring Kafka, Spring Cloud Stream) | [Kafka Masterclass](/microservices/kafka/) |
| Security | OAuth2 / OIDC, JWT, Spring Security resource servers | Security |
| Observability | Micrometer, Prometheus, OpenTelemetry, Zipkin | Observability |
| Deployment | Docker, Kubernetes | Deployment |

## Migrating from a Monolith: the Strangler Fig

Rewriting a monolith from scratch is risky. The **strangler fig pattern** replaces it gradually:

```flow
Put a gateway or proxy in front of the monolith
Build one new service for one capability — e.g. notifications
Route that capability's traffic to the new service
Repeat, capability by capability
Retire the monolith when nothing is left
```

## Interview Questions

### What are microservices?

An architectural style that structures an application as small, independently deployable services, each owning a business capability and its data, communicating over the network.

### What are the advantages of microservices over a monolith?

Independent deployment and scaling, fault isolation, team autonomy, technology flexibility and smaller, more understandable codebases.

### What are the disadvantages?

Distributed-system complexity (latency, partial failures), no cross-service transactions, higher operational overhead, harder debugging and testing, and the risk of building a distributed monolith.

### When would you not use microservices?

For a new product with unclear boundaries, a small team, little automation or monitoring, or a domain where data is tightly coupled. A modular monolith is often a better starting point.

### What is a distributed monolith?

A system split into services that still have to be deployed together because of shared databases, tight synchronous coupling or shared release cycles — microservice complexity without microservice benefits.

### How would you migrate a monolith to microservices?

Incrementally, with the strangler fig pattern: route traffic through a gateway, extract one well-bounded capability at a time into a service with its own data, and retire the corresponding monolith code.

## Common Mistakes

- ❌ **Starting with microservices** before the domain is understood.
- ❌ **Sharing one database** between services.
- ❌ **Long chains of synchronous calls** — latency and failures add up.
- ❌ **Splitting by technical layer** ("controller service", "DAO service") instead of business capability.
- ❌ **No automation or observability** — dozens of services you can't deploy or debug.

## Key Takeaways

- ✅ Microservices are independently deployable services organised around business capabilities, each owning its data.
- ✅ They trade code complexity for distributed-system complexity.
- ✅ Benefits: independent deployment and scaling, fault isolation, team autonomy.
- ✅ Costs: network failures, eventual consistency, operational overhead, harder debugging.
- ✅ Start with a well-structured monolith when in doubt; extract services with the strangler fig.
