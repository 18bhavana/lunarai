---
title: Spring Boot Application Scenarios
subtitle: "Scenario questions 59–66: debugging an API with unexpected results, injected beans that are null, transactions that commit despite exceptions, state problems across multiple instances, tracing configuration sources, centralised exception handling, backward-compatible API changes and slow startup."
order: 7
---

## Introduction

Many Spring Boot "mysteries" come from how the framework works: **proxies**, the **bean lifecycle**, **auto-configuration** and **property source ordering**. Actuator endpoints (`/actuator/beans`, `/conditions`, `/env`, `/configprops`, `/mappings`, `/startup`) answer most of these questions directly. Expose them only on an internal management port, behind security.

## Scenario Questions

### Q59. Your Spring Boot application starts successfully, but one API returns unexpected results. How would you debug it?

Work from the outside in:

1. **Reproduce it precisely:** the exact request (method, path, headers, body, user and role). Write it as a failing test (`@WebMvcTest` or `@SpringBootTest` with `MockMvc`) if you can.
2. **Check which handler runs:** `/actuator/mappings` shows the controller method mapped to the path. Look for conflicting mappings or a different API version.
3. **Check the input binding:** log or debug the deserialised request object. Common problems are field-name mismatches (`camelCase` vs `snake_case`), missing setters or constructors, wrong date formats, and enums that don't match.
4. **Follow the data:** turn on SQL logging (`org.hibernate.SQL=DEBUG` plus bind parameters) to see the actual queries and parameters. Check for stale cache entries (`@Cacheable`) or reads from a lagging replica.
5. **Check the environment:** active profiles and configuration values (`/actuator/env`), feature flags, and which bean implementation was injected (`/actuator/beans`, or multiple beans with `@Primary`).
6. **Check the output:** Jackson settings (`@JsonIgnore`, `@JsonInclude`, naming strategy), DTO mapping bugs (MapStruct), and lazy fields that serialise as empty.
7. **Use tracing and logging:** the trace ID, then debug-level logging for that package. You can change it at runtime via `POST /actuator/loggers/com.example.orders`.
8. **Compare with a known good version:** `git diff` and recent deployments.

### Q60. A Spring bean is unexpectedly null even though you used dependency injection. What could be wrong?

| Cause | Example | Fix |
| --- | --- | --- |
| **The object was created with `new`** | `new OrderService()`: Spring never touched it | Inject it instead of instantiating it |
| **Field used in the constructor** | `@Autowired` field accessed in the constructor, before injection | Constructor injection, or `@PostConstruct` |
| **Static field** | `@Autowired static Repo repo;` isn't injected | Don't inject statics; use instance fields |
| **Class not a bean** | Missing `@Component`/`@Service`, or outside the component-scan packages | Annotate it, and keep it under the main application package |
| **Created by another framework** | JPA entity listeners, Jackson deserialisers, Quartz jobs or servlet filters created by their own frameworks | Use Spring-aware factories (`SpringBeanJobFactory`), or constructor-injected beans registered by Spring |
| **`private` or `final` method on a proxied bean** | Injected fields read as `null` inside `final` methods of a CGLIB proxy | Make the methods non-final, or use interfaces |
| **Circular dependency workarounds** | Field injection masks a cycle; a bean is used before it's ready | Restructure the dependencies |
| **A test without a Spring context** | A plain JUnit test, or `@InjectMocks` without a mock | Use `@SpringBootTest` or slices, or provide the mocks |

**Prefer constructor injection with `final` fields.** A missing dependency then fails at startup instead of becoming a `NullPointerException` later:

```java
@Service
public class OrderService {
    private final OrderRepository repository;
    private final PaymentClient paymentClient;

    public OrderService(OrderRepository repository, PaymentClient paymentClient) {
        this.repository = repository;
        this.paymentClient = paymentClient;
    }
}
```

### Q61. An exception occurs inside a transactional method, but the database changes are still committed. What are the possible reasons?

- **Checked exception:** Spring rolls back only on `RuntimeException` and `Error` by default. Use `@Transactional(rollbackFor = Exception.class)`.
- **The exception is caught** inside the method (or in an aspect) and not rethrown, so the proxy sees a normal return.
- **No transaction is active:** self-invocation, a non-public method, the bean created with `new`, or the wrong `@Transactional` import.
- **The changes were made in a separate transaction:** `REQUIRES_NEW`, a different transaction manager or data source, or a repository call that committed on its own because the outer method wasn't transactional.
- **`noRollbackFor`** is configured for that exception type.
- **The exception happened after the commit:** for example during response serialisation, or in an `AFTER_COMMIT` listener. The transaction had already finished.
- **Non-transactional resources:** MyISAM tables, DDL statements that auto-commit in MySQL, or external systems that can't roll back.
- **Async work:** an `@Async` method or a new thread did the write outside the transaction.

