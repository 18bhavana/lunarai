---
title: Custom Exceptions
subtitle: Designing meaningful domain exceptions — checked vs unchecked, constructors, exception chaining and Spring Boot handling.
order: 4
---

## What is a Custom Exception?

A **custom exception** is a user-defined exception created by extending an existing Java exception class. Instead of throwing generic exceptions like:

```java
throw new RuntimeException("Something went wrong");
```

we create meaningful exceptions:

```java
throw new UserNotFoundException("User not found");
```

This makes code:

- More readable
- Easier to debug
- Easier to maintain
- Better for API clients
- Better for logging

## Why Do We Need Custom Exceptions?

Imagine an e-commerce application:

```java
public void placeOrder() {
}
```

Possible failures: user not found, product out of stock, payment failed, invalid coupon, address not found.

Using generic exceptions — `throw new RuntimeException("Error");` — is not helpful. Instead:

```java
throw new ProductOutOfStockException();
throw new PaymentFailedException();
throw new InvalidCouponException();
```

Now anyone reading the code immediately understands the problem.

### Real-World Example

**Bad design:**

```java
if (user == null) {
    throw new RuntimeException("Error");
}
```

**Good design:**

```java
if (user == null) {
    throw new UserNotFoundException("User ID 101 not found");
}
```

## Creating a Custom Checked Exception

A checked exception extends `Exception`.

```java
public class InvalidFileException extends Exception {

    public InvalidFileException(String message) {
        super(message);
    }
}
```

Usage:

```java
public void uploadFile() throws InvalidFileException {
    throw new InvalidFileException("Invalid File Format");
}
```

The compiler forces handling.

## Creating a Custom Unchecked Exception

Most enterprise applications use this approach.

```java
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(String message) {
        super(message);
    }
}
```

Usage:

```java
throw new UserNotFoundException("User not found");
```

No `throws` required.

## Checked vs Unchecked Custom Exceptions

| Checked | Unchecked |
| --- | --- |
| Extends `Exception` | Extends `RuntimeException` |
| Compiler checks | Compiler ignores |
| Must handle | Optional |
| Used for recoverable situations | Used for programming or business errors |

### Which One Should We Use?

**Checked exceptions** — reading files, database export/import, external APIs, recoverable failures:

```java
class InvalidFileException extends Exception {
}
```

**Unchecked exceptions** — invalid input, business validation, missing data, programming mistakes, entity not found:

```java
class UserNotFoundException extends RuntimeException {
}
```

## Constructor Variations

```java
public class UserException extends RuntimeException {

    // Default
    public UserException() {
    }

    // Message
    public UserException(String message) {
        super(message);
    }

    // Message + cause
    public UserException(String message, Throwable cause) {
        super(message, cause);
    }

    // Cause only
    public UserException(Throwable cause) {
        super(cause);
    }
}
```

## Exception Chaining

Suppose an `IOException` occurs. Instead of exposing it directly:

```java
catch (IOException e) {
    throw new RuntimeException(e);
}
```

create a meaningful exception:

```java
catch (IOException e) {
    throw new FileUploadException("Unable to upload file", e);
}
```

Now you have a **business exception** with the **original `IOException` preserved**. This is called **exception chaining**.

### Why Exception Chaining?

```flow Debugging becomes much easier
Without chaining
File Upload Failed
root cause lost
---
With chaining
FileUploadException
caused by IOException
caused by Disk Full
```

### Accessing the Cause

```java
try {
    // ...
} catch (UserException e) {
    Throwable cause = e.getCause();
}
```

## Designing Meaningful Exception Names

| Poor names | Good names |
| --- | --- |
| `MyException` | `UserNotFoundException` |
| `ApplicationException` | `OrderNotFoundException` |
| `ErrorException` | `PaymentFailedException` |
| `CustomException` | `InsufficientBalanceException` |
| | `InvalidCouponException` |
| | `DuplicateEmailException` |
| | `EmployeeAlreadyExistsException` |

> [!TIP]
> Always name exceptions after the **business problem**.

## Exception Hierarchy Design

```tree This makes exception handling easier
ApplicationException
  BusinessException
    UserNotFoundException
    ProductOutOfStockException
    PaymentFailedException
    CouponExpiredException
```

## Spring Boot Integration

### Throwing from a service

```java
public User getUser(Long id) {
    return repository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found"));
}
```

A very common interview question.

### Global Exception Handling

Spring Boot commonly handles custom exceptions centrally:

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<String> handle(UserNotFoundException ex) {
        return ResponseEntity
                .status(404)
                .body(ex.getMessage());
    }
}
```

```output Result
HTTP 404
User not found
```

### Multiple Custom Exceptions

`UserNotFoundException`, `ProductNotFoundException`, `OrderNotFoundException`, `PaymentFailedException`, `SeatUnavailableException`, `BookingExpiredException` — large applications often have dozens of domain-specific exceptions.

## Common Mistakes

- **Using `RuntimeException` everywhere** — instead of `throw new RuntimeException("Something failed")`, use `throw new PaymentFailedException("Payment gateway timeout")`.
- **Losing the original exception** — `throw new FileUploadException("Upload failed")` inside a catch drops the cause; use `throw new FileUploadException("Upload failed", e)`.
- **Very generic names** — prefer `CustomerAlreadyExistsException` over `ApplicationException`.

```java
// Wrong — cause is lost
catch (IOException e) {
    throw new FileUploadException("Upload failed");
}

// Correct — cause preserved
catch (IOException e) {
    throw new FileUploadException("Upload failed", e);
}
```

## Best Practices

- One exception per business scenario.
- Extend `RuntimeException` for business validation failures.
- Extend `Exception` for recoverable operations when callers are expected to handle them.
- Include meaningful messages.
- Preserve the original cause.
- Keep exception classes lightweight.
- Avoid placing business logic inside exception classes.

## Interview Questions

### Q1. What is a custom exception?

A user-defined exception created by extending `Exception` or `RuntimeException` to represent a specific business or application error.

### Q2. Why do we need custom exceptions?

They improve readability, debugging, logging and API design, and clearly communicate the reason for failure.

### Q3. Should custom exceptions extend Exception or RuntimeException?

It depends:

- Extend `Exception` for recoverable situations.
- Extend `RuntimeException` for business rules and programming errors.

### Q4. What is exception chaining?

Wrapping one exception inside another while preserving the original cause:

```java
throw new FileUploadException("Upload failed", e);
```

### Q5. Why should we preserve the cause?

To retain the original stack trace and root cause, making debugging much easier.

### Q6. Can a custom exception have multiple constructors?

Yes — typically default, message, cause, and message + cause.

### Q7. Why are custom exceptions commonly used in Spring Boot?

They work well with centralized exception handling (`@ControllerAdvice`), allowing business errors to be mapped to meaningful HTTP responses.

### Q8. Should exception classes contain business logic?

No. Exception classes should only represent error conditions and optionally store error-related information.

## Chapter Summary

- ✅ What custom exceptions are and why they are needed
- ✅ Checked vs unchecked custom exceptions
- ✅ Creating custom exception classes and constructors
- ✅ Exception chaining and preserving the original cause
- ✅ Exception hierarchy design
- ✅ Spring Boot integration
- ✅ Common mistakes and enterprise best practices
