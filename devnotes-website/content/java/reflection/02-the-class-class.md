---
title: The Class Class
subtitle: The heart of Reflection — java.lang.Class, metadata vs data, one Class object per loaded class, how objects point to it, and who creates it.
order: 2
---

## Introduction

> [!NOTE]
> **Interview importance:** very high.

Before learning the Reflection API, we must understand one important class: **`java.lang.Class`**. Every Reflection operation starts with it — without understanding `Class`, Reflection cannot be understood.

> [!IMPORTANT]
> Reflection starts with the `Class` class.

## What is the Class Class?

Many beginners think `Class` is a keyword. **It is not.** `Class` is a predefined **final class** in the package `java.lang`.

Since it belongs to `java.lang`, it is automatically imported into every Java program — we never write `import java.lang.Class;`.

## Why Do We Need the Class Class?

```java
class Employee {
}
```

**Where does the JVM store information about `Employee`?** Information like the class name, package name, methods, constructors, fields, interfaces, parent class, annotations and modifiers.

The JVM keeps this information after loading the class, and exposes it through an object of type **`Class`**.

> [!IMPORTANT]
> A `Class` object represents the **metadata** of a Java class.

## What is Metadata?

**Metadata means data about data.**

```java
class Employee {
    private String name;
    private int age;

    public void work() {
    }
}
```

The values `Rahul` and `25` are **actual data**. But this is **metadata**:

```text
Class name       = Employee
Number of fields = 2
Field names      = name, age
Method           = work()
Package, superclass, constructors, ...
```

Reflection works on **metadata**, not actual business data.

### Real-Life Analogy

A library book contains stories, examples and exercises — the **actual data**. Its cover page contains the book name, author, edition, publisher and price — the **metadata**.

Similarly, **objects contain actual data; the `Class` object describes the metadata**.

## How the JVM Creates It

```flow
Employee.java
: compilation
Employee.class
: JVM loads the class
Class metadata stored
Class object created
```

The JVM loads the `.class` file into memory and, while loading, creates **one `Class` object** that gives access to all the metadata.

> [!NOTE]
> Precisely: the class's internal metadata lives in the JVM's **method area** (called **Metaspace** since Java 8), while the `java.lang.Class` object itself is an ordinary object on the **heap**.

## One Class Object Per Loaded Class

For every loaded class, there is **exactly one `Class` object** in the JVM.

```java
Employee e1 = new Employee();
Employee e2 = new Employee();
Employee e3 = new Employee();
```

> [!QUESTION] How many Employee objects exist? How many Class objects?
> **3** `Employee` objects, but only **1** `Class<Employee>` object. A very important interview question.

```refs All of them point to the same Class object
e1, e2, e3, e4, e5 -> Class<Employee> | metadata
```

```buckets Only one metadata copy exists
Heap — objects: Employee object 1, Employee object 2, Employee object 3
Class metadata: Employee Class object
```

> [!WARNING]
> "One per class" really means **one per class, per class loader**. If two different class loaders each load `com.demo.Employee`, the JVM treats them as two different classes with two different `Class` objects (common in app servers and plugin systems).

## What Information Does the Class Object Hold?

Class name, package name, constructors, methods, fields, interfaces, superclass, nested classes, enum constants, generic information, modifiers and annotations — everything related to the **class structure**.

It does **not** store object values.

```java
class Employee {
    String name;
    int age;

    public void work() {
    }
}
```

| The Class object knows | It does NOT know |
| --- | --- |
| Class name → `Employee` | `Rahul` |
| Package → `com.demo` | `25` |
| Fields → `name`, `age` | (those belong to an object) |
| Methods → `work()` | |
| Constructor → `Employee()` | |

## Relationship Between an Object and Its Class Object

```java
Employee emp = new Employee();
```

**Can an object know which class created it?** Yes. Every Java object internally keeps a reference to its class. That's why we can write:

```java
emp.getClass();
```

```flow-h
Employee object
: reference
Employee Class object
Metadata
```

## Why Reflection Starts with Class

Suppose you want to know a class's methods, constructors, fields or annotations. Where is this information? **Through the `Class` object.** So Reflection first obtains the `Class` object; after that, everything becomes available.

```flow-h
Get Class object
Read metadata
Perform Reflection
```

## Important Methods of Class

We'll study these in detail later:

```java
getName()
getSimpleName()
getPackageName()        // Java 9+
getSuperclass()
getMethods()
getDeclaredMethods()
getFields()
getDeclaredFields()
getConstructors()
getDeclaredConstructors()
isInterface()
isAnnotation()
isEnum()
isArray()
isPrimitive()
```

These methods help us inspect metadata.

## Is the Class Object Created by the Programmer?

**No.** The programmer never creates it.

```java
new Class();   // ❌ impossible
```

The constructor of `Class` is private. The **JVM creates `Class` objects automatically** while loading classes.

## Interview Traps

### Can two different classes share the same Class object?

No. `Employee` and `Student` each have their own unique `Class` object.

### Can two Employee objects have different Class objects?

No (for the same class loader). All of them return the same metadata object:

```java
Employee e1 = new Employee();
Employee e2 = new Employee();
Employee e3 = new Employee();

System.out.println(e1.getClass() == e2.getClass()); // true
System.out.println(e2.getClass() == e3.getClass()); // true
```

Because there is only one `Class<Employee>` object.

## Key Points to Remember

- ✅ `Class` is a predefined final class in `java.lang`.
- ✅ Reflection starts with the `Class` class.
- ✅ The `Class` object represents metadata — data about data.
- ✅ One loaded class has only one `Class` object (per class loader).
- ✅ Multiple objects share the same `Class` object.
- ✅ The JVM creates `Class` objects automatically.

## Interview Questions

### Q1. What is the Class class?

A predefined final class in `java.lang` that represents the runtime metadata of a loaded Java class.

### Q2. What is metadata?

Information about the structure of a class, such as its name, methods, fields, constructors, annotations and superclass.

### Q3. How many Class objects are created for a class?

Only one for each loaded class (per class loader), regardless of how many objects of that class are instantiated.

### Q4. Does the Class object store object values?

No. It describes only class metadata, not instance data.

### Q5. Who creates the Class object?

The JVM, automatically, when it loads the class.

## Chapter Summary

- ✅ `Class` is the gateway to Reflection.
- ✅ Every loaded class has exactly one `Class` object.
- ✅ The `Class` object holds metadata, not business data.
- ✅ Every Java object internally knows its corresponding `Class` object.
- ✅ All Reflection APIs operate on the `Class` object.
