---
title: Service Discovery & Load Balancing
subtitle: Why hard-coded URLs fail in dynamic environments, client-side vs server-side discovery, Eureka server and clients, Spring Cloud LoadBalancer with @LoadBalanced, health and self-preservation, and how Kubernetes Services replace Eureka.
order: 4
---

## Introduction

In the cloud, service instances come and go — they autoscale, crash, restart and move to new IP addresses. A caller can't hard-code `http://10.0.4.17:8080`. **Service discovery** keeps track of where every instance is, and **load balancing** spreads calls across them.

## The Problem

```flow
Order service needs to call inventory-service
Inventory has 3 instances today, 7 after autoscaling, new IPs after every deployment
Hard-coded addresses break immediately
```

## Service Registry

A **service registry** is a database of available instances:

| Service | Instances |
| --- | --- |
| `inventory-service` | 10.0.4.17:8080, 10.0.5.22:8080, 10.0.6.9:8080 |
| `payment-service` | 10.0.4.30:8080, 10.0.7.11:8080 |

```flow
Instance starts and registers its name, host and port
Instance sends heartbeats regularly
Registry removes instances that stop heartbeating
Callers look up healthy instances by service name
```

## Client-Side vs Server-Side Discovery

| Client-side discovery | Server-side discovery |
| --- | --- |
| The **caller** queries the registry and picks an instance | The caller calls a **load balancer / router**, which picks an instance |
| e.g. Eureka + Spring Cloud LoadBalancer | e.g. Kubernetes Services, AWS ALB, a service mesh |
| Smart clients; one less network hop | Simple clients; works for any language |
| Discovery logic in every service | Discovery handled by the platform |

## Eureka Server

Netflix **Eureka** (via Spring Cloud Netflix) is the classic registry in the Spring ecosystem.

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
```

```java
@SpringBootApplication
@EnableEurekaServer
public class DiscoveryServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServerApplication.class, args);
    }
}
```

```yaml
server:
  port: 8761
eureka:
  client:
    register-with-eureka: false   # the server doesn't register itself
    fetch-registry: false
```

The dashboard at `http://localhost:8761` lists registered services and instances.

## Eureka Clients

Each service adds the client starter and a name — registration is automatic:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

```yaml
spring:
  application:
    name: inventory-service          # the name others use to find it
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
  instance:
    prefer-ip-address: true
```

Clients send a heartbeat every 30 seconds by default and cache the registry locally, so calls keep working briefly even if Eureka is down.

## Client-Side Load Balancing

**Spring Cloud LoadBalancer** turns a service name into a real instance address:

```java
@Configuration
public class ClientConfig {

    @Bean
    @LoadBalanced                                   // resolve service names through discovery
    RestClient.Builder loadBalancedBuilder() {
        return RestClient.builder();
    }

    @Bean
    RestClient inventoryClient(@LoadBalanced RestClient.Builder builder) {
        return builder.baseUrl("http://inventory-service").build();
    }
}
```

```flow-h
http://inventory-service/api/stock/42
LoadBalancer picks a healthy instance — round robin
http://10.0.5.22:8080/api/stock/42
```

OpenFeign clients (`@FeignClient(name = "inventory-service")`) are load-balanced automatically.

| Algorithm | Behaviour |
| --- | --- |
| Round robin (default) | Instances in turn |
| Random | Random instance |
| Weighted / zone-aware / same-instance preference | Configurable via `ServiceInstanceListSupplier` |

> [!NOTE]
> Older Spring Cloud versions used **Netflix Ribbon** for client-side load balancing. Ribbon has been removed — Spring Cloud LoadBalancer is its replacement.

## Health and Self-Preservation

- Eureka removes an instance after it misses heartbeats for about 90 seconds (configurable), so callers may briefly hit dead instances — combine discovery with **retries and circuit breakers**.
- If many instances stop heartbeating at once (often a network problem rather than real failures), Eureka enters **self-preservation mode** and stops evicting instances, to avoid wiping out the registry. It's a known source of "why is a dead instance still listed?" confusion in development.

## Discovery in Kubernetes

On Kubernetes you usually **don't need Eureka**. A Kubernetes **Service** gives a stable DNS name and load-balances across healthy pods:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: inventory-service
spec:
  selector:
    app: inventory
  ports:
    - port: 80
      targetPort: 8080
```

```java
// From any pod in the cluster
RestClient client = RestClient.create("http://inventory-service");
```

| Eureka | Kubernetes Service |
| --- | --- |
| Separate server to run and secure | Built into the platform |
| Client-side load balancing | Server-side (kube-proxy) — or a service mesh |
| Java/Spring-centric | Language-agnostic |
| Useful on VMs or non-Kubernetes platforms | The default choice on Kubernetes |

**Readiness probes** decide which pods receive traffic; **service meshes** (Istio, Linkerd) add smarter load balancing, retries, mTLS and traffic splitting on top.

## Interview Questions

### What is service discovery?

A mechanism that lets services find the network locations of other services' instances dynamically, using a registry that instances register with and send heartbeats to.

### Client-side vs server-side discovery?

In client-side discovery, the caller queries the registry and picks an instance (Eureka + Spring Cloud LoadBalancer). In server-side discovery, the caller sends requests to a router or load balancer that picks the instance (Kubernetes Services, cloud load balancers).

### How does @LoadBalanced work?

It adds an interceptor to the `RestClient`/`RestTemplate`/`WebClient` builder that resolves the host part of the URL (a service name) to a healthy instance from the discovery client, using Spring Cloud LoadBalancer.

### What is Eureka's self-preservation mode?

When too many instances stop renewing their leases at once, Eureka assumes a network problem and stops evicting instances, keeping the registry intact.

### Do you need Eureka on Kubernetes?

Usually not — Kubernetes Services provide DNS-based discovery and load balancing across ready pods.

## Key Takeaways

- ✅ Dynamic environments need service discovery instead of fixed addresses.
- ✅ Eureka is a registry; services register by `spring.application.name` and send heartbeats.
- ✅ Spring Cloud LoadBalancer (`@LoadBalanced`, Feign) resolves names to instances — Ribbon is gone.
- ✅ Discovery is eventually consistent — pair it with retries and circuit breakers.
- ✅ On Kubernetes, Services and DNS usually replace Eureka.
