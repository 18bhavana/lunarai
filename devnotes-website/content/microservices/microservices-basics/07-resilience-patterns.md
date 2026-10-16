---
title: Resilience Patterns with Resilience4j
subtitle: Cascading failures, timeouts, retries with exponential back-off and jitter, circuit breakers, bulkheads, rate limiters and fallbacks with Resilience4j in Spring Boot, combining patterns in the right order, and designing for graceful degradation.
order: 7
---

## Introduction

In a distributed system, something is always failing somewhere — a slow database, a restarting pod, a dropped connection. **Resilience** means your service keeps working (perhaps in a degraded way) when its dependencies don't. Resilience4j is the standard library for this in Spring Boot.

## How Failures Cascade

```flow
Payment service becomes slow — 30-second responses
Order service threads all wait on payment calls
Order service runs out of threads and stops responding
Gateway and other services calling the order service fail too
Whole platform down because of one slow dependency
```

The fix isn't one pattern but several working together:

| Pattern | Protects against |
| --- | --- |
| **Timeout** | Waiting forever on a slow call |
| **Retry** | Transient failures (blips, restarts) |
| **Circuit breaker** | Repeatedly calling something that's down |
| **Bulkhead** | One dependency using up all threads |
| **Rate limiter** | Overloading yourself or a dependency |
| **Fallback** | Total failure — return something useful instead |

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

## 1. Timeouts

Every remote call needs a timeout (see *Inter-Service Communication*). For asynchronous calls, Resilience4j's **TimeLimiter** adds one:

```yaml
resilience4j:
  timelimiter:
    instances:
      pricing:
        timeout-duration: 2s
        cancel-running-future: true
```

## 2. Retries

```yaml
resilience4j:
  retry:
    instances:
      inventory:
        max-attempts: 3                       # 1 call + 2 retries
        wait-duration: 200ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2     # 200 ms, 400 ms…
        enable-randomized-wait: true          # jitter
        retry-exceptions:
          - java.io.IOException
          - org.springframework.web.client.ResourceAccessException
        ignore-exceptions:
          - com.shop.InvalidRequestException  # 4xx — retrying won't help
```

```java
@Retry(name = "inventory")
public StockLevel stockFor(String sku) {
    return inventoryClient.stockFor(sku);
}
```

Rules for safe retries:

- Retry **transient** errors only (timeouts, connection resets, 503) — never validation errors (400) or "not found" (404).
- Use **exponential back-off with jitter**, so thousands of clients don't retry in lock-step (a *retry storm*).
- Only retry **idempotent** operations, or use idempotency keys.
- Keep the total retry time **within the caller's timeout** — retries multiply latency.
- Don't retry at every layer: if the gateway, service A and service B each retry 3 times, one failure becomes 27 calls.

## 3. Circuit Breaker

A circuit breaker stops calling a dependency that is failing, fails fast for a while, then tests whether it has recovered. The state machine (CLOSED → OPEN → HALF_OPEN) is explained in detail in the [Circuit Breaker pattern chapter](/design-patterns/essential-patterns/circuit-breaker/).

```yaml
resilience4j:
  circuitbreaker:
    instances:
      payment:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 20
        minimum-number-of-calls: 10
        failure-rate-threshold: 50
        slow-call-duration-threshold: 2s
        slow-call-rate-threshold: 50
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3
```

```java
@CircuitBreaker(name = "payment", fallbackMethod = "paymentUnavailable")
public PaymentResult charge(PaymentRequest request) {
    return paymentClient.charge(request);
}

private PaymentResult paymentUnavailable(PaymentRequest request, Throwable ex) {
    return PaymentResult.pending(request.orderId());   // accept the order, charge later
}
```

## 4. Bulkhead

Named after a ship's watertight compartments: if one floods, the ship stays afloat. A **bulkhead** limits how many concurrent calls go to each dependency, so a slow one can't consume every thread.

```yaml
resilience4j:
  bulkhead:
    instances:
      recommendations:
        max-concurrent-calls: 10
        max-wait-duration: 0          # reject immediately when full
```

