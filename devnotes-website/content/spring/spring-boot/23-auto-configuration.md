---
title: Auto-Configuration and @SpringBootApplication
subtitle: What happens after pressing Run — @SpringBootApplication, @EnableAutoConfiguration, AutoConfiguration.imports, conditional annotations, SpringApplication.run() internals and overriding defaults.
order: 23
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Every Spring Boot application starts with:

```java
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

Yet many developers can't explain what happens internally after pressing **Run**. Interviewers frequently ask: What does `@SpringBootApplication` do? What is auto-configuration? How does Spring Boot configure itself? What are `@EnableAutoConfiguration`, `@ComponentScan` and `@Configuration`? How does Boot know to configure a `DataSource`? What are conditional annotations? What is `AutoConfiguration.imports`? What happens inside `SpringApplication.run()`?

## Before Spring Boot

In traditional Spring applications, developers configured almost everything manually:

```java
@Bean
public DataSource dataSource() {
}

@Bean
public EntityManagerFactory entityManagerFactory() {
}

@Bean
public DispatcherServlet dispatcherServlet() {
}

@Bean
public ViewResolver viewResolver() {
}
```

Lots of XML or Java configuration.

## With Spring Boot

Just add `spring-boot-starter-web`, put `@SpringBootApplication` on the main class, run it — and everything works. **How? Auto-configuration.**

## What is Auto-Configuration?

> [!IMPORTANT]
> Spring Boot **automatically configures beans** based on your dependencies (classpath), configuration properties, existing beans and the environment.

Instead of you declaring `@Bean DispatcherServlet`, `@Bean ObjectMapper` and `@Bean Tomcat`, Spring Boot creates them automatically.

### Spring Boot Startup

```flow This flow is asked very frequently
main()
SpringApplication.run()
Create ApplicationContext
Read environment
Component scan
Auto-configuration
Create beans
Start embedded server
Application ready
```

## What is @SpringBootApplication?

Many developers think it's a single annotation. It's actually a **combination of three**:

```tree
@SpringBootApplication
  @Configuration (via @SpringBootConfiguration)
  @EnableAutoConfiguration
  @ComponentScan
```

One of the most common interview questions. (Precisely, it's meta-annotated with `@SpringBootConfiguration`, a specialization of `@Configuration`.)

### @Configuration

Marks a class as a configuration class:

```java
@Configuration
public class AppConfig {

    @Bean
    public UserService userService() {
        return new UserService();
    }
}
```

Spring processes this class and registers the beans.

### @Bean

```java
@Bean
public UserRepository repository() {
    return new UserRepository();
}
```

Spring registers a `UserRepository` bean inside the `ApplicationContext`.

### @ComponentScan

Automatically scans packages for `@Component`, `@Service`, `@Repository` and `@Controller` classes and creates beans.

```tree
com.company
  controller
  service
  repository
  config
```

### Component Scan Rules

If `@SpringBootApplication` is in `com.company`, Spring scans `com.company` and **all sub-packages**. It does **not** scan sibling or parent packages automatically. That's why the main class is usually placed in the root package.

## @EnableAutoConfiguration

**The magic annotation.** It tells Spring Boot: *configure the application automatically based on the classpath and environment.*

| Dependency | Spring Boot detects and configures |
| --- | --- |
| `spring-boot-starter-web` | `DispatcherServlet`, Jackson, embedded Tomcat, Web MVC |
| `spring-boot-starter-data-jpa` | Hibernate, `EntityManager`, JPA repositories, transaction manager |
| `spring-boot-starter-security` | `SecurityFilterChain`, security filters, a default user — unless you provide your own configuration |

No manual configuration.

## How Does Spring Boot Know?

**Interview favourite.**

```flow-h
@EnableAutoConfiguration
AutoConfigurationImportSelector
Read AutoConfiguration.imports
Load configuration classes
```

In modern Spring Boot, auto-configuration classes are listed in:

```text
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

> [!NOTE]
> This file format was introduced in Spring Boot **2.7**; older versions listed auto-configurations in `META-INF/spring.factories`, and Boot 3.0 removed that support for auto-configuration.

### AutoConfiguration.imports

The file contains entries such as `DataSourceAutoConfiguration`, `WebMvcAutoConfiguration`, `JacksonAutoConfiguration`, `JpaRepositoriesAutoConfiguration` and `SecurityAutoConfiguration`. Spring Boot loads these configuration classes.

## Auto-Configuration Examples

### DataSource

```text
spring.datasource.url=jdbc:mysql://localhost:3306/app
spring.datasource.username=root
spring.datasource.password=secret
```

```flow-h No @Bean required
Read properties
DataSourceAutoConfiguration
Create HikariDataSource
Bean registered
```

### Embedded Tomcat

With `spring-boot-starter-web`, Spring Boot creates **embedded Tomcat on port 8080** and the `DispatcherServlet`. If you use another server starter (Jetty or Undertow), Boot configures that server instead.

### Jackson

With `spring-boot-starter-web`, Boot detects Jackson and creates an `ObjectMapper` — JSON works automatically.

## Conditional Annotations

Auto-configuration uses **conditional annotations** extensively:

```java
@ConditionalOnClass
@ConditionalOnBean
@ConditionalOnMissingBean
@ConditionalOnProperty
@ConditionalOnWebApplication
@ConditionalOnExpression
```

### @ConditionalOnClass

```java
@ConditionalOnClass(DataSource.class)
```

```flow
? Is DataSource on the classpath? | Yes: Create bean | No: Skip
```

### @ConditionalOnMissingBean

**Interview favourite.**

```flow
? Did the user provide this bean? | No: Create the default bean | Yes: Use the user's bean
```

