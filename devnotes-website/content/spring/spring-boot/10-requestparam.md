---
title: "@RequestParam"
subtitle: Reading query-string parameters — type conversion, required vs optional, defaultValue, Optional, lists, arrays, maps, pagination and search APIs, validation and @RequestParam vs @PathVariable.
order: 10
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

`@RequestParam` is one of the most used annotations in REST APIs. Most developers know `@RequestParam Long id`. But interviewers ask: How does Spring read query parameters? What happens if a parameter is missing? How does Spring convert `String` to `Integer`/`Long`? Can it handle lists or `Optional` values? What's the difference from `@PathVariable`? Which internal class resolves `@RequestParam`?

## What is @RequestParam?

`@RequestParam` extracts values from the **query string** of an HTTP request.

For `GET /users?id=101`, the query string is `?id=101`; Spring extracts `101` and injects it into the method parameter.

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping
    public User getUser(@RequestParam Long id) {
        return service.findById(id);
    }
}
```

`GET /users?id=101` → `id = 101`.

### Request Lifecycle

```flow
Browser
Tomcat
DispatcherServlet
HandlerMapping — find controller method
Extract query parameter
Convert to Long
Call controller → Service → Repository → Database
JSON response
```

## How Does Spring Read Query Parameters?

```tree Spring separates the path from the query parameters
/users?id=101
  Path | /users
  Query string | id=101
```

## Internal Working

Conceptually:

```java
String value = request.getParameter("id");
Long id = Long.valueOf(value);
controller.get(id);
```

The actual conversion is performed through Spring's conversion infrastructure.

## Type Conversion

Spring automatically converts `"10"` → `10L`; `@RequestParam Integer page` with `page=5` → `Integer 5`. No manual parsing.

### Supported Types

```java
@RequestParam String name
@RequestParam Integer age
@RequestParam Long id
@RequestParam Double salary
@RequestParam Boolean active
@RequestParam UUID id
@RequestParam LocalDate date
@RequestParam Status status
```

## Multiple Parameters

```java
@GetMapping
public User get(@RequestParam Long id,
                @RequestParam Boolean active) {
}
```

`GET /users?id=10&active=true` → `id = 10`, `active = true`.

## Parameter Name Mapping

`@RequestParam String name` matches `?name=Rahul` because the names are the same. For a different name:

```java
// /users?username=Rahul
@GetMapping
public User get(@RequestParam("username") String name) {
}
```

Spring maps `username` → `name`.

## Required, Optional and Default Values

### Required by Default

`@RequestParam Long id` means **`required = true`**. For `GET /users`, Spring throws `MissingServletRequestParameterException` → **`400 Bad Request`**.

### required = false

```java
@GetMapping
public User get(@RequestParam(required = false) Long id) {
}
```

Now `/users` works and `id` becomes `null`.

### defaultValue

```java
@GetMapping
public List<User> users(@RequestParam(defaultValue = "0") Integer page,
                        @RequestParam(defaultValue = "10") Integer size) {
}
```

For `/users`, Spring assigns `page = 0` and `size = 10` automatically. (Setting `defaultValue` implicitly makes the parameter optional.)

### Optional

```java
@GetMapping
public User get(@RequestParam Optional<Long> id) {
    id.ifPresent(System.out::println);
}
```

This avoids explicit null checks.

## Collections and Maps

### List Parameters

```java
// /users?ids=1,2,3
@GetMapping
public List<User> users(@RequestParam List<Long> ids) {
}
```

Spring converts `"1,2,3"` → `List<Long>` `[1, 2, 3]`.

### Repeated Parameters

```java
// /users?id=1&id=2&id=3
@GetMapping
public List<User> users(@RequestParam List<Long> id) {
}
```

Spring binds `[1, 2, 3]`.

### Arrays

```java
// /users?ids=1,2,3
@GetMapping
public void users(@RequestParam Long[] ids) {
}
```

### Map

```java
// /users?name=Rahul&age=25
@GetMapping
public void get(@RequestParam Map<String, String> params) {
}
```

Result: `{name=Rahul, age=25}`. Useful for dynamic filters.

## Enterprise Examples

### Pagination

```java
// GET /employees?page=0&size=20&sort=name
@GetMapping
public List<Employee> employees(@RequestParam Integer page,
                                @RequestParam Integer size,
                                @RequestParam String sort) {
}
```

> [!TIP]
> With Spring Data you can accept a `Pageable pageable` parameter instead; Spring fills it from `page`, `size` and `sort` automatically.

### Search

```java
// GET /employees/search?department=IT&city=Bangalore
@GetMapping("/search")
public List<Employee> search(@RequestParam String department,
                             @RequestParam String city) {
}
```

## @RequestParam vs @PathVariable

One of the most frequently asked interview questions.

- `/users/100` → **`@PathVariable`** — a resource identifier.
- `/users?page=1&size=20` → **`@RequestParam`** — filtering, sorting, searching, pagination, optional inputs.

| Feature | @PathVariable | @RequestParam |
| --- | --- | --- |
| Source | URL path | Query string |
| Example | `/users/10` | `/users?id=10` |
| Used for | Resource ID | Filters and options |
| Optional | Usually no | Usually yes |
| REST style | Resource | Query |

### REST Best Practices

| Request | Meaning |
| --- | --- |
| ✅ `GET /users/100` | Get one user |
| ✅ `GET /users?page=0&size=20` | Get many users |
| ✅ `GET /users?department=IT` | Filter users |
| ❌ `GET /getUser?id=100` | Prefer resource-oriented URLs |

## Validation

```java
@GetMapping
public User get(@RequestParam @Min(1) Long id) {
}
```

`/users?id=-5` → validation fails → **`400 Bad Request`** (when Bean Validation is set up).

> [!NOTE]
> Since Spring Framework 6.1 (Boot 3.2), constraints on controller parameters are checked automatically and fail with `HandlerMethodValidationException` (400). On older versions you must put `@Validated` on the controller class, and the resulting `ConstraintViolationException` becomes a 500 unless you handle it.

## Internal Components

```flow For /users?id=100
DispatcherServlet
HandlerMapping
RequestParamMethodArgumentResolver
ConversionService
Long id
Controller
```

The important classes — **`RequestParamMethodArgumentResolver`** and **`ConversionService`** — are excellent interview topics.

## Common Mistakes

### Parsing Manually

```java
// ❌ Wrong
@RequestParam String id
Long.parseLong(id);

