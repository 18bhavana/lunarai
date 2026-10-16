---
title: Introduction to Logging
subtitle: Why professional applications log instead of using System.out.println, the evolution from JUL to SLF4J and Log4j2, loggers, appenders and layouts, the log levels and when to use each, and parameterized logging.
order: 1
---

## What Is Logging?

**Logging** is recording events that happen while a program runs. Instead of writing:

```java
System.out.println("User Logged In");
```

professional applications use a logger:

```java
logger.info("User Logged In");
```

because logs help you:

- debug issues;
- monitor production systems;
- detect security problems;
- analyse performance;
- keep an audit history.

## Why Not System.out.println()?

Imagine a banking application with 5,000 Java classes. One transaction fails and the console shows:

```java
System.out.println("Transaction Failed");
```

Which class? Which method? Which thread? Which user? When? What exception? **You don't know.**

| `System.out.println()` | A logging framework |
| --- | --- |
| No levels — everything or nothing | TRACE … ERROR, configurable per package |
| No timestamp, thread or class | Added automatically by the layout |
| Console only | Console, files, rolling files, remote log servers |
| Can't be turned off without code changes | Changed in configuration, even at runtime |
| Synchronized and slow under load | Buffered and optionally asynchronous |
| No exception context | Full stack traces with `logger.error("msg", e)` |

## Evolution of Java Logging

```flow
System.out.println()
java.util.logging (JUL) — built into the JDK
Apache Log4j 1.x — end of life since 2015
SLF4J — a logging facade (API)
Logback — the successor to Log4j 1.x
Log4j2 — a complete rewrite of Log4j
```

Today most Spring Boot applications use **SLF4J + Logback** (the Spring Boot default) or **SLF4J + Log4j2**.

### Facade vs Implementation

| Layer | Examples | Role |
| --- | --- | --- |
| **Facade (API)** | SLF4J | What your code calls — `LoggerFactory.getLogger(...)`, `logger.info(...)` |
| **Implementation** | Logback, Log4j2, JUL | Actually formats and writes the logs |

```java
import org.slf4j.Logger;          // SLF4J — the facade
import org.slf4j.LoggerFactory;
```

Coding against SLF4J means you can switch from Logback to Log4j2 by changing **dependencies and configuration**, without touching a single Java class.

## What Is Log4j?

**Log4j** stands for *Log for Java* — an Apache framework for flexible, configurable logging. Its features include:

- multiple log levels;
- console, file, database, email and network logging;
- rolling log files;
- asynchronous logging;
- pattern formatting with thread, class and timestamp information;
- exception stack traces.

## Logging Architecture

```flow
Application calls logger.info()
Logger
Level check — is INFO enabled?
Appender — where the log goes
Layout — how the log looks
Destination — console, file, server
```

Examples:

```flow-h
Java class
Logger
ConsoleAppender
PatternLayout
Console
```

```flow-h
Logger
RollingFileAppender
PatternLayout
application.log
```

## Components

### 1. Logger

Creates log messages:

```java
private static final Logger logger = LoggerFactory.getLogger(EmployeeService.class);
```

### 2. Appender

Decides **where** logs go — console, file, rolling file, database, SMTP (email), socket, Kafka.

### 3. Layout

Decides **how** logs look:

```output
2026-07-23 10:25:10 INFO UserService User Created
```

### 4. Log Level

Decides **which** logs are written.

### The Logger Flow

```flow
logger.info("Employee Saved")
Logger checks the configured level
Passes the event to its appenders
Each appender formats it with its layout
Log written
```

With the level set to INFO:

```output
2026-07-23 11:00:21 INFO EmployeeService Employee Saved
```

## Log Levels

From least to most severe:

```flow-h
TRACE
DEBUG
INFO
WARN
ERROR
FATAL
```

Setting a level enables that level **and everything more severe**: with `INFO`, the INFO, WARN, ERROR (and FATAL) messages are written; TRACE and DEBUG are skipped.

> [!NOTE]
> **Log4j2 does have a `FATAL` level** (plus `OFF` and `ALL`). It's **SLF4J** — the API most Spring code uses — that has no `fatal()` method, so with SLF4J the most severe call is `error()`. Logback also has no FATAL level.

### TRACE

The most detailed level — method entry and exit, variable values, loop iterations, SQL parameters.

```java
logger.trace("Entered calculateSalary()");
```

### DEBUG

Diagnostic information used mainly during development and troubleshooting. Usually **disabled in production**.

```java
logger.debug("Employee ID = {}", id);
```

### INFO

Normal, significant business events — user login, order created, email sent, account created.

```java
logger.info("Payment Completed");
```

### WARN

Something unexpected happened, but the application still works — a slow database, a retry, missing optional configuration, low disk space.

```java
logger.warn("Password expires in 3 days");
```

### ERROR

A failure the application couldn't handle normally — the database is down, an API call failed, an unexpected exception.

```java
try {
    // business logic
} catch (Exception e) {
    logger.error("Payment Failed", e);   // always pass the exception
}
```

