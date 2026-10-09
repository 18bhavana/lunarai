---
title: "@RestController"
subtitle: The most-used Spring Boot annotation — @Controller + @ResponseBody, Jackson serialization, HttpMessageConverter, return types, content negotiation and DTOs.
order: 6
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

If you're a Java backend developer, this is probably the most frequently used annotation in Spring Boot — every REST API you build starts here. Understanding `@RestController` means understanding **how Spring Boot converts your Java objects into JSON and sends them back to the client**.

## What is @RestController?

`@RestController` is a specialized Spring annotation for creating **RESTful web services**. Unlike `@Controller`, it does **not** return a view (HTML/JSP/Thymeleaf). Instead, it returns **data** (usually JSON).

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return new User(id, "Rahul");
    }
}
```

`GET /users/1` returns:

```json
{
  "id": 1,
  "name": "Rahul"
}
```

## Why Was @RestController Introduced?

Before Spring 4, developers wrote:

```java
@Controller
public class UserController {

    @ResponseBody
    @GetMapping("/users")
    public User getUser() {
        return new User(1, "Rahul");
    }
}
```

Every REST method required `@ResponseBody`. Spring 4.0 simplified it — now we write `@RestController public class UserController {}`.

> [!IMPORTANT]
> **`@RestController` = `@Controller` + `@ResponseBody`.** One of the most common interview questions.

### Internal Definition

Conceptually:

```java
@Target(TYPE)
@Retention(RUNTIME)
@Controller
@ResponseBody
public @interface RestController {
}
```

So every method automatically behaves as if it has `@ResponseBody`.

## @Controller vs @RestController

| Feature | @Controller | @RestController |
| --- | --- | --- |
| Returns a view | ✓ | ✗ |
| Returns JSON | Only with `@ResponseBody` | ✓ |
| Used for | MVC applications | REST APIs |
| ViewResolver used | ✓ | ✗ |
| JSON conversion | Optional | Automatic |

### Example

```java
@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "home";   // Spring searches home.html or home.jsp
    }
}
```

```java
@RestController
public class UserController {

    @GetMapping("/")
    public String home() {
        return "Hello";   // the response body is literally: Hello
    }
}
```

No ViewResolver involved.

## Request Flow

For `GET /users/10`:

```flow Notice the new part at the end: User object → Jackson → JSON
Browser
Tomcat
DispatcherServlet
HandlerMapping
UserController
UserService
Repository
Database
User object
Jackson
JSON
HTTP response
```

Spring receives a `User`; the browser receives JSON. **Where did the JSON come from? Jackson.**

## Jackson — Serialization and Deserialization

Spring Boot includes **Jackson** by default (via `spring-boot-starter-web`).

```flow-h Serialization
Java object
: Jackson
JSON
```

```flow-h Deserialization
JSON
: Jackson
Java object
```

Jackson performs both automatically.

### Complete REST Flow

Client sends `POST /users` with body `{"name": "Rahul"}`:

```flow
Client
JSON
: Jackson (deserialize)
Java object
Controller → Service → Repository → Database
Entity / DTO
: Jackson (serialize)
JSON
Client
```

## @ResponseBody

```java
@Controller
public class TestController {

