---
title: "@ConfigurationProperties"
subtitle: Type-safe configuration binding — prefixes, relaxed binding, nested objects, lists, maps, Duration and DataSize, validation, constructor binding and records, registration options and the Binder internals.
order: 28
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

`@ConfigurationProperties` is the **enterprise-standard way to bind external configuration into Java objects**. Beginners often use `@Value` everywhere; experienced Spring Boot developers use `@ConfigurationProperties` for maintainable, type-safe and validated configuration.

Almost every enterprise application has configuration classes for the database, Redis, Kafka, RabbitMQ, JWT, AWS, Azure, SMTP, payment gateways, Elasticsearch and external APIs.

Interviewers frequently ask: What is `@ConfigurationProperties`? `@Value` vs `@ConfigurationProperties`? What is relaxed binding? What is constructor binding? How are nested objects, lists and maps bound? How does validation work? Which internal classes perform the binding?

## What is @ConfigurationProperties?

It **binds a group of related configuration properties into a Java object**.

```text
mail.host=smtp.gmail.com
mail.port=587
mail.username=admin
mail.password=secret
```

Instead of writing:

```java
@Value("${mail.host}")
private String host;

@Value("${mail.port}")
private int port;

@Value("${mail.username}")
private String username;

@Value("${mail.password}")
private String password;
```

use:

```java
@ConfigurationProperties(prefix = "mail")
public class MailProperties {
    private String host;
    private int port;
    private String username;
    private String password;
    // getters and setters
}
```

Cleaner. Safer. The enterprise standard.

## Why Was It Introduced?

Imagine:

```text
payment.timeout=30
payment.currency=USD
payment.retry=5
payment.api-key=abc123
payment.base-url=https://api.example.com
payment.max-connections=20
payment.read-timeout=5000
payment.connect-timeout=3000
```

With `@Value`, after 20–30 properties, maintenance becomes difficult. Instead: **one `PaymentProperties` object holds all payment configuration.**

## Basic Example

```text
app:
  server:
    host: localhost
    port: 8080
```

```java
@Component
@ConfigurationProperties(prefix = "app.server")
public class ServerProperties {
    private String host;
    private int port;
    // getters/setters
}
```

```java
@Service
public class ServerService {

    private final ServerProperties properties;

    public ServerService(ServerProperties properties) {
        this.properties = properties;
    }
}
```

> [!NOTE]
> Prefer your own prefix (here `app.server`) — `server.*` is already used by Spring Boot's own server settings (`server.port`, …), and a class named `ServerProperties` also exists in Boot.

### Internal Architecture

```flow-h
application.yml
ConfigData loader
Environment
Binder
@ConfigurationProperties
Java object → Spring bean
```

## Property Prefix

```java
@ConfigurationProperties(prefix = "database")
```

Spring binds `database.host`, `database.port`, `database.username` and `database.password`. **Only properties beginning with `database`** are considered.

## Relaxed Binding

**Interview favourite.** Spring Boot understands multiple naming styles. For the Java field `private int maxConnections;` (with prefix `payment`), all of these bind:

```text
payment.max-connections=20      (kebab-case — recommended in files)
payment.maxConnections=20       (camelCase)
payment.max_connections=20      (underscore)
PAYMENT_MAXCONNECTIONS=20       (environment variable)
```

Everything maps to `maxConnections`.

```flow-h
Configuration
Normalize the name
Relaxed binder
Java field
```

> [!TIP]
> Environment variable form: uppercase, replace `.` with `_`, and drop the dashes — `payment.max-connections` → `PAYMENT_MAXCONNECTIONS`.

## Nested Objects

```text
database:
  host: localhost
  pool:
    max-size: 30
    timeout: 5000
```

```java
@ConfigurationProperties(prefix = "database")
public class DatabaseProperties {

    private String host;
    private Pool pool;

    public static class Pool {
        private int maxSize;
        private int timeout;
        // getters/setters
    }
}
```

```tree
DatabaseProperties
  host = localhost
  Pool
    maxSize = 30
    timeout = 5000
```

## List Binding

```text
application:
  roles:
    - ADMIN
    - USER
    - MANAGER
```

```java
private List<String> roles;   // ADMIN, USER, MANAGER
```

No SpEL required.

## Map Binding

```text
application:
  headers:
    Authorization: JWT
    Version: v1
```

```java
private Map<String, String> headers;
```

Bound automatically.

## Duration, DataSize and Enums

```text
cache:
  timeout: 30s
```

```java
private Duration timeout;   // also: 5m, 2h, 1d
```

```text
upload:
  max-file-size: 100MB
```

```java
private DataSize maxFileSize;   // 100 MB
```

```java
public enum Mode {
    DEV,
    PROD
}

// application.mode: PROD → Mode.PROD
```

All converted automatically.

### Type Conversion

| Property value | Java type |
| --- | --- |
| `"8080"` | `int` |
| `"30s"` | `Duration` |
| `"100MB"` | `DataSize` |
| `"PROD"` | Enum |

## Validation

**Interview favourite.**

```java
@ConfigurationProperties(prefix = "mail")
@Validated
public class MailProperties {

    @NotBlank
    private String host;

    @Min(1)
    private int port;
}
```

With `mail.port=-1`, **application startup fails**. Very useful — configuration errors are caught at startup, not in production traffic.

## Constructor Binding

