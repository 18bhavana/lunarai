---
title: Enums
subtitle: Type-safe constants with fields, constructors and behaviour, plus EnumSet, EnumMap and JPA persistence.
order: 9
---

## Introduction

An **Enum (Enumeration)** is a special Java type used to represent a **fixed set of constants**.

Instead of using hardcoded values like:

```java
String status = "ACTIVE";
```

we use:

```java
Status status = Status.ACTIVE;
```

Enums improve:

- Type Safety
- Readability
- Maintainability
- Compile-time checking

Enums were introduced in **Java 5** and are heavily used in enterprise applications.

## What is an Enum?

An Enum defines a predefined list of constants.

```java
enum Day {
    MONDAY,
    TUESDAY,
    WEDNESDAY,
    THURSDAY,
    FRIDAY,
    SATURDAY,
    SUNDAY
}
```

Usage:

```java
Day today = Day.MONDAY;
System.out.println(today);
```

```output
MONDAY
```

## Why Enums?

Instead of:

```java
String paymentType = "CARD";
```

someone may accidentally write:

```java
paymentType = "CRAD";
```

The compiler won't detect the mistake. Using an Enum:

```java
PaymentType type = PaymentType.CARD;
```

Invalid values are rejected **during compilation**.

## Internal Working

Every Enum automatically extends `java.lang.Enum`. Internally,

```java
enum Status {
    ACTIVE,
    INACTIVE
}
```

behaves roughly like:

```java
final class Status extends Enum<Status> {
    public static final Status ACTIVE;
    public static final Status INACTIVE;
}
```

> [!NOTE]
> An Enum cannot extend another class because it already extends `Enum`.

## Creating an Enum

```java
public enum Status {
    ACTIVE,
    INACTIVE,
    BLOCKED
}
```

Usage:

```java
Status status = Status.ACTIVE;
```

## Enum Constants are Singleton Objects

Each enum constant exists **only once**.

```tree
Status
  ACTIVE
  INACTIVE
  BLOCKED
```

Therefore, `Status.ACTIVE == Status.ACTIVE` always returns `true`.

## Enum Methods

Every Enum provides useful methods.

### values()

Returns all constants.

```java
for (Status s : Status.values()) {
    System.out.println(s);
}
```

```output
ACTIVE
INACTIVE
BLOCKED
```

### valueOf()

Converts a String to an Enum.

```java
Status status = Status.valueOf("ACTIVE");
```

```output
ACTIVE
```

Invalid value:

```java
Status.valueOf("TEST");
```

```output
IllegalArgumentException
```

### ordinal()

Returns the position.

```java
System.out.println(Status.ACTIVE.ordinal());
System.out.println(Status.BLOCKED.ordinal());
```

```output
0
2
```

> [!IMPORTANT]
> Do not store ordinal values in databases. Adding new enum constants changes ordinals.

### name()

Returns the constant name.

```java
Status.ACTIVE.name();
```

```output
ACTIVE
```

### toString()

Default implementation:

```java
System.out.println(Status.ACTIVE);
```

```output
ACTIVE
```

Can be overridden.

## Enum with Fields

Enums can contain instance variables.

```java
public enum PaymentStatus {
    SUCCESS(200),
    FAILED(500),
    PENDING(100);

    private final int code;

    PaymentStatus(int code) {
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}
```

Usage:

```java
System.out.println(PaymentStatus.SUCCESS.getCode());
```

```output
200
```

## Enum with Methods

```java
public enum Direction {
    NORTH,
    SOUTH,
    EAST,
    WEST;

    public boolean isNorth() {
        return this == NORTH;
    }
}
```

Usage:

```java
Direction.NORTH.isNorth();
```

```output
true
```

## Enum with Constructors

Enums can have constructors.

```java
enum Size {
    SMALL(30),
    MEDIUM(40),
    LARGE(50);

    private final int value;

    Size(int value) {
        this.value = value;
    }
}
```

**Rules:**

- The constructor is always private.
- You cannot create enum objects using `new`.

**Wrong:**

```java
new Size();   // Compilation Error
```

## Enum with Abstract Methods

Each constant can have different behaviour.

```java
public enum Operation {
    ADD {
        @Override
        public int apply(int a, int b) {
            return a + b;
        }
    },
    SUBTRACT {
        @Override
        public int apply(int a, int b) {
            return a - b;
        }
    };

    public abstract int apply(int a, int b);
}
```

Usage:

```java
Operation.ADD.apply(10, 20);
```

```output
30
```

