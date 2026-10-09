---
title: Spring AOP
subtitle: Aspect-oriented programming — cross-cutting concerns, aspects, join points, pointcuts, the five advice types, pointcut expressions, proxies, self-invocation and aspect ordering.
order: 21
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Spring AOP is one of the most important topics for Java developers with 5+ years of experience — almost every major Spring feature uses AOP internally: `@Transactional`, `@Cacheable`, `@Async`, Spring Security, logging, auditing, performance monitoring, exception handling and distributed tracing.

Interviewers commonly ask: What is AOP? Why do we need it? What are cross-cutting concerns? What are an aspect, a join point, a pointcut and advice? How does Spring AOP work internally? JDK dynamic proxy vs CGLIB? Why doesn't AOP work on private methods? Why doesn't self-invocation trigger `@Transactional`?

## Why Do We Need AOP?

```java
public class UserService {

    public void register() {
        System.out.println("Logging");
        System.out.println("Security Check");
        System.out.println("Transaction Started");
        // business logic
        System.out.println("Transaction Commit");
    }
}

public class OrderService {

    public void placeOrder() {
        System.out.println("Logging");
        System.out.println("Security Check");
        System.out.println("Transaction Started");
        // business logic
        System.out.println("Transaction Commit");
    }
}
```

**Problem:** logging, security and transaction code are **copied everywhere**. This violates the **Don't Repeat Yourself (DRY)** principle.

## The Solution — Aspect-Oriented Programming

Separate business logic from common concerns:

```buckets The common logic becomes an Aspect
Business logic: UserService, OrderService, PaymentService
Cross-cutting concerns: Logging, Security, Transactions, Caching, Auditing
```

## What is an Aspect?

An **aspect** is a class that contains cross-cutting logic:

```java
@Aspect
@Component
public class LoggingAspect {
}
```

Examples: logging, security, transaction management, auditing, performance monitoring, metrics and exception logging.

## Cross-Cutting Concerns

| Business logic | Cross-cutting concerns |
| --- | --- |
| Register user | Logging |
| Create order | Authentication, authorization |
| Process payment | Transactions, caching, performance monitoring |

Cross-cutting concerns affect **multiple modules**.

## Core AOP Terminology

| Term | Meaning |
| --- | --- |
| **Aspect** | A module of cross-cutting logic |
| **Advice** | The code executed by an aspect |
| **Join point** | A method execution that can be advised |
| **Pointcut** | An expression selecting join points |
| **Target** | The original object |
| **Proxy** | The object wrapping the target |
| **Weaving** | Applying aspects to the target |

These definitions are asked in almost every interview.

### Join Point

A point during program execution where an aspect can run. **In Spring AOP, method execution is the only supported join point type** (full AspectJ also supports field access, constructors, etc.). The execution of `save()` is a join point.

### Pointcut

A pointcut decides **where** advice executes:

```java
@Pointcut("execution(* com.app.service.*.*(..))")
public void serviceLayer() {
}
```

Meaning: *every method inside the `service` package*.

### Advice

Advice is the **actual code** executed by Spring:

```java
@Before("execution(* com.app.service.*.*(..))")
public void log() {
    System.out.println("Method Started");
}
```

The logging is the advice.

## Types of Advice

| Advice | Executes |
| --- | --- |
| `@Before` | Before the method |
| `@After` | After the method (success or exception, like `finally`) |
| `@AfterReturning` | Only after successful completion |
| `@AfterThrowing` | Only when an exception occurs |
| `@Around` | Before and after — wraps the execution |

### @Before

```java
@Aspect
@Component
public class LoggingAspect {

    @Before("execution(* com.app.service.*.*(..))")
    public void before() {
        System.out.println("Method Started");
    }
}
```

```flow-h
Before advice
Business method
```

### @After

Runs after method completion, **whether it succeeds or throws**:

```java
@After("execution(* com.app.service.*.*(..))")
public void after() {
}
```

### @AfterReturning

