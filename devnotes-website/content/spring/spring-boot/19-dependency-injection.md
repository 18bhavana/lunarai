---
title: Dependency Injection
subtitle: "IoC vs DI, the IoC container, @Autowired, constructor vs setter vs field injection, @Qualifier, @Primary, the bean resolution algorithm, @Lazy, circular dependencies and ObjectProvider."
order: 19
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

If there is one Spring topic every interviewer asks — from freshers to architects — it is **Dependency Injection (DI)**. Almost every Spring Boot application uses `@Autowired`, constructor injection, `@Qualifier`, `@Primary` and `@Lazy`.

Interviewers commonly ask: What is DI? What is IoC? How does Spring create objects? What is bean resolution? What happens internally when Spring starts? How does `@Autowired` work? What happens if multiple beans exist? `@Primary` vs `@Qualifier`? How does `@Lazy` work? What causes circular dependencies?

## What is Dependency Injection?

> [!IMPORTANT]
> Instead of an object creating its own dependencies, **Spring creates and injects them**.

### Without DI

```java
public class UserService {

    private UserRepository repository = new UserRepository();
}
```

**Problems:** tight coupling, difficult to test, hard to replace implementations, and it violates the Dependency Inversion Principle.

### With DI

```java
@Service
public class UserService {

    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }
}
```

Spring creates the repository and injects it.

## What is Inversion of Control (IoC)?

Many developers confuse IoC and DI.

```flow
Without Spring
Application creates objects
Application controls objects
---
With Spring
Spring container creates objects
Manages objects
Injects dependencies
```

Without Spring, your code does `new UserRepository()` and `new UserService(repo)` — **your application controls object creation**. With Spring, **Spring controls object creation**, not your code. This inversion of responsibility is called **Inversion of Control**.

### IoC vs DI

| IoC | DI |
| --- | --- |
| Design principle | Implementation technique |
| Spring controls object creation | Spring injects dependencies |
| Bigger concept | One way to achieve IoC |

**DI is one implementation of IoC.**

## The Spring IoC Container

The IoC container is responsible for **creating beans, managing bean lifecycle, injecting dependencies and destroying beans**.

Main interfaces: **`BeanFactory`** and **`ApplicationContext`**. `ApplicationContext` extends `BeanFactory` and adds event publishing, internationalization (i18n), resource loading, the environment abstraction and bean post-processing support.

```flow Application startup
@SpringBootApplication
SpringApplication.run()
Create ApplicationContext
Component scan
Create BeanDefinitions
Instantiate beans
Inject dependencies
Application ready
```

## What is @Autowired?

`@Autowired` tells Spring: *find a suitable bean and inject it here.*

```java
@Service
public class UserService {

    @Autowired
    private UserRepository repository;
}
```

### How @Autowired Works Internally

```flow-h
Create UserRepository bean
Create UserService bean
Find @Autowired field
Resolve matching bean
Inject bean
```

## Injection Types

### Constructor Injection (Recommended)

```java
@Service
public class UserService {

    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }
}
```

Since Spring Framework 4.3, if a bean has a **single constructor**, `@Autowired` on it is optional.

**Why constructor injection?** Immutable dependencies (`final`), easier unit testing, mandatory dependencies, better design, and no partially initialized objects. **The enterprise standard.**

### Setter Injection

```java
@Service
public class UserService {

    private UserRepository repository;

    @Autowired
    public void setRepository(UserRepository repository) {
        this.repository = repository;
    }
}
```

Useful when the dependency is optional or can be changed.

### Field Injection

```java
@Service
public class UserService {

    @Autowired
    private UserRepository repository;
}
```

Easy to write, but hard to unit test, hides dependencies, can't use `final`, and is **discouraged** in modern Spring applications.

### Comparison

| | Constructor | Setter | Field |
| --- | --- | --- | --- |
| Recommendation | ✅ Recommended | For optional dependencies | ❌ Not recommended |
| Mutability | Immutable | Mutable | Mutable |
| Testing | Easy | Medium | Difficult |
| Supports `final` | Yes | No | No |

## What If Multiple Beans Exist?

```java
public interface PaymentService {
}

@Service
public class CreditCardService implements PaymentService {
}

@Service
public class UpiService implements PaymentService {
}

@Autowired
private PaymentService paymentService;
```

Spring finds **two** beans:

```output
NoUniqueBeanDefinitionException: expected single matching bean but found 2: creditCardService,upiService
```

### @Qualifier

Specify exactly which bean to inject:

```java
@Service("upiService")
public class UpiService implements PaymentService {
}

@Autowired
@Qualifier("upiService")
private PaymentService paymentService;
```

Spring injects only `UpiService`.

### @Primary

```java
@Service
@Primary
public class UpiService implements PaymentService {
}

@Autowired
private PaymentService paymentService;   // UpiService — the default candidate
```

### @Primary vs @Qualifier

**Interview favourite.**

| @Primary | @Qualifier |
| --- | --- |
| Default bean | Specific bean |
| Global preference | Local selection |
| Used automatically | Explicitly requested |

**Rule: `@Qualifier` wins over `@Primary`.**

## Bean Resolution Algorithm

When Spring sees `@Autowired PaymentService paymentService`:

```flow This algorithm is frequently asked in senior interviews
Find beans matching the type
? Exactly one? | Yes: Inject it | No: Narrow down
Check @Qualifier
Check @Primary (then @Priority)
Match by field / parameter name
Still several? NoUniqueBeanDefinitionException
```

