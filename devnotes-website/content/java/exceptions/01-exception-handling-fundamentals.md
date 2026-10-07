---
title: Exception Handling Fundamentals
subtitle: What exceptions are, Error vs Exception, the Throwable hierarchy, stack traces, propagation and the five keywords.
order: 1
---

## What is Exception Handling?

An **exception** is an event that interrupts the normal execution of a program. Instead of crashing the application, Java provides a mechanism to **detect, handle and recover** from runtime problems.

```java
int a = 10;
int b = 0;
System.out.println(a / b);
```

```output
Exception in thread "main" java.lang.ArithmeticException: / by zero
```

```flow
Without exception handling
Application Starts
Exception Occurs
Application Terminates
---
With exception handling
Application Starts
Exception Occurs
Handle Exception
Continue Execution
```

## Why Do We Need Exception Handling?

Imagine an online banking application:

```java
withdrawMoney();
updateBalance();
sendSMS();
```

Suppose `withdrawMoney()` throws an exception. Without exception handling:

- The balance may not update.
- The SMS won't be sent.
- The transaction becomes inconsistent.

Proper exception handling allows us to:

- Recover gracefully
- Roll back transactions
- Log errors
- Notify users
- Keep the application running

## Error vs Exception

One of the most common interview questions.

| Error | Exception |
| --- | --- |
| Serious problem | Recoverable problem |
| JVM cannot usually recover | Application can recover |
| Programmer usually doesn't handle | Should be handled |
| Extends `Error` | Extends `Exception` |

| Example Errors | Example Exceptions |
| --- | --- |
| `StackOverflowError` | `IOException` |
| `OutOfMemoryError` | `SQLException` |
| `VirtualMachineError` | `NullPointerException` |
| | `ArithmeticException` |

## Java Exception Hierarchy

```tree
Object
  Throwable
    Error
    Exception
      RuntimeException
```

### Expanded Hierarchy

```tree
Throwable
  Error
    OutOfMemoryError
    StackOverflowError
    VirtualMachineError
  Exception
    IOException
    SQLException
    ClassNotFoundException
    RuntimeException
      NullPointerException
      ArithmeticException
      ArrayIndexOutOfBoundsException
      IllegalArgumentException
        NumberFormatException
      IllegalStateException
```

> [!TIP]
> Interviewers frequently ask candidates to **draw this hierarchy**.

## Throwable Class

Every exception and error inherits from **`Throwable`**.

### Important Methods

| Method | Purpose |
| --- | --- |
| `getMessage()` | The detail message |
| `printStackTrace()` | Prints the type, message and stack trace |
| `getCause()` | The wrapped (root) cause, if any |
| `fillInStackTrace()` | Records the current stack trace |
| `toString()` | Class name + message |

```java
try {
    int x = 10 / 0;
} catch (Exception e) {
    System.out.println(e.getMessage());
    System.out.println(e);
    e.printStackTrace();
}
```

```output
/ by zero
java.lang.ArithmeticException: / by zero
(stack trace)
```

## Exception Flow

```java
public class Demo {
    public static void main(String[] args) {
        System.out.println("Start");
        int a = 10 / 0;
        System.out.println("End");
    }
}
```

```flow
Start printed
10 / 0
JVM creates an ArithmeticException object
Searches for a matching catch block
? Found? | No: program terminates | Yes: handled
```

```output
Start
Exception in thread "main" java.lang.ArithmeticException: / by zero
```

Notice that **`End` never executes**.

## Anatomy of an Exception Object

Every exception contains a **type**, a **message**, a **stack trace** and an optional **cause**.

```java
throw new IllegalArgumentException("Invalid ID");
```

| Part | Value |
| --- | --- |
| Type | `IllegalArgumentException` |
| Message | `Invalid ID` |
| Cause | `null` |
| Stack trace | The method calls that led here |

## Stack Trace Explained

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
        method1();
    }
}
```

```output
java.lang.ArithmeticException: / by zero
    at Demo.method3(Demo.java:3)
    at Demo.method2(Demo.java:6)
    at Demo.method1(Demo.java:9)
    at Demo.main(Demo.java:12)
