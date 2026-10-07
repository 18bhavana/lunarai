---
title: Filtering
subtitle: filter() with Predicates, findFirst vs findAny, anyMatch/allMatch/noneMatch and short-circuiting — with Spring Boot examples.
order: 2
---

## Introduction

Filtering is one of the most frequently used Stream operations in real-world Java projects and interviews. By the end of this chapter you should be able to answer:

- What is `filter()`?
- When should I use `findFirst()` vs `findAny()`?
- What are `anyMatch()`, `allMatch()` and `noneMatch()`?
- How do these work internally?
- Where are they used in Spring Boot projects?

## The filter() Operation

`filter()` selects elements that **satisfy a condition**.

```java
stream.filter(predicate)
```

A `Predicate<T>` is a functional interface:

```java
boolean test(T t);
```

### Even Numbers

```java
List<Integer> numbers = Arrays.asList(10, 15, 20, 25, 30);

numbers.stream()
       .filter(n -> n % 2 == 0)
       .forEach(System.out::println);
```

```output
10
20
30
```

### Odd Numbers

```java
numbers.stream()
       .filter(n -> n % 2 != 0)
       .forEach(System.out::println);
```

```output
15
25
```

### Names Starting with A

```java
List<String> names = Arrays.asList("Alice", "Bob", "Alex", "David");

names.stream()
     .filter(name -> name.startsWith("A"))
     .forEach(System.out::println);
```

```output
Alice
Alex
```

### Age Greater Than 25

```java
class Employee {
    String name;
    int age;

    Employee(String name, int age) {
        this.name = name;
        this.age = age;
    }
}

List<Employee> employees = Arrays.asList(
        new Employee("John", 22),
        new Employee("David", 28),
        new Employee("Alex", 35)
);

employees.stream()
         .filter(e -> e.age > 25)
         .forEach(e -> System.out.println(e.name));
```

```output
David
Alex
```

## Multiple Filters

```java
employees.stream()
         .filter(e -> e.age > 25)
         .filter(e -> e.name.startsWith("A"))
         .forEach(e -> System.out.println(e.name));
```

```output
Alex
```

```flow-h
Employee
Age > 25
Name starts with A
Result
```

## findFirst()

Returns the **first** element matching the condition. Return type: **`Optional<T>`**.

```java
Optional<Integer> number = numbers.stream()
        .filter(n -> n > 10)
        .findFirst();

System.out.println(number.get());
```

```output
15
```

### Why Optional?

```java
numbers.stream()
       .filter(n -> n > 100)
       .findFirst();
```

No result exists. Instead of returning `null`, Java returns **`Optional.empty()`**. Safe usage:

```java
numbers.stream()
       .filter(n -> n > 100)
       .findFirst()
       .ifPresent(System.out::println);
```

## findAny()

Returns **any** matching element.

```java
numbers.stream()
       .filter(n -> n > 10)
       .findAny();
```

Sequential streams usually return the first match. Parallel streams may return any matching element.

### findFirst() vs findAny()

| findFirst() | findAny() |
| --- | --- |
| Preserves encounter order | May return any matching element |
| Good for ordered streams | Good for parallel streams |
| Usually slightly slower in parallel | Can be faster in parallel |

> [!QUESTION] Which should you use with parallelStream()?
> `findAny()` is generally preferred because it doesn't need to preserve encounter order.

## Match Operations

### anyMatch()

Checks if **at least one** element matches. Returns `boolean`.

```java
boolean result = numbers.stream()
        .anyMatch(n -> n > 20);

System.out.println(result);
```

```output
true
```

### allMatch()

Checks whether **every** element satisfies the condition.

```java
numbers.stream().allMatch(n -> n > 0);        // true
numbers.stream().allMatch(n -> n % 2 == 0);   // false
```

### noneMatch()

Returns `true` only if **no** elements satisfy the condition.

```java
numbers.stream().noneMatch(n -> n < 0);   // true
numbers.stream().noneMatch(n -> n > 20);  // false
```

### Difference Between Match Operations

```java
List<Integer> list = Arrays.asList(2, 4, 6, 7);
```

| Operation | Code | Result | Why |
| --- | --- | --- | --- |
| `anyMatch()` | `list.stream().anyMatch(n -> n % 2 != 0)` | `true` | One odd number exists |
| `allMatch()` | `list.stream().allMatch(n -> n % 2 == 0)` | `false` | Not every number is even |
| `noneMatch()` | `list.stream().noneMatch(n -> n < 0)` | `true` | There are no negative numbers |

## Short-Circuiting

These operations **stop as soon as the result is known**: `findFirst()`, `findAny()`, `anyMatch()`, `allMatch()`, `noneMatch()`.

```java
List<Integer> list = Arrays.asList(2, 4, 6, 8, 9, 10);

boolean result = list.stream()
        .peek(System.out::println)
        .anyMatch(n -> n % 2 != 0);

System.out.println(result);
```

```output
2
4
6
8
9
true
```

Notice `10` is **never processed** because the answer is already known after finding `9`.

## Real Spring Boot Examples

```java
// Validate user exists
boolean exists = users.stream()
        .anyMatch(u -> u.getEmail().equals(email));

// Get first active user
User user = users.stream()
        .filter(User::isActive)
        .findFirst()
        .orElseThrow();

// Check all orders are paid
boolean paid = orders.stream()
        .allMatch(Order::isPaid);

// Ensure no expired tokens
boolean valid = tokens.stream()
        .noneMatch(Token::isExpired);
```

> [!NOTE]
> The no-argument `orElseThrow()` was added in **Java 10**. On Java 8 use `orElseThrow(NoSuchElementException::new)` or `.get()`.

## Interview Questions

### Q1. Is filter() an intermediate or terminal operation?

Intermediate.

### Q2. What is the return type of findFirst()?

`Optional<T>`.

### Q3. Why does findFirst() return Optional?

Because there may not be a matching element, and `Optional` avoids returning `null` and helps prevent `NullPointerException`.

### Q4. Which operations are short-circuiting?

`findFirst()`, `findAny()`, `anyMatch()`, `allMatch()` and `noneMatch()` (and `limit()` among intermediate operations).

### Q5. Difference between filter() and anyMatch()?

| filter() | anyMatch() |
| --- | --- |
| Returns a `Stream<T>` | Returns `boolean` |
| Continues processing until a terminal operation | Stops as soon as one match is found |
| Used to filter a stream | Used to answer a yes/no question |

## Practice Problems

```java
List<Integer> numbers = Arrays.asList(12, 5, 8, 19, 22, 31, 44, 50);
```

1. Print all even numbers.
2. Print all odd numbers.
3. Print numbers greater than 20.
4. Print numbers divisible by 4.
5. Find the first number greater than 20.
6. Find any even number.
7. Check if any number is greater than 100.
8. Check if all numbers are positive.
9. Check if none of the numbers are negative.
10. Count how many even numbers are present.

### Coding Challenge (Interview Level)

```java
class Employee {
    int id;
    String name;
    String department;
    int age;
    double salary;
}
```

1. Find the first employee whose salary is greater than 100000.
2. Check whether any employee belongs to the "HR" department.
3. Check whether all employees are older than 18.
4. Check whether none of the employees have a negative salary.
5. Print employees whose names start with "A" and whose salary is greater than 50000.

## Chapter Summary

- ✅ `filter()` and `Predicate`
- ✅ Chaining multiple filters
- ✅ `findFirst()` vs `findAny()` and why they return `Optional`
- ✅ `anyMatch()`, `allMatch()`, `noneMatch()`
- ✅ Short-circuiting
- ✅ Spring Boot usage