Runs only when the method completes **successfully**:

```java
@AfterReturning(
        pointcut = "execution(* com.app.service.*.*(..))",
        returning = "result")
public void success(Object result) {
    System.out.println(result);
}
```

### @AfterThrowing

Runs only when an **exception** occurs:

```java
@AfterThrowing(
        pointcut = "execution(* com.app.service.*.*(..))",
        throwing = "ex")
public void error(Exception ex) {
    System.out.println(ex.getMessage());
}
```

### @Around

The **most powerful** advice:

```java
@Around("execution(* com.app.service.*.*(..))")
public Object around(ProceedingJoinPoint joinPoint) throws Throwable {

    System.out.println("Before");

    Object result = joinPoint.proceed();

    System.out.println("After");
    return result;
}
```

```flow-h
Before
Business method
After
```

`@Around` can skip method execution, execute the method multiple times (rarely appropriate), modify arguments, modify the return value and measure execution time.

### ProceedingJoinPoint

An interview favourite. `joinPoint.proceed()` **executes the original business method**. Without it, the business method **never executes**.

## Pointcut Expressions

General syntax:

```text
execution(modifiers? return-type package.class.method(parameters))
```

| Pointcut | Matches |
| --- | --- |
| `execution(* *.*(..))` | Every method |
| `execution(* com.app.service.*.*(..))` | Every method of classes in the service package |
| `execution(* UserService.save(..))` | A specific method |
| `execution(String *.*(..))` | Methods returning `String` |
| `execution(* *.*(*))` | Methods with exactly one parameter |

(`..` in the parameter list means *any number of parameters*; `com.app.service..*` would include sub-packages too.)

### Named Pointcuts

```java
@Pointcut("execution(* com.app.service.*.*(..))")
public void services() {
}

@Before("services()")
```

Improves readability and maintainability.

## Internal Working of Spring AOP

For `@Transactional public void save()`, **Spring does not modify your class**. Instead:

```flow-h
UserService
Proxy created
Proxy executes transaction logic
Original method
```

### The Proxy Pattern

```flow
Without AOP
Client
UserService
---
With AOP
Client
Proxy
Logging → transaction → security
UserService
```

The proxy **intercepts** the call.

### JDK Dynamic Proxy

Used when the target implements at least one interface:

```java
public interface PaymentService {
}

public class PaymentServiceImpl implements PaymentService {
}
```

The proxy **implements the same interfaces** and can't proxy classes directly.

### CGLIB Proxy

Used when no interface-based proxy is chosen:

```java
@Service
public class UserService {
}
```

Spring creates a **subclass at runtime** (`UserService` → generated subclass → proxy). It proxies concrete classes, but **can't override `final` methods or subclass `final` classes**.

### Proxy Selection

```flow
? Does the target implement an interface? | Yes: JDK proxy | No: CGLIB proxy
```

> [!NOTE]
> That's the classic Spring rule. **Spring Boot defaults to CGLIB** (`spring.aop.proxy-target-class=true`) even when interfaces exist.

## Why Private Methods Don't Work

```java
@Transactional
private void save() {
}
```

The proxy **cannot intercept a private method** — private methods aren't overridable (CGLIB) and aren't part of any interface (JDK proxy), so proxy-based AOP can't advise them.

## Why Final Methods Don't Work (CGLIB)

```java
final void save() {
}
```

CGLIB works by **overriding methods**. Final methods can't be overridden → no AOP.

## The Self-Invocation Problem

**Interview favourite.**

```java
@Service
public class UserService {

    public void register() {
        save();
    }

    @Transactional
    public void save() {
    }
}
```

```flow-h No transaction
register()
this.save()
Direct call
Proxy bypassed
```

**Why?** Because the call stays **inside the same object** and never passes through the proxy. Solutions:

- Move the transactional method to **another bean**
- Call through the proxy (advanced usage, e.g. self-injection)
- Refactor responsibilities

## Order of Multiple Aspects

