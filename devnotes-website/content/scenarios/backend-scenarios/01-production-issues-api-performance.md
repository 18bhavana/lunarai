---
title: Production Issues & API Performance
subtitle: "Scenario questions 1–10: slow APIs with idle CPUs, local vs production gaps, traffic spikes, designing for 10,000+ requests per second, scaling that doesn't help, slow downstream services, timeouts, sudden HTTP 500s and intermittent failures."
order: 1
---

## How to Answer Scenario Questions

Interviewers aren't looking for one magic cause. They want a **structured approach**:

```flow
Clarify — what changed, since when, which endpoints and users are affected?
Measure — metrics, logs and traces, not guesses
Narrow down — where does the time go: app, database, network, downstream?
Fix — the immediate mitigation first, then the root cause
Prevent — alerts, tests, capacity planning, a postmortem
```

Mention **mitigation before root cause**: in an incident you roll back, scale or turn off a feature flag first, then investigate.

> [!TIP]
> The **four golden signals** are latency, traffic, errors and saturation. Most of these answers start by checking them in a dashboard (Prometheus/Grafana, Datadog, New Relic) and then following a **trace** to the slow component.

## Scenario Questions

### Q1. Your API is taking 5–10 seconds to respond, but CPU and memory usage are low. How would you troubleshoot it?

Low CPU plus high latency means the threads are mostly **waiting**, not working. The job is to find what they're waiting for.

**Likely causes:**

- **Database:** slow queries, lock waits, or a full connection pool, where threads wait in `HikariPool.getConnection()`.
- **Downstream calls:** a slow HTTP service with long or missing timeouts.
- **Thread-pool saturation:** all Tomcat threads (200 by default) are busy waiting, so new requests queue.
- **Locks in the application:** `synchronized` blocks or other contended locks.
- **Network and DNS:** slow DNS resolution, TLS handshakes, or no connection reuse in the HTTP client.
- **External I/O:** file systems, S3, or a cache with a slow fallback.

**Steps:**

1. **Look at a distributed trace** of a slow request (Zipkin, Jaeger, Tempo). The longest span shows where the time goes: a DB call, an HTTP call, or a gap with no span inside the app.
2. **Check pool metrics:** `hikaricp_connections_pending`, Tomcat busy threads (`tomcat_threads_busy_threads`), and the HTTP client's pool.
3. **Take thread dumps** (`jstack <pid>`, or Actuator `/actuator/threaddump`) 3–5 times, a few seconds apart. If most threads are `WAITING` or `TIMED_WAITING` in the same stack (for example `SocketInputStream.read` or `HikariPool.getConnection`), that's your bottleneck.
4. **Check the database side:** slow query log, `SHOW PROCESSLIST` / `pg_stat_activity`, and lock waits.
5. **Check the timeouts** on every outbound call.

```text
"http-nio-8080-exec-87" WAITING
   at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:181)
   ...   ← 150 of 200 request threads look like this → pool exhaustion
```

**Fixes:** add timeouts, tune or fix the slow query, shorten transactions, size the pools correctly, and make independent downstream calls in parallel.

### Q2. An API that works perfectly in your local environment is very slow in production. How would you identify the root cause?

Find the difference between the two environments. The usual suspects:

| Local | Production |
| --- | --- |
| 100 rows | Millions of rows: missing indexes, full table scans |
| One user | Concurrency: lock contention, pool limits |
| Database on the same machine | Network latency per query: N+1 hurts 100× more |
| Mocked or nearby services | Real downstream services, across regions, with rate limits |
| No security layers | TLS, proxies, WAF, auth calls on every request |
| Debug config | Different pool sizes, JVM flags, container CPU and memory limits |

**Steps:**

1. **Trace a slow production request** and compare its span breakdown with a local one.
2. **Count queries per request:** an N+1 that runs 200 queries in 0.2 ms each locally becomes 200 × 2 ms = 400 ms over a network.
3. **Run `EXPLAIN` on the production-sized data**, or on a copy with realistic volumes.
4. **Compare configuration:** pool sizes, timeouts, JVM heap and GC, and container limits. A container with 0.5 CPU throttles badly.
5. **Check infrastructure:** DNS, load balancer, TLS, and the region distance to the database.

Prevent this with performance tests on production-like data and a staging environment that mirrors production.

### Q3. An API receives 5,000 requests per second, and response times suddenly increase. What would you investigate first?

First ask **"what changed?"**: a deployment, a traffic increase, a configuration change, a dependency, or a data change. Then follow the saturation signals.

**Investigate, in order:**

