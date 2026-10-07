---
title: Dynamic Proxies
subtitle: Intercepting method calls at runtime — Proxy, InvocationHandler, a logging proxy, how Spring AOP and @Transactional work, and JDK proxies vs CGLIB.
order: 10
---

## Introduction

> [!NOTE]
> **Interview importance:** extremely important for 5+ years Java developers.

In the previous chapter we learned how Reflection reads annotations. Now we'll learn one of the most powerful concepts in Java: the **Dynamic Proxy**.

Dynamic proxies are heavily used in Spring AOP, Spring transaction management, Spring Security, RMI, Mockito, logging frameworks and RPC frameworks. Many developers use these daily without realizing dynamic proxies are working behind the scenes.

## Why Do We Need a Dynamic Proxy?

```java
interface PaymentService {
    void pay();
}

class PaymentServiceImpl implements PaymentService {
    public void pay() {
        System.out.println("Payment Successful");
    }
}
```

Normally:

```java
PaymentService service = new PaymentServiceImpl();
service.pay();
```

```output
Payment Successful
```

Everything works.

### New Requirement

The manager says: print `Logging Started` before every payment and `Logging Completed` after it.

```output Desired output
Logging Started
Payment Successful
Logging Completed
```

### Solution 1 (Bad) — Modify the Original Class

```java
class PaymentServiceImpl implements PaymentService {
    public void pay() {
        System.out.println("Logging Started");
        System.out.println("Payment Successful");
        System.out.println("Logging Completed");
    }
}
```

**Problem:** business logic and logging become tightly coupled.

### Solution 2 (Also Bad) — Write a Wrapper by Hand

```java
class PaymentServiceProxy implements PaymentService {

    private PaymentService target;

    PaymentServiceProxy(PaymentService target) {
        this.target = target;
    }

    public void pay() {
        System.out.println("Logging Started");
        target.pay();
        System.out.println("Logging Completed");
    }
}
```

It works. But imagine **100 interfaces → 100 proxy classes**. Huge maintenance effort.

### Solution 3 (Best) — Generate the Proxy Automatically

The proxy class is created **at runtime**, with no Java source code required. This is called a **Dynamic Proxy**.

## What is a Dynamic Proxy?

> [!IMPORTANT]
> A **dynamic proxy** is an object whose class is generated at runtime. It implements one or more interfaces and **intercepts** method calls before delegating them to the actual target object.

### Real-Life Analogy

When you call customer care you don't reach the engineer directly — a **receptionist** receives the call, verifies your identity, records details and transfers the call. The receptionist acts as a proxy.

```flow-h A dynamic proxy sits between the client and the real object
Client
Proxy
Real object
```

## Components of a Dynamic Proxy

Java provides two core types: **`java.lang.reflect.Proxy`** and **`java.lang.reflect.InvocationHandler`**.

### InvocationHandler

The heart of a dynamic proxy. Every intercepted method passes through `invoke()`:

```java
public interface InvocationHandler {
    Object invoke(Object proxy, Method method, Object[] args) throws Throwable;
}
```

### Parameters of invoke()

| Parameter | Meaning |
| --- | --- |
| `proxy` | The generated proxy object |
| `method` | The method being called — for `service.pay()`, Reflection supplies the `Method` for `pay()` |
| `args` | The arguments passed — for `save("Rahul", 25)`, `args` contains `"Rahul"` and `25` (`null` when there are none) |

## Building a Logging Proxy

### 1. The Target Object

```java
interface PaymentService {
    void pay();
}

class PaymentServiceImpl implements PaymentService {
    public void pay() {
        System.out.println("Payment Successful");
    }
}
```

### 2. The InvocationHandler

```java
class LoggingHandler implements InvocationHandler {

    private Object target;

    LoggingHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("Logging Started");

        Object result = method.invoke(target, args);

        System.out.println("Logging Completed");
        return result;
    }
}
```

Notice that Reflection is used here: `method.invoke(target, args)` executes the original method.

### 3. Create the Proxy Object

```java
PaymentService service = new PaymentServiceImpl();

PaymentService proxy = (PaymentService) Proxy.newProxyInstance(
        service.getClass().getClassLoader(),
        service.getClass().getInterfaces(),
        new LoggingHandler(service)
);
```

### 4. Call the Proxy

```java
proxy.pay();
```

```output
Logging Started
Payment Successful
Logging Completed
```

Notice: the business class **never changed**.

> [!TIP]
> If the target method throws, `method.invoke()` wraps it in `InvocationTargetException`. A real handler should catch that and rethrow `e.getCause()` so callers see the original exception. Also note that `toString()`, `equals()` and `hashCode()` on the proxy go through `invoke()` too.

## Internal Flow

