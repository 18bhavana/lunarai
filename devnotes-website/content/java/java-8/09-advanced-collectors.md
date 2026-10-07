---
title: Advanced Collectors
subtitle: Combining collectors like Lego blocks — collectingAndThen, mapping, filtering, flatMapping, reducing, teeing and nested collector pipelines.
order: 9
---

## Introduction

This is where most Java developers stop… and where senior Java developers begin.

By now you know `filter()`, `map()`, `sorted()`, `distinct()`, `reduce()`, `groupingBy()` and `partitioningBy()`. In this chapter you'll learn how to **combine collectors** to solve complex problems in one Stream pipeline: `collectingAndThen()`, `mapping()`, `filtering()`, `flatMapping()`, `reducing()`, `teeing()` and nested collectors.

> [!NOTE]
> **Version check:** `filtering()` and `flatMapping()` are **Java 9+**, `teeing()` is **Java 12+**, `List.copyOf()` is **Java 10+** and `record` is **Java 16+**. `collectingAndThen()`, `mapping()` and `reducing()` are available in Java 8.

## What Are Advanced Collectors?

Think of collectors like **Lego blocks**. You already know `Collectors.toList()`, `Collectors.counting()` and `Collectors.summingInt()`. Now imagine combining them:

```flow-h
groupingBy()
mapping()
collectingAndThen()
toList()
```

That's exactly what advanced collectors do.

## collectingAndThen()

Probably the most asked advanced collector.

```java
Collectors.collectingAndThen(
        downstreamCollector,
        finisher
)
```

```flow-h
Collect result
Modify result
Return final result
```

### Example: Sorted Names

Without `collectingAndThen()` — two steps:

```java
List<String> names = employees.stream()
        .map(Employee::getName)
        .collect(Collectors.toList());

Collections.sort(names);
```

With `collectingAndThen()` — everything happens in one collector:

```java
List<String> names = employees.stream()
        .collect(Collectors.collectingAndThen(
                Collectors.mapping(Employee::getName, Collectors.toList()),
                list -> {
                    Collections.sort(list);
                    return list;
                }
        ));
```

### Make a List Immutable

Very common in production.

```java
List<String> names = employees.stream()
        .map(Employee::getName)
        .collect(Collectors.collectingAndThen(
                Collectors.toList(),
                Collections::unmodifiableList
        ));
```

Result: an **unmodifiable** list.

## mapping()

You've already seen it inside `groupingBy()`. Without it you get `Map<String, List<Employee>>`; with it you get `Map<String, List<String>>`.

```java
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.mapping(Employee::getName, Collectors.toList())
         ));
```

```output
IT -> [John, Alex]
HR -> [David]
```

## filtering() (Java 9+)

Instead of filtering before collecting:

```java
employees.stream()
         .filter(e -> e.getSalary() > 50000)
         .collect(...);
```

you can filter **inside** grouping:

```java
Map<String, List<Employee>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.filtering(
                        e -> e.getSalary() > 50000,
                        Collectors.toList()
                )
        ));
```

This **keeps all departments** in the result map, even if some departments end up with empty lists.

### Why filtering()?

Suppose IT has John (70000) and Alex (30000), and HR has Bob (25000).

```buckets Normal filter() then groupingBy() — HR disappears
IT: John
```

```buckets Using filtering() — HR stays with an empty list
IT: John
HR:
```

Sometimes that's exactly what reporting requires.

## flatMapping() (Java 9+)

```java
class Employee {
    String name;
    String department;
    List<String> skills;
}
```

Data: John → Java, SQL; Alex → Java, Docker. Requirement: **department → all skills**.

```java
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.flatMapping(
                         e -> e.getSkills().stream(),
                         Collectors.toSet()
                 )
         ));
```

```output
IT -> [Java, SQL, Docker]
```

Without `flatMapping()`, you'd end up with nested lists (`List<List<String>>`).

## reducing()

Most people know `reduce()`. Very few know **`Collectors.reducing()`**.

```java
Map<String, Integer> totalAge = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.reducing(0, Employee::getAge, Integer::sum)
        ));
```

```output
IT 120
HR 75
```

The three arguments are **identity**, **mapper** and **combining operator**.

## teeing() (Java 12+)

One of the coolest collectors: it **runs two collectors in one traversal** and merges their results.

Need: count **and** average. Normally that's `count()` and `average()` — two traversals.

```java
record Stats(long count, double avg) {}

Stats stats = employees.stream()
        .collect(Collectors.teeing(
                Collectors.counting(),
                Collectors.averagingDouble(Employee::getSalary),
                Stats::new
        ));
```

