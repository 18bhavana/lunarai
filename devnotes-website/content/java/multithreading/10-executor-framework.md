---
title: The Executor Framework
subtitle: Executor and ExecutorService, the Executors factory methods and their hidden risks, execute vs submit, Callable and Future, invokeAll and invokeAny, and shutting a pool down correctly.
order: 10
---

## Introduction

> [!NOTE]
> **Interview importance:** very high. Executors are how production Java code runs concurrent work.

The **`ExecutorService`** interface in `java.util.concurrent` provides a high-level API for running and managing asynchronous tasks. Instead of creating and managing raw threads, you **submit tasks** and let the executor decide which thread runs them.

It is essentially a **thread-pool manager**: it handles the lifecycle of its threads — creation, reuse and termination — which uses resources far more efficiently when there are many tasks.

## Why Use an ExecutorService?

- **Resource management** — threads are reused from a pool, avoiding the cost of creating and destroying a thread for every task. Much more efficient for many short-lived tasks.
- **Separation of concerns** — *what* to run (the task) is separated from *how and when* it runs (thread management).
- **Controlled concurrency** — a fixed pool limits how many threads exist, preventing resource exhaustion under load.
- **Results and errors** — `Future` gives you a task's result or exception.
- **Lifecycle control** — orderly shutdown, timeouts and cancellation.

```flow-h
Your code submits tasks
Task queue
Pool of worker threads
Results via Future
```

## The Executor Hierarchy

```tree
Executor | execute(Runnable)
  ExecutorService | submit, invokeAll, invokeAny, shutdown
    ScheduledExecutorService | schedule, scheduleAtFixedRate
    AbstractExecutorService
      ThreadPoolExecutor | the standard thread pool
      ForkJoinPool | work-stealing pool
```

## Creating Executors

The `Executors` utility class provides factory methods:

| Factory method | Behaviour |
| --- | --- |
| `newFixedThreadPool(n)` | Exactly `n` threads; extra tasks wait in a queue |
| `newCachedThreadPool()` | Creates threads as needed, reuses idle ones; idle threads die after 60 seconds |
| `newSingleThreadExecutor()` | One worker thread — tasks run **sequentially**, in submission order |
| `newScheduledThreadPool(n)` | Runs tasks after a delay or periodically |
| `newWorkStealingPool()` | A `ForkJoinPool` sized to the number of cores |
| `newVirtualThreadPerTaskExecutor()` | Java 21: a new virtual thread for every task |

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
```

> [!WARNING]
> The convenience factories hide dangerous defaults:
> - `newFixedThreadPool` and `newSingleThreadExecutor` use an **unbounded queue** (`LinkedBlockingQueue`). If tasks arrive faster than they're processed, the queue grows until `OutOfMemoryError`.
> - `newCachedThreadPool` has **no limit on threads**. A burst of slow tasks can create thousands of threads.
>
> For production services, build a `ThreadPoolExecutor` with a **bounded queue** and an explicit rejection policy (next chapter), or use Spring's `ThreadPoolTaskExecutor`.

## Submitting Tasks

| Method | Task type | Returns | Description |
| --- | --- | --- | --- |
| `execute(Runnable)` | `Runnable` | `void` | Fire and forget — no result, no status |
| `submit(Runnable)` | `Runnable` | `Future<?>` | Track completion; `get()` returns `null` |
| `submit(Callable<T>)` | `Callable<T>` | `Future<T>` | Returns a result of type `T` |
| `invokeAll(tasks)` | `Collection<Callable<T>>` | `List<Future<T>>` | Runs all; returns when **all** have completed |
| `invokeAny(tasks)` | `Collection<Callable<T>>` | `T` | Returns the result of **one** task that completed successfully and cancels the rest |

### execute vs submit and Exceptions

| `execute()` | `submit()` |
| --- | --- |
| An exception kills the worker thread and goes to its `UncaughtExceptionHandler` (printed to stderr by default) | The exception is **captured in the `Future`**; nothing is printed |
| You see failures in the logs | You see the failure **only** if you call `get()` |

```java
pool.submit(() -> { throw new IllegalStateException("boom"); });
// ❌ Nothing printed anywhere — the failure is silently stored in a Future nobody reads
```

## Callable and Future

```java
ExecutorService pool = Executors.newFixedThreadPool(2);

