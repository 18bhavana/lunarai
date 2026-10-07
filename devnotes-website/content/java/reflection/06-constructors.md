---
title: Constructors in Reflection
subtitle: The Constructor API — getConstructors vs getDeclaredConstructors, private constructors, newInstance() with arguments, constructor metadata, exceptions and how frameworks create objects.
order: 6
---

## Introduction

> [!NOTE]
> **Interview importance:** very high.

In the previous chapter we learned how to inspect a class using the `Class` API. Now we'll learn how to **inspect and invoke constructors** using Reflection.

One of the biggest advantages of Reflection is that it lets us **create objects dynamically at runtime**, even when we don't know the class during compilation. This is used extensively by Spring, Hibernate, Jackson and JUnit.

## What is a Constructor?

A constructor is a special member of a class that is executed whenever an object is created.

```java
class Employee {
    Employee() {
        System.out.println("Employee Object Created");
    }
}
```

Normally we create an object like this:

```java
Employee emp = new Employee();
```

Here the compiler already knows the class name, the constructor and the object type. **Reflection removes this compile-time dependency.**

## The Constructor Reflection API

All constructor-related operations use **`java.lang.reflect.Constructor`**.

```flow-h
Class
Constructor
Create object
```

## Getting All Public Constructors

```java
public class Employee {
    public Employee() {
    }

    public Employee(String name) {
    }

    private Employee(int id) {
    }
}
```

```java
Class<?> cls = Employee.class;

Constructor<?>[] constructors = cls.getConstructors();

for (Constructor<?> c : constructors) {
    System.out.println(c);
}
```

```output
public Employee()
public Employee(java.lang.String)
```

Notice that the **private constructor is not returned**. (Parameter types are printed with their fully qualified names; if `Employee` were in a package, it would print `public com.demo.Employee()`.)

## getConstructors() vs getDeclaredConstructors()

```java
Constructor<?>[] constructors = cls.getDeclaredConstructors();
```

```output
public Employee()
public Employee(java.lang.String)
private Employee(int)
```

| Method | Public constructors | Private / protected / package-private constructors |
| --- | --- | --- |
| `getConstructors()` | Yes | No |
| `getDeclaredConstructors()` | Yes | Yes |

(Constructors are never inherited, so neither method returns superclass constructors.)

## Getting a Specific Constructor

```java
public class Employee {
    public Employee() {
    }

    public Employee(String name) {
    }
}
```

```java
// no-argument constructor
Constructor<Employee> constructor = Employee.class.getConstructor();

// parameterized constructor
Constructor<Employee> constructor = Employee.class.getConstructor(String.class);
```

Notice: we specify **parameter types, not values**.

## Getting a Private Constructor

```java
class Employee {
    private Employee(int id) {
    }
}
```

```java
Constructor<Employee> constructor = Employee.class.getDeclaredConstructor(int.class);

constructor.setAccessible(true);   // since it is private
```

Now it can be used.

## Creating Objects Dynamically

The most important part.

```java
public class Employee {
    public Employee() {
        System.out.println("Employee Object Created");
    }
}
```

```java
Constructor<Employee> constructor = Employee.class.getConstructor();

Employee emp = constructor.newInstance();
```

```output
Employee Object Created
```

No `new Employee()` statement is used — Reflection creates the object.

### Using a Parameterized Constructor

```java
public class Employee {
    public Employee(String name) {
        System.out.println(name);
    }
}
```

```java
Constructor<Employee> constructor = Employee.class.getConstructor(String.class);

Employee emp = constructor.newInstance("Rahul");
```

```output
Rahul
```

The arguments are supplied at runtime.

> [!WARNING]
> `getConstructor(...)` finds **public** constructors only. If the constructor is package-private (no modifier), `getConstructor()` throws `NoSuchMethodException` — use `getDeclaredConstructor(...)` instead.

### Using a Private Constructor

```java
class Employee {
    private Employee() {
        System.out.println("Private Constructor");
    }
}
```

```java
Constructor<Employee> constructor = Employee.class.getDeclaredConstructor();

constructor.setAccessible(true);

Employee emp = constructor.newInstance();
```

```output
Private Constructor
```

Reflection can invoke private constructors (subject to module/security restrictions in modern Java).

## Constructor Metadata

```java
Constructor<?> constructor = Employee.class.getConstructor(String.class);
```

