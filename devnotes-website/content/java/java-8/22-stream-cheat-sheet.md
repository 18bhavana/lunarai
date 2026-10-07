---
title: Stream API Cheat Sheet
subtitle: Every commonly used Stream method on one page — creation, intermediate and terminal operations, primitive streams, collectors and parallel streams.
order: 22
---

## Introduction

Java 8 Streams provide a powerful way to process collections efficiently. Below is a comprehensive list of the commonly used stream methods, categorized for easy reference.

```flow-h
Source
: creation
Intermediate ops (lazy)
: terminal op
Result
```

## Stream Creation Methods

| Method | Description | Example |
| --- | --- | --- |
| `Stream.of(T... values)` | Creates a stream from multiple values | `Stream.of(1, 2, 3, 4, 5);` |
| `Stream.of(array)` | Converts an object array into a stream | `Stream.of(new Integer[]{1, 2, 3});` |
| `Arrays.stream(array)` | Creates a stream from an array (an `IntStream` for `int[]`) | `Arrays.stream(new int[]{10, 20, 30});` |
| `collection.stream()` | Converts a collection into a stream | `List.of(1, 2, 3).stream();` |
| `Stream.generate(Supplier<T>)` | Creates an infinite stream | `Stream.generate(Math::random).limit(5);` |
| `Stream.iterate(seed, UnaryOperator<T>)` | Generates an infinite stream using a function | `Stream.iterate(1, n -> n + 1).limit(10);` |

> [!WARNING]
> `Stream.of(new int[]{1, 2, 3})` does **not** give a stream of three numbers — it gives a `Stream<int[]>` with **one** element (the array). For primitive arrays use `Arrays.stream(int[])` or `IntStream.of(1, 2, 3)`; `Stream.of()` only spreads **object** arrays like `Integer[]`.

## Intermediate Operations

These methods transform or filter elements and **return a new stream** (lazily).

| Method | Description | Example |
| --- | --- | --- |
| `filter(Predicate<T>)` | Filters elements based on a condition | `list.stream().filter(x -> x > 10);` |
| `map(Function<T, R>)` | Transforms elements from one type to another | `list.stream().map(String::toUpperCase);` |
| `flatMap(Function<T, Stream<R>>)` | Flattens nested structures into a single stream | `list.stream().flatMap(Collection::stream);` |
| `distinct()` | Removes duplicate elements | `list.stream().distinct();` |
| `sorted()` | Sorts elements in natural order | `list.stream().sorted();` |
| `sorted(Comparator<T>)` | Sorts elements using a custom comparator | `list.stream().sorted(Comparator.reverseOrder());` |
| `peek(Consumer<T>)` | Performs an action on each element without changing the stream | `list.stream().peek(System.out::println);` |
| `limit(long n)` | Returns a stream of the first `n` elements | `list.stream().limit(5);` |
| `skip(long n)` | Skips the first `n` elements | `list.stream().skip(3);` |

## Terminal Operations

These methods **consume** the stream and return a result.

| Method | Description | Example |
| --- | --- | --- |
| `forEach(Consumer<T>)` | Performs an action for each element | `list.stream().forEach(System.out::println);` |
| `toArray()` | Converts the stream to an array | `Integer[] arr = list.stream().toArray(Integer[]::new);` |
| `collect(Collectors.toList())` | Collects elements into a `List` | `List<Integer> result = list.stream().collect(Collectors.toList());` |
| `collect(Collectors.toSet())` | Collects elements into a `Set` | `Set<Integer> result = list.stream().collect(Collectors.toSet());` |
| `collect(Collectors.toMap(...))` | Converts elements into a `Map` | `list.stream().collect(Collectors.toMap(x -> x, x -> x * 2));` |
| `reduce(BinaryOperator<T>)` | Reduces elements to a single value | `list.stream().reduce(Integer::sum);` |
| `count()` | Counts the elements in the stream | `long count = list.stream().count();` |
| `min(Comparator<T>)` | Finds the minimum element | `list.stream().min(Integer::compareTo);` |
| `max(Comparator<T>)` | Finds the maximum element | `list.stream().max(Integer::compareTo);` |
| `findFirst()` | Returns the first element (if available) | `list.stream().findFirst();` |
| `findAny()` | Returns any element (useful for parallel streams) | `list.stream().findAny();` |
| `anyMatch(Predicate<T>)` | `true` if any element matches | `list.stream().anyMatch(x -> x > 10);` |
| `allMatch(Predicate<T>)` | `true` if all elements match | `list.stream().allMatch(x -> x > 10);` |
| `noneMatch(Predicate<T>)` | `true` if no element matches | `list.stream().noneMatch(x -> x > 10);` |