```java
@Bulkhead(name = "recommendations", fallbackMethod = "noRecommendations")
public List<Product> recommendationsFor(String customerId) {
    return recommendationClient.forCustomer(customerId);
}
```

```tree
Order service — 200 request threads
  Payment calls — at most 50
  Inventory calls — at most 50
  Recommendation calls — at most 10 | if slow, only these 10 wait
```

Resilience4j offers a semaphore bulkhead (above) and a `ThreadPoolBulkhead` that runs calls on a dedicated pool.

## 5. Rate Limiter

Limit how often **you** call something (to respect a partner's quota) or how often an endpoint can be called:

```yaml
resilience4j:
  ratelimiter:
    instances:
      sms-provider:
        limit-for-period: 50
        limit-refresh-period: 1s
        timeout-duration: 0
```

```java
@RateLimiter(name = "sms-provider")
public void sendSms(String to, String text) { … }
```

## 6. Fallbacks and Graceful Degradation

A fallback returns a sensible alternative when a call fails or a breaker is open:

| Dependency fails | Fallback |
| --- | --- |
| Recommendations | Show best-sellers from a cache |
| Product reviews | Hide the reviews section |
| Pricing | Serve the last cached price (with a "may change" note) |
| Payment | Accept the order as "payment pending" and retry asynchronously |
| Loyalty points | Skip them and reconcile later |

Design what **degraded** looks like before the outage, so a failure in a non-critical feature never breaks a critical one like checkout.

## Combining Patterns

Resilience4j applies annotations in this order around the call (outermost first):

```flow-h
Retry
CircuitBreaker
RateLimiter
TimeLimiter
Bulkhead
Remote call
```

So each retry attempt is counted by the circuit breaker, and once the breaker opens, retries fail fast instead of hammering the dependency.

```java
@Retry(name = "inventory")
@CircuitBreaker(name = "inventory", fallbackMethod = "stockUnknown")
@Bulkhead(name = "inventory")
public StockLevel stockFor(String sku) {
    return inventoryClient.stockFor(sku);
}
```

> [!TIP]
> Resilience annotations work through Spring **proxies** — calling the method from the same class bypasses them, exactly like `@Transactional`. Put protected calls in a separate bean (e.g. an `InventoryGateway`).

## Observability for Resilience

Resilience4j publishes Micrometer metrics (calls, failures, breaker state, retries, bulkhead usage) and Actuator endpoints (`/actuator/circuitbreakers`, health indicators). Alert when a circuit opens or a bulkhead is constantly full.

## Interview Questions

### How do you prevent cascading failures in microservices?

Timeouts on every remote call, bounded retries with back-off for transient errors, circuit breakers to stop calling failing dependencies, bulkheads to isolate thread usage, rate limiting, and fallbacks for graceful degradation — typically with Resilience4j.

### What's the difference between a retry and a circuit breaker?

A retry repeats a failed call, assuming the failure is temporary; a circuit breaker stops making calls when failures persist and fails fast until the dependency recovers. They're used together.

### What is a bulkhead?

A limit on concurrent calls (or a dedicated thread pool) per dependency, so one slow dependency can't exhaust all of a service's threads.

### Why add jitter to retries?

Randomising retry delays prevents many clients from retrying at the same moments and overwhelming a recovering service.

### What is graceful degradation?

Continuing to provide core functionality with reduced features when dependencies fail — cached data, hidden widgets, deferred processing — instead of failing entirely.

### In what order does Resilience4j apply its decorators?

Retry → CircuitBreaker → RateLimiter → TimeLimiter → Bulkhead → the call.

## Key Takeaways

- ✅ One slow dependency can take down a whole platform without protection.
- ✅ Combine timeouts, retries (with back-off and jitter), circuit breakers, bulkheads and rate limiters.
- ✅ Retry only transient failures and idempotent operations; don't retry at every layer.
- ✅ Design fallbacks so non-critical failures degrade gracefully.
- ✅ Resilience4j annotations rely on proxies; monitor breaker and bulkhead metrics.
