---
title: "@PathVariable"
subtitle: Extracting values from the URL path — URL templates, ConversionService, UUID/enum/date types, multiple variables, name matching, failure cases and @PathVariable vs @RequestParam.
order: 9
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

One of the most frequently used annotations in Spring Boot. Most developers know how to write:

```java
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
}
```

But interviewers ask: How does Spring extract `id` from the URL? What happens if the value is not a number? How does Spring convert `String` to `Long`? Can we have multiple path variables? Can `UUID`, enums and `LocalDate` be used? What's the difference between `@PathVariable` and `@RequestParam`?

## What is @PathVariable?

`@PathVariable` **extracts values from the URL path** and binds them to method parameters.

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return service.findById(id);
    }
}
```

For `GET /users/101`, Spring extracts `101` and assigns it to `Long id`.

## How Does Spring Understand the URL?

Spring stores `/users/{id}` as a **URL template**. For an incoming `/users/101`:

```flow-h The placeholder is replaced with the actual value
/users/{id}
: matched against /users/101
id = 101
```

### Request Lifecycle

```flow-h
DispatcherServlet
HandlerMapping matches /users/{id}
Extract id = "101"
Convert to Long
Call controller method
Response
```

## Internal Working

Conceptually Spring does:

```java
String value = "101";
Long id = Long.valueOf(value);
controller.getUser(id);
```

Of course, Spring uses its **conversion infrastructure** rather than literally calling `Long.valueOf()`, but this illustrates the idea.

## Type Conversion

For `/users/25`, Spring converts `"25"` → `25L` automatically. No parsing required.

> [!QUESTION] What converts it?
> Spring's **ConversionService**.

```flow-h
String
ConversionService
Long
Method parameter
```

### Supported Types

```java
@PathVariable Integer id
@PathVariable Long id
@PathVariable UUID id
@PathVariable Double amount
@PathVariable Boolean active
@PathVariable Status status       // any enum
@PathVariable LocalDate date      // ISO yyyy-MM-dd, or use @DateTimeFormat
```

No manual parsing is needed if a suitable converter exists.

### UUID Example

```java
@GetMapping("/{id}")
public User getUser(@PathVariable UUID id) {
}
```

`/users/550e8400-e29b-41d4-a716-446655440000` → Spring converts the string into a `UUID`.

### Enum Example

```java
public enum Status {
    ACTIVE,
    INACTIVE
}

@GetMapping("/{status}")
public String status(@PathVariable Status status) {
    return status.name();
}
```

`/users/ACTIVE` → `Status.ACTIVE`.

> [!NOTE]
> The default enum conversion is **case-sensitive**: `/users/active` fails with `400 Bad Request`.

## Multiple Path Variables

```java
@GetMapping("/{userId}/orders/{orderId}")
public Order getOrder(@PathVariable Long userId,
                      @PathVariable Long orderId) {
}
```

`/users/101/orders/5001` → `userId = 101`, `orderId = 5001`.

### Nested Resources

```java
@GetMapping("/companies/{companyId}/employees/{employeeId}/projects/{projectId}")
public Project get(@PathVariable Long companyId,
                   @PathVariable Long employeeId,
                   @PathVariable Long projectId) {
}
```

`/companies/5/employees/101/projects/20` — Spring extracts all three values automatically.

## Path Variable Name Matching

```java
@GetMapping("/{id}")
public User get(@PathVariable Long id) {
}
```

Works because `{id}` ↔ `id` — the names match.

### Different Variable Names

```java
@GetMapping("/{id}")
public User get(@PathVariable("id") Long userId) {
}
```

Spring maps `{id}` → `userId` using the explicit annotation value.

> [!WARNING]
> Name inference only works if the code is compiled with the `-parameters` flag (Spring Boot's Maven/Gradle setup does this; since Spring 6.1 it's required). Otherwise, always give the name explicitly: `@PathVariable("id")`.

## What If Conversion Fails?

```java
@GetMapping("/{id}")
public User get(@PathVariable Long id) {
}
```

For `/users/abc`, Spring tries `"abc"` → `Long` and fails:

```output
400 Bad Request   (MethodArgumentTypeMismatchException)
```

## Missing Path Variable

With only `@GetMapping("/{id}")`, a request to `/users` cannot match the route → **`404 Not Found`**, because there is no handler for `/users`.

## Optional Path Variables?

Many developers ask whether `@PathVariable(required = false)` is possible. It **exists**, but it only makes sense when the same method is also mapped to a URL **without** the variable:

```java
@GetMapping({"", "/{id}"})
public Object get(@PathVariable(required = false) Long id) {
}
```

Usually it's clearer to write separate mappings:

```java
@GetMapping
public List<User> all() {
}

