---
title: Explicit Locks — ReentrantLock, ReadWriteLock & StampedLock
subtitle: The Lock interface, lock/unlock in try-finally, tryLock and lockInterruptibly, fairness, Condition variables, ReentrantReadWriteLock, StampedLock optimistic reads, and synchronized vs ReentrantLock.
order: 8
---

## Introduction

`synchronized` is simple but inflexible: you can't time out while waiting, can't respond to interrupts while blocked, can't check whether a lock is free, and have only one wait set per lock. The `java.util.concurrent.locks` package (Java 5) adds **explicit locks** that solve all of these.

## The Lock Interface

| Method | Behaviour |
| --- | --- |
| `lock()` | Acquire, waiting as long as necessary (not interruptible) |
| `lockInterruptibly()` | Acquire, but abort with `InterruptedException` if interrupted while waiting |
| `tryLock()` | Acquire only if free right now; returns `true`/`false` immediately |
| `tryLock(time, unit)` | Wait up to a timeout; interruptible |
| `unlock()` | Release |
| `newCondition()` | Create a `Condition` (a separate wait set) bound to this lock |

## ReentrantLock

```java
class Counter {
    private final ReentrantLock lock = new ReentrantLock();
    private int count;

    public void increment() {
        lock.lock();
        try {
            count++;
        } finally {
            lock.unlock();     // ALWAYS in finally
        }
    }
}
```

> [!IMPORTANT]
> Unlike `synchronized`, an explicit lock is **not released automatically**. If an exception is thrown between `lock()` and `unlock()` and there's no `finally`, the lock stays held forever and every other thread blocks. Call `lock()` just **before** the `try`, so a failed `lock()` doesn't run `unlock()` on a lock you don't hold.

Like intrinsic locks, `ReentrantLock` is **reentrant** — the owning thread can lock it again, and must unlock it the same number of times. `getHoldCount()`, `isLocked()` and `isHeldByCurrentThread()` help with debugging and assertions.

### tryLock — Don't Wait Forever

```java
if (lock.tryLock(500, TimeUnit.MILLISECONDS)) {
    try {
        updateInventory();
    } finally {
        lock.unlock();
    }
} else {
    throw new ServiceBusyException("Inventory is busy, try again");
}
```

Useful for deadlock avoidance (see the previous chapter) and for failing fast under contention instead of piling up blocked request threads.

### lockInterruptibly — Cancellable Waiting

```java
lock.lockInterruptibly();   // a thread blocked here can be cancelled with interrupt()
try {
    process();
} finally {
    lock.unlock();
}
```

A thread blocked on `synchronized` or `lock()` ignores interrupts until it gets the lock; `lockInterruptibly()` lets executors cancel it (`shutdownNow()`, `future.cancel(true)`).

### Fairness

```java
ReentrantLock fairLock = new ReentrantLock(true);
```

| Unfair (default) | Fair |
| --- | --- |
| A newly arriving thread may "barge" ahead of waiting threads | Longest-waiting thread gets the lock next |
| Much higher throughput | Lower throughput |
| Possible starvation | Prevents starvation |

Use fairness only when starvation is a real problem — the throughput cost is significant. (Note: `tryLock()` without a timeout ignores fairness.)

## Condition Variables

A `Condition` is like `wait`/`notify`, but a lock can have **several** of them — so producers and consumers can wait in separate queues:

```java
class BoundedBuffer<T> {
    private final Queue<T> items = new ArrayDeque<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    BoundedBuffer(int capacity) { this.capacity = capacity; }

    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (items.size() == capacity) {
                notFull.await();          // producers wait here
            }
            items.add(item);
            notEmpty.signal();            // wake exactly one consumer
        } finally {
            lock.unlock();
        }
    }

    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (items.isEmpty()) {
                notEmpty.await();         // consumers wait here
            }
            T item = items.remove();
            notFull.signal();             // wake exactly one producer
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

| `Object` monitor | `Condition` |
| --- | --- |
| `wait()` | `await()` |
| `notify()` | `signal()` |
| `notifyAll()` | `signalAll()` |
| One wait set per object | Many conditions per lock |

The same rules apply: hold the lock, and `await()` in a `while` loop. This is essentially how `ArrayBlockingQueue` is implemented.

## ReentrantReadWriteLock

Many workloads are **read-heavy** — a cache read thousands of times per second and refreshed occasionally. An exclusive lock makes readers wait for each other needlessly. A read-write lock allows **many concurrent readers or one writer**:

```java
class ProductCache {
    private final Map<Long, Product> cache = new HashMap<>();
    private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock();
    private final Lock readLock  = rw.readLock();
    private final Lock writeLock = rw.writeLock();

    public Product get(long id) {
        readLock.lock();              // many threads can hold this at once
        try {
            return cache.get(id);
        } finally {
            readLock.unlock();
        }
    }

    public void put(long id, Product p) {
        writeLock.lock();             // exclusive: waits for all readers to leave
        try {
            cache.put(id, p);
        } finally {
            writeLock.unlock();
        }
    }
}
```

| Held | Another read lock? | Another write lock? |
| --- | --- | --- |
| Read lock(s) | ✅ Allowed | ❌ Blocks |
| Write lock | ❌ Blocks | ❌ Blocks |

> [!WARNING]
> **Upgrading** a read lock to a write lock is **not supported** — a thread holding the read lock that calls `writeLock().lock()` deadlocks itself. **Downgrading** (acquire write, then read, then release write) is allowed. Also, a read-write lock only pays off when reads clearly dominate and critical sections aren't tiny; for a simple map, `ConcurrentHashMap` is usually better.

## StampedLock

`StampedLock` (Java 8) adds **optimistic reads** — a read that takes no lock at all, then validates that no write happened:

```java
class Point {
    private double x, y;
    private final StampedLock sl = new StampedLock();