## Enum in Switch

Enums work naturally with `switch`.

```java
switch (status) {
    case ACTIVE:
        System.out.println("User Active");
        break;
    case BLOCKED:
        System.out.println("User Blocked");
        break;
    default:
        System.out.println("Unknown");
}
```

## EnumSet

A special high-performance `Set` for enums.

```java
EnumSet<Day> weekends = EnumSet.of(
        Day.SATURDAY,
        Day.SUNDAY
);
```

Faster than `HashSet` for enum types.

## EnumMap

A special `Map` optimized for enum keys.

```java
EnumMap<Status, String> map =
        new EnumMap<>(Status.class);
```

**Advantages:**

- Faster than `HashMap`
- Less memory
- Type-safe

## Enums in Spring Boot

Common examples: `OrderStatus`, `PaymentStatus`, `UserRole`, `Gender`, `TicketStatus`, `NotificationType`.

Entity:

```java
@Enumerated(EnumType.STRING)
private Status status;
```

> [!TIP]
> Always prefer `EnumType.STRING` instead of `EnumType.ORDINAL`, because ordinals may change over time.

## Why Use EnumType.STRING?

Suppose the enum is `ACTIVE`, `INACTIVE`, `BLOCKED`, stored in the database as ordinals `0`, `1`, `2`. Later a new constant is inserted:

| Constant | Old ordinal | New ordinal |
| --- | --- | --- |
| `ACTIVE` | 0 | 0 |
| `SUSPENDED` | — | 1 |
| `INACTIVE` | 1 | 2 |
| `BLOCKED` | 2 | 3 |

Ordinals change, so **old data becomes incorrect**. With `STRING`, values like `ACTIVE` and `BLOCKED` remain stable.

## Comparing Enums

Recommended:

```java
if (status == Status.ACTIVE) {
}
```

**Why?** Each enum constant is a singleton. Using `==` is safe and slightly faster than `equals()`.

## Real Project Examples

| Enum | Constants |
| --- | --- |
| User Role | `ADMIN`, `CUSTOMER`, `MANAGER`, `SUPER_ADMIN` |
| Order Status | `PLACED`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| Payment | `SUCCESS`, `FAILED`, `PENDING` |
| Notification Type | `EMAIL`, `SMS`, `PUSH`, `WHATSAPP` |

## Interview Questions

### Q1. What is an Enum?

A special Java type representing a fixed set of constants.

### Q2. Can an Enum extend another class?

No. It already extends `java.lang.Enum`.

### Q3. Can an Enum implement interfaces?

Yes. Enums can implement one or more interfaces.

### Q4. Can an Enum have constructors?

Yes. Constructors are implicitly private.

### Q5. Can we create an Enum object using new?

No. Enum instances are created only by the JVM.

### Q6. Why use == for Enum comparison?

Each enum constant is a singleton, so reference comparison is safe.

### Q7. Should we store ordinal() values in the database?

No. Use `EnumType.STRING`.

### Q8. Can Enums contain methods?

Yes. They can contain fields, methods, constructors, and abstract methods.

### Q9. What are EnumSet and EnumMap?

Specialized, high-performance collections designed specifically for enum types.

### Q10. Why are Enums better than String constants?

- Compile-time safety
- No spelling mistakes
- Better readability
- Better switch support
- Easier maintenance

## Common Mistakes

- Comparing enum names using Strings.
- Persisting `ordinal()` values.
- Creating constants using integer values instead of enums.
- Using `equals()` when `==` is sufficient.

## Best Practices

- Use enums whenever values are fixed.
- Use `==` for enum comparisons.
- Store enums as strings in databases.
- Keep business logic inside enums when appropriate.
- Use `EnumSet` and `EnumMap` for better performance.

## Quick Revision

```flow
Enum
Fixed Constants
Singleton Objects
Fields
Methods
Constructors
Switch
EnumSet
EnumMap
```

## Interview Cheat Sheet

| Requirement | Recommendation |
| --- | --- |
| Fixed values | Enum |
| Database storage | `EnumType.STRING` |
| Comparison | `==` |
| Collection | `EnumSet` |
| Map key | `EnumMap` |
| Convert String | `valueOf()` |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain what an Enum is and why it is used.
- Understand the internal working of enums.
- Use enum fields, constructors, and methods.
- Work with `EnumSet` and `EnumMap`.
- Persist enums correctly using `EnumType.STRING`.
- Confidently answer advanced enum interview questions commonly asked in Java and Spring Boot interviews.
