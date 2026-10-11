---
title: Concurrency Coding Scenarios
subtitle: Classic multithreading programs asked in interviews — odd/even printing, three threads in sequence, producer–consumer, a thread-safe singleton and cache, a bank transfer without deadlock, parallel aggregation, a rate limiter, and a quick revision sheet.
order: 19
---

## Introduction

Interviews for experienced Java developers usually include at least one **"write a multithreaded program"** exercise. This chapter collects the most common ones, each with a working solution and the points interviewers look for, and ends with a quick revision sheet for the whole topic.

## Coding Questions

### Q1. Print odd and even numbers from 1 to 10 using two threads, in order.

```java
public class OddEvenPrinter {

    private final int max;
    private int current = 1;
    private final Object lock = new Object();

    OddEvenPrinter(int max) { this.max = max; }

    void print(boolean printOdd) {
        synchronized (lock) {
            while (current <= max) {
                boolean isOdd = current % 2 == 1;
                if (isOdd == printOdd) {
                    System.out.println(Thread.currentThread().getName() + ": " + current++);
                    lock.notifyAll();
                } else {
                    try {
                        lock.wait();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            }
            lock.notifyAll();   // wake the other thread so it can exit too
        }
    }

    public static void main(String[] args) {
        OddEvenPrinter p = new OddEvenPrinter(10);
        new Thread(() -> p.print(true),  "odd").start();
        new Thread(() -> p.print(false), "even").start();
    }
}
```

```output
odd: 1
even: 2
odd: 3
even: 4
...
even: 10
```

Points interviewers look for: a **shared lock**, `wait()` inside a **loop**, `notifyAll()`, both threads **terminating** cleanly, and correct `InterruptedException` handling. An alternative uses two `Semaphore`s that hand a permit back and forth.

### Q2. Make three threads print A, B and C in sequence, 5 times (ABCABC…).

```java
public class SequencePrinter {

    private final Semaphore a = new Semaphore(1);
    private final Semaphore b = new Semaphore(0);
    private final Semaphore c = new Semaphore(0);

    void run(String letter, Semaphore mine, Semaphore next) {
        for (int i = 0; i < 5; i++) {
            try {
                mine.acquire();
                System.out.print(letter);
                next.release();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    public static void main(String[] args) {
        SequencePrinter p = new SequencePrinter();
        new Thread(() -> p.run("A", p.a, p.b)).start();
        new Thread(() -> p.run("B", p.b, p.c)).start();
        new Thread(() -> p.run("C", p.c, p.a)).start();
    }
}
```

```output
ABCABCABCABCABC
```

Each thread waits for its own permit and then hands one to the next thread — a clean token-passing pattern.

### Q3. Implement producer–consumer.

```java
BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(5);
int poison = -1;

Thread producer = new Thread(() -> {
    try {
        for (int i = 1; i <= 10; i++) {
            queue.put(i);                  // waits when full
            System.out.println("Produced " + i);
        }
        queue.put(poison);                 // signal the end
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});

Thread consumer = new Thread(() -> {
    try {
        while (true) {
            int item = queue.take();       // waits when empty
            if (item == poison) break;
            System.out.println("Consumed " + item);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});

producer.start();
consumer.start();
```

Interviewers often ask for the `wait`/`notify` version next — see *Inter-Thread Communication* — and then why `BlockingQueue` is better (no lost wakeups, timeouts, back-pressure built in).

### Q4. Write a thread-safe lazy singleton.

```java
public final class AppConfig {

    private AppConfig() { }

    private static final class Holder {
        static final AppConfig INSTANCE = new AppConfig();   // class initialization is thread-safe
    }

    public static AppConfig getInstance() {
        return Holder.INSTANCE;
    }
}
```

Be ready to explain double-checked locking and **why the field must be `volatile`** (see *Java Memory Model & volatile*), and that an `enum` singleton is also thread-safe and serialization-safe.

### Q5. Build a thread-safe cache that loads each key only once.

```java
public class ProductCache {

    private final ConcurrentHashMap<Long, Product> cache = new ConcurrentHashMap<>();
    private final ProductRepository repository;

    public ProductCache(ProductRepository repository) {
        this.repository = repository;
    }

    public Product get(long id) {
        return cache.computeIfAbsent(id, repository::findById);   // atomic per key
    }

    public void evict(long id) {
        cache.remove(id);
    }
}
```

Discussion points: `computeIfAbsent` runs the loader **at most once per key** and blocks other callers for the same key while it runs (so keep it fast, and never modify the map inside it); there's no expiry or size bound — in production use Caffeine or Spring's `@Cacheable`.

