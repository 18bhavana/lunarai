---
title: distinct(), limit() and skip()
subtitle: Removing duplicates, taking the first N, offsetting, pagination with skip + limit, order of operations and Nth-highest problems.
order: 5
---

## Introduction

Three operations that appear in almost every real-world application:

- Removing duplicates (`distinct()`)
- Fetching the first N records (`limit()`)
- Pagination (`skip()` + `limit()`)

These are heavily used in Spring Boot APIs, reporting, dashboards and interview coding rounds. By the end of this chapter you'll master `distinct()`, `limit()`, `skip()`, pagination using Streams, Top-N and Bottom-N problems, and how the order of operations affects results and performance.

## distinct()

`distinct()` **removes duplicate elements** from a stream.

```java
stream.distinct()
```

It uses **`equals()` and `hashCode()`** to determine duplicates.

### Remove Duplicate Integers

```java
List<Integer> numbers = Arrays.asList(2, 5, 2, 8, 5, 10, 8);

numbers.stream()
       .distinct()
       .forEach(System.out::println);
```

```output
2
5
8
10
```

Notice: the **first occurrence is preserved** and the encounter order remains the same.

### Duplicate Strings

```java
List<String> names = Arrays.asList("John", "Alex", "John", "Bob", "Alex");

names.stream()
     .distinct()
     .forEach(System.out::println);
```

```output
John
Alex
Bob
```

## distinct() with Custom Objects

```java
class Employee {
    int id;
    String name;
    // equals()
    // hashCode()
}

employees.stream()
         .distinct()
         .forEach(System.out::println);
```

This works correctly **only if `equals()` and `hashCode()` are implemented properly**.

### Common Interview Trap

```java
Employee e1 = new Employee(1, "John");
Employee e2 = new Employee(1, "John");
```

Without overriding `equals()` and `hashCode()`, `distinct()` outputs **both** objects:

```output
John
John
```

**Why?** Because Java compares **object references** by default.

### Correct Implementation

```java
@Override
public boolean equals(Object obj) {
    // compare id
}

@Override
public int hashCode() {
    // hash id
}
```

Now `employees.stream().distinct()` works correctly.

## limit()

Returns only the **first N** elements.

```java
stream.limit(n)
```

```java
numbers.stream()   // 2, 5, 2, 8, 5, 10, 8
       .limit(3)
       .forEach(System.out::println);
```

```output
2
5
2
```

Only the first three elements are processed.

### Top 5 Highest Salaries

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getSalary).reversed())
         .limit(5)
         .forEach(System.out::println);
```

A very common interview problem.

## skip()

**Skips** the first N elements.

```java
stream.skip(n)
```

```java
numbers.stream()   // 2, 5, 2, 8, 5, 10, 8
       .skip(2)
       .forEach(System.out::println);
```

```output
2
8
5
10
8
```

The first two elements are ignored.

## skip() + limit() = Pagination

This is used everywhere. With **page size = 10** and **page number = 3**:

```text
skip = (pageNumber - 1) * pageSize
     = (3 - 1) * 10
     = 20
```

```java
employees.stream()
         .skip(20)
         .limit(10)
         .toList();
```

Exactly how pagination works conceptually.

### Example

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

numbers.stream()
       .skip(3)
       .limit(4)
       .forEach(System.out::println);
```

```output
4
5
6
7
```

```flow
1 2 3 4 5 6 7 8 9 10
: skip(3)
4 5 6 7 8 9 10
: limit(4)
4 5 6 7
```

## Combining Operations

With `numbers = [2, 5, 2, 8, 5, 10, 8]`:

| Pipeline | Output |
| --- | --- |
| `.distinct().sorted()` | `2, 5, 8, 10` |
| `.filter(n -> n % 2 == 0).distinct()` | `2, 8, 10` |
| `.sorted(Comparator.reverseOrder()).limit(3)` | `10, 8, 8` |
| `.distinct().sorted(Comparator.reverseOrder()).limit(3)` | `10, 8, 5` — unique values |

## Order of Operations Matters

```java
numbers.stream().limit(5).distinct();
```

```flow-h
2 5 2 8 5 10 8
: limit(5)
2 5 2 8 5
: distinct()
2 5 8
```

