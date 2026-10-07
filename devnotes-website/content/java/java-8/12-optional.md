---
title: Optional
subtitle: Making absence explicit — of vs ofNullable, why get() is dangerous, ifPresent, orElse vs orElseGet, orElseThrow, and map/filter/flatMap on Optional.
order: 12
---

## Introduction

If there is one Java 8 feature that interviewers love after Streams, it's **`Optional`**.

## Why Was Optional Introduced?

Before Java 8:

```java
User user = repository.findById(id);

if (user != null) {
    System.out.println(user.getName());
}
```

The problem: **`NullPointerException`**. Millions of production bugs happen because of `null`. Java 8 introduced `Optional` to make the **absence of a value explicit**.

Think of it as a **box**:

```flow
Optional<User>
? Does the box contain a value? | Yes: User | No: Optional.empty()
```

## Creating an Optional

### Optional.of()

```java
String name = "John";
Optional<String> optional = Optional.of(name);
```

If `name` is `null`, `Optional.of(null)` throws **`NullPointerException`**. Use it only when you're sure the value isn't `null`.

### Optional.ofNullable()

```java
String name = null;

Optional<String> optional = Optional.ofNullable(name);
System.out.println(optional);
```

```output
Optional.empty
```

This is the method you'll use most often.

### Optional.empty()

```java
Optional<String> optional = Optional.empty();
```

An empty Optional.

## Reading the Value

### isPresent()

```java
Optional<String> name = Optional.of("John");

if (name.isPresent()) {
    System.out.println(name.get());
}
```

```output
John
```

### Why get() is Dangerous

```java
Optional<String> name = Optional.empty();

name.get();
```

```output
NoSuchElementException: No value present
```

> [!TIP]
> **Interview tip:** avoid calling `get()` directly. Use the safer alternatives below.

### ifPresent()

Instead of:

```java
if (optional.isPresent()) {
    System.out.println(optional.get());
}
```

use:

```java
optional.ifPresent(System.out::println);
```

Cleaner and safer.

## Default Values

### orElse()

Return a default value.

```java
Optional<String> name = Optional.empty();

String result = name.orElse("Guest");
System.out.println(result);
```

```output
Guest
```

### orElseGet()

Looks similar, but is different:

```java
String result = optional.orElseGet(() -> "Guest");
```

**Why?** Because the supplier is executed **only if needed**.

## orElse() vs orElseGet() — Proof

A classic interview question. Let's prove the difference.

```java
public static String expensiveMethod() {
    System.out.println("Executing...");
    return "Guest";
}
```

**Case 1 — `orElse()`:**

```java
Optional<String> optional = Optional.of("John");

System.out.println(optional.orElse(expensiveMethod()));
```

```output
Executing...
John
```

Wait… why did `expensiveMethod()` execute? Because `orElse()` **evaluates its argument before** it checks whether the Optional contains a value — it's an ordinary method argument.

**Case 2 — `orElseGet()`:**

```java
Optional<String> optional = Optional.of("John");

System.out.println(optional.orElseGet(() -> expensiveMethod()));
```

```output
John
```

No `"Executing..."`. The supplier wasn't called because the value was already present.

### The Rule

| Use orElse() for | Use orElseGet() for |
| --- | --- |
| Constants | Expensive database calls |
| Simple default values, e.g. `.orElse("Guest")` | API calls |
| | Object creation |
| | Complex logic |

## orElseThrow()

Suppose a user **must** exist:

```java
User user = repository.findById(id)
        .orElseThrow();
```

If not found → `NoSuchElementException`.

With a custom exception:

```java
User user = repository.findById(id)
        .orElseThrow(() -> new RuntimeException("User not found"));
```

Very common in Spring Boot services.

> [!NOTE]
> The no-argument `orElseThrow()` was added in **Java 10**. In Java 8 only `orElseThrow(Supplier)` exists.

## Transforming an Optional

### map()

```java
Optional<Employee> employee = repository.findById(1);
```

Need the employee name. Instead of:

```java
if (employee.isPresent()) {
    return employee.get().getName();
}
```

use:

```java
String name = employee
        .map(Employee::getName)
        .orElse("Unknown");
```

Beautiful.

### filter()

```java
Optional<Employee> employee = repository.findById(1);

employee
        .filter(e -> e.getSalary() > 50000)
        .ifPresent(System.out::println);
```

### flatMap()

Suppose `Optional<User>` where `User.getAddress()` returns `Optional<Address>`.

```flow Just like Streams, flatMap() avoids nested containers
Optional<User>
: map(User::getAddress)
Optional<Optional<Address>> {nested}
---
Optional<User>
: flatMap(User::getAddress)
Optional<Address> {flat}
```

```java
Optional<Address> address = user.flatMap(User::getAddress);
```

## Real Spring Boot Example

```java
public UserDTO getUser(Long id) {
    return repository.findById(id)
            .map(UserMapper::toDto)
            .orElseThrow(() -> new UserNotFoundException(id));
}
```

This is production-quality code.

> [!TIP]
> Later Java versions added more helpers: `ifPresentOrElse()`, `or()` and `stream()` (Java 9), `orElseThrow()` (Java 10) and `isEmpty()` (Java 11).

## Interview Questions

### Q1. Difference between Optional.of() and Optional.ofNullable()?

- `of()` never accepts `null` (throws `NullPointerException`).
- `ofNullable()` accepts `null` and returns `Optional.empty()`.

### Q2. Difference between orElse() and orElseGet()?

- `orElse()` **eagerly** evaluates its argument.
- `orElseGet()` **lazily** invokes the supplier only when needed.

### Q3. Why avoid Optional.get()?

Because it throws `NoSuchElementException` when the Optional is empty.

### Q4. Can an Optional be null?

Technically yes, but you should never make an `Optional` variable itself `null`. An empty Optional already represents "no value."

### Q5. Where is Optional used most?

- Repository methods like `findById()`
- Service-layer transformations
- Null-safe chaining
- Stream terminal operations like `findFirst()`, `max()`, `min()`

## Practice Problems

1. Create an Optional from a nullable string.
2. Print the value using `ifPresent()`.
3. Return `"Unknown"` if the value is absent.
4. Use `orElseGet()` with an expensive method.
5. Throw a custom exception with `orElseThrow()`.
6. Convert `Optional<Employee>` to `Optional<String>` using `map()`.
7. Filter employees whose salary is greater than 50,000.
8. Chain `map()` and `filter()` together.
9. Use `flatMap()` with nested Optionals.
10. Rewrite legacy null checks using `Optional`.

## Chapter Summary

- ✅ `Optional.of()`, `ofNullable()`, `empty()`
- ✅ Why `get()` is dangerous; prefer `ifPresent()`
- ✅ `orElse()` (eager) vs `orElseGet()` (lazy)
- ✅ `orElseThrow()` with a custom exception
- ✅ `map()`, `filter()`, `flatMap()` on Optional
- ✅ The Spring Boot `findById().map().orElseThrow()` pattern