Callable<BigDecimal> priceTask = () -> pricingClient.fetchPrice("SKU-1");

Future<BigDecimal> future = pool.submit(priceTask);

// do other work here...

BigDecimal price = future.get(2, TimeUnit.SECONDS);   // blocks until done or timeout
```

| `Future` method | Meaning |
| --- | --- |
| `get()` | Block until the result is ready; rethrows failures as `ExecutionException` |
| `get(timeout, unit)` | Block at most `timeout`; throws `TimeoutException` |
| `isDone()` | Finished — normally, exceptionally or cancelled |
| `cancel(mayInterrupt)` | Try to cancel; `true` interrupts the running thread |
| `isCancelled()` | Was it cancelled? |
| `state()`, `resultNow()`, `exceptionNow()` | Java 19+: non-blocking inspection of a completed future |

```java
try {
    BigDecimal price = future.get(2, TimeUnit.SECONDS);
} catch (TimeoutException e) {
    future.cancel(true);                         // stop waiting and interrupt the task
} catch (ExecutionException e) {
    log.error("Pricing failed", e.getCause());   // the task's actual exception
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

> [!TIP]
> `Future.get()` **blocks**, and `Future` has no way to chain steps or combine results without blocking. `CompletableFuture` (Java 8) solves that — see the CompletableFuture chapter.

### invokeAll and invokeAny

```java
List<Callable<Quote>> tasks = List.of(
        () -> supplierA.quote(item),
        () -> supplierB.quote(item),
        () -> supplierC.quote(item));

// All quotes — waits for every task (optionally with a timeout)
List<Future<Quote>> all = pool.invokeAll(tasks, 3, TimeUnit.SECONDS);

// Fastest successful quote — the others are cancelled
Quote fastest = pool.invokeAny(tasks);
```

With a timeout, `invokeAll` cancels tasks that haven't finished in time; their futures report `isCancelled()`.

## Shutting Down an Executor

An `ExecutorService` **does not stop on its own** when there are no tasks. Its non-daemon worker threads keep the JVM alive, so it must be shut down explicitly.

| Method | Effect |
| --- | --- |
| `shutdown()` | **Orderly shutdown** — stop accepting new tasks; already-submitted tasks still run |
| `shutdownNow()` | Interrupt running tasks, discard queued ones, and return the list of tasks that never started |
| `awaitTermination(timeout, unit)` | Block until all tasks finish after a shutdown, the timeout elapses, or the thread is interrupted |
| `isShutdown()` / `isTerminated()` | Shutdown requested / all tasks finished |
| `close()` | Java 19+: `shutdown()` then wait for termination — enables try-with-resources |

### The Standard Shutdown Pattern

```java
void shutdownGracefully(ExecutorService pool) {
    pool.shutdown();                                   // no new tasks
    try {
        if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
            pool.shutdownNow();                        // interrupt stragglers
            if (!pool.awaitTermination(10, TimeUnit.SECONDS)) {
                log.error("Pool did not terminate");
            }
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();
        Thread.currentThread().interrupt();
    }
}
```

### try-with-resources (Java 19+)

```java
try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
    pool.submit(() -> sendEmail(a));
    pool.submit(() -> sendEmail(b));
}   // close() waits for both tasks to finish
```

> [!NOTE]
> `shutdownNow()` only **interrupts** running tasks. A task that ignores interrupts (swallows `InterruptedException`, or loops without checking `isInterrupted()`) keeps running anyway.

In Spring, executors defined as beans (`ThreadPoolTaskExecutor`) are shut down by the container automatically.

## Scheduled Executors

```java
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

scheduler.schedule(() -> sendReminder(), 10, TimeUnit.MINUTES);               // once, after a delay

scheduler.scheduleAtFixedRate(() -> refreshCache(), 0, 5, TimeUnit.MINUTES);  // every 5 min from start times

scheduler.scheduleWithFixedDelay(() -> pollInbox(), 0, 30, TimeUnit.SECONDS); // 30 s after each run ends
```

| `scheduleAtFixedRate` | `scheduleWithFixedDelay` |
| --- | --- |
| Period measured between **start** times | Delay measured from the **end** of one run to the start of the next |
| If a run overruns, the next starts late — runs never overlap | Always keeps the gap |

> [!WARNING]
> If a periodic task throws an exception, **all its future executions are silently cancelled**. Wrap the body in `try/catch` and log.

## Interview Questions

### Q1. What is ExecutorService?

An interface in `java.util.concurrent` for managing and executing asynchronous tasks on a pool of threads. It replaces manual thread management, reuses threads, limits concurrency, returns results through `Future`, and supports orderly shutdown.

### Q2. What is the difference between execute() and submit()?

`execute()` takes a `Runnable` and returns nothing; exceptions go to the thread's uncaught-exception handler. `submit()` accepts a `Runnable` or `Callable`, returns a `Future`, and captures exceptions inside the `Future`.

### Q3. What is the difference between Runnable and Callable?

`Runnable.run()` returns nothing and can't throw checked exceptions. `Callable.call()` returns a value and can throw checked exceptions.

### Q4. What is a Future?

A handle to the result of an asynchronous computation: `get()` waits for it, `isDone()` checks completion and `cancel()` attempts cancellation.

### Q5. What is the difference between shutdown() and shutdownNow()?

`shutdown()` stops accepting tasks but lets submitted ones finish. `shutdownNow()` also interrupts running tasks and returns the tasks that were still queued.

### Q6. Why shouldn't you use Executors.newFixedThreadPool() in production?

Its queue is unbounded, so a backlog can grow until memory runs out. A `ThreadPoolExecutor` with a bounded queue and a rejection policy gives explicit back-pressure.

### Q7. What's the difference between invokeAll and invokeAny?

`invokeAll` runs all tasks and returns all their futures once every task completes. `invokeAny` returns the result of the first task to complete successfully and cancels the rest.

## Common Mistakes

- ❌ **Never shutting down the executor** — the JVM can't exit, and threads leak.
- ❌ **Creating a new executor per request** instead of sharing one.
- ❌ **Using `submit()` and never reading the `Future`** — exceptions disappear.
- ❌ **Calling `get()` without a timeout** on remote or slow work.
- ❌ **Unbounded queues or unbounded thread counts** in production.
- ❌ **Letting a scheduled task throw** — it silently stops repeating.

## Best Practices

- ✅ Create executors once (or as Spring beans) and reuse them.
- ✅ Use bounded queues and explicit rejection policies for production pools.
- ✅ Name pool threads with a `ThreadFactory`.
- ✅ Always handle task exceptions — log in the task, or check every `Future`.
- ✅ Use timeouts on `get()`, `invokeAll()` and `awaitTermination()`.
- ✅ Shut down with `shutdown()` → `awaitTermination()` → `shutdownNow()`, or try-with-resources.

## Key Takeaways

- ✅ `ExecutorService` manages a pool of reusable threads and decouples tasks from threads.
- ✅ `execute()` fires and forgets; `submit()` returns a `Future` that holds the result or exception.
- ✅ `Callable` returns values; `Future.get()` blocks for them.
- ✅ The `Executors` factories are convenient but have unbounded queues or thread counts.
- ✅ Executors must be shut down explicitly.
- ✅ Scheduled executors run delayed and periodic work; an exception cancels a periodic task.
