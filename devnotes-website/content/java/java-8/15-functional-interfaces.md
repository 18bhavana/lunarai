---
title: Functional Interfaces
subtitle: The engine behind Streams — @FunctionalInterface, lambdas, Predicate, Function, Consumer, Supplier, UnaryOperator, BinaryOperator, composition and chaining.
order: 15
---

## Introduction

One of the most important Java 8 topics. **If Streams are the car, Functional Interfaces are the engine.**

Most developers memorize `filter()`, `map()` and `forEach()`, but very few understand **why these methods accept lambdas**. This chapter changes that. You'll master what a functional interface is, `@FunctionalInterface`, lambda expressions, `Predicate`, `Function`, `Consumer`, `Supplier`, `UnaryOperator`, `BinaryOperator`, primitive functional interfaces, function composition and predicate chaining.

## What is a Functional Interface?

A **Functional Interface** is an interface that has **exactly one abstract method**.

```java
@FunctionalInterface
interface Calculator {

    int calculate(int a, int b);
}
```

✅ Valid — only one abstract method.

This is **not** a functional interface:

```java
interface Calculator {

    int add(int a, int b);

    int subtract(int a, int b);
}
```

❌ Because there are two abstract methods. (With `@FunctionalInterface` on it, the compiler reports an error.)

### Why Did Java Introduce Functional Interfaces?

Before Java 8:

```java
Runnable r = new Runnable() {
    @Override
    public void run() {
        System.out.println("Hello");
    }
};
```

Java 8:

```java
Runnable r = () -> System.out.println("Hello");
```

Cleaner. Shorter. Readable.

## What is a Lambda?

A lambda is simply an **implementation of a functional interface**.

```java
Calculator add = (a, b) -> a + b;
```

This is equivalent to:

```java
Calculator add = new Calculator() {
    @Override
    public int calculate(int a, int b) {
        return a + b;
    }
};
```

The compiler creates the implementation for you.

> [!NOTE]
> "Equivalent" in behaviour, not in mechanics: a lambda is **not** compiled into an anonymous inner class. It's linked at runtime through `invokedynamic`, produces no extra `.class` file, and inside a lambda `this` refers to the enclosing instance rather than the lambda itself.

## The Six You Must Know

Instead of creating your own, Java provides common ones in `java.util.function`:

| Interface | Purpose | Method |
| --- | --- | --- |
| `Predicate<T>` | Test something | `boolean test(T t)` |
| `Function<T, R>` | Transform something | `R apply(T t)` |
| `Consumer<T>` | Consume / use something | `void accept(T t)` |
| `Supplier<T>` | Supply / create something | `T get()` |
| `UnaryOperator<T>` | Same type → same type | `T apply(T t)` |
| `BinaryOperator<T>` | Combine two values of the same type | `T apply(T a, T b)` |

If you master these six, Streams become much easier.

## Predicate

**Meaning:** ask a YES/NO question.

```java
boolean test(T t);
```

```java
Predicate<Integer> isEven = n -> n % 2 == 0;

System.out.println(isEven.test(10));
```

```output
true
```

### Stream Connection

```java
numbers.stream()
       .filter(n -> n % 2 == 0)
```

**What does `filter()` expect?** A `Predicate<Integer>`. Internally:

```java
filter(Predicate<? super T> predicate)
```

One of the most common interview questions.

### Predicate Chaining

Need **adult (age ≥ 18) AND salary > 50,000**:

```java
Predicate<Employee> adult = e -> e.getAge() >= 18;

Predicate<Employee> rich = e -> e.getSalary() > 50000;

Predicate<Employee> result = adult.and(rich);
```

Other operations:

```java
adult.or(rich);
adult.negate();
```

## Function<T, R>

**Meaning:** transform one object into another.

```java
R apply(T t);
```

```java
Function<String, Integer> length = String::length;

System.out.println(length.apply("Java"));
```

```output
4
```

### Stream Connection

```java
employees.stream()
         .map(Employee::getName)
```

**What does `map()` accept?** A `Function<Employee, String>`. Internally:

```java
map(Function<? super T, ? extends R> mapper)
```

### Function Composition

Need **name → uppercase → length**.

```java
Function<String, String> upper = String::toUpperCase;      // step 1
Function<String, Integer> length = String::length;         // step 2

Function<String, Integer> result = upper.andThen(length);  // combine

System.out.println(result.apply("java"));
```

```flow-h upper.andThen(length)
java
: upper
JAVA
: length
4
```

### compose()

**Reverse order.** `f.compose(g)` means *run `g` first, then `f`*:

```flow-h f.compose(g) — interview favourite
input
: g
g(input)
: f
f(g(input))
```

## Consumer

**Meaning:** consume a value, return nothing.

```java
void accept(T t);
```

```java
Consumer<String> print = System.out::println;

print.accept("Hello");
```

```output
Hello
```

### Stream Connection

```java
stream.forEach(System.out::println);
```

**What does `forEach()` accept?** A `Consumer<T>`.

## Supplier

**Meaning:** provide a value. No input, one output.

```java
T get();
```

```java
Supplier<UUID> supplier = UUID::randomUUID;

System.out.println(supplier.get());
```

Every call creates a new UUID.

### Stream Connection

```java
Stream.generate(UUID::randomUUID)
```

`generate()` accepts a `Supplier`.

## UnaryOperator

A special type of `Function`: **input and output are the same type**.

