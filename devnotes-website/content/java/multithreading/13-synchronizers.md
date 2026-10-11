---
title: Synchronizers — CountDownLatch, CyclicBarrier, Semaphore & Phaser
subtitle: Coordinating threads with CountDownLatch, CyclicBarrier, Semaphore, Phaser and Exchanger — how each works, real use cases such as startup checks and rate limiting, and how to choose between them.
order: 13
---

## Introduction

`java.util.concurrent` provides ready-made **synchronizers** — objects whose only job is to coordinate threads. They replace most hand-written `wait`/`notify` code and are frequent interview topics, especially **CountDownLatch vs CyclicBarrier** and **Semaphore**.

| Synchronizer | One-line summary |
| --- | --- |
| `CountDownLatch` | Wait until **N events** have happened — one-shot |
| `CyclicBarrier` | N threads wait for **each other** at a common point — reusable |
| `Semaphore` | Allow at most **N threads** into a section at once |
| `Phaser` | A flexible, reusable barrier with a changing number of parties |
| `Exchanger` | Two threads swap objects at a meeting point |

## CountDownLatch

A latch is initialized with a **count**. Threads call `countDown()` to decrement it; threads calling `await()` block until it reaches **zero**. Once zero, it stays open forever — a latch **can't be reset**.

```java
CountDownLatch ready = new CountDownLatch(3);

ExecutorService pool = Executors.newFixedThreadPool(3);
pool.submit(() -> { checkDatabase();     ready.countDown(); });
pool.submit(() -> { checkCache();        ready.countDown(); });
pool.submit(() -> { checkMessageQueue(); ready.countDown(); });

if (ready.await(30, TimeUnit.SECONDS)) {   // main waits for all three checks
    startAcceptingTraffic();
} else {
    throw new IllegalStateException("Dependencies not ready in time");
}
```

```flow
count = 3
: database check done — countDown()
count = 2
: cache check done — countDown()
count = 1
: queue check done — countDown()
count = 0 — main thread's await() returns
```

> [!IMPORTANT]
> Call `countDown()` in a **`finally`** block. If a task throws before counting down, the waiting thread hangs forever (or until the `await` timeout).

```java
pool.submit(() -> {
    try {
        checkDatabase();
    } finally {
        ready.countDown();
    }
});
```

### Use Cases

- Wait for several services or workers to initialize before starting.
- Wait for N parallel subtasks to finish (an alternative to `invokeAll` / `allOf`).
- A **start gate** in tests: `new CountDownLatch(1)` makes many threads begin at exactly the same moment to provoke race conditions.

```java
CountDownLatch startGate = new CountDownLatch(1);
for (int i = 0; i < 10; i++) {
    pool.submit(() -> {
        startGate.await();   // all ten wait here...
        hitTheEndpoint();
        return null;
    });
}
startGate.countDown();       // ...and are released together
```

## CyclicBarrier

A barrier makes a fixed number of threads **wait for each other**. Each thread calls `await()`; when the last one arrives, all are released together. It then **resets automatically**, so it can be used again — hence "cyclic".

```java
int workers = 4;
CyclicBarrier barrier = new CyclicBarrier(workers,
        () -> System.out.println("All chunks done — merging results"));   // barrier action

for (int i = 0; i < workers; i++) {
    int chunk = i;
    pool.submit(() -> {
        for (int round = 1; round <= 3; round++) {
            processChunk(chunk, round);
            barrier.await();        // wait for the other three before the next round
        }
        return null;
    });
}
```

The optional **barrier action** runs once per cycle, on the last thread to arrive, before the others are released.

> [!WARNING]
> If one waiting thread is interrupted or times out, the barrier becomes **broken**: every other waiter gets `BrokenBarrierException`. Call `reset()` to reuse it after a failure.

## CountDownLatch vs CyclicBarrier

| `CountDownLatch` | `CyclicBarrier` |
| --- | --- |
| Threads wait for **events** (count-downs) | Threads wait for **each other** |
| The counting threads don't wait | Every party calls `await()` and waits |
| **One-shot** — can't be reset | **Reusable** — resets after each trip |
| Count is decremented by anyone, any number of times | Fixed number of parties |
| No completion action | Optional barrier action per cycle |
| Typical use: main waits for N workers | Typical use: N workers proceed in lock-step phases |

## Semaphore

A semaphore maintains a number of **permits**. `acquire()` takes a permit (blocking if none are available); `release()` returns one. It limits how many threads can use a resource **at the same time**.

```java
class ReportGenerator {
    private final Semaphore permits = new Semaphore(5);   // at most 5 concurrent reports

    public Report generate(ReportRequest request) throws InterruptedException {
        permits.acquire();
        try {
            return buildExpensiveReport(request);
        } finally {
            permits.release();   // always in finally
        }
    }
}
```

### Fail Fast Instead of Waiting

```java
if (!permits.tryAcquire(200, TimeUnit.MILLISECONDS)) {
    throw new TooManyRequestsException("Report service is busy");   // HTTP 429
}
try {
    return buildExpensiveReport(request);
} finally {
    permits.release();
}
```

### Use Cases

