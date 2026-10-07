---
title: Suppressed Exceptions
subtitle: How try-with-resources keeps the primary exception and attaches cleanup failures — addSuppressed, getSuppressed and cause vs suppressed.
order: 7
---

## What are Suppressed Exceptions?

A **suppressed exception** is an exception that occurs while **closing a resource**, but is not allowed to replace the original (**primary**) exception.

This concept was introduced in **Java 7** along with try-with-resources. The goal is to **preserve both exceptions** instead of losing one.

## Why Were Suppressed Exceptions Introduced?

Before Java 7, consider this example:

```java
try {
    throw new RuntimeException("Main Exception");
} finally {
    throw new RuntimeException("Close Exception");
}
```

```output
RuntimeException: Close Exception
```

**Problem:** `Main Exception` is **lost forever**. The exception thrown from `finally` replaces the original exception, which makes debugging difficult.

### The Problem with Resource Cleanup

```java
try {
    // Read file
    throw new IOException("Read Failed");
} finally {
    reader.close();
}
```

```flow-h Which exception should Java report? Before Java 7: the close() exception — the original disappeared
Read Failed
close()
close() throws IOException
```

## Java 7 Solution

With try-with-resources, Java **preserves both exceptions**.

```flow-h
Primary exception
+ Suppressed exception
Both available
```

The original exception remains the **main** exception. The cleanup exception becomes a **suppressed** exception.

### Example

```java
class MyResource implements AutoCloseable {
    @Override
    public void close() {
        throw new RuntimeException("Close Failed");
    }
}
```

Usage:

```java
try (MyResource resource = new MyResource()) {
    throw new RuntimeException("Business Failed");
}
```

```output Output (simplified)
RuntimeException: Business Failed
    Suppressed: RuntimeException: Close Failed
```

Notice:

- The **primary** exception is preserved.
- The **closing** exception is suppressed.

## Primary vs Suppressed Exception

```flow
Business logic
Business exception thrown | primary
close() runs
Close exception thrown
Attached as suppressed
```

> [!IMPORTANT]
> **Rule:** the exception thrown inside the `try` block always has priority.

## How Java Stores Suppressed Exceptions

Every `Throwable` contains a **list of suppressed exceptions**. Methods (added in Java 7):

```java
addSuppressed(Throwable exception)
getSuppressed()
```

### getSuppressed()

```java
try (MyResource resource = new MyResource()) {
    throw new RuntimeException("Main");
} catch (Exception e) {
    for (Throwable t : e.getSuppressed()) {
        System.out.println(t.getMessage());
    }
}
```

```output
Close Failed
```

### addSuppressed()

Java adds suppressed exceptions automatically in try-with-resources, but you can also do it manually:

```java
Exception main = new Exception("Main");
Exception cleanup = new Exception("Cleanup");

main.addSuppressed(cleanup);

throw main;
```

```output Output (simplified)
Exception: Main
    Suppressed: Exception: Cleanup
```

## Multiple Resources

```java
try (
    ResourceA a = new ResourceA();
    ResourceB b = new ResourceB()
) {
    throw new RuntimeException("Main");
}
```

Closing order: **`ResourceB.close()` → `ResourceA.close()`**. If both `close()` methods throw exceptions:

```tree Both cleanup failures are preserved
Main Exception {primary}
  ResourceB.close() {suppressed}
  ResourceA.close() {suppressed}
```

## Resource Closing Flow

```flow
Create resource
Execute try block
Primary exception? → Yes
Close resources
? close() exception? | Yes: add as suppressed | No: nothing extra
Throw primary exception
```

### Real JDBC Example

```java
try (
    Connection con = dataSource.getConnection();
    PreparedStatement ps = con.prepareStatement(sql);
    ResultSet rs = ps.executeQuery()
) {
    // Business logic
}
```

If query execution fails **and** closing the `ResultSet` also fails, Java reports the **primary `SQLException`** with the closing failure as a **suppressed `SQLException`**. Nothing is lost.

### Printing Suppressed Exceptions

```java
catch (Exception e) {
    e.printStackTrace();
}
```

```output Output (simplified)
RuntimeException: Main Exception
    Suppressed: RuntimeException: Close Exception
```

Modern JVMs automatically print suppressed exceptions in stack traces.

## Suppressed vs Cause

Many developers confuse these concepts.

| Cause | Suppressed |
| --- | --- |
| Root reason for the exception | Additional exception during cleanup |
| One cause | Multiple suppressed exceptions |
| Accessed using `getCause()` | Accessed using `getSuppressed()` |
| Used in exception chaining | Used mainly by try-with-resources |

```tree All three pieces of information can coexist
IOException
  Cause: Disk Full
  Suppressed: Close Failed
```

### Exception Chaining vs Suppressed Exceptions

**Exception chaining:**

```java
throw new FileUploadException("Upload Failed", e);
```

| Relationship | Meaning |
| --- | --- |
| Main exception → **cause** | The original reason |
| Main exception → **suppressed** | A cleanup failure |

## Common Mistakes

### Ignoring Suppressed Exceptions

**Wrong:**

```java
catch (Exception e) {
    e.getMessage();
}
```

**Better:**

```java
catch (Exception e) {
    e.printStackTrace();
    for (Throwable t : e.getSuppressed()) {
        logger.error(t.getMessage());
    }
}
```

### Throwing from finally

**Wrong:**

```java
finally {
    throw new RuntimeException();
}
```

Prefer try-with-resources, which preserves both exceptions automatically.

## Enterprise Perspective

In enterprise applications, suppressed exceptions are commonly seen with JDBC, file I/O, Apache POI, ZIP processing, network sockets, HTTP clients and cloud SDKs.

Most frameworks rely on try-with-resources, so suppressed exceptions are handled automatically. Developers should still know how to **inspect them when debugging production issues**.

## Interview Questions

### Q1. What is a suppressed exception?

An exception thrown while closing a resource that is attached to the primary exception instead of replacing it.

### Q2. Why were suppressed exceptions introduced?

To preserve the original exception and avoid losing cleanup failures when using try-with-resources.

### Q3. Which Java version introduced suppressed exceptions?

Java 7.

### Q4. Which methods are used?

`addSuppressed()` and `getSuppressed()`.

### Q5. Where are suppressed exceptions mainly used?

In try-with-resources.

### Q6. What is the difference between getCause() and getSuppressed()?

- `getCause()` returns the underlying reason for an exception.
- `getSuppressed()` returns exceptions that occurred during resource cleanup.

### Q7. Can one exception have multiple suppressed exceptions?

Yes. Each failed resource closure can contribute another suppressed exception.

### Q8. Does printStackTrace() display suppressed exceptions?

Yes. Modern JVMs include suppressed exceptions in the printed stack trace.

## Best Practices

- Always prefer try-with-resources over manual resource cleanup.
- Preserve the primary exception.
- Inspect suppressed exceptions while debugging resource-related failures.
- Use exception chaining (cause) for business failures and suppressed exceptions for cleanup failures.
- Do not replace the original exception with cleanup exceptions.

## Chapter Summary

- ✅ What suppressed exceptions are and why Java introduced them
- ✅ Primary vs suppressed exceptions
- ✅ try-with-resources behaviour
- ✅ `addSuppressed()` and `getSuppressed()`
- ✅ Resource closing flow and multiple resources
- ✅ Difference between suppressed exceptions and causes
- ✅ Enterprise usage
