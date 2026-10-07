---
title: Immutable Objects
subtitle: What immutability means, why Java relies on it, and the rules for building truly immutable classes.
order: 7
---

## Introduction

One of the most frequently asked Java interview questions is: **What is an Immutable Object?**

Understanding immutability is crucial because many core Java classes are immutable, including:

- `String`
- Most classes in the `java.time` package
- `BigInteger`
- `BigDecimal`
- Wrapper classes (`Integer`, `Long`, etc.)

Immutable objects are widely used in enterprise applications because they are:

- Thread-safe
- Secure
- Easy to cache
- Reliable as `HashMap` keys

## What is an Immutable Object?

An immutable object is an object whose **state cannot be changed after it is created**. Once constructed, its data remains constant throughout its lifetime.

```java
String name = "Java";
name.concat(" 21");
System.out.println(name);
```

```output
Java
```

The original object is unchanged.

## Mutable vs Immutable

### Mutable Object

```java
StringBuilder sb = new StringBuilder("Java");
sb.append("21");
```

```output
Java21
```

The same object is modified.

### Immutable Object

```java
String s = "Java";
s.concat("21");
```

```output
Java
```

A new object is created instead of modifying the existing one.

## Memory Representation

```java
String s = "Java";
s = s.concat("17");
```

```flow-h The original object never changes
Before | s → "Java"
After concat | s → "Java17"
Old object | "Java" | eligible for GC
```

## Why Does Java Use Immutable Objects?

Imagine multiple threads sharing the same object. If one thread changes it, all other threads observe the modified data. This may lead to inconsistent results.

With immutable objects, no thread can modify the shared state. Therefore, **immutable objects are inherently thread-safe**.

## Advantages of Immutable Objects

### 1. Thread Safety

No synchronization required. Multiple threads can safely share the same object.

### 2. Security

Sensitive information cannot be modified accidentally.

```java
String username = "admin";
```

No code can change the contents of this `String` object.

### 3. Safe HashMap Keys

Hash-based collections rely on stable hash codes.

```java
Map<String, String> map = new HashMap<>();
```

Since `String` never changes, its hash code never changes. Therefore, lookups remain consistent.

### 4. Easy Caching

Immutable objects can be cached safely because their values never change. Example: the String Pool — `"Java"` is shared by multiple references.

### 5. Easy Debugging

No unexpected state changes. Objects behave predictably.

## How to Create an Immutable Class?

There are several rules.

### Rule 1 — Declare the class as final

```java
public final class Employee {
}
```

**Why?** To prevent inheritance. Otherwise, a subclass could make the object mutable.

### Rule 2 — Declare all fields as private

```java
private int id;
private String name;
```

Encapsulation protects internal state.

### Rule 3 — Declare fields as final

```java
private final int id;
private final String name;
```

Values can only be assigned once.

### Rule 4 — Initialize fields through the constructor

```java
public Employee(int id, String name) {
    this.id = id;
    this.name = name;
}
```

### Rule 5 — Do not provide setter methods

**Wrong:**

```java
public void setName(String name) {
    this.name = name;
}
```

Never expose setters in immutable classes.

### Rule 6 — Provide only getters

```java
public int getId() {
    return id;
}
```

Read-only access.

## Complete Immutable Class

```java
public final class Employee {

    private final int id;
    private final String name;

    public Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return id + " " + name;
    }
}
```

Once created, this object can never change.

## Immutable Class with Mutable Fields

```java
class Employee {
    private final Date joiningDate;
}
```

**Problem:** `Date` is mutable. Even without setters, someone can modify the date.

**Wrong:**

```java
Date d = employee.getJoiningDate();
d.setTime(0);
```

`Employee` is no longer immutable.

## Defensive Copying

Correct approach — **constructor**:

```java
this.joiningDate = new Date(joiningDate.getTime());
```

**Getter:**

```java
return new Date(joiningDate.getTime());
```

Every access returns a copy. The original object remains protected.

## Immutable Collections

**Wrong:**

```java
private final List<String> skills;

// getter
return skills;
```

The caller can modify the list. **Correct:**

```java
return List.copyOf(skills);
// or
return Collections.unmodifiableList(skills);
```

This prevents external modification.

## Immutable Objects in Java

These classes are immutable:

| Category | Classes |
| --- | --- |
| Text | `String` |
| Wrappers | `Integer`, `Long`, `Double`, `Character` |
| Big numbers | `BigInteger`, `BigDecimal` |
| Date & time | `LocalDate`, `LocalTime`, `LocalDateTime` |
| Identifiers | `UUID` |

## Records and Immutability

Java Records naturally support immutable data.

```java
public record Employee(int id, String name) {
}
```

Automatically provides:

- `final` fields
- Constructor
- Getters (accessor methods)
- `equals()`
- `hashCode()`
- `toString()`

Records are ideal for DTOs and immutable data carriers.

## Builder Pattern

For objects with many fields, creating immutable objects using constructors becomes difficult.

```java
Employee employee = new Employee.Builder()
        .id(101)
        .name("John")
        .department("IT")
        .salary(50000)
        .build();
```

The Builder creates the object, which remains immutable after construction.

## Real Project Examples

### Configuration Objects

Database configuration, application configuration, security configuration. Configuration rarely changes — immutable objects are ideal.

### DTOs

Request DTO, Response DTO, Event DTO — often implemented as immutable objects or records.

### Cache Objects

Objects stored in caches should not change unexpectedly.

## Interview Questions

### Q1. What is an immutable object?

An object whose state cannot be changed after construction.

### Q2. Why is String immutable?

For security, thread safety, caching, and efficient use of the String Constant Pool.

### Q3. Can immutable objects have constructors?

Yes. Constructors initialize state exactly once.

### Q4. Can immutable classes have mutable fields?

Yes, but **defensive copying** is required to preserve immutability.

### Q5. Why should immutable classes be final?

To prevent subclasses from introducing mutable behaviour.

### Q6. Why avoid setters?

Setters allow modification after construction, breaking immutability.

### Q7. Can immutable objects be shared between threads?

Yes. They are inherently thread-safe.

### Q8. Which Java feature helps create immutable data classes?

Records.

### Q9. Can immutable objects improve performance?

Yes. They simplify caching, reduce synchronization overhead, and are safe to share across threads.

### Q10. When should we create immutable classes?

Whenever object state should never change after creation, especially for DTOs, configuration objects, value objects, cache keys, and identifiers.

## Common Mistakes

- Returning mutable collections directly.
- Returning mutable `Date` objects.
- Providing setters.
- Forgetting to declare fields as `final`.
- Allowing inheritance for immutable classes.

## Best Practices

- Make immutable classes `final`.
- Declare all fields `private final`.
- Initialize all fields through constructors.
- Never expose setters.
- Use defensive copies for mutable fields.
- Prefer Records for simple immutable data models.

## Quick Revision

```flow
Immutable Object
final class
private final fields
Constructor Initialization
No Setters
Only Getters
Defensive Copy
Thread Safe
```

## Interview Cheat Sheet

| Requirement | Best Practice |
| --- | --- |
| Prevent inheritance | `final` class |
| Prevent field updates | `private final` |
| Object initialization | Constructor |
| Prevent modification | No setters |
| Mutable field | Defensive copy |
| Simple immutable DTO | Record |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain immutability and its advantages.
- Create fully immutable Java classes.
- Protect mutable fields using defensive copying.
- Understand why immutable objects are thread-safe.
- Know when to use immutable classes, records, and the Builder pattern.
- Confidently answer interview questions related to immutable objects in Java.