    double distanceFromOrigin() {
        long stamp = sl.tryOptimisticRead();     // no locking
        double cx = x, cy = y;
        if (!sl.validate(stamp)) {               // a write happened — fall back
            stamp = sl.readLock();
            try {
                cx = x;
                cy = y;
            } finally {
                sl.unlockRead(stamp);
            }
        }
        return Math.hypot(cx, cy);
    }

    void move(double dx, double dy) {
        long stamp = sl.writeLock();
        try {
            x += dx;
            y += dy;
        } finally {
            sl.unlockWrite(stamp);
        }
    }
}
```

Very fast for read-mostly data, but `StampedLock` is **not reentrant**, has no `Condition` support, and is easy to misuse. Use it only for measured hot spots.

## synchronized vs ReentrantLock

| Feature | `synchronized` | `ReentrantLock` |
| --- | --- | --- |
| Syntax | Keyword; block structured | API calls; must `unlock()` in `finally` |
| Automatic release | ✅ On block exit or exception | ❌ Manual |
| Reentrant | ✅ | ✅ |
| Try without blocking / timeout | ❌ | ✅ `tryLock()`, `tryLock(timeout)` |
| Interruptible while waiting | ❌ | ✅ `lockInterruptibly()` |
| Fairness option | ❌ | ✅ |
| Multiple wait sets | ❌ One per monitor | ✅ Many `Condition`s |
| Lock across methods | ❌ Must be in one block | ✅ Lock in one method, unlock in another (use carefully) |
| Inspection | `Thread.holdsLock()` only | `isLocked()`, `getQueueLength()`, … |
| Performance | Comparable on modern JVMs | Comparable |

> [!TIP]
> **Default to `synchronized`** — it's simpler and can't leak a lock. Reach for `ReentrantLock` when you need a timeout, interruptibility, fairness or multiple conditions. Before Java 24, `ReentrantLock` was also preferred with virtual threads because `synchronized` pinned the carrier thread; JDK 24 (JEP 491) removed that limitation.

## Interview Questions

### Q1. What is the difference between synchronized and ReentrantLock?

Both are reentrant mutual-exclusion locks with the same memory semantics. `ReentrantLock` adds `tryLock` (with timeout), interruptible locking, optional fairness and multiple `Condition`s, but must be unlocked manually in `finally`. `synchronized` is simpler and releases automatically.

### Q2. Why must unlock() be in a finally block?

Because an explicit lock isn't released on exceptions. Without `finally`, an exception leaves the lock held forever and blocks every other thread.

### Q3. What is a fair lock?

A lock that grants access in roughly first-come-first-served order to the longest-waiting thread, preventing starvation at the cost of throughput.

### Q4. What is a ReadWriteLock and when do you use it?

A pair of locks allowing many concurrent readers or one exclusive writer. Use it for read-heavy data with infrequent writes and non-trivial read sections.

### Q5. Can you upgrade a read lock to a write lock in ReentrantReadWriteLock?

No — it deadlocks. Release the read lock first, then acquire the write lock (and re-check state). Downgrading from write to read is supported.

### Q6. What is a Condition?

A wait set associated with a `Lock`, providing `await()`, `signal()` and `signalAll()`. A lock can have several conditions, allowing different kinds of waiters to be signalled separately.

### Q7. What is StampedLock's optimistic read?

A read that takes no lock: it gets a stamp, reads the fields, then calls `validate(stamp)`. If a write occurred, it falls back to a real read lock.

## Common Mistakes

- ❌ **Forgetting `unlock()`**, or not putting it in `finally`.
- ❌ **Calling `lock()` inside the `try`** — if `lock()` fails, `finally` calls `unlock()` on a lock you don't hold.
- ❌ **Trying to upgrade a read lock to a write lock.**
- ❌ **Using fair locks by default** — large throughput loss for no benefit.
- ❌ **Calling `await()`/`signal()` without holding the lock** → `IllegalMonitorStateException`.
- ❌ **Using `StampedLock` reentrantly** — it isn't reentrant and will deadlock.

## Best Practices

- ✅ Use `synchronized` unless you need a feature only `Lock` provides.
- ✅ Always follow the `lock(); try { … } finally { unlock(); }` idiom.
- ✅ Use `tryLock(timeout)` on request paths where blocking indefinitely is unacceptable.
- ✅ Use separate `Condition`s for different wait reasons.
- ✅ Measure before introducing read-write or stamped locks; consider concurrent collections first.

## Key Takeaways

- ✅ `ReentrantLock` adds timeouts, interruptibility, fairness and multiple conditions to what `synchronized` offers.
- ✅ Explicit locks must be released in `finally`.
- ✅ `Condition` gives each wait reason its own queue — precise signalling instead of `notifyAll()`.
- ✅ `ReentrantReadWriteLock` lets readers share; writers are exclusive; upgrading deadlocks.
- ✅ `StampedLock` offers lock-free optimistic reads for read-mostly hot spots.
