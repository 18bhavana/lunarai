---
title: "@RequestBody"
subtitle: JSON to Java object conversion — HttpMessageConverter, Jackson, serialization vs deserialization, DTOs, nested objects, missing/unknown fields, invalid JSON, @Valid and Content-Type.
order: 11
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

`@RequestBody` is one of the most important annotations in Spring Boot — almost every REST API that creates or updates data uses it.

```java
@PostMapping("/users")
public User save(@RequestBody User user) {
}
```

But interviewers ask: What does `@RequestBody` actually do? How does JSON become a Java object? Which Spring component reads the request body? What is `HttpMessageConverter`? How does Jackson work? What happens if the JSON is invalid? Why use DTOs instead of entities?

This chapter explains the complete journey: **JSON → Java object → database → JSON response**.

## What is @RequestBody?

`@RequestBody` tells Spring: *read the HTTP request body and convert it into a Java object.*

```text
POST /users
Content-Type: application/json
```

```json
{
  "name": "Rahul",
  "age": 25
}
```

```java
@PostMapping("/users")
public User save(@RequestBody User user) {
    return service.save(user);
}
```

Spring effectively creates:

```java
User user = new User();
user.setName("Rahul");
user.setAge(25);
```

…without you writing any parsing code.

## Why Do We Need @RequestBody?

Without Spring:

```java
BufferedReader reader = request.getReader();
String json = reader.readLine();
// then manually parse the JSON...
```

With Spring, `@RequestBody User user` — everything happens automatically.

## Complete Request Lifecycle

```flow This flow happens for every REST request containing JSON
Client — HTTP request
Tomcat
DispatcherServlet
HandlerMapping
@RequestBody
HttpMessageConverter
Jackson → Java object
Controller → Service → Repository → Database
Java object
Jackson → JSON
HTTP response
```

## Internal Working

Conceptually:

```java
InputStream input = request.getInputStream();

ObjectMapper mapper = new ObjectMapper();
User user = mapper.readValue(input, User.class);

controller.save(user);
```

In reality, Spring delegates this work to an **`HttpMessageConverter`**, which uses Jackson by default for JSON.

> [!QUESTION] Who reads the request body?
> An **`HttpMessageConverter`** — for JSON, `MappingJackson2HttpMessageConverter` (Jackson 2, Boot 3) or `JacksonJsonHttpMessageConverter` (Jackson 3, Boot 4). It converts JSON → Java object and Java object → JSON.

## What is Jackson?

The JSON library Spring Boot uses by default.

```java
public class User {
    private String name;
    private Integer age;
}
```

Jackson converts `{"name": "Rahul", "age": 25}` into this object automatically.

## Serialization vs Deserialization

**Interview favourite.**

| Term | Direction | Example |
| --- | --- | --- |
| **Serialization** | Java → JSON | `new User("Rahul", 25)` → `{"name":"Rahul","age":25}` |
| **Deserialization** | JSON → Java | `{"name":"Rahul","age":25}` → `User` |

## DTOs Instead of Entities

```java
public class UserRequest {
    private String name;
    private Integer age;
    // getters, setters
}

@PostMapping
public User save(@RequestBody UserRequest request) {
}
```

Spring creates `new UserRequest()` and fills its fields.

```java
// ❌ Binding the entity directly
@PostMapping
public User save(@RequestBody User user) {}

// ✅ Better
@PostMapping
public UserResponse save(@RequestBody UserRequest request) {}
```

```flow-h
Client
DTO
Service
Entity
Database
```

