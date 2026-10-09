---
title: Bean Lifecycle
subtitle: "From BeanDefinition to destruction — Aware interfaces, BeanPostProcessor, @PostConstruct, InitializingBean, init/destroy methods, @PreDestroy, bean scopes and BeanFactoryPostProcessor."
order: 20
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

One of the most important Spring interview topics. Almost every senior-level interviewer asks some variation of: Explain the Spring bean lifecycle. When is `@PostConstruct` called? When is `@PreDestroy` called? What's the difference between `BeanFactoryPostProcessor` and `BeanPostProcessor`? What are bean scopes? What is a singleton bean? How are prototype beans destroyed? What happens internally when Spring starts?

Understanding the bean lifecycle explains how Spring **creates, initializes, manages, proxies and destroys** every bean.

## What is a Spring Bean?

A bean is simply an object that is **created by Spring**, **managed by Spring** and **stored inside the IoC container**.

```java
@Service
public class UserService {
}
```

## Complete Bean Lifecycle

```flow This entire lifecycle is a favourite interview topic
Application starts → @ComponentScan
BeanDefinition created
Bean instantiation
Dependency injection
Aware interfaces
BeanPostProcessor — before initialization
@PostConstruct
afterPropertiesSet()
Custom initMethod()
BeanPostProcessor — after initialization
Bean ready for use
Application running
Application shutdown
@PreDestroy
DisposableBean.destroy()
Custom destroyMethod()
Bean removed
```

## Step 1 — BeanDefinition Creation

Spring scans your project for `@Component`, `@Service`, `@Repository`, `@Controller` and `@Configuration` classes. Each discovered bean becomes a **`BeanDefinition`**, which stores metadata such as the bean class, name, scope, lazy/eager initialization, constructor information and lifecycle callbacks. **No object has been created yet.**

## Step 2 — Bean Instantiation

Spring creates the object — internally like `UserService service = new UserService();`. The object exists, but **dependencies aren't injected yet** (except constructor arguments).

## Step 3 — Dependency Injection

```java
@Autowired
private UserRepository repository;
```

```flow-h Now the bean has all its required dependencies
Instantiate bean
Resolve dependencies
Inject repository
```

## Step 4 — Aware Interfaces

If a bean implements an `Aware` interface, Spring injects framework objects:

```java
public class UserService implements BeanNameAware {

    @Override
    public void setBeanName(String name) {
        System.out.println(name);
    }
}
```

Common Aware interfaces: `BeanNameAware`, `BeanFactoryAware`, `ApplicationContextAware`, `EnvironmentAware` and `ResourceLoaderAware`. These are mainly used by framework developers and advanced infrastructure components.

## Step 5 — BeanPostProcessor (Before Initialization)

Spring calls `postProcessBeforeInitialization()`:

```java
@Component
public class MyProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        return bean;
    }
}
```

This runs **before** the bean's init callbacks.

## Step 6 — @PostConstruct

One of the most asked interview questions.

```java
@Service
public class UserService {

    @PostConstruct
    public void init() {
        System.out.println("Bean Initialized");
    }
}
```

Called **once**, after bean creation and dependency injection. Perfect for loading caches, reading configuration, opening connections (if appropriate) and initializing in-memory data.

```flow-h
Create bean
Inject dependencies
@PostConstruct
Bean ready
```

> [!NOTE]
> In Spring Boot 3+ the annotation is `jakarta.annotation.PostConstruct` (it was `javax.annotation.PostConstruct` in Boot 2). It's actually invoked by a built-in `BeanPostProcessor` (`CommonAnnotationBeanPostProcessor`) during the "before initialization" phase.

## Step 7 — InitializingBean

```java
public class UserService implements InitializingBean {

    @Override
    public void afterPropertiesSet() {
    }
}
```

`afterPropertiesSet()` runs **after** `@PostConstruct`. Today `@PostConstruct` is generally preferred because it avoids coupling your class to Spring interfaces.

## Step 8 — Custom initMethod

```java
@Bean(initMethod = "initialize")
public UserService service() {
    return new UserService();
}

public void initialize() {
}
```

Spring calls it **after** `afterPropertiesSet()`.

### Initialization Order

**Interview favourite:**

```flow
Constructor
Dependency injection
Aware methods
BeanPostProcessor (before initialization)
@PostConstruct
afterPropertiesSet()
Custom initMethod()
BeanPostProcessor (after initialization)
```

## Step 9 — BeanPostProcessor (After Initialization)

Spring executes `postProcessAfterInitialization()`. **This is where many Spring features create proxies** — Spring AOP, `@Transactional`, Spring Security, `@Async` and `@Cacheable`.

### Why BeanPostProcessor Matters

```java
@Transactional
public void save() {
}
```

```flow-h
Original bean
Proxy bean
Transaction logic
Original method
```

Without `BeanPostProcessor`, features like `@Transactional` and `@Async` wouldn't work.

## Step 10 — Bean Ready

The bean is fully initialized and lives in the `ApplicationContext`, available to controllers, services and repositories.

## Step 11 — @PreDestroy

When the application stops:

```java
@Service
public class UserService {

    @PreDestroy
    public void destroy() {
        System.out.println("Cleaning Resources");
    }
}
```

Called **before bean destruction**. Useful for closing resources, releasing locks, flushing buffers and stopping background tasks.

## Step 12 — DisposableBean

```java
public class UserService implements DisposableBean {

    @Override
    public void destroy() {
    }
}
```

Again, `@PreDestroy` is generally preferred because it avoids Spring-specific coupling.

## Step 13 — Custom destroyMethod

```java
@Bean(destroyMethod = "cleanup")
public UserService service() {
    return new UserService();
}
```

Spring executes `cleanup()` during shutdown.

### Destruction Order

