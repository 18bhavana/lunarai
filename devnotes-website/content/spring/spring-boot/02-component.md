---
title: "@Component"
subtitle: The foundation of Spring's component model — what @Component does, scanning, metadata reading vs reflection, bean naming, singletons, stateless beans and meta-annotations.
order: 2
---

## Introduction

If there is one annotation you must completely understand before learning Spring Boot, it is **`@Component`**. Why? Because almost every other stereotype annotation (`@Service`, `@Repository`, `@Controller`, `@RestController`) is **built on top of `@Component`**.

## What is @Component?

`@Component` tells the Spring container:

> [!IMPORTANT]
> "Create an object of this class, manage its lifecycle, and make it available for dependency injection."

```java
import org.springframework.stereotype.Component;

@Component
public class EmailService {

    public void sendEmail() {
        System.out.println("Email Sent");
    }
}
```

That's all you write. You never call `new EmailService()` — Spring creates and manages the instance.

## Life Without Spring

```java
public class EmailService {

    public void sendEmail() {
        System.out.println("Sending...");
    }
}

public class UserService {

    private EmailService emailService = new EmailService();
}
```

You are responsible for creating objects, managing dependencies, managing lifecycle and reusing objects. As applications grow, this becomes difficult to maintain.

## Life With Spring

```java
@Component
public class EmailService {
}

@Service
public class UserService {

    @Autowired
    private EmailService emailService;
}
```

Now Spring handles object creation, dependency injection, lifecycle, singleton management and memory management (bean scope).

## What Happens Internally?

```flow
SpringApplication.run()
ApplicationContext created
Component scan
Found EmailService.class
? Has @Component? | Yes: Create BeanDefinition | No: Ignored
Instantiate object
Store in IoC container
Bean ready
```

## Where Is the Bean Stored?

Inside the **IoC container** (`ApplicationContext`). Think of it like a warehouse:

| Bean name | Object | Scope |
| --- | --- | --- |
| `emailService` | `EmailService@2fa89c` | Singleton |

Whenever anyone needs `EmailService`, Spring returns this managed instance.

## How Does Spring Discover @Component?

Spring scans packages using **component scanning**.

```tree
com.demo
  DemoApplication
  service
    EmailService
  controller
    UserController
  repository
    UserRepository
```

```java
@SpringBootApplication
public class DemoApplication {
}
```

```flow-h
@ComponentScan
Scan com.demo.*
Read every class
? Has @Component? | Yes: Register bean
```

## Reflection vs Metadata Reading

> [!QUESTION] Does Spring use reflection to scan every class?
> - Spring **does** use reflection when interacting with loaded classes (creating objects, invoking methods, inspecting constructors, etc.).
> - However, during component scanning, Spring tries to **avoid loading every class**. It reads class metadata directly from the `.class` files using metadata readers (based on **ASM**), which is much faster.

Conceptually:

```java
if (class.hasAnnotation(Component.class)) {
    registerBean();
}
```

In reality, Spring reads the annotation information from bytecode **before** loading the class.

## Bean Naming

```java
@Component
public class EmailService {
}
```

Default bean name: **`emailService`**. The rule is *class name with the first letter lowercased*.

| Class name | Bean name |
| --- | --- |
| `UserService` | `userService` |
| `EmailService` | `emailService` |
| `PaymentService` | `paymentService` |

> [!NOTE]
> Edge case: if the first **two** letters are uppercase, the name is kept as-is — `URLService` stays `URLService` (Spring follows `java.beans.Introspector.decapitalize`).

### Custom Bean Name

```java
@Component("gmailService")
public class EmailService {
}
```

The container now stores `gmailService` → `EmailService` object. Inject it with:

```java
@Autowired
@Qualifier("gmailService")
private EmailService emailService;
```

## What Is a Bean?

> [!QUESTION] What is the difference between an object and a bean?
> Every Spring bean is an object, but not every object is a Spring bean.

```java
// Normal object
EmailService service = new EmailService();

// Spring bean
@Component
public class EmailService {
}
```

| Object | Spring bean |
| --- | --- |
| Created using `new` | Created by Spring |
| Not managed | Managed by the IoC container |
| No lifecycle callbacks | Lifecycle managed |
| No dependency injection | Supports dependency injection |
| Exists independently | Stored inside the `ApplicationContext` |

## Singleton Behaviour

