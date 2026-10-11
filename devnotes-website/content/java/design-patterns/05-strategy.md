---
title: Strategy Pattern
subtitle: Interchangeable algorithms chosen at runtime — the payment-strategy example, Context and Strategy roles, replacing if-else chains, lambdas as strategies, and selecting strategies with Spring injection.
order: 5
---

## Introduction

**Purpose:** define a **family of algorithms**, encapsulate each one, and **choose one at runtime**.

Instead of one class full of `if`/`switch` branches for every variant of a behaviour, each variant becomes its own class behind a common interface, and the context simply delegates to whichever strategy it's given.

## Example: Payment

### The Strategy Interface and Concrete Strategies

```java
interface PaymentStrategy {
    void pay(double amount);
}

class CreditCardPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        System.out.println("Paid " + amount + " using Credit Card");
    }
}

class UpiPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        System.out.println("Paid " + amount + " using UPI");
    }
}
```

### The Context

```java
class PaymentService {
    private PaymentStrategy strategy;

    public PaymentService(PaymentStrategy strategy) {
        this.strategy = strategy;
    }

    public void setStrategy(PaymentStrategy strategy) {
        this.strategy = strategy;
    }

    public void checkout(double amount) {
        strategy.pay(amount);
    }
}
```

### The Client

```java
public class Main {
    public static void main(String[] args) {
        PaymentService paymentService = new PaymentService(new UpiPayment());
        paymentService.checkout(1000);

        paymentService.setStrategy(new CreditCardPayment());
        paymentService.checkout(2000);
    }
}
```

```output
Paid 1000.0 using UPI
Paid 2000.0 using Credit Card
```

> [!NOTE]
> The amount is a `double`, so `1000` is printed as `1000.0`. (For real money use `BigDecimal`, never `double` — see *Wrapper Classes* and the SQL `DECIMAL` notes.)

## Structure

```tree
PaymentService | Context — holds a strategy and delegates to it
  PaymentStrategy | Strategy interface
    UpiPayment | Concrete strategy A
    CreditCardPayment | Concrete strategy B
```

| Role | In the example | Responsibility |
| --- | --- | --- |
| **Strategy** | `PaymentStrategy` | Common interface for all algorithms |
| **Concrete strategy** | `UpiPayment`, `CreditCardPayment` | One algorithm each |
| **Context** | `PaymentService` | Holds a strategy and delegates to it; doesn't know which one it has |

> [!IMPORTANT]
> **Key point:** choose or replace the algorithm **at runtime** without changing the context.

## Replacing an if-else Chain

```java
// ❌ Every new payment method edits this method
public void checkout(String method, double amount) {
    if (method.equals("UPI")) {
        // UPI logic
    } else if (method.equals("CARD")) {
        // card logic
    } else if (method.equals("WALLET")) {
        // wallet logic
    }
}
```

With Strategy, adding a wallet means adding one `WalletPayment` class — `PaymentService` doesn't change (**Open/Closed Principle**), and each algorithm can be unit-tested on its own.

## Lambdas as Strategies

Because `PaymentStrategy` has a single abstract method, it's a functional interface — small strategies can be lambdas:

```java
PaymentService service = new PaymentService(amount -> System.out.println("Paid " + amount + " by wallet"));
```

The JDK is full of this: a `Comparator` passed to `list.sort()` is a strategy for ordering, and `Predicate`/`Function` arguments to streams are strategies too.

```java
employees.sort(Comparator.comparing(Employee::salary).reversed());   // sorting strategy
```

## Strategy in Spring

Spring makes selecting a strategy at runtime easy: inject **all** implementations and pick one.

```java
public interface PaymentStrategy {
    String method();                 // "UPI", "CARD", ...
    void pay(BigDecimal amount);
}

@Component class UpiPayment implements PaymentStrategy { ... }
@Component class CardPayment implements PaymentStrategy { ... }

@Service
public class PaymentService {

    private final Map<String, PaymentStrategy> strategies;

    public PaymentService(List<PaymentStrategy> all) {
        this.strategies = all.stream()
                .collect(Collectors.toMap(PaymentStrategy::method, Function.identity()));
    }

    public void checkout(String method, BigDecimal amount) {
        PaymentStrategy strategy = strategies.get(method);
        if (strategy == null) throw new IllegalArgumentException("Unsupported payment method: " + method);
        strategy.pay(amount);
    }
}
```

A new payment method is now just a new `@Component` — nothing else changes. Spring itself uses strategies widely: `PasswordEncoder`, `ResourceLoader`, `TaskExecutor`, and different `AuthenticationProvider`s.

## Strategy vs Similar Patterns

| Pattern | Difference |
| --- | --- |
| **State** | Same structure, but the object switches its own behaviour as its internal state changes; with Strategy the **client** chooses |
| **Template Method** | Varies steps through **inheritance** (subclasses override hooks); Strategy varies the whole algorithm through **composition** |
| **Factory** | Decides which object to **create**; often used together with Strategy to pick the strategy |

## When to Use

- Several variants of an algorithm or business rule (pricing, discounts, tax, payment, shipping cost, sorting).
- The variant must be chosen at runtime or configured.
- A method keeps growing `if`/`switch` branches on a "type".

## Interview Questions

### Q1. What is the Strategy pattern?

A behavioral pattern that encapsulates interchangeable algorithms behind a common interface and lets the behaviour be selected at runtime.

### Q2. What problem does it solve?

It replaces conditional logic that selects behaviour by type, so new behaviours can be added without modifying existing code, and each algorithm is isolated and testable.

### Q3. What's the difference between Strategy and State?

They're structurally similar. In Strategy the client chooses the algorithm; in State the object changes its own behaviour automatically when its internal state changes.

### Q4. Give a JDK example of Strategy.

`Comparator` passed to `Collections.sort()` or `List.sort()`; also the functional interfaces passed to stream operations.

### Q5. How would you implement Strategy in Spring?

Make each algorithm a `@Component` implementing one interface, inject `List<Interface>` or `Map<String, Interface>`, and choose the implementation by key at runtime.

## Common Mistakes

- ❌ **Still using `if`/`switch` inside the context** to choose behaviour.
- ❌ **Strategies that depend on the context's internals** — they should only need the interface's parameters.
- ❌ **A class per trivial variant** when a lambda would do.
- ❌ **No handling for an unknown key** when looking strategies up.

## Key Takeaways

- ✅ Strategy encapsulates interchangeable algorithms behind one interface.
- ✅ The context delegates; the algorithm can be swapped at runtime.
- ✅ It eliminates growing conditional chains (Open/Closed Principle).
- ✅ Functional interfaces and lambdas are lightweight strategies.
- ✅ In Spring, inject all implementations and select by key.
