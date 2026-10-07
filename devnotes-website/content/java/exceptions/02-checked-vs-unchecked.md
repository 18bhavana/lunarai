---
title: Checked vs Unchecked Exceptions
subtitle: Compile-time vs runtime checking, why checked exceptions exist, throws, overriding rules and the Spring Boot preference.
order: 2
---

## What are Checked and Unchecked Exceptions?

Java classifies exceptions into two major categories:

```tree RuntimeException and its subclasses are unchecked; everything else under Exception is checked
Throwable
  Exception {checked}
    RuntimeException {unchecked}
```

The biggest difference is **who is responsible for handling them**.

| Checked Exception | Unchecked Exception |
| --- | --- |
| Checked at compile time | Occurs at runtime |
| Must be handled or declared | Handling is optional |
| Compiler enforces handling | Compiler does not enforce handling |
| Extends `Exception` | Extends `RuntimeException` |
| Usually caused by external factors | Usually caused by programming mistakes |

## Why Did Java Introduce Checked Exceptions?

Imagine reading a file:

```java
Files.readString(Path.of("data.txt"));
```

Many things can go wrong:

- The file doesn't exist
- No permission
- Disk failure
- Network failure (remote file systems)

The compiler **forces the programmer to think about these situations**. This improves program reliability.

## Checked Exceptions

A checked exception is an exception that the **compiler checks during compilation**. If it's not handled, compilation fails.

```java
import java.io.*;

public class Demo {
    public static void main(String[] args) {
        FileReader reader = new FileReader("test.txt");
    }
}
```

```output Compilation error
Unhandled exception type FileNotFoundException
```

```flow-h Why?
FileReader() declares throws FileNotFoundException
Compiler checks it
Compilation fails
```

### Handling Checked Exceptions

**Option 1 — `try-catch`:**

```java
try {
    FileReader reader = new FileReader("test.txt");
} catch (FileNotFoundException e) {
    System.out.println("File not found");
}
```

**Option 2 — `throws`:**

```java
public static void main(String[] args) throws FileNotFoundException {
    FileReader reader = new FileReader("test.txt");
}
```

Now the responsibility moves to the **caller**.

### Common Checked Exceptions

`IOException`, `SQLException`, `ClassNotFoundException`, `FileNotFoundException`, `InterruptedException`, `ParseException`, `CloneNotSupportedException`.

> [!TIP]
> Most checked exceptions involve **files, databases, networking, reflection, threads** or other **external systems**.

## Unchecked Exceptions

Unchecked exceptions occur during **runtime**. The compiler does not force you to handle them.

```java
public class Demo {
    public static void main(String[] args) {
        int x = 10 / 0;
    }
}
```

Compiles successfully. At runtime:

```output
ArithmeticException: / by zero
```

Another example:

```java
String name = null;
System.out.println(name.length());
```

```output
NullPointerException
```

The compiler allows it.

### Why Doesn't Java Force Runtime Exceptions?

Because these are considered **programming mistakes**.

```java
String name = null;
name.length();
```

The compiler cannot always determine whether `name` will be `null` at runtime. Similarly:

```java
int[] arr = new int[5];
System.out.println(arr[100]);
```

The compiler cannot predict runtime values.

### Common Runtime Exceptions

`NullPointerException`, `ArithmeticException`, `ArrayIndexOutOfBoundsException`, `NumberFormatException`, `IllegalArgumentException`, `IllegalStateException`, `ClassCastException`, `UnsupportedOperationException`, `ConcurrentModificationException`.

These are the exceptions interviewers expect every Java developer to know.

## Checked vs Unchecked Comparison

| Feature | Checked | Unchecked |
| --- | --- | --- |
| Compiler checks | Yes | No |
| Must handle | Yes | No |
| Inherits from | `Exception` | `RuntimeException` |
| Happens because of | External conditions | Programming mistakes |
| Compile-time failure | Yes | No |
| Runtime failure | Possible | Yes |

## Exception Hierarchy Revisited

```tree
Throwable
  Error
  Exception
    IOException
      FileNotFoundException
    SQLException
    InterruptedException
    RuntimeException
      NullPointerException
      ArithmeticException
      IllegalArgumentException
        NumberFormatException
      IllegalStateException
      ClassCastException
```

A simple rule:

