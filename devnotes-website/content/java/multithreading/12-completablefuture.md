---
title: CompletableFuture
subtitle: Asynchronous pipelines without blocking — supplyAsync, thenApply vs thenCompose, thenCombine, allOf and anyOf, exception handling, timeouts, async variants, custom executors, and a parallel API-aggregation example.
order: 12
---

## Introduction

> [!NOTE]
> **Interview importance:** very high. `CompletableFuture` is the standard way to compose asynchronous work in modern Java and Spring.

A plain `Future` can only be **waited on** with a blocking `get()`. You can't say "when this finishes, transform the result, then call another service, then combine it with a third result" without tying up a thread. **`CompletableFuture`** (Java 8) implements both `Future` and `CompletionStage`, letting you build **non-blocking pipelines** of dependent steps.

## Future vs CompletableFuture

| `Future` | `CompletableFuture` |
| --- | --- |
| Only `get()` (blocking), `isDone()`, `cancel()` | Callbacks: `thenApply`, `thenAccept`, `thenCompose`… |
| Can't chain dependent steps | Builds pipelines of dependent stages |
| Can't combine several futures without blocking | `thenCombine`, `allOf`, `anyOf` |
| Exceptions only via `get()` | `exceptionally`, `handle`, `whenComplete` |
| Can't be completed manually | `complete()`, `completeExceptionally()` |

## Creating a CompletableFuture

```java
// Returns a value
CompletableFuture<User> userFuture =
        CompletableFuture.supplyAsync(() -> userClient.fetch(userId));

// No value
CompletableFuture<Void> auditFuture =
        CompletableFuture.runAsync(() -> auditLog.record(event));

// Already completed (handy in tests and caches)
CompletableFuture<String> done = CompletableFuture.completedFuture("cached");
```

> [!WARNING]
> Without an executor argument, `supplyAsync` and `runAsync` run on the **common `ForkJoinPool`** — shared with parallel streams and sized to `cores − 1`. Blocking I/O there (HTTP calls, JDBC) quickly starves the whole JVM. For I/O, **always pass your own executor**:

```java
ExecutorService ioPool = Executors.newFixedThreadPool(20);   // or a bounded ThreadPoolExecutor / virtual threads

CompletableFuture<User> userFuture =
        CompletableFuture.supplyAsync(() -> userClient.fetch(userId), ioPool);
```

## Transforming and Consuming Results

| Method | Input → Output | Use for |
| --- | --- | --- |
| `thenApply(fn)` | `T → U` | Transform the result (like `map`) |
| `thenAccept(consumer)` | `T → void` | Consume the result |
| `thenRun(runnable)` | `() → void` | Run something after, ignoring the result |
| `thenCompose(fn)` | `T → CompletableFuture<U>` | Chain **another async call** that depends on the result (like `flatMap`) |
| `thenCombine(other, fn)` | `(T, U) → V` | Combine two **independent** futures |

```java
CompletableFuture<String> greeting = CompletableFuture
        .supplyAsync(() -> userClient.fetch(42), ioPool)   // User
        .thenApply(User::getName)                          // String
        .thenApply(name -> "Hello, " + name);              // String

greeting.thenAccept(System.out::println);
```

### thenApply vs thenCompose

```java
// thenApply with an async function → a nested future
CompletableFuture<CompletableFuture<List<Order>>> nested =
        userFuture.thenApply(user -> orderClient.fetchAsync(user.getId()));

// thenCompose flattens it
CompletableFuture<List<Order>> orders =
        userFuture.thenCompose(user -> orderClient.fetchAsync(user.getId()));
```

| `thenApply` | `thenCompose` |
| --- | --- |
| Function returns a **plain value** | Function returns a **CompletableFuture** |
| Like `Stream.map` / `Optional.map` | Like `flatMap` |
| Use for synchronous transformations | Use to chain **dependent async calls** |

### thenCombine — Two Independent Calls in Parallel

```java
CompletableFuture<Price> price = CompletableFuture.supplyAsync(() -> pricing.get(sku), ioPool);
CompletableFuture<Stock> stock = CompletableFuture.supplyAsync(() -> inventory.get(sku), ioPool);

CompletableFuture<ProductView> view =
        price.thenCombine(stock, (p, s) -> new ProductView(sku, p, s));
```

Both calls run **at the same time**; the total time is the slower of the two, not the sum.

## Waiting for Many Futures

