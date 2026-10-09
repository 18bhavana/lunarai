---
title: "@ResponseBody"
subtitle: Writing return values straight into the HTTP response — RequestResponseBodyMethodProcessor, message converters, return types, files and bytes, content negotiation and @ResponseBody vs @RestController.
order: 12
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

`@ResponseBody` is the annotation responsible for **converting Java objects into HTTP responses**. Almost every REST API uses it, either directly or indirectly through `@RestController`.

```java
@ResponseBody
@GetMapping("/users")
public User getUser() {
    return service.findById(1L);
}
```

But interviewers ask: What exactly does `@ResponseBody` do? How is it different from `@RestController`? Who converts Java objects into JSON? What happens if a method returns a `String`? Can it return files? Which Spring class processes it? What is content negotiation?

## What is @ResponseBody?

> [!IMPORTANT]
> `@ResponseBody` tells Spring: *don't treat the returned value as a view name — write it directly into the HTTP response body.*

### Without @ResponseBody

```java
@Controller
public class UserController {

    @GetMapping("/user")
    public String user() {
        return "home";
    }
}
```

```flow-h
Return value "home"
ViewResolver
home.jsp
```

### With @ResponseBody

```java
@Controller
public class UserController {

    @ResponseBody
    @GetMapping("/user")
    public String user() {
        return "Hello";
    }
}
```

Spring writes `Hello` directly to the response body.

## Why Was @ResponseBody Introduced?

Spring MVC was originally built for web applications: developers returned `"login"`, meaning `login.jsp`. When REST APIs became popular, developers wanted **Java object → JSON** instead of JSP pages. `@ResponseBody` solved that problem.

## Complete Response Lifecycle

```java
@GetMapping("/users")
@ResponseBody
public User get() {
    return service.findById(1L);
}
```

```flow
Controller returns Java object
@ResponseBody
RequestResponseBodyMethodProcessor
HttpMessageConverter
Jackson
JSON
HTTP response → client
```

## Internal Working

Conceptually Spring performs:

```java
User user = controller.get();

ObjectMapper mapper = new ObjectMapper();
String json = mapper.writeValueAsString(user);

response.getWriter().write(json);
```

In reality, Spring delegates serialization to an appropriate `HttpMessageConverter`.

> [!QUESTION] Who processes @ResponseBody?
> **`RequestResponseBodyMethodProcessor`** — it takes the controller's return value, finds an `HttpMessageConverter`, serializes the object and writes the HTTP response.

## HttpMessageConverter

Spring chooses a converter based on:

- The return type
- The `Content-Type` / `produces`
- The `Accept` header
- The available converters

The JSON converter is `MappingJackson2HttpMessageConverter` (Jackson 3 / Boot 4: `JacksonJsonHttpMessageConverter`). Its job: **Java object → JSON**.

### Java Object → JSON (Serialization)

```java
public class User {
    private Long id;
    private String name;
}

@GetMapping
@ResponseBody
public User get() {
    return new User(1L, "Rahul");
}
```

```json
{
  "id": 1,
  "name": "Rahul"
}
```

No manual conversion needed. Serialization means **Java object → JSON**, and Jackson performs it.

## Returning Different Types

### Collections

```java
@GetMapping
@ResponseBody
public List<User> users() {
    return List.of(new User(1L, "Rahul"), new User(2L, "Amit"));
}
```

```json
[
  { "id": 1, "name": "Rahul" },
  { "id": 2, "name": "Amit" }
]
```

### Map

```java
@GetMapping
@ResponseBody
public Map<String, Object> data() {
    return Map.of("status", "SUCCESS", "count", 10);
}
```

```json
{
  "status": "SUCCESS",
  "count": 10
}
```

### String

```java
@ResponseBody
@GetMapping("/hello")
public String hello() {
    return "Hello Spring";
}
```

Response: `Hello Spring`. When returning a plain `String`, Spring uses **`StringHttpMessageConverter`** instead of Jackson.

### Primitives and Wrappers

```java
@GetMapping
@ResponseBody
public Integer total() {
    return 100;      // response: 100
}

@GetMapping
@ResponseBody
public Boolean active() {
    return true;     // response: true
}
```

### ResponseEntity

```java
@GetMapping("/{id}")
public ResponseEntity<User> get(@PathVariable Long id) {
    User user = service.findById(id);
    return ResponseEntity.ok(user);
}
```

Status code, headers, body and cookies (via headers) are all controlled explicitly.

