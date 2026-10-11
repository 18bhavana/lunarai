---
title: Virtual Threads (Java 21)
subtitle: Platform vs virtual threads, carrier threads and mounting, creating virtual threads, the thread-per-request model, pinning, why you don't pool virtual threads, Spring Boot support, and structured concurrency.
order: 17
---

## Introduction

> [!NOTE]
> **Interview importance:** high and rising — virtual threads (Project Loom, final in **Java 21**, JEP 444) are the biggest change to Java concurrency since `java.util.concurrent`.

Traditional Java threads are **platform threads** — thin wrappers around OS threads. They're expensive, so servers cap them at a few hundred, and when every thread is waiting on a database or HTTP call, the server can't accept more work even though the CPU is idle. **Virtual threads** are lightweight threads managed by the JVM, so cheap that you can run **millions** of them — making the simple *one thread per request* style scale again.

## Platform Threads vs Virtual Threads

| Platform thread | Virtual thread |
| --- | --- |
| 1:1 with an OS thread | Many virtual threads share a few OS threads |
| Stack reserved up front (~1 MB) | Stack grows on the heap as needed (a few KB to start) |
| Creation is a system call — expensive | Creation is cheap — like allocating an object |
| Practical limit: thousands | Practical limit: millions |
| Scheduled by the OS | Scheduled by the JVM onto **carrier threads** |
| Blocking I/O blocks an OS thread | Blocking I/O **unmounts** the virtual thread; the OS thread runs others |
| Worth pooling | **Never pooled** — create one per task |

## How Virtual Threads Work

Virtual threads run on a small pool of platform threads called **carrier threads** (a `ForkJoinPool` sized to the number of cores):

```flow
Virtual thread is mounted on a carrier thread and runs
It calls a blocking operation — JDBC query, HTTP call, sleep(), queue.take()
The JVM unmounts it: its stack is saved to the heap
The carrier thread immediately runs another virtual thread
When the I/O completes, the virtual thread is mounted again (maybe on a different carrier) and continues
```

Your code still **looks blocking** — plain `restTemplate.getForObject()` or `jdbcTemplate.query()` — but the underlying OS thread never sits idle waiting. You get the scalability of asynchronous code with the readability of synchronous code.

## Creating Virtual Threads

```java
// Start one directly
Thread vt = Thread.ofVirtual().name("order-", 1).start(() -> processOrder(order));

// Shorthand
Thread.startVirtualThread(() -> sendEmail(user));

// Most common: an executor that creates a new virtual thread per task
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Order order : orders) {
        executor.submit(() -> processOrder(order));
    }
}   // close() waits for all tasks

// A factory for frameworks that accept ThreadFactory
ThreadFactory factory = Thread.ofVirtual().name("worker-", 0).factory();
```

### Ten Thousand Concurrent Blocking Tasks

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i ->
            executor.submit(() -> {
                Thread.sleep(Duration.ofSeconds(1));   // simulates a 1-second I/O call
                return i;
            }));
}
```

This finishes in about **one second**. With a fixed pool of 200 platform threads it would take about 50 seconds; with 10,000 platform threads it would need roughly 10 GB of reserved stack.

## Thread-per-Request, Again

```flow-h Platform threads
200 Tomcat threads
All waiting on slow I/O
Request 201 queues
```

```flow-h Virtual threads
One virtual thread per request
Waiting threads unmount
Carriers keep serving
```

Virtual threads improve **throughput for I/O-bound concurrency**: many requests that spend most of their time waiting. They don't make any single request faster, and they don't help CPU-bound work — there are still only as many carriers as cores.

## Pinning

A virtual thread is **pinned** when it can't unmount while blocked, so it holds its carrier thread hostage:

| Cause | Status |
| --- | --- |
| Blocking inside a **`synchronized`** block or method | Pinned in Java 21–23; **fixed in Java 24** (JEP 491) — virtual threads now unmount while holding or waiting for monitors |
| Blocking inside **native code** or a foreign function call | Still pins |

On Java 21–23, long blocking calls inside `synchronized` (for example, a JDBC driver that synchronizes internally) could exhaust all carrier threads. The usual fix was replacing `synchronized` with `ReentrantLock` around blocking code. Diagnose with `-Djdk.tracePinnedThreads=full` (Java 21–23) or the JFR event `jdk.VirtualThreadPinned`.

## Rules for Using Virtual Threads

### Don't Pool Them

Pooling exists to amortize expensive creation — virtual threads are cheap. Create a **new virtual thread per task**; `newVirtualThreadPerTaskExecutor()` does exactly that.

### Limit Concurrency with Semaphores, Not Pool Sizes

With platform threads, a pool of 20 implicitly limited calls to a fragile service to 20. With virtual threads, nothing limits them — so 10,000 requests become 10,000 simultaneous calls. Protect downstream resources explicitly:

```java
private final Semaphore paymentApiPermits = new Semaphore(20);