### Q6. Transfer money between accounts safely, without deadlock.

```java
public class Bank {

    public void transfer(Account from, Account to, BigDecimal amount) {
        if (from.getId() == to.getId()) throw new IllegalArgumentException("Same account");

        Account first  = from.getId() < to.getId() ? from : to;   // global lock order
        Account second = first == from ? to : from;

        synchronized (first) {
            synchronized (second) {
                if (from.getBalance().compareTo(amount) < 0) {
                    throw new InsufficientFundsException(from.getId());
                }
                from.debit(amount);
                to.credit(amount);
            }
        }
    }
}
```

Explain the **four deadlock conditions**, how lock ordering breaks circular wait, the `tryLock`-with-timeout alternative, and that in a real system this belongs in a **database transaction** with row locks (`SELECT … FOR UPDATE`) or optimistic locking — in-memory locks don't work across multiple service instances.

### Q7. Call three services in parallel and combine their results with a timeout.

```java
public OrderSummary summary(long orderId) {
    CompletableFuture<Order> order = CompletableFuture
            .supplyAsync(() -> orderClient.get(orderId), ioExecutor);
    CompletableFuture<Customer> customer = order
            .thenCompose(o -> CompletableFuture.supplyAsync(() -> customerClient.get(o.customerId()), ioExecutor));
    CompletableFuture<Shipment> shipment = CompletableFuture
            .supplyAsync(() -> shippingClient.track(orderId), ioExecutor)
            .exceptionally(ex -> Shipment.unknown());

    return order
            .thenCombine(customer, OrderSummary::new)
            .thenCombine(shipment, OrderSummary::withShipment)
            .orTimeout(3, TimeUnit.SECONDS)
            .join();
}
```

Show that you know: dependent calls use `thenCompose`, independent ones `thenCombine`/`allOf`; pass a **dedicated executor**; handle failures; add timeouts.

### Q8. Count words across many files in parallel.

```java
public Map<String, Long> countWords(List<Path> files) throws InterruptedException {
    ConcurrentHashMap<String, LongAdder> counts = new ConcurrentHashMap<>();

    try (ExecutorService pool = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors())) {
        for (Path file : files) {
            pool.submit(() -> {
                try (Stream<String> lines = Files.lines(file)) {
                    lines.flatMap(l -> Arrays.stream(l.toLowerCase().split("\\W+")))
                         .filter(w -> !w.isBlank())
                         .forEach(w -> counts.computeIfAbsent(w, k -> new LongAdder()).increment());
                }
                return null;
            });
        }
    }   // close() waits for all files (Java 19+)

    return counts.entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().sum()));
}
```

Concurrent map + `LongAdder` avoids lost updates and contention; the executor bounds parallelism; try-with-resources guarantees shutdown. (Note that exceptions from individual files are captured in ignored futures here — in production, collect the futures and check them.)

### Q9. Implement a simple rate limiter (N requests per second).

```java
public class SimpleRateLimiter {

    private final Semaphore permits;
    private final ScheduledExecutorService refill = Executors.newSingleThreadScheduledExecutor();

    public SimpleRateLimiter(int permitsPerSecond) {
        this.permits = new Semaphore(permitsPerSecond);
        refill.scheduleAtFixedRate(() -> {
            int missing = permitsPerSecond - permits.availablePermits();
            if (missing > 0) permits.release(missing);   // top the bucket back up
        }, 1, 1, TimeUnit.SECONDS);
    }

    public boolean tryAcquire() {
        return permits.tryAcquire();    // false → reject with HTTP 429
    }

    public void shutdown() {
        refill.shutdownNow();
    }
}
```

