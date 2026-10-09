---
title: Spring Boot Actuator and Production Readiness
subtitle: Health, info, metrics and operational endpoints, custom HealthIndicators, Micrometer with Prometheus and Grafana, loggers, dumps, graceful shutdown, liveness/readiness probes and securing endpoints.
order: 24
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Writing a Spring Boot application is only half the job. In production you must answer questions like: Is my application healthy? Is the database reachable? How much memory is being used? Why is the application slow? Which API is failing? How many requests per second are coming in? Can Kubernetes restart my application? How do I monitor CPU, JVM and threads? How do I expose metrics to Prometheus?

These are solved by **Spring Boot Actuator**.

## What is Spring Boot Actuator?

Actuator provides **production-ready features for monitoring and managing** your application. It exposes information about application health, metrics, the JVM, threads, memory, the environment, beans, mappings, logging, HTTP requests and custom health checks. Think of it as **the dashboard for your application**.

## Why Do We Need Actuator?

```flow
Without Actuator
Application
Running? Don't know
---
With Actuator
Application
Health, metrics, logs
Monitoring
Alerts
```

Operations teams can immediately determine whether the application is functioning correctly.

## Dependency

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Once added, Spring Boot automatically registers the actuator endpoints.

```flow-h
HTTP request
DispatcherServlet
Actuator endpoint
Health / metrics / info
```

## Actuator Endpoints

**Interview favourite.**

| Endpoint | Purpose |
| --- | --- |
| `/actuator` | List available endpoints |
| `/actuator/health` | Health status |
| `/actuator/info` | Application information |
| `/actuator/metrics` | Metrics |
| `/actuator/prometheus` | Prometheus metrics |
| `/actuator/env` | Environment properties |
| `/actuator/beans` | Spring beans |
| `/actuator/mappings` | Request mappings |
| `/actuator/loggers` | Logger configuration |
| `/actuator/threaddump` | JVM thread dump |
| `/actuator/heapdump` | JVM heap dump |
| `/actuator/caches` | Cache information |
| `/actuator/configprops` | Configuration properties |

### Exposing Endpoints

Not every endpoint is exposed by default — over HTTP, **only `health`** is exposed out of the box.

```text
management.endpoints.web.exposure.include=health,info,metrics
```

Expose everything (**not recommended for production**):

```text
management.endpoints.web.exposure.include=*
```

## Health Endpoint

One of the most used endpoints:

```text
GET /actuator/health
```

```json
{
  "status": "UP"
}
```

### Health Contributors

Health is determined by multiple contributors — the application, database, disk space, Redis, RabbitMQ, Kafka, … If one critical dependency fails, the overall status changes accordingly (e.g. to `DOWN`).

```tree
Overall health
  db
  diskSpace
  redis
  rabbit
  kafka
```

Common status values: `UP`, `DOWN`, `OUT_OF_SERVICE` and `UNKNOWN`.

### Detailed Health

```text
management.endpoint.health.show-details=always
```

```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP" },
    "diskSpace": { "status": "UP" }
  }
}
```

(The default is `never`; `when-authorized` is a safer choice than `always`.)

## Custom HealthIndicator

**Interview favourite.**

```java
@Component
public class PaymentHealthIndicator implements HealthIndicator {

    @Override
    public Health health() {
        boolean ok = checkGateway();

        if (ok) {
            return Health.up().build();
        }
        return Health.down()
                .withDetail("Gateway", "Unavailable")
                .build();
    }
}
```

Spring automatically adds it to `/actuator/health` (as the `payment` component).

## Info Endpoint

```text
GET /actuator/info
```

```text
management.info.env.enabled=true
info.app.name=Booking System
info.app.version=1.0.0
info.company=ABC Ltd
```

```json
{
  "app": {
    "name": "Booking System",
    "version": "1.0.0"
  },
  "company": "ABC Ltd"
}
```

## Metrics Endpoint

One of the most powerful features:

```text
GET /actuator/metrics
```

It returns JVM memory, CPU, GC, HTTP requests, threads, Tomcat, database pool and cache statistics.

### JVM Metrics

```text
/actuator/metrics/jvm.memory.used
```

```flow-h
JVM memory used
Micrometer
Actuator
```

### HTTP Metrics

```text
/actuator/metrics/http.server.requests
```

Shows request count, response time, status codes and per-URI statistics. Very common in production.

## Micrometer

**Interview favourite.** Micrometer is Spring Boot's **metrics library** (a vendor-neutral facade, like SLF4J for metrics).

```flow-h Micrometer collects, Prometheus stores, Grafana visualizes
Application
Micrometer
Prometheus
Grafana
```

### Prometheus Integration

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

Endpoint: `/actuator/prometheus`. Prometheus periodically **scrapes** this endpoint.

### Grafana

```flow-h
Application
Actuator
Prometheus
Grafana dashboard
```

Operations teams monitor CPU, memory, JVM, database, requests and errors using Grafana dashboards.

## Other Operational Endpoints

### /actuator/env

Shows active profiles, environment variables, system properties and configuration values. Useful for debugging — **don't expose it publicly** in production.

### /actuator/beans

Shows every Spring bean. Useful during development and troubleshooting.

### /actuator/mappings

Shows controllers, URLs and HTTP methods. Useful for debugging routing issues.

