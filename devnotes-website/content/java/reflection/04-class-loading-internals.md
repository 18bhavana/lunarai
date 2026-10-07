---
title: Class Loading and Class.forName() Internals
subtitle: Lazy loading, the Bootstrap/Platform/Application class loaders, parent delegation, loading → linking → initialization, and Class.forName() vs loadClass().
order: 4
---

## Introduction

> [!NOTE]
> **Interview importance:** must know for 5+ years Java developers.

In the previous chapter we learned that `Class.forName("com.demo.Employee")` returns the `Class` object. But interviewers often ask:

> [!QUESTION] What actually happens inside the JVM when Class.forName() is executed?
> To answer this, we must first understand **class loading**.

## What is Class Loading?

A `.class` file is just a file stored on disk:

```flow-h
Employee.java
: compilation
Employee.class
```

Until now, the JVM doesn't know anything about this class. Only when the program **needs** the class does the JVM load it into memory. This process is called **class loading**.

**Definition:** class loading is the process of reading a `.class` file from disk (or another source), bringing its bytecode into the JVM, and preparing it for execution.

### Real-Life Analogy

A movie stored on your laptop is just a file until you click **Play** — then the media player loads it into RAM and it can be played. Similarly, `Employee.class` is only a file; the JVM must load it into memory before it can be used.

## When Does Class Loading Happen?

Many beginners think the JVM loads every class at startup. ❌ **Wrong.** Java uses **lazy loading**: the JVM loads a class only when it is needed.

```java
public class Demo {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
```

If the project has 500 classes, will the JVM load all 500? **No** — only the required classes are loaded.

```java
Employee emp = new Employee();          // JVM needs Employee → Employee.class is loaded

Class.forName("com.demo.Employee");     // again, Employee.class is loaded
```

## Who Loads Classes?

A **class loader** — a JVM component responsible for locating, loading and defining classes in memory. Without a class loader, Java programs cannot execute.

## Types of Class Loaders

Java provides three built-in class loaders:

```flow Parent → child
Bootstrap ClassLoader
Platform ClassLoader
Application ClassLoader
```

> [!NOTE]
> The **Platform** class loader exists since **Java 9**. In Java 8 its place was taken by the **Extension** class loader (which loaded JARs from `jre/lib/ext`).

### Bootstrap Class Loader

The parent of all class loaders. Loads **core Java classes**, e.g. `java.lang.String`, `java.lang.Object`, `java.util.ArrayList`, `java.util.HashMap`, `java.lang.Integer`. Without it, Java itself cannot run.

### Platform Class Loader

Loads Java platform modules such as `java.sql`, `java.xml` and `java.naming` — standard Java libraries that aren't part of the minimal core runtime.

### Application Class Loader

The one developers interact with most. It loads your project classes, third-party JARs, Maven dependencies, Spring Boot classes and Hibernate classes — e.g. `com.demo.Employee`, `com.demo.Student`, `com.company.UserService`.

This hierarchy follows the **parent delegation model**.

## Parent Delegation Model

Suppose the JVM needs `java.lang.String`. Will the Application ClassLoader load it? **No — it first asks its parent.**

```flow-up The request travels up; the first loader that finds the class loads it
Bootstrap — has String ✓ loads it
: delegates
Platform
: delegates
Application
```

Now suppose `com.demo.Employee`:

| Loader | Result |
| --- | --- |
| Bootstrap | ✕ not found |
| Platform | ✕ not found |
| Application | ✓ found — loads `Employee` |

### Why Parent Delegation?

Suppose a developer creates:

```java
package java.lang;

public class String {
}
```

Without parent delegation, the JVM might load the fake `String` instead of the real one, which would break Java. Parent delegation ensures **trusted core classes are loaded first**.

> [!TIP]
> As an extra safeguard, the JVM refuses to define any user class in a `java.*` package at all — it throws `SecurityException: Prohibited package name`.

## Class Loading Phases

When a class is loaded, the JVM performs three major phases. This sequence is guaranteed by the JVM.

```flow-h
Loading
Linking
Initialization
```

### Phase 1 — Loading

The JVM finds the `.class` file, reads its bytecode and creates a `Class` object.

```flow-h At this point the class is loaded but not yet initialized
Employee.class
Read bytecode
Create Class<Employee>
```

### Phase 2 — Linking

Linking has three steps:

```flow-h
Verification
Preparation
Resolution
```

**Verification** — the JVM checks whether the bytecode is valid (no invalid bytecode, illegal instructions or corrupted class file). If verification fails, the class is rejected (`VerifyError`).

**Preparation** — static variables receive **default values**:

```java
class Employee {
    static int x = 100;
}
```

During preparation `x = 0`. Only default values are assigned.

**Resolution** — symbolic references (names like `Employee` in the constant pool) are replaced with direct references to the actual runtime structures. The JVM may do this lazily, the first time each reference is used.