```java
UnaryOperator<String> upper = String::toUpperCase;

System.out.println(upper.apply("java"));
```

```output
JAVA
```

Equivalent to `Function<String, String>`, but more readable.

## BinaryOperator

**Two inputs, one output — all the same type.**

```java
BinaryOperator<Integer> add = Integer::sum;

System.out.println(add.apply(10, 20));
```

```output
30
```

### Stream Connection

```java
reduce(Integer::sum)
```

`reduce()` accepts a `BinaryOperator`.

## Primitive Functional Interfaces

Avoid boxing.

| Instead of | Use |
| --- | --- |
| `Function<Integer, Integer>` | `IntUnaryOperator` |
| `Predicate<Integer>` | `IntPredicate` |

```java
IntPredicate even = n -> n % 2 == 0;

IntUnaryOperator square = n -> n * n;
```

These are faster because they avoid boxing.

## Real Spring Boot Examples

```java
// Filter active users
Predicate<User> active = User::isActive;

users.stream()
     .filter(active)
     .toList();

// Convert entity to DTO
Function<User, UserDTO> mapper = UserMapper::toDto;

users.stream()
     .map(mapper)
     .toList();

// Logging
Consumer<Order> logger = System.out::println;
orders.forEach(logger);

// Generate token
Supplier<String> token = () -> UUID.randomUUID().toString();
```

## How Streams Use Functional Interfaces

| Stream method | Functional interface |
| --- | --- |
| `filter()` | `Predicate` |
| `map()` | `Function` |
| `forEach()` | `Consumer` |
| `generate()` | `Supplier` |
| `reduce()` | `BinaryOperator` |
| `mapToInt()` | `ToIntFunction` |
| `sorted()` | `Comparator` (a functional interface) |

Memorize this table. It's a very common interview question.

## Interview Questions

### Q1. What is a Functional Interface?

An interface with **exactly one abstract method**.

### Q2. Can a Functional Interface have default methods?

Yes:

```java
@FunctionalInterface
interface Demo {

    void run();

    default void print() {
        System.out.println("Default");
    }
}
```

Still valid.

### Q3. Can it have static methods?

Yes. Only **abstract** methods are counted. (Abstract methods that override public `Object` methods, like `equals()`, aren't counted either — that's why `Comparator` is functional.)

### Q4. Difference between Function and Consumer?

| Function | Consumer |
| --- | --- |
| Returns a value | Returns nothing |
| `apply()` | `accept()` |

### Q5. Difference between Predicate and Function?

| Predicate | Function |
| --- | --- |
| Returns `boolean` | Returns any type |
| Used in `filter()` | Used in `map()` |

### Q6. Difference between Supplier and Consumer?

| Supplier | Consumer |
| --- | --- |
| Produces data | Uses data |
| No input | Takes input |

## Practice Problems

**Predicate**

1. Check if a number is even.
2. Check if a string is empty.
3. Check if an employee's salary is greater than 50,000.
4. Combine two predicates using `and()`.
5. Use `negate()` to find odd numbers.

**Function**

1. Convert a string to uppercase.
2. Find the length of a string.
3. Convert `Employee` to employee name.
4. Convert `Employee` to salary.
5. Chain two functions using `andThen()`.

**Consumer**

1. Print employee names.
2. Print salaries.
3. Print uppercase names.
4. Log employee details.
5. Use `forEach()` with a consumer.

**Supplier**

1. Generate a UUID.
2. Generate a random integer.
3. Generate the current timestamp.
4. Return `"Guest"` as a default user.
5. Create a new `Employee` object.

### 5+ Years Interview Challenge

Implement an employee processing pipeline using reusable functional interfaces.

```java
Predicate<Employee> highSalary = e -> e.getSalary() > 60_000;

Function<Employee, String> toName = Employee::getName;

Consumer<String> print = System.out::println;

employees.stream()
         .filter(highSalary)
         .map(toName)
         .sorted()
         .forEach(print);
```

**Why is this good?**

- Business rules (`Predicate`) are reusable.
- Mapping logic (`Function`) is reusable.
- Output logic (`Consumer`) is reusable.
- The stream pipeline reads like a sentence.

A pattern you'll often see in well-designed enterprise applications.

## Senior Java Tips

### 1. Think in terms of intent

Instead of remembering interface names, remember their purpose:

| Interface | Question it answers |
| --- | --- |
| `Predicate` | "Should I keep this?" |
| `Function` | "How should I transform this?" |
| `Consumer` | "What should I do with this?" |
| `Supplier` | "How do I create this?" |

### 2. Prefer method references when they improve readability

Instead of `name -> name.toUpperCase()`, use `String::toUpperCase`. But don't force method references if they make the code harder to understand.

### 3. Don't create custom functional interfaces unnecessarily

Before writing your own interface, check whether one from `java.util.function` already fits your use case. Standard interfaces make your code easier for other Java developers to understand.

## Chapter Summary

- ✅ A functional interface has exactly one abstract method
- ✅ A lambda implements a functional interface
- ✅ `Predicate`, `Function`, `Consumer`, `Supplier`, `UnaryOperator`, `BinaryOperator`
- ✅ `and()` / `or()` / `negate()` and `andThen()` / `compose()`
- ✅ Primitive variants (`IntPredicate`, `IntUnaryOperator`, …)
- ✅ Which Stream method takes which interface