## Primitive Streams

Java provides specialized streams for primitive types (`int`, `long`, `double`) to improve performance.

| Stream type | Creation | Example |
| --- | --- | --- |
| `IntStream` | `IntStream.of(1, 2, 3);` | `IntStream.range(1, 10).sum();` → `45` |
| `LongStream` | `LongStream.of(10L, 20L, 30L);` | `LongStream.rangeClosed(1, 10).sum();` → `55` |
| `DoubleStream` | `DoubleStream.of(2.3, 3.5, 4.7);` | `DoubleStream.generate(Math::random).limit(5);` |

## Collectors

Collectors transform stream results into **collections** or perform **aggregations**.

| Collector | Description | Example |
| --- | --- | --- |
| `Collectors.toList()` | Collects elements into a `List` | `list.stream().collect(Collectors.toList());` |
| `Collectors.toSet()` | Collects elements into a `Set` | `list.stream().collect(Collectors.toSet());` |
| `Collectors.toMap(Function, Function)` | Collects elements into a `Map` | `list.stream().collect(Collectors.toMap(x -> x, x -> x * 2));` |
| `Collectors.joining(", ")` | Joins elements into a single string | `list.stream().map(String::valueOf).collect(Collectors.joining(", "));` |
| `Collectors.summingInt(ToIntFunction)` | Sums integer values | `list.stream().collect(Collectors.summingInt(x -> x));` |
| `Collectors.averagingDouble(ToDoubleFunction)` | Computes the average | `list.stream().collect(Collectors.averagingDouble(x -> x));` |
| `Collectors.groupingBy(Function)` | Groups elements into a `Map` | `list.stream().collect(Collectors.groupingBy(x -> x % 2 == 0 ? "Even" : "Odd"));` |
| `Collectors.partitioningBy(Predicate)` | Partitions elements into two groups | `list.stream().collect(Collectors.partitioningBy(x -> x > 5));` |

## Parallel Streams

Parallel streams **split** the workload across multiple threads.

| Method | Description | Example |
| --- | --- | --- |
| `parallelStream()` | Creates a parallel stream from a collection | `list.parallelStream().forEach(System.out::println);` |
| `parallel()` | Turns an existing stream parallel | `list.stream().parallel();` |
| `sequential()` | Converts a parallel stream back to sequential | `list.parallelStream().sequential();` |

## Bonus Challenge — Combining Methods

Find the **second longest word** from a list:

```java
List<String> words = List.of("apple", "banana", "cherry", "blueberry");

String secondLongest = words.stream()
        .sorted(Comparator.comparingInt(String::length).reversed())
        .skip(1)
        .findFirst()
        .orElse("");

System.out.println(secondLongest);
```

```output
banana
```

> [!NOTE]
> `banana` and `cherry` are both 6 letters. `sorted()` is stable, so `banana` (which comes first in the list) wins the tie. If ties matter, add `.thenComparing(Comparator.naturalOrder())`, or apply `distinct()` on the lengths first.

## Summary

- ✅ **Stream creation:** `Stream.of()`, `Arrays.stream()`, `.stream()`, `generate()`, `iterate()`
- ✅ **Transformations:** `filter()`, `map()`, `flatMap()`, `distinct()`, `sorted()`, `peek()`, `limit()`, `skip()`
- ✅ **Terminal operations:** `forEach()`, `collect()`, `count()`, `reduce()`, `min()`, `max()`, `find…()`, `…Match()`
- ✅ **Collectors:** `groupingBy()`, `partitioningBy()`, `joining()`, `summingInt()`
- ✅ **Parallel streams:** `parallelStream()`, `parallel()`, `sequential()`
