---
title: Fork/Join Framework & Parallel Streams
subtitle: Divide-and-conquer with ForkJoinPool, RecursiveTask and RecursiveAction, work stealing, the common pool, and when parallel streams help — or hurt.
order: 16
---

## Introduction

The **Fork/Join framework** (Java 7) is built for **CPU-bound, divide-and-conquer** work: split a big task into smaller ones, run them in parallel on all cores, and combine the results. **Parallel streams** (Java 8) use the same machinery behind a one-word API — which makes them easy to use and easy to misuse.

## Divide and Conquer

```tree
Sum 1..1,000,000
  Sum 1..500,000
    Sum 1..250,000
    Sum 250,001..500,000
  Sum 500,001..1,000,000
    Sum 500,001..750,000
    Sum 750,001..1,000,000
```

Each task either computes directly (if it's small enough) or **forks** subtasks and **joins** their results.

## RecursiveTask — a Task That Returns a Value

```java
class SumTask extends RecursiveTask<Long> {

    private static final int THRESHOLD = 10_000;
    private final long[] numbers;
    private final int start, end;

    SumTask(long[] numbers, int start, int end) {
        this.numbers = numbers;
        this.start = start;
        this.end = end;
    }

    @Override
    protected Long compute() {
        if (end - start <= THRESHOLD) {              // small enough — compute directly
            long sum = 0;
            for (int i = start; i < end; i++) sum += numbers[i];
            return sum;
        }
        int mid = (start + end) >>> 1;
        SumTask left  = new SumTask(numbers, start, mid);
        SumTask right = new SumTask(numbers, mid, end);

        left.fork();                                 // run the left half asynchronously
        long rightResult = right.compute();          // compute the right half in this thread
        long leftResult  = left.join();              // wait for the left half
        return leftResult + rightResult;
    }
}

long total = ForkJoinPool.commonPool().invoke(new SumTask(numbers, 0, numbers.length));
```

> [!TIP]
> The idiom is **fork one, compute the other, then join**. Forking both halves and joining both wastes the current thread. `invokeAll(left, right)` is an equivalent shortcut.

`RecursiveAction` is the same but returns nothing — for example, sorting or transforming an array in place.

### Choosing the Threshold

Too small and the overhead of creating and scheduling tasks dominates; too large and cores sit idle. Aim for leaf tasks of roughly 10,000–100,000 simple operations, and measure.

## Work Stealing

Each worker thread in a `ForkJoinPool` has its own **double-ended queue** of tasks:

```flow
A worker forks subtasks onto the head of its own deque
It takes its next task from the head (newest first)
An idle worker steals from the tail of a busy worker's deque (oldest, usually biggest task)
All cores stay busy with little contention
```

| Classic `ThreadPoolExecutor` | `ForkJoinPool` |
| --- | --- |
| One shared queue | One deque per worker |
| Workers contend on the shared queue | Workers mostly use their own deque; stealing is rare |
| Good for independent tasks | Good for tasks that spawn subtasks |
| A waiting task blocks its thread | `join()` lets the thread run other tasks while it waits |

## The Common Pool

`ForkJoinPool.commonPool()` is a **JVM-wide shared pool** with `availableProcessors() − 1` threads (the calling thread also helps). It's used by:

- parallel streams;
- `CompletableFuture.supplyAsync` / `runAsync` without an executor;
- `Arrays.parallelSort`, `Arrays.parallelSetAll`, etc.

Its size can be set with `-Djava.util.concurrent.ForkJoinPool.common.parallelism=N`, but because it's shared, **one component blocking it affects all others**.

> [!WARNING]
> Fork/Join is designed for **non-blocking, CPU-bound** tasks. Tasks that block on I/O or locks tie up the few worker threads and stall everything else on the common pool.

## Parallel Streams

```java
long count = orders.parallelStream()
        .filter(o -> o.total().compareTo(THRESHOLD) > 0)
        .count();

int sumOfSquares = IntStream.rangeClosed(1, 10_000_000)
        .parallel()
        .map(x -> x * x % 1000)
        .sum();
```

The stream's source is split by a **`Spliterator`** into chunks, the chunks are processed as Fork/Join tasks on the common pool, and the partial results are combined.

### When Parallel Streams Help

- **Large** datasets — tens of thousands of elements or more.
- **CPU-heavy** per-element work.
- Sources that **split well**: arrays, `ArrayList`, `IntStream.range`, `HashMap` key sets.
- **Stateless, independent** operations — `map`, `filter`, `sum`, `reduce` with an associative function.

### When They Hurt

| Situation | Why |
| --- | --- |
| Small collections | Splitting and merging cost more than the work |
| `LinkedList`, `Stream.iterate`, I/O-backed sources | Split poorly |
| Order-dependent operations (`findFirst`, `limit`, `sorted`, `forEachOrdered`) | Extra coordination to keep order |
| Blocking I/O per element (database, HTTP) | Blocks the shared common pool |
| Boxing-heavy pipelines (`Stream<Integer>`) | Memory traffic dominates — use `IntStream` |
| Inside a web request on a busy server | All requests compete for the same few common-pool threads |

### Correctness Traps

```java
// ❌ Shared mutable state — ArrayList isn't thread-safe: lost elements or exceptions
List<Integer> results = new ArrayList<>();
numbers.parallelStream().map(n -> n * 2).forEach(results::add);

// ✅ Let the stream collect
List<Integer> results2 = numbers.parallelStream().map(n -> n * 2).toList();
```

```java
// ❌ forEach on a parallel stream has no defined order
names.parallelStream().forEach(System.out::println);

// ✅ forEachOrdered keeps encounter order (but loses much of the benefit)
names.parallelStream().forEachOrdered(System.out::println);
```

```java
// ❌ Non-associative reduce gives different results in parallel
int wrong = IntStream.rangeClosed(1, 4).parallel().reduce(0, (a, b) -> a - b);

// ❌ Identity must be a true identity: reduce(10, Integer::sum) adds 10 once per chunk
int alsoWrong = IntStream.rangeClosed(1, 4).parallel().reduce(10, Integer::sum);
```

> [!IMPORTANT]
> Parallel stream operations must be **stateless, non-interfering and associative**. And always **measure** — a parallel stream is frequently *slower* than a sequential one in typical backend code.

### Running a Parallel Stream in a Custom Pool

```java
ForkJoinPool pool = new ForkJoinPool(4);
try {
    long result = pool.submit(() ->
            data.parallelStream().mapToLong(this::expensiveCalculation).sum()
    ).get();
} finally {
    pool.shutdown();
}
```

This isolates heavy work from the common pool. It relies on an implementation detail (tasks run in the pool that invoked them), so treat it as a pragmatic workaround.

## Interview Questions

### Q1. What is the Fork/Join framework?

A framework for parallel divide-and-conquer: a task splits itself into subtasks (`fork`), runs them in parallel on a `ForkJoinPool`, and combines the results (`join`). Subclass `RecursiveTask` for results or `RecursiveAction` for none.

### Q2. What is work stealing?

Each worker has its own deque; it pushes and pops its own tasks at the head, and idle workers steal from the tail of other workers' deques. This balances load with little contention.

### Q3. How is ForkJoinPool different from ThreadPoolExecutor?

`ForkJoinPool` gives each worker its own deque and uses work stealing; a joining thread can execute other tasks while it waits. It's optimized for many small, recursive, CPU-bound tasks. `ThreadPoolExecutor` uses one shared queue and suits independent tasks, including blocking ones.

### Q4. Which pool do parallel streams use?

The common `ForkJoinPool`, shared with `CompletableFuture`'s default async methods; its parallelism defaults to cores − 1.

### Q5. When should you avoid parallel streams?

For small datasets, poorly splitting sources, order-dependent operations, blocking I/O, shared mutable state, or in busy servers where many requests would compete for the common pool. Measure before using them.

### Q6. Why might a parallel reduce give the wrong answer?

The function isn't associative, or the identity value isn't a true identity, because partial results from different chunks are combined in an unspecified grouping.

## Common Mistakes

- ❌ **Blocking I/O inside Fork/Join tasks or parallel streams.**
- ❌ **Mutating shared collections** from `forEach` in a parallel stream.
- ❌ **Using `parallel()` everywhere** without measuring.
- ❌ **Forking both subtasks and joining both** instead of fork-one/compute-other.
- ❌ **Thresholds that are too small**, creating millions of tiny tasks.
- ❌ **Non-associative reductions** or wrong identity values.

## Best Practices

- ✅ Use Fork/Join and parallel streams only for CPU-bound work on large data.
- ✅ Keep operations stateless and side-effect free; collect results with collectors.
- ✅ Prefer primitive streams (`IntStream`, `LongStream`) for numeric work.
- ✅ Benchmark with JMH or realistic load tests before switching to parallel.
- ✅ Keep I/O off the common pool — use dedicated executors or virtual threads.

## Key Takeaways

- ✅ Fork/Join splits work recursively and combines results; `RecursiveTask` returns values.
- ✅ Work stealing keeps all cores busy with low contention.
- ✅ The common pool is shared by parallel streams and default `CompletableFuture` async calls.
- ✅ Parallel streams help only for large, CPU-bound, well-splitting, stateless workloads.
- ✅ Shared mutable state, blocking and order-dependence make parallel streams wrong or slow.
