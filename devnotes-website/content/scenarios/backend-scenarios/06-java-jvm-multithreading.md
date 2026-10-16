---
title: Java, JVM & Multithreading Scenarios
subtitle: "Scenario questions 49–58: OutOfMemoryError in production, long GC pauses, exhausted thread pools, slow CompletableFuture pipelines, too many threads, deadlocks, ConcurrentHashMap race conditions, memory leaks in a garbage-collected language, virtual threads, and async tasks that fail silently."
order: 6
---

## Introduction

JVM problems in production are diagnosed with evidence: **heap dumps, thread dumps, GC logs and profilers**. Know which tool answers which question:

| Question | Tool |
| --- | --- |
| What fills the heap? | Heap dump (`jcmd <pid> GC.heap_dump`), analysed in Eclipse MAT |
| What are the threads doing? | Thread dump (`jstack <pid>`, `jcmd <pid> Thread.print`, Actuator `/threaddump`) |
| How long are GC pauses? | GC logs (`-Xlog:gc*`), JFR, Micrometer JVM metrics |
| Where does CPU or allocation go? | Java Flight Recorder (JFR), async-profiler |
| Is memory growing over time? | `jvm_memory_used_bytes` and heap-after-GC trends in Grafana |

For the underlying concepts, see the [Multithreading](/java/multithreading/introduction-to-multithreading/) topic.

## Scenario Questions

### Q49. Your application suddenly throws OutOfMemoryError in production. How would you investigate and resolve it?

**1. Read the exact message.** Each type has a different cause:

| Message | Meaning |
| --- | --- |
| `Java heap space` | The heap is full of live objects: a leak, or an oversized workload |
| `GC overhead limit exceeded` | The JVM spends almost all its time in GC and recovers very little |
| `Metaspace` | Too many loaded classes: classloader leaks, dynamic proxies or redeploys |
| `unable to create native thread` | The OS thread or memory limit was reached (Q53) |
| `Direct buffer memory` | Off-heap NIO buffers (Netty, NIO clients) exhausted |
| Container killed with **OOMKilled** (exit code 137) | The process exceeded the container memory limit. This isn't a Java OOM: heap + metaspace + threads + direct memory > limit |

**2. Capture evidence automatically:**

```text
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps
-XX:+ExitOnOutOfMemoryError        # let the orchestrator restart a broken JVM
-Xlog:gc*:file=/logs/gc.log:time,uptime:filecount=5,filesize=20m
```

**3. Analyse the heap dump** in Eclipse MAT. Look at the **dominator tree** and the **leak suspects** report: which objects retain most of the memory, and through which reference chain (a static map, a cache, a ThreadLocal)?

**4. Typical causes:**

- loading huge result sets (`findAll()` on millions of rows, or reading a whole file into memory);
- unbounded caches or collections;
- request payloads with no size limits;
- leaks (Q56).

**5. Fix and prevent:**

- Stream or paginate large data, and bound caches (Caffeine with `maximumSize` and expiry).
- Set request size limits.
- Size the heap correctly for containers (`-XX:MaxRAMPercentage=75`), leaving headroom for non-heap memory.
- Alert on heap usage after GC.

### Q50. Your application experiences long garbage collection pauses. How would you identify the cause?

**Measure first:** enable GC logs (`-Xlog:gc*`) and look at pause times, frequency, heap occupancy before and after each collection, and the **cause** of each pause. JFR and Micrometer (`jvm_gc_pause_seconds`) show the same data over time.

**Common causes:**

- **A heap close to full** (high occupancy after GC): constant collections and eventually **full GCs**. It's often a leak, or a heap that's too small.
- **A very high allocation rate:** creating many temporary objects (string concatenation in loops, boxing, large JSON trees), so young collections run all the time.
- **Humongous objects** in G1 (objects larger than half a region, such as big arrays and buffers), which are allocated and collected expensively.
- **A large live set** with the wrong collector: big heaps with G1 tuned for throughput rather than pause time.
- **`System.gc()` calls** from code or libraries.
- **Environment:** CPU throttling in containers (GC threads starved), and swapping.

**Fixes:**

- Fix leaks and reduce allocation: reuse buffers, stream instead of loading everything, use primitive collections where they help.
- Size the heap properly, and use **G1** (the default) with `-XX:MaxGCPauseMillis`, or **ZGC** (Java 21: `-XX:+UseZGC -XX:+ZGenerational`) for sub-millisecond pauses on large heaps.
- Give containers enough CPU for the GC threads.
- Avoid explicit `System.gc()` (`-XX:+DisableExplicitGC`, if libraries call it).

