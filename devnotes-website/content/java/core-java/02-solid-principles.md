---
title: SOLID Principles
subtitle: Five object-oriented design principles for clean, maintainable, loosely coupled code.
order: 2
---

## Introduction

The SOLID Principles are five object-oriented design principles introduced by **Robert C. Martin (Uncle Bob)** to make software:

- Easier to understand
- Easier to maintain
- Easier to extend
- Easier to test
- Less coupled

Almost every Java/Spring Boot interview for 5+ years experience includes questions on SOLID because these principles are heavily used in enterprise applications.

## What is SOLID?

SOLID is an acronym:

| Letter | Principle |
| --- | --- |
| **S** | Single Responsibility Principle |
| **O** | Open Closed Principle |
| **L** | Liskov Substitution Principle |
| **I** | Interface Segregation Principle |
| **D** | Dependency Inversion Principle |

Think of SOLID as a set of rules for writing clean, maintainable code.

## Why SOLID?

Imagine a single class containing:

- Database code
- Email code
- PDF generation
- Business logic
- Logging
- File handling

If one requirement changes, the entire class must be modified.

**Problems:**

- Difficult to test
- Difficult to debug
- Difficult to maintain
- High coupling
- Low readability

SOLID solves these problems.

## S — Single Responsibility Principle (SRP)

### Definition

> A class should have only **one reason to change**.

In simple words: **a class should do only one job.**

### Bad Example

```java
class EmployeeService {
    saveEmployee() {}
    generateSalary() {}
    sendEmail() {}
    exportPdf() {}
}
```

Responsibilities: save employee, salary calculation, email, PDF generation. Too many responsibilities — **violation of SRP**.

### Good Design

```tree Each class has one responsibility
Employee module
  EmployeeService | saveEmployee()
  SalaryService | calculateSalary()
  EmailService | sendEmail()
  PdfService | exportPdf()
```

### Real-life example: Hospital

| Person | Responsibility |
| --- | --- |
| Doctor | Treats patients |
| Receptionist | Registers patients |
| Cashier | Collects payment |

Each person has one responsibility.

### Advantages

- Easy Maintenance
- Easy Testing
- Low Coupling
- Better Readability

> [!QUESTION] Can a class have multiple methods and still follow SRP?
> **Yes.** The principle is about **one responsibility, not one method**. A service may have many methods related to the same responsibility.

## O — Open Closed Principle (OCP)

### Definition

Software entities should be **open for extension** but **closed for modification**.

Meaning: when a new feature is added, **do not modify existing code**. Instead, **extend it**.

### Bad Example

```java
class PaymentService {
    public void pay(String type) {
        if (type.equals("CARD")) {
        }
        else if (type.equals("UPI")) {
        }
        else if (type.equals("NETBANKING")) {
        }
    }
}
```

Whenever a new payment type comes, this class must be modified. **Violation.**

### Good Example

```java
interface Payment {
    void pay();
}

class CardPayment implements Payment {
}

class UpiPayment implements Payment {
}

class WalletPayment implements Payment {
}
```

Now adding a new payment method only requires creating a new implementation. No existing code changes.

### Real Project Example (Spring Boot)

```tree Need Telegram? Just add TelegramNotification — existing code stays untouched
NotificationService
  EmailNotification
  SmsNotification
  PushNotification
  WhatsappNotification
  TelegramNotification {new}
```

### Advantages

- Safer deployments
- Easier extension
- Fewer regression bugs

## L — Liskov Substitution Principle (LSP)

### Definition

A child class should be replaceable by its parent without changing program behaviour.

### Correct Example

```flow
Animal
Dog
```

```java
Animal a = new Dog();
a.sound();
```

Works perfectly.

### Wrong Example

```java
class Bird {
    fly() {}
}

class Penguin extends Bird {
    fly() {
        throw new UnsupportedOperationException();
    }
}
```

**Problem:** penguins cannot fly. Bad inheritance — **violation of LSP**.

### Better Design

```tree Now behaviour is correct
Bird
  FlyingBird
    Sparrow
  NonFlyingBird
    Penguin
```

### Real-life example

`Vehicle` → `Car`, `Bike`, `Truck`. All support driving. If a child suddenly cannot perform the expected behaviour, the inheritance is incorrect.

> [!QUESTION] Which famous examples violate LSP?
> **Bird → Penguin** and **Rectangle → Square**. Both are common interview examples.

## I — Interface Segregation Principle (ISP)

### Definition

Clients should not be forced to depend on methods they do not use.

### Bad Example

```java
interface Worker {
    work();
    eat();
}

class Robot implements Worker {
    work() {}
    eat() {
        // meaningless
    }
}
```

