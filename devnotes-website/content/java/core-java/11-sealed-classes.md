---
title: Sealed Classes (Java 17+)
subtitle: Controlled inheritance with permits, final, sealed and non-sealed, and how it pairs with pattern matching.
order: 11
---

## Introduction

Sealed Classes are one of the most important features introduced in modern Java. They were introduced as a preview in **Java 15** and became a standard feature in **Java 17 (LTS)**.

A Sealed Class allows you to **control which classes are allowed to extend or implement it**.

Before Sealed Classes, any class could freely extend another class:

```java
class Animal {
}
class Dog extends Animal {
}
class Cat extends Animal {
}
class Lion extends Animal {
}
class Tiger extends Animal {
}
```

There is no restriction. Sometimes this is undesirable. Java introduced Sealed Classes to solve this problem.

## What is a Sealed Class?

A Sealed Class **restricts inheritance**. Only the explicitly permitted classes can extend it.

```java
public sealed class Vehicle
        permits Car, Bike, Truck {

}
```

Only `Car`, `Bike` and `Truck` can extend `Vehicle`. Any other class trying to extend it results in a **compilation error**.

## Why Do We Need Sealed Classes?

Imagine a banking application:

```tree These are the only valid account types
Account
  SavingsAccount
  CurrentAccount
  LoanAccount
```

You don't want developers creating `CryptoAccount`, `FakeAccount` or `UnknownAccount`. Sealed classes prevent unauthorized inheritance.

## Syntax

```java
public sealed class Animal
        permits Dog, Cat {

}
```

Permitted subclasses:

```java
final class Dog extends Animal {
}
final class Cat extends Animal {
}
```

## Rules of Sealed Classes

Every permitted subclass **must** declare one of these modifiers:

- `final`
- `sealed`
- `non-sealed`

This is mandatory.

### 1. final

Inheritance stops completely.

```java
public sealed class Animal
        permits Dog {

}

public final class Dog
        extends Animal {
}
```

Now:

```java
class Puppy extends Dog {   // Compilation Error
}
```

### 2. sealed

Inheritance continues, but remains **controlled**.

```java
public sealed class Animal
        permits Dog {

}

public sealed class Dog
        extends Animal
        permits Labrador, Pug {

}
```

Only `Labrador` and `Pug` may extend `Dog`.

### 3. non-sealed

Inheritance becomes **unrestricted again**.

```java
public sealed class Animal
        permits Dog {

}

public non-sealed class Dog
        extends Animal {
}
```

Now both of these are allowed:

```java
class Labrador extends Dog {
}
class GermanShepherd extends Dog {
}
```

## Complete Hierarchy

```tree
Animal {sealed}
  Dog {sealed}
    Labrador
    Pug
  Cat {final}
```

## Sealed Interfaces

Interfaces can also be sealed.

```java
public sealed interface Payment
        permits CardPayment,
                UpiPayment,
                WalletPayment {

}
```

Implementation:

```java
public final class CardPayment
        implements Payment {

}
```

## Reflection Support

Check whether a class is sealed:

```java
System.out.println(
        Vehicle.class.isSealed()
);
```

```output
true
```

Get permitted subclasses:

```java
Vehicle.class.getPermittedSubclasses();
```

Useful for frameworks and code analysis tools.

## Sealed Classes with Switch

Sealed classes work well with pattern matching.

```java
public sealed interface Shape
        permits Circle, Rectangle {

}

public final class Circle
        implements Shape {

}

public final class Rectangle
        implements Shape {

}
```

Because all possible subclasses are known, the compiler can verify **switch exhaustiveness**.

> [!NOTE]
> Pattern matching for `switch` became standard in **Java 21**, so a `switch` over a sealed `Shape` that covers `Circle` and `Rectangle` needs no `default` branch.

## Sealed Class vs final Class

| Sealed | final |
| --- | --- |
| Allows limited inheritance | No inheritance |
| Controlled hierarchy | Completely closed |
| Flexible | Completely restricted |