### allOf — Wait for All

```java
List<CompletableFuture<Quote>> quotes = suppliers.stream()
        .map(s -> CompletableFuture.supplyAsync(() -> s.quote(item), ioPool))
        .toList();

CompletableFuture<List<Quote>> allQuotes = CompletableFuture
        .allOf(quotes.toArray(new CompletableFuture[0]))      // CompletableFuture<Void>
        .thenApply(v -> quotes.stream()
                .map(CompletableFuture::join)                 // all done — join() won't block
                .toList());
```

`allOf` returns `CompletableFuture<Void>` — it only signals completion, so you collect the results from the original futures. If any future fails, `allOf` completes exceptionally.

### anyOf — First to Complete

```java
CompletableFuture<Object> fastest = CompletableFuture.anyOf(mirrorA, mirrorB, mirrorC);
```

`anyOf` completes with whichever finishes first — including an **exceptional** completion — and returns `Object`, so a cast is needed. The other futures are **not** cancelled automatically.

## Exception Handling

An exception in any stage skips the following transformation stages and propagates down the chain until a handler deals with it.

| Method | Called when | Can change the result? |
| --- | --- | --- |
| `exceptionally(fn)` | Only on failure | ✅ Returns a fallback value |
| `handle((result, ex) -> …)` | Always | ✅ Returns a new value either way |
| `whenComplete((result, ex) -> …)` | Always | ❌ Side effects only (logging); the original outcome passes through |

```java
CompletableFuture<Price> price = CompletableFuture
        .supplyAsync(() -> pricing.get(sku), ioPool)
        .exceptionally(ex -> {
            log.warn("Pricing failed for {}, using list price", sku, ex);
            return Price.listPrice(sku);
        });

CompletableFuture<String> status = CompletableFuture
        .supplyAsync(() -> payment.charge(order), ioPool)
        .handle((receipt, ex) -> ex == null ? "PAID" : "PAYMENT_FAILED");

CompletableFuture<Order> logged = placeOrderAsync(order)
        .whenComplete((o, ex) -> {
            if (ex != null) log.error("Order failed", ex);
        });
```

> [!NOTE]
> Inside handlers, the exception is usually wrapped in a **`CompletionException`** — use `ex.getCause()` to reach the original. `get()` throws checked `ExecutionException`; `join()` throws unchecked `CompletionException`.

## Timeouts (Java 9+)

```java
CompletableFuture<Price> price = CompletableFuture
        .supplyAsync(() -> pricing.get(sku), ioPool)
        .orTimeout(2, TimeUnit.SECONDS);                               // fails with TimeoutException

CompletableFuture<Price> priceOrDefault = CompletableFuture
        .supplyAsync(() -> pricing.get(sku), ioPool)
        .completeOnTimeout(Price.listPrice(sku), 2, TimeUnit.SECONDS);  // falls back to a default
```

> [!WARNING]
> A timeout completes the **future**, but doesn't stop the underlying work — `cancel(true)` on a `CompletableFuture` does **not** interrupt the running thread. Also set timeouts on the HTTP/JDBC client itself so the thread is actually freed.

## Async Variants and Which Thread Runs What

Each callback method has three forms:

| Form | Runs the callback on |
| --- | --- |
| `thenApply(fn)` | The thread that completed the previous stage — or the **calling** thread if it was already complete |
| `thenApplyAsync(fn)` | The common ForkJoinPool |
| `thenApplyAsync(fn, executor)` | The executor you provide |

Use the `…Async(fn, executor)` form when the callback itself is slow or blocking, so it doesn't run on an unexpected thread.

## get() vs join()

| `get()` | `join()` |
| --- | --- |
| Throws checked `InterruptedException` and `ExecutionException` | Throws unchecked `CompletionException` |
| Has a timeout overload `get(timeout, unit)` | No timeout (use `orTimeout`) |
| Interruptible | Not interruptible |

Both **block**. Use them only at the edge of the system (for example, at the end of a controller method or in tests) — never in the middle of a pipeline.

## Completing Manually

```java
CompletableFuture<Payment> future = new CompletableFuture<>();

paymentGateway.onCallback(result -> {
    if (result.isSuccess()) future.complete(result.payment());
    else future.completeExceptionally(new PaymentException(result.error()));
});

return future;   // callers can compose on it immediately
```

Useful for adapting callback-based APIs to `CompletableFuture`.