```java
@Order(1)
class SecurityAspect {
}

@Order(2)
class LoggingAspect {
}
```

**Lower order value = higher priority** — it runs first on the way in and last on the way out.

## Enabling AOP

```java
@EnableAspectJAutoProxy
```

In Spring Boot, AOP is enabled automatically when the AOP starter (`spring-boot-starter-aop`) is on the classpath; `@EnableAspectJAutoProxy` is still available for explicit configuration.

## Internal Spring Components

```flow-h
ApplicationContext
BeanPostProcessor
AnnotationAwareAspectJAutoProxyCreator
Create proxy
Client receives proxy
```

## Internal Execution Flow

For advice in the same aspect (Spring 5.2.7+):

```flow
Client → proxy
@Around (before proceed)
@Before
Business method
@AfterReturning — or @AfterThrowing if an exception occurred
@After
@Around (after proceed)
```

## Common Mistakes

- ❌ **Forgetting `@Aspect`** — `@Component class Logging {}` alone is just a normal bean.
- ❌ **Forgetting `proceed()`** — an `@Around` method that returns `null` without calling `p.proceed()` means the business method never executes.
- ❌ **Applying AOP to private methods** — won't work; use public (or otherwise proxy-interceptable) methods.
- ❌ **Self-invocation** — `this.method()` bypasses the proxy.
- ❌ **Heavy business logic inside an aspect** — keep aspects focused on cross-cutting concerns.

## Enterprise Architecture

```flow
HTTP request
Controller
Proxy
Logging aspect
Security aspect
Transaction aspect
Service
Repository
Database
```

## Real-World Uses of Spring AOP

| Feature | Uses AOP? |
| --- | --- |
| `@Transactional` | ✓ |
| `@Async` | ✓ |
| `@Cacheable` | ✓ |
| Method security (`@PreAuthorize`) | ✓ |
| Logging | ✓ |
| Metrics | ✓ |
| Auditing | ✓ |

## Interview Questions

### Q1. What is AOP?

Aspect-Oriented Programming is a paradigm that separates cross-cutting concerns (such as logging and transactions) from business logic.

### Q2. What is an Aspect?

A class containing cross-cutting logic.

### Q3. What is a Join Point?

In Spring AOP, a method execution that can be intercepted by an aspect.

### Q4. What is a Pointcut?

An expression that selects which join points receive advice.

### Q5. What is Advice?

The action executed by an aspect at a selected join point.

### Q6. Difference between @Before and @Around?

| @Before | @Around |
| --- | --- |
| Runs before the method | Wraps the method execution |
| Can't control execution | Controls whether and when the method executes |
| Simpler | Most powerful advice type |

### Q7. Difference between JDK Dynamic Proxy and CGLIB?

| JDK proxy | CGLIB |
| --- | --- |
| Proxies interfaces | Proxies classes |
| Requires an interface | Works with concrete classes |
| Uses `java.lang.reflect.Proxy` | Generates subclasses |
| Can't proxy classes directly | Can't proxy final classes or final methods |

### Q8. Why doesn't AOP work on private methods?

Because proxy-based AOP can't intercept private methods — they aren't overridable or callable through the proxy.

### Q9. Why does self-invocation break @Transactional?

Because `this.method()` calls the target object directly and bypasses the Spring proxy.

### Q10. Which class creates AOP proxies?

`AnnotationAwareAspectJAutoProxyCreator` — the key Spring infrastructure component that creates AspectJ-style proxies.

## Key Takeaways

- ✅ Spring AOP separates cross-cutting concerns from business logic.
- ✅ Core concepts: aspect, advice, join point, pointcut, target, proxy and weaving.
- ✅ `@Around` is the most powerful advice — it controls execution via `ProceedingJoinPoint`.
- ✅ Spring AOP is proxy-based, using JDK dynamic proxies or CGLIB.
- ✅ Private methods, final methods (CGLIB) and self-invocation are common proxy limitations.
- ✅ Transactions, caching, async execution and security are implemented with AOP.
