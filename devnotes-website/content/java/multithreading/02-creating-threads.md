---
title: Creating Threads
subtitle: Extending Thread vs implementing Runnable, lambdas, start() vs run(), naming, daemon threads, priorities, uncaught-exception handlers, and why production code uses executors instead.
order: 2
---

## Introduction

Java gives you two classic ways to define work for a thread — **extend `Thread`** or **implement `Runnable`** — plus `Callable` for tasks that return a value (covered with executors). This chapter covers both, the critical `start()` vs `run()` difference, and the thread properties every backend developer should know: names, daemon status, priorities and uncaught-exception handlers.

## Way 1 — Extend Thread

```java
class EmailSender extends Thread {

    @Override
    public void run() {
        System.out.println("Sending email on " + Thread.currentThread().getName());
    }
}

public class Main {
    public static void main(String[] args) {
        EmailSender sender = new EmailSender();
        sender.start();
        System.out.println("Main continues on " + Thread.currentThread().getName());
    }
}
```

```output One possible output
Main continues on main
Sending email on Thread-0
```

The order of the two lines is **not guaranteed** — the threads run independently and the scheduler decides.

## Way 2 — Implement Runnable

```java
class EmailTask implements Runnable {

    @Override
    public void run() {
        System.out.println("Sending email on " + Thread.currentThread().getName());
    }
}

Thread thread = new Thread(new EmailTask());
thread.start();
```

`Runnable` is a functional interface (`void run()`), so a lambda works too:

```java
Thread thread = new Thread(() -> System.out.println("Sending email"));
thread.start();
```

### Java 21 Builders

```java
Thread t1 = Thread.ofPlatform().name("email-sender").start(() -> sendEmail());
Thread t2 = Thread.ofVirtual().start(() -> sendEmail());   // a virtual thread
```

## Thread vs Runnable — Which to Use?

| Extend Thread | Implement Runnable |
| --- | --- |
| Uses up your only superclass (Java has single inheritance) | Class can still extend something else |
| Mixes **the task** with **the thread mechanism** | Separates the task (what) from the thread (how) |
| The task can't be submitted to an executor as-is | Can be passed to `Thread`, `ExecutorService`, `CompletableFuture` |
| Rarely the right design | **Preferred** |

> [!TIP]
> Prefer `Runnable` (or `Callable`). It's a better design — "favour composition over inheritance" — and it's what executors and thread pools accept.

## start() vs run() — the Classic Trap

```java
Thread thread = new Thread(() ->
        System.out.println("Running on " + Thread.currentThread().getName()));

thread.run();     // Running on main     — just a normal method call!
thread.start();   // Running on Thread-0 — a new thread
```

| `start()` | `run()` |
| --- | --- |
| Asks the JVM to create a **new thread**, which then calls `run()` | Executes `run()` **on the current thread**, like any method |
| Returns immediately — work happens concurrently | Blocks until `run()` finishes |
| Can be called only **once** per `Thread` object | Can be called any number of times |

```flow
thread.start()
JVM creates a new OS thread
New thread calls run()
start() has already returned to the caller
```

### Calling start() Twice

```java
Thread thread = new Thread(() -> System.out.println("Hello"));
thread.start();
thread.start();   // throws
```

```output Exception
Exception in thread "main" java.lang.IllegalThreadStateException
```

A thread can't be restarted once it's started — create a new `Thread` (or, better, reuse a thread pool).

## Naming Threads

Default names like `Thread-0` make logs and thread dumps useless. Name your threads:

```java
Thread worker = new Thread(task, "invoice-generator");
worker.setName("invoice-generator-1");
```

In production, name pool threads with a `ThreadFactory` (covered with `ThreadPoolExecutor`) — e.g. `order-processor-1`, `order-processor-2`.

## Daemon Threads

A **daemon thread** is a background thread that **doesn't keep the JVM alive**. When only daemon threads remain, the JVM exits — abruptly stopping them.

```java
Thread heartbeat = new Thread(() -> {
    while (true) {
        System.out.println("heartbeat");
        sleepQuietly(1000);
    }
});
heartbeat.setDaemon(true);   // must be set BEFORE start()
heartbeat.start();
```

| User (non-daemon) thread | Daemon thread |
| --- | --- |
| JVM waits for it to finish | JVM doesn't wait — kills it on exit |
| Default for threads created by `main` | Inherited from a daemon parent, or set explicitly |
| Business work | Background support: GC, monitoring, cache cleanup |

> [!WARNING]
> Daemon threads can be killed mid-operation — `finally` blocks may **not** run, and files or transactions may be left half-written. Never use daemon threads for work that must complete. `setDaemon()` after `start()` throws `IllegalThreadStateException`. (Virtual threads are always daemon threads.)

## Thread Priorities