// ✅ Correct — let Spring convert it
@RequestParam Long id
```

### Using @PathVariable for Filtering

❌ `/users/IT` → ✅ `/users?department=IT`, because department is a **filter**, not the identity of a resource.

### Forgetting required = false

```java
@RequestParam Long page   // ❌ if page is optional, a missing value gives 400
```

Make it explicit: `@RequestParam(required = false) Long page` or `@RequestParam(defaultValue = "0") Long page`.

## Enterprise Example

```java
@RestController
@RequestMapping("/employees")
public class EmployeeController {

    @GetMapping
    public List<Employee> search(
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(defaultValue = "name") String sort) {

        return service.search(department, page, size, sort);
    }
}
```

All of these map to the same method:

```text
GET /employees?page=1&size=10
GET /employees?department=IT
GET /employees?department=IT&page=0&size=50
```

## Interview Questions

### Q1. What is @RequestParam?

It binds a query-string parameter from an HTTP request to a controller method parameter.

### Q2. Is @RequestParam required by default?

Yes — `required = true`. If the parameter is missing, Spring returns `400 Bad Request`.

### Q3. How do you make a request parameter optional?

`@RequestParam(required = false)`, `@RequestParam(defaultValue = "0")`, or `@RequestParam Optional<Integer> page`.

### Q4. Can @RequestParam bind a List?

Yes — both `/users?ids=1,2,3` and `/users?id=1&id=2&id=3` can be bound to a `List<Long>`.

### Q5. What is the difference between @RequestParam and @PathVariable?

- `@PathVariable` identifies a resource.
- `@RequestParam` supplies additional request options such as filters, sorting, pagination or search criteria.

### Q6. Which internal Spring class resolves @RequestParam?

`RequestParamMethodArgumentResolver`.

### Q7. Who converts the query parameter into Java types?

Spring's `ConversionService`.

## Key Takeaways

- ✅ `@RequestParam` reads values from the query string.
- ✅ Spring converts query parameters into Java types using the `ConversionService`.
- ✅ Parameters are required by default.
- ✅ Use `defaultValue`, `required = false` or `Optional<T>` for optional inputs.
- ✅ Lists, arrays, maps, enums, UUIDs and many other types are supported.
- ✅ Use `@PathVariable` for resource identifiers and `@RequestParam` for filtering, sorting, pagination and search.
- ✅ `RequestParamMethodArgumentResolver` resolves request parameters.