```java
@PostMapping
public ResponseEntity<User> save(@RequestBody UserRequest dto) {
    User saved = service.save(dto);
    return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(saved);
}
```

```text
HTTP/1.1 201 Created
Content-Type: application/json
```

### Files and Bytes

```java
@GetMapping("/download")
public ResponseEntity<Resource> file() {
}

@GetMapping("/image")
@ResponseBody
public byte[] image() {
}
```

Spring writes **binary data** into the HTTP response instead of JSON — useful for PDFs, images, Excel files and ZIP files.

### Void

```java
@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void delete(@PathVariable Long id) {
    service.delete(id);
}
```

Response: `204 No Content`, no body.

## Content Negotiation

**Interview favourite.** If the client sends `Accept: application/json`, Spring returns `{"id": 1}`. If XML support is configured and the client sends `Accept: application/xml`, Spring can choose an XML converter and return:

```text
<User>
  <id>1</id>
</User>
```

Spring decides the format based on the **`Accept` header**, the **available converters** and the **controller return type**. This is called **content negotiation**.

## @ResponseBody vs @RestController

One of the most common interview questions.

```java
// @ResponseBody — applied to a method (or a controller class)
@Controller
public class UserController {

    @ResponseBody
    @GetMapping
    public User get() {}
}

// @RestController — applies it to every handler method
@RestController
public class UserController {

    @GetMapping
    public User get() {}
}
```

**`@RestController` = `@Controller` + `@ResponseBody`** on every handler method.

## Common Mistakes

### Forgetting @ResponseBody in a @Controller

```java
@Controller
public class UserController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello";   // ❌ Spring looks for a view named "Hello" (e.g. Hello.jsp)
    }
}
```

### Returning Entities Everywhere

Better: Entity → DTO → `@ResponseBody` → JSON. Avoid exposing database entities directly.

### Returning toString() or Hand-Made JSON

```java
return user.toString();      // ❌
return "{\"id\":1}";         // ❌
return user;                 // ✅ let Jackson serialize the object
```

## Internal Spring Components

```flow When the controller returns a User
Controller
RequestResponseBodyMethodProcessor
HttpMessageConverter
MappingJackson2HttpMessageConverter
ObjectMapper
JSON
HTTP response
```

Important classes: `RequestResponseBodyMethodProcessor`, `HttpMessageConverter`, `MappingJackson2HttpMessageConverter`, `StringHttpMessageConverter` and `ObjectMapper`.

## Enterprise Architecture

```flow
React / Angular — HTTP request
DispatcherServlet
Controller
Service
Repository
Database
Entity → DTO
@ResponseBody → Jackson
JSON → frontend
```

## Interview Questions

### Q1. What is @ResponseBody?

It tells Spring to write the controller's return value directly into the HTTP response body instead of resolving it as a view.

### Q2. Which class processes @ResponseBody?

`RequestResponseBodyMethodProcessor`.

### Q3. Which class converts Java objects into JSON?

`MappingJackson2HttpMessageConverter`, using Jackson's `ObjectMapper`.

### Q4. What is the difference between @ResponseBody and @RestController?

- `@ResponseBody` applies response-body behaviour to a method (or controller class).
- `@RestController` combines `@Controller` and `@ResponseBody`, so all handler methods return response bodies by default.

### Q5. What happens if a controller returns a String without @ResponseBody?

Spring interprets the string as a view name (for example `home` → `home.jsp` or another configured view).

### Q6. What is content negotiation?

The mechanism by which Spring selects the best response representation (JSON, XML, …) based on the client's `Accept` header and the available message converters.

### Q7. Can @ResponseBody return files?

Yes. It can return binary data, `Resource` objects, byte arrays, streams or other supported types with an appropriate `HttpMessageConverter`.

### Q8. Which HttpMessageConverter handles String responses?

`StringHttpMessageConverter`.

### Q9. Which converter handles JSON responses?

`MappingJackson2HttpMessageConverter`.

## Key Takeaways

- ✅ `@ResponseBody` writes the return value directly to the HTTP response body.
- ✅ `RequestResponseBodyMethodProcessor` coordinates response processing.
- ✅ `HttpMessageConverter` serializes Java objects into the response format.
- ✅ The Jackson converter handles JSON; `StringHttpMessageConverter` handles plain strings.
- ✅ `@RestController` combines `@Controller` and `@ResponseBody`.
- ✅ `ResponseEntity` gives full control over status codes, headers and the body.
- ✅ Content negotiation lets Spring return JSON, XML or other formats based on the request.
