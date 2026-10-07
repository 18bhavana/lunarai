---
title: Best Practices & Anti-Patterns
subtitle: Production-ready exception handling — what to catch, where to log, translation, fail-fast, performance and the senior developer checklist.
order: 11
---

## Introduction

Knowing Java exception syntax is only half the story. Senior developers are expected to know:

- **Where** to handle exceptions
- **When** to propagate exceptions
- **How** to log exceptions
- How to design meaningful exceptions
- What **not** to do

Most interview questions for experienced developers are based on **best practices, not syntax**.

## Best Practices 1–5: Catching and Wrapping

### 1. Catch the most specific exception

❌ **Bad:**

```java
try {
    readFile();
} catch (Exception e) {
    logger.error("Error", e);
}
```

Why? It hides the real problem, makes recovery difficult, and can accidentally catch unrelated exceptions.

✅ **Good:**

```java
try {
    readFile();
} catch (IOException e) {
    logger.error("Unable to read file", e);
}
```

**Rule:** specific exception first → general exception last.

### 2. Never swallow exceptions

❌ **Bad:**

```java
try {
    saveUser();
} catch (Exception e) {
}
```

The exception disappears completely: no logs, no debugging information, silent failures.

✅ **Good** — log it, or propagate it:

```java
catch (Exception e) {
    logger.error("User save failed", e);
}
```

### 3. Don't catch what you can't handle

Suppose `repository.save(user);` throws a `SQLException`. Should the repository handle it? **Usually no.**

```flow-h Let higher layers decide how to respond
Repository
Service
ControllerAdvice
```

### 4. Preserve the original cause

❌ **Bad** — the root cause is lost:

```java
catch (IOException e) {
    throw new RuntimeException("Upload failed");
}
```

✅ **Good:**

```java
catch (IOException e) {
    throw new FileUploadException("Upload failed", e);
}
```

This preserves the original exception, stack trace and debugging information.

### 5. Use meaningful custom exceptions

```java
throw new RuntimeException("Error");                          // ❌ Bad
throw new UserNotFoundException("User ID 101 not found");     // ✅ Good
```

Meaningful exception names improve readability and API design.

## Best Practices 6–10: Flow, Resources and Logging

### 6. Never use exceptions for normal flow control

❌ **Bad:**

```java
try {
    Integer.parseInt(input);
} catch (NumberFormatException e) {
    return false;
}
```

Exceptions are expensive. If validation can be done before the operation, prefer that approach.

### 7. Use try-with-resources

❌ **Bad:**

```java
FileReader reader = new FileReader(file);
try {
    // Read
} finally {
    reader.close();
}
```

✅ **Good:**

```java
try (FileReader reader = new FileReader(file)) {
    // Read
}
```

Cleaner and safer.

### 8. Don't log and rethrow everywhere

❌ **Bad:**

```java
// Repository
catch (Exception e) {
    logger.error("Repository", e);
    throw e;
}

// Service
catch (Exception e) {
    logger.error("Service", e);
    throw e;
}

// Controller
catch (Exception e) {
    logger.error("Controller", e);
}
```

The **same exception is logged three times**.

✅ **Good** — log:

- Where the exception is **finally handled**, or
- Where you **add meaningful business context**.

### 9. Fail fast

Instead of allowing invalid data into `createUser(name);`:

```java
if (name == null) {
    throw new IllegalArgumentException("Name cannot be null");
}
```

Early validation simplifies debugging.

### 10. Use checked exceptions carefully

Use checked exceptions when **callers can recover** — e.g. `IOException`, `SQLException`, `InterruptedException`.

Do not create checked exceptions for every business rule. Modern Spring Boot applications typically use **unchecked exceptions for business validations**.

## Best Practices 11–16: Scope, Messages and Handling

### 11. Don't catch Throwable

```java
catch (Throwable t) {
}
```

This catches both `Exception` **and** `Error` — including `OutOfMemoryError` and `StackOverflowError`, which usually should not be handled by application code.

### 12. Don't catch Error

```java
catch (Error e) {
}
```

`Error` indicates serious JVM-level failures.

### 13. Throw the most appropriate exception

```java
throw new RuntimeException();                                  // ❌ Bad
throw new IllegalArgumentException();                          // ⚠️ Better
throw new InvalidOrderException("Order already shipped");      // ✅ Best
```

The more specific the exception, the easier it is to understand and handle.

### 14. Keep exception messages useful

