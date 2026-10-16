---
title: Log4j2 Architecture & Configuration
subtitle: How Log4j2 improves on Log4j 1.x, loggers, LoggerConfig and the logger hierarchy, log4j2.xml, console, file and rolling-file appenders, retention, PatternLayout symbols, additivity and multiple appenders.
order: 2
---

## What Is Log4j2?

**Log4j2** is Apache's second-generation logging framework — a complete rewrite built to fix the limitations of Log4j 1.x.

| Log4j 1.x | Log4j2 |
| --- | --- |
| Slower | Much faster |
| Single-thread optimized | Built for multi-threaded applications |
| Limited async logging | High-performance async logging (LMAX Disruptor) |
| Properties / XML only | XML, JSON, YAML or properties configuration |
| Basic rolling files | Advanced rolling and retention policies |
| Can't reload configuration safely | Automatic configuration reloading |
| **End of life (2015)** | Actively maintained |

## Log4j2 Architecture

```flow
Application calls logger.info()
Logger
LoggerConfig — level and appenders for that logger name
Filters — optional extra accept / deny rules
Appender — destination
Layout — format
Destination — console, file, network
```

Each component has one responsibility.

## Component 1 — Logger

The logger generates log events. Through SLF4J:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class EmployeeService {
    private static final Logger logger = LoggerFactory.getLogger(EmployeeService.class);
}
```

Or with Log4j2's own API:

```java
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

private static final Logger logger = LogManager.getLogger(EmployeeService.class);
```

Every class generally has **its own** logger (`EmployeeController`, `EmployeeService`, `EmployeeRepository`…). Never use one global logger for the whole application — you'd lose the ability to control levels per class or package.

## The Logger Hierarchy

Logger names form a hierarchy based on the package, separated by dots:

```tree
Root logger
  com
    com.example
      com.example.service
        com.example.service.impl
      com.example.controller
```

A child logger **inherits** its level and appenders from its nearest configured ancestor, unless it's explicitly configured. So setting `com.example.service` to DEBUG affects `com.example.service.impl` too.

### The Root Logger

The root logger is the parent of all loggers and provides the default configuration:

```xml
<Root level="INFO">
    <AppenderRef ref="Console"/>
</Root>
```

### Levels in Action

With the root level at INFO:

| Call | Result |
| --- | --- |
| `logger.trace()` | Ignored |
| `logger.debug()` | Ignored |
| `logger.info()` | Printed |
| `logger.warn()` | Printed |
| `logger.error()` | Printed |

With `<Root level="WARN">`:

```java
logger.info("Information");
logger.warn("Warning");
logger.error("Error");
```

```output
Warning
Error
```

INFO isn't printed.

## The Configuration File

Log4j2 automatically looks for `log4j2.xml`, `log4j2.json`, `log4j2.yaml` or `log4j2.properties` on the classpath. Most projects use **`log4j2.xml`** in **`src/main/resources`**:

```tree
src
  main
    resources
      log4j2.xml
```

> [!TIP]
> In Spring Boot, name the file **`log4j2-spring.xml`**. Spring Boot then initialises it itself and lets you use Spring extras such as `<SpringProfile name="prod">` blocks and Spring properties in the configuration.

### A Basic log4j2.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d %p %c %m%n"/>
        </Console>
    </Appenders>

    <Loggers>
        <Root level="INFO">
            <AppenderRef ref="Console"/>
        </Root>
    </Loggers>
</Configuration>
```

```tree
Configuration
  Appenders | where logs go, and how they're formatted
  Loggers | which loggers use which appenders, at which level
    Root logger
```

`status="WARN"` controls Log4j2's *own* internal messages — set it to `DEBUG` when your configuration doesn't seem to load.

## Appenders

An appender decides where logs go: **Console**, **File**, **RollingFile**, database (JDBC), Socket, SMTP, Kafka and more.

### Console Appender

```xml
<Console name="Console" target="SYSTEM_OUT">
    <PatternLayout pattern="%d %p %c %m%n"/>
</Console>
```

```output
2026-07-23 10:15:02,118 INFO com.example.EmployeeService Employee Saved
```

### File Appender

```xml
<File name="File" fileName="logs/application.log">
    <PatternLayout pattern="%d %p %m%n"/>
</File>
```

Writes to `logs/application.log` — a file that grows forever.

### Rolling File Appender

The most common choice in production. A single `application.log` can reach **40 GB** and become impossible to open or ship. A rolling appender starts a new file on a schedule or size limit:

```xml
<RollingFile name="Rolling"
             fileName="logs/application.log"
             filePattern="logs/application-%d{yyyy-MM-dd}-%i.log.gz">
    <PatternLayout pattern="%d %p %c{1} %m%n"/>
    <Policies>
        <TimeBasedTriggeringPolicy/>                 <!-- new file every day -->
        <SizeBasedTriggeringPolicy size="100 MB"/>   <!-- …or when a file reaches 100 MB -->
    </Policies>
    <DefaultRolloverStrategy max="20">
        <Delete basePath="logs" maxDepth="1">
            <IfFileName glob="application-*.log.gz"/>
            <IfLastModified age="30d"/>             <!-- keep 30 days of logs -->
        </Delete>
    </DefaultRolloverStrategy>
</RollingFile>
```

```output Files on disk
application.log                  ← current file
application-2026-07-21-1.log.gz
application-2026-07-22-1.log.gz
application-2026-07-23-1.log.gz
application-2026-07-23-2.log.gz  ← second file the same day (size limit reached)
```