### Q51. Your thread pool is exhausted, and new requests are being rejected. What would you investigate?

```output
java.util.concurrent.RejectedExecutionException: Task … rejected from
java.util.concurrent.ThreadPoolExecutor@1a2b3c[Running, pool size = 50, active threads = 50, queued tasks = 1000, completed tasks = 98123]
```

**Investigate:**

1. **What are the busy threads doing?** Take thread dumps. If they're blocked on I/O (HTTP, database), tasks are slow, not too numerous.
2. **Task duration:** a dependency got slower, a timeout is missing, or a query regressed.
3. **Arrival rate:** a traffic spike, retries, or a loop submitting tasks.
4. **Pool configuration:** core and max size, queue capacity, rejection policy. Remember that with a bounded queue, `ThreadPoolExecutor` only adds threads beyond the core size **when the queue is full**.
5. **Shared pools:** one pool used by several features, where a slow feature starves the others. The common `ForkJoinPool` used by `parallelStream()` and `CompletableFuture.supplyAsync()` without an executor is a classic case.
6. **Deadlocks or tasks waiting on other tasks in the same pool** (pool-induced deadlock).

**Fixes:** add timeouts to blocking calls, use **separate pools (bulkheads)** per dependency, size pools for the workload (I/O-bound pools can be larger), and use a meaningful rejection policy (`CallerRunsPolicy` for backpressure, or fail fast with 503). Monitor `executor.active`, `executor.queued` and the rejected count. Consider virtual threads for blocking I/O (Q57). See [ThreadPoolExecutor](/java/multithreading/threadpoolexecutor/).

### Q52. A CompletableFuture-based workflow becomes slower under heavy traffic. How would you debug it?

**Likely causes:**

- **Running on the common `ForkJoinPool`.** `supplyAsync(task)` without an executor uses a pool sized to CPU cores − 1. Blocking I/O there quickly starves **everything** that uses it, including parallel streams.
- **Blocking inside the async chain:** `join()` or `get()` in the middle of a pipeline, or blocking HTTP or JDBC calls in `thenApply`.
- **An executor that's too small**, or a long queue in front of it.
- **No timeouts:** one slow downstream call holds the whole composition.
- **Contention on a downstream pool** (HTTP client or database connection limits).

**Debug:**

- Take thread dumps under load and look for `ForkJoinPool.commonPool-worker` threads blocked on sockets.
- Collect executor metrics (active, queue size) and per-stage timing with traces or Micrometer timers.

**Fix:**

```java
private final ExecutorService ioPool = Executors.newFixedThreadPool(50);   // or newVirtualThreadPerTaskExecutor()

CompletableFuture<Price> price = CompletableFuture
        .supplyAsync(() -> pricingClient.get(sku), ioPool)
        .orTimeout(2, TimeUnit.SECONDS)
        .exceptionally(ex -> Price.unavailable());

CompletableFuture<Stock> stock = CompletableFuture
        .supplyAsync(() -> inventoryClient.get(sku), ioPool)
        .completeOnTimeout(Stock.unknown(), 2, TimeUnit.SECONDS);

ProductView view = price.thenCombine(stock, ProductView::new).join();   // join only at the edge
```

Pass a **dedicated executor**, add **timeouts** (`orTimeout`, `completeOnTimeout`), never block in the middle of the chain, and propagate context (MDC, security, tracing) with a context-aware executor. See [CompletableFuture](/java/multithreading/completablefuture/).

### Q53. Your application creates too many threads and starts experiencing performance issues. How would you fix it?

**Symptoms:** high memory use (each platform thread reserves stack, often 512 KB–1 MB), heavy context switching, `OutOfMemoryError: unable to create native thread`, and rising latency.

**Find the source:** count threads by name in a thread dump (`jcmd <pid> Thread.print`, then group by name prefix). Unnamed `Thread-123` threads or `pool-57-thread-3` give the culprit away. Watch `jvm_threads_live_threads` too.

**Common causes:**

- `new Thread(...)` for every request or task;
- creating a **new `ExecutorService` per request** and never shutting it down;
- unbounded pools such as `Executors.newCachedThreadPool()` under load;
- a separate pool per library or client, each with large defaults;
- `@Async` falling back to `SimpleAsyncTaskExecutor`, which creates a new thread per task (in older or misconfigured setups).