```flow
RuntimeException (and subclasses)
Unchecked
---
Everything else under Exception
Checked
```

## Compiler Behaviour

| Code | Compilation | Runtime |
| --- | --- | --- |
| `FileReader reader = new FileReader("abc.txt");` | ❌ Error (unhandled checked exception) | — |
| `int x = 10 / 0;` | ✅ Success | `ArithmeticException` |
| `String s = null; s.length();` | ✅ Success | `NullPointerException` |

## throws Keyword

```java
public void read() throws IOException {
}
```

This means: *"I may throw `IOException`. The caller must handle it."* The method is **not handling** the exception — it is only **declaring** it.

## Exception Propagation

```java
class Demo {
    static void readFile() throws IOException {
        throw new IOException();
    }

    static void process() throws IOException {
        readFile();
    }

    public static void main(String[] args) {
        try {
            process();
        } catch (IOException e) {
            System.out.println("Handled");
        }
    }
}
```

```flow-up The exception travels up the call stack until someone handles it
main() → catch
process()
readFile()
```

## Overriding Rules

```java
class Parent {
    void read() throws IOException {
    }
}
```

**Valid** child:

```java
class Child extends Parent {
    @Override
    void read() throws FileNotFoundException {
    }
}
```

Because `FileNotFoundException` is a **subclass** of `IOException`.

**Invalid** child:

```java
class Child extends Parent {
    @Override
    void read() throws Exception {   // Compilation error
    }
}
```

**Reason:** a child class cannot throw a **broader checked exception** than the parent method declares. (Overriding rules are covered in depth in their own chapter.)

## When to Use Which

### Use checked exceptions when

- Reading files
- Database operations
- Network communication
- Reflection
- External APIs
- Recoverable situations

```java
public void uploadFile() throws IOException
```

### Use unchecked exceptions for

- Invalid method arguments
- Null values
- Programming errors
- Business validation failures (commonly in enterprise applications)
- Incorrect object state

```java
throw new IllegalArgumentException("Age cannot be negative");
```

## Enterprise Spring Boot Perspective

Most modern Spring Boot applications prefer **unchecked exceptions for business logic**.

```java
public User findUser(Long id) {
    return repository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found"));
}
```

```java
class UserNotFoundException extends RuntimeException {
}
```

**Why?**

- Cleaner method signatures
- Less boilerplate
- Better readability
- Centralized exception handling using `@ControllerAdvice`

Checked exceptions are still common for file handling, I/O, third-party libraries and low-level APIs.

## Interview Questions

### Q1. What is the difference between checked and unchecked exceptions?

Checked exceptions are verified by the compiler and must be handled or declared. Unchecked exceptions occur at runtime, and the compiler does not require explicit handling.

### Q2. Why are NullPointerException and ArithmeticException unchecked?

They represent programming errors that should be prevented by writing correct code rather than being forced into try-catch blocks.

### Q3. Why is IOException checked?

Because I/O failures are often outside the application's control and may be recoverable, so Java requires developers to consider handling them.

### Q4. Can we catch unchecked exceptions?

Yes.

```java
try {
    int x = 10 / 0;
} catch (ArithmeticException e) {
}
```

### Q5. Can we ignore checked exceptions?

No. The compiler requires them to be either handled using `try-catch` or declared using `throws`.

### Q6. Does throws handle an exception?

No. It only declares that the method may throw an exception. The responsibility is passed to the caller.

### Q7. Which type of exception is preferred in Spring Boot applications?

For business logic, unchecked exceptions (`RuntimeException` and its subclasses) are generally preferred because they reduce boilerplate and integrate well with centralized exception handling.

## Best Practices

- Use checked exceptions for recoverable situations involving external resources.
- Use unchecked exceptions for programming errors and invalid business operations.
- Do not catch `Exception` unless there is a specific reason.
- Never use exceptions for normal control flow.
- Throw meaningful exception types with clear messages.

## Chapter Summary

- ✅ Checked exceptions
- ✅ Unchecked exceptions
- ✅ Compile-time vs runtime checking
- ✅ Why Java introduced checked exceptions
- ✅ The `throws` keyword
- ✅ Exception propagation
- ✅ Exception overriding rules
- ✅ Enterprise Spring Boot practices
- ✅ Best practices for choosing between checked and unchecked exceptions
