---
title: Design Patterns Cheat Sheet
subtitle: Every pattern in one place — purpose, memory hook, the question it answers, one-line interview definitions, look-alike comparisons and practice problems.
order: 12
---

## Introduction

A one-page revision of all ten patterns in this topic — use it the day before an interview.

## Quick Revision

| Pattern | Category | Purpose | Memory hook | The question it answers |
| --- | --- | --- | --- | --- |
| **Factory Method** | Creational | Create objects without exposing creation logic | Creator → factory method → product | "Which object should I create?" |
| **Singleton** | Creational | Only one instance | `Singleton.getInstance()` or `EnumSingleton.INSTANCE` | "How do I guarantee one shared instance?" |
| **Builder** | Creational | Build a complex object step by step | `new User.Builder().name(…).age(…).build()` | "How do I construct an object with many parameters?" |
| **Strategy** | Behavioral | Choose an algorithm at runtime | Context → Strategy → A / B | "Which algorithm or behaviour should I use?" |
| **Observer** | Behavioral | Notify multiple objects | Subject → observers | "Who should be notified when something changes?" |
| **Proxy** | Structural | Control access | Client → proxy → real object | "Should the client be allowed to access the real object?" |
| **Adapter** | Structural | Make incompatible interfaces work | Client → adapter → existing system | "How can these incompatible interfaces communicate?" |
| **Decorator** | Structural | Add behaviour dynamically | Decorator → decorator → real object (coffee + milk + sugar + chocolate) | "How can I add optional features without subclass explosion?" |
| **Circuit Breaker** | Microservices | Prevent cascading failure | CLOSED = call, OPEN = stop, HALF_OPEN = test | "Should I keep calling this unhealthy dependency?" |
| **Saga** | Microservices | Distributed transaction management | T1 → T2 → T3 fails → C2 → C1 | "How do I keep business data consistent across services when one step fails?" |

## Super-Short Memory Trick

| Pattern | Word |
| --- | --- |
| Factory Method | **Create** |
| Singleton | **One** |
| Builder | **Build** |
| Strategy | **Choose** |
| Observer | **Notify** |
| Proxy | **Control** |
| Adapter | **Convert / connect** |
| Decorator | **Enhance** |
| Circuit Breaker | **Protect** |
| Saga | **Compensate** |

## Pattern Categories

```tree
Patterns in this topic
  Creational
    Factory Method
    Singleton
    Builder
  Structural
    Proxy
    Adapter
    Decorator
  Behavioral
    Strategy
    Observer
  Microservices / distributed
    Circuit Breaker
    Saga
```

## Key Flows

### Circuit Breaker

```flow
CLOSED
: failures exceed the threshold
OPEN
: wait
? HALF_OPEN — trial call succeeds? | Yes: CLOSED | No: OPEN
```

### Saga

```flow
T1 Create Order
T2 Payment
T3 Inventory fails
C2 Refund Payment
C1 Cancel Order
```

Two styles: **choreography** (events, no central boss) and **orchestration** (a central orchestrator).

## One-Line Interview Definitions

- **Factory Method** — defines an interface or method for creating an object while letting subclasses decide which concrete product to create.
- **Singleton** — ensures that a class has only one instance and provides controlled access to it.
- **Builder** — constructs complex objects step by step, separating construction from the final object.
- **Strategy** — encapsulates interchangeable algorithms behind a common interface and allows behaviour to be selected at runtime.
- **Observer** — defines a one-to-many relationship in which observers are notified when the subject changes.
- **Proxy** — provides a substitute for another object to control access to it.
- **Adapter** — converts one interface into another interface expected by the client.
- **Decorator** — adds responsibilities dynamically by wrapping an object with another object implementing the same abstraction.
- **Circuit Breaker** — prevents cascading failures by temporarily stopping calls to an unhealthy dependency and later testing recovery.
- **Saga** — maintains business consistency across multiple services using a sequence of local transactions, with compensating transactions when later steps fail.

## Look-Alike Patterns

| Compare | Difference |
| --- | --- |
| **Proxy vs Decorator** | Same interface for both. Proxy **controls access** (often created by a framework); Decorator **adds behaviour** and is stacked by the client |
| **Adapter vs Decorator** | Adapter **changes** the interface; Decorator **keeps** it |
| **Adapter vs Proxy** | Adapter presents a **different** interface; Proxy presents the **same** one |
| **Strategy vs State** | Strategy is chosen by the **client**; State changes **itself** as internal state changes |
| **Factory vs Builder** | Factory decides **which** object; Builder controls **how** one complex object is assembled |
| **Factory Method vs Abstract Factory** | One product via a subclass-overridden method vs a family of related products from one factory object |
| **Observer vs Pub/Sub** | Direct in-process notification vs decoupled via a broker across services |
| **Saga vs 2PC** | Local transactions + compensations, eventual consistency vs one global locking transaction |

## Patterns You Use Every Day in Spring

| Pattern | Where in Spring |
| --- | --- |
| Singleton | Default bean scope |
| Factory | `BeanFactory`, `FactoryBean`, `@Bean` methods |
| Builder | `ResponseEntity`, `UriComponentsBuilder`, `WebClient.builder()` |
| Strategy | Injecting `List<Interface>` / `Map<String, Interface>`; `PasswordEncoder` |
| Observer | `ApplicationEventPublisher` + `@EventListener` |
| Proxy | `@Transactional`, `@Cacheable`, `@Async`, Spring AOP |
| Adapter | `HandlerAdapter` in Spring MVC |
| Decorator | `TransactionAwareDataSourceProxy`, request wrappers |
| Circuit Breaker | Resilience4j `@CircuitBreaker` |
| Saga | Orchestrated with Temporal / Camunda, or choreographed with Kafka events |

## Practice Problems

**Easy**

1. Implement a thread-safe singleton three different ways.
2. Write a `Pizza` builder with required size and optional toppings, validated in `build()`.
3. Replace an `if`/`else` chain of discount types with Strategy.
4. Wrap a third-party `LegacySmsApi` with an adapter for your `SmsSender` interface.

**Medium**

1. Implement a stock-price subject with thread-safe observers.
2. Write a caching proxy for a slow `ProductRepository`.
3. Decorate a `DataSource`-like interface with logging and timing decorators.
4. Build a notification factory that selects email, SMS or push by configuration.

**Interview level**

1. Implement a thread-safe circuit breaker that allows only one trial call in HALF_OPEN.
2. Design an orchestrated saga for hotel + flight + car booking, with compensations and idempotency.
3. Explain, with code, how Spring's `@Transactional` uses the Proxy pattern and why self-invocation breaks it.
4. Show how Strategy and Factory work together to choose a payment method at runtime in Spring.

## Key Takeaways

- ✅ Creational: Factory Method (create), Singleton (one), Builder (build).
- ✅ Structural: Proxy (control), Adapter (convert), Decorator (enhance).
- ✅ Behavioral: Strategy (choose), Observer (notify).
- ✅ Microservices: Circuit Breaker (protect), Saga (compensate).
- ✅ Know each pattern's problem, its look-alikes, and where Spring uses it.