Confirm it with `logging.level.org.springframework.transaction.interceptor=TRACE` and `org.springframework.orm.jpa.JpaTransactionManager=DEBUG`, which show "Creating new transaction", "Committing" or "Rolling back". See Q17 for the related table.

### Q62. Your application works with one instance but fails when deployed with multiple instances. What kinds of state-management problems would you investigate?

Anything kept **in memory** is now different on each instance:

| Problem | Example | Fix |
| --- | --- | --- |
| **HTTP sessions** | User logs in on instance A; the next request hits B and has no session | Stateless JWTs, or Spring Session with Redis or JDBC |
| **Local caches** | Instance A updates a price; B serves the old value | A shared cache (Redis), short TTLs, or invalidation events |
| **In-memory locks** | `synchronized` protects nothing across instances | Database constraints, row locks, or distributed locks (Q48) |
| **Scheduled jobs** | `@Scheduled` runs on every instance | ShedLock, or an external scheduler (Q44) |
| **In-memory counters and rate limits** | Each instance allows N requests, so the total is N × instances | Redis-based rate limiting |
| **Local files** | Upload saved to instance A's disk; download hits B | Object storage (S3) or a shared volume |
| **WebSockets / SSE** | The message is published on A, but the client is connected to B | A pub/sub broker (Redis, a message broker relay) |
| **Generated IDs** | Local counters collide | Database sequences, UUIDs, or Snowflake-style IDs |
| **Startup tasks and migrations** | Each instance seeds data or runs migrations at once | Flyway's lock, or a one-off job |

Design services to be **stateless**, with all shared state in a database, cache, broker or object store, so any instance can serve any request.

### Q63. A configuration value works locally but is incorrect in production. How would you trace the configuration source?

Spring Boot reads properties from many sources, in a **fixed priority order**. Higher sources override lower ones. Roughly, from highest to lowest:

1. command-line arguments (`--server.port=9090`);
2. `SPRING_APPLICATION_JSON`;
3. OS **environment variables** (`ORDER_TIMEOUT` → `order.timeout` through relaxed binding);
4. config imports (Config Server, Kubernetes ConfigMaps or Secrets, Vault);
5. profile-specific files outside the jar, then inside it (`application-prod.yml`);
6. `application.yml` outside the jar, then inside it;
7. `@PropertySource` and defaults.

**Trace it:**

- **`/actuator/env/order.timeout`** shows the resolved value **and which property source it came from**:

```json
{
  "property": { "source": "systemEnvironment", "value": "5000" },
  "propertySources": [
    { "name": "systemEnvironment", "property": { "value": "5000" } },
    { "name": "Config resource 'class path resource [application-prod.yml]'", "property": { "value": "2000" } }
  ]
}
```

- **`/actuator/configprops`** shows bound `@ConfigurationProperties` beans.
- Check the **active profiles** at startup (`The following 1 profile is active: "prod"`).
- Look for **environment variables** set in Kubernetes manifests, Docker, Helm values or CI pipelines that silently override the files.
- Check the **Config Server** label and branch, and whether a refresh happened.
- Check **relaxed binding** surprises: `MY_SERVICE_URL` maps to `my.service.url`.

Sensitive values are masked in Actuator by default. Keep it that way (`management.endpoint.env.show-values=WHEN_AUTHORIZED`).

### Q64. How would you implement centralized exception handling for a REST API?

Use **`@RestControllerAdvice`** with RFC 9457 **`ProblemDetail`** responses (built into Spring 6), so every error has the same shape:

```java
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ProblemDetail handleNotFound(OrderNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Order not found");
        pd.setType(URI.create("https://api.example.com/errors/order-not-found"));
        pd.setProperty("orderId", ex.getOrderId());
        return pd;
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ProblemDetail handleBusiness(BusinessRuleException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled error on {} {}", request.getMethod(), request.getRequestURI(), ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again later.");
        pd.setProperty("traceId", MDC.get("traceId"));   // lets support find the logs
        return pd;
    }
}
```

```json
{
  "type": "https://api.example.com/errors/order-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "Order 42 does not exist",
  "instance": "/api/orders/42",
  "orderId": 42
}
```

**Good practice:**

