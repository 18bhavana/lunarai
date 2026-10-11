---
title: Introduction to Design Patterns
subtitle: What design patterns are, the creational / structural / behavioral categories, distributed-systems patterns, and the ten patterns covered in this topic.
order: 1
---

## Introduction

> [!NOTE]
> **Interview importance:** high. Interviewers rarely ask you to recite a pattern — they ask you to **implement** one, explain **when** to use it, or spot it in frameworks like Spring.

A **design pattern** is a proven, reusable solution to a problem that keeps appearing in software design. It isn't a library or ready-made code — it's a **named template** for structuring classes and objects, which you adapt to your situation.

The classic catalogue is the *Gang of Four* (GoF) book, *Design Patterns: Elements of Reusable Object-Oriented Software* (1994), which described 23 patterns. Modern backend development adds patterns for **distributed systems**, such as Circuit Breaker and Saga.

## Why Learn Design Patterns?

- **Shared vocabulary** — "use a decorator here" says in three words what would otherwise take a paragraph.
- **Proven solutions** — they encode lessons about flexibility, coupling and change.
- **Reading frameworks** — Spring, Hibernate and the JDK are full of them (proxies, factories, template methods, observers).
- **Interviews** — implementing Singleton, Builder, Strategy or Factory is a standard coding question.

> [!TIP]
> Patterns are tools, not goals. Applying a pattern where a simple class would do adds complexity. Reach for one when you recognize the **problem** it solves.

## Pattern Categories

```tree
Design patterns
  Creational | how objects are created
    Factory Method
    Singleton
    Builder
  Structural | how objects are composed
    Proxy
    Adapter
    Decorator
  Behavioral | how objects interact
    Strategy
    Observer
  Distributed systems | how services stay resilient and consistent
    Circuit Breaker
    Saga
```

| Category | Concern | Patterns in this topic |
| --- | --- | --- |
| **Creational** | Creating objects flexibly, hiding construction details | Factory Method, Singleton, Builder |
| **Structural** | Combining classes and objects into larger structures | Proxy, Adapter, Decorator |
| **Behavioral** | Assigning responsibilities and communication between objects | Strategy, Observer |
| **Microservices / distributed** | Resilience and consistency across services | Circuit Breaker, Saga |

Circuit Breaker and Saga are **not** GoF patterns — they come from distributed-systems and microservices architecture — but they're asked just as often in backend interviews.

## The Ten Patterns at a Glance

| Pattern | One word | The question it answers |
| --- | --- | --- |
| Factory Method | **Create** | Which object should I create? |
| Singleton | **One** | How do I guarantee one shared instance? |
| Builder | **Build** | How do I construct an object with many parameters? |
| Strategy | **Choose** | Which algorithm or behaviour should I use? |
| Observer | **Notify** | Who should be told when something changes? |
| Proxy | **Control** | Should the client be allowed to reach the real object? |
| Adapter | **Convert / connect** | How can these incompatible interfaces communicate? |
| Decorator | **Enhance** | How can I add optional features without a subclass explosion? |
| Circuit Breaker | **Protect** | Should I keep calling this unhealthy dependency? |
| Saga | **Compensate** | How do I keep business data consistent across services when a step fails? |

## Design Principles Behind the Patterns

Most patterns are applications of a few principles (see the SOLID chapter in Core Java):

| Principle | Seen in |
| --- | --- |
| **Program to an interface, not an implementation** | Factory Method, Strategy, Adapter, Proxy, Decorator |
| **Favour composition over inheritance** | Strategy, Decorator, Proxy, Adapter |
| **Open/Closed** — open for extension, closed for modification | Strategy, Decorator, Observer, Factory Method |
| **Single Responsibility** | Builder (construction), Proxy (access control), Observer (notification) |
| **Loose coupling** | Observer, Saga choreography |

## Interview Questions

### Q1. What is a design pattern?

A reusable, named solution to a commonly occurring design problem — a template for organizing classes and objects, not finished code.

### Q2. What are the categories of GoF design patterns?

Creational (object creation — Factory Method, Singleton, Builder), structural (composition — Proxy, Adapter, Decorator) and behavioral (interaction — Strategy, Observer).

### Q3. Which design patterns does Spring use?

Singleton (default bean scope), Factory (`BeanFactory`, `FactoryBean`), Proxy (AOP, `@Transactional`), Template Method (`JdbcTemplate`, `RestTemplate`), Observer (`ApplicationEvent` and listeners), Strategy (pluggable implementations injected by interface), Adapter (`HandlerAdapter` in Spring MVC) and Decorator (wrapping beans, e.g. `TransactionAwareDataSourceProxy`).

### Q4. Are Circuit Breaker and Saga GoF patterns?

No — they're distributed-systems / microservices patterns. Circuit Breaker protects callers from failing dependencies; Saga keeps data consistent across services with compensating transactions.

## Common Mistakes

- ❌ **Using patterns for their own sake** — adding factories and strategies where one class would do.
- ❌ **Memorizing UML without the problem** — interviewers want to know *when* and *why*.
- ❌ **Confusing similar patterns** — Proxy vs Decorator vs Adapter all wrap objects but for different reasons.

## Key Takeaways

- ✅ A design pattern is a reusable template for a recurring design problem.
- ✅ GoF patterns are creational, structural or behavioral.
- ✅ Circuit Breaker and Saga are microservices patterns for resilience and consistency.
- ✅ Patterns are built on principles: interfaces, composition, Open/Closed.
- ✅ Learn each pattern's **problem** first; the code follows.
