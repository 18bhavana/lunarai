---
title: Centralized Configuration with Spring Cloud Config
subtitle: Externalized configuration and the twelve-factor app, a Git-backed Config Server, clients with spring.config.import, profiles and per-service files, refreshing with @RefreshScope and Spring Cloud Bus, handling secrets, and Kubernetes ConfigMaps and Secrets.
order: 6
---

## Introduction

Twenty services, each with dev, test and prod settings, means dozens of configuration files. Changing a timeout everywhere shouldn't need twenty rebuilds. **Externalized, centralized configuration** keeps settings outside the code, in one managed place.

## Externalized Configuration

The **twelve-factor app** principle: *store config in the environment*. The same build artifact runs everywhere; only configuration changes.

| Belongs in configuration | Belongs in code |
| --- | --- |
| URLs, ports, timeouts, pool sizes | Business rules |
| Feature flags | Algorithms |
| Credentials (from a secret store) | Default behaviour |
| Per-environment differences | Anything identical in every environment |

Spring Boot already reads config from many sources, in precedence order — command-line arguments, environment variables, `application-{profile}.yml`, `application.yml`. Spring Cloud Config adds a **central server** to that list.

## Spring Cloud Config Server

```tree
Git repository — config
  application.yml | shared by all services
  order-service.yml | order service, all profiles
  order-service-prod.yml | order service, prod profile
  payment-service.yml
  payment-service-prod.yml
```

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-config-server</artifactId>
</dependency>
```

```java
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication { }
```

```yaml
server:
  port: 8888
spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/acme/shop-config
          default-label: main
          search-paths: '{application}'     # optional: one folder per service
```

Git gives you **history, review and rollback** for every configuration change. The server can also read from the filesystem, HashiCorp Vault, a JDBC database or AWS services.

### Checking the Server

```bash
curl http://localhost:8888/order-service/prod
```

The response lists the merged property sources: `order-service-prod.yml`, `order-service.yml`, then `application.yml`.

## Config Clients

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-config</artifactId>
</dependency>
```

```yaml
spring:
  application:
    name: order-service                    # selects order-service*.yml
  profiles:
    active: prod
  config:
    import: "optional:configserver:http://localhost:8888"
```

At startup the service fetches its configuration from the server before creating beans. `optional:` lets it start with local defaults if the server is unreachable; drop it if starting without central config would be dangerous.

> [!NOTE]
> Older Spring Cloud versions used a separate `bootstrap.yml`. Since Spring Cloud 2020, the `spring.config.import` property is the standard way.

## Refreshing Configuration at Runtime

### @RefreshScope

```java
@RestController
@RefreshScope
public class PromoController {

    @Value("${promo.banner:}")
    private String banner;

    @GetMapping("/promo")
    public String banner() {
        return banner;
    }
}
```

After changing the value in Git, trigger a refresh:

```bash
curl -X POST http://order-service:8080/actuator/refresh
```

Beans in `@RefreshScope` (and `@ConfigurationProperties` beans) are rebuilt with the new values — no restart. Expose the endpoint with `management.endpoints.web.exposure.include=refresh` (and secure it).

### Spring Cloud Bus

Calling `/actuator/refresh` on 40 instances is tedious. **Spring Cloud Bus** connects instances through Kafka or RabbitMQ: one `POST /actuator/busrefresh` broadcasts the refresh to all of them. A Git webhook can trigger it automatically on every commit.

```flow
Commit a config change to Git
Webhook or a call to /actuator/busrefresh
Config Server publishes a refresh event on the bus (Kafka or RabbitMQ)
Every instance reloads its refreshable beans
```

> [!WARNING]
> Not everything can be refreshed safely — connection pool sizes, server ports or a `DataSource` URL usually need a restart. Treat runtime refresh as a tool for feature flags and tunable values, and roll out risky changes with a normal deployment.

## Secrets

Never commit passwords, API keys or private keys to the config repository in plain text.

| Approach | Notes |
| --- | --- |
| **HashiCorp Vault** backend | Config Server or Spring Cloud Vault fetch secrets at startup; supports rotation and leases |
| **Cloud secret managers** | AWS Secrets Manager, Azure Key Vault, GCP Secret Manager (Spring Cloud AWS/Azure/GCP integrations) |
| **Encrypted values** | Config Server can store `{cipher}…` values and decrypt them with a key |
| **Kubernetes Secrets** | Mounted as files or environment variables (encrypt at rest, restrict access) |

## Configuration on Kubernetes

On Kubernetes, many teams skip the Config Server:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-service-config
data:
  application.yaml: |
    payment:
      client:
        read-timeout: 3s
```

- **ConfigMaps** hold non-secret settings; **Secrets** hold credentials.
- Mount them as files (Spring Boot reads them with `spring.config.import=optional:configtree:/etc/config/`) or expose them as environment variables.
- Spring Cloud Kubernetes can read ConfigMaps directly and reload on change.
- Tools like Helm or Kustomize generate per-environment values, with GitOps (Argo CD, Flux) keeping clusters in sync with Git.

| Spring Cloud Config | Kubernetes ConfigMaps / Secrets |
| --- | --- |
| Works anywhere — VMs, Kubernetes, cloud | Kubernetes only |
| Git history and review built in | Use GitOps for history |
| Runtime refresh with Bus | Reload via mounted-file updates or Spring Cloud Kubernetes |
| Another service to run | Built into the platform |

## Interview Questions

### Why externalize configuration?

So the same build runs in every environment with only configuration changing, settings can change without rebuilding, and secrets stay out of source code.

### How does Spring Cloud Config work?

A Config Server serves properties from a backend such as Git, organised by application name, profile and label; clients fetch them at startup via `spring.config.import=configserver:…`.

### How do you change configuration without restarting?

Mark beans with `@RefreshScope` (or use `@ConfigurationProperties`) and call `/actuator/refresh`; use Spring Cloud Bus with `/actuator/busrefresh` to refresh all instances at once.

### How do you handle secrets?

Keep them out of Git; use Vault, a cloud secret manager, encrypted `{cipher}` values or Kubernetes Secrets, with restricted access and rotation.

### Do you need Config Server on Kubernetes?

Not necessarily — ConfigMaps and Secrets (often managed with Helm and GitOps) cover most needs; Config Server is still useful across mixed platforms or when you want its Git-based workflow and Bus refresh.

## Key Takeaways

- ✅ Keep configuration outside the artifact; one build, many environments.
- ✅ Spring Cloud Config serves Git-backed configuration by application and profile.
- ✅ Clients use `spring.config.import=configserver:…`.
- ✅ `@RefreshScope` + `/actuator/refresh`, or Spring Cloud Bus, apply changes at runtime.
- ✅ Store secrets in Vault or a secret manager, never in plain text in Git.
- ✅ On Kubernetes, ConfigMaps and Secrets are a common alternative.