@GetMapping("/{id}")
public User one(@PathVariable Long id) {
}
```

(`Optional<Long>` is also supported as the parameter type.)

## @PathVariable vs @RequestParam

An extremely common interview question.

```java
// /users/10 — value is part of the URL path
@GetMapping("/{id}")
public User get(@PathVariable Long id) {}

// /users?id=10 — value comes from the query string
@GetMapping
public User get(@RequestParam Long id) {}
```

| Feature | @PathVariable | @RequestParam |
| --- | --- | --- |
| Location | URL path | Query parameter |
| Example | `/users/10` | `/users?id=10` |
| Required | Usually yes | Configurable |
| Used for | Resource identification | Filtering, sorting, pagination |

### REST Best Practice

✅ `GET /users/10` — the URL identifies the resource. ❌ `GET /getUser?id=10`.

## URL Encoding

For `/users/John%20Doe`, the browser sends `John%20Doe` and Spring automatically decodes it to `John Doe` before passing it to the controller.

## Internal Components

```flow For /users/100
DispatcherServlet
HandlerMapping — find matching URL
PathPatternParser — extract variables
PathVariableMethodArgumentResolver
ConversionService
Controller method
```

- **`PathPatternParser`** (or `AntPathMatcher` in older configurations) matches the URL pattern.
- **`PathVariableMethodArgumentResolver`** resolves `@PathVariable` parameters.
- **`ConversionService`** converts `String` values into target Java types.

These names are excellent interview points.

## Common Mistakes

### Parsing Manually

```java
// ❌ Wrong
@GetMapping("/{id}")
public User get(@PathVariable String id) {
    Long userId = Long.parseLong(id);
}

// ✅ Correct — let Spring handle conversion
@GetMapping("/{id}")
public User get(@PathVariable Long id) {
}
```

### Using @RequestParam for Identifiers

Prefer `/users/10` over `/users?id=10` when the ID uniquely identifies the resource.

### Mismatched Variable Names

```java
// ❌ Wrong — there is no {userId} in the template
@GetMapping("/{id}")
public User get(@PathVariable Long userId) {
}
```

Spring looks for a template variable called `userId`, doesn't find one, and fails (`MissingPathVariableException`, a `500`). Correct: `@PathVariable("id") Long userId`.

## Enterprise Example

```java
@RestController
@RequestMapping("/employees")
public class EmployeeController {

    @GetMapping("/{id}")
    public Employee get(@PathVariable Long id) {
        return service.findById(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
```

`GET /employees/101` returns employee 101; `DELETE /employees/101` deletes employee 101.

## Interview Questions

### Q1. What is @PathVariable?

It binds a value from the URL path to a controller method parameter.

### Q2. Who converts String to Long?

Spring's `ConversionService`.

### Q3. Can @PathVariable be Integer, UUID or Enum?

Yes. Spring supports automatic conversion for many common Java types, including `Integer`, `Long`, `UUID`, enums and more.

### Q4. What happens if conversion fails?

Spring returns `400 Bad Request`, because the value can't be converted to the target type.

### Q5. What is the difference between @PathVariable and @RequestParam?

- `@PathVariable` identifies a resource as part of the URL path.
- `@RequestParam` reads query parameters, often used for filtering, sorting, pagination or optional inputs.

### Q6. Which internal Spring class resolves @PathVariable?

`PathVariableMethodArgumentResolver`, which delegates type conversion to the `ConversionService`.

### Q7. Can we have multiple path variables?

Yes — e.g. `/users/10/orders/100` maps to `@GetMapping("/{userId}/orders/{orderId}")`.

## Summary Diagram

```flow
Client — GET /users/101
DispatcherServlet
RequestMappingHandlerMapping
PathPatternParser — extract id = "101"
PathVariableMethodArgumentResolver
ConversionService — Long id = 101
Controller method → Service → Repository → Database
JSON response
```

## Key Takeaways

- ✅ `@PathVariable` binds values from the URL path to method parameters.
- ✅ Spring converts string values using the `ConversionService`.
- ✅ Multiple path variables are fully supported.
- ✅ Prefer `@PathVariable` for resource identifiers and `@RequestParam` for filters and query options.
- ✅ `PathVariableMethodArgumentResolver` and `ConversionService` are key internal components.
- ✅ Let Spring perform type conversion instead of parsing values manually.
