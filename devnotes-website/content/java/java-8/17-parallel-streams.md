---
title: Parallel Streams and Performance
subtitle: How parallelStream() works — Fork/Join, the common pool, ordering, thread safety, associativity, and when parallel makes things slower.
order: 17
---

## Introduction

One of the most misunderstood Java 8 topics. Many developers think:

> [!WARNING]
> *"If I replace `stream()` with `parallelStream()`, my code becomes faster."* — **Not always.**

In many real-world applications, `parallelStream()` can make your application **slower**. Understanding when to use it and when to avoid it is a common interview topic for 5–10 years of experience.

By the end of this chapter you'll master sequential vs parallel streams, how parallel streams work internally, the Fork/Join framework, splitting and merging, the common pool, thread safety, ordering, performance and when **not** to use parallel streams.

> [!NOTE]
> Examples use `List.of()`, which is Java 9+. On Java 8 use `Arrays.asList()`.

## Sequential Stream

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

numbers.stream()
       .forEach(System.out::println);
```

```flow-h Everything happens in one thread
Thread-1
1
2
3
4
5
```

## Parallel Stream

```java
numbers.parallelStream()
       .forEach(System.out::println);
```

```buckets Multiple threads execute simultaneously
Thread-1: 1, 3
Thread-2: 2, 5
Thread-3: 4
```

## How Does It Work?

Suppose `1 2 3 4 5 6 7 8`.

```flow
1 2 3 4 5 6 7 8
: split
Thread A: 1 2 · Thread B: 3 4 · Thread C: 5 6 · Thread D: 7 8
: combine results
Result
```

This is called the **divide-and-conquer** approach.

## Fork/Join Framework

Parallel streams use Java's **Fork/Join Framework** internally (introduced in Java 7).

```flow-h
Big task
Split (fork)
Worker threads
Merge (join)
Final result
```

### Example: Sum 1…1,000,000

Instead of one thread doing 1 million additions, Java does:

```buckets
Thread 1: 1..250000
Thread 2: 250001..500000
Thread 3: 500001..750000
Thread 4: 750001..1000000
```

…and then **combines** the four partial sums.

## Common ForkJoinPool

Parallel streams use **`ForkJoinPool.commonPool()`** by default. The pool size is usually **CPU cores − 1** — e.g. an 8-core CPU gives **7 worker threads**. The calling thread (often `main`) also participates in the work. *Interview favourite.*

### Checking Thread Names

```java
IntStream.rangeClosed(1, 10)
         .parallel()
         .forEach(i -> System.out.println(
                 Thread.currentThread().getName() + " : " + i));
```

```output
ForkJoinPool.commonPool-worker-1 : 7
ForkJoinPool.commonPool-worker-3 : 3
main : 6
ForkJoinPool.commonPool-worker-2 : 9
...
```

Now you can actually see parallel execution.

## parallel() vs parallelStream()

Both are equivalent:

```java
list.parallelStream()

// equals

list.stream()
    .parallel()
```

Both create a parallel stream.

## When Parallel Streams Shine

**CPU-intensive work** — image processing, encryption, compression, mathematical calculations, machine-learning calculations.

```java
numbers.parallelStream()
       .map(this::expensiveCalculation)
       .toList();
```

Each calculation is independent. Perfect candidate.

## When NOT to Use Parallel Streams

### Database Calls

```java
// ❌ Bad
users.parallelStream()
     .map(repository::findOrders)
```

**Why?** Multiple threads now compete for database connections, transactions and the connection pool. Often slower.

### REST API Calls

```java
// ❌ Bad
users.parallelStream()
     .map(api::fetchUser)
```

Use `CompletableFuture`, reactive programming or async APIs instead.

### Small Collections

```java
// ❌ Bad
List.of(1, 2, 3, 4)
    .parallelStream()
```

Splitting work across threads costs more than the work itself.

## Thread Safety

### Bad Example

```java
List<Integer> result = new ArrayList<>();

numbers.parallelStream()
       .forEach(result::add);
```

**Problem:** multiple threads modify an `ArrayList`. Result: **missing values, corrupted data, exceptions** (e.g. `ArrayIndexOutOfBoundsException`).

### Correct

```java
List<Integer> result = numbers.parallelStream()
        .collect(Collectors.toList());
```

Collectors handle parallel accumulation safely — each thread fills its own container and the combiner merges them.

## Ordering

```java
numbers.stream()
       .forEach(System.out::println);           // 1 2 3 4 5

numbers.parallelStream()
       .forEach(System.out::println);           // possible: 3 1 5 2 4
```

**Order is not guaranteed.** Need order? Use:

```java
numbers.parallelStream()
       .forEachOrdered(System.out::println);    // 1 2 3 4 5
```

But `forEachOrdered()` reduces some of the benefits of parallel execution because it must preserve encounter order.

## Reduction in Parallel

```java
// ✅ Good — addition is associative. Safe.
int total = IntStream.rangeClosed(1, 100)
        .parallel()
        .sum();

