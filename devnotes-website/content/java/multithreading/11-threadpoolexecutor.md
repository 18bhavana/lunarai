---
title: ThreadPoolExecutor Internals & Pool Sizing
subtitle: Core and maximum pool size, work queues, keep-alive, the task-acceptance algorithm, rejection policies, custom ThreadFactory, sizing pools for CPU- and I/O-bound work, and monitoring.
order: 11
---

## Introduction

> [!NOTE]
> **Interview importance:** very high for senior roles. "Explain the ThreadPoolExecutor parameters" and "how do you size a thread pool?" are standard questions.

Every `Executors` factory method (except work-stealing and virtual-thread executors) returns a **`ThreadPoolExecutor`** configured in a particular way. Building one directly gives you full control — and avoids the unbounded queues and thread counts hidden in the factories.

## The Constructor

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
        4,                                    // corePoolSize
        16,                                   // maximumPoolSize
        60, TimeUnit.SECONDS,                 // keepAliveTime for threads above core
        new ArrayBlockingQueue<>(500),        // workQueue — bounded
        namedThreadFactory("order-worker"),   // threadFactory
        new ThreadPoolExecutor.CallerRunsPolicy()   // rejection handler
);
```

| Parameter | Meaning |
| --- | --- |
| `corePoolSize` | Threads kept alive even when idle (unless `allowCoreThreadTimeOut(true)`) |
| `maximumPoolSize` | Upper limit on threads |
| `keepAliveTime` | How long threads **above core** may stay idle before being terminated |
| `workQueue` | Where tasks wait when all core threads are busy |
| `threadFactory` | Creates threads — set names, daemon status, exception handlers |
| `handler` | `RejectedExecutionHandler` — what to do when the pool and queue are full |

## How a Task Is Accepted

This algorithm surprises most developers:

```flow
Task submitted
? Fewer than corePoolSize threads running? | Yes: start a new core thread for it | No: try the queue
? Queue accepts the task? | Yes: task waits in the queue | No: queue is full
? Fewer than maximumPoolSize threads? | Yes: start a new non-core thread | No: reject the task
```

> [!IMPORTANT]
> The pool grows beyond `corePoolSize` **only when the queue is full**. With an **unbounded** queue the queue is never full, so `maximumPoolSize` is **never used** — the pool stays at `corePoolSize` forever while the queue grows. That's exactly how `newFixedThreadPool(n)` behaves.

### Example

Core 2, max 4, queue capacity 3 — tasks are long-running:

| Task | Running threads | Queue | What happens |
| --- | --- | --- | --- |
| 1 | 1 | 0 | New core thread |
| 2 | 2 | 0 | New core thread |
| 3–5 | 2 | 3 | Queued |
| 6 | 3 | 3 | Queue full → new non-core thread |
| 7 | 4 | 3 | Another non-core thread |
| 8 | 4 | 3 | **Rejected** |

## Work Queues

| Queue | Behaviour | Used by |
| --- | --- | --- |
| `ArrayBlockingQueue(n)` | Bounded FIFO, array-backed | Production pools with back-pressure |
| `LinkedBlockingQueue()` | Optionally bounded; **unbounded by default** | `newFixedThreadPool`, `newSingleThreadExecutor` |
| `SynchronousQueue` | No capacity — each hand-off needs a waiting thread | `newCachedThreadPool` (so it grows threads instead of queuing) |
| `PriorityBlockingQueue` | Unbounded, ordered by priority | Priority task processing |
| `DelayedWorkQueue` | Ordered by scheduled time | `ScheduledThreadPoolExecutor` |

### How the Factory Methods Are Built

| Factory | core | max | Queue |
| --- | --- | --- | --- |
| `newFixedThreadPool(n)` | n | n | Unbounded `LinkedBlockingQueue` |
| `newSingleThreadExecutor()` | 1 | 1 | Unbounded `LinkedBlockingQueue` |
| `newCachedThreadPool()` | 0 | `Integer.MAX_VALUE` | `SynchronousQueue`, 60 s keep-alive |

## Rejection Policies

When the queue is full and the pool is at `maximumPoolSize` — or after `shutdown()` — the handler decides what happens:

| Policy | Behaviour | When to use |
| --- | --- | --- |
| `AbortPolicy` (default) | Throw `RejectedExecutionException` | The caller can handle the failure (return 503, retry later) |
| `CallerRunsPolicy` | Run the task **on the submitting thread** | Natural back-pressure — the producer slows down |
| `DiscardPolicy` | Silently drop the task | Only for genuinely disposable work |
| `DiscardOldestPolicy` | Drop the oldest queued task and retry | Latest data matters more than old (e.g. live price updates) |
| Custom handler | Log, record a metric, persist to a retry queue… | Most production systems |

```java
RejectedExecutionHandler handler = (task, executor) -> {
    rejectedCounter.increment();
    log.warn("Task rejected; active={} queue={}", executor.getActiveCount(), executor.getQueue().size());
    throw new RejectedExecutionException("Order pool saturated");
};
```

> [!WARNING]
> `CallerRunsPolicy` runs the task on the caller — in a web app that's the **request thread**, which then takes longer to respond. It's good back-pressure, but make sure that's acceptable. `DiscardPolicy` loses work with no trace.

## A Custom ThreadFactory

```java
static ThreadFactory namedThreadFactory(String prefix) {
    AtomicInteger counter = new AtomicInteger(1);
    return runnable -> {
        Thread t = new Thread(runnable, prefix + "-" + counter.getAndIncrement());
        t.setDaemon(false);
        t.setUncaughtExceptionHandler((th, ex) -> log.error("Uncaught in {}", th.getName(), ex));
        return t;
    };
}
```

Java 21 also offers `Thread.ofPlatform().name("order-worker-", 1).factory()`. Guava's `ThreadFactoryBuilder` and Spring's `CustomizableThreadFactory` do the same.

## Sizing a Thread Pool

There's no universal number — it depends on the work.

### CPU-Bound Work

```text
threads ≈ number of cores   (often cores + 1)
```

More threads than cores only add context switching.

### I/O-Bound Work

Threads spend most of their time waiting (database, HTTP), so more threads keep the CPU busy:

```text
threads ≈ cores × (1 + wait time / compute time)
```

Example: 8 cores, each request waits 90 ms on a database and computes for 10 ms → 8 × (1 + 90/10) = **80 threads**.

### Little's Law

```text
threads needed = arrival rate × average time per task
```

200 requests/second × 0.25 seconds each = **50** concurrent tasks in flight.

> [!TIP]
> Formulas give a starting point; **load-test and measure**. And remember downstream limits: 80 threads sharing a HikariCP pool of 10 connections just means 70 threads waiting for a connection. Size pools **together**.

### Separate Pools for Different Workloads (Bulkheads)

Don't run slow calls to a flaky third-party API on the same pool as fast internal work. If the API hangs, it consumes every thread and everything else starves. Give each kind of work its own pool — the **bulkhead** pattern (as in Resilience4j).

## Hooks and Monitoring

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(4, 16, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(500)) {
    @Override
    protected void beforeExecute(Thread t, Runnable r) {
        MDC.put("pool", "orders");
    }

    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        MDC.clear();
        if (t != null) log.error("Task failed", t);   // only for execute(); submit() wraps exceptions in the Future
    }
};
```

