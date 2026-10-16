---
title: API Gateway with Spring Cloud Gateway
subtitle: Why clients need one entry point, gateway responsibilities, routes, predicates and filters, load-balanced routes, authentication and token relay, rate limiting with Redis, circuit breakers and fallbacks, the Backend-for-Frontend pattern, and gateway pitfalls.
order: 5
---

## Introduction

Without a gateway, every client — web, mobile, partners — must know the address of every service, handle each one's authentication, and make many calls to build one screen. An **API gateway** is a single entry point that sits in front of all services.

```flow-h
Web, mobile and partner clients
API gateway — auth, routing, rate limits
Order, Product, User and Payment services
```

## Gateway Responsibilities

| Responsibility | Example |
| --- | --- |
| **Routing** | `/api/orders/**` → order service, `/api/products/**` → product service |
| **Authentication** | Validate the JWT once at the edge |
| **Rate limiting** | 100 requests per minute per API key |
| **Load balancing** | Spread requests across service instances |
| **Resilience** | Timeouts, retries, circuit breakers, fallbacks |
| **Cross-cutting headers** | Add correlation IDs, strip internal headers, CORS |
| **Protocol / payload translation** | REST ↔ gRPC, response aggregation |
| **Observability** | One place to log and measure all incoming traffic |
| **Hiding internals** | Clients never see internal service addresses or topology |

## Spring Cloud Gateway

**Spring Cloud Gateway** is built on Spring WebFlux and Netty — non-blocking, so a few threads handle many concurrent connections.

```xml
<!-- Spring Cloud 2025.0+; older versions use spring-cloud-starter-gateway -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway-server-webflux</artifactId>
</dependency>
```

