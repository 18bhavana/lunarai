---
title: Inter-Thread Communication — wait & notify
subtitle: Guarded blocks, wait(), notify() and notifyAll(), why wait() must be in a while loop, spurious wakeups, a bounded producer–consumer buffer, and the modern alternatives.
order: 6
---

## Introduction

`synchronized` stops threads from interfering. Sometimes threads also need to **coordinate**: a consumer must wait until a producer has put something in a queue; a producer must wait until there's space. Java's built-in mechanism for this is `wait()`, `notify()` and `notifyAll()` — methods of `Object`, used together with `synchronized`.

> [!TIP]
> In new code you'll usually use a `BlockingQueue`, `CountDownLatch` or `Condition` instead. But `wait`/`notify` is a favourite interview topic, and understanding it explains how those higher-level tools work.

## The Problem: Busy Waiting

```java
// ❌ Busy-waiting: burns a whole CPU core doing nothing useful
while (queue.isEmpty()) {
    // spin
}
Item item = queue.remove();
```

Sleeping in the loop (`Thread.sleep(100)`) wastes less CPU but adds latency and is still guesswork. We want a thread to **sleep until the condition changes** and be woken exactly then.

## wait(), notify() and notifyAll()

| Method | Effect |
| --- | --- |
| `obj.wait()` | Release `obj`'s monitor and wait (`WAITING`) until notified |
| `obj.wait(ms)` | Same, but give up after a timeout (`TIMED_WAITING`) |
| `obj.notify()` | Wake **one** arbitrary thread waiting on `obj` |
| `obj.notifyAll()` | Wake **all** threads waiting on `obj` |

Rules:

1. All three must be called while holding **`obj`'s monitor** — inside `synchronized (obj)`. Otherwise they throw `IllegalMonitorStateException`.
2. `wait()` **atomically releases** the monitor and suspends the thread, so other threads can enter and change the state.
3. A woken thread must **re-acquire** the monitor before `wait()` returns — so it doesn't run until the notifier leaves its synchronized block.
4. `notify()` doesn't release the lock; the lock is released when the notifier exits `synchronized`.

```flow
Consumer: synchronized (lock), queue is empty
Consumer calls lock.wait() — releases the lock, WAITING
Producer: synchronized (lock), adds an item, calls lock.notifyAll()
Producer leaves synchronized — lock released
Consumer re-acquires the lock, wait() returns
Consumer re-checks the condition and takes the item
```

## The Guarded-Block Pattern

```java
synchronized (lock) {
    while (!condition) {      // ALWAYS a while loop, never an if
        lock.wait();
    }
    // condition is true and we hold the lock — act on it
}
```

### Why while, Not if?

- **Spurious wakeups** — the JVM is allowed to wake a waiting thread with no notification at all.
- **Stolen conditions** — with `notifyAll()`, several consumers wake up; the first one takes the only item, and the others must go back to waiting.
- **Wrong notification** — producers and consumers share one wait set, so a thread may be woken for a condition it doesn't care about.

Re-checking in a `while` loop handles all three.

## Producer–Consumer with wait/notify

A bounded buffer — producers block when it's full, consumers block when it's empty:

```java
class BoundedBuffer<T> {

    private final Queue<T> items = new LinkedList<>();
    private final int capacity;

    BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    public synchronized void put(T item) throws InterruptedException {
        while (items.size() == capacity) {
            wait();                       // buffer full — wait for space
        }
        items.add(item);
        notifyAll();                      // wake consumers
    }

    public synchronized T take() throws InterruptedException {
        while (items.isEmpty()) {
            wait();                       // buffer empty — wait for an item
        }
        T item = items.remove();
        notifyAll();                      // wake producers
        return item;
    }
}
```

```java
BoundedBuffer<Integer> buffer = new BoundedBuffer<>(5);

Thread producer = new Thread(() -> {
    try {
        for (int i = 1; i <= 10; i++) {
            buffer.put(i);
            System.out.println("Produced " + i);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}, "producer");

Thread consumer = new Thread(() -> {
    try {
        for (int i = 1; i <= 10; i++) {
            System.out.println("Consumed " + buffer.take());
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}, "consumer");

producer.start();
consumer.start();
```

Here the methods are `synchronized`, so the monitor is `this`, and `wait()` / `notifyAll()` are called on `this`.

## notify() vs notifyAll()