// ❌ Bad — subtraction depends on order
.parallel()
.reduce((a, b) -> a - b)
```

A different execution order may produce different results.

## Stateless vs Stateful Operations

| Stateless — good for parallel | Stateful — require coordination |
| --- | --- |
| `map()` | `sorted()` |
| `filter()` | `distinct()` |
| `mapToInt()` | `limit()` |
| Each element is independent | Often reduce the benefits of parallel processing |

## Real Spring Boot Examples

```java
// ✅ Good — image compression is CPU-intensive and independent
images.parallelStream()
      .map(ImageService::compress)
      .toList();

// ❌ Bad — database contention, transaction overhead, connection pool limits
employees.parallelStream()
         .forEach(employeeRepository::save);

// ✅ Good — checksum calculations are CPU-bound
files.parallelStream()
     .map(FileProcessor::checksum)
     .toList();
```

## Performance Rule

```flow-h Parallel is beneficial when
Large data
: +
CPU-intensive
: +
Independent tasks
```

Not beneficial when there is **small data**, **I/O**, or **shared state**.

## Parallel Stream Pipeline

```java
employees.parallelStream()
         .filter(Employee::isActive)
         .map(Employee::getSalary)
         .map(this::calculateTax)
         .sorted()
         .limit(100)
         .toList();
```

Think about the stages:

| Stage | Parallel behaviour |
| --- | --- |
| `filter()` | Parallel-friendly |
| `map()` | Parallel-friendly |
| `calculateTax()` | If CPU-intensive, parallel helps |
| `sorted()` | Requires coordination |
| `limit()` | May reduce efficiency (ordered streams) |

Not every stage benefits equally.

## Interview Questions

### Q1. Difference between stream() and parallelStream()?

| stream() | parallelStream() |
| --- | --- |
| Single thread | Multiple threads |
| Ordered | Order not guaranteed with `forEach()` |
| Less overhead | Thread-management overhead |

### Q2. Which thread pool is used?

`ForkJoinPool.commonPool()`.

### Q3. When should parallel streams be avoided?

Database operations, REST API calls, small collections, and shared mutable state.

### Q4. Difference between forEach() and forEachOrdered()?

- `forEach()` → faster, no ordering guarantee.
- `forEachOrdered()` → preserves encounter order.

### Q5. Why can ArrayList fail in parallel streams?

Because it's not thread-safe.

### Q6. What kinds of operations work best?

Operations that are **independent**, **CPU-intensive**, and **associative** (for reductions).

## Practice Problems

1. Print thread names using a parallel stream.
2. Calculate the sum of numbers from 1 to 1,000,000 using a sequential stream and a parallel stream. Observe the difference.
3. Compress a list of images in parallel.
4. Generate checksums for 1000 files using parallel streams.
5. Use `forEach()` and `forEachOrdered()` on the same dataset and compare the output.
6. Why is the following code unsafe, and how would you fix it?

```java
List<Integer> list = new ArrayList<>();

IntStream.rangeClosed(1, 1000)
         .parallel()
         .forEach(list::add);
```

7. Identify whether each scenario should use sequential or parallel streams:
    1. Summing 10 integers
    2. Processing 5 million images
    3. Saving 1000 records to a database
    4. Calculating SHA-256 hashes for 1 million files
    5. Calling an external payment API

### 5+ Years Interview Challenge

Each employee has a large PDF report that must be encrypted. Return a list of encrypted reports.

```java
List<EncryptedReport> reports = employees.parallelStream()
        .map(employee -> encryptionService.encrypt(employee.getReport()))
        .toList();
```

**Why is this a good candidate?**

- Each encryption is independent.
- Encryption is CPU-intensive.
- No shared mutable state.
- No database or network calls in the stream.

## Senior Java Tips

### 1. Don't use parallelStream() by default

Many developers assume `stream()` → `parallelStream()` means "faster". This is one of the biggest misconceptions in Java. **Always measure before optimizing.**

### 2. Avoid I/O inside parallel streams

Database calls, REST calls and file writes are usually better handled with dedicated asynchronous APIs like `CompletableFuture` or reactive frameworks rather than `parallelStream()`. Blocking I/O in the common pool also starves every other parallel stream in the JVM.

### 3. Be careful with shared mutable state

This is unsafe:

```java
.parallelStream()
.forEach(sharedList::add);
```

Prefer immutable transformations and collectors:

```java
.parallelStream()
.map(...)
.collect(Collectors.toList());
```

## Chapter Summary

- ✅ Parallel streams split work with Fork/Join on `ForkJoinPool.commonPool()`
- ✅ `parallel()` ≡ `parallelStream()`
- ✅ Good for large, CPU-bound, independent work; bad for I/O, small data, shared state
- ✅ `forEach()` vs `forEachOrdered()`
- ✅ Reductions must be associative
- ✅ Stateless vs stateful operations