## @Lazy

Normally, when the application starts, **all singleton beans are created**. With `@Lazy`:

```java
@Lazy
@Service
public class ReportService {
}
```

```flow-h
Application starts
Bean not created
First usage
Create bean
Inject
```

Lazy initialization can reduce startup time but delays bean creation (and any configuration errors) until the bean is needed.

> [!NOTE]
> If a normal (eager) bean injects a `@Lazy` bean directly, the lazy bean is still created at startup to satisfy that dependency — unless the injection point is also `@Lazy`.

### @Lazy at the Injection Point

```java
@Service
public class UserService {

    private final ReportService reportService;

    public UserService(@Lazy ReportService reportService) {
        this.reportService = reportService;
    }
}
```

Spring injects a **proxy**; the real bean is created only when first accessed.

## Circular Dependency

```java
@Service
class UserService {
    UserService(OrderService service) {}
}

@Service
class OrderService {
    OrderService(UserService service) {}
}
```

```flow-h Spring can't construct either bean because each needs the other first
UserService
: needs
OrderService
: needs
UserService
```

Result: `BeanCurrentlyInCreationException` — *the dependencies of some of the beans form a cycle*.

> [!WARNING]
> Since **Spring Boot 2.6**, circular references are **prohibited by default** even with field/setter injection (`spring.main.allow-circular-references=false`). Treat a cycle as a design problem.

### Solving Circular Dependencies

- Redesign responsibilities (**best solution**)
- Introduce a third service
- Use events or callbacks
- In some cases, use `@Lazy`:

```java
public OrderService(@Lazy UserService service) {
}
```

`@Lazy` can break certain circular references by injecting a proxy, but redesigning the dependency graph is preferred.

## Injecting Collections and Maps

Spring can inject **every** implementation:

```java
@Autowired
private List<PaymentService> services;   // CreditCardService, UpiService, PaypalService
```

```java
@Autowired
private Map<String, PaymentService> services;
```

```output
upiService        -> UpiService
creditCardService -> CreditCardService
```

Keys are bean names — useful for strategy and plugin patterns.

## Optional Dependencies

```java
@Autowired(required = false)
private AuditService auditService;   // null if no bean exists
```

Modern alternative:

```java
private final Optional<AuditService> auditService;

public UserService(Optional<AuditService> auditService) {
    this.auditService = auditService;
}
```

### ObjectProvider

For lazy and optional access:

```java
@Autowired
private ObjectProvider<PaymentService> provider;

PaymentService service = provider.getIfAvailable();
```

Useful when bean creation is expensive or conditional.

## Internal Spring Components

```flow
@ComponentScan
BeanDefinition
DefaultListableBeanFactory
Instantiate bean
AutowiredAnnotationBeanPostProcessor
Resolve dependency
Inject bean
Application ready
```

Important internal classes: **`DefaultListableBeanFactory`**, **`AutowiredAnnotationBeanPostProcessor`**, **`DependencyDescriptor`** and **`ConstructorResolver`** — common discussion points in senior interviews.

## Common Mistakes

- ❌ **Field injection everywhere** — prefer constructor injection.
- ❌ **Multiple beans without a qualifier** — use `@Qualifier("upiService")` or `@Primary`.
- ❌ **Using `@Primary` everywhere** — use it only when there's a clear default implementation.
- ❌ **Circular dependencies** — fix the design; don't rely on `@Lazy` as the default solution.
- ❌ **Manual object creation** (`new UserRepository()`) inside Spring-managed beans — let Spring manage creation and injection.

## Interview Questions

### Q1. What is Dependency Injection?

A design pattern where dependencies are provided by an external container instead of being created by the object itself.

### Q2. What is IoC?

Inversion of Control is the principle where the framework controls object creation and lifecycle rather than the application code.

### Q3. What is the difference between IoC and DI?

| IoC | DI |
| --- | --- |
| Principle | Technique |
| Controls the object lifecycle | Injects dependencies |
| Broad concept | Practical implementation |

### Q4. Which injection type is recommended?

**Constructor injection**, because it promotes immutability, testability and explicit dependencies.

### Q5. What happens if multiple beans of the same type exist?

Spring throws `NoUniqueBeanDefinitionException`, unless the choice is resolved using `@Qualifier`, `@Primary` or another qualifying mechanism.

### Q6. What is the difference between @Primary and @Qualifier?

- `@Primary` defines the default bean.
- `@Qualifier` explicitly selects a specific bean.
- `@Qualifier` takes precedence over `@Primary`.

### Q7. What is @Lazy?

It delays bean creation until the bean is first needed, typically by injecting a proxy.

### Q8. Which class processes @Autowired?

`AutowiredAnnotationBeanPostProcessor`.

### Q9. Which class performs dependency resolution?

`DefaultListableBeanFactory`.

### Q10. What is the bean resolution order?

Type match → `@Qualifier` → `@Primary` → name → exception.

## Key Takeaways

- ✅ DI reduces coupling by letting Spring provide dependencies.
- ✅ IoC is the broader principle; DI is Spring's primary implementation of it.
- ✅ Prefer constructor injection over field or setter injection.
- ✅ Use `@Qualifier` when multiple beans exist; `@Primary` defines a default.
- ✅ `@Lazy` postpones bean creation until first use and can break some cycles.
- ✅ `DefaultListableBeanFactory` resolves dependencies; `AutowiredAnnotationBeanPostProcessor` processes `@Autowired`.
- ✅ Know the bean resolution algorithm for senior interviews.