Now reverse it:

```java
numbers.stream().distinct().limit(5);
```

```flow-h Different results
2 5 2 8 5 10 8
: distinct()
2 5 8 10
: limit(5)
2 5 8 10
```

## Performance Tip

```java
stream.sorted().limit(5)
```

Java sorts **every** element before taking the first five. If your requirement allows it, **filter early**:

```java
stream.filter(...).sorted().limit(5)
```

Fewer elements to sort.

## Real Spring Boot Examples

```java
// Latest 10 orders
orders.stream()
      .sorted(Comparator.comparing(Order::getOrderDate).reversed())
      .limit(10)
      .toList();

// Second page of users
users.stream()
     .skip(10)
     .limit(10)
     .toList();

// Unique product categories
products.stream()
        .map(Product::getCategory)
        .distinct()
        .toList();

// Top 5 highest salaries
employees.stream()
         .sorted(Comparator.comparing(Employee::getSalary).reversed())
         .limit(5)
         .toList();
```

## Interview Questions

### Q1. Is distinct() intermediate or terminal?

Intermediate (stateful).

### Q2. How does distinct() identify duplicates?

It relies on `equals()` and `hashCode()`.

### Q3. Why isn't distinct() removing duplicate objects?

Because `equals()` and `hashCode()` are not overridden correctly.

### Q4. What is skip() mainly used for?

Pagination.

### Q5. Difference between limit() and skip()?

| limit() | skip() |
| --- | --- |
| Takes the first N elements | Ignores the first N elements |
| Restricts stream size | Offsets the stream |

## Interview Challenges

### Second highest unique salary

```java
double secondHighest = employees.stream()
        .map(Employee::getSalary)
        .distinct()
        .sorted(Comparator.reverseOrder())
        .skip(1)
        .findFirst()
        .orElseThrow();
```

```flow-h One of the most frequently asked Java Stream interview questions
Salary
distinct()
sorted(desc)
skip(1)
findFirst()
```

### Third smallest unique number

```java
int third = numbers.stream()
        .distinct()
        .sorted()
        .skip(2)
        .findFirst()
        .orElseThrow();
```

## Practice Problems

```java
List<Integer> numbers = Arrays.asList(5, 2, 8, 2, 10, 5, 12, 8, 15, 20);
```

1. Remove duplicates.
2. Print the first 5 numbers.
3. Skip the first 3 numbers.
4. Skip 2 and print the next 4.
5. Sort ascending and print the first 3 numbers.
6. Sort descending and print the top 5 numbers.
7. Print the second highest unique number.
8. Print the third smallest unique number.
9. Remove duplicates, sort descending, and print the top 2.
10. Count the number of unique elements.

```java
class Employee {
    int id;
    String name;
    String department;
    double salary;
}
```

1. Print unique departments.
2. Print the top 3 highest-paid employees.
3. Print employees after skipping the first 5.
4. Print employees 6–10.
5. Print the second highest salary.
6. Print the third highest salary.
7. Print the top 5 unique salaries.
8. Print employees after removing duplicate IDs (assume `equals()`/`hashCode()` are implemented).
9. Sort by salary, skip the lowest 2, and print the next 3.
10. Find the first employee after skipping the first 10.

## Senior Java Interview Tips

### 1. Know the execution order

```java
stream
    .filter(...)
    .distinct()
    .sorted()
    .skip(5)
    .limit(10)
    .map(...)
    .collect(...);
```

is processed in the **exact order you write it**.

### 2. Use distinct() only when needed

It maintains state internally, so it has overhead. Avoid it if your data is already unique.

### 3. Prefer database pagination for large datasets

For millions of records, **don't** do this:

```java
repository.findAll()
          .stream()
          .skip(100000)
          .limit(20);
```

Instead, let the database handle pagination (e.g. Spring Data `Pageable`) and stream only the required page.

## Chapter Summary

- ✅ `distinct()` relies on `equals()`/`hashCode()` and keeps the first occurrence
- ✅ `limit()` and `skip()`
- ✅ Pagination with `skip()` + `limit()`
- ✅ Order of operations changes results
- ✅ Nth-highest / Nth-smallest patterns
- ✅ Database pagination for large datasets