### Which Level Should I Use?

| Situation | Level |
| --- | --- |
| Entering a method, loop details | TRACE |
| Variable values, intermediate results | DEBUG |
| User logged in, order placed | INFO |
| Low memory, retrying a call, deprecated config | WARN |
| Exception, failed operation | ERROR |

## Logger Naming

The standard practice is **one logger per class**, named after the class:

```java
private static final Logger logger = LoggerFactory.getLogger(EmployeeService.class);
```

The logger's name is the fully qualified class name, e.g. `com.example.service.EmployeeService` — which lets you set levels per package. With Lombok, `@Slf4j` on the class generates the same field (named `log`).

## A Typical Spring Boot Example

```java
@RestController
public class EmployeeController {

    private static final Logger logger = LoggerFactory.getLogger(EmployeeController.class);

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping("/employees")
    public List<Employee> getEmployees() {
        logger.info("Fetching Employees");
        return employeeService.getAll();
    }
}
```

```output
2026-07-23 10:10:55 INFO EmployeeController Fetching Employees
```

## A Banking Example

```java
logger.info("Transfer Started");
logger.debug("From Account={}", maskAccount(from));
logger.debug("To Account={}", maskAccount(to));
logger.debug("Amount={}", amount);

try {
    transfer();
    logger.info("Transfer Success");
} catch (Exception e) {
    logger.error("Transfer Failed", e);
}
```

```output With the level set to DEBUG
INFO  Transfer Started
DEBUG From Account=XXXX2345
DEBUG To Account=XXXX7890
DEBUG Amount=5000
INFO  Transfer Success
```

At the production level of INFO, only the two INFO lines appear. Account numbers are **masked** — full account numbers, card numbers and other personal data shouldn't appear in logs.

## Parameterized Logging

```java
// ✅ Parameterized — the message is only built if INFO is enabled
logger.info("User {} logged in from {}", userId, ipAddress);

// ❌ String concatenation — the string is built even if INFO is disabled
logger.info("User " + userId + " logged in from " + ipAddress);
```

`{}` placeholders avoid wasted work for disabled levels and keep messages consistent. Pass the exception as the **last** argument and it's logged with its stack trace:

```java
logger.error("Order {} failed", orderId, e);
```

For expensive arguments, guard the call or use a lambda (SLF4J 2 / Log4j2):

```java
if (logger.isDebugEnabled()) {
    logger.debug("State: {}", buildExpensiveReport());
}
```

## Interview Questions

### Q1. What is logging?

Recording application events for debugging, monitoring, auditing and troubleshooting.

### Q2. Why not use System.out.println()?

It has no log levels, timestamps, thread or class information, file output or configuration, can't be switched off per package, and doesn't work well in production.

### Q3. What are the main components of Log4j?

Logger, appender, layout and log level.

### Q4. What is the difference between a logger and an appender?

A logger creates log events; an appender decides where they're written.

### Q5. What is the difference between a layout and an appender?

The appender is the **destination**; the layout is the **format**.

### Q6. Which log levels are enabled in production?

Typically INFO, WARN and ERROR. DEBUG and TRACE are usually disabled, and switched on temporarily for a specific package when troubleshooting.

### Q7. What is the order of log levels?

TRACE < DEBUG < INFO < WARN < ERROR (< FATAL in Log4j2).

### Q8. What is SLF4J, and why use it?

The Simple Logging Facade for Java — an API that your code calls, while an implementation such as Logback or Log4j2 does the actual logging. It decouples your code from the implementation.

## Common Mistakes

- ❌ **Wrong level** — `logger.error("Employee Saved")` (saving isn't an error) or `logger.debug("Payment Failed")` (a failure must be ERROR).
- ❌ **Logging the exception message without the exception** — `logger.error("Failed: " + e.getMessage())` loses the stack trace. Use `logger.error("Failed", e)`.
- ❌ **String concatenation** in log calls.
- ❌ **Logging sensitive data** — passwords, OTPs, tokens, card or account numbers.
- ❌ **Logging and rethrowing** the same exception at every layer — the same stack trace appears many times.

## Best Practices

- ✅ INFO for important business events, DEBUG for developer diagnostics, TRACE only for detailed execution flow.
- ✅ Always include the exception object in ERROR logs: `logger.error("Unable to process payment", e)`.
- ✅ Never log passwords, OTPs, tokens or card numbers.
- ✅ Use parameterized logging with `{}`.
- ✅ Code against SLF4J, one `private static final` logger per class.

## Key Takeaways

- ✅ Logging frameworks add levels, context and configurable destinations that `System.out` lacks.
- ✅ SLF4J is the facade; Logback (Spring Boot default) and Log4j2 are implementations.
- ✅ A logger creates events, an appender sends them somewhere, a layout formats them.
- ✅ Levels: TRACE < DEBUG < INFO < WARN < ERROR (< FATAL in Log4j2); production usually runs at INFO.
- ✅ Use `{}` placeholders and pass exceptions as the last argument.
