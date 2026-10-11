---
title: Proxy Pattern
subtitle: Controlling access to another object — the bank-account protection proxy, kinds of proxies (protection, virtual, remote, caching, logging), dynamic proxies, and how Spring AOP, @Transactional and Hibernate lazy loading use proxies.
order: 7
---

## Introduction

**Purpose:** **control access** to another object.

A **proxy** implements the same interface as the real object and stands in front of it. Clients talk to the proxy exactly as they would to the real object, while the proxy decides whether, when and how to forward each call.

## Example: Bank Account

### Subject and Real Subject

```java
interface BankAccount {
    void withdraw(double amount);
}

class RealBankAccount implements BankAccount {
    @Override
    public void withdraw(double amount) {
        System.out.println("Withdrawn " + amount);
    }
}
```

### The Proxy

```java
class BankAccountProxy implements BankAccount {
    private final RealBankAccount account = new RealBankAccount();
    private final boolean authenticated;

    public BankAccountProxy(boolean authenticated) {
        this.authenticated = authenticated;
    }

    @Override
    public void withdraw(double amount) {
        if (!authenticated) {
            System.out.println("Access Denied");
            return;
        }
        account.withdraw(amount);
    }
}
```

### Client

```java
public class Main {
    public static void main(String[] args) {
        BankAccount account = new BankAccountProxy(true);
        account.withdraw(5000);

        BankAccount unauthorized = new BankAccountProxy(false);
        unauthorized.withdraw(5000);
    }
}
```

```output
Withdrawn 5000.0
Access Denied
```

(The amount is a `double`, so it prints as `5000.0`.)

## Structure

```flow-h
Client
Proxy — same interface, adds control
Real object
```

| Role | In the example | Responsibility |
| --- | --- | --- |
| **Subject** | `BankAccount` | Interface shared by proxy and real object |
| **Real subject** | `RealBankAccount` | Does the actual work |
| **Proxy** | `BankAccountProxy` | Controls access, then delegates |

> [!IMPORTANT]
> **Key point:** **control access** — the client can't tell it's talking to a proxy.

> [!TIP]
> In real code the real object is usually **injected** into the proxy (`new BankAccountProxy(realAccount, authService)`) rather than created inside it, so the proxy can wrap any implementation and be tested in isolation.

## Kinds of Proxies

| Kind | What it controls | Example |
| --- | --- | --- |
| **Protection proxy** | Permissions | The bank example; Spring Security's method security (`@PreAuthorize`) |
| **Virtual proxy** | Expensive creation — create the real object lazily on first use | Hibernate lazy-loading proxies |
| **Remote proxy** | Network access — a local object representing a remote one | RMI stubs, Feign clients, gRPC stubs |
| **Caching proxy** | Repeated work — return cached results | Spring `@Cacheable` |
| **Logging / monitoring proxy** | Cross-cutting concerns — timing, auditing, metrics | Spring AOP aspects |
| **Smart reference** | Reference counting, locking, transactions | Spring `@Transactional` |

### A Virtual (Lazy) Proxy

```java
class LazyReport implements Report {
    private RealReport real;          // expensive to build
    private final long id;

    LazyReport(long id) { this.id = id; }

    @Override
    public String content() {
        if (real == null) {
            real = RealReport.load(id);   // built only when actually needed
        }
        return real.content();
    }
}
```

## Dynamic Proxies

Writing a proxy class per interface doesn't scale. Java can generate proxies **at runtime** (see *Dynamic Proxies* in the Reflection topic):

```java
BankAccount real = new RealBankAccount();

BankAccount proxy = (BankAccount) Proxy.newProxyInstance(
        BankAccount.class.getClassLoader(),
        new Class<?>[] { BankAccount.class },
        (p, method, args) -> {
            System.out.println("Before " + method.getName());
            Object result = method.invoke(real, args);
            System.out.println("After " + method.getName());
            return result;
        });

proxy.withdraw(100);
```

| JDK dynamic proxy | CGLIB / ByteBuddy proxy |
| --- | --- |
| Requires an interface | Subclasses the concrete class |
| Built into the JDK | Library (bundled in Spring) |
| Only interface methods are proxied | Can't proxy `final` classes or `final`/`private` methods |

## Proxies in Spring and Hibernate

```flow-h
Caller
Spring proxy — transaction / security / cache / async
Your bean
```

- **`@Transactional`** — the proxy begins a transaction, calls your method, then commits or rolls back.
- **`@Cacheable`** — the proxy checks the cache before calling your method.
- **`@Async`** — the proxy submits the call to an executor.
- **`@PreAuthorize`** — the proxy checks permissions first.
- **Hibernate lazy loading** — `order.getCustomer()` returns a proxy that loads the customer on first access (and throws `LazyInitializationException` if the session is closed).

> [!WARNING]
> Because these features live in the **proxy**, calling an annotated method via `this` from inside the same bean **bypasses** it — no transaction, no cache, no async. This self-invocation trap is one of the most common Spring bugs.

## Proxy vs Decorator vs Adapter

All three wrap another object; the intent differs:

| | Proxy | Decorator | Adapter |
| --- | --- | --- | --- |
| Interface | **Same** as the real object | **Same** as the wrapped object | **Different** — converts one interface to another |
| Intent | **Control access** | **Add behaviour** | **Make incompatible interfaces work together** |
| Who creates the wrapped object | Often the proxy itself, or the framework | The client, stacking decorators | The client or configuration |
| Stacking | Not typical | Designed to stack | Not typical |

## When to Use

- Access control, lazy creation, remote access, caching, logging or transactions — without changing the real class.
- Adding cross-cutting behaviour transparently to many classes (via dynamic proxies / AOP).

## Interview Questions

### Q1. What is the Proxy pattern?

A structural pattern that provides a substitute implementing the same interface as another object, to control access to it.

### Q2. What types of proxies are there?

Protection (access control), virtual (lazy creation), remote (represents a remote object), caching, and logging/smart-reference proxies.

### Q3. How does Spring use proxies?

Spring AOP wraps beans in JDK dynamic proxies or CGLIB subclasses to apply `@Transactional`, `@Cacheable`, `@Async`, method security and custom aspects.

### Q4. Why doesn't @Transactional work when a method calls another method of the same class?

Because the internal call goes through `this`, not through the proxy, so the proxy's transaction logic never runs.

### Q5. What's the difference between Proxy and Decorator?

Both implement the same interface as the wrapped object. A proxy **controls access** (and often manages the real object's lifecycle); a decorator **adds behaviour** and is designed to be stacked by the client.

### Q6. JDK dynamic proxy vs CGLIB?

JDK proxies require an interface and implement it at runtime; CGLIB creates a subclass of the concrete class, so it works without interfaces but can't proxy `final` classes or methods.

## Common Mistakes

- ❌ **Self-invocation** in Spring beans bypassing the proxy.
- ❌ **`final` classes or methods** on beans that need class-based proxies.
- ❌ **Accessing Hibernate lazy proxies outside a session.**
- ❌ **Confusing proxy with decorator** in interviews.

## Key Takeaways

- ✅ A proxy has the same interface as the real object and controls access to it.
- ✅ Protection, virtual, remote, caching and logging proxies serve different purposes.
- ✅ Dynamic proxies generate proxies at runtime — the basis of Spring AOP.
- ✅ `@Transactional`, `@Cacheable`, `@Async` and Hibernate lazy loading are proxies.
- ✅ Self-invocation bypasses the proxy.
