---
title: Singleton Pattern
subtitle: Guaranteeing one instance — the enum singleton, eager and lazy initialization, double-checked locking with volatile, the holder idiom, breaking singletons with reflection and serialization, and Spring singleton scope.
order: 3
---

## Introduction

**Purpose:** ensure **only one instance** of a class exists, and provide a global point of access to it.

Typical uses: configuration holders, registries, caches, connection managers and loggers — objects where several copies would waste resources or cause inconsistency.

The essentials of every implementation:

```flow-h
private constructor
single static instance
global access method
```

## Recommended Implementation: Enum

```java
enum DatabaseConnection {
    INSTANCE;

    public void connect() {
        System.out.println("Database connected");
    }
}

public class Main {
    public static void main(String[] args) {
        DatabaseConnection db1 = DatabaseConnection.INSTANCE;
        DatabaseConnection db2 = DatabaseConnection.INSTANCE;

        db1.connect();
        System.out.println(db1 == db2);
    }
}
```

```output
Database connected
true
```

Why an enum is recommended (*Effective Java*, Item 3):

- The JVM guarantees exactly one instance per enum constant.
- Initialization is **thread-safe** (it happens during class initialization).
- **Serialization-safe** — deserializing returns the same constant, not a copy.
- **Reflection-safe** — you can't create enum instances reflectively.

Limitations: an enum can't extend another class (it can implement interfaces), and it's created when the enum class is first used rather than on demand with arguments.

## Eager Initialization

```java
public class AppConfig {
    private static final AppConfig INSTANCE = new AppConfig();   // created when the class loads

    private AppConfig() { }

    public static AppConfig getInstance() {
        return INSTANCE;
    }
}
```

Simple and thread-safe (class initialization is thread-safe), but the instance is created even if never used.

## Lazy Initialization — the Broken Version

```java
public class AppConfig {
    private static AppConfig instance;

    private AppConfig() { }

    public static AppConfig getInstance() {
        if (instance == null) {             // ❌ two threads can both see null
            instance = new AppConfig();     //    and create two instances
        }
        return instance;
    }
}
```

Fine in single-threaded code, **broken** under concurrency. Making the whole method `synchronized` fixes it but locks on every call.

## Double-Checked Locking

```java
public class Singleton {

    private static volatile Singleton instance;

    private Singleton() { }

    public static Singleton getInstance() {
        if (instance == null) {                      // 1st check — no locking once created
            synchronized (Singleton.class) {
                if (instance == null) {              // 2nd check — inside the lock
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

| Part | Why it's there |
| --- | --- |
| First `if` | Skips the lock on every call after creation — fast path |
| `synchronized` | Only one thread creates the instance |
| Second `if` | Another thread may have created it while we waited for the lock |
| **`volatile`** | Prevents a thread from seeing a reference to a **partially constructed** object |

> [!IMPORTANT]
> **`volatile` is mandatory.** `instance = new Singleton()` is allocate → construct → assign, and the JIT/CPU may make the assignment visible before construction finishes. Without `volatile`, a thread passing the first check can get a half-initialized object. (See *Java Memory Model & volatile* in the Multithreading topic.)

## Bill Pugh / Holder Idiom

```java
public class Singleton {

    private Singleton() { }

    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }

    public static Singleton getInstance() {
        return Holder.INSTANCE;   // Holder is loaded — and INSTANCE created — on first call
    }
}
```

Lazy, thread-safe and lock-free, relying on the JVM's guarantee that class initialization happens once. It's usually preferable to double-checked locking.

## Comparison

| Implementation | Lazy | Thread-safe | Serialization-safe | Reflection-safe |
| --- | --- | --- | --- | --- |
| Enum | On first use of the enum | ✅ | ✅ | ✅ |
| Eager static field | ❌ | ✅ | Needs `readResolve` | ❌ |
| Unsynchronized lazy | ✅ | ❌ | ❌ | ❌ |
| `synchronized` method | ✅ | ✅ (slow) | Needs `readResolve` | ❌ |
| Double-checked locking | ✅ | ✅ (with `volatile`) | Needs `readResolve` | ❌ |
| Holder idiom | ✅ | ✅ | Needs `readResolve` | ❌ |

## Breaking a Singleton

### Reflection

```java
Constructor<Singleton> c = Singleton.class.getDeclaredConstructor();
c.setAccessible(true);
Singleton second = c.newInstance();   // a second instance!
```

Defence: throw from the constructor if an instance already exists — or use an enum.

### Serialization

Deserializing a `Serializable` singleton creates a **new** object. Defence:

```java
protected Object readResolve() {
    return getInstance();   // replace the deserialized copy with the real instance
}
```

### Cloning and Multiple Class Loaders

Don't implement `Cloneable` (or throw `CloneNotSupportedException`). And note that a "singleton" is one instance **per class loader** — application servers with several class loaders can hold several copies.

## Singleton in Spring

Spring beans are **singleton-scoped by default** — one instance **per application context**, not per JVM, and without a private constructor:

```java
@Service
public class PricingService { ... }   // one shared instance, created and managed by Spring
```

| GoF Singleton | Spring singleton bean |
| --- | --- |
| Enforced by the class itself | Managed by the container |
| One per class loader | One per `ApplicationContext` |
| Global static access (`getInstance()`) | Obtained by dependency injection |
| Hard to mock and test | Easy to replace in tests |

In Spring applications, prefer singleton beans over hand-written singletons — and keep them **stateless**, because every request thread shares them.

## Drawbacks

- **Global state** — hidden dependencies make code harder to reason about.
- **Testing** — static `getInstance()` calls are hard to mock.
- **Concurrency** — a mutable singleton is shared by all threads and must be thread-safe.
- Often considered an anti-pattern when overused; dependency injection solves most of the same problems more cleanly.

## Interview Questions

### Q1. What is the Singleton pattern?

A creational pattern that ensures a class has only one instance and provides controlled access to it.

### Q2. How do you make a singleton thread-safe?

Use an enum, eager initialization, the holder idiom, or double-checked locking with a `volatile` field.

### Q3. Why is volatile needed in double-checked locking?

Because object construction and reference assignment can be reordered; without `volatile`, another thread may see a non-null reference to an object whose constructor hasn't finished.

### Q4. Why is the enum singleton considered the best approach?

The JVM guarantees one instance, it's thread-safe, and it's protected against both serialization and reflection attacks with no extra code.

### Q5. How can a singleton be broken, and how do you prevent it?

Reflection (call the private constructor) — guard the constructor or use an enum. Serialization — implement `readResolve()`. Cloning — don't support `clone()`. Multiple class loaders — each loads its own copy.

### Q6. Is a Spring singleton bean the same as the Singleton pattern?

No. A Spring singleton is one instance per application context, managed and injected by the container; the GoF singleton enforces one instance per class loader through the class itself.

## Common Mistakes

- ❌ **Lazy initialization without synchronization.**
- ❌ **Double-checked locking without `volatile`.**
- ❌ **Mutable state in a singleton** without thread safety.
- ❌ **Forgetting `readResolve()`** on a serializable singleton.
- ❌ **Using singletons as global variables**, hiding dependencies.

## Key Takeaways

- ✅ Private constructor + single static instance + global access method.
- ✅ The enum singleton is the simplest robust implementation.
- ✅ Double-checked locking requires `volatile`; the holder idiom is simpler.
- ✅ Reflection, serialization and cloning can break non-enum singletons.
- ✅ In Spring, prefer container-managed singleton beans — and keep them stateless.
