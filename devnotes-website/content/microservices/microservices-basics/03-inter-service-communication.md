---
title: Inter-Service Communication
subtitle: Synchronous vs asynchronous communication, REST with RestClient, WebClient and OpenFeign, gRPC, timeouts and connection pools, propagating headers, idempotency, API versioning, contract testing, and choosing between calls and events.
order: 3
---

## Introduction

Once a system is split into services, they have to talk. The choice between **synchronous calls** and **asynchronous events** shapes latency, coupling and how failures spread.

## Synchronous vs Asynchronous

| Synchronous (request/response) | Asynchronous (events / messages) |
| --- | --- |
| REST, gRPC, GraphQL | Kafka, RabbitMQ, SQS |
| Caller waits for the answer | Caller publishes and continues |
| Simple to reason about; immediate result | Eventual consistency; the result arrives later |
| **Temporal coupling** — both services must be up | Producer and consumer don't need to be up at the same time |
| Failures and latency propagate along the call chain | A slow consumer just builds a backlog |
| Good for queries and commands needing an immediate answer | Good for notifications, workflows, data replication |

```flow
? Does the caller need the answer right now to continue? | Yes: synchronous call — with a timeout, retries and a circuit breaker | No: publish an event — Kafka or RabbitMQ
```

> [!TIP]
> A healthy system usually mixes both: **synchronous for queries** ("what's the price?") and **asynchronous for state changes others react to** ("order placed").

## REST with Spring

### RestClient (Spring Framework 6.1+)

The modern synchronous HTTP client, with a fluent API:

```java
@Configuration
public class ClientConfig {

    @Bean
    RestClient inventoryClient(RestClient.Builder builder) {
        return builder
                .baseUrl("http://inventory-service")
                .requestFactory(timeouts())
                .build();
    }

    private ClientHttpRequestFactory timeouts() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        return factory;
    }
}
```

```java
@Service
public class InventoryGateway {

    private final RestClient inventoryClient;

    public InventoryGateway(RestClient inventoryClient) {
        this.inventoryClient = inventoryClient;
    }

    public StockLevel stockFor(String sku) {
        return inventoryClient.get()
                .uri("/api/stock/{sku}", sku)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError,
                        (req, res) -> { throw new ProductNotFoundException(sku); })
                .body(StockLevel.class);
    }
}
```

`RestTemplate` still works but is in maintenance mode — prefer `RestClient` for new synchronous code.

### WebClient (Reactive)

Non-blocking, for Spring WebFlux applications or when making many concurrent calls:

```java
Mono<StockLevel> stock = webClient.get()
        .uri("/api/stock/{sku}", sku)
        .retrieve()
        .bodyToMono(StockLevel.class)
        .timeout(Duration.ofSeconds(3));
```

### OpenFeign — Declarative Clients

Write an interface; Spring Cloud generates the client:

```java
@SpringBootApplication
@EnableFeignClients
public class OrderServiceApplication { }

@FeignClient(name = "inventory-service")          // resolved via service discovery
public interface InventoryClient {

    @GetMapping("/api/stock/{sku}")
    StockLevel stockFor(@PathVariable String sku);

    @PostMapping("/api/reservations")
    Reservation reserve(@RequestBody ReservationRequest request);
}
```

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:
            connect-timeout: 2000
            read-timeout: 3000