public Receipt charge(Payment p) throws InterruptedException {
    paymentApiPermits.acquire();
    try {
        return paymentClient.charge(p);
    } finally {
        paymentApiPermits.release();
    }
}
```

Database connection pools (HikariCP) still cap database concurrency — size them deliberately, because thousands of virtual threads will now queue for connections.

### Be Careful with ThreadLocal

Each virtual thread has its own thread-locals. With millions of threads, caching large objects in `ThreadLocal`s (a common trick with pooled platform threads) multiplies memory use. Prefer `ScopedValue` (final in Java 25) for request context.

### They Don't Help CPU-Bound Work

For computation, use a bounded platform-thread pool or Fork/Join sized to the cores.

## Virtual Threads in Spring Boot

Spring Boot 3.2+ on Java 21 enables them with one property:

```properties
spring.threads.virtual.enabled=true
```

This makes Tomcat/Jetty handle each request on a virtual thread, and configures `@Async`, `@Scheduled` task execution, and several messaging listeners to use virtual threads.

> [!TIP]
> Before enabling it in production, check: downstream connection pools and rate limits (add semaphores or bulkheads), `ThreadLocal`-heavy libraries, and — on Java 21–23 — pinning from `synchronized` blocks in your code or drivers.

## Structured Concurrency (Preview)

**Structured concurrency** (`StructuredTaskScope`, still a **preview** API in recent JDKs) treats a group of related subtasks as one unit of work: they start together, are joined together, and if one fails the others are cancelled.

```java
// Preview API — requires --enable-preview, and its exact shape has changed between JDK releases
try (var scope = StructuredTaskScope.open()) {
    var user   = scope.fork(() -> userService.find(id));
    var orders = scope.fork(() -> orderService.recent(id));
    scope.join();                                      // waits for both; fails if either fails
    return new Dashboard(user.get(), orders.get());
}
```

It brings to concurrent code what structured programming brought to control flow: subtasks can't outlive the block that created them, so there are no leaked threads and cancellation is automatic. Until it's final, `CompletableFuture` or an `ExecutorService` in try-with-resources is the production choice.

## Virtual Threads vs Reactive Programming

| Reactive (WebFlux, Reactor) | Virtual threads |
| --- | --- |
| Non-blocking APIs: `Mono`, `Flux` | Plain blocking APIs |
| High scalability for I/O | Similar scalability for I/O |
| Steeper learning curve; harder debugging and stack traces | Ordinary code, ordinary stack traces and debuggers |
| Built-in back-pressure and streaming operators | Back-pressure via semaphores, bounded queues and pools |
| Requires reactive drivers end to end (R2DBC, reactive clients) | Works with JDBC, `RestTemplate`, `RestClient` |

For many typical CRUD and microservice workloads, virtual threads give most of the scalability benefit with much simpler code. Reactive still shines for streaming and complex event-driven pipelines.

## Interview Questions

### Q1. What are virtual threads?

Lightweight threads introduced in Java 21 that are scheduled by the JVM onto a small pool of carrier (platform) threads. They're cheap enough to create one per task, and when they block on I/O they unmount, freeing the carrier to run other virtual threads.

### Q2. How do virtual threads differ from platform threads?

Platform threads map 1:1 to OS threads, reserve large stacks and are expensive to create and switch. Virtual threads are managed by the JVM, have small growable heap-allocated stacks, and can number in the millions.

### Q3. Do virtual threads make code faster?

They increase **throughput** for I/O-bound workloads by allowing far more concurrent blocking operations. They don't make an individual request faster and don't help CPU-bound work.

### Q4. Should you pool virtual threads?

No. They're cheap to create; use `Executors.newVirtualThreadPerTaskExecutor()`. Limit concurrency to fragile resources with semaphores or connection pools instead.

### Q5. What is pinning?

A situation where a virtual thread can't unmount from its carrier while blocked — historically inside `synchronized` blocks (fixed in Java 24 by JEP 491) and still during native calls. Pinned threads occupy carriers and reduce scalability.

### Q6. How do you enable virtual threads in Spring Boot?

On Java 21+ with Spring Boot 3.2+, set `spring.threads.virtual.enabled=true`.

### Q7. What is structured concurrency?

An API (`StructuredTaskScope`, currently preview) that treats concurrently running subtasks as a single unit: they're forked within a scope, joined together, and cancelled together if one fails, so subtasks can't leak.

## Common Mistakes

- ❌ **Pooling virtual threads** in a fixed-size executor.
- ❌ **Expecting speed-ups for CPU-bound code.**
- ❌ **Removing all concurrency limits** — overwhelming databases and third-party APIs.
- ❌ **Heavy `ThreadLocal` caching** with millions of threads.
- ❌ **Ignoring pinning** on Java 21–23 (long blocking inside `synchronized`).
- ❌ **Using preview APIs in production** without accepting that they may change.

## Best Practices

- ✅ Use virtual threads for I/O-bound, high-concurrency workloads — typical REST services.
- ✅ Create a virtual thread per task; never pool them.
- ✅ Guard downstream resources with semaphores, bulkheads and right-sized connection pools.
- ✅ Prefer Java 24+ to avoid `synchronized` pinning, or use `ReentrantLock` around blocking calls on 21–23.
- ✅ Monitor with JFR (`jdk.VirtualThreadPinned`) and thread dumps (`jcmd <pid> Thread.dump_to_file -format=json`).

## Key Takeaways

- ✅ Virtual threads are lightweight JVM-managed threads, final in Java 21.
- ✅ Blocking calls unmount them from carrier threads, so millions can wait concurrently.
- ✅ They boost throughput for I/O-bound work, not CPU-bound work.
- ✅ Don't pool them; limit concurrency explicitly.
- ✅ `synchronized` pinning was fixed in Java 24; native calls can still pin.
- ✅ Spring Boot enables them with `spring.threads.virtual.enabled=true`.
