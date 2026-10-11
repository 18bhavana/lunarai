---
title: Deadlock, Livelock & Starvation
subtitle: How deadlocks form, the four Coffman conditions, lock ordering, tryLock with timeout and other prevention strategies, detecting deadlocks with thread dumps, and livelock and starvation.
order: 7
---

## Introduction

> [!NOTE]
> **Interview importance:** very high. "How do you prevent deadlock in a multithreaded application?" is one of the most common senior Java questions.

Locks fix race conditions but introduce a new class of failures: threads that **stop making progress**. The three liveness problems are **deadlock** (threads wait for each other forever), **livelock** (threads stay busy but achieve nothing) and **starvation** (a thread never gets the resource it needs).

## What Is a Deadlock?

A deadlock occurs when two or more threads each hold a lock and wait for a lock held by another, forming a **cycle** — so none of them can ever continue.

```java
class Account {
    private int balance;

    void withdraw(int amount) { balance -= amount; }
    void deposit(int amount)  { balance += amount; }
}

void transfer(Account from, Account to, int amount) {
    synchronized (from) {
        synchronized (to) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
```

```java
// Thread 1
transfer(accountA, accountB, 100);

// Thread 2 — at the same time
transfer(accountB, accountA, 50);
```

| Step | Thread 1 | Thread 2 |
| --- | --- | --- |
| 1 | Locks **A** | Locks **B** |
| 2 | Waits for **B** (held by Thread 2) | Waits for **A** (held by Thread 1) |
| 3 | Waits forever | Waits forever |

```refs
Thread 1 -> Holds A | waits for B
Thread 2 -> Holds B | waits for A
```

Both threads are `BLOCKED` permanently. The JVM does **not** resolve Java-level deadlocks — the threads stay stuck until the process restarts.

## The Four Coffman Conditions

A deadlock can happen only if **all four** conditions hold at once:

| Condition | Meaning | In the example |
| --- | --- | --- |
| **Mutual exclusion** | A resource can be held by only one thread at a time | Each monitor has one owner |
| **Hold and wait** | A thread holds one resource while waiting for another | Holds A, waits for B |
| **No preemption** | A resource can't be forcibly taken from its holder | Monitors can't be taken away |
| **Circular wait** | A cycle of threads, each waiting for the next | 1 → 2 → 1 |

> [!IMPORTANT]
> **Break any one condition and deadlock becomes impossible.** Every prevention technique below breaks one of them.

## Strategies to Prevent Deadlock

### 1. Impose a Global Lock Order — Breaks Circular Wait

Always acquire multiple locks in the **same order** everywhere — for example, by a unique ID:

```java
void transfer(Account from, Account to, int amount) {
    Account first  = from.getId() < to.getId() ? from : to;
    Account second = from.getId() < to.getId() ? to   : from;

    synchronized (first) {
        synchronized (second) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
```

Both threads now lock the lower-ID account first, so no cycle can form. This is the most common and most reliable technique (a **lock hierarchy**).

### 2. Use tryLock with a Timeout — Breaks Hold and Wait

`ReentrantLock.tryLock()` lets a thread give up instead of waiting forever:

```java
boolean transfer(Account from, Account to, int amount) throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);

    while (System.nanoTime() < deadline) {
        if (from.lock.tryLock()) {
            try {
                if (to.lock.tryLock()) {
                    try {
                        from.withdraw(amount);
                        to.deposit(amount);
                        return true;
                    } finally {
                        to.lock.unlock();
                    }
                }
            } finally {
                from.lock.unlock();     // release what we hold and retry
            }
        }
        Thread.sleep(ThreadLocalRandom.current().nextInt(1, 10));   // random back-off avoids livelock
    }
    return false;   // couldn't get both locks in time
}
```

If the second lock isn't available, the thread **releases the first** and retries, so it never holds one lock while waiting indefinitely for another.

### 3. Avoid Nested Locks

Design so that a thread needs only **one lock at a time** where possible. For example, update each account in its own transaction step, or route all changes to one account through a single owner thread or queue.

### 4. Keep Lock Hold Time Short

Never perform I/O, remote calls or long computations while holding a lock. The shorter locks are held, the smaller the window for contention and deadlock.

### 5. Don't Call Alien Methods While Holding a Lock

Calling listeners, callbacks or overridable methods inside `synchronized` code is dangerous — you don't know which locks *they* take. Copy the data you need, release the lock, then call out ("open calls").

### 6. Use Immutable Objects and Lock-Free Structures

Immutable objects need no locks at all, and concurrent collections and atomics (`ConcurrentHashMap`, `AtomicReference`) avoid holding multiple locks.

### 7. Use Higher-Level Concurrency Utilities

Well-tested tools — concurrent queues, executors, `CompletableFuture` — reduce hand-written locking and therefore deadlock opportunities.

### 8. Test, Analyse and Document

- Stress-test concurrent code under load to expose deadlocks before production.
- Document the lock-acquisition order and which lock guards which data, so other developers don't introduce inconsistent ordering.

## Detecting Deadlocks

### Thread Dumps

```bash
jstack <pid>
```

```output jstack output (excerpt)
Found one Java-level deadlock:
=============================
"Thread-1":
  waiting to lock monitor 0x000001 (object 0x7a1, a com.bank.Account),
  which is held by "Thread-0"
"Thread-0":
  waiting to lock monitor 0x000002 (object 0x7b2, a com.bank.Account),
  which is held by "Thread-1"
```

