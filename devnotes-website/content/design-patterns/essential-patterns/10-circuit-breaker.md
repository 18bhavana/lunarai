---
title: Circuit Breaker Pattern
subtitle: Stopping calls to an unhealthy dependency — the CLOSED / OPEN / HALF_OPEN state machine, a simplified implementation, its limitations, Resilience4j in Spring Boot, fallbacks, and related resilience patterns.
order: 10
---

## Introduction

**Purpose:** stop **repeatedly calling an unhealthy dependency**, preventing **cascading failures**.

When a downstream service is down or very slow, every call to it waits for a timeout and then fails. Under load, those waiting calls pile up, exhaust threads and connection pools, and the failure **cascades** to the caller and its callers. A **circuit breaker** — named after the electrical device — detects repeated failures and "trips", failing fast for a while instead of calling the broken service.

> [!NOTE]
> The implementation below is a **simplified, educational** version. In real Spring Boot applications, a library such as **Resilience4j** is normally used.

## The Three States

| State | Behaviour |
| --- | --- |
| **CLOSED** | Normal — **call the service**; count failures |
| **OPEN** | Tripped — **stop calling**; reject immediately (or use a fallback) |
| **HALF_OPEN** | After a wait — **test recovery** with trial calls |

```flow
CLOSED — calls pass through
: too many failures
OPEN — calls rejected immediately
: wait timeout elapses
? HALF_OPEN — trial call succeeds? | Yes: back to CLOSED | No: back to OPEN
```

## A Simplified Implementation

### States

```java
enum CircuitState {
    CLOSED,
    OPEN,
    HALF_OPEN
}
```

### The Breaker

```java
class CircuitBreaker {
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private final int failureThreshold = 3;
    private final long openTimeout = 5000;      // ms to stay OPEN
    private long lastFailureTime;

    public boolean allowRequest() {
        if (state == CircuitState.CLOSED) {
            return true;
        }

        if (state == CircuitState.OPEN) {
            long currentTime = System.currentTimeMillis();
            if (currentTime - lastFailureTime >= openTimeout) {
                state = CircuitState.HALF_OPEN;
                System.out.println("Circuit HALF_OPEN");
                return true;                   // let a trial request through
            }
            return false;                      // still OPEN — fail fast
        }

        return true;                           // HALF_OPEN
    }

    public void recordSuccess() {
        failureCount = 0;
        state = CircuitState.CLOSED;
        System.out.println("Circuit CLOSED");
    }

    public void recordFailure() {
        failureCount++;
        lastFailureTime = System.currentTimeMillis();

        if (state == CircuitState.HALF_OPEN || failureCount >= failureThreshold) {
            state = CircuitState.OPEN;
            System.out.println("Circuit OPEN");
        }
    }
}
```

### A Failing Service and Its Client

```java
class PaymentService {
    public void pay() {
        throw new RuntimeException("Payment Service Down");
    }
}

class PaymentClient {
    private final PaymentService service = new PaymentService();
    private final CircuitBreaker breaker = new CircuitBreaker();

    public void makePayment() {
        if (!breaker.allowRequest()) {
            System.out.println("Request rejected - Circuit OPEN");
            return;
        }

        try {
            service.pay();
            breaker.recordSuccess();
        } catch (Exception e) {
            System.out.println("Payment failed");
            breaker.recordFailure();
        }
    }
}

public class Main {
    public static void main(String[] args) {
        PaymentClient client = new PaymentClient();
        client.makePayment();
        client.makePayment();
        client.makePayment();
        client.makePayment();
    }
}
```

```output
Payment failed
Payment failed
Payment failed
Circuit OPEN
Request rejected - Circuit OPEN
```

The first three calls fail and the third one trips the breaker. The fourth call is **rejected without calling the service** — failing fast instead of waiting. After 5 seconds, the next call would move the breaker to HALF_OPEN and try the service again.

### Limitations of the Simplified Version

