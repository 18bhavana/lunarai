---
title: Custom Collectors
subtitle: The secret behind Collectors.toList() — supplier, accumulator, combiner, finisher, characteristics, and writing your own with Collector.of().
order: 18
---

## Introduction

Most Java developers use `Collectors.toList()`, `Collectors.toSet()` and `Collectors.groupingBy()`. Very few know **how these collectors are implemented**.

If you understand this chapter, you'll understand how the entire `collect()` API works internally. This topic is commonly asked in 7–10 years Java interviews.

## What is a Collector?

When you write:

```java
employees.stream()
         .collect(Collectors.toList());
```

Java doesn't magically know how to build a `List`. A **Collector** tells the Stream API:

1. How to **create** a result container.
2. How to **add** elements.
3. How to **merge** partial results.
4. How to **return** the final result.

```flow-h
Stream
Collector
Result
```

## Collector Lifecycle

Every collector has **five parts**:

```flow-h
Supplier
Accumulator
Combiner
Finisher
Characteristics
```

### Supplier

**Where should collected data be stored?** e.g. `ArrayList::new` creates an empty list — the start is `[]`.

### Accumulator

**How should each element be added?** e.g. `List::add`.

```flow-h
[]
: add John
[John]
: add Alex
[John, Alex]
```

### Combiner

**Only used for parallel streams.** Suppose Thread 1 has `[John, Alex]` and Thread 2 has `[Bob, David]`:

```java
(left, right) -> {
    left.addAll(right);
    return left;
}
```

Result: `[John, Alex, Bob, David]`.

### Finisher

**Do we need to transform the final result?** Sometimes — e.g. `ArrayList` → immutable list with `Collections::unmodifiableList`. If no transformation is required, the finisher is `Function.identity()`.

### Characteristics

Hints that tell the Stream API how the collector behaves:

| Characteristic | Meaning |
| --- | --- |
| `IDENTITY_FINISH` | The accumulation container **is** the final result — no finisher required |
| `UNORDERED` | Order doesn't matter (useful for a `Set`) |
| `CONCURRENT` | Multiple threads can safely accumulate into the same container simultaneously |

## Collector.of()

This is how you create your own collector:

```java
Collector.of(
        supplier,
        accumulator,
        combiner,
        finisher
);
```

There is also a three-argument form (supplier, accumulator, combiner) which has no finisher and is automatically `IDENTITY_FINISH`.

### Example 1 — Custom List Collector

```java
Collector<String, List<String>, List<String>> collector =
        Collector.of(
                ArrayList::new,
                List::add,
                (left, right) -> {
                    left.addAll(right);
                    return left;
                }
        );

List<String> names = Stream.of("John", "Alex", "Bob")
        .collect(collector);
```

```output
[John, Alex, Bob]
```

### Example 2 — Uppercase Collector

Requirement: collect all names in uppercase.

```java
Collector<String, List<String>, List<String>> collector =
        Collector.of(
                ArrayList::new,
                (list, name) -> list.add(name.toUpperCase()),
                (left, right) -> {
                    left.addAll(right);
                    return left;
                }
        );
```

```output
[JOHN, ALEX, BOB]
```

Notice the transformation happens **during accumulation**.

### Example 3 — CSV Collector

Input `John`, `Alex`, `Bob` → output `John,Alex,Bob`.

```java
Collector<String, StringJoiner, String> csvCollector =
        Collector.of(
                () -> new StringJoiner(","),
                StringJoiner::add,
                StringJoiner::merge,
                StringJoiner::toString
        );

String csv = Stream.of("John", "Alex", "Bob")
        .collect(csvCollector);
```

```output
John,Alex,Bob
```

### Example 4 — Immutable List Collector

```java
Collector<String, List<String>, List<String>> immutableCollector =
        Collector.of(
                ArrayList::new,
                List::add,
                (left, right) -> {
                    left.addAll(right);
                    return left;
                },
                List::copyOf
        );
```

