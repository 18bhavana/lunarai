---
title: "@ControllerAdvice and @ExceptionHandler"
subtitle: Global exception handling — custom exceptions, structured error responses, ProblemDetail, validation errors, @RestControllerAdvice, ResponseEntityExceptionHandler and resolution order.
order: 14
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

One of the most important Spring Boot topics for experienced Java developers — **every enterprise Spring Boot application has a global exception handler**.

Interviewers frequently ask: What is `@ControllerAdvice`? Why do we need global exception handling? What is `@ExceptionHandler`? What's the difference between `@ControllerAdvice` and `@RestControllerAdvice`? What happens if an exception isn't handled? How do we return custom error responses? How are validation errors handled? What is `ResponseEntityExceptionHandler`? What is `ProblemDetail` in Spring Boot 3?

## Why Do We Need Exception Handling?

```java
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    return service.findById(id);
}

public User findById(Long id) {
    throw new RuntimeException("Database Down");
}
```

Without exception handling:

```flow-h
Client
Controller
Service
Exception
Spring Boot default error handling
500 Internal Server Error
```

The client receives `HTTP/1.1 500 Internal Server Error` with a generic body (Spring Boot's default `/error` response), or sometimes a stack trace, depending on configuration. This isn't user-friendly.

### The Enterprise Requirement

Instead of a bare 500, we want:

```json
{
  "timestamp": "2026-07-25T10:20:30",
  "status": 500,
  "error": "Internal Server Error",
  "message": "Database temporarily unavailable",
  "path": "/users/10"
}
```

This is where `@ControllerAdvice` helps.

## What is @ControllerAdvice?

`@ControllerAdvice` is a **global exception handling component**. It watches all controllers: whenever any controller throws an exception, Spring sends the exception here.

```tree One place handles exceptions for the entire application
@ControllerAdvice
  Controller 1
  Controller 2
  Controller 3
```

### Basic Example

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handle(Exception ex) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Something went wrong");
    }
}
```

Now every unhandled exception reaches this method.

```flow
Client
DispatcherServlet
Controller
Service
Exception
@ControllerAdvice
@ExceptionHandler
ResponseEntity
JSON response
```

## What is @ExceptionHandler?

`@ExceptionHandler` tells Spring: *if this exception occurs, call this method.*

```java
@ExceptionHandler(RuntimeException.class)
public ResponseEntity<String> handle(RuntimeException ex) {
    return ResponseEntity
            .badRequest()
            .body(ex.getMessage());
}
```

Whenever `throw new RuntimeException("Invalid User")` occurs, this method executes.

### Specific Exception Handling

```java
@ExceptionHandler(UserNotFoundException.class)
public ResponseEntity<String> userNotFound(UserNotFoundException ex) {
    return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(ex.getMessage());
}
```

For `GET /users/100`, if the service throws `new UserNotFoundException("User Not Found")`, the response is **`404 Not Found`** with body `User Not Found`.

### Multiple Exception Handlers

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<?> handleUser() {}

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<?> validation() {}

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> generic() {}
}
```

Spring chooses the **most specific matching handler**: `UserNotFoundException` → `RuntimeException` → `Exception`.

## Custom Exceptions

```java
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(String message) {
        super(message);
    }
}
```

```java
public User get(Long id) {
    return repository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User Not Found"));
}
```

Much better than `throw new RuntimeException()`.

```flow Real enterprise flow
React — GET /users/100
Controller
Service
Repository — user missing
Throw UserNotFoundException
@ControllerAdvice
404 JSON response → frontend
```

## Structured Error Responses

Instead of the string `"User Not Found"`, enterprise APIs return an error object:

```java
public class ErrorResponse {
    private LocalDateTime timestamp;
    private Integer status;
    private String error;
    private String message;
    private String path;
}
```

```java
@ExceptionHandler(UserNotFoundException.class)
public ResponseEntity<ErrorResponse> handle(UserNotFoundException ex) {

    ErrorResponse response = new ErrorResponse();
    response.setStatus(404);
    response.setMessage(ex.getMessage());

    return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(response);
}
```

## Spring Boot 3 — ProblemDetail

Spring Framework 6 / Spring Boot 3 introduced **`ProblemDetail`**:

```java
@ExceptionHandler(UserNotFoundException.class)
public ProblemDetail handle(UserNotFoundException ex) {

    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
    problem.setTitle("User Error");
    problem.setDetail(ex.getMessage());

    return problem;
}
```

```json
{
  "type": "about:blank",
  "title": "User Error",
  "status": 404,
  "detail": "User Not Found"
}
```

This follows the standard format for HTTP API errors — originally **RFC 7807**, now superseded by **RFC 9457** (same format). Setting `spring.mvc.problemdetails.enabled=true` makes Spring's own MVC exceptions use it too.

## Validation Exceptions

```java
@PostMapping
public User save(@Valid @RequestBody UserRequest dto) {
}

// DTO
@NotBlank
private String name;
```