| Limitation | What a real library does |
| --- | --- |
| **Not thread-safe** — `state` and `failureCount` are plain fields shared by request threads | Atomic state transitions |
| **HALF_OPEN lets every request through** | Allows only a configured number of trial calls |
| Counts consecutive failures only | Failure **rate** over a sliding window (count- or time-based) |
| Treats every exception as a failure | Configurable recorded / ignored exceptions (don't trip on a 400 Bad Request) |
| Ignores slow calls | Treats calls slower than a threshold as failures |
| No fallback, no metrics | Fallback methods, events, Micrometer metrics, Actuator health |

## Resilience4j in Spring Boot

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
      paymentService:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 20                 # look at the last 20 calls
        minimum-number-of-calls: 10
        failure-rate-threshold: 50              # open at ≥ 50% failures
        slow-call-duration-threshold: 2s
        slow-call-rate-threshold: 50
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3
        ignore-exceptions:
          - com.shop.payment.InvalidCardException
```

```java
@Service
public class PaymentClient {

    private final RestClient restClient;

    public PaymentClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    public PaymentResult pay(PaymentRequest request) {
        return restClient.post().uri("/payments").body(request)
                .retrieve().body(PaymentResult.class);
    }

    private PaymentResult paymentFallback(PaymentRequest request, Throwable ex) {
        return PaymentResult.pending(request.orderId());   // queue for later instead of failing the order
    }
}
```

The breaker's state is exposed through Actuator (`/actuator/circuitbreakers`, health indicators) and Micrometer metrics. Spring Cloud Circuit Breaker offers a vendor-neutral abstraction over Resilience4j.

> [!TIP]
> A **fallback** is what makes failing fast useful: cached data, a default value, a "try again later" response, or queueing the work. Without one, the breaker only fails sooner.

## Related Resilience Patterns

| Pattern | Purpose |
| --- | --- |
| **Timeout** | Never wait forever — the foundation for every other pattern |
| **Retry** (with exponential back-off and jitter) | Recover from **transient** failures — but retries against a dead service make things worse; combine with a circuit breaker |
| **Bulkhead** | Limit concurrent calls (separate pools / semaphores) so one dependency can't consume every thread |
| **Rate limiter** | Cap the request rate to protect a service |
| **Fallback** | Degrade gracefully when calls fail |

A common order of decorators around a remote call: **Retry → CircuitBreaker → RateLimiter → TimeLimiter → Bulkhead → the call**.

## When to Use

- Calls to remote services, databases or third-party APIs that can fail or become slow.
- Microservices where one failing service could cascade into an outage.
- Not for in-process method calls or for business-rule failures (validation errors shouldn't trip a breaker).

## Interview Questions

### Q1. What is the Circuit Breaker pattern?

A resilience pattern that prevents cascading failures by temporarily stopping calls to an unhealthy dependency after failures exceed a threshold, then testing recovery after a wait.

### Q2. Explain the circuit breaker states.

**CLOSED** — calls pass and failures are counted. **OPEN** — calls are rejected immediately for a wait period. **HALF_OPEN** — a limited number of trial calls are allowed; success closes the circuit, failure opens it again.

### Q3. Why is a circuit breaker needed if we already have timeouts?

Timeouts bound each call, but under load thousands of calls still wait for the full timeout, exhausting threads and connections. A circuit breaker stops making those calls at all while the dependency is unhealthy.

### Q4. Circuit breaker vs retry?

Retry repeats a failed call, assuming the failure is transient. A circuit breaker stops calling when failures persist. They're used together — retries inside a breaker, so a dead service isn't hammered.

### Q5. How do you implement a circuit breaker in Spring Boot?

With Resilience4j: add `resilience4j-spring-boot3`, configure an instance (window size, failure-rate threshold, wait duration, half-open calls), and annotate the method with `@CircuitBreaker(name = "...", fallbackMethod = "...")`.

### Q6. What is a fallback?

An alternative response when a call fails or the circuit is open — cached data, a default value or a deferred-processing response.

## Common Mistakes

- ❌ **No timeouts** — slow calls never count as failures, and threads still pile up.
- ❌ **Counting client errors** (400, validation failures) as failures and tripping the breaker.
- ❌ **Retrying without a breaker** — amplifying load on a failing service.
- ❌ **One breaker for all dependencies** — one failing API blocks calls to healthy ones.
- ❌ **A non-thread-safe hand-written breaker** in production.
- ❌ **No fallback or monitoring** — users just see errors sooner.

## Key Takeaways

- ✅ A circuit breaker prevents cascading failures by failing fast when a dependency is unhealthy.
- ✅ CLOSED = call, OPEN = stop calling, HALF_OPEN = test recovery.
- ✅ The educational version isn't thread-safe and lets all requests through in HALF_OPEN — use Resilience4j in production.
- ✅ Combine with timeouts, retries, bulkheads and fallbacks.
- ✅ Configure one breaker per dependency and monitor its state.
