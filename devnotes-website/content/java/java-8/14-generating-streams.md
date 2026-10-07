---
title: Generating Streams
subtitle: Creating streams without a collection — range(), rangeClosed(), iterate(), generate(), infinite streams, Fibonacci, UUIDs and business days.
order: 14
---

## Introduction

Until now we've been processing existing collections:

```java
List<Employee> employees = ...;
employees.stream();
```

But what if there's **no collection**? How do you generate numbers from 1 to 100, a Fibonacci sequence, prime numbers, infinite random numbers, timestamps or test data? This is where **stream generation** comes in.

By the end of this chapter you'll master `IntStream.range()`, `IntStream.rangeClosed()`, `Stream.iterate()`, `Stream.generate()`, infinite streams, Fibonacci generation, even/odd sequences and random numbers.

### Stream Sources So Far

So far we've created streams from `List.stream()`, `Arrays.stream()` and `Stream.of()`. Now we'll create streams **without any existing data**.

## IntStream.range()

Generate a sequence of numbers.

```java
IntStream.range(1, 6)
         .forEach(System.out::println);
```

```output
1
2
3
4
5
```

Notice: **6 is NOT included.** Think of it like a `for` loop — exactly the same:

```java
for (int i = 1; i < 6; i++) {
    System.out.println(i);
}
```

## rangeClosed()

Now include the end value.

```java
IntStream.rangeClosed(1, 6)
         .forEach(System.out::println);
```

```output
1
2
3
4
5
6
```

Equivalent to:

```java
for (int i = 1; i <= 6; i++) {
    System.out.println(i);
}
```

### range() vs rangeClosed()

| | range() | rangeClosed() |
| --- | --- | --- |
| End value | Exclusive | Inclusive |
| `(1, 5)` gives | `1 2 3 4` | `1 2 3 4 5` |

This is asked surprisingly often.

## Range Examples

### Sum 1 to 100 — without loops

```java
int sum = IntStream.rangeClosed(1, 100)
        .sum();

System.out.println(sum);
```

```output
5050
```

### Even and Odd Numbers

```java
// Even: 2, 4, 6, ... 20
IntStream.rangeClosed(1, 20)
         .filter(n -> n % 2 == 0)
         .forEach(System.out::println);

// Odd: 1, 3, 5, ... 19
IntStream.rangeClosed(1, 20)
         .filter(n -> n % 2 != 0)
         .forEach(System.out::println);
```

### Square Numbers

```java
IntStream.rangeClosed(1, 5)
         .map(n -> n * n)
         .forEach(System.out::println);
```

```output
1
4
9
16
25
```

## Stream.iterate()

Creates a sequence **based on the previous value**.

```java
Stream.iterate(seed, nextFunction)
```

```flow-h
Seed
: f
Next
: f
Next
: f
Next …
```

```java
Stream.iterate(1, n -> n + 1)
      .limit(5)
      .forEach(System.out::println);
```

```output
1
2
3
4
5
```

### Why limit()?

This never ends:

```java
Stream.iterate(1, n -> n + 1)
```

Without `limit()` the stream is **infinite**. Always combine infinite streams with `.limit(...)`, otherwise your program won't terminate.

### Even Numbers and Multiples

```java
// 2, 4, 6, 8, ... 20
Stream.iterate(2, n -> n + 2)
      .limit(10)
      .forEach(System.out::println);

// 5, 10, 15, ... 50
Stream.iterate(5, n -> n + 5)
      .limit(10)
      .forEach(System.out::println);
```

## Fibonacci Series

**Interview favourite.** Instead of storing previous numbers manually:

```java
Stream.iterate(
        new int[]{0, 1},
        arr -> new int[]{arr[1], arr[0] + arr[1]}
)
      .limit(10)
      .map(arr -> arr[0])
      .forEach(System.out::println);
```

```output
0
1
1
2
3
5
8
13
21
34
```

### How It Works

Each array stores **[current, next]**:

```flow-h Take arr[0] from each step
[0, 1]
[1, 1]
[1, 2]
[2, 3]
[3, 5]
```

Very elegant.

## Stream.generate()

Unlike `iterate()`, this **doesn't depend on previous values**. Every element is created independently.

```java
Stream.generate(Supplier)
```

```java
Stream.generate(() -> "Hello")
      .limit(5)
      .forEach(System.out::println);
```

```output
Hello
Hello
Hello
Hello
Hello
```

### Random Numbers

```java
Stream.generate(Math::random)
      .limit(5)
      .forEach(System.out::println);
```

```output
0.62…
0.18…
0.94…
…
```

Every run is different.

### UUID Generation

Very common in backend development.