> [!NOTE]
> In Spring Cloud 2025.0 the gateway starter was renamed to `spring-cloud-starter-gateway-server-webflux` (there's also a servlet-based `-server-webmvc` variant), and route properties moved under `spring.cloud.gateway.server.webflux.*`. Older projects use `spring-cloud-starter-gateway` and `spring.cloud.gateway.routes` — the concepts are identical. The examples below use the newer property prefix.

### Routes, Predicates and Filters

A **route** = an ID + a destination URI + **predicates** (when it matches) + **filters** (what to change):

```yaml
spring:
  cloud:
    gateway:
      server:
        webflux:
          routes:
            - id: orders
              uri: lb://order-service              # lb:// = load-balanced via service discovery
              predicates:
                - Path=/api/orders/**
              filters:
                - StripPrefix=1                   # /api/orders/42 → /orders/42
                - AddRequestHeader=X-Gateway, spring-cloud-gateway

            - id: products
              uri: lb://product-service
              predicates:
                - Path=/api/products/**
                - Method=GET
```

```flow
Request GET /api/orders/42
Predicates — does Path=/api/orders/** match?
Pre-filters — authentication, rate limit, headers, strip prefix
Proxy to an order-service instance
Post-filters — response headers, logging
Response to the client
```

| Common predicates | Common filters |
| --- | --- |
| `Path`, `Method`, `Host`, `Header`, `Query`, `Cookie`, `After`/`Before`, `Weight` | `StripPrefix`, `RewritePath`, `AddRequestHeader`, `SetResponseHeader`, `Retry`, `CircuitBreaker`, `RequestRateLimiter`, `TokenRelay` |

### Routes in Java

```java
@Bean
public RouteLocator routes(RouteLocatorBuilder builder) {
    return builder.routes()
            .route("payments", r -> r.path("/api/payments/**")
                    .filters(f -> f.stripPrefix(1)
                                   .circuitBreaker(c -> c.setName("payments").setFallbackUri("forward:/fallback/payments")))
                    .uri("lb://payment-service"))
            .build();
}
```

### A Global Filter

Runs for every route — for example, adding a correlation ID:

```java
@Component
public class CorrelationIdFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String id = Optional.ofNullable(exchange.getRequest().getHeaders().getFirst("X-Correlation-Id"))
                            .orElse(UUID.randomUUID().toString());
        ServerHttpRequest request = exchange.getRequest().mutate().header("X-Correlation-Id", id).build();
        exchange.getResponse().getHeaders().add("X-Correlation-Id", id);
        return chain.filter(exchange.mutate().request(request).build());
    }

    @Override
    public int getOrder() {
        return -1;   // run early
    }
}
```

> [!WARNING]
> The gateway is **reactive**: never block inside a filter (no JDBC calls, no `Thread.sleep`, no blocking HTTP clients). Blocking a Netty event-loop thread stalls many requests at once.

## Authentication at the Gateway

The gateway validates the user's token once, and passes it on:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com/realms/shop   # e.g. Keycloak, Okta, Auth0
```

- Reject unauthenticated requests at the edge.
- Forward the token (`Authorization` header, or the `TokenRelay` filter when the gateway logs users in via OAuth2) so services can still check permissions.

> [!IMPORTANT]
> Don't make the gateway the **only** line of defence. Services should still validate tokens and enforce authorization (*zero trust*), because internal traffic can bypass the gateway.

## Rate Limiting

The built-in `RequestRateLimiter` uses Redis and a token-bucket algorithm:

```yaml
filters:
  - name: RequestRateLimiter
    args:
      redis-rate-limiter.replenishRate: 10     # tokens added per second
      redis-rate-limiter.burstCapacity: 20     # maximum burst
      key-resolver: "#{@userKeyResolver}"
```

```java
@Bean
KeyResolver userKeyResolver() {
    return exchange -> Mono.justOrEmpty(exchange.getRequest().getHeaders().getFirst("X-API-Key"))
                           .defaultIfEmpty("anonymous");
}
```

Requests over the limit get **429 Too Many Requests**. (Rate-limiting algorithms are covered in *System Design Basics*.)

## Resilience at the Edge

```yaml
filters:
  - name: CircuitBreaker
    args:
      name: products
      fallbackUri: forward:/fallback/products
  - name: Retry
    args:
      retries: 2
      methods: GET          # retry only safe, idempotent methods
      statuses: BAD_GATEWAY, SERVICE_UNAVAILABLE
```

Set **timeouts** too (`httpclient.connect-timeout`, `httpclient.response-timeout`), so one slow service can't tie up the gateway.

## Backend for Frontend (BFF)

Different clients need different data shapes: a mobile app wants a compact payload, a web dashboard a rich one. The **BFF pattern** gives each client type its own gateway or thin API layer:

```tree
Clients
  Web app → Web BFF | aggregates, rich responses
  Mobile app → Mobile BFF | compact payloads, fewer calls
  Partners → Public API gateway | versioned, rate-limited
```

A BFF can also **aggregate** — call product, price and review services in parallel and return one response for a product page.

## Gateway Pitfalls

- ❌ **Business logic in the gateway** — it becomes a new monolith every team depends on.
- ❌ **A single gateway instance** — run several behind a load balancer; it's a critical path.
- ❌ **Blocking code** in reactive filters.
- ❌ **No timeouts** on downstream calls.
- ❌ **Trusting the gateway alone** for security.

## Interview Questions

### What is an API gateway and why use one?

A single entry point in front of microservices that handles routing, authentication, rate limiting, load balancing, resilience and observability, so clients don't need to know the internal services.

### What are routes, predicates and filters in Spring Cloud Gateway?

A route maps matching requests to a destination URI; predicates decide whether a request matches (path, method, header…); filters modify the request or response before and after proxying (strip prefix, add headers, retry, circuit breaker, rate limit).

### What does lb:// mean in a route URI?

The destination is resolved through service discovery and load-balanced across instances by Spring Cloud LoadBalancer.

### How does rate limiting work in Spring Cloud Gateway?

The `RequestRateLimiter` filter uses Redis and a token-bucket algorithm keyed by a `KeyResolver` (user, API key, IP); requests over the limit receive 429.

### What is the Backend-for-Frontend pattern?

A separate gateway or API layer per client type (web, mobile, partners) that shapes and aggregates responses for that client.

### Should business logic live in the gateway?

No. Keep it to cross-cutting concerns; business logic belongs in services, otherwise the gateway becomes a bottleneck and a shared monolith.

## Key Takeaways

- ✅ An API gateway is the single, secured entry point to your services.
- ✅ Spring Cloud Gateway routes with predicates and filters; `lb://` uses service discovery.
- ✅ Authenticate at the edge, but keep authorization in services too.
- ✅ Add rate limiting, timeouts, retries (for safe methods) and circuit breakers at the gateway.
- ✅ Keep business logic out; use BFFs for client-specific shaping and aggregation.
