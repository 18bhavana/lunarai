---
title: flatMap()
subtitle: The most misunderstood Stream operation — flattening nested collections, map() vs flatMap(), chained flatMap, flatMapToInt and null-safe flattening.
order: 10
---

## Introduction

This topic confuses almost every Java developer at first. A common pattern in interviews: candidates know `map()`, but don't really understand `flatMap()`.

Once you understand `flatMap()`, you'll solve problems involving nested lists, Orders → Items, Employee → Skills, Customer → Orders, Department → Employees, Files → Lines, JSON arrays and database relationships. A must-know topic for Spring Boot developers.

By the end of this chapter you'll master what `flatMap()` actually does, the difference between `map()` and `flatMap()`, flattening nested collections, `flatMapToInt()`, and advanced interview problems.

## First, Understand map()

```java
List<String> names = Arrays.asList("John", "Alex", "David");

names.stream()
     .map(String::toUpperCase)
```

```output
JOHN
ALEX
DAVID
```

**One input → one output.** Every element becomes exactly one element.

### Now Imagine This

Instead of `John`, suppose every employee has skills: **John → Java, SQL, Spring**.

Now one employee becomes **multiple values**. `map()` cannot flatten this — this is where `flatMap()` comes in.

## What is flatMap()?

> [!IMPORTANT]
> `flatMap()` transforms each element into a **stream** and then **flattens** all those streams into one continuous stream.

```flow-h
Employee
Stream<Skill>
One flat stream
```

## The Classic Example

```java
List<List<Integer>> list = Arrays.asList(
        Arrays.asList(1, 2),
        Arrays.asList(3, 4),
        Arrays.asList(5, 6)
);
```

```text
[
  [1, 2],
  [3, 4],
  [5, 6]
]
```

### Using map()

```java
list.stream()
    .map(List::stream)
```

Result: **`Stream<Stream<Integer>>`** — a stream of streams of numbers. Not useful.

### Using flatMap()

```java
list.stream()
    .flatMap(List::stream)
    .forEach(System.out::println);
```

```output
1
2
3
4
5
6
```

```flow
[1, 2] · [3, 4] · [5, 6]
: flatMap(List::stream)
1 2 3 4 5 6 {one stream}
```

### Why "Flat"?

```flow-h
List<List<Integer>> {nested}
: flatMap
Stream<Integer> {flat}
```

## Employee Skills Example

```java
class Employee {
    String name;
    List<String> skills;
}
```

Data: **John → Java, Spring, SQL** and **Alex → Docker, AWS**. Requirement: get all skills.

```java
employees.stream()
         .flatMap(e -> e.getSkills().stream())
         .forEach(System.out::println);
```

```output
Java
Spring
SQL
Docker
AWS
```

### Remove Duplicate Skills

```java
employees.stream()
         .flatMap(e -> e.getSkills().stream())
         .distinct()
         .forEach(System.out::println);
```

No duplicates — if two employees both know Java, it's printed once.

### Count Skills

```java
long count = employees.stream()
        .flatMap(e -> e.getSkills().stream())
        .count();
```

### Sort Skills

```java
employees.stream()
         .flatMap(e -> e.getSkills().stream())
         .sorted()
         .forEach(System.out::println);
```

### flatMap + filter

Need only Java-related skills:

```java
employees.stream()
         .flatMap(e -> e.getSkills().stream())
         .filter(skill -> skill.startsWith("Java"))
         .forEach(System.out::println);
```

## Orders Example

```java
class Order {
    List<Item> items;
}
```

Need all items:

```java
orders.stream()
      .flatMap(order -> order.getItems().stream())
      .collect(Collectors.toList());
```

A very common Spring Boot pattern.

## Customer → Orders → Items

```flow-h
Customer
Orders
Items
```

Need all items:

```java
customers.stream()
         .flatMap(customer -> customer.getOrders().stream())
         .flatMap(order -> order.getItems().stream())
         .collect(Collectors.toList());
```

Notice the **multiple `flatMap()` calls**.

## File Processing

```flow-h
File
Lines
Words
```

```java
try (Stream<String> lines = Files.lines(path)) {
    lines.flatMap(line -> Arrays.stream(line.split(" ")))
         .forEach(System.out::println);
}
```

Output: every word in the file. Very useful.

> [!TIP]
> `Files.lines()` holds an open file handle, so use it in **try-with-resources** as shown.

## flatMapToInt()

```java
class Student {
    List<Integer> marks;
}
```

Need total marks:

```java
int total = students.stream()
        .flatMapToInt(s -> s.getMarks().stream().mapToInt(Integer::intValue))
        .sum();
```

## map() vs flatMap()

Asked constantly.

