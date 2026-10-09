---
title: Bean Validation
subtitle: "@Valid, @Validated and Jakarta Validation — constraint annotations, @NotNull vs @NotEmpty vs @NotBlank, nested and method validation, groups, custom ConstraintValidators and error handling."
order: 18
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Bean Validation is one of the most frequently asked Spring Boot interview topics. Almost every enterprise application validates incoming requests before processing them — user registration, login, payment APIs, banking, healthcare, e-commerce, insurance, government portals.

Interviewers frequently ask: What is `@Valid`? What is `@Validated`? What is Jakarta Bean Validation? What happens internally when validation fails? What are validation groups? How do we create custom validators? What is `ConstraintValidator`? What's the difference between `@NotNull`, `@NotEmpty` and `@NotBlank`?

## Why Validation?

Suppose the client sends:

```json
{
  "name": "",
  "email": "abc",
  "age": 10
}
```

```flow-h Without validation — invalid data reaches your database
Client
Controller
Service
Database
```

```flow-h With validation — invalid requests are rejected immediately
Client
Validation
Controller
Service
Database
```

## What is Bean Validation?

**Bean Validation** is a Java specification (**Jakarta Bean Validation**) that defines how Java objects are validated using annotations. Spring Boot integrates with it automatically once the starter is on the classpath:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

> [!NOTE]
> Since Spring Boot 2.3 this starter is **not** included in `spring-boot-starter-web` — add it explicitly. The default implementation is **Hibernate Validator**.

## First Example

```java
public class UserRequest {

    @NotBlank
    private String name;

    @Email
    private String email;

    @Min(18)
    private Integer age;
}

@PostMapping("/users")
public ResponseEntity<String> save(@Valid @RequestBody UserRequest request) {
    return ResponseEntity.ok("Saved");
}
```

A request with `{"name": "", "email": "abc", "age": 15}` fails validation → **`400 Bad Request`**.

### Complete Validation Flow

```flow
Client — JSON
@RequestBody → Jackson
Java object
@Valid → Validator
? Validation success? | Yes: Controller | No: MethodArgumentNotValidException → @ControllerAdvice → JSON error
```

## What Does @Valid Do?

`@Valid` tells Spring: *validate this object before executing the controller method.*

```flow-h
Create object
Validate object
? Valid? | Yes: Call controller | No: Throw exception
```

## Common Validation Annotations

### @NotNull, @NotEmpty and @NotBlank

```java
@NotNull
private String name;    // rejects null; allows "" and " "

@NotEmpty
private String name;    // rejects null and ""; allows " "

@NotBlank
private String name;    // rejects null, "" and spaces-only — best for user-entered text
```

**Interview favourite** — this table is asked surprisingly often:

| Annotation | `null` | `""` | `" "` |
| --- | --- | --- | --- |
| `@NotNull` | ✗ rejected | ✓ allowed | ✓ allowed |
| `@NotEmpty` | ✗ rejected | ✗ rejected | ✓ allowed |
| `@NotBlank` | ✗ rejected | ✗ rejected | ✗ rejected |

> [!WARNING]
> Every other constraint (`@Size`, `@Min`, `@Email`, `@Pattern`, …) treats **`null` as valid**. `@Min(18) Integer age` accepts a missing age — combine with `@NotNull` if the field is required.

### Strings

```java
@Size(min = 3, max = 20)
private String username;   // length 3–20
```

### Email

```java
@Email
private String email;
```