## Sealed Class vs Abstract Class

| Abstract Class | Sealed Class |
| --- | --- |
| Controls object creation | Controls inheritance |
| Can be extended by any subclass | Only permitted subclasses |
| May be instantiated through subclasses | Same, but inheritance is restricted |

A class can be **both abstract and sealed**:

```java
public abstract sealed class Vehicle
        permits Car, Bike {

}
```

## Sealed Class vs Enum

| Enum | Sealed Class |
| --- | --- |
| Fixed constants | Fixed subclasses |
| Represents values | Represents types |
| Singleton instances | Multiple object instances |

**Enum:**

```java
enum Status {
    ACTIVE,
    INACTIVE
}
```

**Sealed:**

```java
sealed class Shape
        permits Circle, Rectangle {

}
```

## Real Project Examples

```tree Payment System: no unknown payment implementations
Payment
  CardPayment
  UPIPayment
  WalletPayment
```

```tree Notification System
Notification
  SMS
  EMAIL
  PUSH
```

```tree Vehicle Management
Vehicle
  Car
  Bike
  Truck
```

```tree Banking
Account
  Savings
  Current
  Loan
```

### Compiler AST

Compilers often use sealed hierarchies because the set of node types is fixed.

## Advantages

- Controlled inheritance
- Better API design
- Improved readability
- Safer object hierarchies
- Better support for pattern matching
- Easier maintenance

## Limitations

- Permitted subclasses must follow module/package rules (same module, or same package in the unnamed module).
- More restrictive than normal inheritance.
- Not suitable when third-party extensions are expected.

## Interview Questions

### Q1. What is a Sealed Class?

A class that restricts which classes can inherit from it.

### Q2. Which Java version standardized Sealed Classes?

**Java 17.**

### Q3. Which keyword specifies allowed subclasses?

`permits`

### Q4. Which modifiers are allowed on permitted subclasses?

- `final`
- `sealed`
- `non-sealed`

### Q5. Can a Sealed Class be instantiated?

Yes, unless it is also declared `abstract`.

### Q6. Can interfaces be sealed?

Yes. Both classes and interfaces can be sealed.

### Q7. Can a permitted subclass omit final, sealed, or non-sealed?

No. One of them is mandatory.

### Q8. Can a Sealed Class extend another class?

Yes. It follows normal inheritance rules while controlling its own subclasses.

### Q9. Can a Sealed Class be abstract?

Yes. This is a common design.

### Q10. When should we use Sealed Classes?

When the number of valid subclasses is fixed and controlled, such as payment types, account types, workflow states, or domain models.

## Common Mistakes

- Forgetting the `permits` clause.
- Forgetting to declare permitted subclasses as `final`, `sealed`, or `non-sealed`.
- Using sealed classes when unrestricted extension is required.
- Confusing Sealed Classes with Enums.

## Best Practices

- Use Sealed Classes for controlled domain hierarchies.
- Use `final` when inheritance should stop.
- Use `sealed` for another controlled level.
- Use `non-sealed` only when open inheritance is intentionally required.
- Combine Sealed Classes with pattern matching and modern switch expressions where appropriate.

## Quick Revision

```flow
Sealed Class
permits
Allowed Subclasses
final · sealed · non-sealed
Controlled Inheritance
Better API Design
```

## Interview Cheat Sheet

| Requirement | Recommendation |
| --- | --- |
| No inheritance | `final` |
| Limited inheritance | `sealed` |
| Reopen inheritance | `non-sealed` |
| Restrict implementations | Sealed Interface |
| Fixed domain hierarchy | Sealed Class |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain what Sealed Classes are and why they were introduced.
- Create Sealed Classes and Sealed Interfaces.
- Use `permits`, `final`, `sealed`, and `non-sealed` correctly.
- Compare Sealed Classes with Abstract Classes, Enums, and Final Classes.
- Design controlled inheritance hierarchies for enterprise applications.
- Confidently answer Java 17 Sealed Class interview questions.