A robot doesn't eat. **Violation.**

### Good Design

```java
interface Workable {
    work();
}

interface Eatable {
    eat();
}
```

```refs
Human -> implements Workable, Eatable
Robot -> implements Workable
```

Perfect.

### Advantages

- Smaller interfaces
- Cleaner design
- Better flexibility

### Real Project Example

Instead of one `UserOperations` interface having `login()`, `logout()`, `payment()`, `refund()`, `downloadInvoice()` and `cancelTicket()`, split it into:

```tree
UserOperations (split)
  AuthenticationService
  PaymentService
  InvoiceService
  BookingService
```

## D — Dependency Inversion Principle (DIP)

This is probably the **most important SOLID principle for Spring developers**.

### Definition

High-level modules should not depend upon low-level modules. **Both should depend upon abstractions.**

### Bad Example

```java
class Car {
    Engine engine = new Engine();
}
```

`Car` depends directly on `Engine`. If the engine changes, `Car` changes. **Tightly coupled.**

### Good Example

```java
interface Engine {
    start();
}

class PetrolEngine implements Engine {
}

class DieselEngine implements Engine {
}

class ElectricEngine implements Engine {
}

class Car {
    Engine engine;
}
```

Now `Car` depends on an abstraction.

```tree Car depends on the Engine abstraction, not a concrete engine
Car
  Engine (interface)
    PetrolEngine
    DieselEngine
    ElectricEngine
```

### Spring Boot Example

```java
@Service
class UserService {

    @Autowired
    UserRepository repository;
}
```

`UserService` depends on `UserRepository`, which is an abstraction. Spring injects the implementation. **This is Dependency Inversion.**

### Why Does Dependency Injection Exist?

Dependency Injection is a **technique** used to implement Dependency Inversion.

- **Dependency Inversion** is a design principle.
- **Dependency Injection** is its implementation.

### Advantages

- Loose Coupling
- Easy Unit Testing
- Easy Mocking
- Replace implementations easily

## Complete SOLID Diagram

```tree
SOLID
  SRP | One Responsibility
  OCP | Extend, Don't Modify
  LSP | Child behaves like Parent
  ISP | Small Interfaces
  DIP | Depend on Interfaces
```

## SOLID in Spring Boot

```flow Every layer follows SOLID principles
Controller
Service Interface
Service Implementation
Repository Interface
Repository Implementation | Generated by Spring
Database
```

## Common Interview Questions

### What is SOLID?

Five object-oriented design principles used to build maintainable, scalable and loosely coupled applications.

### Which principle is most used in Spring?

**Dependency Inversion Principle**, implemented through Dependency Injection.

### Which principle reduces code modification?

**Open Closed Principle.**

### Which principle improves maintainability?

**Single Responsibility Principle.**

### Which principle reduces large interfaces?

**Interface Segregation Principle.**

### Which principle ensures correct inheritance?

**Liskov Substitution Principle.**

### Difference between Dependency Injection and Dependency Inversion?

- **Dependency Inversion** → Design principle.
- **Dependency Injection** → Technique used to achieve it.

### Difference between SRP and OCP?

- **SRP** → One responsibility.
- **OCP** → Easy extension without modifying existing code.

### Which SOLID principle is violated by large service classes?

**Single Responsibility Principle.**

### How does Spring Boot support SOLID?

- Dependency Injection
- Interface-based programming
- Repository pattern
- Strategy pattern
- Bean abstraction
- Inversion of Control (IoC)

## Common Mistakes

- Creating one "Utility" class with hundreds of methods.
- Using inheritance where composition is more appropriate.
- Depending directly on concrete classes.
- Large interfaces with unrelated methods.
- Editing existing classes for every new feature instead of extending behaviour.

## Best Practices

- Keep each class focused on one responsibility.
- Prefer interfaces over concrete implementations.
- Use composition instead of inheritance when appropriate.
- Keep interfaces small and cohesive.
- Inject dependencies rather than creating them with `new`.
- Follow SOLID consistently across Controller, Service, Repository, and Utility layers.

## Quick Revision

```flow
S | One Class, One Job
---
O | Extend, Don't Modify
---
L | Child behaves like Parent
---
I | Small Interfaces
---
D | Depend on Interfaces, Not Concrete Classes
```

## Chapter Summary

After completing this chapter, you should be able to:

- Explain all five SOLID principles confidently.
- Identify SOLID violations in existing code.
- Refactor code to follow clean design principles.
- Understand how Spring Boot naturally encourages SOLID through IoC, Dependency Injection, interfaces, and layered architecture.
- Answer both theoretical and scenario-based interview questions on SOLID for Java developers with 5+ years of experience.