| `notify()` | `notifyAll()` |
| --- | --- |
| Wakes one arbitrary waiting thread | Wakes every waiting thread |
| Cheaper | All wake up, re-compete for the lock, most go back to waiting |
| Safe only if all waiters wait for the **same** condition and any one of them can proceed | Safe default when waiters wait for **different** conditions |
| Risk: wakes the "wrong" thread (e.g. a producer instead of a consumer) → everyone waits forever | No lost-wakeup risk from picking the wrong thread |

In the buffer above, producers and consumers share one wait set. `notify()` could wake another producer when the buffer is full, and the consumer would never be woken — a **lost wakeup** that can hang the program. That's why it uses `notifyAll()`.

> [!TIP]
> `ReentrantLock` with **two `Condition`s** (`notFull`, `notEmpty`) fixes this properly: producers wait on one condition, consumers on the other, and `signal()` wakes exactly the right kind of thread. See the Locks chapter.

## Why Are wait/notify in Object, Not Thread?

Because they're tied to **monitors**, and every object has a monitor. A thread waits **on an object's condition** — "this queue is no longer empty" — not on another thread. Any object can be used as a lock, so any object must support waiting and notification.

## The Modern Alternative: BlockingQueue

The same producer–consumer with `java.util.concurrent`:

```java
BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(5);

// Producer
queue.put(i);            // blocks while full

// Consumer
int item = queue.take(); // blocks while empty
```

No `synchronized`, no `wait`/`notify`, no lost-wakeup risk — and it supports timeouts (`offer(e, timeout)`, `poll(timeout)`). Prefer it in real code.

## Interview Questions

### Q1. Why must wait() be called inside a synchronized block?

Because it releases the object's monitor and must be atomic with checking the condition. Calling it without holding the monitor throws `IllegalMonitorStateException`, and without the lock a notification could happen between the check and the wait (a lost wakeup).

### Q2. Why should wait() be called in a loop?

To handle spurious wakeups and the case where the condition was already consumed by another woken thread — the condition must be re-checked after every wakeup.

### Q3. What is the difference between notify() and notifyAll()?

`notify()` wakes one arbitrary waiting thread; `notifyAll()` wakes all of them. Use `notifyAll()` unless all waiters wait for the same condition and any one can proceed.

### Q4. Does notify() release the lock?

No. The notified thread can't proceed until the notifying thread exits its synchronized block and the woken thread re-acquires the monitor.

### Q5. Why are wait(), notify() and notifyAll() defined in Object?

Because every object has a monitor that can be used as a lock, and waiting is associated with a monitor's condition, not with a particular thread.

### Q6. What is a spurious wakeup?

A thread returning from `wait()` without having been notified, interrupted or timed out. The JVM is permitted to do this, which is why the condition must be checked in a `while` loop.

### Q7. Implement producer–consumer.

Use a bounded buffer with `synchronized`, `while`-loop guards and `notifyAll()` as shown above — or, in production code, an `ArrayBlockingQueue` with `put()` and `take()`.

## Common Mistakes

- ❌ **Calling `wait()`/`notify()` without holding the monitor** → `IllegalMonitorStateException`.
- ❌ **Waiting on one object and notifying another** — they must be the same object.
- ❌ **Using `if` instead of `while`** around `wait()`.
- ❌ **Using `notify()` when waiters wait for different conditions** — lost wakeups and hangs.
- ❌ **Changing the condition without notifying** — waiters sleep forever.
- ❌ **Swallowing `InterruptedException`** from `wait()`.

## Best Practices

- ✅ Prefer `BlockingQueue`, `CountDownLatch`, `Semaphore` or `Condition` over raw `wait`/`notify`.
- ✅ If you use `wait`, always use the guarded-block pattern: `synchronized` + `while (!condition) wait();`.
- ✅ Default to `notifyAll()`.
- ✅ Use a private lock object so outside code can't call `notify()` on your monitor.
- ✅ Consider `wait(timeout)` so a missed signal can't hang a thread forever.

## Key Takeaways

- ✅ `wait()` releases the monitor and suspends the thread until notified; `notify()`/`notifyAll()` wake waiters.
- ✅ All three must be called while holding the same object's monitor.
- ✅ Always wait in a `while` loop — spurious wakeups and stolen conditions are real.
- ✅ `notifyAll()` is the safe default; `Condition` objects allow precise signalling.
- ✅ `BlockingQueue` implements producer–consumer without any of this ceremony.