```java
// Name — the class's binary name (com.demo.Employee if it is in a package)
System.out.println(constructor.getName());              // Employee

// Parameter count
System.out.println(constructor.getParameterCount());    // 1

// Parameter types
for (Class<?> type : constructor.getParameterTypes()) {
    System.out.println(type.getName());                  // java.lang.String
}

// Modifiers
int modifier = constructor.getModifiers();
System.out.println(Modifier.isPublic(modifier));        // true
System.out.println(Modifier.isPrivate(modifier));       // false
```

## Constructor Exceptions

| Exception | Reason |
| --- | --- |
| `NoSuchMethodException` | Constructor not found |
| `InstantiationException` | Class cannot be instantiated (e.g. abstract class) |
| `IllegalAccessException` | Constructor not accessible |
| `InvocationTargetException` | The constructor itself threw an exception (the original is in `getCause()`) |

```java
try {
    Constructor<Employee> constructor = Employee.class.getConstructor();
    Employee emp = constructor.newInstance();
} catch (Exception e) {
    e.printStackTrace();
}
```

## Internal Working of newInstance()

```flow It behaves like the new keyword, but dynamically
Constructor object
Access check
Allocate memory
Execute constructor
Return object
```

## Real-World Usage

### Spring Framework

Spring scans classes like:

```java
@Service
public class UserService {
}
```

and internally performs operations similar to:

```java
Class<?> cls = Class.forName(className);

Constructor<?> constructor = cls.getDeclaredConstructor();

Object bean = constructor.newInstance();
```

Thus Spring creates beans dynamically. (With constructor injection, Spring picks the constructor that takes the dependencies and passes the beans as arguments.)

### Hibernate

When Hibernate reads rows from the database, it creates entity objects using Reflection instead of writing `new Employee()`:

```java
@Entity
public class Employee {
}
```

> [!TIP]
> That's why JPA requires every entity to have a **no-argument constructor** (public or protected).

### Jackson

While converting JSON into Java objects:

```json
{
  "name": "Rahul"
}
```

Jackson first creates an object using Reflection (usually via the no-arg constructor) and then populates it.

## Class.newInstance() (Deprecated)

Older Java versions allowed:

```java
Employee emp = Employee.class.newInstance();
```

**Problems:**

- Works only with an accessible **no-argument** constructor.
- Poor exception handling — it rethrows any exception from the constructor directly, even checked ones the caller doesn't declare.

It is **deprecated since Java 9**. Preferred approach:

```java
Employee emp = Employee.class
        .getDeclaredConstructor()
        .newInstance();
```

## Interview Questions

### Q1. Which class represents constructors in Reflection?

`java.lang.reflect.Constructor`.

### Q2. Difference between getConstructor() and getDeclaredConstructor()?

| Method | Public | Private |
| --- | --- | --- |
| `getConstructor()` | ✓ | ✗ |
| `getDeclaredConstructor()` | ✓ | ✓ |

### Q3. Difference between getConstructors() and getDeclaredConstructors()?

| Method | Returns |
| --- | --- |
| `getConstructors()` | All public constructors |
| `getDeclaredConstructors()` | All constructors declared in the class |

### Q4. Which method creates an object dynamically?

`constructor.newInstance()`.

### Q5. Can Reflection invoke a private constructor?

Yes — by calling `setAccessible(true)` before `newInstance()`.

### Q6. Why is Class.newInstance() deprecated?

Because it supports only no-argument constructors and has poor exception handling. Use `getDeclaredConstructor().newInstance()` instead.

## Key Points to Remember

- ✅ Constructors are represented by `java.lang.reflect.Constructor`.
- ✅ Reflection can inspect both public and private constructors.
- ✅ `getConstructor()` returns only public constructors; `getDeclaredConstructor()` can access private ones.
- ✅ `newInstance()` creates objects dynamically, including with parameters.
- ✅ `setAccessible(true)` enables access to private constructors (subject to module restrictions).
- ✅ Spring, Hibernate and Jackson use constructor reflection to create objects at runtime.

## Chapter Summary

The `Constructor` API enables Java programs to inspect constructors, retrieve metadata and create objects dynamically. This forms the foundation of dependency injection, ORM frameworks, serialization libraries and many plugin systems. Mastering constructor reflection is essential for understanding how modern Java frameworks instantiate objects without explicitly using the `new` keyword.
