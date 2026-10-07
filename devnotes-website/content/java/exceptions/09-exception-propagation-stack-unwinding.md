---
title: Exception Propagation & Stack Unwinding
subtitle: How exceptions travel up the call stack, how the JVM unwinds frames, checked vs unchecked propagation and translation across Spring layers.
order: 9
---

## What is Exception Propagation?

**Exception propagation** is the process by which an exception travels from the method where it occurs **to its caller** until it is handled.

If a method does not handle an exception, the JVM passes it to the calling method. This continues until:

- A matching `catch` block is found, or
- The exception reaches the JVM, causing program termination.

## Understanding the Call Stack

Whenever a method is called, the JVM creates a **stack frame**.

```java
public static void main(String[] args) {
    method1();
}
```

```flow-up Every method call pushes a new frame on top
method2() | pushed when method1() calls method2()
method1() | pushed when main() calls method1()
main()
```

## What is Stack Unwinding?

When an exception occurs, the JVM starts **removing stack frames one by one** while searching for a matching `catch` block. This process is called **stack unwinding**.

Suppose the stack is `main() → method1() → method2() → method3()` and the exception occurs in `method3()`:

```flow
method3(): no catch → remove frame
method2(): no catch → remove frame
method1(): no catch → remove frame
main(): catch found
Handle exception
```

## Basic Example

```java
public class Demo {

    static void method3() {
        int x = 10 / 0;
    }

    static void method2() {
        method3();
    }

    static void method1() {
        method2();
    }

    public static void main(String[] args) {
        try {
            method1();
        } catch (ArithmeticException e) {
            System.out.println("Handled");
        }
    }
}
```

```output
Handled
```

```flow-h Propagation
method3
method2
method1
main
catch
```

### If Nobody Handles the Exception

```java
public static void main(String[] args) {
    method1();
}
```

```output
Exception in thread "main" java.lang.ArithmeticException: / by zero
    at Demo.method3(Demo.java:4)
    at Demo.method2(Demo.java:8)
    at Demo.method1(Demo.java:12)
    at Demo.main(Demo.java:16)
```

The exception reaches the JVM, which prints the stack trace and **terminates the thread**.

### Stack Trace Explained

Read it **from top to bottom**. The first stack frame is where the exception actually occurred; the remaining frames show how execution reached that point.

## Checked Exception Propagation

```java
static void method3() throws IOException {
    throw new IOException();
}

static void method2() throws IOException {
    method3();
}

static void method1() throws IOException {
    method2();
}
```

Main:

```java
public static void main(String[] args) {
    try {
        method1();
    } catch (IOException e) {
        System.out.println("Handled");
    }
}
```

```flow-h Every intermediate method declares throws IOException
method3
method2
method1
main
catch
```

## Runtime Exception Propagation

```java
static void method3() {
    throw new RuntimeException();
}
```

No `throws` declaration is required — propagation still happens (`method3 → method2 → method1 → main`). **Runtime exceptions propagate automatically.**

## Propagation Stops at the First Matching Catch

```java
static void method2() {
    try {
        method3();
    } catch (ArithmeticException e) {
        System.out.println("Handled in method2");
    }
}
```

```flow-h The exception never reaches main()
method3
method2: handled
stop
```

### Nested Propagation

```java
try {
    method1();
} catch (IOException e) {
}
```

With `method1() → method2() → method3()` and an `IOException` in `method3`, the exception travels `method3 → method2 → method1 → main → catch`. **Each method gets a chance to handle or propagate it.**

## Propagation vs Handling

```java
// Propagation
void read() throws IOException

// Handling
try {
    read();
} catch (IOException e) {
}
```

> [!TIP]
> Remember: **`throws` propagates. `catch` handles.**

## Spring Boot Layered Architecture

```flow-h Typical flow
Controller
Service
Repository
Database
```

Suppose a repository call fails with a database exception:

```flow-h Many Spring Boot applications use centralized exception handling rather than catching in every layer
Repository
Service
Controller
@ControllerAdvice
HTTP response
```

> [!NOTE]
> With Spring Data repositories you won't usually see a raw `SQLException`: Spring translates it into its unchecked `DataAccessException` hierarchy, which then propagates up the layers.

### Wrapping During Propagation

Repository (plain JDBC):

```java
throw new SQLException("Database Down");
```

Service:

```java
catch (SQLException e) {
    throw new DatabaseException("Unable to save user", e);
}
```

Controller:

```java
@ExceptionHandler(DatabaseException.class)
```

```flow-h This is called exception translation
SQLException
DatabaseException
HTTP 500
```

## Stack Unwinding Internals

Suppose `main() → A() → B() → C()` and the exception occurs in `C()`:

```flow Destroyed frames are removed permanently from the call stack
Search catch in C → no → destroy C frame
Search catch in B → no → destroy B frame
Search catch in A → no → destroy A frame
Search catch in main → found
Execute catch
```

### finally During Propagation

```java
try {
    method3();
} finally {
    System.out.println("Cleanup");
}
```

```flow-h finally executes before the exception moves to the caller
Exception
finally
Continue propagation
```

## Common Mistakes

### Catching Too Early

```java
catch (Exception e) {
}
```

If the method cannot recover, **allow the exception to propagate**.

### Swallowing Exceptions

```java
catch (IOException e) {
}
```

The exception disappears, making debugging difficult.

### Logging and Rethrowing Everywhere

```java
catch (Exception e) {
    logger.error("Error", e);
    throw e;
}
```

If every layer logs the same exception, production logs become noisy. Log the exception **where it is finally handled** or where additional context is added.

## Enterprise Best Practices

- Handle exceptions only where recovery is possible.
- Allow exceptions to propagate when higher layers are better suited to decide the response.
- Translate low-level exceptions into business-specific exceptions.
- Preserve the original cause.
- Use centralized exception handling (`@ControllerAdvice`) in Spring Boot.

## Interview Questions

### Q1. What is exception propagation?

The process of passing an exception from the method where it occurs to its caller until it is handled or reaches the JVM.

### Q2. What is stack unwinding?

The JVM process of removing stack frames while searching for a matching `catch` block.

### Q3. Does propagation happen for checked exceptions?

Yes. However, checked exceptions must also be declared using `throws` (or handled) at each level.

### Q4. Does propagation happen for unchecked exceptions?

Yes. Unchecked exceptions propagate automatically without requiring a `throws` declaration.

### Q5. What happens if no catch block is found?

The exception reaches the JVM, which prints the stack trace and terminates the current thread.

### Q6. Does finally execute during propagation?

Yes. The `finally` block executes before the exception continues propagating to the caller.

### Q7. What is stack unwinding used for?

It enables the JVM to search for a matching `catch` block while cleaning up method stack frames.

### Q8. Why do enterprise applications allow exceptions to propagate?

To centralize exception handling, reduce duplicate code, and maintain consistent error responses.

### Q9. Where should an exception be handled in a Controller → Service → Repository architecture?

- The **repository** should throw persistence-related exceptions.
- The **service** should translate or wrap exceptions if needed and enforce business rules.
- The **controller** should usually rely on global exception handling (`@ControllerAdvice`) instead of many local try-catch blocks.

This results in cleaner, more maintainable code.

## Chapter Summary

- ✅ Exception propagation and stack frames
- ✅ Stack unwinding
- ✅ Checked and runtime exception propagation
- ✅ Stack traces
- ✅ Exception translation
- ✅ Spring Boot layered propagation
- ✅ `finally` during propagation
- ✅ Enterprise best practices
