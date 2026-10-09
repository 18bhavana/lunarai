---
title: "@ModelAttribute"
subtitle: Binding form fields and query parameters to objects — WebDataBinder, nested and collection binding, validation with BindingResult, global model data and @ModelAttribute vs @RequestBody.
order: 16
---

## Introduction

> [!NOTE]
> **Interview importance: 9.5/10.**

`@ModelAttribute` is one of the most misunderstood annotations in Spring. Many developers think it's only for HTML forms. In reality it's used for Spring MVC form binding, request-parameter binding, global model data, view rendering, data preloading, edit forms and legacy enterprise applications.

Interviewers frequently ask: What is `@ModelAttribute`? How is it different from `@RequestBody`? When should we use it? How does Spring populate the object? Can it work without the annotation? Which internal class handles it?

## What is @ModelAttribute?

> [!IMPORTANT]
> `@ModelAttribute` tells Spring: *create a Java object, populate it from request parameters, and make it available to the controller (and the view).*

Unlike `@RequestBody`, it does **not** read JSON. Instead it binds:

- Query parameters
- Form data (`application/x-www-form-urlencoded`)
- Multipart form fields (non-file fields)

### First Example

```text
POST /users
Content-Type: application/x-www-form-urlencoded

name=Rahul&age=25
```

```java
@PostMapping("/users")
public String save(@ModelAttribute UserForm form) {
    return "Saved";
}
```

Spring automatically does the equivalent of:

```java
UserForm form = new UserForm();
form.setName("Rahul");
form.setAge(25);
```

No JSON parsing happens.

### Complete Request Flow

```flow-h
Browser — HTML form
DispatcherServlet
ModelAttributeMethodProcessor
Create object
Populate fields
Controller
Service
```

## Why Do We Need @ModelAttribute?

Without Spring:

```java
UserForm form = new UserForm();
form.setName(request.getParameter("name"));
form.setAge(Integer.parseInt(request.getParameter("age")));
```

With Spring, `@ModelAttribute UserForm form` — everything is automatic.

## Data Sources

`@ModelAttribute` binds values from **query parameters**, **form fields** and **multipart form fields** — e.g. `GET /users?name=Rahul&age=25` or a `POST` with `Content-Type: application/x-www-form-urlencoded`.

### GET Example

```java
@GetMapping("/search")
public String search(@ModelAttribute SearchFilter filter) {
}
```

`GET /search?city=Bangalore&active=true` → `SearchFilter { city = Bangalore, active = true }`.

### POST Form Example

```html
<form action="/users" method="post">
    <input name="name">
    <input name="age">
    <button>Save</button>
</form>
```

```java
@PostMapping("/users")
public String save(@ModelAttribute UserForm form) {
}
```

Spring fills the object automatically.

## Nested Object Binding

```text
name=Rahul
address.city=Bangalore
address.state=Karnataka
```

```java
public class UserForm {
    private Address address;
}

public class Address {
    private String city;
    private String state;
}
```

Spring binds `address.city` → `Address.city` automatically.

## Collection Binding

```text
skills[0]=Java
skills[1]=Spring
skills[2]=MySQL
```

```java
private List<String> skills;
```

Spring populates the list.

## Validation and BindingResult

```java
public class UserForm {

    @NotBlank
    private String name;

    @Min(18)
    private Integer age;
}

@PostMapping
public String save(@Valid @ModelAttribute UserForm form) {
}
```

Validation executes **after binding**.

### BindingResult

A favourite interview question.

```java
@PostMapping
public String save(@Valid @ModelAttribute UserForm form,
                   BindingResult result) {

    if (result.hasErrors()) {
        return "user-form";
    }
    return "success";
}
```

Instead of throwing an exception, validation errors stay inside **`BindingResult`**. This is especially useful for server-rendered forms (redisplay the form with error messages).

> [!WARNING]
> `BindingResult` must be declared **immediately after** the `@ModelAttribute` parameter it belongs to. Without a `BindingResult`, a validation failure throws `MethodArgumentNotValidException` (a `BindException`) → `400 Bad Request`.

## @ModelAttribute on Methods — Global Model Data

`@ModelAttribute` can also be placed on **methods**:

```java
@Controller
public class UserController {

    @ModelAttribute("countries")
    public List<String> countries() {
        return List.of("India", "USA", "Japan");
    }
}
```

Every view rendered by this controller receives `countries` automatically. (These methods run **before** each handler method in the controller.)

### Across All Controllers

```java
@ControllerAdvice
public class GlobalModel {

    @ModelAttribute("applicationName")
    public String app() {
        return "Ticket Booking";
    }
}
```

