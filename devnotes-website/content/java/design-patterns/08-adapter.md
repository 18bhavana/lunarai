---
title: Adapter Pattern
subtitle: Making incompatible interfaces work together — wrapping a legacy payment gateway, object vs class adapters, adapters in the JDK and Spring MVC, and the hexagonal-architecture view.
order: 8
---

## Introduction

**Purpose:** make **incompatible interfaces work together**.

An **adapter** converts the interface of an existing class into the interface a client expects — like a travel plug adapter that lets an Indian charger fit a European socket. Neither the client nor the existing class changes.

## Example: Legacy Payment Gateway

The application expects a `PaymentProcessor`, but the third-party library provides a `LegacyPaymentGateway` with a different method name:

```java
interface PaymentProcessor {          // what the application expects
    void pay(double amount);
}

class LegacyPaymentGateway {          // what the library provides — can't be changed
    public void makePayment(double amount) {
        System.out.println("Legacy payment: " + amount);
    }
}
```

### The Adapter

```java
class PaymentAdapter implements PaymentProcessor {

    private final LegacyPaymentGateway gateway;

    public PaymentAdapter(LegacyPaymentGateway gateway) {
        this.gateway = gateway;
    }

    @Override
    public void pay(double amount) {
        gateway.makePayment(amount);   // translate the call
    }
}
```

### Client

```java
public class Main {
    public static void main(String[] args) {
        LegacyPaymentGateway gateway = new LegacyPaymentGateway();
        PaymentProcessor processor = new PaymentAdapter(gateway);

        processor.pay(1000);
    }
}
```

```output
Legacy payment: 1000.0
```

(`1000` is widened to `double`, so it prints as `1000.0`.)

## Structure

```flow-h
Client
Expected interface — PaymentProcessor
Adapter — PaymentAdapter
Existing / incompatible class — LegacyPaymentGateway
```

| Role | In the example | Responsibility |
| --- | --- | --- |
| **Target** | `PaymentProcessor` | The interface the client expects |
| **Adaptee** | `LegacyPaymentGateway` | The existing class with an incompatible interface |
| **Adapter** | `PaymentAdapter` | Implements the target and translates calls to the adaptee |
| **Client** | `Main` | Uses only the target interface |

> [!IMPORTANT]
> **Key point:** **make interfaces compatible** — without modifying either side.

## Real Adapters Do More Than Rename

In practice an adapter often translates **data and errors** too:

```java
class StripePaymentAdapter implements PaymentProcessor {
    private final StripeClient stripe;

    StripePaymentAdapter(StripeClient stripe) { this.stripe = stripe; }

    @Override
    public void pay(double amount) {
        try {
            long paise = Math.round(amount * 100);                    // unit conversion
            stripe.charges().create(new ChargeRequest(paise, "INR"));  // different request model
        } catch (StripeException e) {
            throw new PaymentFailedException("Payment declined", e);   // translate exceptions
        }
    }
}
```

## Object Adapter vs Class Adapter

| Object adapter (composition) | Class adapter (inheritance) |
| --- | --- |
| Adapter **holds** an adaptee instance | Adapter **extends** the adaptee and implements the target |
| Works with any subclass of the adaptee | Tied to one adaptee class |
| Preferred in Java | Possible only if the adaptee isn't `final`; uses up the single superclass |

```java
// Class adapter — less flexible
class PaymentClassAdapter extends LegacyPaymentGateway implements PaymentProcessor {
    @Override
    public void pay(double amount) {
        makePayment(amount);
    }
}
```

The example in this chapter is an **object adapter** — the recommended form (composition over inheritance).

## Adapters in the JDK and Spring

| Example | Adapts |
| --- | --- |
| `Arrays.asList(array)` | An array → the `List` interface |
| `InputStreamReader` | A byte `InputStream` → a character `Reader` |
| `Collections.enumeration(collection)` | A `Collection` → the legacy `Enumeration` |
| Spring MVC **`HandlerAdapter`** | Lets `DispatcherServlet` invoke very different handler types (`@Controller` methods, `HttpRequestHandler`, …) through one interface |
| Spring `HttpMessageConverter` | HTTP bodies ↔ Java objects |
| `JpaVendorAdapter` | Plugs a JPA provider (Hibernate) into Spring |

## Adapters in Hexagonal Architecture

In *ports and adapters* (hexagonal) architecture, your domain defines **ports** (interfaces) and the outside world connects through **adapters**:

```refs
PaymentController, KafkaOrderListener -> OrderService | domain — depends only on ports
StripePaymentAdapter, JpaOrderRepository -> PaymentPort, OrderRepositoryPort | ports implemented by adapters
```

Swapping Stripe for Razorpay means writing a new adapter — the domain doesn't change.

## When to Use

- Integrating third-party or legacy code whose interface doesn't match yours.
- Keeping vendor-specific types (SDK classes, exceptions) out of your domain.
- Migrating gradually from an old API to a new one.

## Interview Questions

### Q1. What is the Adapter pattern?

A structural pattern that converts the interface of an existing class into another interface that the client expects, so incompatible classes can work together.

### Q2. What's the difference between an object adapter and a class adapter?

An object adapter wraps an instance of the adaptee (composition); a class adapter extends the adaptee (inheritance). Object adapters are more flexible and preferred in Java.

### Q3. Adapter vs Decorator?

An adapter **changes** the interface to a different one; a decorator keeps the **same** interface and adds behaviour.

### Q4. Adapter vs Proxy?

A proxy has the same interface as its subject and controls access; an adapter presents a different interface to make an incompatible class usable.

### Q5. Give examples of Adapter in Java or Spring.

`Arrays.asList()`, `InputStreamReader`, and Spring MVC's `HandlerAdapter`.

## Common Mistakes

- ❌ **Leaking adaptee types** (vendor exceptions, SDK models) through the adapter.
- ❌ **Putting business logic in adapters** — they should translate, not decide.
- ❌ **Modifying the adaptee or client** instead of adapting.
- ❌ **Class adapters** where composition would be more flexible.

## Key Takeaways

- ✅ Adapter converts one interface into another that the client expects.
- ✅ Neither the client nor the existing class changes.
- ✅ Prefer object adapters (composition).
- ✅ Adapters also translate data formats and exceptions.
- ✅ Adapter changes the interface; Decorator and Proxy keep it.
