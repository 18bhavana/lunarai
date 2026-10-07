---
title: Reduction Operations
subtitle: Combining a stream into one value — reduce() forms, identity/accumulator/combiner, sum, count, max, min, average and parallel reduction.
order: 6
---

## Introduction

If `map()` transforms data and `filter()` selects data, then **`reduce()` combines all elements into a single result**.

This topic is a favourite in 5–10 years Java interviews because it tests both Stream knowledge and problem-solving. By the end of this chapter you'll master `reduce()`; identity, accumulator and combiner; `sum()`, `count()`, `max()`, `min()`, `average()`; `Optional`; custom reductions; and parallel reduction.

## What is Reduction?

**Reduction** means combining multiple elements into a **single result**.

```flow
2 · 3 · 4 · 5
: sum
14
---
John · Alexander · Bob
: longest name
Alexander
```

The stream becomes one value.

## reduce() Syntax

```java
// Version 1
Optional<T> reduce(BinaryOperator<T> accumulator)

// Version 2
T reduce(T identity, BinaryOperator<T> accumulator)

// Version 3 (mainly for parallel streams / type-changing reductions)
<U> U reduce(U identity,
             BiFunction<U, ? super T, U> accumulator,
             BinaryOperator<U> combiner)
```

## Sum Using reduce()

```java
List<Integer> numbers = Arrays.asList(2, 3, 4, 5);

int sum = numbers.stream()
        .reduce(0, Integer::sum);

System.out.println(sum);
```

```output
14
```

Equivalent lambda: `.reduce(0, (a, b) -> a + b)`.

### How It Works Internally

```flow Final answer: 14
Identity = 0
0 + 2 = 2
2 + 3 = 5
5 + 4 = 9
9 + 5 = 14
```

## More reduce() Examples

### Product of Numbers

```java
int product = numbers.stream()
        .reduce(1, (a, b) -> a * b);

System.out.println(product);
```

```output
120
```

**Why is the identity 1?** Because `1 × x = x`. If the identity were 0, every result would become 0.

### Find Maximum and Minimum

```java
Optional<Integer> max = numbers.stream().reduce(Integer::max);
System.out.println(max.get());   // 5

Optional<Integer> min = numbers.stream().reduce(Integer::min);
System.out.println(min.get());   // 2
```

### Longest String

```java
List<String> names = Arrays.asList("John", "Alexander", "Bob", "David");

String longest = names.stream()
        .reduce("", (a, b) -> a.length() > b.length() ? a : b);

System.out.println(longest);
```

```output
Alexander
```

### Concatenate Strings

```java
String result = names.stream()
        .reduce("", (a, b) -> a + b);

System.out.println(result);
```

```output
JohnAlexanderBobDavid
```

> [!TIP]
> For joining strings, `Collectors.joining()` is clearer and avoids creating a new String at every step.

## Why Optional?

```java
List<Integer> list = Collections.emptyList();

list.stream().reduce(Integer::sum);
```

What should Java return? Instead of `null`, Java returns **`Optional.empty()`**. Safe code:

```java
numbers.stream()
       .reduce(Integer::sum)
       .ifPresent(System.out::println);

int total = numbers.stream()
        .reduce(Integer::sum)
        .orElse(0);
```

## Specialized Reduction Methods

### sum()

Instead of `numbers.stream().reduce(0, Integer::sum)`, use:

```java
numbers.stream()
       .mapToInt(Integer::intValue)
       .sum();
```

Cleaner and faster.

### count(), max(), min(), average()

```java
long count = numbers.stream().count();                              // 4

Optional<Integer> max = numbers.stream().max(Integer::compareTo);
Optional<Integer> min = numbers.stream().min(Integer::compareTo);

double avg = numbers.stream()
        .mapToInt(Integer::intValue)
        .average()
        .orElse(0);                                                 // 3.5
```

### Employee Examples

```java
// Total salary
double totalSalary = employees.stream()
        .mapToDouble(Employee::getSalary)
        .sum();

// Average salary
double avg = employees.stream()
        .mapToDouble(Employee::getSalary)
        .average()
        .orElse(0);

// Highest-paid employee
Employee highest = employees.stream()
        .max(Comparator.comparing(Employee::getSalary))
        .orElseThrow();

// Lowest-paid employee
Employee lowest = employees.stream()
        .min(Comparator.comparing(Employee::getSalary))
        .orElseThrow();
```

