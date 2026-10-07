---
title: groupingBy() and partitioningBy()
subtitle: The most important Stream topic — grouping by a key, downstream collectors, counting/summing/averaging per group, multi-level grouping and true/false partitions.
order: 8
---

## Introduction

This is the topic that separates average Java developers from strong Java 8 developers. If you're interviewing for 5–8 years of Java experience, there's a very high chance you'll be asked at least one `groupingBy()` question.

By the end of this chapter you'll master `Collectors.groupingBy()`, `Collectors.partitioningBy()`, downstream collectors, multi-level grouping, counting / summing / averaging / max / min per group, and mapping inside grouping.

## What is groupingBy()?

Think of SQL:

```text
SELECT department, COUNT(*)
FROM employee
GROUP BY department;
```

In Java Streams, that's:

```java
employees.stream()
         .collect(Collectors.groupingBy(Employee::getDepartment));
```

`groupingBy()` **groups elements based on a key**.

```buckets Employees grouped by department
IT: John, Alex
HR: David, Bob
Sales: Mary
```

## Basic Grouping

```java
Map<String, List<Employee>> result = employees.stream()
        .collect(Collectors.groupingBy(Employee::getDepartment));
```

```output
IT    -> [John, Alex]
HR    -> [David, Bob]
Sales -> [Mary]
```

The return type is:

```java
Map<Key, List<Value>>
```

## Downstream Collectors

The second argument of `groupingBy()` decides **what to do with each group**.

### Count Employees by Department

```java
Map<String, Long> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.counting()
        ));
```

```output
IT    4
HR    2
Sales 3
```

One of the most common interview questions.

### Sum Salary by Department

```java
Map<String, Double> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.summingDouble(Employee::getSalary)
        ));
```

```output
IT    320000
HR    90000
Sales 210000
```

### Average Salary by Department

```java
Map<String, Double> avg = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.averagingDouble(Employee::getSalary)
        ));
```

```output
IT    80000
HR    45000
Sales 70000
```

### Employee Names by Department

Suppose we only need names:

```java
Map<String, List<String>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.mapping(Employee::getName, Collectors.toList())
        ));
```

```output
IT -> [John, Alex, Rahul]
HR -> [David, Bob]
```

Notice how `mapping()` transforms the grouped values.

### Highest Salary by Department

**Interview favourite.**

```java
Map<String, Optional<Employee>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.maxBy(Comparator.comparing(Employee::getSalary))
        ));
```

```output
IT -> Optional[Alex]
HR -> Optional[David]
```

**Why `Optional<Employee>`?** Because `maxBy()` is a general-purpose collector and must handle an empty input.

> [!NOTE]
> Inside `groupingBy()` a group is never actually empty (a key only exists if at least one element produced it), so the `Optional` is always present here. To unwrap it, wrap `maxBy()` in `collectingAndThen(..., Optional::get)` — covered in the next chapter.

### Lowest Salary by Department

```java
Collectors.minBy(Comparator.comparing(Employee::getSalary))
```

Same idea.

### Summary Statistics per Department

```java
Map<String, DoubleSummaryStatistics> stats = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.summarizingDouble(Employee::getSalary)
        ));
```

Each department gets **count, sum, min, max and average** in one pass.

## Multi-Level Grouping

Suppose we want **Department → Age → Employees**:

```java
Map<String, Map<Integer, List<Employee>>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.groupingBy(Employee::getAge)
        ));
```

```tree Nested grouping is common in reporting
Employees
  IT
    25 | John, Alex
    30 | Rahul
  HR
    28 | David, Bob
```

## partitioningBy()

Unlike `groupingBy()`, which can have many groups, `partitioningBy()` **always creates exactly two groups**. The keys are `true` and `false`.

```java
Map<Boolean, List<Employee>> result = employees.stream()
        .collect(Collectors.partitioningBy(e -> e.getSalary() > 50000));
```

```buckets salary > 50000
true: Alex, John
false: Bob, David
```

> [!TIP]
> `partitioningBy()` always contains **both** keys, even if one partition is empty — `{false=[], true=[...]}`. `groupingBy()` only contains keys that actually occur.

### groupingBy() vs partitioningBy()

