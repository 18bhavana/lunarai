---
title: Method References
subtitle: Every form of :: explained — static, specific-object, arbitrary-object and constructor references, array constructors, and when a lambda is better.
order: 16
---

## Introduction

One of the most elegant features of Java 8. In any modern Spring Boot project you'll constantly see code like:

```java
Employee::getName
System.out::println
String::toUpperCase
Integer::sum
User::new
```

Many developers use method references but don't understand how they work. After this chapter you'll be able to explain every `::` expression in an interview.

## What is a Method Reference?

A method reference is simply a **shorter way of writing a lambda**.

```java
// Lambda
Function<String, String> upper = s -> s.toUpperCase();

// Method reference
Function<String, String> upper = String::toUpperCase;
```

Both do exactly the same thing.

### How Does the Compiler Understand It?

Remember the previous chapter: `Function<T, R>` has `R apply(T t)`. So `String::toUpperCase` means `s -> s.toUpperCase()`. The compiler generates the lambda.

## The 4 Types

```tree
Method References
  Static | Class::staticMethod
  Specific object | object::instanceMethod
  Arbitrary object | Class::instanceMethod
  Constructor | Class::new
```

### Type 1 — Static Method Reference

```java
class MathUtil {

    static int square(int n) {
        return n * n;
    }
}
```

```java
// Lambda
Function<Integer, Integer> f = n -> MathUtil.square(n);

// Method reference — exactly the same
Function<Integer, Integer> f = MathUtil::square;
```

Another example:

```java
BinaryOperator<Integer> add = (a, b) -> Integer.sum(a, b);   // lambda
BinaryOperator<Integer> add = Integer::sum;                  // method reference
```

### Type 2 — Instance Method Reference (Specific Object)

```java
Printer printer = new Printer();

// Lambda
Consumer<String> c = s -> printer.print(s);

// Method reference
Consumer<String> c = printer::print;
```

Notice: a **specific object** — `printer` already exists.

### Type 3 — Instance Method Reference (Arbitrary Object)

**This is the one that confuses everyone.**

```java
List<String> names = Arrays.asList("john", "alex", "david");

// Lambda
names.stream()
     .map(s -> s.toUpperCase());

// Method reference
names.stream()
     .map(String::toUpperCase);
```

**Where did `s` go?** The stream automatically passes **each element as the object** the method is called on:

```flow
String::toUpperCase
: called on each element
"john".toUpperCase() · "alex".toUpperCase() · "david".toUpperCase()
```

That's why `String::toUpperCase` works. Another example: `.map(s -> s.length())` → `.map(String::length)`.

### Type 4 — Constructor Reference

```java
class Employee {
    Employee() {
    }
}

// Lambda
Supplier<Employee> supplier = () -> new Employee();

// Method reference
Supplier<Employee> supplier = Employee::new;
```

Beautiful.

**Parameterized constructor:**

```java
class Employee {
    Employee(String name) {
    }
}

// Lambda
Function<String, Employee> f = name -> new Employee(name);

// Method reference
Function<String, Employee> f = Employee::new;
```

The compiler knows which constructor matches — from the target functional interface.

### Array Constructor Reference

Few developers know this.

```java
// Lambda
Function<Integer, String[]> f = size -> new String[size];

// Method reference
Function<Integer, String[]> f = String[]::new;
```

Very common in:

```java
stream.toArray(String[]::new);
```

Interview favourite.

## Method References in Streams

| Operation | Lambda | Method reference |
| --- | --- | --- |
| `map()` | `.map(e -> e.getName())` | `.map(Employee::getName)` |
| `filter()` | `.filter(user -> user.isActive())` | `.filter(User::isActive)` |
| `forEach()` | `.forEach(name -> System.out.println(name))` | `.forEach(System.out::println)` |
| `sorted()` | `.sorted((a, b) -> a.compareTo(b))` | `.sorted(String::compareTo)` |
| `reduce()` | `.reduce((a, b) -> a + b)` | `.reduce(Integer::sum)` |

## When NOT to Use Method References

Sometimes lambdas are clearer.

```java
.map(e -> e.getSalary() * 1.10)
```

Can this become a method reference? **No** — there is no existing method that does it.

```java
.filter(e -> e.getSalary() > 50_000)
```

This is custom logic. Keep it as a lambda.