### /actuator/loggers

Change log levels **dynamically**:

```text
POST /actuator/loggers/com.app
```

```json
{
  "configuredLevel": "DEBUG"
}
```

No application restart required.

### /actuator/threaddump

Useful for diagnosing deadlocks, high CPU, thread leaks and blocking threads.

### /actuator/heapdump

Useful for memory leaks, `OutOfMemoryError` and object analysis. Typically analyzed with tools such as **Eclipse MAT** or **VisualVM**.

## Graceful Shutdown

Instead of terminating immediately, Spring Boot can **finish active requests**:

```text
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s
```

```flow
Shutdown signal
Stop accepting requests
Finish existing requests
Close resources
Shutdown
```

Very important in Kubernetes. (Graceful shutdown is the default since Spring Boot 3.4.)

## Liveness and Readiness Probes

**Interview favourite.**

**Liveness** answers *"Is the application alive?"* — `/actuator/health/liveness`. If liveness fails, Kubernetes **restarts** the container.

**Readiness** answers *"Can the application receive traffic?"* — `/actuator/health/readiness`. If readiness fails, traffic is **temporarily stopped**, but the application may keep running.

```flow
Kubernetes
? Liveness OK? | No: Restart the container
? Readiness OK? | Yes: Send traffic | No: Stop routing traffic
```

> [!NOTE]
> The probe endpoints are enabled automatically when the app detects it's running on Kubernetes; elsewhere enable them with `management.endpoint.health.probes.enabled=true`.

## Custom Metrics

### Counter

```java
Counter counter = meterRegistry.counter("orders.created");

counter.increment();
```

Visible in `/actuator/metrics`.

### Timer

Measure execution time:

```java
Timer timer = meterRegistry.timer("payment.time");

timer.record(() -> {
    processPayment();
});
```

### Tags

Micrometer supports labels (**tags**) — e.g. `payment.time` with `status=SUCCESS`, `country=IN`. This enables filtering and aggregation in monitoring tools.

## Security

**Never expose all endpoints publicly**:

```text
management.endpoints.web.exposure.include=health,info
```

Protect sensitive endpoints using Spring Security (or a separate `management.server.port` reachable only internally).

## Production Monitoring Architecture

```flow-h
Spring Boot
Actuator
Micrometer
Prometheus
Grafana
Alerts
```

### Internal Components

Important classes: `HealthEndpoint`, `MetricsEndpoint`, `InfoEndpoint`, `HealthIndicator`, `MeterRegistry`, `Counter`, `Timer` and `Gauge`.

```flow Complete production flow
HTTP request
Controller → business logic
Micrometer
Actuator
Prometheus
Grafana
Alertmanager
DevOps team
```

## Common Mistakes

- ❌ **Exposing every endpoint** (`include=*`) in production — expose only what's required.
- ❌ **Leaving health details public** (`show-details=always`) — limit details to authenticated users or trusted environments.
- ❌ **Ignoring metrics** — applications without monitoring are difficult to troubleshoot.
- ❌ **Not enabling graceful shutdown** — an immediate shutdown can interrupt active requests.
- ❌ **Ignoring JVM metrics** — memory leaks often show up first in heap usage, GC frequency and thread count.

## Enterprise Architecture

```flow
Client
Load balancer
Spring Boot — security, controllers, services, repositories
Database
Micrometer → Actuator
Prometheus
Grafana
Alerts
```

## Interview Questions

### Q1. What is Spring Boot Actuator?

A Spring Boot module that provides production-ready monitoring and management endpoints.

### Q2. Which endpoint checks application health?

`/actuator/health`.

### Q3. What is Micrometer?

Spring Boot's metrics instrumentation library. It records application metrics and exports them to monitoring systems such as Prometheus.

### Q4. Difference between Prometheus and Grafana?

| Prometheus | Grafana |
| --- | --- |
| Collects and stores metrics | Visualizes metrics |
| Time-series database | Dashboards and alert visualization |

### Q5. What is a HealthIndicator?

A component that contributes custom health information to the health endpoint.

### Q6. Difference between liveness and readiness?

| Liveness | Readiness |
| --- | --- |
| Is the application alive? | Can it accept traffic? |
| Failure usually triggers a restart | Failure removes it from traffic |

### Q7. Which endpoint exposes Prometheus metrics?

`/actuator/prometheus`.

### Q8. Which Micrometer classes are commonly used?

`MeterRegistry`, `Counter`, `Timer`, `Gauge` and `DistributionSummary`.

### Q9. Why should Actuator endpoints be secured?

Because some endpoints expose sensitive operational information such as environment properties, bean definitions, mappings and heap dumps.

### Q10. What is graceful shutdown?

A shutdown where the application stops accepting new requests, completes in-flight requests, releases resources and then terminates.

## Key Takeaways

- ✅ Actuator provides production-ready monitoring and management.
- ✅ `HealthIndicator` adds custom health checks for external systems.
- ✅ Micrometer is the metrics facade; it integrates with Prometheus and Grafana.
- ✅ Liveness and readiness probes are critical for Kubernetes.
- ✅ Protect sensitive endpoints and expose only what's necessary.
- ✅ Graceful shutdown prevents interrupted requests during deployments.
- ✅ Monitor JVM, request and custom business metrics continuously.