`abc@gmail.com` is valid; `abc`, `abc@` and `gmail.com` are invalid. (Hibernate Validator's `@Email` also accepts `abc@gmail` — add a `@Pattern` if you need a stricter rule.)

### Numbers

```java
@Min(18)
private Integer age;

@Max(60)
private Integer retirementAge;
```

### Decimals

```java
@DecimalMin("1000.00")
private BigDecimal minSalary;

@DecimalMax("9999999.99")
private BigDecimal maxSalary;
```

Useful for money values.

### Booleans

A primitive `boolean active` can't be `null`; a wrapper `Boolean active` can. Validate it with `@NotNull private Boolean active;`.

### Regex

```java
@Pattern(regexp = "^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
private String pan;   // e.g. ABCDE1234F
```

### Dates

```java
@Past
private LocalDate dob;

@Future
private LocalDate expiryDate;

// also: @PastOrPresent, @FutureOrPresent
```

## Nested Validation

```java
public class UserRequest {

    @Valid
    private Address address;
}

public class Address {

    @NotBlank
    private String city;
}
```

Without `@Valid` on the field inside `UserRequest`, the nested `Address` is **not** validated.

### Collections

```java
public class UserRequest {

    @Valid
    private List<Address> addresses;   // every address is validated
}
```

## Validation Messages

```java
@NotBlank(message = "Name is mandatory")
private String name;
```

```json
{
  "message": "Name is mandatory"
}
```

## Method Parameter Validation

```java
@RestController
@Validated
public class UserController {

    @GetMapping("/{id}")
    public User get(@Min(1) @PathVariable Long id) {
    }
}
```

> [!NOTE]
> Before Spring Framework 6.1, constraints on `@PathVariable`/`@RequestParam` parameters only ran if the class had **`@Validated`**, and failures threw `ConstraintViolationException`. Since 6.1 (Boot 3.2), controllers validate such parameters **automatically** and throw `HandlerMethodValidationException` (400). For **services** and other beans, `@Validated` is still required.

## @Valid vs @Validated

One of the most common interview questions.

**`@Valid`** — a Jakarta Bean Validation annotation. Validates an object and **cascades** into nested objects:

```java
@Valid @RequestBody UserRequest dto
```

**`@Validated`** — a Spring annotation. Adds **validation groups** and **method-level validation** (class-level activation):

```java
@Validated
@Service
public class UserService {
}
```

## Validation Groups

```java
public interface Create {}
public interface Update {}

public class UserRequest {

    @Null(groups = Create.class)
    @NotNull(groups = Update.class)
    private Long id;
}

@PostMapping
public void create(@Validated(Create.class) @RequestBody UserRequest dto) {
}
```

**Only the `Create` group is evaluated** — useful for different rules on create vs update.

> [!TIP]
> When you select a group, constraints **without** a group (the `Default` group) are skipped — include `Default.class` too if you still want them: `@Validated({Create.class, Default.class})`.

## Custom Validation Annotation

```java
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PanValidator.class)
public @interface ValidPan {

    String message() default "Invalid PAN";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

```java
public class PanValidator implements ConstraintValidator<ValidPan, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value != null && value.matches("^[A-Z]{5}[0-9]{4}[A-Z]$");
    }
}
```

```java
@ValidPan
private String pan;
```

> [!NOTE]
> A constraint annotation **must** declare the `message`, `groups` and `payload` attributes, otherwise Hibernate Validator rejects it at runtime.

### ConstraintValidator

An interview favourite — this is how custom validation works internally:

```flow-h
@ValidPan
ConstraintValidator.isValid()
true / false
```

## Validation Exceptions

| Validation of | Exception |
| --- | --- |
| `@Valid @RequestBody` | `MethodArgumentNotValidException` |
| Method parameters (`@Validated` beans) | `ConstraintViolationException` |
| Controller parameters (Spring 6.1+) | `HandlerMethodValidationException` |

Know the difference.

### Global Exception Handler

```java
@RestControllerAdvice
public class GlobalHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handle(MethodArgumentNotValidException ex) {
        // extract errors from ex.getBindingResult()
    }
}
```

### Returning Validation Errors

```json
{
  "timestamp": "2026-07-25T12:30:00",
  "status": 400,
  "errors": [
    { "field": "name", "message": "Name is mandatory" },
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

Much more useful than a single error string.

## Internal Spring Components

```flow
JSON
Jackson
DTO
LocalValidatorFactoryBean
Hibernate Validator
ConstraintValidator
Success / failure
```

Important classes: **`LocalValidatorFactoryBean`**, **`SpringValidatorAdapter`**, **`ConstraintValidator`** and **`MethodValidationPostProcessor`** (for method validation).

## Common Mistakes

- ❌ **Forgetting `@Valid`** — `@RequestBody UserRequest dto` alone performs no validation. Use `@Valid @RequestBody UserRequest dto`.
- ❌ **Forgetting `@Validated`** on services (or on controllers before Spring 6.1) — parameter constraints like `@Min(1)` won't run.
- ❌ **Using `@NotNull` for strings** — it allows `"  "`. Use `@NotBlank`.
- ❌ **No custom messages** — prefer `@NotBlank(message = "Name cannot be blank")`.
- ❌ **Skipping nested `@Valid`** — without `@Valid private Address address;`, nested validation is skipped.

## Enterprise Architecture

```flow
React — JSON request
@RequestBody → Jackson
DTO
@Valid
Hibernate Validator → ConstraintValidator
Controller
Service
Repository
Database
```

## Interview Questions

### Q1. What is Bean Validation?

A standard Java specification (Jakarta Bean Validation) for validating Java objects using annotations.

### Q2. What is the default validation implementation in Spring Boot?

Hibernate Validator.

### Q3. What is the difference between @Valid and @Validated?

| @Valid | @Validated |
| --- | --- |
| Jakarta Validation | Spring Framework |
| Object validation, cascades into nested objects | Object + method-level validation |
| No group selection | Supports validation groups |

### Q4. Difference between @NotNull, @NotEmpty and @NotBlank?

| Annotation | Rejects `null` | Rejects `""` | Rejects `" "` |
| --- | --- | --- | --- |
| `@NotNull` | ✓ | ✗ | ✗ |
| `@NotEmpty` | ✓ | ✓ | ✗ |
| `@NotBlank` | ✓ | ✓ | ✓ |

### Q5. What exception is thrown when @RequestBody validation fails?

`MethodArgumentNotValidException`.

### Q6. What exception is thrown during method parameter validation?

`ConstraintViolationException` (for `@Validated` beans; controllers on Spring 6.1+ throw `HandlerMethodValidationException`).

### Q7. Which class creates the Spring Validator?

`LocalValidatorFactoryBean`.

### Q8. What is ConstraintValidator?

The interface you implement to create custom validation logic for a custom constraint annotation.

### Q9. Why are validation groups used?

To apply different validation rules for different operations, such as create, update or admin workflows.

## Key Takeaways

- ✅ Bean Validation rejects invalid data before business logic executes.
- ✅ `@Valid` validates objects; `@Validated` adds method validation and groups.
- ✅ `@NotBlank` is generally the best choice for required text fields.
- ✅ Use nested `@Valid` to validate child objects and collections.
- ✅ Implement `ConstraintValidator` for reusable custom rules.
- ✅ Handle validation exceptions globally with `@RestControllerAdvice`.
- ✅ `LocalValidatorFactoryBean` and Hibernate Validator power Spring Boot's validation.
