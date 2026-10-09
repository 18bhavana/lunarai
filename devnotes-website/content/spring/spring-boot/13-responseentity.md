---
title: ResponseEntity
subtitle: Professional REST API responses — controlling status, headers and body, 200/201/204/400/404/500, Location headers, cookies, file downloads, response wrappers and ResponseEntity vs @ResponseStatus.
order: 13
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

If there is one class that separates beginner Spring developers from experienced backend developers, it is **`ResponseEntity`** — almost every enterprise Spring Boot project uses it.

Interviewers frequently ask: What is `ResponseEntity`? Why not return an object directly? When should we return `200`, `201`, `204`, `400`, `404` or `500`? How do we return custom headers or file downloads? What's the difference between `@ResponseStatus` and `ResponseEntity`?

> [!NOTE]
> `ResponseEntity` is a **class**, not an annotation — but it's central to every REST controller, so it gets its own chapter.

## What is ResponseEntity?

`ResponseEntity` represents the **entire HTTP response**. Unlike returning just an object, it lets you control:

```tree ResponseEntity manages all three
HTTP response
  Status code
  Headers
  Body
```

## Why Do We Need ResponseEntity?

Without it:

```java
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    return service.findById(id);
}
```

Spring returns:

```text
HTTP/1.1 200 OK
Content-Type: application/json

{"id":1,"name":"Rahul"}
```

You can't easily change the status code or add headers. With `ResponseEntity`:

```java
@GetMapping("/{id}")
public ResponseEntity<User> getUser(@PathVariable Long id) {
    User user = service.findById(id);
    return ResponseEntity.ok(user);
}
```

Now you have complete control.

## Anatomy of ResponseEntity

`ResponseEntity<User>` = **status + headers + body (`User`)**.

```flow-h
Client
DispatcherServlet
Controller
ResponseEntity — status + headers + body
HttpMessageConverter
HTTP response
```

## Common Status Codes

### 200 OK

The most common response:

```java
@GetMapping("/{id}")
public ResponseEntity<User> getUser(@PathVariable Long id) {
    User user = service.findById(id);
    return ResponseEntity.ok(user);
}
```

```text
HTTP/1.1 200 OK
Content-Type: application/json

{"id":1,"name":"Rahul"}
```

### 201 Created

Whenever a new resource is created:

```java
@PostMapping
public ResponseEntity<User> save(@RequestBody UserRequest dto) {
    User saved = service.save(dto);
    return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(saved);
}
```

**Better:** REST recommends returning the **location** of the newly created resource:

```java
@PostMapping
public ResponseEntity<User> save(@RequestBody UserRequest dto) {
    User saved = service.save(dto);

    URI location = URI.create("/users/" + saved.getId());

    return ResponseEntity
            .created(location)
            .body(saved);
}
```

```text
HTTP/1.1 201 Created
Location: /users/101
```

> [!TIP]
> To build an absolute URL from the current request: `ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(saved.getId()).toUri()`.

### 204 No Content

Useful after DELETE:

```java
@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(@PathVariable Long id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
}
```

```text
HTTP/1.1 204 No Content
```

No body.

### 404 Not Found

```java
@GetMapping("/{id}")
public ResponseEntity<User> get(@PathVariable Long id) {
    User user = service.find(id);

    if (user == null) {
        return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(user);
}
```

Different responses based on business logic. (With an `Optional`, `ResponseEntity.of(optionalUser)` does the same in one line.)

### 400 Bad Request

```java
@PostMapping
public ResponseEntity<String> save(@RequestBody UserRequest dto) {

    if (dto.getAge() < 18) {
        return ResponseEntity
                .badRequest()
                .body("Age must be at least 18");
    }
    return ResponseEntity.ok("Saved");
}
```

### 500 Internal Server Error

```java
catch (Exception ex) {
    return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body("Unexpected Error");
}
```

In enterprise applications this is usually handled **globally** using `@ControllerAdvice` rather than in each controller.

## Builder Methods

| Builder | HTTP status |
| --- | --- |
| `ok()` | 200 |
| `created(uri)` | 201 |
| `accepted()` | 202 |
| `noContent()` | 204 |
| `badRequest()` | 400 |
| `notFound()` | 404 |
| `unprocessableEntity()` | 422 |
| `internalServerError()` | 500 (Spring 5.3.8+) |
| `status(...)` | Any status |

These make code much cleaner.

## Custom Headers

```java
@GetMapping
public ResponseEntity<String> hello() {
    return ResponseEntity
            .ok()
            .header("Application", "Ticket-System")
            .header("Version", "1.0")
            .body("Hello");
}
```

```text
HTTP/1.1 200 OK
Application: Ticket-System
Version: 1.0
```

## Cookies

Cookies are sent through headers:

```java
ResponseCookie cookie = ResponseCookie.from("token", "abc123")
        .httpOnly(true)
        .build();

return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body("Logged In");
```

## Files, Images and Bytes

### File Download