```

> [!NOTE]
> Spring Framework 6 also offers **HTTP interface clients** (`@HttpExchange` interfaces backed by `RestClient` or `WebClient`) — a built-in declarative option without the Spring Cloud OpenFeign dependency.

## gRPC

**gRPC** uses HTTP/2 and Protocol Buffers for compact, typed, fast service-to-service calls:

```text
service InventoryService {
  rpc GetStock (StockRequest) returns (StockReply);
}
```

| REST + JSON | gRPC |
| --- | --- |
| Human-readable, easy to debug with curl | Binary, needs tooling |
| Universal browser and tool support | Limited browser support (gRPC-Web) |
| Loosely typed | Strongly typed contracts, generated code |
| HTTP/1.1 or 2 | HTTP/2, streaming in both directions |
| Best for public APIs | Best for high-volume internal calls |

## Timeouts Are Mandatory

Without a timeout, a slow downstream service holds your threads until they run out — and your service fails too.

| Timeout | Meaning | Typical value |
| --- | --- | --- |
| **Connect timeout** | Time to establish a TCP connection | 1–2 s |
| **Read (response) timeout** | Time to wait for the response | Based on the downstream's p99 latency + margin, e.g. 2–5 s |
| **Overall deadline** | Total time budget for the whole request, including retries | Set at the edge and passed down |

> [!IMPORTANT]
> Default timeouts in many HTTP clients are **infinite** or very long. Always set connect and read timeouts explicitly on every client.

Also configure a **connection pool** (Apache HttpClient or Reactor Netty) with sensible limits, so each call doesn't open a new TCP/TLS connection.

## Propagating Context

Downstream calls should carry:

- the **authentication** token (or a service token) — see *Security in Microservices*;
- a **correlation / trace ID** so logs and traces link up — Micrometer Tracing propagates W3C `traceparent` headers automatically with Spring's clients;
- the **user's locale** or tenant ID where relevant.

## Idempotency for Retries

A retried `POST /payments` after a timeout could charge twice — the first request may actually have succeeded. Make unsafe operations idempotent with an **idempotency key**:

```http
POST /api/payments
Idempotency-Key: 6f1c2a7e-9a3b-4f0e-b1d2-3c4d5e6f7a8b
```

The server stores the key with the result; a repeat with the same key returns the stored result instead of charging again.

## API Versioning and Compatibility

Services are deployed independently, so APIs must evolve without breaking callers:

- **Additive changes are safe** — new optional fields, new endpoints.
- **Tolerant readers** — clients ignore unknown fields (Jackson: `FAIL_ON_UNKNOWN_PROPERTIES=false`, Spring Boot's default).
- **Breaking changes** get a new version — `/api/v2/orders` or a version header — and the old version is retired only after all callers move.

## Contract Testing

How do you know a provider's change won't break its consumers? **Consumer-driven contract tests** (Pact, Spring Cloud Contract) record what each consumer expects; the provider's build verifies it still satisfies every contract — catching breaking changes before deployment, without spinning up every service.

## Avoiding Synchronous Call Chains

```flow-h
Gateway
Order service
Pricing service
Discount service
Customer service
```

If each hop is 99.9% available, five hops in series give about 99.5%, and latencies add up. Reduce chains by:

- keeping a **local copy** of data you need (updated from events);
- calling services **in parallel** rather than in sequence (`CompletableFuture`, `Mono.zip`);
- moving non-essential work to **events**;
- revisiting boundaries if two services always call each other.

## Interview Questions

### Synchronous vs asynchronous communication — when do you use each?

Synchronous (REST/gRPC) when the caller needs an immediate answer; asynchronous (events through Kafka or RabbitMQ) for state changes other services react to, long-running workflows and decoupling from consumer availability.

### RestTemplate vs RestClient vs WebClient vs Feign?

`RestTemplate` is the older synchronous client (maintenance mode); `RestClient` is its modern fluent replacement; `WebClient` is reactive and non-blocking; OpenFeign (or `@HttpExchange` interfaces) generates clients from annotated interfaces.

### Why are timeouts important?

Without them, slow dependencies exhaust threads and connections and failures cascade. Every remote call needs connect and read timeouts, ideally within an overall deadline.

### How do you make retries safe?

Retry only idempotent operations, or make unsafe ones idempotent with idempotency keys, and combine retries with back-off and a circuit breaker.

### What is contract testing?

Testing that a provider's API still meets the expectations recorded by its consumers (Pact, Spring Cloud Contract), so breaking changes are caught in the build.

## Key Takeaways

- ✅ Use synchronous calls for immediate answers, events for reactions and workflows.
- ✅ Prefer `RestClient`, `WebClient` or declarative clients (OpenFeign, `@HttpExchange`); gRPC for fast internal calls.
- ✅ Always set connect and read timeouts and use connection pools.
- ✅ Propagate trace IDs and credentials; make retried writes idempotent.
- ✅ Evolve APIs additively; version breaking changes; verify with contract tests.
- ✅ Avoid long synchronous call chains.
