---
title: Primitive Streams
subtitle: IntStream, LongStream and DoubleStream — why they exist, boxing overhead, sum/average/max/min, summaryStatistics, boxed() and OptionalInt.
order: 13
---

## Introduction

One of the most underrated Java 8 topics. Many developers know Streams, but few understand **why primitive streams exist**. This is asked frequently in interviews:

> [!QUESTION] Interviewer
> Why do we have `IntStream` when we already have `Stream<Integer>`?

If you answer this well, it shows you understand Java internals. By the end of this chapter you'll master `IntStream`, `LongStream`, `DoubleStream`, boxing and unboxing, `boxed()`, `mapToInt()` / `mapToLong()` / `mapToDouble()`, `sum()`, `average()`, `max()`, `min()` and `summaryStatistics()`.

## Why Primitive Streams?

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);

numbers.stream()
       .reduce(0, Integer::sum);
```

This works. But internally Java is constantly converting back and forth:

```flow-h Boxing and unboxing on every step
Integer
: unbox
int
: box
Integer
: unbox
int
: box
Integer
```

This has overhead.

### What is Boxing?

Converting `int` → `Integer`:

```java
int x = 10;
Integer y = x;   // compiler converts it automatically
```

### What is Unboxing?

Converting `Integer` → `int`:

```java
Integer x = 10;
int y = x;       // again automatic
```

### Why is this bad?

Imagine **1 crore (10 million) integers**. Every `Integer ↔ int` conversion takes time (and boxed values take extra memory). **Primitive streams avoid this.**

## Meet IntStream

Instead of `Stream<Integer>`, use **`IntStream`**: primitive values only — no boxing, no unboxing, better performance.

### Creating an IntStream

```java
IntStream.of(1, 2, 3, 4, 5)
         .forEach(System.out::println);
```

```output
1
2
3
4
5
```

## Numeric Operations

### sum()

Instead of `numbers.stream().reduce(0, Integer::sum)`, use:

```java
IntStream.of(1, 2, 3, 4, 5)
         .sum();
```

```output
15
```

Cleaner. Faster.

### average()

```java
double avg = IntStream.of(2, 4, 6, 8)
        .average()
        .orElse(0);
```

```output
5.0
```

Notice: `average()` returns **`OptionalDouble`**, because the stream could be empty.

### max() and min()

```java
int max = IntStream.of(5, 8, 2, 10)
        .max()
        .orElseThrow();   // 10 — max() returns OptionalInt

int min = IntStream.of(5, 8, 2, 10)
        .min()
        .orElseThrow();   // 2
```

> [!NOTE]
> `OptionalInt.orElseThrow()` with no arguments is Java 10+. On Java 8 use `.getAsInt()`.

### count()

```java
long count = IntStream.of(1, 2, 3)
        .count();
```

```output
3
```

### summaryStatistics()

One of my favourites.

```java
IntSummaryStatistics stats = IntStream.of(2, 5, 8, 10)
        .summaryStatistics();

System.out.println(stats);
```

```output
IntSummaryStatistics{count=4, sum=25, min=2, average=6.250000, max=10}
```

Instead of `sum()`, `count()`, `max()`, `min()` and `average()` — five traversals — you get everything in **one traversal**.

## Converting To and From Primitive Streams

### mapToInt()

```java
class Employee {
    int age;
}

employees.stream()
         .mapToInt(Employee::getAge)
         .sum();
```

```flow-h
Stream<Employee>
: mapToInt(Employee::getAge)
IntStream
```

### mapToLong()

```java
class File {
    long size;
}

files.stream()
     .mapToLong(File::getSize)
     .sum();
```

### mapToDouble()

```java
class Employee {
    double salary;
}

employees.stream()
         .mapToDouble(Employee::getSalary)
         .average();
```

### boxed()

Suppose you have `IntStream.of(1, 2, 3, 4)` but need a `Stream<Integer>`:

```java
IntStream.of(1, 2, 3, 4)
         .boxed();   // now a Stream<Integer>
