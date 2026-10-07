---
title: Collectors
subtitle: Turning streams into results — toList, toSet, toMap (and duplicate keys), joining, counting, summing, averaging and summarizing.
order: 7
---

## Introduction

Up until now you've learned how to filter, transform, sort, de-duplicate and reduce data. Now you'll learn how to **collect the results** — which is what you'll do in 90% of real Spring Boot applications. Almost every REST API pipeline ends with `.collect(...)`.

By the end of this chapter you'll master `collect()`, `Collectors.toList()`, `toSet()`, `toMap()`, `joining()`, `counting()`, `summingInt()`, `averagingInt()` and `summarizingInt()`.

## What is collect()?

Everything you've learned so far produced a **Stream**:

```java
numbers.stream()
       .filter(n -> n % 2 == 0)   // still a Stream
```

If you want a result like a `List`, `Set`, `Map`, `String` or statistics, you use **`collect()`**.

```flow-h
Stream
Collector
Final container
```

## Collectors.toList()

The most commonly used collector.

```java
List<Integer> even = numbers.stream()
        .filter(n -> n % 2 == 0)
        .collect(Collectors.toList());
```

```output
[2, 4, 6, 8]
```

In Java 16+ you'll also see:

```java
List<Integer> even = numbers.stream()
        .filter(n -> n % 2 == 0)
        .toList();
```

> [!TIP]
> **Interview tip:** `.collect(Collectors.toList())` is Java 8+ and typically returns a **mutable** list (an `ArrayList`, though not guaranteed). `.toList()` is Java 16+ and returns an **unmodifiable** list. Know both.

## Collectors.toSet()

Removes duplicates automatically.

```java
List<Integer> numbers = Arrays.asList(2, 5, 2, 8, 5);

Set<Integer> set = numbers.stream()
        .collect(Collectors.toSet());

System.out.println(set);
```

```output
[2, 5, 8]
```

> [!NOTE]
> The resulting `HashSet` does **not** guarantee insertion order.

## Collectors.toMap()

One of the most asked interview topics.

```java
class Employee {
    int id;
    String name;
}
```

Create `1 → John`, `2 → Alex`, `3 → David`:

```java
Map<Integer, String> map = employees.stream()
        .collect(Collectors.toMap(
                Employee::getId,
                Employee::getName
        ));
```

```output
{1=John, 2=Alex, 3=David}
```

### Duplicate Key Problem

Suppose two employees share id `1` (John and Alex):

```java
Collectors.toMap(Employee::getId, Employee::getName)
```

```output
IllegalStateException: Duplicate key 1 (attempted merging values John and Alex)
```

**Solution** — provide a merge function:

```java
// Keep first
Collectors.toMap(Employee::getId, Employee::getName, (existing, newValue) -> existing)

// Keep last
Collectors.toMap(Employee::getId, Employee::getName, (existing, newValue) -> newValue)
```

## Collectors.joining()

Join strings.

```java
List<String> names = Arrays.asList("John", "Alex", "David");

names.stream().collect(Collectors.joining());               // JohnAlexDavid
names.stream().collect(Collectors.joining(", "));           // John, Alex, David
names.stream().collect(Collectors.joining(", ", "[", "]")); // [John, Alex, David]
```

| Form | Output |
| --- | --- |
| `joining()` | `JohnAlexDavid` |
| `joining(", ")` | `John, Alex, David` |
| `joining(", ", "[", "]")` | `[John, Alex, David]` |

## Collectors.counting()

Instead of `numbers.stream().count()`, you can do:

```java
numbers.stream()
       .collect(Collectors.counting());
```

```output
5
```

Usually you'll see `counting()` **inside grouping operations**, covered in the next chapter.

## Summing, Averaging and Summarizing

### summingInt()

```java
int total = employees.stream()
        .collect(Collectors.summingInt(Employee::getAge));
```

```output
132
```

### averagingInt()

```java
double avg = employees.stream()
        .collect(Collectors.averagingInt(Employee::getAge));
```

```output
26.4
```

### summarizingInt()

```java
IntSummaryStatistics stats = employees.stream()
        .collect(Collectors.summarizingInt(Employee::getAge));

System.out.println(stats);
```

```output
IntSummaryStatistics{count=5, sum=132, min=20, average=26.400000, max=35}
```

Instead of separate `sum()`, `average()`, `max()`, `min()` and `count()` calls, you get **everything in one pass** (`stats.getMax()`, `stats.getAverage()`, …).