**Benefits:** hides database fields, prevents **over-posting** (clients setting fields like `role` or `id` they shouldn't), gives an independent API contract, easier validation and better security.

## Nested Objects and Collections

```json
{
  "name": "Rahul",
  "address": {
    "city": "Bangalore",
    "state": "Karnataka"
  }
}
```

```java
public class User {
    private String name;
    private Address address;
}

public class Address {
    private String city;
    private String state;
}
```

Jackson creates both `User` and `Address` automatically.

```json
{
  "name": "Rahul",
  "skills": ["Java", "Spring", "MySQL"],
  "orders": [ { "id": 1 }, { "id": 2 } ]
}
```

```java
private List<String> skills;
private List<Order> orders;
```

Jackson handles lists of values and lists of objects automatically.

## Missing Fields

```json
{
  "name": "Rahul"
}
```

With fields `name` and `age`, the result is `name = Rahul`, `age = null`. No exception is thrown simply because a field is absent (unless validation requires it).

## Unknown Fields

```json
{
  "name": "Rahul",
  "salary": 50000
}
```

Spring Boot configures Jackson to **ignore unknown properties** by default, so `salary` is ignored. With `FAIL_ON_UNKNOWN_PROPERTIES` enabled, Jackson throws an exception instead.

## Invalid JSON

```text
{
  "name": "Rahul"
  age: 25
```

Jackson can't parse it, and Spring returns **`400 Bad Request`** (`HttpMessageNotReadableException`).

## Validation with @Valid

```java
public class UserRequest {

    @NotBlank
    private String name;

    @Min(18)
    private Integer age;
}

@PostMapping
public User save(@Valid @RequestBody UserRequest request) {
}
```

A request with `{"name": "", "age": 15}` fails validation → **`400 Bad Request`** (`MethodArgumentNotValidException`). Bean Validation runs **after deserialization and before the controller method executes**.

## Content-Type

With `Content-Type: application/json`, Spring selects the Jackson converter. If the client sends `Content-Type: text/plain` to an endpoint that expects JSON, Spring returns **`415 Unsupported Media Type`**.

### Converter Selection

Spring selects the converter based on:

- The request `Content-Type`
- The Java method parameter type
- The available converters

`application/xml` works only if XML support (e.g. `jackson-dataformat-xml`) is configured.

## Response Body Flow

```java
@PostMapping
public User save(@RequestBody User user) {
    return user;
}
```

```flow-h Handled by the same converter infrastructure
Java object
Jackson
JSON
HTTP response
```

## Can We Read the Request Body Twice?

**No.** The HTTP request body is a **stream** — read once, then consumed. It can't normally be read again unless wrapped or cached (e.g. with `ContentCachingRequestWrapper` in a filter).

## Enterprise Flow

```flow RequestResponseBodyMethodProcessor coordinates reading the body and writing the response
React — POST /employees (JSON)
DispatcherServlet
RequestResponseBodyMethodProcessor
HttpMessageConverter → Jackson
EmployeeRequest DTO
Service → Entity → Repository → Database
Employee entity
EmployeeResponse DTO
Jackson → JSON
React
```

## Common Mistakes

### Using the Entity Directly

Use `@RequestBody UserRequest request` (a DTO) rather than the JPA entity.

### Forgetting @RequestBody

```java
@PostMapping
public User save(User user) {   // ❌
}
```

Without `@RequestBody`, Spring treats the parameter as a **form/query model** (`@ModelAttribute`) and does **not** read the JSON body — so the fields end up `null`. Correct: `@RequestBody User user`.

### Missing Getters/Setters or Constructors

Jackson relies on a no-arg constructor + setters, a suitable constructor, records or annotations. Without an appropriate way to create or populate the object, mapping may fail or produce incomplete objects.

### Invalid JSON

```text
{ "name":"Rahul" age:25 }      ← wrong
```

```json
{ "name": "Rahul", "age": 25 }
```

### Forgetting @Valid

Without `@Valid`, invalid input reaches your business logic unchecked.

## Internal Spring Components

```flow For POST /users
DispatcherServlet
HandlerMapping
RequestResponseBodyMethodProcessor
HttpMessageConverter
MappingJackson2HttpMessageConverter
Jackson ObjectMapper
Java object
Controller
```

Important classes: **`RequestResponseBodyMethodProcessor`**, **`HttpMessageConverter`**, **`MappingJackson2HttpMessageConverter`** and **`ObjectMapper`** — excellent interview topics.

## Interview Questions

### Q1. What is @RequestBody?

It tells Spring to read the HTTP request body and convert it into a Java object.

### Q2. Which component reads the request body?

An `HttpMessageConverter`. For JSON, Spring Boot typically uses `MappingJackson2HttpMessageConverter`.

### Q3. Which library converts JSON into Java objects?

Jackson (`ObjectMapper`).

### Q4. What is the difference between serialization and deserialization?

- Serialization: Java object → JSON.
- Deserialization: JSON → Java object.

### Q5. Why use DTOs instead of entities?

Better security, API contract isolation, easier validation, no exposure of internal database structure, and reduced coupling between persistence and API layers.

### Q6. What happens if the JSON is invalid?

Jackson throws a parsing exception, which Spring translates into `400 Bad Request` (typically `HttpMessageNotReadableException`).

### Q7. What happens if Content-Type is text/plain but the endpoint expects JSON?

Spring can't find a suitable converter for the request and returns `415 Unsupported Media Type`.

### Q8. Which Spring class processes @RequestBody?

`RequestResponseBodyMethodProcessor`. It delegates serialization and deserialization to the configured `HttpMessageConverter`.

## Key Takeaways

- ✅ `@RequestBody` binds the HTTP request body to a Java object.
- ✅ `RequestResponseBodyMethodProcessor` + `HttpMessageConverter` process request and response bodies.
- ✅ The Jackson converter and `ObjectMapper` handle JSON by default.
- ✅ Bean Validation (`@Valid`) runs after deserialization and before controller execution.
- ✅ Prefer DTOs over JPA entities in REST APIs.
- ✅ Invalid JSON → `400 Bad Request`; unsupported media type → `415 Unsupported Media Type`.
