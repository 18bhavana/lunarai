---
title: Introduction to Reflection
subtitle: What Reflection is, why frameworks need it, compile time vs runtime, the reflection workflow, where it is used, and its trade-offs.
order: 1
---

## Introduction

> [!NOTE]
> **Interview importance:** foundation chapter. Everything else in Reflection builds on it.

## What is Reflection?

**Reflection** is a feature of Java that allows a program to **inspect, examine and manipulate** its own classes, objects, methods, constructors, fields and annotations **at runtime**.

In simple words:

> [!IMPORTANT]
> Reflection allows a Java program to know information about itself while it is running.

Normally, Java programs know everything during compilation. Reflection changes that: instead of knowing everything at compile time, **decisions can be taken at runtime**.

## Why Was Reflection Introduced?

Consider the following program:

```java
class Employee {
    void work() {
        System.out.println("Working...");
    }
}

public class Demo {
    public static void main(String[] args) {
        Employee emp = new Employee();
        emp.work();
    }
}
```

Here we know the class name, the constructor and the method. Everything is fixed before execution and the compiler already knows everything. This is called **static programming**.

Now imagine you are developing the **Spring Framework**. Tomorrow one user writes:

```java
@Service
class UserService {
}
```

Another user writes `@Service class PaymentService {}`, and another writes `@Service class EmailService {}`.

> [!QUESTION] Can Spring's developers know these classes while writing Spring?
> **No.** These classes don't even exist when Spring is being developed. Spring must **discover** them only when the application starts.

This is exactly why Reflection was introduced: it allows Java programs to work with classes that were **unknown during compilation**.

## Definition of Reflection

Reflection is the ability of a Java program to:

- Inspect classes
- Inspect constructors
- Inspect methods
- Inspect fields
- Inspect annotations
- Create objects
- Invoke methods
- Modify field values

…**at runtime**. Those two words are the most important.

## Compile Time vs Runtime

### Compile Time

Compile time is the phase where Java source code is converted into bytecode. During compile time:

- Syntax is checked.
- Class names are verified.
- Method names are verified.
- Variables are verified.
- Type checking is performed.

```java
Employee emp = new Employee();
```

The compiler already knows the `Employee` class exists, the constructor exists, and the object can be created. Everything is known before execution.

### Runtime

Runtime begins after compilation. During runtime:

- The JVM executes bytecode.
- Objects are created.
- Methods are executed.
- Memory is allocated.
- Garbage collection runs.

**Reflection works only during runtime.**

| Compile time | Runtime |
| --- | --- |
| Source → bytecode | JVM executes bytecode |
| Syntax, names and types are checked | Objects created, methods run, memory allocated |
| `new Employee()` is resolved here | Reflection works here |

## Why Is Reflection Called Dynamic Programming?

Normally the class name is fixed:

```java
Employee emp = new Employee();
```

Now suppose:

```java
String className = "Employee";
```

and tomorrow:

```java
String className = "Student";
```

Without changing Java source code, the application starts working with another class. The decision is taken **during runtime** — hence Reflection provides **dynamic behaviour**.

## Real-Life Analogy

Imagine a doctor. A patient enters the hospital, and the doctor doesn't know the patient's name, age, disease or blood group. The doctor first **examines** the patient; only then does treatment start.

Reflection works the same way. The program first examines the class, then discovers what constructors, methods, fields and annotations exist. Only after inspection does it perform operations.

## Reflection Workflow

```flow Reflection always starts with inspection
Unknown class
Inspect class
Find constructors
Find fields
Find methods
Create object
Invoke methods
Read / modify fields
```

## Where is Reflection Used?

Reflection is used extensively in modern Java frameworks.

| Framework | What it uses Reflection for |
| --- | --- |
| **Spring** | Creating beans, dependency injection, bean scanning, autowiring |
| **Hibernate** | Reading entity classes and fields, mapping objects to database tables |
| **JUnit** | Finding methods annotated with `@Test` and executing them automatically |
| **Jackson** | Converting JSON into Java objects, reading field names dynamically |
| **Mockito** | Creating mock objects at runtime |
| **Apache Tomcat** | Loading servlets dynamically |

## What Reflection Can Access

Classes, constructors, methods, fields, interfaces, packages, annotations, modifiers, generic types and parameters.

## Advantages

- ✅ Dynamic object creation
- ✅ Dynamic method invocation
- ✅ Dependency injection
- ✅ Annotation processing
- ✅ Framework development
- ✅ Generic utilities
- ✅ Plugin architecture
- ✅ Testing frameworks
- ✅ Serialization libraries

## Disadvantages

- ❌ Slower than normal method calls
- ❌ Breaks encapsulation
- ❌ Harder to debug
- ❌ Less type-safe (errors appear at runtime, not compile time)
- ❌ Can access private members
- ❌ Additional runtime overhead

## Key Points to Remember

- ✅ Reflection works only at runtime.
- ✅ Reflection allows inspection of classes.
- ✅ Reflection allows dynamic object creation.
- ✅ Reflection allows dynamic method invocation.
- ✅ Reflection allows reading and modifying fields.
- ✅ Reflection is heavily used in Spring, Hibernate and JUnit.

## Interview Questions

### Q1. What is Reflection?

The capability of Java to inspect and manipulate classes, methods, constructors, fields and annotations dynamically at runtime.

### Q2. Why is Reflection needed?

Because frameworks like Spring and Hibernate don't know user classes during their own development. Reflection lets them discover and work with those classes dynamically at runtime.

### Q3. Reflection works during…?

Runtime.

### Q4. Name five frameworks that use Reflection.

Spring, Hibernate, JUnit, Jackson and Mockito.

### Q5. Is Reflection faster than normal method invocation?

No. Reflection is slower because it performs runtime metadata lookup and access checks before executing operations.

## Chapter Summary

Reflection is a powerful Java feature that enables programs to inspect and manipulate classes dynamically at runtime. It forms the backbone of many popular frameworks such as Spring, Hibernate, JUnit, Jackson and Mockito. Understanding Reflection is essential for mastering advanced Java and succeeding in senior Java developer interviews.