```

Very useful — for example, to collect into a `List`:

```java
List<Integer> list = IntStream.rangeClosed(1, 5)
        .boxed()
        .toList();
```

```output
[1, 2, 3, 4, 5]
```

(`Stream.toList()` is Java 16+; on Java 8 use `.collect(Collectors.toList())`.)

### The Conversion Cycle

```flow-h Very common in interviews
Stream<Employee>
: mapToInt()
IntStream
: boxed()
Stream<Integer>
```

## LongStream and DoubleStream

Same idea.

```java
LongStream.of(100L, 200L, 300L)
          .sum();

DoubleStream.of(12.5, 8.5, 15.2)
            .average();
```

## Real Spring Boot Examples

```java
// Total salary
double total = employees.stream()
        .mapToDouble(Employee::getSalary)
        .sum();

// Average age
double avg = employees.stream()
        .mapToInt(Employee::getAge)
        .average()
        .orElse(0);

// Largest file
long max = files.stream()
        .mapToLong(File::getSize)
        .max()
        .orElse(0);

// Invoice total
double invoiceTotal = invoices.stream()
        .mapToDouble(Invoice::getAmount)
        .sum();
```

## Interview Questions

### Q1. Difference between Stream<Integer> and IntStream?

`IntStream` stores primitive `int` values and avoids boxing/unboxing.

### Q2. Why use mapToInt()?

Because it returns an `IntStream`, allowing efficient numeric operations like `sum()`, `average()`, `max()` and `min()`.

### Q3. What does boxed() do?

Converts `IntStream` → `Stream<Integer>`.

### Q4. Difference between sum() and reduce(Integer::sum)?

Use `sum()` whenever possible. It's simpler and optimized.

### Q5. What does summaryStatistics() return?

Everything — **count, sum, average, min and max** — in one traversal.

## Practice Problems

Using `IntStream.of(2, 5, 8, 10, 15)`:

1. Sum
2. Average
3. Maximum
4. Minimum
5. Count
6. Summary statistics
7. Square every number
8. Cube every number
9. Filter even numbers
10. Convert to `List<Integer>`

```java
class Employee {
    int id;
    int age;
    double salary;
}
```

1. Total salary
2. Average salary
3. Highest salary
4. Lowest salary
5. Total age
6. Average age
7. Highest age
8. Lowest age
9. Salary statistics
10. Age statistics

### 5+ Years Interview Challenge

Return a `Map<String, DoubleSummaryStatistics>` where key = department and value = salary statistics (count, sum, min, average, max).

```java
Map<String, DoubleSummaryStatistics> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.summarizingDouble(Employee::getSalary)
        ));
```

An excellent example of combining `groupingBy()`, primitive collectors and summary statistics. It's concise, efficient, and commonly seen in reporting code.

## Senior Java Tips

### 1. Choose the right stream type

| Stream type | Element type |
| --- | --- |
| `Stream<T>` | Objects |
| `IntStream` | `int` |
| `LongStream` | `long` |
| `DoubleStream` | `double` |

Using primitive streams avoids unnecessary boxing and unboxing.

### 2. Prefer specialized numeric methods

Instead of `stream.mapToInt(...).reduce(0, Integer::sum)`, write `stream.mapToInt(...).sum()`. It's more readable and optimized.

### 3. Remember the Optional variants

Primitive streams return specialized optionals — **`OptionalInt`**, **`OptionalLong`** and **`OptionalDouble`**. These exist to avoid boxing primitive values into `Optional<Integer>`, `Optional<Long>` and `Optional<Double>`.

## Chapter Summary

- ✅ Why primitive streams exist — boxing/unboxing overhead
- ✅ `IntStream`, `LongStream`, `DoubleStream`
- ✅ `sum()`, `average()`, `max()`, `min()`, `count()`
- ✅ `summaryStatistics()` — everything in one pass
- ✅ `mapToInt()` / `mapToLong()` / `mapToDouble()` and `boxed()`
- ✅ `OptionalInt`, `OptionalLong`, `OptionalDouble`