1. **Recent deployments and config changes.** If latency jumped right after a release, roll back first.
2. **Traffic pattern:** a real spike, one noisy client, a retry storm, or a bot?
3. **Saturation:** request thread pools, DB connection pools, CPU throttling in containers, and GC pauses.
4. **Database:** slow query log, locks, replication lag, and whether a cache miss storm is hitting the database (for example, cache keys expiring at the same moment).
5. **Downstream services:** latency and error rates of every dependency.
6. **Per-instance view:** is one instance or one AZ slow (a bad node), or all of them?

**Mitigate:** roll back, scale out, rate-limit abusive clients, shed non-critical load, or turn off expensive features. Then fix the root cause.

### Q4. Your application must handle 10,000+ requests per second. How would you design and optimize it?

Start with numbers: 10,000 RPS at ~50 ms average needs ~500 concurrent requests in flight (Little's law: concurrency = throughput × latency).

**Design:**

- **Stateless services** behind a load balancer, scaled horizontally with autoscaling. Keep sessions in tokens or Redis, not in memory.
- **Caching in layers:** a CDN for static and public content, Redis for hot data, and a small local cache (Caffeine) for reference data.
- **A database built for reads:** read replicas, indexes for every hot query, connection pooling, and sharding only when one primary can't keep up.
- **Asynchronous work:** move slow work (emails, reports, notifications) to Kafka or a queue, and return `202 Accepted`.
- **Protection:** rate limiting, timeouts, circuit breakers and bulkheads, so one dependency can't take everything down.

**Application optimisations:**

- Efficient queries: no N+1, DTO projections, pagination.
- Connection reuse in HTTP clients, and parallel calls where they're independent.
- Small payloads with compression; avoid serialising large entity graphs.
- Virtual threads (Java 21) or a reactive stack for I/O-heavy workloads.
- JVM tuning: right-sized heap, G1 or ZGC, container-aware settings.

**Verify:** load-test with Gatling, k6 or JMeter at 2–3× the target, watch p95 and p99 latency (not just averages), and find the first bottleneck. It's usually the database.

### Q5. An API becomes slow during peak traffic but works normally during off-peak hours. How would you debug it?

It works at low load, so the code path is fine. Something **runs out of capacity** under load. Compare peak and off-peak metrics side by side:

- **Thread pools:** Tomcat busy threads reach the maximum and requests queue.
- **Connection pools:** Hikari `pending > 0` at peak.
- **Database:** CPU, lock waits and slow queries rise with concurrency. Queries that are fine alone collide on the same rows.
- **GC:** higher allocation at peak causes longer or more frequent pauses.
- **Downstream services and rate limits:** a partner API throttles you at peak.
- **Autoscaling:** new instances arrive too late (slow startup, cold caches) or are capped by a maximum count.
- **Scheduled jobs:** a batch job or backup runs at the same time as the peak.

**Steps:** load-test to reproduce the peak, take thread dumps during it, and look at the database at the same moment. Then fix the bottleneck: tune queries, cache, scale the right tier, schedule batch jobs off-peak, and autoscale earlier (on request rate rather than CPU).

### Q6. You increased the number of application instances, but performance did not improve. Why might this happen?

Adding instances only helps if the **application tier** is the bottleneck. Common reasons it isn't:

- **The database is the bottleneck.** More instances mean more connections and more load on the same database. It can even get worse: 20 instances × 20 connections = 400 connections.
- **A shared downstream service** or a third-party rate limit caps throughput.
- **Locks and hot rows:** every request updates the same row (a counter or inventory record), so requests serialise no matter how many instances run.
- **Load isn't spreading:** sticky sessions, a misconfigured load balancer, DNS caching, or Kafka partitions (consumers beyond the partition count sit idle).
- **Shared caches or queues** that are themselves saturated.
- **Each instance is throttled:** container CPU limits or a small heap.
- **Startup and warm-up:** new instances have cold caches and an un-warmed JIT.

**Approach:** find the real bottleneck with traces and resource metrics. Scale that tier (read replicas, cache, partitions), remove hot-row contention, and size pools across all instances.

### Q7. A downstream service takes 10 seconds to respond. How would you prevent it from affecting your entire application?

The danger is that requests waiting on the slow service **hold threads and connections** until your whole app is stuck. Contain it:

1. **Timeouts** on every call, set from the downstream's normal latency (for example 1–2 s), not the defaults:

```java
@Bean
RestClient paymentClient(RestClient.Builder builder) {
    var settings = ClientHttpRequestFactorySettings.defaults()
            .withConnectTimeout(Duration.ofMillis(500))
            .withReadTimeout(Duration.ofSeconds(2));
    return builder.baseUrl("https://payments.internal")
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
}
```

2. **A circuit breaker** (Resilience4j): after a failure or slow-call threshold, fail fast for a while instead of waiting.
3. **A bulkhead:** limit concurrent calls to that service (a semaphore or a separate thread pool) so it can only use part of your capacity.
4. **A fallback:** cached data, a default value, or a "try again later" response.
5. **Asynchronous decoupling:** if the user doesn't need the result immediately, send the work through a queue.

```java
@CircuitBreaker(name = "inventory", fallbackMethod = "cachedStock")
@Bulkhead(name = "inventory")
@TimeLimiter(name = "inventory")
public CompletableFuture<Stock> stock(String sku) { … }
```

Together these keep the rest of your endpoints healthy while one dependency is slow.

### Q8. Your API is timing out even though the database queries are fast. What could be the problem?

Find where the time goes outside the database:

- **Waiting for a connection,** not the query itself. A query can take 5 ms after waiting 25 s in the Hikari queue.
- **Slow downstream HTTP calls,** or calls with no timeout.
- **N+1 queries:** each is fast, but there are hundreds of them.
- **Large responses:** serialising a huge entity graph, lazy loading during JSON serialisation (Open Session in View), or a slow network to the client.
- **Thread-pool queuing:** the request waits for a free Tomcat or executor thread before running at all.
- **GC pauses** or CPU throttling in containers.
- **Locks in application code,** or `synchronized` sections.
- **Mismatched timeouts:** the gateway or load balancer times out (say at 30 s) before the app finishes, or a client timeout is shorter than the server's processing time.
- **Network issues:** DNS, TLS, proxy or MTU problems.

**Debug:** a distributed trace shows the gap. Look at the pending metrics for Hikari and the thread pools, take a thread dump during a timeout, and compare timeouts at every hop (client → gateway → service → downstream).

### Q9. A production application suddenly starts returning HTTP 500 errors. How would you investigate?

1. **Scope it:** all endpoints or one? All instances or one? Since when? Correlate the start time with deployments, config changes, certificate expiry, or a dependency outage.
2. **Mitigate:** if it started with a release, **roll back**. If one instance is bad, take it out of the load balancer.
3. **Read the logs** for the exception and stack trace, filtered by the request or trace ID:

```text
ERROR [order-service,trace=4bf92f35…] o.a.c.c.C.[dispatcherServlet] Servlet.service() threw exception
org.springframework.dao.DataAccessResourceFailureException: Unable to acquire JDBC Connection
```

4. **Check dependencies:** database status, connection pool, cache, message broker, and downstream services' health.
5. **Check resources:** disk full, out of memory, file descriptors, expired certificates or secrets.
6. **Fix and verify,** then write a postmortem with action items such as alerting and tests.

Have a `@RestControllerAdvice` that logs unexpected exceptions with the trace ID and returns a consistent error body (`ProblemDetail`) **without exposing stack traces** to clients.

### Q10. Your service experiences intermittent failures that you cannot reproduce locally. What steps would you take?

Intermittent usually means it depends on **timing, load, data or a particular instance**.

**1. Collect evidence.** Look at the error rate over time, and at which instances, endpoints, users or inputs are affected. Look for patterns: one AZ, one node, certain times, certain tenants, large payloads.

**2. Improve observability.** Use structured logs with trace IDs and MDC context (user, order ID), and sample traces at a higher rate for errors.

**3. Check the usual suspects:**

- race conditions and shared mutable state (a non-thread-safe `SimpleDateFormat` or `HashMap`);
- pool or timeout limits reached at peaks;
- stale connections dropped by firewalls (`max-lifetime` longer than the network idle timeout);
- a bad instance or node;
- retries hitting non-idempotent operations;
- clock skew, DNS caching, certificate rotation;
- data-specific bugs (nulls, encodings, large values).

**4. Reproduce it.** Run load tests with concurrency, chaos tests (kill pods, add latency with Toxiproxy), and replay production inputs in staging.

**5. Fix it, then add a test** (a concurrency test, or a test for that data case) and an alert.

## Key Takeaways

- ✅ Start with metrics and traces; mitigate first, then find the root cause.
- ✅ Low CPU with high latency means waiting: pools, locks, downstream calls, DNS.
- ✅ Local-vs-production gaps come from data volume, network latency, concurrency and configuration.
- ✅ Scaling instances doesn't help when the database, a hot row or a dependency is the bottleneck.
- ✅ Timeouts, circuit breakers, bulkheads and fallbacks contain slow dependencies.