By default, **only one instance** is created:

```java
@Service
public class UserService {

    @Autowired
    EmailService emailService;
}

@RestController
public class UserController {

    @Autowired
    EmailService emailService;
}
```

```refs Spring injects the same singleton instance into both classes
UserService.emailService, UserController.emailService -> EmailService | one shared instance
```

### What If There Are 100 Requests?

Even with 100 concurrent HTTP requests, **all requests share the same singleton bean**. Because singleton beans are shared, they should generally be **stateless**.

## Stateless vs Stateful Beans

✅ **Good (stateless)** — no instance variables hold request-specific data:

```java
@Component
public class EmailService {

    public void sendEmail(String email) {
        System.out.println(email);
    }
}
```

❌ **Bad (stateful):**

```java
@Component
public class EmailService {

    private String currentEmail;

    public void send(String email) {
        currentEmail = email;
    }
}
```

If multiple threads call `send()` simultaneously, `currentEmail` may be overwritten, leading to **race conditions**.

## Can @Component Be Used Everywhere?

Technically, yes:

```java
@Component
class PaymentService {}

@Component
class UserRepository {}
```

But Spring provides specialized stereotypes for better readability and additional behaviour:

| Annotation | Purpose |
| --- | --- |
| `@Component` | Generic component |
| `@Service` | Business logic |
| `@Repository` | Persistence layer (adds exception translation) |
| `@Controller` | MVC controller |
| `@RestController` | REST controller |

## Meta-Annotation

Internally, `@Service` is defined (conceptually) as:

```java
@Component
public @interface Service {
}
```

Likewise `@Repository` → `@Component` and `@Controller` → `@Component`. This is why component scanning detects all of them.

```tree
@Component
  @Service
  @Repository
  @Controller
    @RestController
```

## Common Mistakes

### 1. Package Not Scanned

`@SpringBootApplication` is in `com.demo.app`, but the component is in `org.example.service`. Result: **no qualifying bean**.

Fix: `@ComponentScan("org.example")`, or move the class under the application's base package.

### 2. Missing Annotation

```java
public class EmailService {
}

@Autowired
EmailService emailService;
```

```output
NoSuchBeanDefinitionException: No qualifying bean of type 'EmailService' available
```

…because Spring never registered the class as a bean.

### 3. Multiple Beans of the Same Type

```java
@Component
class GmailService implements EmailService {
}

@Component
class OutlookService implements EmailService {
}

@Autowired
EmailService service;
```

Spring doesn't know which bean to inject and throws **`NoUniqueBeanDefinitionException`**. Solutions include `@Qualifier` and `@Primary` (covered in the Dependency Injection chapter).

## Real-World Example

```flow-h
Controller
Service
Repository
Database
```

```java
@RestController
public class UserController {

    @Autowired
    UserService service;
}

@Service
public class UserService {

    @Autowired
    UserRepository repository;
}

@Repository
public class UserRepository {
}
```

All three classes are discovered through component scanning because they are stereotype annotations built on `@Component`.

## Interview Questions

### Q1. What is @Component?

A stereotype annotation that marks a class as a Spring-managed bean eligible for component scanning and dependency injection.

### Q2. Who creates a @Component bean?

The Spring IoC container (`ApplicationContext`) creates and manages it.

### Q3. Is every @Component a singleton?

By default, yes — unless another scope (such as `prototype`, `request` or `session`) is specified.

### Q4. Where are Spring beans stored?

Inside the `ApplicationContext` (IoC container).

### Q5. Does @Component automatically inject dependencies?

No. It only registers the class as a bean. Dependency injection is performed using constructor injection or `@Autowired`.

### Q6. What is the difference between an object and a bean?

An object is any Java instance. A Spring bean is an object created, configured and managed by the Spring container.

### Q7. Why do @Service, @Repository and @Controller work with component scanning?

Because they are stereotype annotations that are meta-annotated with `@Component`.

## Summary

- ✅ `@Component` marks a class as a Spring-managed bean.
- ✅ Component scanning discovers candidate classes.
- ✅ Spring registers a `BeanDefinition`, then creates and manages the bean.
- ✅ By default, `@Component` beans are singleton-scoped.
- ✅ `@Service`, `@Repository` and `@Controller` are built on top of `@Component`.
- ✅ Stateless singleton beans are the recommended design for most services.
