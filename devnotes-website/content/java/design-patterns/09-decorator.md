---
title: Decorator Pattern
subtitle: Adding behaviour dynamically by wrapping — the coffee example, IS-A plus HAS-A, avoiding subclass explosion, Java I/O streams as decorators, and decorators in Spring.
order: 9
---

## Introduction

**Purpose:** add new behaviour **dynamically** by **wrapping** objects.

A **decorator** implements the same interface as the object it wraps, forwards calls to it, and adds something before or after. Decorators can be **stacked**, so features are combined at runtime instead of through a subclass for every combination.

## Example: Coffee

### Component and Concrete Component

```java
interface Coffee {
    double getCost();
    String getDescription();
}

class SimpleCoffee implements Coffee {
    @Override
    public double getCost() {
        return 50;
    }

    @Override
    public String getDescription() {
        return "Coffee";
    }
}
```

### The Base Decorator

```java
abstract class CoffeeDecorator implements Coffee {     // IS-A Coffee
    protected final Coffee coffee;                    // HAS-A Coffee

    public CoffeeDecorator(Coffee coffee) {
        this.coffee = coffee;
    }
}
```

### Concrete Decorators

```java
class MilkDecorator extends CoffeeDecorator {
    public MilkDecorator(Coffee coffee) {
        super(coffee);
    }

    @Override
    public double getCost() {
        return coffee.getCost() + 20;
    }

    @Override
    public String getDescription() {
        return coffee.getDescription() + " + Milk";
    }
}

class SugarDecorator extends CoffeeDecorator {
    public SugarDecorator(Coffee coffee) {
        super(coffee);
    }

    @Override
    public double getCost() {
        return coffee.getCost() + 10;
    }

    @Override
    public String getDescription() {
        return coffee.getDescription() + " + Sugar";
    }
}

class ChocolateDecorator extends CoffeeDecorator {
    public ChocolateDecorator(Coffee coffee) {
        super(coffee);
    }

    @Override
    public double getCost() {
        return coffee.getCost() + 30;
    }

    @Override
    public String getDescription() {
        return coffee.getDescription() + " + Chocolate";
    }
}
```

### Client

```java
public class Main {
    public static void main(String[] args) {
        Coffee coffee = new SimpleCoffee();
        coffee = new MilkDecorator(coffee);
        coffee = new SugarDecorator(coffee);
        coffee = new ChocolateDecorator(coffee);

        System.out.println(coffee.getDescription());
        System.out.println(coffee.getCost());
    }
}
```

```output
Coffee + Milk + Sugar + Chocolate
110.0
```

The cost is 50 + 20 + 10 + 30 = 110. `getCost()` returns a `double`, so it prints as **`110.0`**.

## Structure: Layers of Wrapping

```flow
ChocolateDecorator — adds 30, " + Chocolate"
SugarDecorator — adds 10, " + Sugar"
MilkDecorator — adds 20, " + Milk"
SimpleCoffee — 50, "Coffee"
```

A call to `getCost()` on the outer decorator travels **inward** through each layer to `SimpleCoffee`, and each layer adds its part on the way **back out**.

| Role | In the example | Responsibility |
| --- | --- | --- |
| **Component** | `Coffee` | Common interface |
| **Concrete component** | `SimpleCoffee` | The core object being decorated |
| **Base decorator** | `CoffeeDecorator` | Implements the component and holds a wrapped component |
| **Concrete decorators** | `MilkDecorator`, `SugarDecorator`, `ChocolateDecorator` | Add behaviour, then delegate |

> [!IMPORTANT]
> **Key point:** a decorator **IS-A** component (same interface) **+ HAS-A** component (wraps one) **+ adds behaviour**.

## Why Not Subclasses?

With inheritance, every combination needs a class:

```text
CoffeeWithMilk, CoffeeWithSugar, CoffeeWithMilkAndSugar,
CoffeeWithMilkAndChocolate, CoffeeWithSugarAndChocolate,
CoffeeWithMilkSugarAndChocolate, ...
```

Three add-ons already give 7 combinations; *n* add-ons give 2ⁿ − 1 — a **subclass explosion**. With decorators you write **one class per add-on** and combine them freely at runtime — even adding the same one twice (double milk).

## Decorators in Java I/O

`java.io` is the textbook decorator:

