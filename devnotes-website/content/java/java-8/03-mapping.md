---
title: Mapping
subtitle: Transforming elements with map(), Entity → DTO conversion, method references and primitive mapping with mapToInt/Long/Double.
order: 3
---

## Introduction

If `filter()` answers *"Which elements do I want?"*, then `map()` answers *"What do I want to convert them into?"*

This is used everywhere in Spring Boot projects — converting entities to DTOs, formatting data, extracting fields, and much more. By the end of this chapter you'll be able to:

- Understand what `map()` does
- Use `mapToInt()`, `mapToLong()` and `mapToDouble()`
- Know when to use primitive streams
- Use method references with `map()`
- Convert one object type into another (Entity → DTO)
- Answer common interview questions on mapping

## What is map()?

`map()` **transforms each element** in a stream into another value.

```java
<R> Stream<R> map(Function<T, R> mapper)
```

It takes a `Function<T, R>`:

```java
R apply(T t);
```

```flow-h Every input produces exactly one output
John · Alex · David
: map(String::toUpperCase)
JOHN · ALEX · DAVID
```

## Basic Examples

### Uppercase

```java
List<String> names = Arrays.asList("John", "Alex", "David");

names.stream()
     .map(String::toUpperCase)
     .forEach(System.out::println);
```

```output
JOHN
ALEX
DAVID
```

### Square Every Number

```java
List<Integer> numbers = Arrays.asList(2, 3, 4, 5);

numbers.stream()
       .map(n -> n * n)
       .forEach(System.out::println);
```

```output
4
9
16
25
```

### Cube Every Number

```java
numbers.stream()
       .map(n -> n * n * n)
       .forEach(System.out::println);
```

```output
8
27
64
125
```

### Convert to String Length

```java
List<String> names = Arrays.asList("John", "Alexander", "Bob");

names.stream()
     .map(String::length)
     .forEach(System.out::println);
```

```output
4
9
3
```

Notice `String → Integer`: the **input and output types don't have to be the same**.

## Working with Objects

### Extract a Field

```java
class Employee {
    String name;
    double salary;

    Employee(String name, double salary) {
        this.name = name;
        this.salary = salary;
    }
}

List<Employee> employees = Arrays.asList(
        new Employee("John", 50000),
        new Employee("David", 70000)
);

employees.stream()
         .map(e -> e.name)
         .forEach(System.out::println);
```

```output
John
David
```

The stream changes from `Stream<Employee>` to `Stream<String>`.

### Increase Salary

```java
employees.stream()
         .map(e -> e.salary * 1.10)
         .forEach(System.out::println);
```

```output
55000.00000000001
77000.00000000001
```

The original employee objects are **unchanged**, because you're creating a new stream of salary values.