    @ResponseBody
    @GetMapping("/hello")
    public String hello() {
        return "Hello";
    }
}
```

- **Without `@ResponseBody`**, Spring thinks `Hello` is a **view name**.
- **With `@ResponseBody`**, Spring writes `Hello` **directly into the HTTP response body**.

`@RestController` applies this behaviour to all methods.

## HttpMessageConverter

Interviewers love this topic. The controller returns a `User` — **who converts it into JSON?** An **`HttpMessageConverter`**.

```flow
Controller returns User
RequestResponseBodyMethodProcessor
MappingJackson2HttpMessageConverter
Jackson
JSON
```

This converter is automatically registered by Spring Boot.

> [!NOTE]
> In Spring Framework 7 / Spring Boot 4 (Jackson 3), the default JSON converter is `JacksonJsonHttpMessageConverter`; `MappingJackson2HttpMessageConverter` is the Jackson 2 version used through Boot 3. Same idea either way. A plain `String` return value is written by `StringHttpMessageConverter` (as `text/plain`), not Jackson.

## Returning Different Types

| Return type | Response |
| --- | --- |
| `User` | JSON object `{ ... }` |
| `List<User>` | JSON array `[ {}, {}, {} ]` |
| `Map<String, Object>` | JSON object, e.g. `{"name": "Rahul", "age": 25}` |
| `String` | Plain text, e.g. `Hello` |
| `ResponseEntity<User>` | Full control over status, headers and body |

Professional APIs usually return `ResponseEntity`:

```java
@GetMapping("/{id}")
public ResponseEntity<User> get(@PathVariable Long id) {
    return ResponseEntity.ok(user);
    // or: return ResponseEntity.notFound().build();
}
```

This gives complete control over **status code, headers and body**. (`ResponseEntity` has its own chapter.)

## Content Negotiation

If the client sends `Accept: application/json`, Spring returns JSON. If it sends `Accept: application/xml` and XML converters are configured (e.g. `jackson-dataformat-xml`), Spring can return XML instead. This is called **content negotiation**.

```flow-h
Accept header
Spring
Choose converter
Return response
```

## REST APIs Are Stateless

Controllers should not store user-specific data — multiple users share the same controller instance.

```java
// ❌ Wrong
@RestController
public class UserController {

    private User currentUser;
}

// ✅ Correct — use method parameters and local variables
@GetMapping("/{id}")
public User get(@PathVariable Long id) {
}
```

## Common Mistakes

### Returning Entities Directly

Large projects usually return **DTOs** instead:

```flow-h This avoids exposing internal fields and lazy-loading issues
Entity
DTO
JSON
```

### Business Logic in the Controller

```java
@RestController
public class UserController {

    @PostMapping
    public void save() {
        calculateSalary();   // ❌
        calculateTax();      // ❌
        repository.save();   // ❌
    }
}
```

Correct: Controller → Service → Repository.

### Returning Sensitive Fields

```java
class User {
    private String password;
}
```

Returning this directly could expose passwords. Use DTOs, or annotations such as `@JsonIgnore` where appropriate.

## Real Enterprise Architecture

```flow This is the standard architecture in most enterprise Spring Boot applications
Angular / React
REST API
@RestController
@Service
@Repository
MySQL
JSON response
```

## Internal Working

```flow
When Spring starts
Component scan
@RestController found
Controller bean created (@ResponseBody enabled)
Request mappings registered
Ready
---
When a request arrives
DispatcherServlet
HandlerMapping
Controller method
Return object
HttpMessageConverter → Jackson
JSON HTTP response
```

## Interview Questions

### Q1. What is @RestController?

A stereotype annotation used to build REST APIs. It combines `@Controller` and `@ResponseBody`, so return values are written directly to the HTTP response body.

### Q2. What is the difference between @Controller and @RestController?

`@Controller` is typically used for MVC applications that return views, while `@RestController` is used for REST APIs that return data such as JSON or XML.

### Q3. What is @ResponseBody?

It tells Spring to write the return value directly into the HTTP response body instead of resolving it as a view.

### Q4. Who converts Java objects into JSON?

Spring delegates to an `HttpMessageConverter` — typically the Jackson converter (`MappingJackson2HttpMessageConverter`), which uses the Jackson library to serialize Java objects into JSON.

### Q5. What is serialization?

Converting a Java object into JSON.

### Q6. What is deserialization?

Converting JSON into a Java object.

### Q7. What is content negotiation?

Spring examines the client's `Accept` header and selects an appropriate `HttpMessageConverter` (for example JSON or XML) to generate the response.

### Q8. Why should controllers return DTOs instead of entities?

DTOs hide sensitive fields, decouple API contracts from persistence models, and avoid issues such as lazy-loading exceptions.

## Key Takeaways

- ✅ `@RestController` = `@Controller` + `@ResponseBody`.
- ✅ It's designed for REST APIs that return data instead of views.
- ✅ `DispatcherServlet` routes requests.
- ✅ `HttpMessageConverter` and Jackson handle JSON serialization and deserialization.
- ✅ REST controllers should remain stateless and delegate business logic to services.
- ✅ Returning DTOs is generally preferable to returning JPA entities directly.
