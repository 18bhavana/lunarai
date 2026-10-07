---
title: Exception Handling in Spring Boot
subtitle: @ExceptionHandler, @ControllerAdvice, custom error bodies, validation errors, ProblemDetail and mapping exceptions to HTTP status codes.
order: 12
---

## Why Does Spring Boot Have Special Exception Handling?

Imagine a REST API call: `GET /users/100`. If user 100 does not exist, should the application return `java.lang.NullPointerException`?

**No.** Clients expect something like:

```json
{
    "message": "User not found",
    "status": 404
}
```

Spring Boot provides **centralized exception handling** to achieve this.

## Default Spring Boot Behaviour

```java
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
    return service.findById(id);
}
```

If an exception occurs — `throw new RuntimeException("Database Down");` — Spring Boot returns:

```json
{
    "timestamp": "...",
    "status": 500,
    "error": "Internal Server Error",
    "path": "/users/1"
}
```

This default response is generic and usually **not ideal for production APIs**.

## Typical Layered Architecture

```flow
Request path
Client
Controller
Service
Repository
Database
---
Exception path
Repository
Service
Controller
@ControllerAdvice
HTTP response
```

## Custom Business Exceptions

### Creating a Custom Exception

```java
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(String message) {
        super(message);
    }
}
```

### Throwing Business Exceptions

Service:

```java
public User findById(Long id) {
    return repository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found"));
}
```

No `try-catch` required.

## Local Exception Handling

Spring allows a handler method inside a controller:

```java
@ExceptionHandler(UserNotFoundException.class)
public ResponseEntity<String> handle(UserNotFoundException ex) {
    return ResponseEntity
            .status(404)
            .body(ex.getMessage());
}
```

> [!NOTE]
> A handler declared inside a controller works **only within that same controller**.

## Global Exception Handling

The recommended approach:

```java
@ControllerAdvice
public class GlobalExceptionHandler {
}
```

This applies to **all controllers**. (`@RestControllerAdvice` is the same thing with `@ResponseBody` added, which is convenient for REST APIs.)

### Handling Custom Exceptions

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<String> handleUserException(UserNotFoundException ex) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ex.getMessage());
    }
}
```

Request `GET /users/10`:

```output Response — 404 NOT FOUND
User not found
```

The body is the plain-text message, because the handler returns a `String`. Return an error object (below) to get a JSON body.

### Handling Multiple Exceptions

```java
@ExceptionHandler({
        UserNotFoundException.class,
        OrderNotFoundException.class
})
```

Useful when multiple exceptions require the same response.

### Handling Generic Exceptions

```java
@ExceptionHandler(Exception.class)
public ResponseEntity<String> handle(Exception ex) {
    return ResponseEntity
            .status(500)
            .body("Something went wrong");
}
```

Acts as a **fallback** for unhandled exceptions.

## Returning Custom Error Objects

Instead of a plain `User not found` string, return a structured object:

```java
public class ApiError {
    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String message;
    private String path;
}
```

```json
{
    "timestamp": "2026-07-06T10:20:15",
    "status": 404,
    "error": "Not Found",
    "message": "User not found",
    "path": "/users/10"
}
```

This structure is much more useful for API consumers.

## Validation Exceptions

Request DTO:

```java
public class UserRequest {

    @NotBlank
    private String name;
}
```

Controller:

```java
@PostMapping
public User save(@Valid @RequestBody UserRequest request) {
    // ...
}
```

An invalid request automatically throws a validation exception (`MethodArgumentNotValidException`).

### Handling Validation Errors

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
    Map<String, String> errors = new HashMap<>();
    ex.getBindingResult().getFieldErrors()
            .forEach(err -> errors.put(err.getField(), err.getDefaultMessage()));
    return ResponseEntity.badRequest().body(errors);
}
```

```json
{
    "name": "must not be blank"
}
```

Many production systems return **field-wise validation errors** like this.

## Extending ResponseEntityExceptionHandler

Spring provides **`ResponseEntityExceptionHandler`**:

```java
@ControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
}
```

Useful for overriding Spring's default handling of its own MVC exceptions (validation, type mismatch, missing parameters, etc.).

## Problem Details (RFC 7807 / RFC 9457)

Spring Boot 3 supports **Problem Details**, a standardized error response format originally defined by **RFC 7807**.

```java
ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
problem.setTitle("User Not Found");
problem.setDetail("User ID 10 does not exist");
```

```json
{
    "type": "about:blank",
    "title": "User Not Found",
    "status": 404,
    "detail": "User ID 10 does not exist"
}
```

Advantages:

- Standardized
- Consistent
- Supported by modern clients and tools

> [!NOTE]
> RFC 7807 was superseded by **RFC 9457** in 2023. The format is the same; newer Spring versions reference RFC 9457. Spring Boot can also produce these responses for its own exceptions when `spring.mvc.problemdetails.enabled=true`.