## Real-World Example: Aggregating a Product Page

```java
@Service
public class ProductPageService {

    private final Executor ioExecutor;   // a bounded ThreadPoolTaskExecutor bean

    public ProductPage load(String sku) {
        CompletableFuture<Product> product = CompletableFuture
                .supplyAsync(() -> catalog.get(sku), ioExecutor);

        CompletableFuture<Price> price = CompletableFuture
                .supplyAsync(() -> pricing.get(sku), ioExecutor)
                .completeOnTimeout(Price.unavailable(), 500, TimeUnit.MILLISECONDS);

        CompletableFuture<List<Review>> reviews = CompletableFuture
                .supplyAsync(() -> reviewClient.top(sku), ioExecutor)
                .exceptionally(ex -> List.of());           // reviews are optional

        return product
                .thenCombine(price, ProductPage::new)
                .thenCombine(reviews, ProductPage::withReviews)
                .orTimeout(2, TimeUnit.SECONDS)
                .join();
    }
}
```

Three remote calls run in parallel; the page needs about the time of the slowest call instead of the sum, and optional data degrades gracefully.

> [!TIP]
> Spring MVC controllers can return a `CompletableFuture<T>` directly — the request thread is released and the response is written when the future completes.

## Interview Questions

### Q1. What is CompletableFuture and how is it different from Future?

A `Future` that can be completed and composed. Unlike `Future`, it supports non-blocking callbacks (`thenApply`, `thenCompose`), combining futures (`thenCombine`, `allOf`), exception handling (`exceptionally`, `handle`) and manual completion.

### Q2. What is the difference between thenApply and thenCompose?

`thenApply` transforms the result with a function returning a value. `thenCompose` chains a function that returns another `CompletableFuture`, flattening it — used for dependent async calls.

### Q3. How do you run several calls in parallel and wait for all of them?

Start each with `supplyAsync`, combine with `CompletableFuture.allOf(...)`, then collect each result with `join()` inside `thenApply`.

### Q4. How do you handle exceptions?

`exceptionally` for a fallback on failure, `handle` to map success or failure to a new value, and `whenComplete` for side effects like logging without changing the outcome.

### Q5. Which thread pool does supplyAsync use by default, and why does it matter?

The common `ForkJoinPool`, which is small and shared JVM-wide. Blocking I/O there can starve parallel streams and other async tasks, so pass a dedicated executor for I/O work.

### Q6. What is the difference between get() and join()?

Both block. `get()` throws checked exceptions and supports a timeout; `join()` throws an unchecked `CompletionException`.

### Q7. Does cancel(true) interrupt the running task?

No. For `CompletableFuture`, `cancel` just completes it with a `CancellationException`; the computation keeps running.

## Common Mistakes

- ❌ **Blocking I/O on the common ForkJoinPool** (no executor argument).
- ❌ **Calling `join()`/`get()` in the middle of a pipeline** — defeats the purpose and can deadlock a bounded pool.
- ❌ **Using `thenApply` with a function that returns a future** — nested `CompletableFuture<CompletableFuture<T>>`.
- ❌ **Forgetting to handle exceptions** — a failed future nobody observes fails silently.
- ❌ **Assuming `anyOf` or timeouts cancel the other work.**
- ❌ **No timeouts** on remote calls.

## Best Practices

- ✅ Always provide a dedicated, bounded executor for I/O-bound async work.
- ✅ Use `thenCompose` for dependent calls and `thenCombine` / `allOf` for independent ones.
- ✅ Attach `exceptionally` or `handle` to every pipeline whose result matters.
- ✅ Apply `orTimeout` / `completeOnTimeout`, plus client-level timeouts.
- ✅ Block only at the boundary — or return the future to Spring MVC.
- ✅ Propagate context (MDC, security, tracing) explicitly — it doesn't follow async stages automatically.

## Key Takeaways

- ✅ `CompletableFuture` builds non-blocking pipelines of asynchronous stages.
- ✅ `thenApply` maps, `thenCompose` flat-maps, `thenCombine` merges two independent results.
- ✅ `allOf` waits for all, `anyOf` for the first.
- ✅ `exceptionally`, `handle` and `whenComplete` handle failures.
- ✅ The default executor is the common ForkJoinPool — use your own for I/O.
- ✅ `orTimeout` and `completeOnTimeout` add timeouts but don't stop the underlying work.