> [!TIP]
> **Rule:** use method references only when they improve readability.

## Real Spring Boot Examples

```java
// Entity -> DTO
.map(user -> UserMapper.toDto(user))   // lambda
.map(UserMapper::toDto)                // method reference

// Print logs
.forEach(log::info)                    // instead of .forEach(s -> log.info(s))

// Repository results
users.stream()
     .map(User::getEmail)

// Sum
.reduce(Integer::sum)

// Constructor
Supplier<UserDTO> supplier = UserDTO::new;
```

## Lambda vs Method Reference

| Lambda | Method reference |
| --- | --- |
| `x -> x.toUpperCase()` | `String::toUpperCase` |
| `e -> e.getName()` | `Employee::getName` |
| `(a, b) -> Integer.sum(a, b)` | `Integer::sum` |
| `() -> new Employee()` | `Employee::new` |

Method references reduce boilerplate when a lambda simply calls an existing method.

## Behind the Scenes

This:

```java
.map(Employee::getName)
```

behaves like:

```java
.map(e -> e.getName())
```

Internally, Java uses the same lambda infrastructure (**`invokedynamic`**) for both. Method references are primarily a **syntax improvement**, not a different execution model.

## Interview Questions

### Q1. What are the four types of method references?

Static, specific object, arbitrary object, and constructor.

### Q2. Difference between printer::print and String::toUpperCase?

- `printer::print` — a **specific** object.
- `String::toUpperCase` — **any** object of that class (the stream element).

### Q3. Difference between a lambda and a method reference?

A method reference is simply a more concise form when a lambda **only invokes an existing method**.

### Q4. Can every lambda become a method reference?

No. Only if the lambda body is just a call to an existing method or constructor.

- ✅ Possible: `e -> e.getName()`
- ❌ Impossible: `e -> e.getSalary() * 1.10`

### Q5. Why use method references?

Less code, better readability, and reuse of existing methods.

## Interview Cheat Sheet

| Lambda | Method reference |
| --- | --- |
| `x -> x.length()` | `String::length` |
| `x -> x.toUpperCase()` | `String::toUpperCase` |
| `x -> System.out.println(x)` | `System.out::println` |
| `x -> Integer.parseInt(x)` | `Integer::parseInt` |
| `(a, b) -> Integer.sum(a, b)` | `Integer::sum` |
| `() -> new Employee()` | `Employee::new` |
| `name -> new Employee(name)` | `Employee::new` |
| `size -> new String[size]` | `String[]::new` |

## Practice Problems

Convert these lambdas into method references.

### Problem 1 — s -> s.length()

`String::length`

### Problem 2 — e -> e.getSalary()

`Employee::getSalary`

### Problem 3 — x -> Integer.parseInt(x)

`Integer::parseInt`

### Problem 4 — () -> UUID.randomUUID()

`UUID::randomUUID`

### Problem 5 — name -> new Employee(name)

`Employee::new`

### Problem 6 — (s) -> System.out.println(s)

`System.out::println`

### 5+ Years Interview Challenge

Write a pipeline that filters active employees, converts them to DTOs, sorts by name and prints each DTO.

```java
employees.stream()
         .filter(Employee::isActive)
         .map(EmployeeMapper::toDto)
         .sorted(Comparator.comparing(EmployeeDTO::getName))
         .forEach(System.out::println);
```

Notice how the pipeline is almost entirely built from method references — the style you'll often see in production Spring Boot applications.

## Senior Java Tips

### 1. Don't force method references

This is good: `.map(Employee::getName)`. This is better left as a lambda: `.map(e -> e.getSalary() * 1.10)`. Readability always comes first.

### 2. Recognize constructor references

When you see `Employee::new`, mentally translate it to `() -> new Employee()` or `name -> new Employee(name)`, depending on the target functional interface.

### 3. Learn to identify the target functional interface

`.map(Employee::getName)` works because `map()` expects a `Function<T, R>`. `.forEach(System.out::println)` works because `forEach()` expects a `Consumer<T>`. Understanding the target interface makes method references much easier to reason about.

## Chapter Summary

- ✅ A method reference is shorthand for a lambda that calls one method
- ✅ Static, specific-object, arbitrary-object and constructor references
- ✅ Array constructor references (`String[]::new`)
- ✅ The target functional interface decides the meaning
- ✅ When a lambda is clearer
