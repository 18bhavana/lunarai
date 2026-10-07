---
title: Records (Java 16+)
subtitle: Compact, immutable data carriers with generated constructors, accessors, equals, hashCode and toString.
order: 10
---

## Introduction

One of the biggest additions to modern Java is the **Record** feature. Records were introduced as a preview in **Java 14** and became a standard feature in **Java 16**.

A Record is a special type of class designed to represent **immutable data with minimal boilerplate code**. Instead of writing:

- Fields
- Constructor
- Getters
- `equals()`
- `hashCode()`
- `toString()`

Java generates them automatically.

Records are widely used for:

- DTOs
- API Request Objects
- API Response Objects
- Configuration Objects
- Event Objects
- Value Objects

## Why Were Records Introduced?

### Before Records

```java
public class Employee {

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
    public boolean equals(Object o) { ... }

    @Override
    public int hashCode() { ... }

    @Override
    public String toString() { ... }
}
```

More than 40 lines of code.

### Using a Record

```java
public record Employee(int id, String name) {}
```

Only one line.

## What is a Record?

A Record is a special immutable class whose primary purpose is to **hold data**.

```java
public record Employee(int id, String name) {}
```

Usage:

```java
Employee employee = new Employee(101, "John");
```

## What Does Java Generate Automatically?

For every Record, Java automatically generates:

- Private final fields
- Canonical constructor
- Accessor methods
- `equals()`
- `hashCode()`
- `toString()`

Internally,

```java
public record Employee(int id, String name) {}
```

behaves roughly like:

```java
public final class Employee {

    private final int id;
    private final String name;

    public Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }

    public int id() {
        return id;
    }

    public String name() {
        return name;
    }

    // equals()
    // hashCode()
    // toString()
}
```

## Creating a Record

```java
public record Student(int id, String name, double marks) {}
```

Creating an object:

```java
Student s = new Student(1, "Rahul", 95.5);
```

## Accessor Methods

Records do **not** generate getters like `getId()`. Instead, they generate `id()`, `name()` and `marks()`.

```java
System.out.println(s.id());
System.out.println(s.name());
```

```output
1
Rahul
```

## Immutability

Records are immutable.

**Wrong:**

```java
employee.id = 200;   // Compilation Error
```

**Wrong:**

```java
employee.setId(200);   // No setter exists
```

State cannot be changed.

## Canonical Constructor

Java generates one automatically, and you can customize it.

```java
public record Employee(int id, String name) {

    public Employee {
        if (id <= 0) {
            throw new IllegalArgumentException("Invalid Id");
        }
    }

}
```

> [!NOTE]
> No assignment is required. Java performs it automatically.

## Compact Constructor

The constructor shown above is called a **Compact Constructor**. Its purpose is **validation**.

```java
public record User(String username) {

    public User {
        Objects.requireNonNull(username);
    }

}
```

Useful for validating record components.

## Normal Constructor

You can also define additional constructors:

```java
public Employee(int id) {
    this(id, "Unknown");
}
```

It delegates to the canonical constructor.

## Custom Methods

Records can contain methods.

```java
public record Rectangle(int length, int width) {

    public int area() {
        return length * width;
    }
}
```

Usage:

```java
Rectangle r = new Rectangle(10, 20);
System.out.println(r.area());
```

```output
200
```

## Static Members

Records support static fields and methods.

```java
public record Employee(int id, String name) {

    static String company = "OpenAI";

}
```

## Records Can Implement Interfaces

```java
interface Printable {
    void print();
}

public record Employee(int id, String name) implements Printable {

    @Override
    public void print() {
        System.out.println(name);
    }

}
```

## Records Cannot Extend Classes

**Wrong:**

```java
public record Employee(int id) extends Person {   // Compilation Error
}
```

**Reason:** Records already extend `java.lang.Record`.

## Nested Records

Records can be nested.

```java
public class Order {

    public record Item(int id, String name) {}

}
```

## Reflection

```java
Employee.class.isRecord();
```

```output
true
```

Useful in frameworks.

## Record Components

```java
record Employee(int id, String name) {}
```

Components: `id`, `name`. Retrieve them with:

```java
Employee.class.getRecordComponents();
```

## Record vs Class

| Feature | Record | Class |
| --- | --- | --- |
| Immutable | Yes | Optional |
| Boilerplate | Very Low | High |
| Setters | No | Yes |
| Inheritance | Cannot extend class | Supported |
| `equals()` / `hashCode()` | Generated | Manual |
| `toString()` | Generated | Manual |

## Record vs Lombok

- **Lombok `@Data`** — generates **mutable** objects.
- **Record** — automatically creates **immutable** objects.

> [!TIP]
> If immutability is required, prefer Records.

## Records in Spring Boot

Typical DTO:

```java
public record LoginRequest(
        String username,
        String password
) {}
```

Controller:

```java
@PostMapping("/login")
public void login(@RequestBody LoginRequest request) {
}
```

Very common in Spring Boot 3.x.

## Records with JSON

Libraries like Jackson support Records.

```json
{
    "id": 101,
    "name": "John"
}
```

This automatically maps to `Employee employee;` without setters.

## Real Project Examples

| Area | Records |
| --- | --- |
| DTO | `EmployeeResponse` |
| REST API | `LoginRequest`, `RegisterRequest`, `PaymentResponse` |
| Kafka | `OrderEvent`, `PaymentEvent`, `UserEvent` |
| Configuration | `DatabaseConfig` |

## Interview Questions

### Q1. What is a Record?

A special immutable class designed for holding data.

### Q2. Which Java version introduced Records?

Preview in Java 14. Standard in **Java 16**.

### Q3. Are Records immutable?

Yes. Their components are `final`.

### Q4. Can Records extend another class?

No. They already extend `java.lang.Record`.

### Q5. Can Records implement interfaces?

Yes.

### Q6. Can Records have constructors?

Yes — canonical, compact, and additional constructors.

### Q7. Can Records contain methods?

Yes. Business methods are allowed.

### Q8. Can Records contain static members?

Yes.

### Q9. Are getters generated?

Yes, but as accessor methods like `id()` and `name()`, not `getId()`.

### Q10. When should we use Records?

When creating immutable data carriers such as DTOs, request/response models, configuration objects, and event classes.

## Common Mistakes

- Trying to add setters.
- Using Records for JPA entities.
- Extending another class.
- Assuming accessor methods are named `getX()`.

## Best Practices

- Use Records for immutable DTOs.
- Keep business logic minimal.
- Validate inputs using compact constructors.
- Use Records with REST APIs and messaging.
- Avoid using Records as mutable domain entities.

## Quick Revision

```flow
Record
Immutable
Auto Constructor
Accessor Methods
equals() · hashCode() · toString()
---
Used for
DTO
REST API
Events
```

## Interview Cheat Sheet

| Requirement | Recommendation |
| --- | --- |
| Immutable DTO | Record |
| JPA Entity | Class |
| Request/Response | Record |
| Event Object | Record |
| Validation | Compact Constructor |
| Additional Behaviour | Custom Methods |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain what Records are and why they were introduced.
- Create immutable data classes using Records.
- Use canonical and compact constructors.
- Understand automatically generated methods.
- Compare Records with traditional classes and Lombok.
- Use Records effectively in Spring Boot applications.
- Confidently answer modern Java interview questions related to Records.