`jcmd <pid> Thread.print`, VisualVM, JConsole and Spring Boot Actuator's `/actuator/threaddump` endpoint show the same information.

### Programmatically

```java
ThreadMXBean bean = ManagementFactory.getThreadMXBean();
long[] ids = bean.findDeadlockedThreads();   // monitors and ownable synchronizers
if (ids != null) {
    for (ThreadInfo info : bean.getThreadInfo(ids, true, true)) {
        log.error("Deadlocked thread: {}", info);
    }
}
```

> [!NOTE]
> Databases behave differently: InnoDB **detects** deadlocks between transactions and rolls one back with an error, so the application should retry. The JVM does no such thing for Java locks — prevention is the only cure.

## Livelock

In a **livelock**, threads aren't blocked — they keep **reacting to each other** and retrying, but none makes progress. Like two people in a corridor who both step aside the same way, again and again.

```java
// Both threads repeatedly back off and retry in lock-step
while (true) {
    if (lockA.tryLock()) {
        try {
            if (lockB.tryLock()) { /* ... */ }
        } finally {
            lockA.unlock();
        }
    }
    // ❌ immediate retry with no delay — both threads may collide forever
}
```

**Fix:** add **randomized back-off** (as in strategy 2), or establish a priority so one party always yields.

## Starvation

**Starvation** happens when a thread is perpetually denied a resource it needs, while other threads keep getting it:

| Cause | Example |
| --- | --- |
| Unfair locks | A thread repeatedly loses the race for a busy lock |
| Greedy threads | One thread holds a lock for a very long time in a loop |
| Thread priorities | Low-priority threads rarely scheduled (platform-dependent) |
| Pool exhaustion | All pool threads busy with long tasks; short tasks wait indefinitely |

**Fixes:** fair locks (`new ReentrantLock(true)`), short critical sections, separate thread pools for slow and fast work, and not relying on priorities.

## Deadlock vs Livelock vs Starvation

| | Deadlock | Livelock | Starvation |
| --- | --- | --- | --- |
| Thread state | `BLOCKED` / `WAITING` | `RUNNABLE` — busy | Waiting or runnable |
| CPU usage | None | High | Varies |
| Progress | None, for all involved | None, for all involved | Others progress; the victim doesn't |
| Typical fix | Lock ordering, `tryLock` | Random back-off | Fairness, shorter lock holds |

## Thread-Pool Deadlock

A sneaky variant: tasks in a bounded pool that **wait for other tasks submitted to the same pool**.

```java
ExecutorService pool = Executors.newFixedThreadPool(2);

Future<String> outer = pool.submit(() -> {
    Future<String> inner = pool.submit(() -> "inner result");
    return inner.get();     // ❌ waits for a task that needs a free thread from the same pool
});
```

If every pool thread is running an outer task waiting on an inner task, the inner tasks never get a thread. Use separate pools for dependent tasks, or compose with `CompletableFuture` instead of blocking `get()` calls.

## Interview Questions

### Q1. What is a deadlock?

A situation where two or more threads each hold a resource and wait for a resource held by another, forming a cycle so none can proceed.

### Q2. What are the necessary conditions for deadlock?

The four Coffman conditions: mutual exclusion, hold and wait, no preemption and circular wait. All must hold simultaneously.

### Q3. How do you prevent deadlock in a multithreaded application?

Acquire locks in a consistent global order; use `tryLock` with a timeout and release held locks on failure; avoid nested locks and alien calls under locks; keep lock hold times short; use immutable objects and high-level concurrency utilities; and stress-test and document locking strategies.

### Q4. How do you detect a deadlock?

Take a thread dump (`jstack`, `jcmd Thread.print`, Actuator `/threaddump`) — the JVM reports Java-level deadlocks — or call `ThreadMXBean.findDeadlockedThreads()`.

### Q5. What is the difference between deadlock and livelock?

In deadlock, threads are blocked and do nothing. In livelock, threads are active and keep responding to each other but still make no progress.

### Q6. What is starvation?

A thread being unable to make progress because other threads keep getting the resources it needs — for example, an unfair lock or a pool saturated with long-running tasks.

## Common Mistakes

- ❌ **Acquiring the same locks in different orders** in different code paths.
- ❌ **Calling external code (callbacks, listeners, remote services) while holding a lock.**
- ❌ **Blocking on tasks submitted to the same bounded pool.**
- ❌ **Retrying `tryLock` without random back-off** — turning a deadlock into a livelock.
- ❌ **Assuming the JVM will detect and break the deadlock** — it won't.

## Best Practices

- ✅ Define and document a global lock order.
- ✅ Hold as few locks as possible, for as short a time as possible.
- ✅ Use timed lock acquisition (`tryLock(timeout)`) where blocking forever is unacceptable.
- ✅ Prefer immutable data, concurrent collections and message passing over shared locks.
- ✅ Monitor production with thread dumps and alerts on `findDeadlockedThreads()`.

## Key Takeaways

- ✅ Deadlock needs mutual exclusion, hold-and-wait, no preemption and circular wait — break one to prevent it.
- ✅ Consistent lock ordering is the simplest and most reliable prevention.
- ✅ `tryLock` with timeout and back-off avoids indefinite waiting.
- ✅ Thread dumps reveal deadlocks; the JVM won't resolve them.
- ✅ Livelock is busy non-progress; starvation is one thread repeatedly losing out.
