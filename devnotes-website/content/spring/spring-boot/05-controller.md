---
title: "@Controller"
subtitle: How a browser request reaches your Java code — Spring MVC, embedded Tomcat, DispatcherServlet, HandlerMapping, HandlerAdapter, ViewResolver, Model and thin, stateless controllers.
order: 5
---

## Introduction

One of the most important Spring Boot chapters, because it explains **how a request from the browser reaches your Java code**. Most developers know how to write `@Controller public class HomeController {}`. But interviewers ask:

- What happens after typing a URL in the browser?
- What is `DispatcherServlet`?
- How does Spring find the correct controller?
- How does Spring call the controller method?
- What happens after the method returns?

If you understand this chapter, you'll understand the entire **Spring MVC request lifecycle**.

## What is @Controller?

`@Controller` marks a class as a **Spring MVC controller**. Its responsibility is to:

- Receive HTTP requests
- Process user input
- Call the service layer
- Return a **view** (JSP, Thymeleaf, HTML)

```java
@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "home";
    }
}
```

## Is @Controller a Bean?

Yes. `@Controller` is a stereotype annotation built on top of `@Component`:

```java
@Component
public @interface Controller {
}
```

```flow-h
Component scan
@Controller found
BeanDefinition created
Bean created
ApplicationContext
```

## Where Does the Controller Fit?

```flow-h The controller is the entry point of your application
Browser
Controller
Service
Repository
Database
```

Opening `http://localhost:8080/users` flows: Browser → Spring Boot → `UserController` → `UserService` → `UserRepository` → MySQL → response.

## What Happens When You Press Enter?

Suppose you visit `http://localhost:8080/users/10`:

```flow Most interviews focus on the middle part
Browser
HTTP request
Tomcat
DispatcherServlet
HandlerMapping
UserController
UserService
Repository
Database
Response
Browser
```

Let's understand every component.

### Step 1 — The Browser Sends an HTTP Request

```text
GET /users/10 HTTP/1.1
Host: localhost:8080
```

### Step 2 — Tomcat Receives the Request

Spring Boot **embeds Tomcat** by default. Tomcat listens on port **8080**; when the request arrives, it forwards it to Spring MVC.

### Step 3 — DispatcherServlet

**The heart of Spring MVC.** Every request first reaches the `DispatcherServlet`. Think of it as a **receptionist** who sends each customer to the correct department. `DispatcherServlet` never processes business logic — it **routes** requests.

```flow-h Everything starts here
HTTP request
DispatcherServlet
Find controller
Call method
Get response
Return response
```

### Step 4 — HandlerMapping

Spring asks: *which controller should handle this URL?*

```java
@Controller
public class UserController {

    @GetMapping("/users/{id}")
    public String getUser(@PathVariable Long id) {
        ...
    }
}
```

```flow-h
/users/10
: HandlerMapping
UserController.getUser()
```

### Step 5 — HandlerAdapter

Spring has found the method; now it needs to **execute** it. The `HandlerAdapter` is responsible for creating method arguments, injecting parameters and calling the method — conceptually `controller.getUser(id)`.

### Step 6 — The Controller Executes

```java
@Controller
public class UserController {

    @Autowired
    UserService service;

    @GetMapping("/users/{id}")
    public String getUser(@PathVariable Long id) {
        service.findUser(id);
        return "profile";
    }
}
```

The controller calls the service, receives data and returns a **view name**.

### Steps 7–9 — Service, Repository, and Back

Business logic happens in the `@Service`; database access happens in the repository (`UserRepository extends JpaRepository<User, Long>`). The repository returns data, the service processes it, and the controller receives it.

### Step 10 — ViewResolver

The controller returned `"profile"`. Spring asks: *where is `profile`?* The **ViewResolver** searches — e.g. `/templates/profile.html` (Thymeleaf) or `/WEB-INF/views/profile.jsp` (JSP), depending on your configuration.

## Complete MVC Flow

```flow This is the complete Spring MVC lifecycle
Browser
Tomcat
DispatcherServlet
HandlerMapping
HandlerAdapter
Controller → Service → Repository → Database
Repository → Service → Controller
ViewResolver
HTML
Browser
```

## Why Don't We Create Controllers?

```java
UserController controller = new UserController();   // ❌
```

Instead, annotate with `@Controller` and let Spring create the bean. Benefits: dependency injection, singleton management, lifecycle management and AOP support.

## Controllers Should Be Thin

✅ Good — only delegates:

```java
@Controller
public class ProductController {

    @Autowired
    ProductService service;

    @PostMapping("/products")
    public String save(Product product) {
        service.save(product);
        return "success";
    }
}
```

❌ Bad:

```java
@Controller
public class ProductController {

    @PostMapping("/products")
    public String save(Product product) {
        validate();
        calculateTax();
        updateInventory();
        generateInvoice();
        sendEmail();
        return "success";
    }
}
```

Business logic belongs in the service layer.

## Returning Views and Model Data

```java
@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "home";   // → home.html or home.jsp, depending on your view technology
    }
}
```

```java
@Controller
public class UserController {

    @GetMapping("/profile")
    public String profile(Model model) {
        model.addAttribute("name", "John");
        return "profile";
    }
}
```

```flow-h
Model: name = John
: rendered by the view
Hello John
```

## Singleton Nature

Controllers are **singleton beans** — one instance serves many requests. Therefore controllers should **never** store request-specific data in instance variables.

```java
// ❌ Wrong — multiple requests can overwrite this field
@Controller
public class UserController {

    private User currentUser;
}

// ✅ Good — keep request data in method parameters or local variables
@GetMapping
public String get(User user) {
}
```

## Common Mistakes

- **Business logic in the controller** — e.g. a `register()` method that calculates discounts and sends emails. Move it to a service.
- **Database access in the controller** — injecting `UserRepository` directly. Use Controller → Service → Repository.
- **Returning database entities directly to the view** — prefer DTOs or view models instead of exposing JPA entities, especially in larger applications.

## Interview Questions

### Q1. What is @Controller?

A stereotype annotation that marks a class as a Spring MVC controller responsible for handling web requests and returning views.

### Q2. Is @Controller a Spring bean?

Yes. It is detected during component scanning and registered as a singleton bean by default.

### Q3. What is the responsibility of a controller?

Receive HTTP requests, delegate business logic to services, prepare model data, and return a view name.

### Q4. What is DispatcherServlet?

The **front controller** of Spring MVC. Every incoming HTTP request passes through it, and it coordinates request handling by interacting with `HandlerMapping`, `HandlerAdapter`, controllers and view resolvers.

### Q5. What is HandlerMapping?

It maps an incoming URL to the appropriate controller method based on annotations such as `@RequestMapping` or `@GetMapping`.

### Q6. What is HandlerAdapter?

It invokes the selected controller method by preparing method arguments (path variables, request parameters, request bodies, etc.) and executing the handler.

### Q7. What is ViewResolver?

It resolves the logical view name returned by a controller (such as `"home"`) to the actual view resource (for example `home.html` or `home.jsp`).

### Q8. Why should controllers be thin?

Controllers should focus on HTTP concerns only. Moving business logic to services improves maintainability, testability and separation of concerns.

## Key Takeaways

- ✅ `@Controller` is used for Spring MVC applications that return views.
- ✅ It is a stereotype annotation built on top of `@Component`.
- ✅ Every request first reaches the `DispatcherServlet`.
- ✅ `HandlerMapping` locates the controller method; `HandlerAdapter` invokes it.
- ✅ `ViewResolver` converts the logical view name into the actual view.
- ✅ Controllers should remain thin, stateless and focused on request handling.
