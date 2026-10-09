---
title: "@RequestMapping"
subtitle: The heart of URL routing — class and method mappings, RequestMappingHandlerMapping, HTTP methods, params, headers, consumes, produces, matching priority and ambiguous mappings.
order: 7
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

`@RequestMapping` is the heart of Spring MVC. Without it, Spring has no idea which controller method should run for an incoming request.

> [!QUESTION] How does Spring know that /users/10 should invoke getUser()?
> This chapter answers that from start to finish.

## What is @RequestMapping?

`@RequestMapping` maps an HTTP request to a controller or controller method.

```java
@RestController
@RequestMapping("/users")
public class UserController {
}
```

This tells Spring: *every request starting with `/users` belongs to this controller.*

### Basic Example

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @RequestMapping("/all")
    public List<User> getUsers() {
        return List.of();
    }
}
```

`GET /users/all` matches this method.

> [!WARNING]
> A `@RequestMapping` with no `method` attribute matches **every** HTTP method — GET, POST, DELETE, … Use `@GetMapping` etc. (or set `method`) to restrict it.

## Internal Working

When your application starts, Spring performs:

```flow-h
Component scan
Find @RestController
Find @RequestMapping
Register URL
Store mapping
Application ready
```

It creates an internal **routing table**:

| URL | Method |
| --- | --- |
| `/users/all` | `getUsers()` |
| `/users/{id}` | `getUser()` |
| `/orders` | `createOrder()` |

This table is maintained by **`RequestMappingHandlerMapping`**.

## Who Stores URL Mappings?

During startup Spring creates `RequestMappingHandlerMapping`. Its job:

```flow-h
Scan controllers
Read @RequestMapping
Build mapping table
Store in memory
```

When a request arrives:

```flow-h
DispatcherServlet
RequestMappingHandlerMapping
Find matching method
Return handler
```

### Request Lifecycle

```flow-h GET /users/10
Browser
Tomcat
DispatcherServlet
RequestMappingHandlerMapping
UserController.getUser()
Response
```

## Class-Level + Method-Level Mapping

A class-level mapping makes every method start with that prefix:

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @RequestMapping("/all")
    public List<User> all() {
        return List.of();
    }
}
```

```flow-h
Class mapping /users
: +
Method mapping /all
: =
/users/all
```

### Multiple Methods

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @RequestMapping("/all")
    public List<User> all() {}

    @RequestMapping("/active")
    public List<User> active() {}

    @RequestMapping("/blocked")
    public List<User> blocked() {}
}
```

| URL | Method |
| --- | --- |
| `/users/all` | `all()` |
| `/users/active` | `active()` |
| `/users/blocked` | `blocked()` |

## HTTP Methods

| Method | Purpose |
| --- | --- |
| `GET` | Read |
| `POST` | Create |
| `PUT` | Update |
| `DELETE` | Delete |
| `PATCH` | Partial update |

`GET /users` means *read users*.

### Specifying the HTTP Method

```java
@RequestMapping(value = "/users", method = RequestMethod.GET)
public List<User> users() {
}
```

Only GET requests can call this method.

```java
@RequestMapping(value = "/users", method = RequestMethod.POST)
public User create() {
}
```

`POST /users` matches; `GET /users` does not (Spring answers `405 Method Not Allowed` if nothing else matches).

## Why Use @GetMapping?

Instead of `@RequestMapping(method = RequestMethod.GET)`, Spring 4.3 introduced **shortcuts**: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping` and `@PatchMapping`.

```java
@GetMapping("/users")

// equals

@RequestMapping(value = "/users", method = RequestMethod.GET)
```

Same behaviour, cleaner syntax.

## path vs value

These are identical — `value` and `path` are aliases:

```java
@RequestMapping("/users")
@RequestMapping(value = "/users")
@RequestMapping(path = "/users")
```

## Multiple URLs

One method can serve multiple URLs:

```java
@GetMapping({"/users", "/employees", "/customers"})
public String test() {
}
```

Any of these URLs invokes the same method.

## Narrowing the Match

### params

```java
@GetMapping(value = "/users", params = "active=true")
public List<User> active() {
}
```

Matches `GET /users?active=true`; does **not** match `GET /users`.

### headers

```java
@GetMapping(value = "/users", headers = "X-Version=1")
```

Only requests containing the header `X-Version: 1` match. Useful for API versioning.

### consumes

Defines which **request** content type is accepted:

```java
@PostMapping(value = "/users", consumes = "application/json")
```

