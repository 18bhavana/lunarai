---
title: Java Memory Model & volatile
subtitle: Visibility and reordering problems, CPU caches, happens-before, what volatile does and doesn't guarantee, volatile vs synchronized, safe publication and double-checked locking.
order: 5
---

## Introduction

> [!NOTE]
> **Interview importance:** very high for senior roles. "volatile vs synchronized" and "why does double-checked locking need volatile?" are classic questions.

Race conditions are only half of the concurrency story. Even when only **one** thread writes, other threads may **never see** the write, or see writes in a different order. The **Java Memory Model (JMM)** defines exactly when one thread's writes become visible to another — and `volatile` is the lightest tool it gives you.

## The Visibility Problem

```java
class Worker {
    private boolean running = true;

    public void run() {
        while (running) {
            // do work
        }
        System.out.println("Stopped");
    }

    public void stop() {
        running = false;
    }
}
```

```java
Worker worker = new Worker();
new Thread(worker::run).start();

Thread.sleep(1000);
worker.stop();   // the worker thread may never stop!
```

The worker thread can loop **forever**. Nothing tells the JVM that `running` is shared, so it's allowed to keep the value in a register or CPU cache, or the JIT may hoist the read out of the loop entirely:

```java
// What the JIT is allowed to turn the loop into
if (running) {
    while (true) { }
}
```

## Why It Happens: Caches and Reordering

```tree
Main memory | the "real" value of running
  Core 1 cache | worker thread sees running = true
  Core 2 cache | main thread wrote running = false
```

Two hardware and compiler optimizations cause trouble:

| Optimization | Effect |
| --- | --- |
| **Caching** | Each core works on its own cached copy; a write may sit in one core's cache or store buffer before reaching main memory |
| **Reordering** | The compiler, JIT and CPU may reorder independent instructions for speed, as long as the result looks the same **to a single thread** |

Both are invisible in single-threaded code and both break multi-threaded code that has no synchronization.

### Reordering Example

```java
int value = 0;
boolean ready = false;

// Thread A
value = 42;
ready = true;

// Thread B
if (ready) {
    System.out.println(value);   // may print 0!
}
```

Thread A's two writes may be reordered (or become visible out of order), so Thread B can see `ready == true` but `value == 0`.

## Happens-Before

The JMM defines visibility through **happens-before** relationships. If action X *happens-before* action Y, then Y is guaranteed to see everything X (and anything before X in its thread) wrote.

| Rule | Happens-before edge |
| --- | --- |
| **Program order** | Each action in a thread happens-before later actions in the same thread |
| **Monitor lock** | Releasing a lock happens-before every later acquisition of **the same** lock |
| **volatile** | A write to a volatile field happens-before every later read of that field |
| **Thread start** | `t.start()` happens-before every action in `t` |
| **Thread join** | Every action in `t` happens-before another thread returns from `t.join()` |
| **Transitivity** | If A → B and B → C, then A → C |

`java.util.concurrent` classes add their own edges — for example, putting an item in a `BlockingQueue` happens-before taking it out, and completing a `Future` happens-before `get()` returns.

> [!IMPORTANT]
> Without a happens-before edge between a write and a read, **there is no guarantee the read sees the write — ever**. "It worked on my machine" proves nothing; x86 is relatively forgiving, ARM servers are not.

## volatile

Declaring a field `volatile` tells the JVM that it's shared between threads:

```java
class Worker {
    private volatile boolean running = true;   // fixed

    public void run() {
        while (running) { /* work */ }
    }

    public void stop() {
        running = false;
    }
}
```

`volatile` guarantees:

1. **Visibility** — every read sees the most recent write by any thread.
2. **Ordering** — writes made *before* a volatile write are visible to a thread that *reads* that volatile field (the happens-before rule). This also fixes the `value` / `ready` example: make `ready` volatile and Thread B is guaranteed to print 42.
3. **Atomic reads and writes of `long` and `double`** — non-volatile 64-bit values may otherwise be written in two 32-bit halves.

### What volatile Does NOT Do

`volatile` gives **no mutual exclusion**, so compound actions are still broken:

```java
private volatile int count = 0;

public void increment() {
    count++;   // ❌ still read-modify-write — still loses updates
}
```

Use `synchronized` or `AtomicInteger` for that.

## volatile vs synchronized

| Feature | `volatile` | `synchronized` |
| --- | --- | --- |
| Applies to | Fields only | Methods and blocks |
| Visibility | ✅ For that field (and writes before it) | ✅ For everything written inside the lock |
| Atomicity | Only single reads/writes — not `count++` | ✅ The whole critical section |
| Mutual exclusion | ❌ None | ✅ One thread at a time |
| Blocking | Never blocks | Threads may block waiting for the lock |
| Cost | Lightweight | Higher under contention |

### When to Use Each

**Use `volatile` when:**

- one thread writes and others only read (status flags, shutdown signals, configuration that is replaced as a whole);
- the new value doesn't depend on the old value;
- the variable isn't part of an invariant with other variables.

**Use `synchronized` (or a `Lock`) when:**

- updates depend on the current value (`count++`, `balance -= amount`);
- several variables must change together consistently;
- you need a check-then-act sequence to be atomic.