| groupingBy() | partitioningBy() |
| --- | --- |
| Any number of groups | Exactly 2 groups |
| Key can be anything | Key is `boolean` |
| e.g. Department, City | e.g. Salary > 50000, Age > 18 |

**Rule of thumb:** if your grouping condition is a yes/no question, use `partitioningBy()`.

### Partition + Count

```java
Map<Boolean, Long> result = employees.stream()
        .collect(Collectors.partitioningBy(
                e -> e.getSalary() > 50000,
                Collectors.counting()
        ));
```

```output
true  5
false 3
```

## Real Spring Boot Examples

```java
// Employees by department
employees.stream()
         .collect(Collectors.groupingBy(Employee::getDepartment));

// Orders by status
orders.stream()
      .collect(Collectors.groupingBy(Order::getStatus));

// Products by category
products.stream()
        .collect(Collectors.groupingBy(Product::getCategory));

// Active vs inactive users
users.stream()
     .collect(Collectors.partitioningBy(User::isActive));
```

## Advanced Pipeline

Requirement: group by department, sort employee names alphabetically, return names only.

```java
Map<String, List<String>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.mapping(
                        Employee::getName,
                        Collectors.collectingAndThen(
                                Collectors.toList(),
                                list -> list.stream().sorted().toList()
                        )
                )
        ));
```

This is interview-level code.

> [!NOTE]
> `list.stream().sorted().toList()` uses Java 16's `Stream.toList()`. On Java 8 use `.collect(Collectors.toList())`.

## Interview Questions

### Q1. Difference between groupingBy() and partitioningBy()?

- `groupingBy()` → many groups.
- `partitioningBy()` → exactly two groups (`true` / `false`).

### Q2. How do you count employees in each department?

```java
Collectors.groupingBy(Employee::getDepartment, Collectors.counting())
```

### Q3. How do you find the highest salary in each department?

Use `Collectors.maxBy(...)` as the downstream collector.

### Q4. How do you group only employee names?

Use `Collectors.mapping(...)` as the downstream collector.

### Q5. What is a downstream collector?

A collector applied **inside** another collector:

```java
Collectors.groupingBy(Employee::getDepartment, Collectors.counting())
```

Here, `counting()` is the downstream collector.

## Practice Problems

```java
class Employee {
    int id;
    String name;
    String department;
    int age;
    double salary;
}
```

1. Group employees by department.
2. Count employees in each department.
3. Find total salary by department.
4. Find average salary by department.
5. Find maximum salary by department.
6. Find minimum salary by department.
7. Group employee names by department.
8. Partition employees into salary > 50,000 and others.
9. Count employees in each partition.
10. Group by department, then by age.

### 5+ Years Interview Challenge

Create a `Map<String, List<String>>` where **key = department** and **value = employee names**, sorted alphabetically with no duplicates.

```java
Map<String, List<String>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.collectingAndThen(
                        Collectors.mapping(
                                Employee::getName,
                                Collectors.toCollection(TreeSet::new)
                        ),
                        ArrayList::new
                )
        ));
```

**Why this works:**

- `groupingBy()` creates groups by department.
- `mapping()` extracts only employee names.
- `toCollection(TreeSet::new)` removes duplicates **and** sorts names alphabetically.
- `collectingAndThen()` converts the `TreeSet` into an `ArrayList`.

A compact, production-quality solution that combines multiple collectors elegantly.

## Pro Tips

1. Use `groupingBy()` instead of manually building maps with loops whenever it improves readability.
2. Choose the right downstream collector (`counting()`, `mapping()`, `summingDouble()`, etc.) to avoid extra stream traversals.
3. **Think in terms of SQL.** If you can express a `GROUP BY` query in SQL, you can usually express it with `Collectors.groupingBy()`.

## Chapter Summary

- ✅ `groupingBy()` returns `Map<K, List<V>>` by default
- ✅ Downstream collectors: `counting()`, `summingDouble()`, `averagingDouble()`, `mapping()`, `maxBy()`, `minBy()`, `summarizingDouble()`
- ✅ Multi-level grouping
- ✅ `partitioningBy()` — exactly two groups, both keys always present
- ✅ `groupingBy()` vs `partitioningBy()`