- **Throttling calls** to a rate-limited third-party API.
- Limiting concurrent access to an expensive resource (report generation, file conversion).
- Implementing a simple resource pool.
- A **binary semaphore** (`new Semaphore(1)`) works like a lock, but **any thread** can release it — it has no owner and is **not reentrant**.

> [!NOTE]
> A semaphore limits **concurrency** (how many at once), not **rate** (how many per second). For requests-per-second limits, use a rate limiter such as Resilience4j `RateLimiter` or Guava `RateLimiter`. `new Semaphore(n, true)` creates a fair semaphore that grants permits in arrival order.

### Semaphore vs Lock

| `Semaphore` | `ReentrantLock` |
| --- | --- |
| N permits — N threads at once | One owner at a time |
| No ownership — any thread can release | Only the owner can unlock |
| Not reentrant | Reentrant |
| Controls access to a pool of resources | Protects a critical section |

## Phaser

`Phaser` (Java 7) generalizes `CountDownLatch` and `CyclicBarrier`: it's reusable across **phases**, and parties can **register and deregister** dynamically.

```java
Phaser phaser = new Phaser(1);   // register the coordinator

for (String file : files) {
    phaser.register();           // one more party
    pool.submit(() -> {
        parse(file);
        phaser.arriveAndAwaitAdvance();    // end of phase 0: wait for all parsers
        validate(file);
        phaser.arriveAndDeregister();      // done with phase 1, and leave
    });
}

phaser.arriveAndAwaitAdvance();      // coordinator waits for phase 0
phaser.arriveAndDeregister();        // coordinator leaves; workers finish phase 1
```

Use it when the number of participants isn't known up front or changes between phases.

## Exchanger

Two threads meet at an exchange point and **swap objects**:

```java
Exchanger<List<Record>> exchanger = new Exchanger<>();

// Filler thread: fills a buffer, then swaps it for an empty one
buffer = exchanger.exchange(fullBuffer);

// Drainer thread: writes a full buffer to disk, then swaps it back
buffer = exchanger.exchange(emptyBuffer);
```

Niche — used for double-buffering pipelines.

## Choosing a Synchronizer

| Need | Use |
| --- | --- |
| Wait until N tasks or events have completed | `CountDownLatch` (or `CompletableFuture.allOf`) |
| Release many threads at the same instant | `CountDownLatch(1)` as a start gate |
| N threads repeatedly synchronize between phases | `CyclicBarrier` |
| Parties change between phases | `Phaser` |
| At most N concurrent users of a resource | `Semaphore` |
| Two threads trade data | `Exchanger` |
| Hand work from producers to consumers | `BlockingQueue` (next chapter) |

## Interview Questions

### Q1. What is a CountDownLatch?

A synchronizer initialized with a count; `countDown()` decrements it and `await()` blocks until it reaches zero. It's one-shot and can't be reset.

### Q2. What is the difference between CountDownLatch and CyclicBarrier?

A latch lets threads wait for a number of events; the threads counting down don't wait, and it can't be reused. A barrier makes a fixed number of threads wait for each other, can run a barrier action, and resets for reuse.

### Q3. What is a Semaphore?

A counter of permits. `acquire()` takes one (blocking if none remain) and `release()` returns one, limiting how many threads can access a resource concurrently.

### Q4. How would you limit concurrent calls to an external API to 10?

Wrap the call in `semaphore.acquire()` / `release()` (in `finally`) with `new Semaphore(10)`, using `tryAcquire(timeout)` to fail fast — or use a bulkhead (separate bounded pool, or Resilience4j `Bulkhead`).

### Q5. Can a CountDownLatch be reused?

No. Once the count reaches zero it stays at zero. Use a `CyclicBarrier` or `Phaser` for reusable coordination.

### Q6. What happens if a thread waiting on a CyclicBarrier is interrupted?

The barrier breaks and all other waiting threads receive `BrokenBarrierException`; it must be `reset()` before reuse.

## Common Mistakes

- ❌ **Not calling `countDown()` / `release()` in `finally`** — a failure hangs other threads or leaks permits.
- ❌ **Calling `await()` without a timeout** on a latch that might never reach zero.
- ❌ **Releasing a semaphore you never acquired** — permits grow beyond the intended limit.
- ❌ **Trying to reuse a `CountDownLatch`.**
- ❌ **Using a semaphore as a rate limiter** — it limits concurrency, not requests per second.

## Best Practices

- ✅ Use these utilities instead of hand-written `wait`/`notify` coordination.
- ✅ Always release permits and count down in `finally`.
- ✅ Use timed `await` / `tryAcquire` in production paths.
- ✅ Use a start-gate latch in concurrency tests to maximize interleavings.
- ✅ Prefer `CompletableFuture.allOf` when you also need the tasks' results.

## Key Takeaways

- ✅ `CountDownLatch` waits for N events and is one-shot.
- ✅ `CyclicBarrier` makes N threads wait for each other and is reusable.
- ✅ `Semaphore` caps concurrent access with permits; it has no owner.
- ✅ `Phaser` is a flexible, multi-phase barrier with dynamic parties.
- ✅ Release and count down in `finally`, and prefer timed waits.
