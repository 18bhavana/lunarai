---
title: Exception Hierarchy
subtitle: The full Throwable tree, Error vs Exception vs RuntimeException, catch matching and ordering, polymorphism and multi-catch.
order: 5
---

## What is the Exception Hierarchy?

Every exception in Java belongs to a well-defined **inheritance hierarchy**. Understanding it is important because Java uses it to determine:

- Which `catch` block executes
- Which exceptions can be thrown
- Which exceptions must be declared
- How polymorphism works with exceptions

The root of the hierarchy is **`java.lang.Throwable`**.

## Complete Exception Hierarchy

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
    AssertionError
    LinkageError
      NoClassDefFoundError
  Exception
    IOException
      FileNotFoundException
      EOFException
      SocketException
    SQLException
    InterruptedException
    ClassNotFoundException
    ParseException
    RuntimeException
      ArithmeticException
      NullPointerException
      IllegalArgumentException
        NumberFormatException
      IllegalStateException
      IndexOutOfBoundsException
        ArrayIndexOutOfBoundsException
        StringIndexOutOfBoundsException
      ClassCastException
      UnsupportedOperationException
      ConcurrentModificationException
      NoSuchElementException
```

## Throwable

Everything that can be thrown must extend `Throwable`. Only subclasses of `Throwable` can be used with `throw`.

```java
throw new Exception();          // Valid
throw new String("Hello");      // Compilation error
```

### Throwable Methods

| Method | Purpose |
| --- | --- |
| `getMessage()` | Detail message |
| `getLocalizedMessage()` | Locale-specific message (defaults to `getMessage()`) |
| `getCause()` | Wrapped cause |
| `printStackTrace()` | Prints type, message and stack trace |
| `fillInStackTrace()` | Records the current stack trace |
| `toString()` | Class name + message |
| `addSuppressed()` | Attaches a suppressed exception |
| `getSuppressed()` | Returns suppressed exceptions |

```java
try {
    int x = 10 / 0;
} catch (Exception e) {
    System.out.println(e.getMessage());
    System.out.println(e.getCause());
    e.printStackTrace();
}
```

## Error

`Error` represents **serious JVM-level problems**. Usually, applications should not try to recover from them.

Examples: `OutOfMemoryError`, `StackOverflowError`, `VirtualMachineError`, `NoClassDefFoundError`, `AssertionError`.

```java
public class Demo {
    public static void recursive() {
        recursive();
    }

    public static void main(String[] args) {
        recursive();
    }
}
```

```output
StackOverflowError
```

### Can We Catch Errors?

Technically, yes:

```java
try {
    recursive();
} catch (StackOverflowError e) {
    System.out.println("Recovered");
}
```

> [!WARNING]
> This is generally **not recommended**, because an `Error` usually indicates that the JVM or application is in an unstable state.

## Exception

`Exception` represents conditions that an application can **potentially recover from**.

Examples: `IOException`, `SQLException`, `InterruptedException`, `ParseException`, `ClassNotFoundException`. Applications are expected to handle these situations appropriately.

## RuntimeException

`RuntimeException` is a subclass of `Exception`. It represents **programming mistakes or invalid application state**.

Examples: `NullPointerException`, `ArithmeticException`, `IllegalArgumentException`, `IllegalStateException`, `ArrayIndexOutOfBoundsException`, `NumberFormatException`, `ClassCastException`.

```flow
RuntimeException (and subclasses)
Unchecked exception
---
Everything else under Exception
Checked exception
```

## Inheritance and Polymorphism

### Inheritance Example

```java
class AnimalException extends Exception {
}

