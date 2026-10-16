---
title: Observability — Logs, Metrics & Distributed Tracing
subtitle: The three pillars of observability, centralized and correlated logging, metrics with Micrometer and Prometheus, RED and USE methods, distributed tracing with Micrometer Tracing and OpenTelemetry, health checks, dashboards and alerting.
order: 10
---

## Introduction

A user reports *"checkout is slow"*. The request passed through the gateway, the order, pricing, inventory and payment services and Kafka. Which one is slow? Without **observability**, you're guessing. Observability means being able to answer questions about a running system from the data it emits.

## The Three Pillars

| Pillar | Answers | Tools |
| --- | --- | --- |
| **Logs** | *What happened* in detail, for one event | Logback/Log4j2 → ELK / OpenSearch, Grafana Loki, Splunk |
| **Metrics** | *How much / how fast / how often*, aggregated over time | Micrometer → Prometheus → Grafana; Datadog; CloudWatch |
| **Traces** | *Where the time went* across services for one request | Micrometer Tracing / OpenTelemetry → Zipkin, Jaeger, Grafana Tempo |

They work best **linked together**: a dashboard shows a latency spike (metrics) → you open a slow trace (tracing) → you jump to that trace's logs (logs) by its trace ID.

## 1. Logs — Centralized and Correlated

With 40 services × 3 instances, logging into machines to `grep` files is impossible. Ship every log line to one place, as **structured JSON**, with a **trace ID** on every line.

```output One JSON log line
{"@timestamp":"2026-10-15T10:15:30.188Z","level":"ERROR","service":"payment-service","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","message":"Card declined","orderId":"ORD-1001"}
```

- Spring Boot 3.4+ emits structured logs with `logging.structured.format.console=ecs` (or `logstash`).
- With Micrometer Tracing on the classpath, **`traceId` and `spanId` are added to the MDC automatically**, so every log line can be correlated.
- Log at the right levels and never log secrets — see [Logging in Spring Boot & Production](/spring/logging/logging-in-spring-boot/).

## 2. Metrics — Micrometer and Prometheus

**Micrometer** is the metrics facade in Spring Boot (like SLF4J for metrics). Actuator plus the Prometheus registry exposes metrics at `/actuator/prometheus`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  metrics:
    tags:
      application: ${spring.application.name}
```

Out of the box you get HTTP request timings, JVM memory and GC, thread pools, HikariCP connections, Kafka clients, Resilience4j and more. Prometheus **scrapes** each instance; Grafana draws dashboards.

### Custom Business Metrics

```java
@Service
public class CheckoutService {

    private final Counter ordersPlaced;
    private final Timer paymentTimer;

    public CheckoutService(MeterRegistry registry) {
        this.ordersPlaced = Counter.builder("orders.placed").tag("channel", "web").register(registry);
        this.paymentTimer = Timer.builder("payment.duration").publishPercentiles(0.95, 0.99).register(registry);
    }

    public void checkout(Order order) {
        paymentTimer.record(() -> paymentClient.charge(order));
        ordersPlaced.increment();
    }
}
```

| Meter | Use |
| --- | --- |
| `Counter` | Things that only go up — orders placed, errors |
| `Gauge` | A current value — queue size, active sessions |
| `Timer` | Durations and rates — request latency, percentiles |
| `DistributionSummary` | Sizes — payload bytes, basket value |

> [!WARNING]
> Never use unbounded values (user IDs, order IDs, raw URLs) as metric **tags** — each unique value creates a new time series and can overwhelm Prometheus (*high cardinality*). Put those in logs and traces instead.

### What to Measure

| Method | For | Signals |
| --- | --- | --- |
| **RED** | Request-driven services | **R**ate (requests/s), **E**rrors (failed requests), **D**uration (latency percentiles) |
| **USE** | Resources (CPU, pools, queues) | **U**tilisation, **S**aturation, **E**rrors |
| **Four golden signals** (Google SRE) | Any user-facing system | Latency, traffic, errors, saturation |

Track latency as **percentiles** (p50, p95, p99), not averages — averages hide the slow requests users actually notice.

## 3. Distributed Tracing

A **trace** follows one request across services. Each unit of work is a **span**; spans share a **trace ID** and form a tree:

```tree
Trace 4bf92f35… — POST /checkout, 1.84 s
  gateway — 1.84 s
    order-service: POST /orders — 1.80 s
      pricing-service: GET /prices — 0.12 s
      inventory-service: POST /reservations — 0.20 s
      payment-service: POST /charges — 1.35 s | the slow part
        external card gateway — 1.30 s
      Kafka publish OrderPlaced — 0.01 s