| map() | flatMap() |
| --- | --- |
| One → One | One → Many (zero or more) |
| Returns a Stream | Returns a flattened Stream |
| No flattening | Flattens nested streams |
| Employee → Name: `map(Employee::getName)` | Employee → Skills: `flatMap(e -> e.getSkills().stream())` |

## Real Spring Boot Examples

```java
// Employee -> skills
employees.stream()
         .flatMap(e -> e.getSkills().stream());

// Orders -> items
orders.stream()
      .flatMap(o -> o.getItems().stream());

// Department -> employees
departments.stream()
           .flatMap(d -> d.getEmployees().stream());

// Roles -> permissions
roles.stream()
     .flatMap(r -> r.getPermissions().stream());
```

### JWT Roles

Suppose a JWT contains `ROLE_ADMIN`, `ROLE_USER` and `ROLE_MANAGER`, and each role maps to a set of permissions:

```java
claims.getRoles()
      .stream()
      .flatMap(role -> role.getPermissions().stream())
```

Very common in Spring Security.

## Interview Questions

### Q1. Difference between map() and flatMap()?

`map()` transforms one element into one element. `flatMap()` transforms one element into multiple (zero or more) elements and flattens them.

### Q2. Why not use map(List::stream)?

Because it returns `Stream<Stream<T>>` instead of `Stream<T>`.

### Q3. When do you use flatMap()?

Whenever an object contains a collection — Employee → Skills, Order → Items, Customer → Orders.

### Q4. Can we chain flatMap()?

Absolutely. Company → Departments → Employees → Skills:

```java
company.stream()
       .flatMap(...)
       .flatMap(...)
       .flatMap(...)
```

## Practice Problems

```java
class Employee {
    String name;
    List<String> skills;
}
```

1. Print all skills.
2. Print unique skills.
3. Sort all skills.
4. Count skills.
5. Print only skills starting with `"J"`.
6. Convert skills into a `Set`.
7. Join all skills with commas.
8. Find the longest skill name.
9. Count unique skills.
10. Find the alphabetically first skill.

```java
class Customer {
    List<Order> orders;
}

class Order {
    List<Item> items;
}
```

1. Get all orders.
2. Get all items.
3. Count all items.
4. Find unique items.
5. Find the most expensive item.
6. Find the cheapest item.
7. Group items by category.
8. Count items by category.
9. Sort items by price.
10. Find the top 5 expensive items.

### Senior Interview Challenge (5+ Years)

```java
class Company {
    List<Department> departments;
}

class Department {
    String name;
    List<Employee> employees;
}

class Employee {
    String name;
    List<String> skills;
}
```

Return a `Map<String, Set<String>>` where key = department name and value = **unique, sorted** employee skills.

```java
Map<String, Set<String>> result = company.getDepartments().stream()
        .collect(Collectors.toMap(
                Department::getName,
                department -> department.getEmployees().stream()
                        .flatMap(employee -> employee.getSkills().stream())
                        .collect(Collectors.toCollection(TreeSet::new))
        ));
```

**Why this is a great interview solution:**

- `toMap()` creates the department-to-skills mapping.
- `flatMap()` flattens all employee skill lists into one stream.
- `TreeSet` both removes duplicates and keeps the skills sorted.

## Senior Java Tips

### 1. The Golden Rule

Ask yourself: *does each input produce exactly one output?*

```flow
? One output per input? | Yes: map() | No — a collection or stream: flatMap()
```

### 2. Don't confuse flatMap() with Collectors.flatMapping()

| flatMap() | Collectors.flatMapping() |
| --- | --- |
| Stream operation | Collector (Java 9+) |
| Before `collect()` | Inside `groupingBy()` |

```java
Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.flatMapping(e -> e.getSkills().stream(), Collectors.toSet())
)
```

### 3. Watch for null

This can throw a `NullPointerException`:

```java
.flatMap(e -> e.getSkills().stream())
```

If `getSkills()` might return `null`, use:

```java
.flatMap(e -> Optional.ofNullable(e.getSkills())
        .orElse(Collections.emptyList())
        .stream())
```

This makes your pipeline null-safe.

## You've Completed the Core of Java Streams

You now understand the stream lifecycle, `filter()`, `map()`, `sorted()`, `distinct()`, `limit()`, `skip()`, `reduce()`, `collect()`, `groupingBy()`, `partitioningBy()`, advanced collectors and `flatMap()` — the APIs you'll use in the majority of enterprise Java codebases. From here on, the focus shifts from learning APIs to **solving problems**.

## Chapter Summary

- ✅ `flatMap()` = map each element to a stream, then flatten
- ✅ `map(List::stream)` gives `Stream<Stream<T>>`
- ✅ Chained `flatMap()` for deep nesting
- ✅ File → lines → words
- ✅ `flatMapToInt()`
- ✅ `flatMap()` vs `Collectors.flatMapping()`
- ✅ Null-safe flattening
