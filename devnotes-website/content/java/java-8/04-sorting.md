---
title: Sorting
subtitle: sorted(), natural and reverse order, Comparator.comparing, thenComparing, nulls handling, stability and top-N patterns.
order: 4
---

## Introduction

One of the most important interview topics in Java Streams. If you've attended Java interviews, you've probably seen questions like:

- Sort employees by salary.
- Sort employees by age, then by salary.
- Sort strings by length.
- Sort a map by value.
- Find the top 3 highest salaries.

By the end of this chapter you'll master `sorted()`, `Comparator.naturalOrder()`, `Comparator.reverseOrder()`, `Comparator.comparing()`, `thenComparing()`, `reversed()`, `nullsFirst()`, `nullsLast()` and multi-level sorting.

> [!NOTE]
> Several examples end with `.toList()`. `Stream.toList()` was added in **Java 16**; on Java 8 use `.collect(Collectors.toList())`.

## How sorted() Works

`sorted()` arranges stream elements according to their **natural order** or a **custom comparator**.

```java
stream.sorted();
stream.sorted(comparator);
```

## Natural Ordering

### Numbers

```java
List<Integer> numbers = Arrays.asList(8, 3, 10, 2, 5);

numbers.stream()
       .sorted()
       .forEach(System.out::println);
```

```output
2
3
5
8
10
```

### Strings

```java
List<String> names = Arrays.asList("John", "Alex", "David");

names.stream()
     .sorted()
     .forEach(System.out::println);
```

```output
Alex
David
John
```

Alphabetical order.

### Descending Order

```java
numbers.stream()
       .sorted(Comparator.reverseOrder())
       .forEach(System.out::println);
```

```output
10
8
5
3
2
```

### Comparator.naturalOrder()

These two are equivalent:

```java
.sorted()
.sorted(Comparator.naturalOrder())
```

## Sorting Objects

```java
class Employee {

    int id;
    String name;
    int age;
    double salary;

    public Employee(int id, String name, int age, double salary) {
        this.id = id;
        this.name = name;
        this.age = age;
        this.salary = salary;
    }

    public String getName() { return name; }
    public int getAge() { return age; }
    public double getSalary() { return salary; }
}
```

### Sort by Salary

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getSalary))
         .forEach(e -> System.out.println(e.getName()));
```

With John 50000, Alex 70000, David 60000:

```output
John
David
Alex
```

Ascending salary.

### Descending Salary

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getSalary).reversed())
         .forEach(e -> System.out.println(e.getName()));
```

```output
Alex
David
John
```

### Sort by Name or Age

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getName))
         .forEach(e -> System.out.println(e.getName()));

employees.stream()
         .sorted(Comparator.comparing(Employee::getAge))
         .forEach(System.out::println);
```

> [!TIP]
> For primitive keys, `Comparator.comparingInt(Employee::getAge)` / `comparingDouble(...)` avoid boxing.

## Multi-Level Sorting (thenComparing)

**Interview favourite.**

| Name | Age | Salary |
| --- | --- | --- |
| John | 30 | 50000 |
| Alex | 25 | 70000 |
| David | 30 | 60000 |
| Bob | 25 | 45000 |

Requirement: **age ascending, then salary descending**.

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getAge)
                 .thenComparing(Comparator.comparing(Employee::getSalary).reversed()))
         .forEach(e -> System.out.println(e.getName()));
```

```output
Alex
Bob
David
John
```

**Why?** Age 25: Alex 70000, Bob 45000. Age 30: David 60000, John 50000.

### Multiple Fields

Sort by department, then age, then salary:

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getDepartment)
                 .thenComparing(Employee::getAge)
                 .thenComparing(Employee::getSalary))
         .forEach(System.out::println);
```

Unlimited chaining is possible.

## Sorting Strings by Length

```java
List<String> names = Arrays.asList("Alexander", "Bob", "John", "Amy");

names.stream()
     .sorted(Comparator.comparing(String::length))
     .forEach(System.out::println);
```

```output
Bob
Amy
John
Alexander
```

### Reverse by Length

```java
names.stream()
     .sorted(Comparator.comparing(String::length).reversed())
     .forEach(System.out::println);
```

```output
Alexander
John
Bob
Amy
```

## Handling null Values

Without handling:

```java
List<String> names = Arrays.asList("John", null, "Alex");

names.stream()
     .sorted()
     .forEach(System.out::println);
```

```output
NullPointerException
```

### nullsFirst()

```java
names.stream()
     .sorted(Comparator.nullsFirst(Comparator.naturalOrder()))
     .forEach(System.out::println);
```

```output
null
Alex
John
```

### nullsLast()

```java
names.stream()
     .sorted(Comparator.nullsLast(Comparator.naturalOrder()))
     .forEach(System.out::println);
