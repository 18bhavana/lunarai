---
title: Stream Basics
subtitle: What a Stream is, Collection vs Stream, internal iteration, the source → intermediate → terminal pipeline, laziness and reuse.
order: 1
---

## Introduction

**Goal:** by the end of this chapter you should be able to explain Streams in an interview and write simple Stream programs confidently — not just use the API, but understand **how Streams think**.

## What is a Stream?

A **Stream** is a sequence of elements that supports operations (like filtering, mapping, sorting, reducing) to process data **without modifying the original collection**. Think of a stream as a **pipeline** through which data flows.

```flow-h
List
Stream
filter()
map()
sorted()
collect()
Result
```

```java
List<Integer> numbers = Arrays.asList(5, 2, 8, 1, 4);

List<Integer> result = numbers.stream()
        .filter(n -> n % 2 == 0)
        .sorted()
        .collect(Collectors.toList());

System.out.println(result);
```

```output
[2, 4, 8]
```

Notice: the original list is still `[5, 2, 8, 1, 4]`. **Streams never modify it.**

## Why Were Streams Introduced?

Before Java 8:

```java
List<String> names = Arrays.asList("John", "Alex", "David");

List<String> result = new ArrayList<>();

for (String name : names) {
    if (name.startsWith("A")) {
        result.add(name.toUpperCase());
    }
}
```

Java 8:

```java
List<String> result = names.stream()
        .filter(name -> name.startsWith("A"))
        .map(String::toUpperCase)
        .collect(Collectors.toList());
```

Much shorter. More readable. Easier to parallelize.

## Collection vs Stream

| Collection | Stream |
| --- | --- |
| Stores data | Processes data |
| Can add/remove elements | Cannot add/remove elements |
| Reusable | Cannot be reused after a terminal operation |
| Eager | Lazy |
| Supports iteration | Supports functional operations |

```java
// Collection
List<String> list = new ArrayList<>();
list.add("A");
list.add("B");

// Stream
Stream<String> stream = list.stream();
```

The stream does **not store** data. It only **processes** data.

## External vs Internal Iteration

### External Iteration

You control the loop:

```java
for (Integer n : numbers) {
    System.out.println(n);
}
```

You decide the next element, the stopping condition and the iteration logic.

### Internal Iteration

The Stream API controls iteration:

```java
numbers.stream()
       .forEach(System.out::println);
```

You only tell **what** to do. The Stream decides **how** to do it. This is why Streams can support **parallel execution**.

## How a Stream Pipeline Works

```java
List<Integer> numbers = Arrays.asList(2, 5, 8, 9, 10);

numbers.stream()
       .filter(n -> n % 2 == 0)
       .map(n -> n * n)
       .collect(Collectors.toList());
```

```flow Step by step
Original | 2 · 5 · 8 · 9 · 10
: filter(n % 2 == 0)
2 · 8 · 10
: map(n * n)
4 · 64 · 100
: collect()
[4, 64, 100]
```

## Stream Lifecycle

Every Stream has **three stages**:

```flow-h Remember this — it is asked in interviews
Source
Intermediate operations
Terminal operation
```

```java
numbers.stream()        // Source
       .filter(...)     // Intermediate
       .map(...)        // Intermediate
       .collect(...);   // Terminal
```

### Intermediate Operations

These return **another Stream**: `filter()`, `map()`, `sorted()`, `distinct()`, `limit()`, `skip()`, `peek()`.

They are **lazy** — nothing executes until a terminal operation is called.

### Terminal Operations

These produce the **final result**: `collect()`, `count()`, `reduce()`, `forEach()`, `findFirst()`, `anyMatch()`, `allMatch()`, `toArray()`.

After a terminal operation, the Stream is **closed**.

## Streams Are Lazy (Very Important)

```java
numbers.stream()
       .filter(n -> {
           System.out.println(n);
           return n % 2 == 0;
       });
```

**Output: nothing.** Why? Because there is no terminal operation. Now:

```java
numbers.stream()
       .filter(n -> {
           System.out.println(n);
           return n % 2 == 0;
       })
       .count();
```

```output
2
5
8
9
10
```

The terminal operation (`count()`) **triggers execution**.

## Streams Cannot Be Reused

**Wrong:**

```java
Stream<Integer> stream = numbers.stream();
stream.count();
stream.forEach(System.out::println);
```

```output
IllegalStateException: stream has already been operated upon or closed
```

**Correct:**

```java
numbers.stream().count();
numbers.stream().forEach(System.out::println);
```

Always create a new Stream when needed.

## Ways to Create Streams

| Source | Code |
| --- | --- |
| From a List | `names.stream();` |
| From an array | `Arrays.stream(arr);` |
| Using `Stream.of()` | `Stream.of(1, 2, 3, 4, 5);` |
| Empty stream | `Stream.empty();` |

```java
List<String> names = Arrays.asList("A", "B", "C");
names.stream();

String[] arr = {"A", "B", "C"};
Arrays.stream(arr);
```

`Stream.empty()` is useful when you want to return an empty Stream instead of `null`.

## Interview Questions

### Q1. Can Streams modify a Collection?

No. Streams process data and produce a new result. They do not modify the source collection.

### Q2. Why are Streams lazy?

To avoid unnecessary computation. Operations are executed only when a terminal operation is invoked, enabling optimizations and efficient processing.

### Q3. Can a Stream be reused?

No. After a terminal operation, the Stream is closed and cannot be used again.

### Q4. What are the three parts of a Stream pipeline?

Source, intermediate operations and a terminal operation.

### Q5. Why are Streams faster than loops?

**Streams are not always faster.** Sequential Streams often have similar performance to loops. Their advantages are readability, composability, and the ability to use parallel processing when appropriate.

## Coding Exercises

Try these without looking at solutions:

1. Print all numbers in a list using `forEach()`.
2. Print only even numbers.
3. Print only odd numbers.
4. Print the square of every number.
5. Print the cube of every number.
6. Create a Stream using `Stream.of()` and print its elements.
7. Create an empty Stream and print its count.
8. Demonstrate that a Stream cannot be reused after calling `count()`.
9. Show the difference between a for loop and `stream().forEach()`.
10. Verify that the original list remains unchanged after processing it with a Stream.

### Homework Challenge

```java
List<Integer> numbers = Arrays.asList(5, 12, 7, 18, 25, 30);
```

Write Stream-based solutions to:

1. Print all numbers.
2. Print even numbers.
3. Print odd numbers.
4. Print squares of all numbers.
5. Print cubes of all numbers.
6. Count the total number of elements.
7. Verify that the original list is unchanged after all operations.

## Chapter Summary

- ✅ A Stream is a pipeline that processes data without modifying the source
- ✅ Collection vs Stream
- ✅ External vs internal iteration
- ✅ Source → intermediate operations → terminal operation
- ✅ Intermediate operations are lazy; terminal operations trigger execution
- ✅ Streams cannot be reused
- ✅ Ways to create streams