```java
throw new RuntimeException("Error");                                              // ❌ Bad
throw new RuntimeException("Unable to upload invoice: file size exceeds 10 MB");  // ✅ Good
```

A good message should explain:

- What happened
- Which resource or entity was involved (when appropriate)
- Enough context for troubleshooting **without exposing sensitive information**

### 15. Clean up resources properly

Always release files, streams, JDBC connections, `PreparedStatement`s, `ResultSet`s, locks and sockets. Prefer **try-with-resources**.

### 16. Use global exception handling

In Spring Boot, use **`@ControllerAdvice`** instead of a `try { } catch { }` in every controller. This keeps controllers focused on business logic.

## Anti-Patterns

| # | Anti-pattern | Why it's bad / what to do |
| --- | --- | --- |
| 1 | Empty catch block — `catch (Exception e) { }` | Never do this |
| 2 | `throws Exception` everywhere | Declare specific checked exceptions whenever possible |
| 3 | `throw new Exception();` | Prefer `IllegalArgumentException`, `IllegalStateException`, `IOException` or domain-specific exceptions |
| 4 | Returning from `finally` — `finally { return 100; }` | Hides exceptions and previous return values. Avoid completely |
| 5 | Losing the cause — `throw new RuntimeException("Failed");` | Use `throw new RuntimeException("Failed", e);` |
| 6 | Business logic in `finally` — `finally { updateBalance(); }` | `finally` should be reserved for cleanup |
| 7 | Using exceptions for validation | Validate expected user input before performing operations; exceptions represent **exceptional** conditions |

## Performance Considerations

Creating an exception is **expensive** because it captures the current stack trace:

```java
new Exception();
```

The JVM records every active stack frame, which makes exceptions much slower than simple conditional checks. Therefore:

- Do not use exceptions inside loops for normal processing.
- Do not use exceptions for expected control flow.

## Logging Best Practices

❌ **Bad** — only the message is logged:

```java
logger.error(e.getMessage());
```

✅ **Good:**

```java
logger.error("File upload failed", e);
```

Now you get the **message, stack trace, root cause and suppressed exceptions** (if any).

## Exception Translation Pattern

Repository:

```java
throw new SQLException();
```

Service:

```java
catch (SQLException e) {
    throw new DatabaseException("Unable to save employee", e);
}
```

Controller: `@ControllerAdvice`. This keeps low-level implementation details away from higher layers.

### Enterprise Layering

```flow-h Recommended flow
Controller
Service
Repository
Database
```

| Layer | Responsibility |
| --- | --- |
| Repository | Throw persistence exceptions |
| Service | Translate or wrap exceptions; apply business rules |
| Controller | Let global exception handling generate the HTTP response |

## Interview Questions

### Q1. Should we catch Exception everywhere?

No. Catch the most specific exception you can meaningfully handle.

### Q2. Should we catch Throwable?

No. It also catches `Error`, which applications generally should not recover from.

### Q3. Why should we preserve the original cause?

To retain the root cause and complete stack trace for debugging.

### Q4. Where should exceptions be logged?

Usually where they are finally handled or where meaningful context is added. Avoid duplicate logging across multiple layers.

### Q5. Why shouldn't exceptions be used for flow control?

Creating exceptions is relatively expensive because the JVM captures stack traces. Normal program flow should use conditional logic.

### Q6. Why is try-with-resources preferred?

It automatically closes resources, reduces boilerplate, and prevents resource leaks.

### Q7. What is exception translation?

Converting low-level exceptions (such as `SQLException`) into business-specific exceptions (such as `DatabaseException`) while preserving the original cause.

### Q8. What is the Fail-Fast principle?

Detect invalid conditions as early as possible and stop execution with a meaningful exception rather than allowing bad state to spread through the application.

## Senior Developer Checklist

Before writing a `catch` block, ask yourself:

- Can I actually recover from this exception?
- Am I catching the most specific exception?
- Should I propagate instead?
- Am I preserving the original cause?
- Am I logging this exception only once?
- Would a custom exception improve clarity?
- Is this truly an exceptional situation?

If you answer these questions consistently, your exception handling will be cleaner and more maintainable.

## Chapter Summary

- ✅ Production-ready exception handling practices
- ✅ Common anti-patterns
- ✅ Logging best practices
- ✅ Exception translation
- ✅ Fail-Fast principle
- ✅ Resource management
- ✅ Performance considerations
- ✅ Enterprise layering and Spring Boot recommendations