```flow-h
Application shutdown
@PreDestroy
DisposableBean.destroy()
Custom destroyMethod()
```

## Bean Scopes

**Interview favourite.**

### Singleton (Default)

```java
@Service
public class UserService {
}
```

**One bean for the entire `ApplicationContext`**, shared everywhere. The default scope.

### Prototype

```java
@Scope("prototype")
@Component
public class Report {
}
```

**Every request for the bean creates a new instance.**

> [!WARNING]
> Spring creates prototype beans but **does not manage their destruction** — `@PreDestroy` is not invoked for prototype beans. Also, a prototype injected into a singleton is created **once** (at injection time); use `ObjectProvider` or lookup methods to get a fresh one each time.

### Request Scope

```java
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
```

One bean **per HTTP request**. Only available in web applications. (`@RequestScope` is a shortcut that includes the proxy.)

### Session Scope

```java
@Scope(value = "session", proxyMode = ScopedProxyMode.TARGET_CLASS)
```

One bean **per HTTP session**. Useful for user-specific state. (`@SessionScope` is the shortcut.)

> [!TIP]
> The scoped proxy is what lets you inject a request- or session-scoped bean into a singleton: the singleton holds the proxy, and each call is routed to the current request's/session's instance.

### Application Scope

```java
@Scope(value = "application")
```

One bean for the entire web application (`ServletContext`).

### Scope Comparison

| Scope | Instances |
| --- | --- |
| Singleton | One per `ApplicationContext` |
| Prototype | New instance per lookup |
| Request | One per HTTP request |
| Session | One per HTTP session |
| Application | One per web application |

## BeanFactoryPostProcessor vs BeanPostProcessor

A very important interview topic.

**`BeanFactoryPostProcessor`** works on **`BeanDefinition`s, before beans are created** — e.g. modifying bean definitions, changing bean properties, registering additional bean definitions (`PropertySourcesPlaceholderConfigurer` resolves `${...}` placeholders this way).

**`BeanPostProcessor`** works on **actual bean instances**:

```flow-h
Bean created
BeanPostProcessor
Modify / wrap bean
Return bean
```

…e.g. AOP proxies, transaction proxies, security proxies and logging wrappers.

| BeanFactoryPostProcessor | BeanPostProcessor |
| --- | --- |
| Works on `BeanDefinition` | Works on the bean instance |
| Before instantiation | After instantiation (around initialization) |
| Metadata | Object |
| Runs earlier | Runs later |

This comparison is frequently asked.

## Complete Internal Flow

```flow
SpringApplication.run()
ApplicationContext
Component scan
BeanDefinition
BeanFactoryPostProcessor
Instantiate bean
Dependency injection
Aware interfaces
BeanPostProcessor (before)
@PostConstruct
afterPropertiesSet()
initMethod()
BeanPostProcessor (after) — AOP / transaction proxies
Application ready
Shutdown → @PreDestroy → destroy() → destroyMethod()
```

## Common Mistakes

### Heavy Work in the Constructor

```java
// ❌ At construction time, field/setter dependencies aren't available yet
public UserService() {
    loadLargeCache();
}

// ✅ Better
@PostConstruct
public void init() {
    loadLargeCache();
}
```

### Forgetting the Prototype Lifecycle

Developers often assume `@PreDestroy` runs for prototype beans. **It doesn't** — the application is responsible for cleaning them up if necessary.

### Using BeanPostProcessor for Business Logic

`BeanPostProcessor` is for framework-level customization. Don't implement business rules there.

### Depending on Bean Initialization Order

Don't assume one bean initializes before another unless you define that relationship explicitly (through dependency injection, or `@DependsOn` where appropriate).

## Interview Questions

### Q1. What is the Spring bean lifecycle?

Bean definition → instantiation → dependency injection → Aware interfaces → `BeanPostProcessor` (before) → `@PostConstruct` → `afterPropertiesSet()` → `initMethod()` → `BeanPostProcessor` (after) → bean ready → `@PreDestroy` → `destroy()` → `destroyMethod()`.

### Q2. When is @PostConstruct executed?

After dependency injection is complete and before the bean is made available for use.

### Q3. When is @PreDestroy executed?

Just before a managed bean is destroyed during application shutdown.

### Q4. What is the difference between BeanPostProcessor and BeanFactoryPostProcessor?

| BeanFactoryPostProcessor | BeanPostProcessor |
| --- | --- |
| Operates on `BeanDefinition` metadata | Operates on bean instances |
| Before bean creation | Before and after bean initialization |

### Q5. Which scope is the default?

`singleton`.

### Q6. Does Spring destroy prototype beans?

No. Spring creates them but does not invoke destruction callbacks automatically.

### Q7. Which interface provides the afterPropertiesSet() callback?

`InitializingBean`.

### Q8. Which interface provides the destroy() callback?

`DisposableBean`.

### Q9. Why is BeanPostProcessor important?

It enables framework features such as proxy creation for `@Transactional`, `@Async`, caching and AOP.

### Q10. What is the initialization order?

Constructor → dependency injection → Aware methods → `BeanPostProcessor` (before) → `@PostConstruct` → `afterPropertiesSet()` → `initMethod()` → `BeanPostProcessor` (after).

## Key Takeaways

- ✅ A Spring bean goes through a well-defined lifecycle from creation to destruction.
- ✅ `@PostConstruct` is ideal for initialization after dependency injection.
- ✅ `@PreDestroy` releases resources during shutdown.
- ✅ `BeanFactoryPostProcessor` modifies metadata before instantiation; `BeanPostProcessor` customizes instances around initialization.
- ✅ `singleton` is the default scope; prototype beans aren't destroyed by Spring.
- ✅ Transactions, AOP, security, async execution and caching rely on `BeanPostProcessor` and proxies.
