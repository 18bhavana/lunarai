---
title: Factory Method Pattern
subtitle: Creating objects without exposing creation logic — the notification-factory example, Product / Creator roles, simple factory vs Factory Method vs Abstract Factory, and factories in Spring.
order: 2
---

## Introduction

**Purpose:** create objects **without exposing object-creation logic** to the client.

The **Factory Method** pattern defines a method for creating an object, and lets **subclasses decide which concrete class** to instantiate. Client code works with the abstract product and never calls `new` on a concrete class.

## Example: Notification Factory

### The Product and Concrete Products

```java
interface Notification {
    void send();
}

class EmailNotification implements Notification {
    @Override
    public void send() {
        System.out.println("Sending Email Notification");
    }
}

class SMSNotification implements Notification {
    @Override
    public void send() {
        System.out.println("Sending SMS Notification");
    }
}
```

### The Creator and Concrete Creators

```java
abstract class NotificationCreator {

    public abstract Notification createNotification();   // the factory method

    public void notifyUser() {
        Notification notification = createNotification();
        notification.send();
    }
}

class EmailNotificationCreator extends NotificationCreator {
    @Override
    public Notification createNotification() {
        return new EmailNotification();
    }
}

class SMSNotificationCreator extends NotificationCreator {
    @Override
    public Notification createNotification() {
        return new SMSNotification();
    }
}
```

### The Client

```java
public class Main {
    public static void main(String[] args) {
        NotificationCreator creator = new EmailNotificationCreator();
        creator.notifyUser();

        creator = new SMSNotificationCreator();
        creator.notifyUser();
    }
}
```

```output
Sending Email Notification
Sending SMS Notification
```

`notifyUser()` contains the shared workflow; it doesn't know or care which notification it sends. Adding push notifications means adding `PushNotification` and `PushNotificationCreator` — **no existing class changes** (Open/Closed Principle).

## Structure

```refs
EmailNotificationCreator, SMSNotificationCreator -> NotificationCreator | Creator — declares createNotification()
EmailNotification, SMSNotification -> Notification | Product — the interface clients use
```

| Role | In the example | Responsibility |
| --- | --- | --- |
| **Product** | `Notification` | Interface of the objects created |
| **Concrete product** | `EmailNotification`, `SMSNotification` | The actual implementations |
| **Creator** | `NotificationCreator` | Declares the factory method and uses the product |
| **Concrete creator** | `EmailNotificationCreator`, `SMSNotificationCreator` | Overrides the factory method to return a specific product |

> [!IMPORTANT]
> **Key point:** the **subclass decides** which object is created.

## Simple Factory vs Factory Method vs Abstract Factory

These are often confused in interviews.

### Simple Factory (Not a GoF Pattern)

One class with a method that picks the product, usually with a `switch`:

```java
class NotificationFactory {
    static Notification create(String type) {
        return switch (type) {
            case "EMAIL" -> new EmailNotification();
            case "SMS"   -> new SMSNotification();
            default      -> throw new IllegalArgumentException("Unknown type: " + type);
        };
    }
}

Notification n = NotificationFactory.create("EMAIL");
```

Simple and very common, but adding a type means **editing** the factory.

### Abstract Factory

Creates **families of related objects** that must be used together:

```java
interface UiFactory {
    Button createButton();
    Checkbox createCheckbox();
}

class DarkThemeFactory implements UiFactory { ... }   // dark button + dark checkbox
class LightThemeFactory implements UiFactory { ... }  // light button + light checkbox
```

| | Simple factory | Factory Method | Abstract Factory |
| --- | --- | --- | --- |
| Mechanism | One method with conditional logic | Subclasses override a creation method | An object with several creation methods |
| Creates | One product | One product | A family of related products |
| Adding a product type | Modify the factory | Add a new creator subclass | Add a new factory implementation |
| GoF pattern? | No | Yes | Yes |

## Factories in the JDK and Spring

| Example | Kind |
| --- | --- |
| `Calendar.getInstance()`, `NumberFormat.getInstance()` | Static factory methods |
| `List.of()`, `Optional.of()`, `Integer.valueOf()` | Static factory methods (can cache or choose implementations) |
| `Executors.newFixedThreadPool()` | Factory for `ExecutorService` implementations |
| Spring `BeanFactory` / `ApplicationContext` | The container is a factory of beans |
| Spring `FactoryBean<T>` | A bean whose job is to create another object |
| `@Bean` methods | Factory methods managed by Spring |

In Spring you often get factory behaviour for free by injecting all implementations:

```java
@Service
public class NotificationService {

    private final Map<String, Notification> notifications;   // bean name → implementation

    public NotificationService(Map<String, Notification> notifications) {
        this.notifications = notifications;
    }

    public void send(String channel) {
        Notification n = notifications.get(channel);
        if (n == null) throw new IllegalArgumentException("Unsupported channel " + channel);
        n.send();
    }
}
```

## When to Use

- The exact type to create is decided at runtime or by configuration.
- You want to hide construction details (caching, pooling, choosing an implementation).
- You want client code to depend only on an interface.
- You expect new product types to be added over time.

## Interview Questions

### Q1. What is the Factory Method pattern?

A creational pattern that defines an interface or method for creating an object while letting subclasses decide which concrete product to create.

### Q2. What problem does it solve?

It decouples client code from concrete classes — the client uses the product interface and the creation decision lives in one place, so new products can be added without changing the client.

### Q3. What is the difference between Factory Method and Abstract Factory?

Factory Method creates one product via a method overridden in subclasses; Abstract Factory is an object with several factory methods that create a family of related products.

### Q4. Is a static method with a switch a Factory Method?

That's a *simple factory* (or static factory method) — useful, but not the GoF Factory Method, which relies on subclasses overriding the creation method.

### Q5. Where is the factory pattern used in Spring?

`BeanFactory` and `ApplicationContext` create beans; `FactoryBean` and `@Bean` methods are factories; injecting `Map<String, Interface>` lets you look implementations up by name.

## Common Mistakes

- ❌ **A growing `switch` in a "factory"** that every new feature has to edit.
- ❌ **Returning concrete types** from the factory, so clients still depend on implementations.
- ❌ **Factories for objects that never vary** — `new` is fine when there's only one implementation.

## Key Takeaways

- ✅ Factory Method hides object creation behind a method that subclasses override.
- ✅ Clients depend on the product interface, not on concrete classes.
- ✅ New products are added by new subclasses — no changes to existing code.
- ✅ Simple factory, Factory Method and Abstract Factory solve related but different problems.
- ✅ Spring's container and `@Bean` methods are factories you use every day.
