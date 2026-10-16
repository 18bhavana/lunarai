---
title: Deploying Microservices — Docker, Kubernetes & CI/CD
subtitle: Containerizing Spring Boot with a multi-stage Dockerfile and layered jars, Docker Compose for local development, Kubernetes Deployments, Services, probes, resources and autoscaling, graceful shutdown, rolling, blue-green and canary releases, and CI/CD pipelines.
order: 11
---

## Introduction

Microservices are only practical with **automated, repeatable deployment**. Containers package each service with its runtime; an orchestrator like Kubernetes runs, heals and scales them; CI/CD pipelines take every commit from code to production safely.

## Containerizing a Spring Boot Service

### A Multi-Stage Dockerfile

```dockerfile
# ---- build stage ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./mvnw -q package -DskipTests \
 && java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination extracted

# ---- runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 appuser
COPY --from=build /app/extracted/dependencies/ ./
COPY --from=build /app/extracted/spring-boot-loader/ ./
COPY --from=build /app/extracted/snapshot-dependencies/ ./
COPY --from=build /app/extracted/application/ ./
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "org.springframework.boot.loader.launch.JarLauncher"]
```

| Practice | Why |
| --- | --- |
| **Multi-stage build** | The final image contains a JRE and the app — not Maven, sources or the JDK |
| **Layered jar** | Dependencies change rarely, so their layer is cached; rebuilds only push the small application layer |
| **Non-root user** | Limits the damage if the container is compromised |
| `-XX:MaxRAMPercentage` | The JVM sizes its heap from the container's memory limit |
| Pinned, minimal base image | Smaller attack surface; reproducible builds |

> [!TIP]
> Without a Dockerfile at all, `./mvnw spring-boot:build-image` builds an optimised, layered image with **Cloud Native Buildpacks** — a good default for many teams.

### Docker Compose for Local Development

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: orders
      POSTGRES_PASSWORD: secret
  kafka:
    image: apache/kafka:latest
    ports: ["9092:9092"]
  order-service:
    build: ./order-service
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/orders
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:9092
    depends_on: [postgres, kafka]
```

Spring Boot's `spring-boot-docker-compose` support can also start a `compose.yaml` automatically when you run the app locally.

## Kubernetes Essentials

| Object | Purpose |
| --- | --- |
| **Pod** | One or more containers running together — the unit Kubernetes schedules |
| **Deployment** | Keeps N replicas of a pod running; performs rolling updates |
| **Service** | Stable DNS name and load balancing across ready pods |
| **Ingress / Gateway API** | Routes external HTTP traffic into the cluster |
| **ConfigMap / Secret** | Configuration and credentials |
| **HorizontalPodAutoscaler** | Scales replicas on CPU, memory or custom metrics |
| **Namespace** | Groups and isolates resources per team or environment |

### A Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 3
  selector:
    matchLabels: { app: order-service }
  template:
    metadata:
      labels: { app: order-service }
    spec:
      containers:
        - name: order-service
          image: registry.example.com/order-service:1.4.2
          ports: [{ containerPort: 8080 }]
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: prod
          resources:
            requests: { cpu: "500m", memory: "768Mi" }
            limits:   { memory: "768Mi" }
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            periodSeconds: 10
          startupProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            failureThreshold: 30
            periodSeconds: 5
```

| Setting | Why |
| --- | --- |
| **Readiness probe** | No traffic until the app is ready, or while it's temporarily unhealthy |
| **Liveness probe** | Restart a stuck container |
| **Startup probe** | Give slow-starting JVMs time before liveness checks begin |
| **Resource requests** | Let the scheduler place pods correctly |
| **Memory limit** | Protect the node; the JVM sizes itself from it (`MaxRAMPercentage`) |
| **Immutable image tags** | `1.4.2`, never `latest`, so deployments are reproducible |

### Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: order-service }
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```

For Kafka consumers, scaling on **consumer lag** (e.g. with KEDA) often works better than CPU — and replicas beyond the partition count add nothing.

## Graceful Shutdown

During a rolling update, Kubernetes sends `SIGTERM`. Let in-flight requests finish:

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

Spring Boot stops accepting new requests, completes in-flight ones, closes Kafka consumers and producers (committing offsets) and then exits. Keep `terminationGracePeriodSeconds` in the pod spec longer than this timeout.

## Release Strategies

| Strategy | How | Trade-off |
| --- | --- | --- |
| **Rolling update** (Kubernetes default) | Replace pods a few at a time | Simple; old and new versions run side by side briefly |
| **Blue-green** | Run the new version (green) fully alongside the old (blue), then switch all traffic | Instant rollback; needs double capacity |
| **Canary** | Send a small share of traffic (e.g. 5%) to the new version, watch metrics, then increase | Limits blast radius; needs traffic splitting (mesh, ingress, Argo Rollouts) |
| **Feature flags** | Deploy code dark, enable features at runtime per user group | Decouples deploy from release |

> [!IMPORTANT]
> Because old and new versions run together during rollouts, every change must be **backward compatible**: APIs, events and database schemas. Use **expand–contract** database migrations (add new columns first, switch code, remove old columns later) with Flyway or Liquibase.

## CI/CD Pipelines

```flow-h
Commit
Build and unit tests
Static analysis and security scans
Container image
Integration and contract tests
Deploy to staging
Deploy to production — canary, then full
```

- **One pipeline per service**, so services deploy independently.
- **Testcontainers** for integration tests with real databases and Kafka.
- **Contract tests** (Pact, Spring Cloud Contract) to catch breaking API changes.
- **Image and dependency scanning** (Trivy, OWASP Dependency-Check, Snyk).
- **GitOps** (Argo CD, Flux): the desired state of each environment lives in Git, and the cluster syncs to it.

## The Twelve-Factor App (Highlights)

| Factor | In practice |
| --- | --- |
| Codebase | One repo (or module) per service, many deploys |
| Dependencies | Declared explicitly (Maven/Gradle) and packaged in the image |
| Config | In the environment, not the code |
| Backing services | Databases and brokers attached through configuration |
| Processes | **Stateless** — state lives in databases, caches or Kafka |
| Disposability | Fast startup, graceful shutdown |
| Dev/prod parity | Same images and similar dependencies everywhere |
| Logs | Write to stdout; the platform collects them |

## Interview Questions

### How do you containerize a Spring Boot application?

With a multi-stage Dockerfile that builds the jar and copies its extracted layers onto a minimal JRE image running as a non-root user — or with `spring-boot:build-image` (Buildpacks).

### What are liveness, readiness and startup probes?

Liveness restarts a stuck container; readiness controls whether a pod receives traffic; a startup probe delays liveness checks until a slow-starting app is up. Spring Boot provides `/actuator/health/liveness` and `/readiness`.

### What is graceful shutdown and why does it matter?

On `SIGTERM`, the app stops taking new requests and finishes in-flight work before exiting (`server.shutdown=graceful`), so rolling deployments don't fail user requests or lose messages.

### Rolling vs blue-green vs canary deployments?

Rolling replaces instances gradually; blue-green runs a full new environment and switches traffic at once (easy rollback); canary routes a small share of traffic to the new version and increases it as metrics stay healthy.

### How do you handle database changes with zero downtime?

Expand–contract migrations: add new structures in a backward-compatible way, deploy code that uses both, migrate data, then remove the old structures in a later release.

## Key Takeaways

- ✅ Build small, layered, non-root images with a JRE — or use Buildpacks.
- ✅ Kubernetes Deployments, Services, probes, resources and HPAs run and scale services.
- ✅ Configure graceful shutdown so rollouts don't drop requests.
- ✅ Choose rolling, blue-green or canary releases; keep every change backward compatible.
- ✅ One CI/CD pipeline per service, with integration, contract and security checks.