```output
Stats[count=15, avg=65000.0]
```

One traversal.

```flow-h
Stream
? teeing() | counting(): count | averagingDouble(): avg
Stats::new
```

## Nested Collectors

Requirement: **department → name of the highest-paid employee**.

```java
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.collectingAndThen(
                         Collectors.maxBy(Comparator.comparing(Employee::getSalary)),
                         opt -> opt.map(Employee::getName).orElse("")
                 )
         ));
```

This is a senior-level Stream pipeline.

## Real Spring Boot Examples

```java
// Department -> immutable employee list
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.collectingAndThen(
                         Collectors.toList(),
                         Collections::unmodifiableList
                 )
         ));

// Department -> employee names
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.mapping(Employee::getName, Collectors.toList())
         ));

// Department -> high-salary employees
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.filtering(e -> e.getSalary() > 50000, Collectors.toList())
         ));

// Department -> unique skills
employees.stream()
         .collect(Collectors.groupingBy(
                 Employee::getDepartment,
                 Collectors.flatMapping(e -> e.getSkills().stream(), Collectors.toSet())
         ));
```

## Interview Questions

### Q1. Difference between map() and mapping()?

| map() | mapping() |
| --- | --- |
| Stream operation | Collector |
| Used before `collect()` | Used inside another collector |
| Returns a Stream | Used within `groupingBy()` etc. |

### Q2. Difference between filter() and filtering()?

| filter() | filtering() |
| --- | --- |
| Stream operation | Collector |
| Before grouping — empty groups disappear | During grouping — empty groups are kept |

### Q3. When do we use collectingAndThen()?

When we want to **transform the collected result** — e.g. make it immutable, sort it, or convert `Optional<T>` → value.

### Q4. Difference between reduce() and Collectors.reducing()?

`reduce()` is a terminal operation on the stream: `stream.reduce(...)`. `reducing()` is a collector, typically used as a downstream collector:

```java
Collectors.groupingBy(
        ...,
        Collectors.reducing(...)
)
```

### Q5. What does teeing() do?

Runs **two collectors** over the same elements in one pass and merges the results with a function.

## Practice Problems

```java
class Employee {
    int id;
    String name;
    String department;
    List<String> skills;
    double salary;
}
```

1. Group employees by department and return only names.
2. Group by department and return immutable employee lists.
3. Group by department and keep only employees with salary > 60,000.
4. Group by department and return unique skills.
5. Group by department and return the total salary using `reducing()`.
6. Group by department and return the highest-paid employee.
7. Group by department and return only the highest-paid employee's name.
8. Count employees and average salary in one pass using `teeing()`.
9. Group by department and return sorted employee names.
10. Group by department and return unmodifiable sets of employee names.

### 5+ Years Interview Challenge

Return a `Map<String, List<String>>` where key = department and value = **sorted, unique** employee names, **salary > 50,000 only**.

```java
Map<String, List<String>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.collectingAndThen(
                        Collectors.filtering(
                                e -> e.getSalary() > 50000,
                                Collectors.mapping(
                                        Employee::getName,
                                        Collectors.toCollection(TreeSet::new)
                                )
                        ),
                        ArrayList::new
                )
        ));
```

### Can we make it truly immutable?

The previous solution returns a mutable `ArrayList`. To make the final lists immutable:

```java
Map<String, List<String>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.collectingAndThen(
                        Collectors.filtering(
                                e -> e.getSalary() > 50_000,
                                Collectors.mapping(
                                        Employee::getName,
                                        Collectors.toCollection(TreeSet::new)
                                )
                        ),
                        names -> List.copyOf(names)
                )
        ));
```

Now each department maps to an unmodifiable, sorted, unique list of names.

## Pro Tips

### 1. Know where each operation belongs

- `map()`, `filter()`, `flatMap()` → **Stream** operations.
- `mapping()`, `filtering()`, `flatMapping()` → **Collector** operations.

This distinction is a common interview question.

### 2. Use collectingAndThen() to finish cleanly

Ideal for making collections immutable, converting `Optional<T>` to `T`, and sorting or transforming a collected result before returning it.

### 3. Don't overcomplicate pipelines

Advanced collectors are powerful, but readability matters. If a pipeline becomes difficult to understand, splitting it into two clear steps is often the better engineering choice.

## Chapter Summary

- ✅ `collectingAndThen()` — collect, then finish
- ✅ `mapping()`, `filtering()`, `flatMapping()` as downstream collectors
- ✅ `filter()` vs `filtering()` — empty groups
- ✅ `Collectors.reducing()`
- ✅ `teeing()` — two collectors, one pass
- ✅ Nested collector pipelines