```java
thread.setPriority(Thread.MAX_PRIORITY);   // 10; MIN_PRIORITY = 1, NORM_PRIORITY = 5
```

Priorities are only a **hint** to the OS scheduler — many platforms largely ignore them. Never rely on priorities for correctness or ordering.

## Exceptions in Threads

An exception thrown in another thread does **not** propagate to the thread that started it:

```java
try {
    new Thread(() -> { throw new IllegalStateException("boom"); }).start();
} catch (Exception e) {
    System.out.println("Never printed");   // the exception happens on another thread
}
```

```output
Exception in thread "Thread-0" java.lang.IllegalStateException: boom
```

The uncaught exception terminates only that thread and is printed to `System.err`. Install a handler to log it properly:

```java
Thread worker = new Thread(task, "report-worker");
worker.setUncaughtExceptionHandler((t, e) ->
        log.error("Thread {} failed", t.getName(), e));
worker.start();

// Or a JVM-wide default
Thread.setDefaultUncaughtExceptionHandler((t, e) -> log.error("Uncaught in {}", t.getName(), e));
```

> [!NOTE]
> With executors, `execute()` sends exceptions to the uncaught-exception handler, but `submit()` **captures** them inside the returned `Future` — they surface only when you call `future.get()`. A `submit()` whose `Future` is never read silently swallows failures.

## Runnable vs Callable — a Preview

| Runnable | Callable&lt;V&gt; |
| --- | --- |
| `void run()` | `V call() throws Exception` |
| No result | Returns a result |
| Can't throw checked exceptions | Can throw checked exceptions |
| Accepted by `Thread` and executors | Accepted by executors (not by `Thread` directly) |

`Callable` and `Future` are covered in the Executor Framework chapter.

## Why Not Create Threads Manually in Production?

```java
// Anti-pattern: one new thread per request
@PostMapping("/orders")
public void create(@RequestBody Order order) {
    new Thread(() -> process(order)).start();
}
```

- Under load this creates **unbounded** threads and can exhaust memory (`OutOfMemoryError: unable to create native thread`).
- Thread creation cost is paid on every request.
- There's no way to limit, queue, monitor or shut down the work.
- Exceptions disappear into `System.err`.

Use an **`ExecutorService`** (or Spring's `@Async` with a configured pool) instead — or, on Java 21, virtual threads.

## Interview Questions

### Q1. What are the ways to create a thread?

Extend `Thread` and override `run()`, or implement `Runnable` (or `Callable`) and pass it to a `Thread` or an executor. Java 21 adds `Thread.ofPlatform()` / `Thread.ofVirtual()` builders. In practice, tasks are submitted to an `ExecutorService`.

### Q2. Why is implementing Runnable preferred over extending Thread?

It keeps your single superclass free, separates the task from the threading mechanism, and works with executors and `CompletableFuture`.

### Q3. What happens if you call run() instead of start()?

`run()` executes on the current thread like an ordinary method — no new thread is created.

### Q4. Can you start a thread twice?

No — the second `start()` throws `IllegalThreadStateException`.

### Q5. What is a daemon thread?

A background thread that doesn't prevent the JVM from exiting. The JVM kills daemon threads when all user threads have finished; `setDaemon(true)` must be called before `start()`.

### Q6. How do you handle exceptions thrown inside a thread?

Catch them inside `run()`, or set an `UncaughtExceptionHandler` on the thread (or globally). With executors, use `Future.get()` to see exceptions from `submit()`.

## Common Mistakes

- ❌ **Calling `run()` instead of `start()`** — nothing runs concurrently.
- ❌ **Starting the same `Thread` object twice.**
- ❌ **Leaving threads unnamed** — thread dumps full of `Thread-37` are impossible to debug.
- ❌ **Using daemon threads for important work** — they're killed without running `finally`.
- ❌ **Relying on priorities or on output order** — both are up to the scheduler.
- ❌ **Creating a new thread per request** in a server.

## Best Practices

- ✅ Implement `Runnable` / `Callable` and submit tasks to an executor.
- ✅ Give every thread a meaningful name.
- ✅ Catch exceptions inside tasks or install an `UncaughtExceptionHandler` that logs them.
- ✅ Use daemon threads only for disposable background work.
- ✅ Never assume any ordering between threads unless you enforce it.

## Key Takeaways

- ✅ Define work with `Runnable` (or `Callable`), not by extending `Thread`.
- ✅ `start()` creates a new thread; `run()` is a plain method call.
- ✅ A thread can be started only once.
- ✅ Daemon threads don't keep the JVM alive and can die mid-work.
- ✅ Exceptions in a thread don't reach the caller — handle or log them explicitly.
- ✅ Production code uses executors or virtual threads instead of manual `new Thread()`.