Useful metrics: `getActiveCount()`, `getPoolSize()`, `getQueue().size()`, `getCompletedTaskCount()`, `getLargestPoolSize()`. Micrometer's `ExecutorServiceMetrics` exports them; Spring Boot does this automatically for its own task executors.

Pools can be tuned at runtime with `setCorePoolSize()`, `setMaximumPoolSize()` and `allowCoreThreadTimeOut(true)`, and warmed up with `prestartAllCoreThreads()`.

## Interview Questions

### Q1. Explain the main parameters of ThreadPoolExecutor.

`corePoolSize` (threads kept alive), `maximumPoolSize` (upper limit), `keepAliveTime` (idle timeout for extra threads), `workQueue` (waiting tasks), `threadFactory` (thread creation) and `RejectedExecutionHandler` (what happens when saturated).

### Q2. When does ThreadPoolExecutor create threads beyond corePoolSize?

Only when all core threads are busy **and the queue is full**. With an unbounded queue, it never exceeds the core size.

### Q3. What rejection policies are available?

`AbortPolicy` (throw — the default), `CallerRunsPolicy` (run on the submitting thread), `DiscardPolicy` (drop silently) and `DiscardOldestPolicy` (drop the oldest queued task), plus custom handlers.

### Q4. How do you choose the pool size?

About the number of cores for CPU-bound work; more for I/O-bound work — roughly cores × (1 + wait/compute) or arrival rate × task time (Little's law) — then validate by load testing, and align with downstream limits such as connection pools.

### Q5. Why is newCachedThreadPool risky?

Its maximum is `Integer.MAX_VALUE` with a `SynchronousQueue`, so a burst of slow tasks creates an unbounded number of threads and can exhaust memory or OS limits.

### Q6. What is the bulkhead pattern?

Isolating different workloads into separate pools so a slow or failing dependency can only exhaust its own threads, not the whole application's.

## Common Mistakes

- ❌ **Unbounded queues** — hide overload until memory runs out, and make `maximumPoolSize` meaningless.
- ❌ **Setting max > core with an unbounded queue** and expecting the pool to grow.
- ❌ **One shared pool for everything** — one slow dependency starves all work.
- ❌ **Silent rejection** (`DiscardPolicy`) with no metric or log.
- ❌ **Oversizing pools** relative to database connections or CPU.
- ❌ **Unnamed threads** — thread dumps show `pool-7-thread-23`.

## Best Practices

- ✅ Construct `ThreadPoolExecutor` (or Spring `ThreadPoolTaskExecutor`) explicitly with a **bounded** queue.
- ✅ Choose a rejection policy deliberately and record rejections as a metric.
- ✅ Name threads and set an uncaught-exception handler through a `ThreadFactory`.
- ✅ Size from the nature of the work, then load-test.
- ✅ Use separate pools (bulkheads) for independent workloads.
- ✅ Monitor active threads, queue depth and rejections.

## Key Takeaways

- ✅ `ThreadPoolExecutor` is configured by core size, max size, keep-alive, queue, thread factory and rejection handler.
- ✅ New threads beyond core are created only when the queue is full.
- ✅ The `Executors` factories use unbounded queues or unbounded threads — avoid them for production services.
- ✅ Rejection policies define behaviour under overload; `CallerRunsPolicy` gives back-pressure.
- ✅ CPU-bound pools ≈ cores; I/O-bound pools are larger and must match downstream capacity.