```

```output
Alex
John
null
```

## sorted() is Stable

If two elements compare equal, their **original order is preserved** (for ordered streams).

| Name | Salary |
| --- | --- |
| John | 50000 |
| Alex | 50000 |
| David | 70000 |

Sort by salary → `John, Alex, David`. John remains before Alex because they have equal salaries.

## Real Spring Boot Examples

```java
// Sort products by price
products.stream()
        .sorted(Comparator.comparing(Product::getPrice))
        .toList();

// Highest salary first
employees.stream()
         .sorted(Comparator.comparing(Employee::getSalary).reversed())
         .toList();

// Sort orders by date
orders.stream()
      .sorted(Comparator.comparing(Order::getOrderDate))
      .toList();

// Sort DTOs by name
dtoList.stream()
       .sorted(Comparator.comparing(UserDTO::getName))
       .toList();
```

## sorted() vs List.sort()

| sorted() | List.sort() |
| --- | --- |
| Returns a new sorted stream | Sorts the existing list |
| Original list is unchanged | Original list is modified |
| Used in Stream pipelines | Used directly on collections |

```java
List<Integer> numbers = Arrays.asList(3, 1, 2);

List<Integer> sorted = numbers.stream()
        .sorted()
        .toList();

System.out.println(numbers);
System.out.println(sorted);
```

```output
[3, 1, 2]
[1, 2, 3]
```

## Top-N Values

Highest 3 salaries:

```java
employees.stream()
         .sorted(Comparator.comparing(Employee::getSalary).reversed())
         .limit(3)
         .forEach(System.out::println);
```

A very common interview pattern.

### Pipeline Example

Requirement: salary > 50,000 → sort by salary descending → get names.

```java
employees.stream()
         .filter(e -> e.getSalary() > 50000)
         .sorted(Comparator.comparing(Employee::getSalary).reversed())
         .map(Employee::getName)
         .forEach(System.out::println);
```

```flow-h
Employee
filter()
Employee
sorted()
Employee
map()
String
forEach()
```

## Interview Questions

### Q1. Is sorted() an intermediate or terminal operation?

Intermediate (a *stateful* one — it must see all elements before emitting any).

### Q2. Does sorted() modify the original collection?

No. It returns a new sorted stream.

### Q3. Difference between sorted() and List.sort()?

- `sorted()` creates a sorted stream.
- `List.sort()` modifies the original list.

### Q4. How do you sort descending?

`Comparator.reverseOrder()`, or `Comparator.comparing(Employee::getSalary).reversed()`.

### Q5. How do you sort by multiple fields?

`Comparator.comparing(Employee::getAge).thenComparing(Employee::getSalary)`.

## Practice Problems

```java
List<Integer> numbers = Arrays.asList(10, 3, 25, 6, 15, 8);
```

1. Sort ascending.
2. Sort descending.
3. Sort and get the first 3 numbers.
4. Sort descending and get the top 2 numbers.
5. Sort, remove duplicates, then print.

```java
class Employee {
    int id;
    String name;
    String department;
    int age;
    double salary;
}
```

1. Sort by salary.
2. Sort by salary descending.
3. Sort by age.
4. Sort by name.
5. Sort by department.
6. Sort by department, then age.
7. Sort by salary descending, then name.
8. Print the top 5 highest-paid employees.
9. Print employees sorted by name length.
10. Print employees whose salary is greater than 60000, sorted by salary descending.

### Interview Challenge (5+ Years)

Write a single Stream pipeline to: filter employees with salary > 50,000; sort by **department (asc) → salary (desc) → name (asc)**; convert to employee names; collect into a `List<String>`.

```java
List<String> result = employees.stream()
        .filter(e -> e.getSalary() > 50_000)
        .sorted(Comparator.comparing(Employee::getDepartment)
                .thenComparing(Comparator.comparing(Employee::getSalary).reversed())
                .thenComparing(Employee::getName))
        .map(Employee::getName)
        .toList();
```

## Pro Tips for Senior Java Developers

1. Prefer method references (`Employee::getSalary`) over lambdas (`e -> e.getSalary()`) when they improve readability.
2. Put `filter()` **before** `sorted()` whenever possible to reduce the number of elements that need sorting.
3. Sorting is **O(n log n)**. If you only need the maximum or minimum element, use `max()` or `min()` instead of sorting the entire stream.

## Chapter Summary

- ✅ `sorted()` with natural and reverse order
- ✅ `Comparator.comparing()`, `reversed()`, `thenComparing()`
- ✅ Multi-level sorting
- ✅ `nullsFirst()` / `nullsLast()`
- ✅ Stability
- ✅ `sorted()` vs `List.sort()`
- ✅ Top-N patterns