**Fixes:**

- Use **shared, bounded, named** executors as Spring beans (`ThreadPoolTaskExecutor` with max size, queue capacity and a thread name prefix), and shut them down on application stop.
- Configure Spring's `@Async` executor explicitly (`spring.task.execution.pool.*`).
- For many concurrent **blocking** tasks, use **virtual threads** (Java 21), which are cheap and don't need pooling.
- Use asynchronous or non-blocking clients where it fits.

### Q54. Two threads are waiting indefinitely for each other. How would you identify and resolve the deadlock?

**Identify:** take a thread dump. The JVM detects monitor and `ReentrantLock` deadlocks and prints them explicitly:

```output
Found one Java-level deadlock:
"transfer-1": waiting to lock monitor 0x…(a com.bank.Account), which is held by "transfer-2"
"transfer-2": waiting to lock monitor 0x…(a com.bank.Account), which is held by "transfer-1"
```

`jcmd <pid> Thread.print`, `jstack`, JConsole or VisualVM ("Detect Deadlock") and `ThreadMXBean.findDeadlockedThreads()` all show it.

**Typical cause:** locks taken in a different order:

```java
// Thread 1: transfer(a, b) locks a, then b
// Thread 2: transfer(b, a) locks b, then a → deadlock
```

**Resolve:**

1. **Consistent lock ordering.** Always lock the account with the smaller ID first:

```java
Account first = a.getId() < b.getId() ? a : b;
Account second = first == a ? b : a;
synchronized (first) {
    synchronized (second) { … }
}
```

2. **`tryLock` with a timeout,** backing off and retrying instead of waiting forever.
3. **Fewer nested locks:** smaller critical sections, and no calls to external code while holding a lock.
4. **Higher-level tools:** concurrent collections, atomics, or a single owner thread or actor for a resource.

**Database deadlocks** are similar. The database detects them and kills one transaction (`Deadlock found when trying to get lock`), so access rows in a consistent order and retry the victim transaction. See [Deadlock, Livelock & Starvation](/java/multithreading/deadlock-livelock-starvation/).

### Q55. A ConcurrentHashMap is being used, but your business operation still produces inconsistent results. Why?

`ConcurrentHashMap` makes **individual operations** thread-safe. It doesn't make a **sequence** of operations atomic.

```java
// ❌ check-then-act: two threads can both see null and both put
if (!map.containsKey(key)) {
    map.put(key, new Session());
}

// ❌ read-modify-write: lost updates
map.put(word, map.get(word) + 1);
```

**Fix:** use the atomic compound methods:

```java
map.computeIfAbsent(key, k -> new Session());
map.merge(word, 1, Integer::sum);
map.compute(accountId, (id, balance) -> balance == null ? amount : balance.add(amount));
```

**Other causes:**

- **Mutable values:** the map is safe, but the objects inside it (an `ArrayList` value, a mutable `Account`) are modified concurrently without synchronisation. Use thread-safe or immutable values, or modify them only inside `compute`.
- **Invariants across several keys or maps** ("move X from A to B") need a lock around the whole operation.
- **Iteration is weakly consistent:** iterators and `size()` reflect some point in time, not a snapshot.
- **Several instances:** each JVM has its own map. Shared state belongs in Redis or the database.
- Keep the functions passed to `compute` short, with no I/O, because they run while a bin is locked.

### Q56. Your application has a memory leak even though Java uses garbage collection. How can this happen?

The GC frees only **unreachable** objects. A leak in Java is an object that's **still referenced but no longer needed**.

**Common leaks:**

- **Static collections and caches** that only grow: `static Map<String, Object> cache` with no eviction.
- **`ThreadLocal` values never removed** in pooled threads. The worker thread lives forever, so the value does too:

```java
try {
    CONTEXT.set(userContext);
    handle(request);
} finally {
    CONTEXT.remove();   // essential with thread pools
}
```

- **Listeners and callbacks** registered but never deregistered.
- **Unclosed resources:** streams, connections, `ResultSet`s, and their native buffers.
- **Keys with broken `equals`/`hashCode`** in a `HashMap`. Duplicates pile up, or mutated keys can't be found and removed.
- **Inner classes and lambdas** that capture large outer objects and are stored long-term.
- **Classloader leaks** on redeploys (Metaspace growth): threads or drivers holding references to old application classes.
- **Large Hibernate persistence contexts** in long-running batch transactions (call `clear()` periodically).
- **Interned or duplicated strings** and huge logging buffers.

