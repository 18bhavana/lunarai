---
title: Race Conditions & synchronized
subtitle: Shared mutable state, why count++ isn't atomic, critical sections, synchronized methods and blocks, object vs class locks, reentrancy, and the hidden race in Spring singleton beans.
order: 4
---

## Introduction

> [!NOTE]
> **Interview importance:** very high. "What is a race condition and how do you fix it?" is asked in almost every Java interview.

When two threads read and write the same mutable data without coordination, the result depends on the exact timing of their steps — a **race condition**. This chapter shows how races happen, why even `count++` is unsafe, and how the `synchronized` keyword fixes them.

## A Race Condition in Action

```java
class Counter {
    private int count = 0;

    public void increment() {
        count++;
    }

    public int getCount() {
        return count;
    }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        Counter counter = new Counter();

        Runnable task = () -> {
            for (int i = 0; i < 100_000; i++) {
                counter.increment();
            }
        };

        Thread t1 = new Thread(task);
        Thread t2 = new Thread(task);
        t1.start();
        t2.start();
        t1.join();
        t2.join();

        System.out.println(counter.getCount());
    }
}
```

```output Expected 200000 — but typically
137492
```

The result changes from run to run and is almost never 200,000.

## Why count++ Is Not Atomic

`count++` looks like one operation but is really **three**:

```flow-h
Read count from memory
Add 1
Write count back
```

When two threads interleave these steps, one update is lost:

| Step | Thread A | Thread B | count in memory |
| --- | --- | --- | --- |
| 1 | reads 5 | | 5 |
| 2 | | reads 5 | 5 |
| 3 | adds 1 → 6 | | 5 |
| 4 | | adds 1 → 6 | 5 |
| 5 | writes 6 | | 6 |
| 6 | | writes 6 | **6** — one increment lost |

This pattern is called **read-modify-write**. The other classic race pattern is **check-then-act**:

```java
// Check-then-act race: two threads can both see "not present" and both insert
if (!cache.containsKey(key)) {
    cache.put(key, loadValue(key));
}
```

## Key Terms

| Term | Meaning |
| --- | --- |
| **Shared mutable state** | Data that more than one thread can see **and** that can change |
| **Race condition** | Correctness depends on the relative timing of threads |
| **Critical section** | Code that accesses shared state and must not run in two threads at once |
| **Atomic** | An operation that happens completely or not at all, with no visible intermediate state |
| **Thread-safe** | A class behaves correctly when used from multiple threads without extra synchronization by callers |
| **Mutual exclusion** | Only one thread at a time may execute a critical section |

> [!TIP]
> No shared state, or no **mutable** shared state, means **no race**. Before reaching for locks, ask whether the data can be made local, immutable or confined to one thread.

## The synchronized Keyword

Every Java object has an **intrinsic lock** (also called a **monitor**). `synchronized` makes a thread acquire that lock before entering a block of code, and release it when leaving — giving mutual exclusion **and** memory visibility.

### synchronized Methods

```java
class Counter {
    private int count = 0;

    public synchronized void increment() {   // locks on 'this'
        count++;
    }

    public synchronized int getCount() {     // reads must be synchronized too
        return count;
    }
}
```

Now the program always prints **200000**.

```flow
Thread A acquires the Counter's lock
Thread B tries to enter — BLOCKED
Thread A increments and releases the lock
Thread B acquires the lock and increments
```

> [!IMPORTANT]
> The **reader** (`getCount()`) must also be synchronized (or the field `volatile`). Synchronizing only the writer still allows a reader to see a stale value — see the Java Memory Model chapter.

### synchronized Blocks

Lock only the part that needs it, which keeps the critical section short:

```java
public void placeOrder(Order order) {
    validate(order);                 // no shared state — runs concurrently

    synchronized (this) {            // critical section
        inventory.reserve(order);
        orderCount++;
    }

    sendConfirmationEmail(order);    // slow I/O outside the lock
}
```

### Using a Private Lock Object

```java
class Inventory {
    private final Object lock = new Object();
    private int stock;

    public void reserve(int qty) {
        synchronized (lock) {
            if (stock < qty) throw new IllegalStateException("Out of stock");
            stock -= qty;
        }
    }
}
```

A **private final** lock can't be locked by outside code, so no other class can accidentally (or maliciously) hold your lock and stall you. `synchronized (this)` and synchronized methods use a lock that any caller holding a reference can also grab.

## Object Locks vs Class Locks

| | Instance (object) lock | Class lock |
| --- | --- | --- |
| Declared by | `synchronized` instance method or `synchronized (this)` | `static synchronized` method or `synchronized (MyClass.class)` |
| Lock object | That particular instance | The `Class` object — one per class |
| Protects | Instance fields | Static fields |
| Two threads on **different** instances | Run concurrently | Block each other |

```java
class IdGenerator {
    private static long nextId = 1;

    public static synchronized long next() {   // locks IdGenerator.class
        return nextId++;
    }
}
```

> [!WARNING]
> A `static synchronized` method and an instance `synchronized` method use **different locks**, so they don't exclude each other. If both touch the same static field, the data is not protected.

## Rules of synchronized

- Only one thread at a time can hold a given object's lock; others **block** (`BLOCKED` state).
- Threads synchronizing on **different objects** don't block each other — every thread must lock **the same object** to protect the same data.
- The lock is released when the block exits **normally or by an exception**.
- You can't synchronize on a primitive, and `synchronized (null)` throws `NullPointerException`.
- Constructors can't be `synchronized` (and don't need to be — the object isn't shared yet, unless `this` escapes).

