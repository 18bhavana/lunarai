---
title: Three Ways to Obtain a Class Object
subtitle: ClassName.class, object.getClass() and Class.forName() — compile time vs runtime, which ones load the class, ClassNotFoundException, and what frameworks use.
order: 3
---

## Introduction

> [!NOTE]
> **Interview importance:** very high.

In the previous chapter we learned that Reflection starts with the `Class` object, and the `Class` object holds metadata about a class. Now the question is: **how do we obtain the `Class` object?**

Java provides three standard ways:

1. `ClassName.class`
2. `object.getClass()`
3. `Class.forName()`

Every Java developer should know when to use each one.

## Overview

| Method | Known at compile time | Works at runtime | Object required | Loads the class |
| --- | --- | --- | --- | --- |
| `Employee.class` | Yes | — | No | Loads if needed, but does **not** initialize |
| `emp.getClass()` | No | Yes | Yes | Class is already loaded |
| `Class.forName()` | No | Yes | No | Yes — loads **and initializes** |

## Method 1 — Using .class

```java
class Employee {
}

Class<Employee> cls = Employee.class;
```

`Employee.class` returns the `Class` object representing `Employee`.

### How Does It Work?

During compilation, the compiler already knows `Employee`, so the expression refers directly to the corresponding `Class` object. **No object creation is required.**

```flow-h
Employee.class
Class<Employee>
Metadata
```

### Advantages

- ✅ Very simple
- ✅ Fast
- ✅ Type-safe (`Class<Employee>`, not `Class<?>`)
- ✅ No object required

### Disadvantage

The class name must be known **during compilation**. `Employee.class` works, but this is impossible:

```java
String className = "Employee";
className.class;   // ❌ does not compile
```

### Interview Questions on .class

| Can we write…? | Answer |
| --- | --- |
| `String.class` | **Yes** — `String` itself is a class |
| `int.class` | **Yes** — primitive types also have `Class` objects |
| `void.class` | **Yes** — even `void` has a corresponding `Class` object |

## Method 2 — Using getClass()

```java
class Employee {
}

Employee emp = new Employee();
Class<?> cls = emp.getClass();
```

Returns the **runtime class** of the object.

### Internal Working

Every Java object internally stores a reference to its class. When we write `emp.getClass()`, the JVM simply returns that stored reference.

```flow-h
Employee object
Class<Employee>
Metadata
```

### The Object Must Already Exist

Without an object, we cannot call `getClass()`:

```java
Employee.getClass();          // ❌ compilation error — getClass() is an instance method

Employee emp = new Employee();
emp.getClass();               // ✅ correct
```

### Advantage — The Actual Runtime Type

Useful when we don't know the object's exact type:

```java
Object obj = new Employee();
obj.getClass();   // Employee, not Object
```

It returns the **actual runtime class**.

```java
Object obj = "Hello";
System.out.println(obj.getClass());
```

```output
class java.lang.String
```

```java
Object obj = 100;
System.out.println(obj.getClass());
```

```output
class java.lang.Integer
```

…because of autoboxing.

> [!QUESTION] Which method returns the runtime class?
> `getClass()`.

## Method 3 — Using Class.forName()

The most important method in Reflection.

```java
Class<?> cls = Class.forName("com.demo.Employee");
```

Notice the argument is a **fully qualified class name** — not just `Employee`, but `com.demo.Employee`.

### What Does Class.forName() Do?

It asks the JVM: *"Load this class if it is not already loaded, and return its `Class` object."*

```flow
Find the class
Load the class (if not already loaded)
Initialize it (static blocks run)
Return the Class object
```

### Why Frameworks Use It

Imagine Spring Boot. You write `com.company.UserService`. Spring knows that name only as a **String**, and later turns it into a class:

```java
Class.forName(className);
```

Spring never writes `new UserService()` because it doesn't know your class at compile time.

> [!TIP]
> Internally Spring uses its own helper (`ClassUtils.forName`) built on the class loader, and component scanning first reads `.class` files directly — but the idea is the same: a class name as a String becomes a `Class` at runtime.

### Dynamic Class Loading

```java
String className = "com.demo.Employee";
Class<?> cls = Class.forName(className);
```

Tomorrow `className = "com.demo.Student"` — no code changes required, only the string changes. This is called **dynamic class loading**.

### ClassNotFoundException

Suppose `Class.forName("ABC")` is called but no `ABC` class exists. The JVM throws **`ClassNotFoundException`** (a checked exception), so:

```java
try {
    Class.forName("ABC");
} catch (ClassNotFoundException e) {
    e.printStackTrace();
}
```

> [!QUESTION] Why does Class.forName() throw ClassNotFoundException?
> Because the requested class may not exist or may not be available on the classpath.

## Difference Between All Three

| | `.class` | `getClass()` | `Class.forName()` |
| --- | --- | --- | --- |
| Example | `Employee.class` | `emp.getClass()` | `Class.forName("com.demo.Employee")` |
| Requires an object | ✗ | ✓ | ✗ |
| Compile-time class reference | ✓ | ✗ | ✗ |
| Runtime class discovery | ✗ | ✓ | ✓ |
| Uses a String class name | ✗ | ✗ | ✓ |
| Can dynamically load classes | ✗ | ✗ | ✓ |
| Throws `ClassNotFoundException` | ✗ | ✗ | ✓ |
| Used heavily in frameworks | For known classes (e.g. `SpringApplication.run(App.class)`) | Limited | ✓ |
| Key trait | No exception | Returns runtime type | Dynamic, String-based |

## Which One Should We Use?

| Situation | Use |
| --- | --- |
| The class is known | `Employee.class` |
| An object already exists | `emp.getClass()` |
| The class name comes from a database, properties file, XML, JSON, configuration or user input | `Class.forName()` |

### Real-World Example

Suppose `application.properties` contains:

```text
service.class=com.demo.UserService
```

Java code:

```java
String className = properties.getProperty("service.class");
Class<?> cls = Class.forName(className);
```

Now the application is configurable **without changing source code**.

## Interview Questions

### Q1. Which method is most commonly used by frameworks?

`Class.forName()` (or class-loader equivalents), because frameworks discover classes dynamically.

### Q2. Which method requires an object?

`getClass()`.

### Q3. Which methods work even before object creation?

`Employee.class` and `Class.forName()`.

### Q4. Which method throws ClassNotFoundException?

`Class.forName()`.

### Q5. Why do we use the fully qualified class name in Class.forName()?

Because multiple packages can contain classes with the same simple name. The fully qualified name uniquely identifies the class for the JVM — e.g. `com.company.hr.Employee` and `com.company.sales.Employee` are both named `Employee` but are different classes.

## Key Points to Remember

- ✅ Reflection always begins by obtaining a `Class` object.
- ✅ Java provides three ways to obtain it.
- ✅ `.class` is compile-time and type-safe.
- ✅ `getClass()` returns the runtime class of an existing object.
- ✅ `Class.forName()` dynamically loads a class using its fully qualified name.
- ✅ Frameworks use `Class.forName()`-style loading because class names often become available only at runtime.

## Chapter Summary

- ✅ `.class` is the simplest approach when the class is already known.
- ✅ `getClass()` is useful when you already have an object and want its actual runtime type.
- ✅ `Class.forName()` is the most powerful approach because it supports dynamic class loading — the preferred choice for frameworks like Spring, Hibernate, JDBC drivers and plugin architectures.