**Find it:** watch heap usage **after GC** trending upward over hours. Take two heap dumps some time apart and compare them in Eclipse MAT, then follow the **path to GC roots** of the growing objects. Fix it with bounded caches (Caffeine), weak references where appropriate, proper cleanup, and try-with-resources.

### Q57. When would you use virtual threads in Java 21, and when would you avoid them?

**Virtual threads** are lightweight threads managed by the JVM. Millions can exist. When one blocks on I/O, it **unmounts** from its carrier (OS) thread, so blocking code scales like asynchronous code while staying simple.

**Use them for:**

- **I/O-bound, high-concurrency work:** request-per-thread web servers (`spring.threads.virtual.enabled=true` in Spring Boot 3.2+), many blocking HTTP or JDBC calls, and fan-out to several services.
- Replacing complex reactive or `CompletableFuture` code purely written for scalability.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<Result>> futures = urls.stream()
            .map(url -> executor.submit(() -> fetch(url)))
            .toList();
}
```

**Avoid them, or be careful, for:**

- **CPU-bound work.** Virtual threads don't add CPU, so use a bounded platform pool sized to the cores, or parallel streams and ForkJoin.
- **Pooling them.** Create one per task. To limit concurrency to a scarce resource, use a **`Semaphore`**, not a small pool.
- **Pinning:** on Java 21–23, blocking inside `synchronized` blocks (or native code) **pins** the carrier thread, which can cause throughput collapse or deadlocks. Prefer `ReentrantLock` in hot paths. Java 24 (JEP 491) removes pinning for `synchronized`.
- **Heavy `ThreadLocal` use:** millions of threads multiply per-thread caches. Consider scoped values.
- **Downstream limits:** a million concurrent requests still hit a database pool of 20 connections. Virtual threads move the bottleneck, they don't remove it.

See [Virtual Threads](/java/multithreading/virtual-threads/).

### Q58. Your asynchronous tasks sometimes fail silently. How would you ensure that exceptions are detected and handled?

Exceptions in background threads don't reach the caller unless you **look for them**:

- **`ExecutorService.submit()`** stores the exception in the `Future`. If nobody calls `get()`, it's lost. Either call `get()` and handle the `ExecutionException`, or use `execute()` with an `UncaughtExceptionHandler`.
- **`CompletableFuture`** must end with handling: `exceptionally`, `handle` or `whenComplete`. An exception in an unobserved chain disappears.

```java
CompletableFuture.runAsync(this::syncInventory, executor)
        .whenComplete((ok, ex) -> {
            if (ex != null) {
                log.error("Inventory sync failed", ex);
                metrics.counter("inventory.sync.failures").increment();
            }
        });
```

- **Spring `@Async` void methods:** register an `AsyncUncaughtExceptionHandler`. For methods returning `CompletableFuture`, the caller must handle the result.

```java
@Configuration
@EnableAsync
class AsyncConfig implements AsyncConfigurer {
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> log.error("Async failure in {}", method.getName(), ex);
    }
}
```

- **`@Scheduled` methods:** wrap the body in a try/catch with logging and metrics, or set an `ErrorHandler` on the `TaskScheduler`.
- **Raw threads:** `Thread.setDefaultUncaughtExceptionHandler(...)` as a safety net.
- **Observability:** count failures and **alert** on them, propagate MDC and trace context into async threads (`TaskDecorator`), and record job status somewhere visible (for example a job table with `FAILED` rows).
- For work that **must** happen, don't rely on in-memory async at all. Use a queue or an outbox with retries and a DLQ, so failures are retried and visible.

## Key Takeaways

- ✅ Diagnose with evidence: heap dumps for memory, thread dumps for hangs, GC logs for pauses.
- ✅ OOMs come from leaks, unbounded data or wrong container sizing. Capture a dump automatically.
- ✅ Exhausted pools usually mean slow tasks: add timeouts and bulkheads, and avoid the common pool for I/O.
- ✅ Deadlocks: consistent lock order, `tryLock` with timeouts, smaller critical sections.
- ✅ `ConcurrentHashMap` needs `compute`/`merge` for compound actions.
- ✅ Virtual threads are for blocking I/O at scale, not CPU work. Watch for pinning and downstream limits.
- ✅ Always observe async results: handlers, metrics and alerts.