| Element | Meaning |
| --- | --- |
| `fileName` | The active log file |
| `filePattern` | Name of rolled files; `%d{yyyy-MM-dd}` sets the time granularity, `%i` is a counter, `.gz` compresses them |
| `TimeBasedTriggeringPolicy` | Roll over when the date in `filePattern` changes |
| `SizeBasedTriggeringPolicy` | Roll over when the file reaches a size |
| `DefaultRolloverStrategy max` | Maximum `%i` files kept per period |
| `Delete` action | Removes old archives — without it, rolled files accumulate forever |

> [!WARNING]
> Rolling alone doesn't delete anything: a daily `TimeBasedTriggeringPolicy` with no `Delete` rule still fills the disk, one file per day. Always configure retention.

## PatternLayout

PatternLayout controls how each log line looks:

```xml
<PatternLayout pattern="%d %p %c %m%n"/>
```

| Pattern | Meaning |
| --- | --- |
| `%d` | Date and time (`%d{yyyy-MM-dd HH:mm:ss.SSS}` for a custom format) |
| `%p` / `%level` | Log level (`%-5level` pads it to 5 characters) |
| `%c` | Logger name (`%c{1}` = just the last part, e.g. the class name) |
| `%C` | Fully qualified name of the **calling class** |
| `%m` | The log message |
| `%t` | Thread name |
| `%n` | Platform line separator |
| `%L` | Line number |
| `%M` | Method name |
| `%F` | File name |
| `%X{key}` | MDC value, e.g. `%X{requestId}` |
| `%ex` / `%throwable` | Exception stack trace (added automatically if omitted) |

> [!NOTE]
> `%C`, `%L`, `%M` and `%F` require **location information**, which Log4j2 obtains by capturing a stack trace for every log event — that's slow, especially with async logging. Prefer `%c` (the logger name), which is free when you name loggers after their class.

### A Production Pattern

```text
%d{yyyy-MM-dd HH:mm:ss.SSS} [%t] %-5level %c{1} - %m%n
```

```output
2026-07-23 11:02:12.125 [main] INFO  EmployeeService - Employee Saved
```

## Multiple Appenders

A logger can write to several destinations at once:

```xml
<Root level="INFO">
    <AppenderRef ref="Console"/>
    <AppenderRef ref="Rolling"/>
</Root>
```

Logs go to both the console and the rolling file.

### Per-Package Levels and Additivity

```xml
<Loggers>
    <Logger name="com.example.payment" level="DEBUG" additivity="false">
        <AppenderRef ref="PaymentFile"/>
    </Logger>
    <Logger name="org.hibernate.SQL" level="DEBUG"/>
    <Root level="INFO">
        <AppenderRef ref="Console"/>
    </Root>
</Loggers>
```

- `com.example.payment` logs at DEBUG to its own file.
- By default a logger's events also flow up to its parents' appenders (**additivity**). `additivity="false"` stops payment logs being written to the console too — and prevents duplicate lines when a logger and its parent share an appender.

## Interview Questions

### 1. What is the difference between a logger and the root logger?

A logger belongs to a specific class or package. The root logger is the parent of all loggers and provides the default level and appenders.

### 2. Why use RollingFileAppender?

To stop log files growing indefinitely by rotating them by time or size — combined with a delete policy to cap disk usage.

### 3. What is PatternLayout?

The layout that defines the format of every log line using conversion patterns such as `%d`, `%p` and `%m`.

### 4. Where should log4j2.xml be placed?

In `src/main/resources` so it ends up on the classpath — named `log4j2-spring.xml` in Spring Boot projects.

### 5. What does %d %p %c %m%n represent?

Date/time, level, logger (class) name, message and a new line.

### 6. Can multiple appenders be attached to one logger?

Yes. A single logger can write simultaneously to the console, files, databases or other destinations.

### 7. What is logger additivity?

Events logged to a logger are also passed to the appenders of its ancestors. Setting `additivity="false"` stops that, which avoids duplicate log lines.

### 8. Why is Log4j2 faster than Log4j 1.x?

It was designed for multi-threaded use, avoids locking on the hot path, reuses objects to reduce garbage, and offers lock-free asynchronous loggers built on the LMAX Disruptor.

## Common Mistakes

- ❌ **Putting `log4j2.xml` outside `src/main/resources`**, so it's never found.
- ❌ **A typo in `<AppenderRef ref="...">`** — the name must match an appender exactly.
- ❌ **Wrong logger levels**, or a child logger silently overriding the root.
- ❌ **No retention policy** on rolling files.
- ❌ **Duplicate log lines** because additivity wasn't turned off.
- ❌ **Using `%C`, `%L` or `%M` in production patterns** without needing them.

## Best Practices

- ✅ Keep production at INFO; enable DEBUG only for the package you're troubleshooting.
- ✅ Use a RollingFile appender with size and time triggers and a `Delete` policy.
- ✅ Separate application and error logs when operations teams need it.
- ✅ Use descriptive logger names — the class name.
- ✅ Never log passwords, OTPs, JWTs or other sensitive information.

## Key Takeaways

- ✅ Log4j2 is a faster, actively maintained rewrite of Log4j 1.x.
- ✅ Logger names form a hierarchy; children inherit from the nearest configured ancestor, ultimately the root logger.
- ✅ `log4j2.xml` defines appenders (where), layouts (how) and loggers (which level, which appenders).
- ✅ RollingFile appenders need triggering policies **and** a retention policy.
- ✅ `%d %p %c %m%n` = date, level, logger, message, new line; avoid costly location patterns.