### A Common volatile Pattern — Publishing an Immutable Snapshot

```java
class ConfigHolder {
    private volatile Config current = Config.load();   // Config is immutable

    public Config get() {
        return current;
    }

    public void reload() {
        current = Config.load();   // readers see either the old or the new object, never a mix
    }
}
```

## Safe Publication

"Publishing" an object means making it reachable by other threads. Without a happens-before edge, another thread can see the reference **before** the constructor's writes — a partially constructed object.

Safe ways to publish:

- store it in a `volatile` field or an `AtomicReference`;
- store it in a field guarded by a lock;
- store it in a `final` field of a properly constructed object;
- put it in a concurrent collection (`ConcurrentHashMap`, `BlockingQueue`);
- initialize it in a static initializer.

> [!TIP]
> **`final` fields are special:** once a constructor finishes (and `this` didn't escape during construction), every thread sees the correct values of the object's `final` fields without synchronization. That's why properly built immutable objects are thread-safe.

## Double-Checked Locking

The classic lazily-initialized singleton:

```java
public class ConnectionManager {

    private static volatile ConnectionManager instance;   // volatile is essential

    private ConnectionManager() { }

    public static ConnectionManager getInstance() {
        ConnectionManager result = instance;
        if (result == null) {                       // 1st check — no lock
            synchronized (ConnectionManager.class) {
                result = instance;
                if (result == null) {               // 2nd check — with lock
                    instance = result = new ConnectionManager();
                }
            }
        }
        return result;
    }
}
```

### Why volatile Is Required

`instance = new ConnectionManager()` is roughly three steps — allocate memory, run the constructor, assign the reference — and steps 2 and 3 may be reordered. Without `volatile`, another thread can pass the first unsynchronized check, see a **non-null reference to an object whose constructor hasn't finished**, and use it. `volatile` forbids that reordering.

### Simpler Alternatives

```java
// Holder idiom: lazy, thread-safe, no volatile or locks — class init is guaranteed thread-safe
public class ConnectionManager {
    private ConnectionManager() { }

    private static class Holder {
        static final ConnectionManager INSTANCE = new ConnectionManager();
    }

    public static ConnectionManager getInstance() {
        return Holder.INSTANCE;
    }
}

// Enum singleton: thread-safe and serialization-safe
public enum Registry {
    INSTANCE;
}
```

In Spring applications, let the container manage singletons — you rarely need either pattern.

## Interview Questions

### Q1. What is the Java Memory Model?

The part of the Java Language Specification that defines how threads interact through memory — when writes by one thread are guaranteed to be visible to another, and which reorderings are allowed. It's expressed through happens-before rules.

### Q2. What does volatile do?

It guarantees visibility of the latest write to all threads, prevents reordering around the volatile access (writes before a volatile write are visible after a volatile read), and makes `long`/`double` reads and writes atomic. It provides no mutual exclusion.

### Q3. volatile vs synchronized — when do you use each?

`volatile` for simple flags or values written independently of their previous value, where only visibility matters. `synchronized` when updates are compound (`count++`), involve several variables, or need mutual exclusion.

### Q4. Is volatile int count; count++ thread-safe?

No — `count++` is read-modify-write; two threads can still read the same value. Use `AtomicInteger.incrementAndGet()` or `synchronized`.

### Q5. What is happens-before?

A guarantee that the effects of one action are visible to another. Examples: unlocking a monitor happens-before the next lock of it; a volatile write happens-before subsequent reads; `start()` happens-before the started thread's actions; a thread's actions happen-before `join()` returns.

### Q6. Why does double-checked locking need volatile?

Because object creation can be reordered so the reference is assigned before the constructor finishes. Without `volatile`, a thread skipping the lock could see a partially constructed object.

## Common Mistakes

- ❌ **Assuming a write is visible to other threads automatically** — without synchronization or `volatile`, it might never be.
- ❌ **Using `volatile` for counters** or other read-modify-write operations.
- ❌ **Double-checked locking without `volatile`.**
- ❌ **Letting `this` escape from a constructor** (registering listeners, starting threads) — other threads may see an unfinished object.
- ❌ **Relying on testing on x86** to prove visibility correctness.

## Best Practices

- ✅ Every shared mutable variable must be accessed under a lock, be `volatile`, or be an atomic/concurrent type.
- ✅ Use `volatile` for flags and for publishing immutable snapshots.
- ✅ Prefer immutable objects with `final` fields — they're safely visible by default.
- ✅ Prefer the holder idiom, an enum or the Spring container over hand-written double-checked locking.
- ✅ Lean on `java.util.concurrent`, whose classes document their memory-visibility guarantees.

## Key Takeaways

- ✅ Without happens-before, one thread's writes may be invisible or appear out of order to another.
- ✅ Locks, `volatile`, thread start/join and concurrent utilities create happens-before edges.
- ✅ `volatile` = visibility + ordering, **not** atomicity of compound actions.
- ✅ `synchronized` = mutual exclusion + visibility.
- ✅ `final` fields of properly constructed objects are visible to all threads.
- ✅ Double-checked locking requires `volatile`; the holder idiom is simpler.