```

The waterfall view in Zipkin or Jaeger shows instantly that the card gateway is the bottleneck.

### Tracing in Spring Boot 3

Spring Cloud Sleuth has been replaced by **Micrometer Tracing**, with an OpenTelemetry (or Brave) bridge and an exporter:

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-zipkin</artifactId>   <!-- or the OTLP exporter -->
</dependency>
```

```yaml
management:
  tracing:
    sampling:
      probability: 0.1          # trace 10% of requests in production (1.0 in development)
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

Spring automatically:

- creates spans for incoming HTTP requests, `RestClient` / `WebClient` / Feign calls, `@KafkaListener` and `KafkaTemplate`, JDBC (with extra instrumentation) and `@Observed` methods;
- **propagates the context** in W3C `traceparent` headers — over HTTP, and in Kafka record headers when observation is enabled on the template and listener;
- puts `traceId` / `spanId` into log lines.

> [!NOTE]
> **OpenTelemetry** (OTel) is the vendor-neutral standard for traces, metrics and logs. Exporting with OTLP to an OpenTelemetry Collector lets you send data to any backend — Jaeger, Tempo, Datadog, New Relic — without code changes.

## Health Checks

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true          # enabled automatically on Kubernetes
      show-details: when-authorized
```

| Endpoint | Meaning | Used by |
| --- | --- | --- |
| `/actuator/health/liveness` | The app is running and not stuck — if it fails, **restart** it | Kubernetes liveness probe |
| `/actuator/health/readiness` | The app can serve traffic now — if it fails, **stop sending traffic** | Kubernetes readiness probe, load balancers |

> [!TIP]
> Don't include downstream dependencies (another service, an external API) in the **liveness** check — a dependency outage would make Kubernetes restart every healthy instance. Readiness may include critical local dependencies like the database.

## Dashboards and Alerting

- **One dashboard per service**: RED metrics, JVM, connection pools, Kafka consumer lag, circuit-breaker states.
- **Alert on symptoms users feel** — error rate above X%, p99 latency above the SLO, growing consumer lag — not on every CPU spike.
- **SLOs (service-level objectives)**, e.g. "99.9% of checkout requests succeed within 1 second over 30 days", turn monitoring into clear targets, with **error budgets** guiding release speed.
- Every alert should link to a **runbook** describing what to check and how to mitigate.

## Interview Questions

### What are the three pillars of observability?

Logs (detailed events), metrics (aggregated numbers over time) and traces (the path and timing of a request across services), ideally linked by trace IDs.

### How do you debug a slow request across microservices?

Use distributed tracing to find the slow span, then look at that service's logs for the same trace ID and its metrics (latency, pool saturation, GC) to find the cause.

### What replaced Spring Cloud Sleuth?

Micrometer Tracing in Spring Boot 3, with OpenTelemetry or Brave bridges and exporters such as Zipkin or OTLP.

### What is a trace ID and how is it propagated?

A unique ID shared by all spans of one request; it travels between services in headers (W3C `traceparent`) for HTTP calls and in record headers for messaging, and is added to log lines via the MDC.

### What is the RED method?

Monitoring each service's request rate, error rate and request duration (latency percentiles).

### Liveness vs readiness probes?

Liveness answers "should this container be restarted?"; readiness answers "should this instance receive traffic right now?".

## Key Takeaways

- ✅ Logs, metrics and traces answer different questions — link them with trace IDs.
- ✅ Centralize structured JSON logs with `traceId` on every line.
- ✅ Micrometer + Prometheus + Grafana for metrics; watch RED signals and percentiles; avoid high-cardinality tags.
- ✅ Micrometer Tracing with OpenTelemetry replaces Sleuth; context propagates through HTTP and Kafka.
- ✅ Separate liveness from readiness; alert on user-facing symptoms and SLOs.