## Mapping Exceptions to HTTP Status

| Exception | HTTP Status |
| --- | --- |
| `UserNotFoundException` | 404 |
| `InvalidRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `DuplicateEmailException` | 409 |
| `ValidationException` | 400 |
| `DatabaseException` | 500 |
| `RuntimeException` | 500 |

## Exception Translation

Repository:

```java
throw new SQLException();
```

Service:

```java
catch (SQLException e) {
    throw new DatabaseException("Database unavailable", e);
}
```

Controller: `@ControllerAdvice` → client receives **HTTP 500**. The client does not see database implementation details.

## Logging Strategy

| Layer | Logging |
| --- | --- |
| Repository | Don't log |
| Service | Log only if context is added |
| ControllerAdvice | Log the final exception |

Avoid logging the same exception in every layer.

## Don't Expose Internal Errors

❌ **Bad:**

```json
{
    "message": "NullPointerException at UserService.java:125"
}
```

✅ **Good:**

```json
{
    "message": "Unexpected server error. Please contact support."
}
```

Detailed stack traces should be written to **logs**, not returned to clients.

## Common Enterprise Exception Classes

```tree These exceptions typically extend RuntimeException
BusinessException
  UserNotFoundException
  InvalidCouponException
  PaymentFailedException
  DuplicateEmailException
  SeatUnavailableException
  BookingExpiredException
```

## Enterprise Exception Flow

```flow
Infrastructure failure
Database
SQLException
Repository → Service
DatabaseException
ControllerAdvice
HTTP 500
---
Business failure
User not found
UserNotFoundException
ControllerAdvice
HTTP 404
```

## Common Mistakes

- **Catching exceptions in every controller** — a `try { } catch (Exception e) { }` inside each `@GetMapping`. Use centralized exception handling instead.
- **Returning stack traces** — never expose package names, SQL queries, internal server paths, database details or class names to API consumers.
- **Returning HTTP 200 for errors** — e.g. `200 OK` with "User not found". Always return the appropriate HTTP status code.
- **Using generic `RuntimeException`** — prefer `throw new UserNotFoundException();` over `throw new RuntimeException();`.

## Enterprise Best Practices

- Use `@ControllerAdvice` for centralized exception handling.
- Use meaningful custom exceptions.
- Return consistent error response formats.
- Map exceptions to appropriate HTTP status codes.
- Preserve original causes.
- Log exceptions once.
- Do not expose internal implementation details.
- Use `ProblemDetail` in Spring Boot 3+ for standardized responses.

## Interview Questions

### Q1. Why use @ControllerAdvice?

To centralize exception handling across all controllers and avoid repetitive try-catch blocks.

### Q2. What does @ExceptionHandler do?

It maps specific exception types to handler methods that create appropriate HTTP responses.

### Q3. Why create custom exceptions instead of using RuntimeException?

Custom exceptions clearly communicate business intent, improve readability, and simplify error mapping.

### Q4. What should clients receive when an unexpected exception occurs?

A generic error response with an appropriate HTTP status (typically `500 Internal Server Error`) without exposing sensitive implementation details.

### Q5. Should services catch every exception?

No. They should catch exceptions only when they can recover, add meaningful context, or translate low-level exceptions.

### Q6. Why shouldn't stack traces be returned in API responses?

They may expose sensitive information such as package names, class names, SQL queries, or server internals.

### Q7. What is ProblemDetail?

A standardized error response object introduced in Spring Framework 6 / Spring Boot 3, following the Problem Details specification (RFC 7807, now RFC 9457).

### Q8. Which HTTP status code should be returned when a user is not found?

`404 Not Found`.

### Q9. A repository throws SQLException. How should it be handled?

```flow-h
Repository
SQLException
Service
DatabaseException
@ControllerAdvice
HTTP 500 response
```

Benefits: database details remain hidden, business layers work with meaningful exceptions, and clients receive consistent API responses.

## Chapter Summary

- ✅ Default Spring Boot exception handling
- ✅ `@ExceptionHandler` and `@ControllerAdvice`
- ✅ Global and validation exception handling
- ✅ Custom API error responses
- ✅ `ResponseEntityExceptionHandler`
- ✅ `ProblemDetail` (RFC 7807 / 9457)
- ✅ Exception translation and HTTP status mapping
- ✅ Logging strategy and enterprise best practices

### Exception Handling Course — Complete Syllabus

| Part | Chapters |
| --- | --- |
| Foundations | Fundamentals · Checked vs Unchecked · try-with-resources · Custom Exceptions · Exception Hierarchy · finally Block · Suppressed Exceptions |
| Advanced Java | throw vs throws · Propagation & Stack Unwinding · Overriding Rules · Best Practices & Anti-Patterns |
| Enterprise Spring Boot | Exception Handling in Spring Boot |