If you create:

```java
@Bean
PasswordEncoder encoder() {
    return new BCryptPasswordEncoder();
}
```

Spring Boot won't create another `PasswordEncoder` where its auto-configuration is guarded by `@ConditionalOnMissingBean`. This is how Boot **backs off**.

### @ConditionalOnBean

```java
@ConditionalOnBean(DataSource.class)
```

Creates the bean only if a `DataSource` bean exists. Useful for dependent configuration.

### @ConditionalOnProperty

```text
feature.email=true
```

```java
@ConditionalOnProperty(name = "feature.email", havingValue = "true")
```

The bean is created only when the property matches.

### Auto-Configuration Flow

```flow
Dependency on the classpath
AutoConfiguration.imports
Configuration class
Conditional checks
@Bean methods
ApplicationContext
```

## SpringApplication.run()

One of the most asked interview questions.

```flow
main()
SpringApplication.run()
Create SpringApplication
Prepare environment
Create ApplicationContext
Load bean definitions
Refresh context
Start embedded server
Application ready
```

### ApplicationContext Refresh

During `refresh()`, Spring runs the `BeanFactory` setup, `BeanFactoryPostProcessor`s, registers `BeanPostProcessor`s, instantiates beans, performs dependency injection and runs `@PostConstruct` — this connects directly to the Bean Lifecycle chapter. The embedded web server is also created and started as part of the refresh.

## External Configuration

Spring Boot reads configuration from multiple sources. Simplified order (highest precedence first):

1. Command-line arguments
2. Environment variables
3. `application.properties` / `application.yml`
4. Default values

This allows the same application to behave differently in different environments.

### @ConfigurationProperties

Instead of `@Value("${app.name}")`, use:

```java
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String name;
    private Integer timeout;
}
```

```text
app.name=Ticket Booking
app.timeout=30
```

Spring binds the properties into the Java object — the preferred approach for related configuration values (covered in its own chapter).

## Overriding Auto-Configuration

Spring Boot provides a default `ObjectMapper`. If you create your own:

```java
@Bean
ObjectMapper objectMapper() {
    return new ObjectMapper();
}
```

…Boot's auto-configuration **backs off** because of `@ConditionalOnMissingBean`.

> [!WARNING]
> A bare `new ObjectMapper()` loses Boot's customizations (Java time support, `spring.jackson.*` properties). To tweak Jackson, prefer a `Jackson2ObjectMapperBuilderCustomizer` bean or `spring.jackson.*` properties.

## Internal Spring Boot Components

Important classes: `SpringApplication`, `AutoConfigurationImportSelector`, `ConfigurationClassParser`, `DefaultListableBeanFactory` and `ApplicationContext` — interview favourites.

## Complete Startup Flow

```flow
main()
SpringApplication.run()
Environment
ApplicationContext
Component scan + @Configuration
@EnableAutoConfiguration
AutoConfigurationImportSelector
AutoConfiguration.imports
Conditional checks
Bean creation + dependency injection
@PostConstruct
Embedded Tomcat
Application ready
```

## Common Mistakes

- ❌ **Main class in the wrong package** — with the main class in `com.company.app` and components in unrelated sibling packages, scanning misses them. Place the main class near the root package.
- ❌ **Creating duplicate beans** (e.g. `@Bean ObjectMapper`) without understanding the existing auto-configuration — this replaces Boot's default behaviour.
- ❌ **Using `@Value` everywhere** — prefer `@ConfigurationProperties` for grouped configuration.
- ❌ **Disabling auto-configuration unnecessarily** — only exclude when required:

```java
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
```

## Enterprise Architecture

```flow
main()
SpringApplication.run()
ApplicationContext
Component scan
Auto-configuration + conditional checks
Create beans
Embedded server
Security filters
DispatcherServlet
Controllers → services → repositories
Application running
```

## Interview Questions

### Q1. What does @SpringBootApplication do?

It combines `@Configuration` (as `@SpringBootConfiguration`), `@EnableAutoConfiguration` and `@ComponentScan`.

### Q2. What is auto-configuration?

A Spring Boot feature that automatically configures beans based on the classpath, configuration properties, environment and existing beans.

### Q3. Which annotation enables auto-configuration?

`@EnableAutoConfiguration`.

### Q4. Which class loads auto-configurations?

`AutoConfigurationImportSelector`.

### Q5. Where are auto-configuration classes listed?

In `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (Spring Boot 2.7+ / 3.x).

### Q6. What is @ConditionalOnMissingBean?

It creates a bean only if a bean of the required type isn't already present.

### Q7. Why is @ConfigurationProperties preferred over @Value?

It groups related properties, is type-safe, supports validation and is easier to maintain.

### Q8. How does Spring Boot know to configure Tomcat?

The embedded server is on the classpath (via the web starter), and auto-configuration detects it and creates the required beans.

### Q9. What happens inside SpringApplication.run()?

Create `SpringApplication` → prepare environment → create `ApplicationContext` → load bean definitions → refresh context (auto-configuration, bean creation) → start embedded server → application ready.

### Q10. Which conditional annotation creates a bean only if a class exists?

`@ConditionalOnClass`.

## Key Takeaways

- ✅ `@SpringBootApplication` = `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan`.
- ✅ Auto-configuration inspects the classpath, environment and existing beans.
- ✅ `AutoConfigurationImportSelector` discovers classes listed in `AutoConfiguration.imports`.
- ✅ Conditional annotations decide whether an auto-configuration creates a bean.
- ✅ `@ConditionalOnMissingBean` lets your own beans override Boot's defaults.
- ✅ `SpringApplication.run()` orchestrates the whole startup, from environment preparation to the embedded server.