Spring Boot 3.x automatically uses **constructor binding** when a properties class has a single parameterized constructor, so an explicit `@ConstructorBinding` is unnecessary in most cases (it's only needed to pick one of several constructors).

```java
@ConfigurationProperties(prefix = "payment")
public class PaymentProperties {

    private final String currency;
    private final int timeout;

    public PaymentProperties(String currency, int timeout) {
        this.currency = currency;
        this.timeout = timeout;
    }

    public String getCurrency() {
        return currency;
    }

    public int getTimeout() {
        return timeout;
    }
}
```

**Benefits:** immutable, thread-safe, easier testing. A Java **record** works the same way and is even shorter:

```java
@ConfigurationProperties(prefix = "payment")
public record PaymentProperties(String currency, int timeout) {
}
```

## Registration

There are three common ways to turn the class into a bean:

```java
// 1. As a component
@Component
@ConfigurationProperties(prefix = "mail")

// 2. Explicitly
@EnableConfigurationProperties(MailProperties.class)

// 3. By scanning — Spring scans all configuration-property classes
@ConfigurationPropertiesScan
```

(Constructor-bound classes and records can't use `@Component`; register them with option 2 or 3.)

## Internal Binding Flow

```flow
SpringApplication.run()
ConfigData → Environment created
Binder
ConfigurationPropertySource
BindHandler
ConversionService
Validation
Java object
Bean registered
```

### Important Internal Classes

| Class | Responsibility |
| --- | --- |
| `Binder` | Core binding engine |
| `ConfigurationPropertySource` | Reads configuration values |
| `ConfigurationPropertyName` | Normalizes property names |
| `BindHandler` | Controls the binding process |
| `BindContext` | Maintains binding state |
| `ApplicationConversionService` | Converts values to target types |
| `ConfigurationPropertiesBindingPostProcessor` | Processes `@ConfigurationProperties` beans |

## Metadata Generation

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-configuration-processor</artifactId>
    <optional>true</optional>
</dependency>
```

This generates metadata that gives your IDE **auto-completion, documentation and property validation** for your custom configuration properties.

## @Value vs @ConfigurationProperties

| @Value | @ConfigurationProperties |
| --- | --- |
| Single values | Entire object |
| Supports SpEL | Configuration binding only |
| Good for 1–3 properties | Good for many related properties |
| Less maintainable | Highly maintainable |
| Hard to validate | Easy validation |
| Repeated annotations | Centralized configuration |

**Enterprise recommendation:** few properties → `@Value`; many properties → `@ConfigurationProperties`.

## Enterprise Example

```tree One configuration bean instead of 25 individual @Value annotations
PaymentProperties
  API URL
  Timeout
  Retry count
  Credentials
  SSL
  Connection pool
```

## Common Mistakes

- ❌ **Forgetting registration** — a class with only `@ConfigurationProperties` (no `@Component`, `@EnableConfigurationProperties` or `@ConfigurationPropertiesScan`) never becomes a bean.
- ❌ **Using `@Value` everywhere** — large applications become hard to maintain.
- ❌ **Mutable configuration without need** — prefer immutable classes (constructor binding, records).
- ❌ **No validation** — invalid configuration reaches production. Validate critical settings.
- ❌ **Wrong prefix** — `@ConfigurationProperties(prefix = "database")` with `db.host=localhost` binds nothing, because the prefixes don't match.

## Best Practices

- ✅ Group related properties into dedicated classes.
- ✅ Use constructor binding and immutable fields.
- ✅ Validate important configuration with Bean Validation.
- ✅ Use meaningful prefixes (`mail`, `payment`, `security`, `redis`).
- ✅ Keep secrets out of source control — use environment variables or secret managers.

## Real Enterprise Structure

```tree Each configuration area has its own strongly typed class
config
  JwtProperties
  MailProperties
  KafkaProperties
  RedisProperties
  AwsProperties
  PaymentProperties
  SecurityProperties
  StorageProperties
```

## Interview Questions

### Q1. What is @ConfigurationProperties?

It binds a group of related configuration properties into a strongly typed Java object.

### Q2. Why is it better than @Value?

Better maintainability, validation, type-safe binding, nested structures and cleaner code for grouped configuration.

### Q3. What is relaxed binding?

Spring Boot accepts different naming conventions (kebab-case, camelCase, snake_case, uppercase environment variables) and maps them to the same Java field.

### Q4. Can it bind lists?

Yes — a YAML list such as `roles: [ADMIN, USER]` binds to `List<String> roles`.

### Q5. Can it bind maps?

Yes.

### Q6. Can it bind nested objects?

Yes — nested YAML structures map naturally to nested Java classes.

### Q7. Which class performs binding?

The core engine is `Binder`, assisted by `ConfigurationPropertiesBindingPostProcessor` during bean initialization.

### Q8. Can validation be applied?

Yes — `@Validated` together with Bean Validation annotations such as `@NotBlank`, `@Min` or `@Max`.

### Q9. Is @ConstructorBinding still required in Spring Boot 3?

In most cases no — a class with a single parameterized constructor is automatically constructor-bound.

### Q10. Which annotation enables scanning of configuration property classes?

`@ConfigurationPropertiesScan`.

## Key Takeaways

- ✅ `@ConfigurationProperties` is the preferred way to manage structured configuration.
- ✅ It binds related properties into a single, strongly typed object.
- ✅ Relaxed binding maps multiple naming conventions to the same field.
- ✅ Nested objects, collections, maps, `Duration`, `DataSize` and enums bind automatically.
- ✅ Constructor binding with immutable classes (or records) is recommended in Boot 3.
- ✅ Validation catches configuration errors at startup.
- ✅ `Binder` and `ConfigurationPropertiesBindingPostProcessor` power the binding.