- Extending `ResponseEntityExceptionHandler` (or setting `spring.mvc.problemdetails.enabled=true`) handles Spring's own exceptions: validation, unsupported media types, missing parameters.
- Return **field-level validation errors** for `MethodArgumentNotValidException`.
- Map exceptions to the **right status codes**: 400 validation, 401/403 security, 404 not found, 409 conflict, 422 business rule, 503 dependency down.
- **Never leak stack traces**, SQL or internal class names to clients. Log them with a trace ID instead.
- Use a small hierarchy of domain exceptions rather than one handler per exception.
- Security exceptions (401/403) are produced in filters, **before** controllers, so handle them with an `AuthenticationEntryPoint` and `AccessDeniedHandler`.

### Q65. How would you make a Spring Boot API backward-compatible when changing its request or response structure?

**Make additive, tolerant changes:**

- **Add fields; don't rename or remove them.** New request fields are optional with defaults. New response fields are ignored by old clients, as long as clients are tolerant readers (`spring.jackson.deserialization.fail-on-unknown-properties=false`, which is Spring Boot's default).
- **Don't change field types or meanings** (a number to a string, cents to rupees).
- **Accept both shapes during a transition:** `@JsonAlias("customer_name")` for an old field name, and keep writing the old field alongside the new one.
- **Add new enum values carefully.** Old clients may break on unknown values, so document that clients must handle unknown values, or version the API.
- **Status codes and error formats** are part of the contract too.

**For breaking changes, version the API:**

| Strategy | Example |
| --- | --- |
| URI version | `/api/v2/orders` (the most explicit and common) |
| Header | `X-API-Version: 2` |
| Media type | `Accept: application/vnd.example.order.v2+json` |

Run v1 and v2 side by side, map both to the same domain model, **deprecate v1** with a `Deprecation` / `Sunset` header and a timeline, and monitor its usage before removing it. Spring Framework 7 adds built-in API versioning support (`version` attributes on request mappings).

**Protect the contract:** an OpenAPI spec under version control, and **contract tests** (Spring Cloud Contract, Pact) that fail the build when a change breaks a consumer.

### Q66. Your application starts slowly after deployment. How would you identify the startup bottleneck?

**Measure:**

- **Startup actuator:** register a `BufferingApplicationStartup` and read `/actuator/startup`, which shows how long each bean took to create:

```java
public static void main(String[] args) {
    SpringApplication app = new SpringApplication(OrderApplication.class);
    app.setApplicationStartup(new BufferingApplicationStartup(10_000));
    app.run(args);
}
```

- **Logs with timestamps:** look for gaps between log lines (`--debug` shows the auto-configuration report).
- **JFR or async-profiler** during startup, for CPU-heavy phases.

**Common causes:**

- **Remote calls at startup:** connecting to the database, Kafka, the Config Server or Vault, with long timeouts or retries (a slow or unreachable dependency).
- **Hibernate:** scanning many entities, `ddl-auto=update` comparing the schema, or validating a large schema.
- **Flyway/Liquibase migrations** running a long data migration at startup.
- **Eager work in `@PostConstruct` or `CommandLineRunner`:** cache warming, loading files, calling APIs.
- **Broad classpath scanning** and many unused auto-configurations.
- **Container resources:** a low CPU limit makes JIT and class loading slow. Startup is CPU-heavy.

**Fixes:**

- Move slow initialisation to background or async tasks, or do it lazily.
- Run long migrations as a separate job.
- Narrow scanning, and exclude unused auto-configurations.
- `spring.main.lazy-initialization=true` where appropriate (it shifts the cost to the first request).
- Give the container more CPU during startup.
- **Class Data Sharing (CDS)**: `-XX:SharedArchiveFile` (Spring Boot 3.3+ supports it).
- **CRaC** checkpoint/restore, or a **GraalVM native image** for near-instant startup.

In Kubernetes, configure a **startup probe**, so a slow but healthy start isn't killed by the liveness probe.

## Key Takeaways

- ✅ Actuator (`mappings`, `beans`, `env`, `conditions`, `startup`, `loggers`) answers most "why" questions.
- ✅ Null beans usually mean the object isn't Spring-managed. Use constructor injection.
- ✅ Transactions commit despite exceptions because of checked exceptions, swallowed errors, or a missing proxy.
- ✅ Multi-instance bugs come from in-memory state: sessions, caches, locks, schedules, files.
- ✅ Use `ProblemDetail` with `@RestControllerAdvice` for consistent errors.
- ✅ Evolve APIs additively, version breaking changes, and protect contracts with tests.