```java
Stream.generate(UUID::randomUUID)
      .limit(3)
      .forEach(System.out::println);
```

```output
4d1…
ab9…
ff2…
```

### Timestamp Generation

```java
Stream.generate(LocalDateTime::now)
      .limit(3)
      .forEach(System.out::println);
```

Useful for testing.

## iterate() vs generate()

| iterate() | generate() |
| --- | --- |
| Depends on the previous value | Independent values |
| Creates sequences | Creates random / repeated values |
| Fibonacci, arithmetic progressions | UUIDs, random numbers |

```flow
? Need the previous value? | Yes: iterate() | No: generate()
```

## Java 9 Enhancement

Java 9 introduced a three-argument `iterate()` with a stop condition:

```java
Stream.iterate(1, n -> n <= 10, n -> n + 1)
```

No `limit()` required. Unfortunately, this isn't available in Java 8 — for Java 8 interviews, know the original two-argument version.

## Real Spring Boot Examples

```java
// Generate test IDs
List<String> ids = Stream.generate(UUID::randomUUID)
        .limit(100)
        .map(UUID::toString)
        .toList();

// Generate dates — next 7 days
Stream.iterate(LocalDate.now(), date -> date.plusDays(1))
      .limit(7)
      .forEach(System.out::println);
```

### Retry Delays (Exponential Backoff)

```java
Stream.iterate(1, n -> n * 2)
      .limit(5)
      .forEach(System.out::println);
```

```output
1
2
4
8
16
```

## Interview Questions

### Q1. Difference between range() and rangeClosed()?

- `range()` excludes the end value.
- `rangeClosed()` includes the end value.

### Q2. Difference between iterate() and generate()?

- `iterate()` depends on the previous element.
- `generate()` creates independent elements.

### Q3. Why use limit() with generate()?

Because `generate()` produces an infinite stream.

### Q4. Can iterate() create Fibonacci?

Yes — it's one of its most common interview examples.

### Q5. Which method generates random numbers?

`Stream.generate(Math::random)`.

## Practice Problems

**Using `range()` / `rangeClosed()`:**

1. Print numbers 1–100.
2. Print even numbers from 1–50.
3. Print odd numbers from 1–50.
4. Print squares of numbers 1–10.
5. Find the sum of 1–100.
6. Count numbers divisible by 3.
7. Print multiples of 7.
8. Find the maximum square.
9. Convert the range to `List<Integer>`.
10. Print numbers in reverse (hint: `boxed()`, `sorted(Comparator.reverseOrder())`).

**Using `iterate()`:**

1. Generate the first 20 natural numbers.
2. Generate the first 15 even numbers.
3. Generate the first 10 multiples of 3.
4. Generate powers of 2.
5. Generate Fibonacci numbers.

**Using `generate()`:**

1. Generate 10 random numbers.
2. Generate 5 UUIDs.
3. Generate 10 `"Java"` strings.
4. Generate 5 timestamps.
5. Generate random boolean values.

### 5+ Years Interview Challenge

Generate the next 30 business days (Monday to Friday only), starting from today.

```java
List<LocalDate> businessDays = Stream.iterate(LocalDate.now(), date -> date.plusDays(1))
        .filter(date -> date.getDayOfWeek() != DayOfWeek.SATURDAY
                     && date.getDayOfWeek() != DayOfWeek.SUNDAY)
        .limit(30)
        .toList();
```

This demonstrates `iterate()`, `filter()`, `limit()` and the Java Time API. Because streams are lazy, the infinite `iterate()` is safe here — `limit(30)` stops it once 30 business days have passed the filter.

## Senior Java Tips

### 1. Prefer range() for numeric sequences

Instead of `Stream.iterate(1, n -> n + 1).limit(100)`, use `IntStream.rangeClosed(1, 100)`. It's simpler, clearer and more efficient (no boxing).

### 2. Be careful with infinite streams

Both `iterate()` and `generate()` can produce infinite streams. Always ask yourself: *"How does this stream stop?"* Usually the answer is `limit()` (or the Java 9 `iterate()` overload).

### 3. Choose the right generator

| Need | Use |
| --- | --- |
| Numeric ranges | `range()` / `rangeClosed()` |
| Sequential values | `iterate()` |
| Independent values | `generate()` |

## Chapter Summary

- ✅ `range()` (end exclusive) vs `rangeClosed()` (end inclusive)
- ✅ `iterate()` — each value from the previous one
- ✅ `generate()` — independent values from a `Supplier`
- ✅ Infinite streams need `limit()`
- ✅ Fibonacci with an `int[]` pair
- ✅ Java 9's three-argument `iterate()`