```flow Everything passes through invoke()
Client calls proxy.pay()
Proxy object
InvocationHandler.invoke()
method.invoke(target, args)
Actual object
Return result
```

## Why is Reflection Required?

> [!QUESTION] Can the InvocationHandler call target.pay() directly?
> **No.** A single handler doesn't know which method is being called. Reflection supplies the `Method` object, and `method.invoke(target, args)` executes the correct method dynamically.

### Intercepting Multiple Methods

```java
interface EmployeeService {
    void save();
    void delete();
    void update();
}
```

**One** `InvocationHandler` can intercept **all** these methods. No separate proxy classes are required.

## Real-World Examples

### Spring AOP — @Transactional

```java
@Transactional
public void transfer() {
}
```

```flow-h If an exception occurs: rollback
Client
Spring proxy
Start transaction
Original method
Commit
Return
```

The business method never contains transaction code.

> [!WARNING]
> Because the logic lives in the proxy, calling `this.transfer()` from **another method of the same class** bypasses the proxy, and no transaction starts. This self-invocation trap is a favourite interview question.

### Logging

For `service.save()`, the proxy performs: log start → method → execution time → log end — without modifying service code.

### Security

For `deleteEmployee()`, the proxy first checks the user's role. If authorized it invokes the method; otherwise it throws an exception.

## Limitations of JDK Dynamic Proxies

A very important interview topic: **JDK dynamic proxies work only with interfaces.**

- `interface EmployeeService` → ✅ works
- `class Employee {}` (no interface) → ❌ fails

> [!QUESTION] How does Spring proxy normal classes?
> Using **CGLIB**, which generates a **subclass** of the target class at runtime.

## JDK Dynamic Proxy vs CGLIB

| Feature | JDK Proxy | CGLIB |
| --- | --- | --- |
| Requires an interface | Yes | No |
| Works on concrete classes | ✗ | ✓ (by subclassing) |
| Mechanism | `java.lang.reflect.Proxy` + Reflection | Bytecode generation (subclass), with reflection support |
| Limitations | Interface methods only | Can't proxy `final` classes or `final`/`private` methods |
| Used by Spring | ✓ | ✓ |

## How Spring Chooses a Proxy

```flow
? Does the bean implement an interface? | Yes: JDK dynamic proxy | No: CGLIB proxy
```

This is classic Spring behaviour, and it can be configured.

> [!NOTE]
> **Spring Boot 2.0+** defaults to `proxyTargetClass = true`, so Boot apps use **CGLIB even when an interface exists**, unless you set `spring.aop.proxy-target-class=false`.

## Advantages

- ✅ No code duplication
- ✅ Runtime proxy generation
- ✅ Logging
- ✅ Security
- ✅ Transactions
- ✅ Caching
- ✅ Performance monitoring
- ✅ Method interception

## Disadvantages

- ❌ Reflection overhead
- ❌ More difficult debugging
- ❌ JDK proxies require interfaces
- ❌ Complex call stack

## Interview Questions

### Q1. What is a dynamic proxy?

A runtime-generated object that intercepts method calls before forwarding them to the target object.

### Q2. Which class creates dynamic proxies?

`java.lang.reflect.Proxy` (via `Proxy.newProxyInstance()`).

### Q3. Which interface handles intercepted methods?

`InvocationHandler`.

### Q4. Which method is implemented?

`invoke()`.

### Q5. Why is Reflection required?

Because the proxy doesn't know which method will be called until runtime. Reflection executes the correct method using `method.invoke(target, args)`.

### Q6. Can a JDK dynamic proxy proxy normal classes?

No. Only interfaces.

### Q7. Which library proxies concrete classes?

CGLIB.

### Q8. How does Spring implement AOP?

Using dynamic proxies. Classic Spring uses a JDK dynamic proxy when an interface exists and CGLIB otherwise; Spring Boot defaults to CGLIB.

### Q9. Name real-world uses of dynamic proxies.

Spring AOP, transaction management, security, logging, caching, performance monitoring, remote procedure calls and Mockito.

## Key Points to Remember

- ✅ Dynamic proxies are generated at runtime and intercept method calls.
- ✅ `InvocationHandler` contains the interception logic.
- ✅ Reflection (`method.invoke()`) calls the original method.
- ✅ `Proxy.newProxyInstance()` creates proxy objects.
- ✅ JDK dynamic proxies work only for interfaces; CGLIB works for concrete classes.
- ✅ Spring AOP is built on dynamic proxy technology.

## Chapter Summary

Dynamic proxies let Java intercept method calls without modifying the original business class. By combining `Proxy`, `InvocationHandler` and Reflection, Java frameworks implement cross-cutting concerns such as logging, transactions, security, caching and monitoring. Understanding dynamic proxies is essential for mastering Spring AOP and advanced Java framework internals.