```java
try (BufferedReader reader = new BufferedReader(          // adds buffering + readLine()
        new InputStreamReader(                             // adapts bytes → characters
                new GZIPInputStream(                       // adds decompression
                        new FileInputStream("orders.csv.gz")), StandardCharsets.UTF_8))) {
    String line;
    while ((line = reader.readLine()) != null) {
        process(line);
    }
}
```

`BufferedInputStream`, `DataInputStream`, `GZIPInputStream` and `CipherInputStream` all extend `FilterInputStream` and wrap another `InputStream`. (`InputStreamReader` is an **adapter** — it changes the interface from bytes to characters.)

Other examples:

| Example | Adds |
| --- | --- |
| `Collections.unmodifiableList(list)` | Read-only behaviour |
| `Collections.synchronizedList(list)` | Synchronization |
| Spring `TransactionAwareDataSourceProxy` | Transaction awareness to a `DataSource` |
| Spring Session / `HttpServletRequestWrapper` | Extra behaviour on servlet requests |
| Servlet filters and Spring `HandlerInterceptor` chains | Behaviour around request handling |

## A Backend Example

```java
interface NotificationSender {
    void send(Message m);
}

class RetryingSender implements NotificationSender {
    private final NotificationSender delegate;
    RetryingSender(NotificationSender delegate) { this.delegate = delegate; }

    public void send(Message m) {
        for (int attempt = 1; ; attempt++) {
            try {
                delegate.send(m);
                return;
            } catch (TransientException e) {
                if (attempt == 3) throw e;
            }
        }
    }
}

class MetricsSender implements NotificationSender {
    private final NotificationSender delegate;
    private final Counter sent;
    MetricsSender(NotificationSender delegate, Counter sent) { this.delegate = delegate; this.sent = sent; }

    public void send(Message m) {
        delegate.send(m);
        sent.increment();
    }
}

NotificationSender sender = new MetricsSender(new RetryingSender(new SmtpSender()), counter);
```

Retries and metrics are added to any sender without touching `SmtpSender`.

## Decorator vs Proxy vs Inheritance

| | Decorator | Proxy | Inheritance |
| --- | --- | --- | --- |
| Adds behaviour | ✅ Dynamically, at runtime | Mainly controls access | ✅ Statically, at compile time |
| Combine features | ✅ Stack in any order | Usually one proxy | ❌ One class per combination |
| Who wraps | The client composes decorators | Often the framework, transparently | — |
| Same interface | ✅ | ✅ | ✅ |

## When to Use

- Optional features that can be combined (pricing add-ons, I/O transformations, retries, logging, metrics, caching).
- You need to add responsibilities to individual objects, not to an entire class.
- Subclassing would cause a class explosion, or the class is `final`.

## Interview Questions

### Q1. What is the Decorator pattern?

A structural pattern that adds responsibilities to an object dynamically by wrapping it in another object that implements the same interface.

### Q2. Why use Decorator instead of inheritance?

Inheritance fixes behaviour at compile time and needs a subclass for every combination of features. Decorators combine features at runtime with one class per feature.

### Q3. Give a JDK example.

Java I/O: `new BufferedReader(new InputStreamReader(new FileInputStream(file)))` — `BufferedReader` and `BufferedInputStream` decorate other readers and streams. Also `Collections.unmodifiableList()` and `synchronizedList()`.

### Q4. What's the difference between Decorator and Proxy?

Both have the same interface as the wrapped object. Decorators add behaviour and are stacked by the client; a proxy controls access and is often created transparently by a framework.

### Q5. What does the coffee example print for the cost?

`110.0` — the sum of 50 + 20 + 10 + 30, printed as a `double`.

## Common Mistakes

- ❌ **Forgetting to delegate** to the wrapped object — the inner behaviour disappears.
- ❌ **Order-dependent decorators** without documenting the order (e.g. encrypt-then-compress vs compress-then-encrypt).
- ❌ **Identity checks** — a decorated object isn't `==` the original, and `instanceof SimpleCoffee` fails.
- ❌ **Deep stacks** that make debugging and stack traces hard to follow.

## Key Takeaways

- ✅ Decorator = IS-A component + HAS-A component + extra behaviour.
- ✅ Decorators stack, combining features at runtime.
- ✅ It avoids subclass explosion and follows Open/Closed.
- ✅ Java I/O streams are the classic decorators.
- ✅ The coffee example prints `110.0`, because the cost is a `double`.
