---
title: How Spring Understands Annotations
subtitle: What happens inside Spring when it sees an annotation — ApplicationContext, component scanning, BeanDefinitions, bean creation and dependency injection.
order: 1
---

## Introduction

Before learning `@Component` or `@Autowired`, you need to answer one question:

> [!QUESTION] How does Spring even know that a class has @Component?
> This chapter answers that — and it's what interviewers for 5+ years of experience often probe.

## What is an Annotation?

An annotation is **metadata** — information about information.

```java
@Component
public class UserService {
}
```

`@Component` does **not execute any code**. It simply tells Spring: *"This class should become a Spring Bean."*

Think of annotations as **sticky notes** attached to your code. The sticky note on `UserService` says: *register me inside the Spring container.*

## Who Reads These Annotations?

The Java compiler stores (runtime-retained) annotations inside the `.class` file:

```flow-h
UserService.java
: javac
UserService.class
```

The annotation is now part of the compiled class metadata. **Spring reads that metadata while starting the application.**

## Spring Startup Flow

```java
@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

When this executes:

```flow This entire sequence happens before your REST API handles the first request
main()
SpringApplication.run()
Create ApplicationContext
Start Spring container
Scan packages
Find classes
Read annotations
Create beans
Dependency injection
Application ready
```

## Step 1 — Spring Starts

```java
SpringApplication.run(App.class, args);
```

Internally, Spring creates an **`ApplicationContext`**. Think of it as a giant warehouse:

```buckets ApplicationContext — every managed object lives inside this container
Contents: Beans, Configurations, Properties, Controllers, Services, Repositories
```

## Step 2 — Component Scan Starts

Spring now scans packages. Suppose your project is:

```tree
com.demo
  DemoApplication
  controller
    UserController
  service
    UserService
  repository
    UserRepository
```

Spring recursively visits every class under the base package.

## Step 3 — Reading the Class

Suppose Spring finds:

```java
@Service
public class UserService {
}
```

It reads the class **metadata** — not the object, just metadata. Conceptually it checks:

```java
if (class.hasAnnotation(Service.class)) {
    // register it
}
```

With plain Java Reflection, that would look like:

```java
Class<?> clazz = UserService.class;
boolean result = clazz.isAnnotationPresent(Service.class);
```

```output
true
```

Spring now knows: this class should become a bean.

> [!NOTE]
> For speed, Spring's component scan actually reads the `.class` files with a bytecode metadata reader (ASM) **without loading the classes**, and it recognizes `@Service` because `@Service` is itself annotated with `@Component` (a meta-annotation).

## Step 4 — BeanDefinition

Spring does **not** immediately create the object. Instead it creates a **`BeanDefinition`** — a blueprint.

```tree BeanDefinition
BeanDefinition
  Bean name | userService
  Class | UserService.class
  Scope | singleton
  Constructor + dependencies
  Lazy? Primary?
```

No object yet — only metadata.

## Step 5 — Bean Creation

Later, Spring begins creating objects — equivalent to `new UserService()`, but instead of your code calling `new`, **the container creates the object**:

```flow-h Now the object becomes a Spring Bean
Spring container
new UserService()
Store object
```

## Step 6 — Dependency Injection

```java
@Service
public class UserService {

    @Autowired
    private UserRepository repository;
}
```

Spring creates the `UserRepository` bean, then the `UserService` bean, and then injects `repository` → the `UserRepository` object.

How it is injected depends on how the bean is defined:

- **Field injection** (as above): Spring sets the private field directly via Reflection.
- **Setter injection**: Spring calls `userService.setRepository(repository)`.
- **Constructor injection**: Spring passes the repository into the constructor.

## Complete Startup Picture

```flow
main()
SpringApplication.run()
ApplicationContext
Component scan
Read class metadata
Found @Component
Create BeanDefinition
Instantiate object
Inject dependencies
Bean ready
Application ready
```

## What Happens If There Is No Annotation?

```java
public class UserService {
}
```

During scanning:

```flow-h
UserService
No @Component
Ignored
```

Spring never creates it, so this fails:

```java
@Autowired
private UserService service;
```

```output
NoSuchBeanDefinitionException: No qualifying bean of type 'UserService' available
```

…because the object doesn't exist in the Spring container.

## How Does Spring Scan Packages?

If `@SpringBootApplication` is in `com.demo`, Spring scans `com.demo.*` — `controller`, `service`, `repository`, `config`, `security` and everything below.

But **not** `org.example` or `com.other`, unless you explicitly configure component scanning.

## Why Do We Need a Spring Container?

Without Spring, you manually create every object:

```java
UserRepository repository = new UserRepository();
UserService service = new UserService(repository);
UserController controller = new UserController(service);
```

With Spring:

```java
@RestController
class UserController {

    @Autowired
    UserService service;
}
```

Spring creates and wires everything automatically.

## Common Interview Questions

### Q1. What is an annotation?

Metadata that provides instructions to the compiler, runtime or frameworks like Spring without changing the business logic.

### Q2. Does @Component execute code?

No. It is metadata. Spring reads it during startup and uses it to register a bean.

### Q3. How does Spring detect annotations?

During component scanning, Spring reads class metadata (using optimized metadata readers and reflection) and checks for known annotations such as `@Component`, `@Service` and `@Repository`.

### Q4. What is a BeanDefinition?

Metadata that describes how Spring should create and manage a bean, including its class, scope, constructor arguments, dependencies and lifecycle settings.

### Q5. Does Spring create beans immediately after scanning?

Not necessarily. Spring first registers bean definitions. Bean instantiation happens later during context initialization (singletons are created eagerly at the end of startup), or on first use for lazy beans.

### Q6. Why is @SpringBootApplication usually placed in the root package?

Because component scanning starts from the package containing the main application class and recursively scans its subpackages. Placing it at the root ensures all application components are discovered.

## Key Takeaways

- ✅ Annotations are metadata, not executable code.
- ✅ Spring starts by creating an `ApplicationContext`.
- ✅ Component scanning discovers candidate classes.
- ✅ Spring registers `BeanDefinition` objects before creating bean instances.
- ✅ The container instantiates beans and performs dependency injection.
- ✅ Classes without recognized stereotype annotations (or another registration mechanism) are not managed by Spring.