Now every view receives `applicationName`. Common in Spring MVC applications.

## @ModelAttribute vs @RequestBody

One of the most common interview questions.

| @ModelAttribute | @RequestBody |
| --- | --- |
| Form data, query parameters | JSON / XML request body |
| Uses `WebDataBinder` | Uses `HttpMessageConverter` |
| HTML forms | REST APIs |
| No JSON parsing | JSON parsing |

## @ModelAttribute vs @RequestParam

For `GET /users?name=Rahul&age=25`:

```java
// Option 1
@RequestParam String name, @RequestParam Integer age

// Option 2 — better when there are many fields
@ModelAttribute UserFilter filter
```

## File Upload Example

```text
name=Rahul
age=25
profilePhoto=file.jpg
```

```java
@PostMapping("/upload")
public String upload(@ModelAttribute UserForm form,
                     @RequestParam MultipartFile profilePhoto) {
}
```

`@ModelAttribute` binds the form fields; `MultipartFile` handles the uploaded file.

## Internal Working

```flow-h
Create object
WebDataBinder
Read request parameters
Type conversion
Set properties
Validation
Controller
```

Important classes: **`ModelAttributeMethodProcessor`**, **`WebDataBinder`**, **`ConversionService`** and **`Validator`** — interview favourites.

## @ModelAttribute Without the Annotation

For complex (non-simple) types in Spring MVC controllers, Spring treats the parameter as a model attribute **even if you omit the annotation**:

```java
@PostMapping
public String save(UserForm form) {
}
```

Spring binds request parameters into `form` automatically. Adding `@ModelAttribute` makes the intent explicit and is recommended for readability.

## Common Mistakes

- ❌ **Using `@RequestBody` for HTML forms.** HTML forms usually submit `application/x-www-form-urlencoded`, so `@RequestBody UserForm` fails (415). Use `@ModelAttribute UserForm form`.
- ❌ **Using `@ModelAttribute` for JSON.** A `POST` with `Content-Type: application/json` needs `@RequestBody UserDto dto`; with `@ModelAttribute` the fields stay `null`.
- ❌ **Forgetting `BindingResult`** for server-rendered forms — it lets you redisplay validation errors instead of throwing.
- ❌ **Mixing REST and MVC concepts.** REST APIs → `@RequestBody` + JSON. HTML forms → `@ModelAttribute` + form data.

## Enterprise Architecture

```flow
Browser — HTML form
DispatcherServlet
ModelAttributeMethodProcessor
WebDataBinder
ConversionService
Validator
Controller
Service
Repository
Database
```

## Interview Questions

### Q1. What is @ModelAttribute?

It binds request parameters or form fields to a Java object and adds that object to the model for view rendering.

### Q2. What is the difference between @ModelAttribute and @RequestBody?

- `@ModelAttribute` binds query parameters and form data.
- `@RequestBody` binds the HTTP request body (typically JSON or XML).

### Q3. Which Spring class processes @ModelAttribute?

`ModelAttributeMethodProcessor`.

### Q4. What is WebDataBinder?

The component that binds request parameters to Java object properties and coordinates type conversion and validation.

### Q5. What is BindingResult?

It stores binding and validation errors after `@ModelAttribute` processing, so the application can redisplay the form with error messages instead of throwing an exception.

### Q6. Can @ModelAttribute bind nested objects?

Yes — e.g. `address.city` → `User.address.city`.

### Q7. Can @ModelAttribute bind collections?

Yes — lists, arrays, maps and nested collections, using indexed property names.

### Q8. Can @ModelAttribute be used on methods?

Yes. Methods annotated with `@ModelAttribute` add common data to the model before controller methods execute.

### Q9. When should we use @ModelAttribute?

HTML form submissions, search/filter forms, Spring MVC applications, view rendering with model data, and multipart form requests (for the non-file fields).

## Summary

```flow
Query parameters / form fields / multipart form fields
ModelAttributeMethodProcessor
WebDataBinder
ConversionService
Validator
Java object
Controller
Model (for MVC views)
```

## Key Takeaways

- ✅ `@ModelAttribute` binds request parameters and form fields to Java objects.
- ✅ It's designed for Spring MVC and HTML form processing, not JSON REST APIs.
- ✅ `ModelAttributeMethodProcessor` creates and binds the object.
- ✅ `WebDataBinder` handles property binding, type conversion and validation.
- ✅ `BindingResult` captures validation errors for server-rendered forms.
- ✅ `@ModelAttribute` methods provide common model data, per controller or globally via `@ControllerAdvice`.
- ✅ Prefer `@RequestBody` for REST APIs and `@ModelAttribute` for form submissions.