### Phase 3 — Initialization

Now the JVM executes **static variable assignments** and **static blocks**:

```java
class Employee {
    static {
        System.out.println("Employee Loaded");
    }
}
```

```output
Employee Loaded
```

## What Does Class.forName() Do?

```java
Class.forName("com.demo.Employee");
```

Internally:

```flow The class is fully initialized before the method returns
Find class
Load class
Verify
Prepare
Resolve
Initialize
Return Class object
```

### Example

```java
class Employee {
    static {
        System.out.println("Static Block");
    }
}

public class Demo {
    public static void main(String[] args) throws Exception {
        Class.forName("Employee");
    }
}
```

```output
Static Block
```

> [!QUESTION] We never created an object. Why did the static block run?
> Because `Class.forName()` **triggers class initialization** by default.

## Loading vs Initialization

| Loading | Initialization |
| --- | --- |
| Read the class file | Execute static variable assignments |
| Create the `Class` object | Execute static blocks |

Many interviewers ask this difference.

## Can We Load Without Initialization?

Yes. Java provides another API:

```java
ClassLoader.loadClass()
```

It loads the class but does **not** initialize it. There is also an overloaded version of `Class.forName()`:

```java
Class.forName(
        "com.demo.Employee",
        false,
        Demo.class.getClassLoader()
);
```

Here `false` means *load the class but don't initialize it yet*. Initialization happens later, when the JVM actively uses the class.

## Class.forName() vs ClassLoader.loadClass()

| Feature | `Class.forName()` | `ClassLoader.loadClass()` |
| --- | --- | --- |
| Loads class | Yes | Yes |
| Initializes class | Yes (default) | No (not immediately) |
| Executes static block | Yes | No (until initialization) |
| Returns `Class` object | Yes | Yes |

### Example

```java
class Demo {
    static {
        System.out.println("Loaded");
    }
}

public class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("Demo");                                // prints "Loaded"
        // Main.class.getClassLoader().loadClass("Demo");     // prints nothing
    }
}
```

With `Class.forName("Demo")` the output is `Loaded`. With `loadClass("Demo")` there is **no output**, because the class is loaded but not initialized.

> [!WARNING]
> Run this test from a **different** class (`Main` here). If `main()` lived inside `Demo` itself, `Demo` would already be initialized before your code ran, and both calls would print nothing new.

## Real-World Usage

### JDBC Drivers (Older Style)

Developers used to write:

```java
Class.forName("com.mysql.jdbc.Driver");
```

This loaded the driver class, executed its static block, and the static block registered the driver with `DriverManager`.

> [!NOTE]
> Since **JDBC 4.0** (Java 6), drivers on the classpath register themselves automatically through `ServiceLoader`, so this line is no longer needed. (The current MySQL driver class is `com.mysql.cj.jdbc.Driver`.) Still valuable for interviews and legacy code.

### Spring Framework

Spring scans `@Component`, `@Service` and `@Repository` classes. It loads classes, reads metadata, creates beans and performs dependency injection — Reflection depends on classes being loaded.

### Hibernate

Hibernate loads entity classes, reads annotations, creates metadata and maps classes to database tables.

## Interview Questions

### Q1. What is class loading?

The process of bringing a `.class` file into the JVM and creating its runtime representation.

### Q2. Who loads classes?

A class loader.

### Q3. Name the built-in class loaders.

Bootstrap, Platform (Extension in Java 8) and Application.

### Q4. What are the three phases of class loading?

Loading → Linking → Initialization.

### Q5. Which phase executes static blocks?

Initialization.

### Q6. Does Class.forName() execute static blocks?

Yes, because it initializes the class by default.

### Q7. What is the parent delegation model?

A child class loader first delegates the request to its parent before attempting to load the class itself. This prevents core Java classes from being replaced by user-defined classes.

### Q8. Difference between Class.forName() and ClassLoader.loadClass()?

- `Class.forName()` loads **and initializes** the class.
- `ClassLoader.loadClass()` loads the class but does **not** initialize it immediately.

## Key Points to Remember

- ✅ Java uses lazy class loading — classes are loaded only when required.
- ✅ Class loading is handled by class loaders: Bootstrap → Platform → Application.
- ✅ Parent delegation protects core Java classes.
- ✅ Class loading has three phases: Loading, Linking (verify, prepare, resolve), Initialization.
- ✅ `Class.forName()` initializes the class by default.
- ✅ Static blocks execute during the Initialization phase.

## Chapter Summary

Reflection depends on classes being present inside the JVM. Before Reflection can inspect methods, fields, constructors or annotations, the class must first be loaded. The JVM performs Loading, Linking and Initialization, and `Class.forName()` is one of the most common APIs that triggers this complete lifecycle. Understanding these JVM internals is essential for mastering Reflection and understanding how frameworks like Spring and Hibernate work internally.
