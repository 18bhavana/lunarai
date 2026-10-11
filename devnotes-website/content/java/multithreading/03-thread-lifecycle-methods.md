---
title: Thread Lifecycle & Thread Methods
subtitle: The six thread states, sleep(), join(), yield(), interrupt() and cooperative cancellation, sleep vs wait, and reading states in a thread dump.
order: 3
---

## Introduction

A thread moves through a fixed set of states from creation to termination. Knowing them — and the methods that move a thread between them — is essential for reading thread dumps, diagnosing hung applications and answering one of the most common interview questions.

## The Six Thread States

`Thread.getState()` returns one of the values of the `Thread.State` enum:

| State | Meaning |
| --- | --- |
| `NEW` | Created but `start()` not yet called |
| `RUNNABLE` | Running **or ready to run** — waiting only for a CPU (also covers threads blocked in native I/O) |
| `BLOCKED` | Waiting to **acquire a monitor lock** to enter a `synchronized` block/method |
| `WAITING` | Waiting **indefinitely** for another thread — `wait()`, `join()`, `LockSupport.park()` |
| `TIMED_WAITING` | Waiting with a timeout — `sleep(ms)`, `wait(ms)`, `join(ms)`, `parkNanos()` |
| `TERMINATED` | `run()` has finished, normally or with an exception |

```flow
NEW
: start()
RUNNABLE
: run() completes or throws
TERMINATED
```

From `RUNNABLE`, a thread can temporarily leave and come back:

| Transition out of RUNNABLE | Back to RUNNABLE when |
| --- | --- |
| → `BLOCKED` (entering `synchronized` while another thread holds the lock) | The lock is released and this thread acquires it |
| → `WAITING` (`wait()`, `join()`, `park()`) | `notify()`/`notifyAll()`, the joined thread ends, `unpark()` or an interrupt |
| → `TIMED_WAITING` (`sleep(ms)`, `wait(ms)`, `join(ms)`) | The timeout expires, or the same events as `WAITING` |

> [!NOTE]
> Java has **no separate "RUNNING" state**. The OS distinguishes *running* from *ready*, but to the JVM both are `RUNNABLE`. Many textbook diagrams show "Running" — that's an OS concept, not a `Thread.State` value.

```java
Thread t = new Thread(() -> sleepQuietly(500));
System.out.println(t.getState());   // NEW
t.start();
Thread.sleep(100);
System.out.println(t.getState());   // TIMED_WAITING
t.join();
System.out.println(t.getState());   // TERMINATED
```

## sleep()

`Thread.sleep(ms)` pauses the **current** thread for at least the given time:

```java
try {
    Thread.sleep(2000);   // TIMED_WAITING for ~2 seconds
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();   // restore the interrupt flag
}
```

- It's a **static** method — `someOtherThread.sleep(1000)` still sleeps the *current* thread.
- It does **not release any locks** the thread holds.
- The actual pause can be longer than requested (scheduling), never meaningfully shorter.

## join()

`join()` makes the current thread **wait until another thread finishes**:

```java
Thread loader = new Thread(() -> loadCache(), "cache-loader");
loader.start();

loader.join();          // main waits here (WAITING)
startServer();          // runs only after the cache is loaded

loader.join(5000);      // or wait at most 5 seconds (TIMED_WAITING)
```

```flow
main starts cache-loader
main calls loader.join()
cache-loader finishes
main continues
```

> [!TIP]
> In modern code, `Future.get()`, `CompletableFuture.join()`, `CountDownLatch` or `ExecutorService.invokeAll()` usually replace raw `join()`.

## yield()

`Thread.yield()` **hints** that the current thread is willing to give up the CPU so other runnable threads can run. The scheduler is free to ignore it. It's almost never needed in application code — don't use it for coordination.

## Interrupting Threads

Java has no safe way to forcibly kill a thread (`Thread.stop()` is deprecated because it could leave objects half-updated, and since Java 20 it just throws `UnsupportedOperationException`). Instead, threads are **cancelled cooperatively** using the **interrupt flag**.

```java
worker.interrupt();   // sets worker's interrupt flag — a polite request to stop
```

What happens next depends on what the target thread is doing:

| Target thread is… | Effect of `interrupt()` |
| --- | --- |
| Blocked in `sleep()`, `wait()`, `join()`, `BlockingQueue.take()` | Wakes up immediately with `InterruptedException`; the flag is **cleared** |
| Running normal code | Only sets the flag — the thread must check it |
| Blocked acquiring a `synchronized` lock | Nothing until it gets the lock |

### Writing an Interruptible Task

```java
Runnable poller = () -> {
    while (!Thread.currentThread().isInterrupted()) {
        try {
            pollQueue();
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();   // restore the flag…
            break;                                // …and exit
        }
    }
    System.out.println("Poller stopped cleanly");
};
```

| Method | Meaning |
| --- | --- |
| `t.interrupt()` | Set `t`'s interrupt flag (wake it if it's blocked) |
| `t.isInterrupted()` | Check `t`'s flag — doesn't change it |
| `Thread.interrupted()` | **Static**: check the current thread's flag **and clear it** |