### Product Example

```java
class Product {
    String name;
    double price;
}

double total = products.stream()
        .collect(Collectors.summingDouble(Product::getPrice));

double avg = products.stream()
        .collect(Collectors.averagingDouble(Product::getPrice));

DoubleSummaryStatistics stats = products.stream()
        .collect(Collectors.summarizingDouble(Product::getPrice));
```

## Full Pipeline Example

Requirement: salary > 50k → sort descending → get names → join by comma.

```java
String names = employees.stream()
        .filter(e -> e.getSalary() > 50000)
        .sorted(Comparator.comparing(Employee::getSalary).reversed())
        .map(Employee::getName)
        .collect(Collectors.joining(", "));
```

With Alex 70000, David 60000, John 50000:

```output
Alex, David
```

John is excluded because `50000 > 50000` is false. This is production-level code.

## Real Spring Boot Examples

```java
// Employee IDs
List<Integer> ids = employees.stream()
        .map(Employee::getId)
        .toList();

// Employee names
Set<String> names = employees.stream()
        .map(Employee::getName)
        .collect(Collectors.toSet());

// ID → Employee map
Map<Integer, Employee> map = employees.stream()
        .collect(Collectors.toMap(Employee::getId, Function.identity()));

// CSV export
String csv = employees.stream()
        .map(Employee::getName)
        .collect(Collectors.joining(","));
```

### What is Function.identity()?

Instead of writing `e -> e`, you can write **`Function.identity()`** — both mean *"use the object itself as the value."* So `Collectors.toMap(Employee::getId, Function.identity())` creates:

```output
1 -> Employee{id=1, name=John}
2 -> Employee{id=2, name=Alex}
```

A very common interview question.

## collect() vs reduce()

| collect() | reduce() |
| --- | --- |
| Produces a container | Produces one value |
| List, Set, Map, statistics | Sum, product, max, min |

Remember: **`collect()` builds a collection; `reduce()` builds a single result.**

## Interview Questions

### Q1. Why use Collectors.toMap() instead of a loop?

Cleaner, declarative, and integrates naturally into Stream pipelines.

### Q2. What happens if duplicate keys exist?

`IllegalStateException`, unless you provide a merge function.

### Q3. Difference between count() and Collectors.counting()?

- `count()` is a terminal Stream operation.
- `counting()` is a collector and is especially useful inside `groupingBy()`.

### Q4. When should you use summarizingInt()?

When you need count, sum, average, min and max in one traversal.

### Q5. What does Function.identity() do?

Returns the object itself. It's equivalent to `x -> x`.

## Practice Problems

```java
List<Integer> numbers = Arrays.asList(2, 5, 8, 2, 10, 5, 12);
```

1. Collect even numbers into a `List`.
2. Collect unique numbers into a `Set`.
3. Join all numbers into a comma-separated `String`.
4. Count the elements using `Collectors.counting()`.
5. Get summary statistics using `summarizingInt()`.

```java
class Employee {
    int id;
    String name;
    String department;
    int age;
    double salary;
}
```

1. Get a `List<String>` of employee names.
2. Get a `Set<String>` of departments.
3. Create a `Map<Integer, Employee>` using ID as the key.
4. Create a `Map<Integer, String>` of ID → name.
5. Find the total salary.
6. Find the average salary.
7. Find salary statistics.
8. Join all employee names with `" | "`.
9. Create a map with duplicate IDs handled by keeping the latest employee.
10. Create a map using `Function.identity()`.

### Senior Interview Challenge (5+ Years)

Filter employees with salary > 60,000, sort by salary descending, map to names, and join with `" -> "`:

```java
String result = employees.stream()
        .filter(e -> e.getSalary() > 60_000)
        .sorted(Comparator.comparing(Employee::getSalary).reversed())
        .map(Employee::getName)
        .collect(Collectors.joining(" -> "));
```

## Chapter Summary

- ✅ `collect()` and the `Collector` concept
- ✅ `toList()` / `toSet()` (and Java 16 `Stream.toList()`)
- ✅ `toMap()` and handling duplicate keys
- ✅ `joining()` with separators, prefix and suffix
- ✅ `counting()`, `summingInt()`, `averagingInt()`, `summarizingInt()`
- ✅ `Function.identity()`
- ✅ `collect()` vs `reduce()`
