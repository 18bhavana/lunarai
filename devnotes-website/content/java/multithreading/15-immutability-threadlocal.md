---
title: Immutability, Thread Confinement & ThreadLocal
subtitle: Why immutable objects are thread-safe, how Java supports immutability, thread confinement, ThreadLocal and its memory-leak trap in thread pools, InheritableThreadLocal, and Scoped Values.
order: 15
---

## Introduction

The most reliable way to avoid concurrency bugs is to **not share mutable state at all**. There are two ways to do that: make shared data **immutable**, or keep mutable data **confined to one thread**. This chapter covers both — and `ThreadLocal`, Java's built-in tool for per-thread state.

## Immutability and Multithreading

Java uses immutability to guarantee that certain objects, once created, can't be changed. That's critical for safe, efficient multithreading: if data can't change, multiple threads can't corrupt it or read it in an inconsistent state.

### How Java Supports Immutability

- **Built-in immutable classes** — `String`, the wrapper types (`Integer`, `Long`…), `BigDecimal`, `BigInteger` and the `java.time` classes (`LocalDate`, `Instant`, `Duration`). Their state is set at creation and never changes.
- **Records** — previewed in Java 14 and **final in Java 16**. A record's fields are `private final`, set once in the constructor, with no setters.
- **Unmodifiable collections** — `List.of()`, `Set.of()`, `Map.of()` (Java 9) and `List.copyOf()` (Java 10).
- **Custom immutable classes** — make the class `final`, all fields `private final`, provide no setters, and **defensively copy** mutable inputs and outputs.

```java
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;
    private final List<String> tags;

    public Money(BigDecimal amount, Currency currency, List<String> tags) {
        this.amount = amount;
        this.currency = currency;
        this.tags = List.copyOf(tags);           // defensive copy — caller can't mutate it later
    }

    public Money add(Money other) {              // "modification" returns a new object
        return new Money(amount.add(other.amount), currency, tags);
    }

    public BigDecimal amount() { return amount; }
    public List<String> tags() { return tags; }  // already unmodifiable
}
```

> [!NOTE]
> A record is only **shallowly** immutable: `record Order(List<Item> items)` stores whatever list you pass in. Copy mutable components in a compact constructor — `items = List.copyOf(items);` — to make it truly immutable.

### Why Immutability Matters for Concurrency

