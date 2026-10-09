---
title: "@Value"
subtitle: Injecting configuration — ${...} placeholders, defaults, type conversion, environment variables and system properties, SpEL #{...}, lists and maps, static-field pitfalls and @Value vs @ConfigurationProperties.
order: 27
---

## Introduction

> [!NOTE]
> **Interview importance: 9.5/10.**

`@Value` is one of the most commonly used Spring annotations, primarily for **injecting configuration values** into Spring-managed beans. Most applications use it to read properties from `application.properties`, environment variables and JVM system properties, to inject default values, and to evaluate Spring Expression Language (SpEL).

Interviewers frequently ask: What is `@Value`? How does Spring resolve `${...}`? `@Value` vs `@ConfigurationProperties`? What is SpEL? Can `@Value` inject lists? Can it be used on static fields? When should you avoid it?

## What is @Value?

`@Value` injects a value into a Spring-managed bean from `application.properties`, `application.yml`, environment variables, JVM system properties or SpEL.

```java
@Component
public class MailService {

    @Value("${mail.host}")
    private String host;
}
```

```text
mail.host=smtp.gmail.com
```

Result: `host = smtp.gmail.com`.

## Where Can @Value Be Used?

On **fields**, **constructor parameters**, **method parameters** and **setter methods**.

```java
@Service
public class EmailService {

    private final String sender;

    public EmailService(@Value("${mail.sender}") String sender) {
        this.sender = sender;
    }
}
```

Constructor injection is generally preferred because it makes dependencies explicit and improves testability.

## Property Resolution

```java
@Value("${server.port}")
private int port;
```

```flow-h
Application starts
Load property sources
Create Environment
Resolve placeholder
Inject value
Bean ready
```

### Internal Architecture

```flow-h
application.properties
PropertySource
Environment
PropertySourcesPropertyResolver
AutowiredAnnotationBeanPostProcessor
Reflection → field injection
```

## Property Sources

Spring searches multiple property sources. Typical order (simplified, highest priority first):

1. Command-line arguments
2. JVM system properties
3. Environment variables
4. `application.properties` / `application.yml`
5. The default value in the annotation

Higher-priority sources override lower-priority ones.

## Placeholder Syntax

```java
@Value("${server.port}")
private int port;
```

`${}` means *resolve this value from Spring's configured property sources*.

### Default Values

```java
@Value("${server.port:8080}")
private int port;
```

If `server.port` doesn't exist, `port = 8080`.

```flow
? Does the property exist? | Yes: Inject its value | No: Inject the default
```

## Type Conversion

```java
@Value("${server.port}")
private int port;

@Value("${feature.enabled}")
private boolean enabled;

@Value("${discount.rate}")
private double rate;

@Value("${company.name}")
private String company;
```

Spring automatically converts the string value into the required Java type using its conversion service.

## Environment Variables

If the operating system contains `DB_PASSWORD=secret123`:

```java
@Value("${DB_PASSWORD}")
private String password;
```

Widely used in Docker and Kubernetes deployments.

## JVM System Properties

```text
java -Dregion=US -jar app.jar
```

```java
@Value("${region}")
private String region;
```

## Spring Expression Language (SpEL)

**`#{}` is different from `${}`:**

- `${}` reads **configuration properties**.
- `#{}` **evaluates a Spring expression**.

```java
@Value("#{10 + 20}")
private int total;   // 30
```

### Access Another Bean

```java
@Component
public class AppConfig {

    public String getVersion() {
        return "1.0";
    }
}

@Value("#{appConfig.version}")
private String version;
```

Spring evaluates the expression and invokes the getter.

### Calling Static Methods

```java
@Value("#{T(java.lang.Math).max(100, 200)}")
private int max;   // 200

@Value("#{T(java.time.LocalDateTime).now()}")
private LocalDateTime now;
```

## Collections and Maps

```text
roles=ADMIN,USER,MANAGER
```

```java
@Value("#{'${roles}'.split(',')}")
private List<String> roles;   // ADMIN, USER, MANAGER
```

