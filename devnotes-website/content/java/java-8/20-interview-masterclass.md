---
title: Java 8 Interview Masterclass
subtitle: How interviewers think — core, Stream, Optional, functional interface, parallel, collector, method reference and internals questions, plus output-based puzzles.
order: 20
---

## Introduction

The previous chapters covered how Java 8 works. This chapter is about **how interviewers think**.

Companies like TCS Digital, Infosys (Specialist Programmer), Accenture, Capgemini, Deloitte, Cognizant, IBM, Oracle, JPMorgan Chase, Goldman Sachs, Walmart and Amazon usually don't ask *"What is the Stream API?"* Instead they ask:

- *"Why did Java introduce Streams?"*
- *"Why can't a Stream be reused?"*
- *"When would `parallelStream()` make performance worse?"*

The goal is to answer these confidently.

## Core Java 8 Questions

### Q1. Why was the Stream API introduced?

Before Java 8:

```java
for (Employee e : employees) {
    if (e.getSalary() > 50000) {
        System.out.println(e.getName());
    }
}
```

**Problems:** too much boilerplate, hard to parallelize, external iteration.

**Streams introduced:** functional programming, internal iteration, lazy evaluation, easy parallel processing and cleaner code.

### Q2. Difference between Collection and Stream?

| Collection | Stream |
| --- | --- |
| Stores data | Processes data |
| Can be reused | Single use |
| Eager | Lazy |
| Mutable | Doesn't modify the source |

### Q3. Why are Streams lazy?

Because Java delays execution until it knows exactly what result is required. Benefits: better performance, pipeline optimization and short-circuiting.

### Q4. Why can't Streams be reused?

```java
Stream<String> stream = names.stream();

stream.count();
stream.count();   // IllegalStateException
```

A Stream represents a **one-time traversal** of a data source.

### Q5. Difference between intermediate and terminal operations?

| Intermediate | Terminal |
| --- | --- |
| `filter`, `map`, `sorted`, `distinct`, `limit`, `skip` | `collect`, `reduce`, `count`, `max`, `min`, `forEach`, `findFirst` |
| Lazy — return a new Stream | Trigger execution and consume the stream |

## Stream Questions

### Q6. Difference between map() and flatMap()?

```flow
map()
Employee
: one → one
Name
---
flatMap()
Employee
: one → many
Java · Spring · SQL
```

### Q7. Difference between filter() and map()?

| filter() | map() |
| --- | --- |
| Removes elements | Transforms elements |
| Takes a `Predicate` (returns `boolean`) | Takes a `Function` (returns a new value) |

### Q8. Difference between reduce() and collect()?

- `reduce()`: **many → one** (sum, max, min).
- `collect()`: **many → collection**.

### Q9. Difference between findFirst() and findAny()?

- `findFirst()` returns the first element and respects encounter order.
- `findAny()` returns any matching element and is faster in parallel streams.

### Q10. Difference between sorted() and max()?

Need only the maximum? Use `max()`, not `sorted().findFirst()`. `max()` is **O(n)**; sorting is **O(n log n)**.

## Optional Questions

### Q11. Difference between of() and ofNullable()?

| of() | ofNullable() |
| --- | --- |
| Doesn't allow `null` | Allows `null` |

### Q12. Difference between orElse() and orElseGet()?

**The most asked Optional question.**

- `orElse()` — its argument is **always evaluated**, even if a value is present.
- `orElseGet()` — the supplier runs **only if the Optional is empty**.

### Q13. Why avoid Optional.get()?

Because it throws `NoSuchElementException`. Prefer `orElse()`, `orElseThrow()` or `ifPresent()`.

## Functional Interface Questions

### Q14. What is a functional interface?

An interface with exactly one abstract method — e.g. `Predicate`, `Function`, `Consumer`, `Supplier`.

### Q15. Difference between Predicate and Function?

| Predicate | Function |
| --- | --- |
| Returns `boolean` | Returns any object |

### Q16. Difference between Supplier and Consumer?

`Supplier` **produces**; `Consumer` **consumes**.

## Parallel Stream Questions

### Q17. When should we use parallelStream()?

CPU-intensive work, large collections and independent operations.

### Q18. When should we NOT use parallelStream()?

Avoid it for database calls, REST API calls, small collections and shared mutable objects.

### Q19. Which thread pool is used?

`ForkJoinPool.commonPool()`.

### Q20. Difference between forEach() and forEachOrdered()?

- `forEach()` — no order guarantee.
- `forEachOrdered()` — maintains encounter order.

## Collectors Questions

### Q21. Difference between groupingBy() and partitioningBy()?