class DogException extends AnimalException {
}
```

Now `throw new DogException();` can be caught as any of:

```java
catch (DogException e)
catch (AnimalException e)
catch (Exception e)
catch (Throwable e)
```

This is **exception polymorphism**.

### Polymorphism with Exception References

```java
Exception ex = new FileNotFoundException();   // Valid
Throwable t = new IOException();              // Valid
IOException ex = new Exception();             // Compilation error
```

A parent reference can point to a child object, but not the other way around.

## Catch Block Matching

```java
try {
    throw new FileNotFoundException();
} catch (IOException e) {
    System.out.println("IOException");
} catch (Exception e) {
    System.out.println("Exception");
}
```

```output
IOException
```

**Why?** Because `FileNotFoundException` → `IOException` → `Exception`, and Java picks the **first compatible** catch block.

### Exception Matching Flow

For `throw new FileNotFoundException();`, Java checks the catch blocks from top to bottom:

```flow The first matching catch block executes
FileNotFoundException?
IOException?
Exception?
Throwable?
No match → JVM default handler
```

## Catch Order

**Correct** — most specific first:

```java
try {
    readFile();   // may throw FileNotFoundException / IOException
} catch (FileNotFoundException e) {
} catch (IOException e) {
} catch (Exception e) {
}
```

**Wrong:**

```java
try {
    readFile();
} catch (Exception e) {
} catch (IOException e) {   // Compilation error
}
```

```output Compilation error
exception IOException has already been caught
```

Because `Exception` already catches `IOException`, the later block is unreachable.

> [!IMPORTANT]
> **Rule:** always catch the most specific exception first.

> [!NOTE]
> A `catch` for a **checked** exception also needs a `try` body that can actually throw it — `try { } catch (IOException e) { }` with an empty body fails with *"exception IOException is never thrown in body of corresponding try statement."* That's why the examples call `readFile()`.

## Multi-Catch (Java 7)

Instead of writing:

```java
try {
    process();
} catch (IOException e) {
} catch (SQLException e) {
}
```

you can write:

```java
try {
    process();
} catch (IOException | SQLException e) {
    System.out.println("Handled");
}
```

Useful when the handling logic is identical.

## Throwing Parent vs Child Exceptions

```java
void read() throws IOException {
}
```

Inside this method:

- ✅ `throw new FileNotFoundException();` — valid, because `FileNotFoundException` is a subclass of `IOException`.
- ❌ `throw new Exception();` — invalid, because `Exception` is broader than `IOException`.

The compiler prevents this because callers are only prepared to handle `IOException` or its subclasses.

## Common Exception Families

| Family | Exceptions |
| --- | --- |
| I/O | `IOException`, `FileNotFoundException`, `EOFException`, `SocketException` |
| Runtime | `NullPointerException`, `ArithmeticException`, `IllegalArgumentException`, `IllegalStateException`, `NumberFormatException` |
| Collections | `ConcurrentModificationException`, `NoSuchElementException`, `UnsupportedOperationException` |
| Reflection | `ClassNotFoundException`, `NoSuchMethodException`, `IllegalAccessException` |
| Database | `SQLException` |

## Enterprise Perspective

In enterprise applications:

- Business exceptions usually extend `RuntimeException`.
- Framework exceptions often wrap lower-level exceptions.
- Libraries create their own exception hierarchies.

```tree This makes exception handling more organized and maintainable
ApplicationException
  BusinessException
    UserNotFoundException
    OrderNotFoundException
    PaymentFailedException
    SeatUnavailableException
```

## Interview Questions

### Q1. What is the root class of all exceptions?

`Throwable`.

### Q2. What are the two direct subclasses of Throwable?

`Error` and `Exception`.

### Q3. What is the difference between Error and Exception?

`Error` represents serious JVM/system failures that applications generally should not recover from. `Exception` represents conditions that applications can often handle or recover from.

### Q4. Is RuntimeException checked?

No. It is an unchecked exception.

### Q5. Why does Java use inheritance for exceptions?

It allows polymorphism, reusable exception handling, and catching related exceptions at different levels of abstraction.

### Q6. How does Java choose a catch block?

Java selects the first compatible catch block while scanning from top to bottom.

### Q7. Why should specific exceptions be caught before general exceptions?

Otherwise, the specific catch blocks become unreachable, resulting in a compilation error.

### Q8. Can we catch Throwable?

Yes — `catch (Throwable t) { }` — but this is rarely recommended because it also catches `Error`, which applications generally should not attempt to handle.

## Best Practices

- Understand the complete `Throwable` hierarchy.
- Catch the most specific exception first.
- Avoid catching `Throwable` or `Error` unless there is a compelling reason.
- Use exception inheritance to design clean domain-specific exceptions.
- Leverage polymorphism to simplify exception handling.

## Chapter Summary

- ✅ Complete Java exception hierarchy and `Throwable`
- ✅ Error vs Exception vs RuntimeException
- ✅ Exception inheritance and polymorphism
- ✅ Catch block matching and ordering rules
- ✅ Multi-catch
- ✅ Enterprise exception hierarchies