- **Thread safety** — immutable objects are inherently thread-safe; any number of threads can read them simultaneously without locks, which reduces complexity and improves performance.
- **No race conditions** — nothing can be written after construction, so there are no conflicting writes.
- **Visibility guarantees** — the Java Memory Model guarantees that **`final` fields** are fully visible to all threads once the constructor finishes (provided `this` didn't escape during construction), so no thread sees stale or half-built state.
- **Easier reasoning** — no need to track who might change an object, or when.
- **Safe hash keys** — objects whose state never changes keep a stable `hashCode()`, so they're safe as `HashMap` keys.
- **Free sharing and caching** — `Integer.valueOf()` caches small values and string literals are interned precisely because they're immutable.

`String` is the textbook example: methods that *seem* to modify it (`concat()`, `toUpperCase()`, `replace()`) return **new** strings. Many threads can share the same string safely, and its hash code is computed once and cached.

> [!TIP]
> Immutability doesn't remove the need to coordinate **which** object is current. To share changing state, keep immutable snapshots in a `volatile` field or an `AtomicReference` and swap the whole object (see the JMM and atomics chapters).

## Thread Confinement

If only one thread ever accesses an object, it needs no synchronization even if it's mutable:

| Technique | Example |
| --- | --- |
| **Stack confinement** | Local variables and objects that never escape a method |
| **One owner thread** | A single consumer thread owns a mutable state machine; others send it messages through a queue |
| **`ThreadLocal`** | Each thread gets its own separate instance |

```java
public String format(List<Order> orders) {
    StringBuilder sb = new StringBuilder();   // confined to this call — no sharing, no locking
    for (Order o : orders) sb.append(o.id()).append(',');
    return sb.toString();
}
```

## ThreadLocal

`ThreadLocal<T>` gives **each thread its own independent copy** of a variable:

```java
public final class RequestContext {

    private static final ThreadLocal<String> CORRELATION_ID = new ThreadLocal<>();

    public static void set(String id) { CORRELATION_ID.set(id); }
    public static String get()        { return CORRELATION_ID.get(); }
    public static void clear()        { CORRELATION_ID.remove(); }
}
```

```java
// Each thread holds a different value under the same ThreadLocal
Thread a = new Thread(() -> { RequestContext.set("req-A"); System.out.println(RequestContext.get()); });
Thread b = new Thread(() -> { RequestContext.set("req-B"); System.out.println(RequestContext.get()); });
```

```output
req-A
req-B
```

### How It Works

```tree
Thread A
  ThreadLocalMap | CORRELATION_ID → "req-A"
Thread B
  ThreadLocalMap | CORRELATION_ID → "req-B"
```

Each `Thread` object has its own `ThreadLocalMap`. The `ThreadLocal` instance is only the **key**; `get()` looks the value up in the **current thread's** map.

### Common Uses

| Use | Example |
| --- | --- |
| Per-request context | Correlation IDs, tenant ID, current user |
| Framework internals | Spring `SecurityContextHolder`, `TransactionSynchronizationManager`, `RequestContextHolder`; SLF4J **MDC** |
| Non-thread-safe helpers | One `SimpleDateFormat` per thread (`ThreadLocal.withInitial(...)`) — though `DateTimeFormatter` is the better fix |

```java
private static final ThreadLocal<SimpleDateFormat> FORMAT =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));
```

## The ThreadLocal Trap in Thread Pools

Pool threads **live forever** and run many tasks. A value set by one task stays in the thread's map and is still there for the **next task** on that thread:

```flow
Request 1 on exec-1 sets tenant = ACME
Request 1 finishes without remove()
Request 2 on exec-1 reads tenant — still ACME
Request 2 reads another tenant's data
```

Two consequences:

1. **Data leaks between requests** — wrong user, wrong tenant, wrong correlation ID in logs. A serious security bug.
2. **Memory leaks** — large values (or values whose classes belong to a redeployed web app) are never released while the thread lives.

### Always Clean Up in finally

```java
@Component
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        RequestContext.set(Optional.ofNullable(req.getHeader("X-Correlation-Id"))
                .orElse(UUID.randomUUID().toString()));
        try {
            chain.doFilter(req, res);
        } finally {
            RequestContext.clear();   // ALWAYS — the thread goes back to the pool
        }
    }
}
```

> [!IMPORTANT]
> `ThreadLocal` values **don't follow your work to other threads**. Code running in `@Async` methods, `CompletableFuture.supplyAsync` or a different executor sees **empty** values (no security context, no MDC). Copy the values explicitly when handing off work — for example with a Spring `TaskDecorator`, `DelegatingSecurityContextExecutor`, or Micrometer context propagation.

## InheritableThreadLocal

`InheritableThreadLocal` copies the parent thread's value into a **child thread when the child is created**:

```java
private static final InheritableThreadLocal<String> USER = new InheritableThreadLocal<>();
```

It doesn't work as expected with thread pools: pool threads are created once, so they inherit whatever value existed then — not the value of the thread submitting each task. Prefer explicit propagation.

## Scoped Values (Java 25)

**Scoped values** (`ScopedValue`, finalized in Java 25 after several previews) are a modern alternative for passing **immutable** context down a call chain:

```java
private static final ScopedValue<String> TENANT = ScopedValue.newInstance();

ScopedValue.where(TENANT, "acme").run(() -> {
    handleRequest();           // TENANT.get() returns "acme" anywhere inside this call
});
// outside the run() block TENANT is unbound again — nothing to clean up
```

| `ThreadLocal` | `ScopedValue` |
| --- | --- |
| Mutable — `set()` anywhere | Immutable within its scope |
| Lives until `remove()` or thread death | Automatically unbound when the scope ends |
| Leaks easily in pools | Can't leak past its scope |
| Costly with millions of virtual threads | Designed for virtual threads and structured concurrency |

## Interview Questions

### Q1. Why are immutable objects thread-safe?

Their state can't change after construction, so there are no conflicting writes, and `final` fields are guaranteed visible to all threads once the constructor completes. Threads can share them without any synchronization.

### Q2. How do you create an immutable class?

Make the class `final`; make all fields `private final`; provide no setters; initialize everything in the constructor; defensively copy mutable inputs and never expose internal mutable objects; return new objects for "modifications". Or use a record with defensive copies of mutable components.

### Q3. What is ThreadLocal?

A variable for which each thread has its own independent value, stored in the thread's own `ThreadLocalMap`. It's used for per-thread context such as the current user, transaction or correlation ID.

### Q4. What's the risk of using ThreadLocal with thread pools?

Pool threads are reused, so values not removed leak into later tasks (wrong user or tenant) and may cause memory leaks. Always call `remove()` in a `finally` block.

### Q5. Why doesn't the security context or MDC appear in my @Async method?

Because they're stored in `ThreadLocal`s on the request thread, and the `@Async` method runs on a different pool thread. They must be propagated explicitly, for example with a `TaskDecorator`.

### Q6. What are Scoped Values?

A Java 25 feature for sharing immutable data with code called within a bounded scope. Values are automatically unbound when the scope ends and are efficient with virtual threads — a safer alternative to many `ThreadLocal` uses.

## Common Mistakes

- ❌ **"Immutable" classes that expose mutable internals** — returning the internal `List` or `Date`.
- ❌ **Records holding mutable collections** without copying them.
- ❌ **Letting `this` escape the constructor** — breaks the `final`-field visibility guarantee.
- ❌ **Forgetting `ThreadLocal.remove()`** in pooled threads.
- ❌ **Expecting `ThreadLocal` values in async code** running on other threads.
- ❌ **Using `InheritableThreadLocal` with thread pools.**

## Best Practices

- ✅ Make value objects, DTOs and configuration immutable (records, `List.copyOf`).
- ✅ Prefer local variables and stateless services — confinement is free thread safety.
- ✅ Use `ThreadLocal` sparingly, always with a `try/finally` that calls `remove()`.
- ✅ Propagate context explicitly across thread boundaries.
- ✅ On Java 25+, consider `ScopedValue` for read-only request context.

## Key Takeaways

- ✅ Immutable objects are inherently thread-safe and need no locks.
- ✅ `final` fields of properly constructed objects are visible to every thread.
- ✅ Thread confinement — locals, single-owner threads, `ThreadLocal` — avoids sharing entirely.
- ✅ `ThreadLocal` gives each thread its own value; with pools, always `remove()` it.
- ✅ Context in `ThreadLocal`s doesn't cross into other threads automatically.
- ✅ Scoped Values (Java 25) are a leak-free, immutable alternative.