> [!NOTE]
> The tiny `…00000000001` comes from floating-point arithmetic (`1.10` can't be represented exactly in binary). For money, use `BigDecimal`, or format the output.

### Entity → DTO (Very Common in Spring Boot)

```java
// Entity
class Employee {
    int id;
    String name;
    double salary;
}

// DTO
class EmployeeDTO {
    String name;

    EmployeeDTO(String name) {
        this.name = name;
    }
}
```

```java
List<EmployeeDTO> dtoList = employees.stream()
        .map(e -> new EmployeeDTO(e.name))
        .collect(Collectors.toList());
```

This pattern is extremely common when returning API responses.

## Method References

| Instead of | Use |
| --- | --- |
| `.map(e -> e.getName())` | `.map(Employee::getName)` |
| `.map(s -> s.toUpperCase())` | `.map(String::toUpperCase)` |

Cleaner and more readable.

## Primitive Mapping

### mapToDouble()

Suppose we need the **total salary** (a `double`):

```java
double total = employees.stream()
        .mapToDouble(Employee::getSalary)
        .sum();
```

Useful for decimal values like salaries, prices and percentages.

### mapToInt()

`map()` would return a `Stream<Integer>`; `mapToInt()` returns an **`IntStream`**:

```java
int totalLetters = names.stream()
        .mapToInt(String::length)
        .sum();
```

`IntStream` has useful methods like `sum()`, `average()`, `max()`, `min()` and `count()`.

### mapToLong()

```java
long totalViews = videos.stream()
        .mapToLong(Video::getViewCount)   // getViewCount() returns long
        .sum();
```

Useful when working with `long` values.

> [!WARNING]
> The mapper must return the matching primitive type. `mapToInt(Employee::getSalary)` **does not compile** when `getSalary()` returns `double` — use `mapToDouble()` (or an explicit cast) instead.

### Why Use Primitive Streams?

Instead of `Stream<Integer>`, use `IntStream`. Advantages:

- No boxing/unboxing overhead
- Better performance
- Built-in numeric operations

```java
int sum = numbers.stream()
        .mapToInt(Integer::intValue)
        .sum();
```

## map() vs filter()

```java
List<Integer> list = Arrays.asList(2, 3, 4, 5);
```

| Operation | Code | Result | Effect |
| --- | --- | --- | --- |
| `filter()` | `list.stream().filter(n -> n % 2 == 0)` | `2, 4` | Some elements are removed |
| `map()` | `list.stream().map(n -> n * 10)` | `20, 30, 40, 50` | Every element is transformed |

### Chaining filter() + map()

```java
employees.stream()
         .filter(e -> e.salary > 50000)
         .map(Employee::getName)
         .forEach(System.out::println);
```

```flow-h
Stream<Employee>
filter()
Stream<Employee>
map()
Stream<String>
forEach()
```

## Real Spring Boot Examples

```java
// Get user emails
List<String> emails = users.stream()
        .map(User::getEmail)
        .collect(Collectors.toList());

// Convert entity to DTO
orders.stream()
      .map(OrderDTO::new)
      .collect(Collectors.toList());

// Format product names
products.stream()
        .map(Product::getName)
        .map(String::toUpperCase)
        .forEach(System.out::println);

// Total order amount
double total = orders.stream()
        .mapToDouble(Order::getAmount)
        .sum();
```

## Interview Questions

### Q1. What is the difference between map() and flatMap()?

`map()` transforms one element into one element. `flatMap()` transforms one element into zero, one or many elements and **flattens** the result. (Covered in detail in the flatMap chapter.)

### Q2. Why use mapToInt() instead of map()?

`mapToInt()` returns an `IntStream`, which avoids boxing/unboxing and provides numeric operations like `sum()`, `average()` and `max()`.

### Q3. Can map() change the data type?

Yes. For example, `Stream<Employee>` can become `Stream<String>` by mapping employees to their names.

### Q4. Does map() modify the original object?

No. It creates a new stream with transformed values. However, if your mapping function **mutates** mutable objects, those mutations will affect the original objects — so avoid side effects in `map()`.

## Practice Problems

```java
List<Integer> numbers = Arrays.asList(2, 5, 8, 10, 15);
```

1. Square every number.
2. Cube every number.
3. Multiply every number by 100.
4. Convert every number to a `String`.
5. Find the sum using `mapToInt()`.

```java
class Employee {
    int id;
    String name;
    double salary;
}
```

1. Get all employee names.
2. Get all employee salaries.
3. Increase each salary by 10% (without modifying the original objects).
4. Convert employees to `EmployeeDTO`.
5. Calculate the total salary.
6. Calculate the average salary.
7. Find the maximum salary.
8. Find the minimum salary.

### Mini Interview Challenge

```java
List<String> result = employees.stream()
        .filter(e -> e.getSalary() > 50000)
        .map(Employee::getName)
        .map(String::toUpperCase)
        .collect(Collectors.toList());
```

Be prepared to explain, step by step:

- What type of stream exists after `filter()`? → `Stream<Employee>`
- What type of stream exists after the first `map()`? → `Stream<String>`
- What does the second `map()` do? → Uppercases each name (still `Stream<String>`)
- What is the final result type? → `List<String>`
- Why is `collect()` needed? → It's the terminal operation that triggers the pipeline and gathers results

## Chapter Summary

- ✅ `map()` and `Function<T, R>`
- ✅ Type-changing transformations
- ✅ Entity → DTO conversion
- ✅ Method references
- ✅ `mapToInt()`, `mapToLong()`, `mapToDouble()` and primitive streams
- ✅ `map()` vs `filter()`