```

Read from **top to bottom**. The first `at` line shows exactly where the exception occurred.

## Types of Exceptions

Java divides exceptions into two categories:

- **Checked exceptions**
- **Unchecked exceptions**

We'll study these in detail in the next chapter.

## Common Runtime Exceptions

| Exception | Example |
| --- | --- |
| `NullPointerException` | `String s = null; s.length();` |
| `ArithmeticException` | `int x = 10 / 0;` |
| `ArrayIndexOutOfBoundsException` | `int[] arr = {1, 2}; arr[5];` |
| `NumberFormatException` | `Integer.parseInt("ABC");` |
| `ClassCastException` | `Object obj = "Java"; Integer i = (Integer) obj;` |
| `IllegalArgumentException` | `Thread.sleep(-10);` |

### IllegalStateException

```java
Iterator<Integer> iterator = new ArrayList<>(List.of(1, 2)).iterator();
iterator.remove();   // remove() before next()
```

```output
IllegalStateException
```

> [!NOTE]
> On a `List.of(...)` iterator the same call throws `UnsupportedOperationException` instead, because `List.of` creates an immutable list — that's why the example uses an `ArrayList`.

## Exception Handling Keywords

Java provides five important keywords.

| Keyword | Purpose | Example |
| --- | --- | --- |
| `try` | Contains risky code | `try { … }` |
| `catch` | Handles exceptions | `catch (Exception e) { … }` |
| `finally` | Always executes (except in cases like `System.exit()`) | `finally { … }` |
| `throw` | Explicitly throws an exception | `throw new RuntimeException();` |
| `throws` | Declares that a method may throw an exception | `public void readFile() throws IOException` |

### Basic Example

```java
public class Demo {
    public static void main(String[] args) {
        try {
            int x = 10 / 0;
        } catch (ArithmeticException e) {
            System.out.println("Cannot divide by zero");
        }
        System.out.println("Program Continues");
    }
}
```

```output
Cannot divide by zero
Program Continues
```

## Exception Propagation

```java
class Demo {
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
        } catch (Exception e) {
            System.out.println("Handled");
        }
    }
}
```

```flow-up The exception propagates up the call stack until a matching catch block is found
main() → catch | Handled
method1()
method2()
method3() | exception thrown here
```

## Best Practices

- Catch the **most specific** exception first — `catch (IOException e)` instead of `catch (Exception e)` whenever possible.
- Log the exception **with its stack trace**: `logger.error("Failed to process request", e);`
- Don't swallow exceptions. An empty `catch (Exception e) { }` hides failures; at minimum log it: `catch (Exception e) { logger.error("Error", e); }`
- Use exceptions for **exceptional situations**, not normal control flow. Avoid relying on exceptions when simple validation can prevent the error.

## Frequently Asked Interview Questions

### Q1. What is an exception?

An event that disrupts the normal flow of program execution. It is represented by an object derived from `Throwable`.

### Q2. What is the difference between Error and Exception?

Errors are serious JVM/system-level problems that applications generally should not handle. Exceptions represent conditions that applications can often handle or recover from.

### Q3. What is the root class of all exceptions?

`Throwable`.

### Q4. What happens when an exception occurs?

The JVM creates an exception object, searches the call stack for a matching `catch` block, and if none is found, terminates the thread and prints the stack trace.

### Q5. What information does an exception object contain?

- Exception type
- Message
- Stack trace
- Cause (optional)

### Q6. What is exception propagation?

The process by which an exception travels up the method call stack until it is handled or reaches the JVM.

### Q7. Which keywords are used in exception handling?

`try`, `catch`, `finally`, `throw` and `throws`.

### Q8. Why shouldn't we catch Exception everywhere?

Because it hides the actual problem, can unintentionally swallow programming bugs, and makes debugging and maintenance harder. Catch the most specific exception you can handle.

## Chapter Summary

- ✅ Why exception handling is necessary
- ✅ Error vs Exception
- ✅ Java exception hierarchy
- ✅ The `Throwable` class
- ✅ Exception object anatomy
- ✅ Stack traces
- ✅ Exception propagation
- ✅ `try`, `catch`, `finally`, `throw` and `throws`
- ✅ Common runtime exceptions
- ✅ Exception handling best practices