### Don't Synchronize on These

```java
synchronized ("LOCK") { }          // ❌ string literals are interned and shared JVM-wide
synchronized (Integer.valueOf(1))  // ❌ boxed values are cached and shared
synchronized (count) { count++; }  // ❌ reassigning the field changes the lock object
```

## Reentrancy

Intrinsic locks are **reentrant** — a thread that already holds a lock can acquire it again:

```java
class Account {
    public synchronized void transfer(Account to, int amount) {
        withdraw(amount);    // also synchronized on 'this' — no self-deadlock
        to.deposit(amount);
    }

    public synchronized void withdraw(int amount) { ... }
    public synchronized void deposit(int amount) { ... }
}
```

The JVM keeps a hold count per lock; the lock is released only when the count returns to zero. Without reentrancy, a synchronized method calling another synchronized method on the same object would deadlock itself. (`transfer` locking two accounts can still deadlock *with another thread* — see the deadlock chapter.)

## Compound Actions Need One Lock

Making each method of a class thread-safe doesn't make **sequences** of calls atomic:

```java
List<String> list = Collections.synchronizedList(new ArrayList<>());

// ❌ Each call is synchronized, but the check-then-act sequence is not
if (!list.contains("x")) {
    list.add("x");
}

// ✅ Hold the same lock for the whole compound action
synchronized (list) {
    if (!list.contains("x")) {
        list.add("x");
    }
}
```

Iterating a synchronized collection also requires holding its lock for the entire loop.

## Race Conditions in Spring Applications

Spring beans are **singletons by default** — one instance shared by every request thread:

```java
@Service
public class ReportService {

    private int processedCount;                         // ❌ shared by all requests
    private final SimpleDateFormat format =
            new SimpleDateFormat("yyyy-MM-dd");         // ❌ not thread-safe

    public String generate(Report r) {
        processedCount++;                               // lost updates under load
        return format.format(r.getDate());              // corrupted output
    }
}
```

Fixes:

- Keep services **stateless** — use local variables and method parameters.
- Use thread-safe types: `AtomicInteger` for counters, `DateTimeFormatter` (immutable) instead of `SimpleDateFormat`.
- For data shared across **instances of your service** (several pods), an in-memory lock is useless — use the database (row locks, optimistic locking with `@Version`) or a distributed lock.

## Cost of synchronized

Uncontended `synchronized` is cheap on modern JVMs. The cost is **contention**: when many threads want the same lock, they queue up and the critical section becomes a bottleneck. Keep critical sections short, never do I/O or remote calls inside them, and consider finer-grained locks, `ReentrantReadWriteLock`, atomics or concurrent collections for hot paths.

## Interview Questions

### Q1. What is a race condition?

A bug where the program's result depends on the timing or interleaving of threads accessing shared mutable state — for example, two threads incrementing a counter and losing an update.

### Q2. Why is count++ not thread-safe?

It's a read-modify-write of three steps (read, add, write). Two threads can read the same value and both write back the same result, losing an increment.

### Q3. What does synchronized guarantee?

Mutual exclusion — only one thread holding a given lock runs the critical section — and visibility: changes made before releasing a lock are visible to the next thread that acquires the same lock.

### Q4. What is the difference between a synchronized method and a synchronized block?

A synchronized instance method locks `this` for the whole method (a static one locks the class). A block lets you choose the lock object and protect only the lines that need it, which reduces contention.

### Q5. What is the difference between an object lock and a class lock?

An object lock belongs to one instance and protects instance state; a class lock belongs to the `Class` object and protects static state. They're independent locks.

### Q6. Are intrinsic locks reentrant?

Yes. A thread holding a lock can re-enter any code synchronized on the same lock; the JVM tracks a hold count.

### Q7. Can two threads execute two different synchronized methods of the same object at the same time?

No — both methods lock the same object (`this`). They can if one is `static synchronized` (class lock) and the other is an instance method, or if they're on different objects.

## Common Mistakes

- ❌ **Synchronizing only the writer** and leaving reads unsynchronized.
- ❌ **Locking on different objects** for the same data — e.g. `synchronized (new Object())`, which locks a fresh object every time.
- ❌ **Synchronizing on string literals, boxed integers or a field that gets reassigned.**
- ❌ **Doing slow I/O or remote calls inside a synchronized block.**
- ❌ **Assuming a thread-safe collection makes compound actions atomic.**
- ❌ **Mutable fields in Spring singleton beans.**

## Best Practices

- ✅ Minimize shared mutable state: prefer local variables, immutable objects and stateless services.
- ✅ Guard each piece of shared state with **one** clearly documented lock.
- ✅ Keep critical sections as short as possible.
- ✅ Prefer a `private final` lock object over `synchronized (this)` in library-style code.
- ✅ Use `java.util.concurrent` (atomics, concurrent collections) instead of hand-written locking where it fits.

## Key Takeaways

- ✅ A race condition happens when threads interleave on shared mutable state — typically read-modify-write or check-then-act.
- ✅ `count++` is three steps and isn't atomic.
- ✅ `synchronized` provides mutual exclusion and visibility using an object's intrinsic lock.
- ✅ Instance methods lock `this`, static methods lock the `Class` object — they're different locks.
- ✅ Intrinsic locks are reentrant.
- ✅ Compound actions need one lock around the whole sequence.