> [!NOTE]
> No-argument `orElseThrow()` is Java 10+. On Java 8 use `.get()` or `orElseThrow(NoSuchElementException::new)`.

## reduce() vs collect()

| reduce() | collect() |
| --- | --- |
| Combines elements into **one value** | Collects elements into a **container** |
| List → one result | List → another List / Set / Map |
| Sum, product, maximum, longest string | List, Set, Map |

## Parallel Reduction

Suppose `1, 2, 3, 4`.

```flow
Sequential
((1 + 2) + 3) + 4
10
---
Parallel
1 + 2 = 3  and  3 + 4 = 7
3 + 7
10
```

This is why **associative** operations like addition and multiplication work well with parallel streams.

## Real Spring Boot Examples

```java
// Total order amount
double total = orders.stream()
        .mapToDouble(Order::getAmount)
        .sum();

// Count active users
long count = users.stream()
        .filter(User::isActive)
        .count();

// Most expensive product
Product expensive = products.stream()
        .max(Comparator.comparing(Product::getPrice))
        .orElseThrow();

// Longest username
String longest = users.stream()
        .map(User::getName)
        .reduce("", (a, b) -> a.length() > b.length() ? a : b);
```

## Interview Questions

### Q1. What is the identity value in reduce()?

It is the starting value of the reduction — `0` for sum, `1` for product, `""` for string concatenation.

### Q2. Why use Optional?

Because the stream may be empty.

### Q3. Difference between sum() and reduce()?

| sum() | reduce() |
| --- | --- |
| Built for numeric sums | General-purpose reduction |
| Simpler | More flexible |
| Faster for numeric primitives | Works for any reduction |

### Q4. When should you use reduce()?

When you need to combine all elements into a single result that isn't directly provided by specialized methods like `sum()` or `count()`.

### Q5. Can every sum() be written with reduce()?

Yes — e.g. `numbers.stream().reduce(0, Integer::sum)`.

## Practice Problems

```java
List<Integer> numbers = Arrays.asList(2, 5, 8, 10, 15);
```

1. Find the sum.
2. Find the product.
3. Find the maximum.
4. Find the minimum.
5. Find the average.
6. Count the elements.
7. Find the sum of even numbers.
8. Find the product of odd numbers.
9. Find the second highest number (using previous lessons).
10. Find the total of squares.

```java
class Employee {
    int id;
    String name;
    String department;
    double salary;
}
```

1. Total salary.
2. Average salary.
3. Highest salary.
4. Lowest salary.
5. Employee with the highest salary.
6. Employee with the lowest salary.
7. Count employees.
8. Sum salaries of the HR department.
9. Average salary of the IT department.
10. Longest employee name.

### Interview Challenge (5+ Years)

Filter employees with salary > 50,000, increase each salary by 10%, and find the total increased salary:

```java
double total = employees.stream()
        .filter(e -> e.getSalary() > 50_000)
        .mapToDouble(e -> e.getSalary() * 1.10)
        .sum();
```

Each operation has a clear responsibility: `filter()` keeps relevant employees, `mapToDouble()` transforms salaries, `sum()` reduces to a single value.

## Senior Java Tips

1. Prefer specialized methods (`sum()`, `count()`, `average()`, `max()`, `min()`) over `reduce()` when available — they're clearer and optimized.
2. Choose the correct identity in `reduce()`. An incorrect identity (like `0` for multiplication) leads to incorrect results.
3. Keep reduction operations **associative** if you plan to use `parallelStream()`. Addition and multiplication are safe; order-dependent operations may produce unexpected results.

## Chapter Summary

- ✅ What reduction is
- ✅ The three forms of `reduce()`
- ✅ Identity, accumulator and combiner
- ✅ `sum()`, `count()`, `max()`, `min()`, `average()`
- ✅ Why reductions return `Optional`
- ✅ `reduce()` vs `collect()`
- ✅ Parallel reduction and associativity