- `groupingBy()` — unlimited groups.
- `partitioningBy()` — only `true` and `false`.

### Q22. Difference between toList() and collectingAndThen()?

`collectingAndThen()` allows a **finishing transformation** — e.g. List → immutable List.

### Q23. What is a Collector?

An object that knows how to **create**, **accumulate**, **combine** and **finish** results.

## Method Reference Questions

### Q24. Types of method references?

| Type | Example |
| --- | --- |
| Static | `Integer::sum` |
| Instance (specific object) | `printer::print` |
| Instance (arbitrary object) | `String::length` |
| Constructor | `Employee::new` |

## Primitive Stream Questions

### Q25. Why IntStream?

It avoids boxing and unboxing.

### Q26. Stream<Integer> vs IntStream?

The primitive stream is faster and has numeric methods like `sum()` and `average()`.

## Internal Questions

### Q27. What is a Spliterator?

Iterator + splitter. Used internally for parallel streams.

### Q28. Why are Streams efficient?

Because of lazy evaluation, pipeline fusion and short-circuiting.

## Output-Based Questions

### Q29. What does this print?

```java
List<Integer> list = Arrays.asList(1, 2, 3, 4);

list.stream()
    .filter(n -> n % 2 == 0)
    .map(n -> n * 2)
    .forEach(System.out::println);
```

```output
4
8
```

### Q30. What is the return type?

```java
Stream.of("A", "B", "C")
      .findFirst();
```

`Optional<String>`.

### Q31. What does IntStream.range(1, 5) print?

```java
IntStream.range(1, 5)
         .forEach(System.out::println);
```

```output
1
2
3
4
```

### Q32. What does IntStream.rangeClosed(1, 5) print?

```output
1
2
3
4
5
```

## Top 30 Coding Questions Asked in Interviews

1. First non-repeating character
2. Duplicate characters
3. Character frequency
4. Word frequency
5. Second highest salary
6. Nth highest salary
7. Highest salary by department
8. Average salary by department
9. Youngest employee by department
10. Oldest employee by department
11. Count employees by department
12. Partition employees by salary
13. Group employees by age
14. Sort employees by salary
15. Find duplicate numbers
16. Remove duplicates
17. Longest string
18. Shortest string
19. Top 3 salaries
20. Reverse words
21. Group anagrams
22. Count vowels
23. Prime numbers
24. Fibonacci
25. Flatten nested lists
26. Merge two lists
27. Sum all numbers
28. Max/min salary
29. Join strings
30. Convert List → Map

## Senior Interview Questions

### Q33. Why does this fail?

```java
List<Integer> list = new ArrayList<>();

IntStream.rangeClosed(1, 100)
         .parallel()
         .forEach(list::add);
```

`ArrayList` is **not thread-safe** — multiple threads add at once.

### Q34. Why does this work?

```java
.parallel()
.collect(Collectors.toList())
```

Because collectors safely combine partial results.

### Q35. map() vs flatMap() in one line?

**One → one** vs **one → many**.

### Q36. reduce() vs Collectors.reducing()?

One is part of the Stream API; the other is part of the Collector API (used as a downstream collector).

## 5+ Years Rapid Fire

| Question | One-line answer |
| --- | --- |
| Why Streams? | Functional, lazy data processing |
| Why Optional? | Avoid `null` and make absence explicit |
| Why functional interfaces? | Enable lambdas |
| Why method references? | Cleaner lambda syntax |
| Why IntStream? | Avoid boxing/unboxing |
| Why Spliterator? | Parallel traversal |
| Why lazy evaluation? | Better performance |
| Why parallel streams? | CPU-bound parallelism |
| Why groupingBy()? | SQL-like grouping |
| Why flatMap()? | Flatten nested collections |

## Where to Go Next

Java 8 is only one part of a 5+ years Java interview. Natural next topics:

- **Advanced Java:** concurrency and multithreading, the JVM memory model, garbage collection, reflection, advanced generics, serialization, collections internals, `Comparable` vs `Comparator`, `equals()`/`hashCode()`, immutable objects, design patterns, memory leaks, performance tuning and the JIT compiler.
- **Spring Boot:** Spring Core, Boot internals, dependency injection, AOP, Spring Security + JWT, JPA/Hibernate internals, transactions, microservices, Kafka, Redis, Docker and Kubernetes.
- **Daily coding practice:** Streams + DSA + SQL.

## Chapter Summary

- ✅ Core "why" questions — Streams, laziness, single use
- ✅ Stream, Optional and functional interface comparisons
- ✅ Parallel stream and collector questions
- ✅ Method references, primitive streams and internals
- ✅ Output-based questions and the top 30 coding problems