A request with `Content-Type: application/json` works; `text/plain` returns **`415 Unsupported Media Type`**.

### produces

Defines the **response** type:

```java
@GetMapping(value = "/users", produces = "application/json")
```

Spring returns `Content-Type: application/json`. If the client's `Accept` header can't accept it, Spring returns **`406 Not Acceptable`**.

### Complete Example

```java
@PostMapping(
        value = "/users",
        consumes = "application/json",
        produces = "application/json")
public User create(@RequestBody User user) {
    return user;
}
```

## URL Matching Priority

```java
@GetMapping("/users/{id}")
@GetMapping("/users/all")
```

For `GET /users/all`, Spring prefers **`/users/all`**, because exact (more specific) matches have higher priority than path-variable matches.

> [!TIP]
> Since Spring Framework 6 (Boot 3), **trailing-slash matching is off** by default: `/users/` no longer matches `@GetMapping("/users")`.

## Ambiguous Mapping

❌ Wrong:

```java
@GetMapping("/users")
public void get() {
}

@GetMapping("/users")
public void get2() {
}
```

**Application startup fails:**

```output
IllegalStateException: Ambiguous mapping. Cannot map 'userController' method ...
```

Spring doesn't know which method should run. Never define two methods with an identical path + HTTP method combination.

## Real Project Example

```java
@RestController
@RequestMapping("/employees")
public class EmployeeController {

    @GetMapping
    public List<Employee> all() {}

    @GetMapping("/{id}")
    public Employee get() {}

    @PostMapping
    public Employee save() {}

    @PutMapping("/{id}")
    public Employee update() {}

    @DeleteMapping("/{id}")
    public void delete() {}
}
```

| HTTP | URL | Action |
| --- | --- | --- |
| GET | `/employees` | Fetch all |
| GET | `/employees/10` | Fetch one |
| POST | `/employees` | Create |
| PUT | `/employees/10` | Update |
| DELETE | `/employees/10` | Delete |

## Internal Spring Flow

```flow
Application startup
@ComponentScan
@RestController
@RequestMapping
RequestMappingHandlerMapping
Mapping registry
---
Runtime
DispatcherServlet
RequestMappingHandlerMapping
Matching controller
HandlerAdapter
Method execution
JSON response
```

## Common Mistakes

- **Forgetting the class-level mapping.** `@GetMapping("/users")` on each method works, but for large projects a class-level `@RequestMapping("/users")` keeps URLs organized.
- **Using POST for reading.** `POST /users` to fetch data is wrong — use `GET /users`. Follow HTTP semantics.
- **Duplicate URLs.** Never define two methods with identical path and HTTP method.
- **Action-style URLs.** Prefer `/users/{id}` over inventing `/getUser`. REST APIs should model **resources, not actions**.

## Interview Questions

### Q1. What is @RequestMapping?

It maps HTTP requests to controller classes or methods based on URL, HTTP method, headers, parameters, content type and other matching conditions.

### Q2. Can @RequestMapping be used at both class and method level?

Yes. The class-level mapping defines a common base path, the method-level mapping defines the specific endpoint, and the final URL combines both.

### Q3. What is the difference between value and path?

None — they are aliases for each other.

### Q4. What is the difference between @RequestMapping and @GetMapping?

`@GetMapping` is a shortcut for `@RequestMapping(method = RequestMethod.GET)`. Similarly `@PostMapping`, `@PutMapping`, `@DeleteMapping` and `@PatchMapping` are shortcuts for their HTTP methods.

### Q5. Who stores request mappings in Spring?

`RequestMappingHandlerMapping` scans controller annotations during startup and stores the mappings in memory.

### Q6. What happens if two methods map to the same URL and HTTP method?

Spring throws an **ambiguous mapping** exception during startup because it can't determine which handler should process the request.

### Q7. What is the purpose of consumes and produces?

- `consumes` specifies which request `Content-Type` values a handler accepts (else `415`).
- `produces` specifies which response media types the handler can generate (else `406`).

## Key Takeaways

- ✅ `@RequestMapping` is the foundation of Spring MVC URL routing.
- ✅ `RequestMappingHandlerMapping` discovers and stores mappings during startup.
- ✅ Class-level and method-level mappings combine to form the final endpoint.
- ✅ `@GetMapping`, `@PostMapping`, … are shortcuts built on `@RequestMapping`.
- ✅ Use `consumes`, `produces`, `params` and `headers` for precise matching.
- ✅ Duplicate mappings cause startup failures.