This is a basic **token bucket**. Discuss its limits (bursts at second boundaries, the refill check isn't atomic with acquisitions, one JVM only) and production options: Resilience4j `RateLimiter`, Bucket4j, or a Redis-based limiter for multiple instances.

### Q10. What's wrong with this code?

```java
@Service
public class VisitCounter {
    private final Map<String, Integer> visits = new HashMap<>();

    public void record(String page) {
        visits.put(page, visits.getOrDefault(page, 0) + 1);
    }
}
```

1. A **singleton** bean shared by all request threads.
2. **`HashMap` isn't thread-safe** — concurrent puts can lose entries or corrupt the table.
3. **Read-modify-write race** — two threads read the same count and both write count + 1.

**Fix:** `ConcurrentHashMap<String, LongAdder>` with `computeIfAbsent(page, k -> new LongAdder()).increment()`, or `merge(page, 1, Integer::sum)` — and if counts must survive restarts or be shared across instances, use a database or Redis.

## Quick Revision Sheet

| Topic | Remember |
| --- | --- |
| Process vs thread | Threads share the heap; each has its own stack |
| `start()` vs `run()` | `start()` creates a thread; `run()` is a normal call |
| Thread states | NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED |
| `sleep` vs `wait` | `sleep` keeps locks; `wait` releases the monitor and needs `synchronized` |
| Interrupts | Cooperative cancellation; never swallow `InterruptedException` |
| Race condition | Read-modify-write and check-then-act on shared mutable state |
| `synchronized` | Mutual exclusion + visibility; reentrant; instance vs class lock |
| `volatile` | Visibility + ordering; **not** atomic for `count++` |
| Happens-before | Unlock → lock, volatile write → read, `start()`, `join()` |
| Double-checked locking | Requires `volatile`; prefer the holder idiom |
| `wait`/`notify` | In `synchronized`, in a `while` loop, prefer `notifyAll` |
| Deadlock | 4 Coffman conditions; fix with lock ordering or `tryLock` |
| `ReentrantLock` | `tryLock`, interruptible, fair, `Condition`s; unlock in `finally` |
| Read-write lock | Many readers or one writer; no upgrade |
| Atomics | CAS-based, lock-free; ABA → stamped reference; `LongAdder` for hot counters |
| Executors | Reuse threads; `submit` returns `Future`; always shut down |
| `ThreadPoolExecutor` | Grows past core only when the queue is full; bounded queue + rejection policy |
| Pool sizing | CPU-bound ≈ cores; I/O-bound ≈ cores × (1 + wait/compute) |
| `CompletableFuture` | `thenApply` / `thenCompose` / `thenCombine` / `allOf`; own executor for I/O |
| Synchronizers | Latch = one-shot events; barrier = reusable rendezvous; semaphore = N permits |
| Concurrent collections | `ConcurrentHashMap` atomic methods; COW for read-mostly; `BlockingQueue` for producer–consumer |
| Fail-fast vs fail-safe | `modCount` + CME vs snapshot / weakly consistent iterators |
| Immutability | Thread-safe by design; `final` fields are safely published |
| `ThreadLocal` | Per-thread value; `remove()` in pools; doesn't cross threads |
| Fork/Join | Divide and conquer, work stealing, CPU-bound only |
| Parallel streams | Large, CPU-heavy, stateless data only — measure |
| Virtual threads | Cheap JVM threads for I/O; don't pool; limit with semaphores |
| `@Async` | Proxy + executor; self-invocation trap; outside caller's transaction |

## Practice Problems

**Easy**

1. Start two threads that each print their name five times.
2. Fix a race on a shared counter with `synchronized`, then with `AtomicInteger`.
3. Stop a worker thread cleanly using `interrupt()`.
4. Use `join()` so `main` prints a result computed by another thread.
5. Submit three `Callable`s to an executor and print their results.

**Medium**

1. Print numbers 1–20 alternately from two threads.
2. Implement producer–consumer with `wait`/`notify`, then with `BlockingQueue`.
3. Use a `CountDownLatch` so the main thread waits for five workers.
4. Limit concurrent calls to a slow method to three with a `Semaphore`.
5. Fetch three prices in parallel with `CompletableFuture` and pick the cheapest.
6. Build a bounded `ThreadPoolExecutor` and observe each rejection policy.

**Interview level**

1. Write a program that deadlocks, then fix it two different ways.
2. Implement a bounded blocking queue with `ReentrantLock` and two `Condition`s.
3. Implement a thread-safe LRU cache.
4. Design an `@Async` email service with a bounded pool, error handling and MDC propagation.
5. Convert a fixed-pool service to virtual threads and protect its database and third-party calls.
6. Explain, with code, why double-checked locking needs `volatile`.

## Key Takeaways

- ✅ Most interview programs reduce to a few patterns: shared lock + `wait`/`notify`, semaphore token passing, `BlockingQueue`, lock ordering, `ConcurrentHashMap` atomic methods and `CompletableFuture` composition.
- ✅ Always show clean termination, correct `InterruptedException` handling and timeouts.
- ✅ Mention production alternatives — database locking, Caffeine, Resilience4j, Redis — when in-memory solutions don't scale beyond one JVM.
- ✅ Use the revision sheet to recap the whole topic before an interview.