> [!IMPORTANT]
> **Never swallow `InterruptedException`.** An empty `catch` block loses the cancellation request — the thread keeps running and `shutdownNow()` on its executor stops working. Either rethrow it, or call `Thread.currentThread().interrupt()` to restore the flag before returning.

```java
// ❌ Swallowed — the interrupt is lost
catch (InterruptedException e) { }

// ✅ Restore the flag
catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

## sleep() vs wait()

A classic interview question:

| `sleep()` | `wait()` |
| --- | --- |
| Static method of `Thread` | Instance method of `Object` |
| Pauses the current thread for a time | Waits until notified (or timeout) |
| **Keeps** any locks it holds | **Releases** the monitor of the object it waits on |
| Can be called anywhere | Must be called inside `synchronized` on the same object, else `IllegalMonitorStateException` |
| Used for delays | Used for inter-thread communication |
| Wakes after timeout or interrupt | Wakes on `notify()`/`notifyAll()`, timeout, interrupt — or spuriously |

## Other Useful Methods

| Method | Purpose |
| --- | --- |
| `Thread.currentThread()` | The thread executing this code |
| `getName()` / `setName()` | Thread name |
| `threadId()` | Unique ID (Java 19+; replaces `getId()`) |
| `isAlive()` | `true` between `start()` and termination |
| `getState()` | Current `Thread.State` |
| `isDaemon()` / `setDaemon()` | Daemon status |
| `holdsLock(obj)` | Does the current thread hold `obj`'s monitor? |

## Reading Thread States in a Thread Dump

When an application hangs, take a thread dump (`jstack <pid>`, `jcmd <pid> Thread.print`, or the Actuator `/threaddump` endpoint):

```output Excerpt from a thread dump
"http-nio-8080-exec-7" #45 daemon prio=5 os_prio=0 tid=0x... nid=0x... waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.shop.InventoryService.reserve(InventoryService.java:42)
        - waiting to lock <0x00000000c1a2b3c4> (a com.shop.Inventory)
```

| Pattern | Likely problem |
| --- | --- |
| Many threads `BLOCKED` on the same lock | Lock contention — a hot `synchronized` method |
| Threads `BLOCKED` on each other's locks | Deadlock (`jstack` reports *"Found one Java-level deadlock"*) |
| Pool threads all `WAITING` in `getConnection()` | Connection pool exhausted |
| Many `RUNNABLE` threads in your code at 100% CPU | Hot loop or CPU-bound work |
| Threads `WAITING` on `Future.get()` forever | Missing timeout, or a task that never completes |

## Interview Questions

### Q1. What are the states of a thread in Java?

`NEW`, `RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING` and `TERMINATED` — the values of `Thread.State`.

### Q2. What is the difference between BLOCKED and WAITING?

`BLOCKED` means waiting to acquire a monitor lock to enter `synchronized` code. `WAITING` means voluntarily waiting for another thread's action — `wait()`, `join()` or `park()`.

### Q3. What is the difference between sleep() and wait()?

`sleep()` pauses the current thread and keeps its locks; `wait()` must be called while holding the object's monitor, releases it, and waits for a notification.

### Q4. How do you stop a thread?

Cooperatively: call `interrupt()`, and write the task to check `isInterrupted()` and handle `InterruptedException` by exiting. `Thread.stop()` is unsafe and, since Java 20, throws `UnsupportedOperationException`. With executors, use `future.cancel(true)` or `shutdownNow()`, which interrupt the workers.

### Q5. What should you do when you catch InterruptedException?

Either propagate it, or restore the interrupt status with `Thread.currentThread().interrupt()` and stop what you're doing. Never swallow it.

### Q6. What does join() do?

It makes the calling thread wait until the target thread terminates (optionally with a timeout).

### Q7. Is there a RUNNING state in Java?

No — running and ready-to-run threads are both `RUNNABLE` in Java.

## Common Mistakes

- ❌ **Swallowing `InterruptedException`** with an empty catch block.
- ❌ **Calling `otherThread.sleep()`** expecting the other thread to sleep — `sleep()` is static.
- ❌ **Sleeping while holding a lock** — every other thread needing that lock blocks for the whole sleep.
- ❌ **Using `sleep()` to "wait for" another thread** — use `join()`, a `Future` or a latch.
- ❌ **`join()` without a timeout on a thread that may never finish** — the caller hangs too.
- ❌ **Using `Thread.stop()`, `suspend()` or `resume()`** — deprecated because they corrupt state.

## Best Practices

- ✅ Design long-running tasks to be **interruptible**.
- ✅ Restore or propagate interrupts — never ignore them.
- ✅ Use timeouts on blocking calls in production (`join(ms)`, `get(timeout)`, `poll(timeout)`).
- ✅ Learn to read thread dumps; they're the first tool for hung applications.
- ✅ Prefer high-level coordination tools over `sleep()`-based polling.

## Key Takeaways

- ✅ A thread is in one of six states: `NEW`, `RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING`, `TERMINATED`.
- ✅ `sleep()` keeps locks; `wait()` releases the monitor.
- ✅ `join()` waits for another thread to finish.
- ✅ Threads are stopped cooperatively with `interrupt()`; tasks must respond to it.
- ✅ Thread dumps show each thread's state and the lock it's waiting for.