A request with `{"name": ""}` fails validation **before reaching your business logic**, and Spring throws **`MethodArgumentNotValidException`**. Handle it:

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
    List<String> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
    return ResponseEntity.badRequest().body(Map.of("status", 400, "errors", errors));
}
```

```json
{
  "status": 400,
  "errors": [
    "Name is required",
    "Age must be greater than 18"
  ]
}
```

Much more useful than a generic error.

## @ControllerAdvice vs @RestControllerAdvice

A favourite interview question.

- **`@ControllerAdvice`** — used with MVC or REST. If you return an object, add `@ResponseBody` or return a `ResponseEntity`.
- **`@RestControllerAdvice`** — equivalent to **`@ControllerAdvice` + `@ResponseBody`**. Return values are automatically serialized into JSON. **Preferred for REST APIs.**

## ResponseEntityExceptionHandler

Spring provides **`ResponseEntityExceptionHandler`**, which already handles many common Spring MVC exceptions — missing parameters, unsupported media types, validation failures and type mismatches. You can extend it:

```java
@RestControllerAdvice
public class GlobalHandler extends ResponseEntityExceptionHandler {
}
```

…and override methods like `handleMethodArgumentNotValid(...)` to customize validation responses.

## Internal Working

```flow When an exception occurs
DispatcherServlet
Controller
Exception
ExceptionHandlerExceptionResolver
@ControllerAdvice
@ExceptionHandler
ResponseEntity
HttpMessageConverter
JSON
```

The important internal class is **`ExceptionHandlerExceptionResolver`** — an interview favourite.

## Exception Resolution Order

```flow The nearest matching handler wins
Local @ExceptionHandler (in the same controller)
@ControllerAdvice
Default Spring resolvers
Container / Spring Boot error page
```

### Local Exception Handler

```java
@RestController
public class UserController {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<?> handle() {
    }
}
```

Only handles exceptions from **this** controller.

### Global Exception Handler

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
}
```

Handles **every** controller. Preferred.

## Logging Exceptions

Enterprise applications should always log exceptions:

```java
private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

@ExceptionHandler(Exception.class)
public ResponseEntity<?> handle(Exception ex) {
    logger.error("Unexpected exception", ex);
    return ResponseEntity.internalServerError().build();
}
```

Avoid exposing stack traces to clients.

## Common Mistakes

- ❌ **Catching `Exception` in every controller** with `try { ... } catch (Exception e) { ... }` — use `@ControllerAdvice` instead.
- ❌ **Returning stack traces** (`{"stackTrace": "..."}`) — never expose internal details.
- ❌ **Throwing plain `RuntimeException("Not Found")`** — throw meaningful custom exceptions like `UserNotFoundException`.
- ❌ **Returning different error formats** — keep one consistent error structure across all APIs.

## Enterprise Architecture

```flow
React
REST API
DispatcherServlet
Controller
Service
Repository
Exception
@RestControllerAdvice
ErrorResponse / ProblemDetail
JSON → frontend
```

## Interview Questions

### Q1. What is @ControllerAdvice?

A global component that provides cross-cutting functionality for controllers — most commonly centralized exception handling.

### Q2. What is @ExceptionHandler?

It marks a method that handles one or more specific exception types.

### Q3. What is the difference between @ControllerAdvice and @RestControllerAdvice?

| @ControllerAdvice | @RestControllerAdvice |
| --- | --- |
| MVC + REST | Mainly REST |
| May require `@ResponseBody` | Includes `@ResponseBody` automatically |

### Q4. Which internal Spring class invokes @ExceptionHandler methods?

`ExceptionHandlerExceptionResolver`.

### Q5. What is ProblemDetail?

Spring Framework 6's representation of the standardized HTTP error response format (RFC 7807 / RFC 9457).

### Q6. Why create custom exceptions?

Clear business meaning, easier maintenance, specific HTTP status mapping and better readability.

### Q7. What exception is thrown when @Valid request body validation fails?

`MethodArgumentNotValidException`.

### Q8. Which class provides default Spring MVC exception handling?

`ResponseEntityExceptionHandler`.

### Q9. What is the order of exception resolution?

Local `@ExceptionHandler` → `@ControllerAdvice` → default Spring resolvers → container error response.

## Key Takeaways

- ✅ `@ControllerAdvice` centralizes exception handling across controllers.
- ✅ `@RestControllerAdvice` is preferred for REST APIs because it applies `@ResponseBody` automatically.
- ✅ `@ExceptionHandler` maps specific exception types to handler methods.
- ✅ `ExceptionHandlerExceptionResolver` locates and invokes exception handlers.
- ✅ Extend `ResponseEntityExceptionHandler` to customize common Spring MVC exceptions.
- ✅ Use `ProblemDetail` (Boot 3+) or a consistent custom error DTO.
- ✅ Log exceptions internally, but never expose stack traces to API consumers.
