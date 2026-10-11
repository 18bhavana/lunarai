---
title: Concurrency in Spring — @Async, synchronized & @Scheduled
subtitle: synchronized vs @Async, enabling and configuring @Async, return types, the self-invocation trap, exception handling, context and transaction propagation, @Scheduled, and thread safety of Spring beans.
order: 18
---

## Introduction

> [!NOTE]
> **Interview importance:** high. "Difference between `synchronized` and `@Async`" and "why isn't my `@Async` method running asynchronously?" come up constantly in Spring interviews.

Spring applications use concurrency in two very different ways: **protecting shared state** (the Java `synchronized` keyword and the tools from earlier chapters) and **running work in the background** (Spring's `@Async`). They solve opposite problems and are often confused.

## synchronized vs @Async

The core difference is **purpose**:

- **`synchronized`** is for **concurrency control / thread safety** — making threads take turns on shared data.
- **`@Async`** is for **asynchronous execution** — running a method on a different thread so the caller doesn't wait.

### synchronized (Java Keyword)

| Feature | Description |
| --- | --- |
| **Purpose** | **Mutual exclusion** — only one thread at a time executes the synchronized method or block **on a given object** |
| **Execution** | **Synchronous and blocking.** The calling thread acquires the lock, runs the code, releases the lock. Other threads trying to enter code synchronized on the *same object* wait |
| **Mechanism** | The object's **intrinsic (monitor) lock** for instance methods/blocks, or the `Class` object's lock for static ones |
| **Goal** | **Data integrity and consistency** of shared mutable state |
| **Use case** | Protecting shared resources — updating a counter, adding to a shared list, modifying an object's state |
| **Context** | Core Java language feature |

```java
public synchronized void increment() {
    count++;
}
```

> [!NOTE]
> `synchronized` is a **keyword**, not an annotation — there's no `@Synchronized` in Java or Spring. (Lombok provides an `@Synchronized` annotation, which generates a synchronized block on a private lock object.)

### @Async (Spring Annotation)

| Feature | Description |
| --- | --- |
| **Purpose** | Run a method **in a separate thread**; the caller is **not blocked** and continues immediately |
| **Execution** | **Asynchronous and non-blocking** for the caller. The method is handed to a thread pool (a `TaskExecutor`) |
| **Mechanism** | A Spring **proxy** intercepts the call and submits it to a `TaskExecutor` |
| **Goal** | Responsiveness, throughput and scalability by offloading long-running or independent work |
| **Use case** | Work that's slow and whose result isn't needed immediately — sending emails, generating reports, calling external APIs, audit logging |
| **Context** | Spring feature — requires `@EnableAsync` |

```java
@Async
public void sendEmail(String to, String body) {
    mailClient.send(to, body);
}
```

### Summary

| | `synchronized` | `@Async` |
| --- | --- | --- |
| Goal | **Thread safety** — one at a time | **Concurrency** — run in the background |
| Caller | Blocks (and may wait for the lock) | Returns immediately |
| What's used | Intrinsic object/class lock | A `TaskExecutor` thread pool |
| Threads | Makes multiple threads take turns on a critical section — each still runs on its own thread | Moves the work to a **different** worker thread, freeing the caller |
| Use where | Critical sections that modify shared data | Long-running tasks that shouldn't block the main flow |

**In short:** use `synchronized` when multiple threads access the **same resource** and you must prevent corruption — you're fixing a concurrency *problem*. Use `@Async` when you want work to happen **in parallel** so the application is faster and more responsive — you're using concurrency for a performance *gain*. They're complementary: an `@Async` method that touches shared state still needs proper synchronization.

## Enabling @Async

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "emailExecutor")
    public ThreadPoolTaskExecutor emailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(500);                     // bounded
        executor.setThreadNamePrefix("email-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
```

```java
@Service
public class NotificationService {

    @Async("emailExecutor")          // run on the named pool
    public void sendWelcomeEmail(User user) {
        mailClient.send(user.getEmail(), "Welcome!");
    }
}
```

### Which Executor Does @Async Use by Default?

| Setup | Default executor |
| --- | --- |
| Spring Boot (2.1+) | An auto-configured `ThreadPoolTaskExecutor` named `applicationTaskExecutor` (threads `task-1`, `task-2`…) — tune with `spring.task.execution.pool.*` |
| Spring Boot 3.2+ with `spring.threads.virtual.enabled=true` | A virtual-thread executor |
| Plain Spring without a `TaskExecutor` bean | `SimpleAsyncTaskExecutor` — creates a **new thread for every call** (no reuse, no limit) |

```properties
spring.task.execution.pool.core-size=8
spring.task.execution.pool.max-size=32
spring.task.execution.pool.queue-capacity=1000
spring.task.execution.thread-name-prefix=async-
```

> [!WARNING]
> Boot's default `applicationTaskExecutor` has an **unbounded queue** unless you set `queue-capacity` — and with an unbounded queue, `max-size` never takes effect (see the ThreadPoolExecutor chapter). Configure it explicitly for production.

## Return Types

| Return type | Behaviour |
| --- | --- |
| `void` | Fire and forget; exceptions go to the `AsyncUncaughtExceptionHandler` |
| `CompletableFuture<T>` | Caller gets a future to compose or wait on — **preferred** |
| `Future<T>` | Older style; `get()` blocks |

```java
@Async("ioExecutor")
public CompletableFuture<Price> fetchPrice(String sku) {
    return CompletableFuture.completedFuture(pricingClient.get(sku));
}
```

```java
CompletableFuture<Price> price = pricingService.fetchPrice(sku);
CompletableFuture<Stock> stock = inventoryService.fetchStock(sku);
ProductView view = price.thenCombine(stock, ProductView::new).join();
```

Inside the `@Async` method you return an already-completed future; the proxy gives the caller a different future that completes when the method finishes on the pool thread.

## The Self-Invocation Trap

`@Async` works through a **proxy**, so it only applies when the method is called **from another bean**:

```java
@Service
public class OrderService {

    public void placeOrder(Order order) {
        save(order);
        sendConfirmation(order);   // ❌ runs synchronously — 'this' bypasses the proxy
    }

    @Async
    public void sendConfirmation(Order order) { ... }
}
```

```flow-h
Controller
Spring proxy — applies @Async
OrderService
this.sendConfirmation() — no proxy, no @Async
```

**Fixes:** move the async method to a separate bean (cleanest); or inject the bean into itself lazily (`@Lazy` self-injection). The same rule applies to `@Transactional` and `@Cacheable`.

Other conditions for `@Async` to work:

- The method must be **public** (and not `final`, for class-based CGLIB proxies).
- The bean must be a Spring-managed bean — `new OrderService()` has no proxy.
- `@EnableAsync` must be present.

## Exception Handling

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                log.error("Async method {} failed", method.getName(), ex);
    }
}
```

| Return type | Where exceptions go |
| --- | --- |
| `void` | `AsyncUncaughtExceptionHandler` (by default only logged) |
| `CompletableFuture` / `Future` | Stored in the future — handle with `exceptionally`, `handle`, or `get()` |

## Transactions and @Async

An `@Async` method runs on a different thread, and Spring transactions are **bound to the thread** (`ThreadLocal`):

- It does **not** join the caller's transaction.
- If it's also `@Transactional`, it gets a **new** transaction on the pool thread.
- It may run **before the caller's transaction commits** — and not see the data the caller just saved.

```java
@Transactional
public void register(User user) {
    userRepository.save(user);
    emailService.sendWelcome(user.getId());   // @Async — may query the user before commit!
}
```

**Fix:** trigger async work after commit with `@TransactionalEventListener(phase = AFTER_COMMIT)`, combined with `@Async` on the listener.

## Propagating Context

`SecurityContext`, MDC (logging correlation IDs), locale and request attributes live in `ThreadLocal`s and **don't** automatically reach the async thread. Copy them with a `TaskDecorator`:

```java
executor.setTaskDecorator(runnable -> {
    Map<String, String> mdc = MDC.getCopyOfContextMap();
    SecurityContext security = SecurityContextHolder.getContext();
    return () -> {
        try {
            if (mdc != null) MDC.setContextMap(mdc);
            SecurityContextHolder.setContext(security);
            runnable.run();
        } finally {
            MDC.clear();
            SecurityContextHolder.clearContext();
        }
    };
});
```

Spring Security's `DelegatingSecurityContextAsyncTaskExecutor` and Micrometer context propagation do this for you.

## @Scheduled

```java
@Configuration
@EnableScheduling
public class SchedulingConfig { }

@Component
public class CacheRefresher {

    @Scheduled(fixedRate = 300_000)            // every 5 minutes, measured from start times
    public void refreshCache() { ... }

    @Scheduled(fixedDelay = 30_000)            // 30 s after the previous run finishes
    public void pollInbox() { ... }

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Kolkata")   // 02:00 every day
    public void nightlyReport() { ... }
}
```

> [!WARNING]
> Spring's default scheduler has **one thread**, so a slow `@Scheduled` job delays every other job. Increase `spring.task.scheduling.pool.size`. And in a cluster, every instance runs the job — use a distributed lock (e.g. ShedLock) if it must run only once.

## Thread Safety of Spring Beans

| Scope | Shared by threads? | Guidance |
| --- | --- | --- |
| `singleton` (default) | ✅ Every request thread | Keep **stateless**: no mutable instance fields; use locals, immutable config, thread-safe collaborators |
| `prototype` | Each injection gets a new instance — but that instance may still be shared by whoever holds it | Not a thread-safety tool by itself |
| `request` / `session` | One per HTTP request / session | Request-scoped state (via proxy) |

```java
@Service
public class PricingService {
    private final PricingClient client;          // ✅ immutable dependency
    private final Map<String, Price> cache =
            new ConcurrentHashMap<>();           // ✅ thread-safe shared cache
    private BigDecimal lastPrice;                // ❌ mutable, shared by all requests
}
```

## Interview Questions

### Q1. What is the difference between synchronized and @Async?

`synchronized` is a Java keyword for thread safety: it makes threads take turns executing a critical section on the same lock, and the caller blocks. `@Async` is a Spring annotation for asynchronous execution: the call is handed to a thread pool and the caller continues immediately. One prevents concurrency problems; the other uses concurrency for performance.

### Q2. Why is my @Async method running synchronously?

Most often self-invocation — calling it via `this` bypasses the proxy. Other causes: missing `@EnableAsync`, a non-public method, or an object not managed by Spring.

### Q3. What executor does @Async use by default?

In Spring Boot, the auto-configured `ThreadPoolTaskExecutor` (`applicationTaskExecutor`), or virtual threads if enabled. In plain Spring without a configured executor, `SimpleAsyncTaskExecutor`, which creates a new thread per task.

### Q4. How do you return a value from an @Async method?

Return `CompletableFuture<T>` (for example `CompletableFuture.completedFuture(result)`); the caller receives a future that completes when the method finishes.

### Q5. How are exceptions handled in @Async methods?

For `void` methods, through an `AsyncUncaughtExceptionHandler` (configure via `AsyncConfigurer`). For future-returning methods, the exception completes the future exceptionally.

### Q6. Does an @Async method run in the caller's transaction?

No. Transactions are thread-bound; the async method runs on another thread, outside the caller's transaction, and may start its own.

### Q7. Are Spring singleton beans thread-safe?

Spring doesn't make them thread-safe — they're shared by all threads. They're safe only if they're stateless or their state is immutable or properly synchronized.

## Common Mistakes

- ❌ **Calling an `@Async` method from the same class.**
- ❌ **Forgetting `@EnableAsync`.**
- ❌ **Relying on `SimpleAsyncTaskExecutor`** or an unbounded queue in production.
- ❌ **Using `@Async` to "fix" a race condition** — it doesn't protect shared state.
- ❌ **Expecting the async method to see uncommitted data** or join the caller's transaction.
- ❌ **Losing MDC / security context** in async threads.
- ❌ **Mutable fields in singleton beans.**
- ❌ **Long `@Scheduled` jobs on the single default scheduler thread.**

## Best Practices

- ✅ Define named, bounded `ThreadPoolTaskExecutor` beans per workload and reference them in `@Async("name")`.
- ✅ Return `CompletableFuture` from async methods whose result or failure matters.
- ✅ Configure an `AsyncUncaughtExceptionHandler` for `void` async methods.
- ✅ Put async methods in separate beans to avoid self-invocation.
- ✅ Use `@TransactionalEventListener(AFTER_COMMIT)` for work that must follow a commit.
- ✅ Propagate context with a `TaskDecorator`.
- ✅ Keep singleton beans stateless.

## Key Takeaways

- ✅ `synchronized` = thread safety (take turns); `@Async` = background execution (don't wait).
- ✅ `@Async` needs `@EnableAsync`, a public method and a call through the Spring proxy.
- ✅ Configure a bounded executor — defaults can be unbounded or thread-per-task.
- ✅ Return `CompletableFuture` to get results and failures back.
- ✅ Async methods run outside the caller's transaction and `ThreadLocal` context.
- ✅ Singleton beans are shared by all threads — keep them stateless.