Result: an immutable list. (`List::copyOf` is Java 10+; on Java 8 use `Collections::unmodifiableList`.)

## How Collectors.toList() Works (Simplified)

Conceptually, it's similar to:

```java
Collector.of(
        ArrayList::new,
        List::add,
        (left, right) -> {
            left.addAll(right);
            return left;
        }
)
```

The actual JDK implementation contains additional optimizations, but this captures the core idea.

## Real Spring Boot Examples

### Uppercase Employee Names

Requirement: collect all employee names in uppercase. Instead of:

```java
employees.stream()
         .map(Employee::getName)
         .map(String::toUpperCase)
         .toList();
```

you could create a custom collector that performs the uppercase conversion while accumulating. This is useful when you want to **encapsulate reusable collection logic**.

### Pipe-Separated Names

Collect all employee names into a single string `John | Alex | Bob`:

```java
Collector<String, StringJoiner, String> collector =
        Collector.of(
                () -> new StringJoiner(" | "),
                StringJoiner::add,
                StringJoiner::merge,
                StringJoiner::toString
        );
```

## Parallel Stream Example

Suppose Thread A handles `John, Alex` and Thread B handles `Bob, David`:

```flow That's why the combiner is mandatory for parallel collection
Thread A
: supplier
[]
: accumulator
[John] → [John, Alex]
---
Thread B
: supplier
[]
: accumulator
[Bob] → [Bob, David]
```

```flow-h Combiner
[John, Alex] + [Bob, David]
[John, Alex, Bob, David]
```

## Interview Questions

### Q1. What are the five parts of a Collector?

Supplier, accumulator, combiner, finisher and characteristics.

### Q2. When is the combiner used?

Mainly during parallel stream execution. Sequential streams usually don't need it.

### Q3. Why is the finisher needed?

To convert the intermediate container into the final result — e.g. `ArrayList` → immutable list.

### Q4. What does IDENTITY_FINISH mean?

The accumulator type and result type are the same. No finishing transformation is needed.

### Q5. Can we write our own Collector?

Absolutely — using `Collector.of(...)` (or by implementing the `Collector` interface).

## Practice Problems

Create custom collectors for:

1. Collect all strings into uppercase.
2. Collect integers into a comma-separated string.
3. Collect employee names into a `TreeSet`.
4. Collect only unique skills.
5. Collect names into an immutable list.
6. Collect salaries into a sorted list.
7. Collect employees into a map: ID → Employee.
8. A collector that trims whitespace from all strings before storing them.
9. A collector that stores only strings longer than five characters.
10. A collector that joins strings with `" -> "`.

### 5+ Years Interview Challenge

Return a `Map<String, List<String>>` where key = department and value = uppercase employee names, with the final list immutable.

```java
Map<String, List<String>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.collectingAndThen(
                        Collectors.mapping(
                                e -> e.getName().toUpperCase(),
                                Collectors.toList()
                        ),
                        List::copyOf
                )
        ));
```

This combines `groupingBy()`, `mapping()` and `collectingAndThen()` into a reusable, production-style solution.

## Senior Java Tips

### 1. Prefer built-in collectors first

The JDK collectors are highly optimized and well-tested. Only write a custom collector when you have reusable collection logic that isn't covered by existing collectors.

### 2. Make your combiner correct

Even if your application currently uses sequential streams, your collector should still have a valid combiner so it behaves correctly with parallel streams.

### 3. Keep collectors focused

A collector should have a single responsibility. If it starts performing validation, database access, logging and transformation all at once, it's a sign the logic belongs elsewhere.

## Chapter Summary

- ✅ A collector = supplier + accumulator + combiner + finisher + characteristics
- ✅ `IDENTITY_FINISH`, `UNORDERED`, `CONCURRENT`
- ✅ `Collector.of()` with three or four functions
- ✅ Custom list, uppercase, CSV and immutable collectors
- ✅ How `Collectors.toList()` works conceptually
- ✅ Why the combiner matters for parallel streams