(Spring's conversion service can also turn a comma-separated value into a list directly: `@Value("${roles}") List<String> roles`.)

### Map (SpEL)

```text
app.settings={timeout:'30', region:'IN'}
```

```java
@Value("#{${app.settings}}")
private Map<String, String> settings;
```

The property must be written as a SpEL map literal, as above.

## Using Environment

Instead of `@Value`, you can inject the `Environment`:

```java
@Autowired
private Environment environment;

String port = environment.getProperty("server.port");
```

Useful when property names are **dynamic**.

## Pitfalls

### Static Fields

```java
@Value("${app.name}")
private static String appName;   // ❌ stays null
```

Spring injects values into **bean instances**, not into the class itself, so static fields aren't injected.

### Non-Spring Classes

```java
public class Utility {

    @Value("${app.name}")
    private String name;   // ❌ null when created with new Utility()
}
```

Spring only injects into objects it manages (beans).

### Constructor Injection Example

```java
@Service
public class PaymentService {

    private final String currency;

    public PaymentService(@Value("${payment.currency:USD}") String currency) {
        this.currency = currency;
    }
}
```

Advantages: immutable fields, easier testing, clear dependencies.

## Internal Resolution Flow

```flow
SpringApplication.run()
Load property sources
Create ConfigurableEnvironment
Create BeanDefinition
Instantiate bean
AutowiredAnnotationBeanPostProcessor resolves @Value
PropertySourcesPropertyResolver
ConversionService
Reflection → inject field
Bean ready
```

### Important Internal Classes

| Class | Responsibility |
| --- | --- |
| `Environment` | Provides access to properties |
| `ConfigurableEnvironment` | Holds configurable property sources |
| `PropertySource` | Represents one source of configuration values |
| `MutablePropertySources` | Ordered collection of property sources |
| `PropertySourcesPropertyResolver` | Resolves `${...}` placeholders |
| `AutowiredAnnotationBeanPostProcessor` | Processes `@Autowired` and `@Value` |
| `TypeConverter` / `ConversionService` | Converts strings to target Java types |

## @Value vs @ConfigurationProperties

| @Value | @ConfigurationProperties |
| --- | --- |
| Good for a few values | Best for groups of related settings |
| Individual property injection | Binds an entire configuration object |
| Supports SpEL | No SpEL in property binding |
| Can become repetitive | Cleaner for large configurations |
| Harder to maintain for many properties | Easier to validate and maintain |

```text
mail.host=smtp.gmail.com
mail.port=587
mail.username=admin
mail.password=secret
```

Four separate `@Value` fields are possible, but one configuration class with `@ConfigurationProperties` is usually cleaner.

## Common Mistakes

- ❌ **Forgetting `${}`** — `@Value("server.port")` injects the literal string `"server.port"`. Correct: `@Value("${server.port}")`.
- ❌ **Using `@Value` for large configurations** (`db.host`, `db.port`, `db.user`, `db.password`, …) — prefer `@ConfigurationProperties`.
- ❌ **Missing properties** — `@Value("${missing.property}")` fails startup (*Could not resolve placeholder*). Use `@Value("${missing.property:defaultValue}")` when a sensible default exists.
- ❌ **Using `@Value` in utility classes** — only Spring-managed beans receive injected values.
- ❌ **Injecting static fields** — Spring doesn't inject them.

## Best Practices

- ✅ Use constructor injection with `@Value`.
- ✅ Reserve `@Value` for a small number of configuration values.
- ✅ Use `@ConfigurationProperties` for structured configuration.
- ✅ Keep secrets (passwords, API keys) in environment variables or secret stores, not in source control.
- ✅ Use default values only when they genuinely make sense.

## Enterprise Example

```flow-h
application.yml + environment variables
ConfigurableEnvironment
@ConfigurationProperties / @Value
@Service
Business logic
```

In enterprise projects, simple feature flags often use `@Value`, while database, messaging, mail and cloud configuration usually use `@ConfigurationProperties`.

## Interview Questions

### Q1. What is @Value?

It injects values from Spring property sources, or the result of SpEL expressions, into Spring-managed beans.

### Q2. Difference between ${} and #{}?

| ${} | #{} |
| --- | --- |
| Property placeholder | Spring Expression Language |
| Reads configuration | Evaluates expressions, bean references and method calls |

### Q3. Can @Value inject lists?

Yes. Comma-separated values can be converted to a `List` (directly or via SpEL `split`).

### Q4. Can @Value inject maps?

Yes, with a SpEL expression and a property written as a map literal.

### Q5. Why doesn't @Value work on static fields?

Because Spring performs dependency injection on bean instances, not on class-level static members.

### Q6. What happens if the property is missing?

Without a default value, Spring fails at startup because it can't resolve the placeholder.

### Q7. Which is better — @Value or @ConfigurationProperties?

`@Value` suits a few isolated values; `@ConfigurationProperties` is preferred for structured, grouped configuration.

### Q8. Which Spring class resolves @Value?

`AutowiredAnnotationBeanPostProcessor` detects the annotation; `PropertySourcesPropertyResolver` resolves the placeholder via the configured `Environment`.

## Key Takeaways

- ✅ `@Value` injects configuration values into Spring-managed beans.
- ✅ `${...}` resolves properties; `#{...}` evaluates SpEL.
- ✅ Values come from the `Environment` and its ordered `PropertySource`s.
- ✅ Constructor injection is the preferred way to use `@Value`.
- ✅ Use `@Value` for a few properties; prefer `@ConfigurationProperties` for groups.
- ✅ `@Value` doesn't work on static fields or non-Spring objects.