```java
@GetMapping("/download")
public ResponseEntity<Resource> download() {
    Resource file = ...;

    return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=report.pdf")
            .body(file);
}
```

The browser downloads `report.pdf`.

### Image

```java
@GetMapping("/logo")
public ResponseEntity<Resource> image() {
    return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_PNG)
            .body(resource);
}
```

### Byte Array

```java
@GetMapping("/pdf")
public ResponseEntity<byte[]> pdf() {
    byte[] data = service.generatePdf();

    return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .body(data);
}
```

### Empty Body

```java
return ResponseEntity.ok().build();   // 200 OK, no body
```

## Generic Response Wrapper

Enterprise applications often return a common response structure:

```java
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;
}

@GetMapping("/{id}")
public ResponseEntity<ApiResponse<User>> get() {
}
```

```json
{
  "success": true,
  "message": "User Found",
  "data": {
    "id": 1,
    "name": "Rahul"
  }
}
```

Useful for maintaining a consistent API contract.

## ResponseEntity vs Returning an Object

| Returning an object (`public User get()`) | Returning `ResponseEntity<User>` |
| --- | --- |
| Spring decides status and headers — mostly defaults | **You** decide status, headers and body |
| | Complete control |

## ResponseEntity vs @ResponseStatus

```java
// @ResponseStatus — the status is fixed and can't change dynamically
@ResponseStatus(HttpStatus.CREATED)
@PostMapping
public User save() {
}

// ResponseEntity — dynamic; preferred in enterprise APIs
if (success) {
    return ResponseEntity.ok(user);
}
return ResponseEntity.badRequest().build();
```

## Enterprise Architecture

```flow
React — POST /employees
DispatcherServlet
Controller
ResponseEntity<EmployeeResponse> — headers, status, body
HttpMessageConverter
JSON → frontend
```

## Internal Spring Working

```flow When the controller returns ResponseEntity<User>
Controller
HttpEntityMethodProcessor
Status code + headers
HttpMessageConverter → Jackson
JSON
HTTP response
```

The important internal class is **`HttpEntityMethodProcessor`** — it processes `ResponseEntity` and `HttpEntity`. An interview favourite.

## Common Mistakes

### Returning 200 After Creation

```java
return ResponseEntity.ok(saved);                                // ❌
return ResponseEntity.status(HttpStatus.CREATED).body(saved);   // ✅
return ResponseEntity.created(location).body(saved);            // ✅
```

### Returning Entities Directly

`ResponseEntity<User>` → better `ResponseEntity<UserResponse>`. Return DTOs instead of JPA entities.

### Catching Every Exception in Controllers

```java
try {
    ...
} catch (Exception e) {
    return ResponseEntity.status(500).build();   // ❌
}
```

Prefer a global exception handler with `@ControllerAdvice`.

### Returning String Errors Everywhere

```java
return ResponseEntity.badRequest().body("Error");   // ❌
```

Better — a structured error response:

```json
{
  "timestamp": "...",
  "status": 400,
  "message": "Validation Failed"
}
```

## Best Practices

- ✅ Return DTOs, not entities.
- ✅ Use appropriate HTTP status codes.
- ✅ Include a `Location` header for newly created resources.
- ✅ Use `204 No Content` when there is no response body.
- ✅ Keep success and error responses consistent.
- ✅ Handle exceptions globally with `@ControllerAdvice`.

## Interview Questions

### Q1. What is ResponseEntity?

It represents the complete HTTP response, including the status code, headers and body.

### Q2. Why use ResponseEntity instead of returning an object?

Because it allows full control over the HTTP status, headers and response body.

### Q3. What status code should be returned after creating a resource?

`201 Created`, preferably with a `Location` header pointing to the new resource.

### Q4. What should DELETE return?

Usually `204 No Content`.

### Q5. What is the difference between ResponseEntity and @ResponseStatus?

| ResponseEntity | @ResponseStatus |
| --- | --- |
| Dynamic | Static |
| Can change per request | Fixed at compile time |
| Controls headers, status and body | Primarily sets the status |

### Q6. Which internal Spring class handles ResponseEntity?

`HttpEntityMethodProcessor`.

### Q7. Can ResponseEntity return files?

Yes — `Resource`, `byte[]`, streams, JSON, XML and plain text.

### Q8. Can we add custom headers?

Yes:

```java
ResponseEntity.ok()
        .header("Version", "1.0")
        .body(data);
```

## Key Takeaways

- ✅ `ResponseEntity` gives complete control over the HTTP response.
- ✅ Use it to customize status codes, headers and response bodies.
- ✅ Prefer `201 Created` (with a `Location` header) for resource creation.
- ✅ Use `204 No Content` for deletes with no body.
- ✅ `HttpEntityMethodProcessor` processes `ResponseEntity`.
- ✅ Prefer `ResponseEntity` over `@ResponseStatus` when the status depends on runtime logic.
- ✅ Return DTOs and structured error responses for enterprise-grade APIs.
