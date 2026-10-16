---
title: Load Balancing
subtitle: What a load balancer does, Layer 4 vs Layer 7, balancing algorithms from round robin to least connections and consistent hashing, health checks, sticky sessions, TLS termination, global load balancing with DNS and anycast, and avoiding the load balancer as a single point of failure.
order: 4
---

## Introduction

A **load balancer** distributes incoming requests across a pool of servers, so no single server is overwhelmed and failed servers are taken out of rotation automatically. It's the first component in almost every scalable design.

```flow-h
Clients
Load balancer
Server 1, Server 2, Server 3
```

## What a Load Balancer Does

- **Distributes traffic** across healthy servers.
- **Health-checks** servers and stops sending traffic to failed ones.
- **Enables zero-downtime deployments** — drain and replace servers one by one.
- **Terminates TLS** so servers don't each manage certificates.
- **Hides the topology** — clients see one address.
- Often adds **rate limiting, WAF rules, compression and caching**.

## Layer 4 vs Layer 7

| Layer 4 (transport) | Layer 7 (application) |
| --- | --- |
| Routes by IP address and port (TCP/UDP) | Routes by HTTP content — path, host, headers, cookies |
| Doesn't look inside the request | Understands HTTP; can rewrite headers and paths |
| Very fast, low overhead | More flexible, slightly more overhead |
| Any TCP protocol (databases, Kafka, gRPC) | HTTP/HTTPS, gRPC, WebSockets |
| e.g. AWS Network Load Balancer, HAProxy (TCP mode) | e.g. AWS Application Load Balancer, NGINX, Envoy, API gateways |

A Layer 7 balancer can send `/api/*` to API servers and `/static/*` to a static-file service, or route by tenant header.

## Balancing Algorithms

| Algorithm | How it works | Good for |
| --- | --- | --- |
| **Round robin** | Each server in turn | Identical servers and similar requests |
| **Weighted round robin** | More requests to stronger servers | Mixed hardware, canary releases |
| **Least connections** | The server with the fewest active connections | Requests with very different durations |
| **Least response time** | The fastest-responding server | Latency-sensitive services |
| **Random / power of two choices** | Pick two random servers, use the less loaded | Large pools — simple and surprisingly effective |
| **IP hash** | Hash of the client IP picks the server | Rough stickiness without cookies |
| **Consistent hashing** | Hash of a key maps to a server on a ring; few keys move when servers change | Caches and sharded data (see *Replication & Sharding*) |

## Health Checks

```flow
Load balancer probes GET /health on every server every few seconds
? Healthy — 2xx within the timeout? | Yes: keep it in rotation | No: after N failures, remove it from the pool
Server recovers and passes checks again
Load balancer adds it back
```

- **Active checks** — the balancer polls a health endpoint (`/actuator/health/readiness` in Spring Boot).
- **Passive checks** — the balancer notices real requests failing and ejects the server (outlier detection).
- **Connection draining** — on removal, let in-flight requests finish before cutting the server off.

## Sticky Sessions

**Session affinity** sends a user's requests to the same server (via a cookie or IP hash), usually because sessions live in that server's memory.

| Pros | Cons |
| --- | --- |
| Works with stateful apps | Uneven load — popular users pin to one server |
| | Sessions lost if that server dies |
| | Makes scaling and deployments harder |

> [!TIP]
> Prefer **stateless** servers — store sessions in Redis or use tokens — so any server can handle any request and stickiness isn't needed. Stickiness is still useful for WebSockets and some caches.

## TLS Termination

| Option | Notes |
| --- | --- |
| **Terminate at the load balancer** | Certificates managed in one place; servers receive plain HTTP inside a private network |
| **Re-encrypt to backends** | TLS from client to balancer **and** balancer to server — for zero-trust or compliance |
| **TLS passthrough (L4)** | The balancer forwards encrypted traffic; servers terminate TLS |

The balancer passes the original client IP and protocol in headers such as `X-Forwarded-For` and `X-Forwarded-Proto` (Spring Boot honours them with `server.forward-headers-strategy=framework`).

## Global Load Balancing

For users around the world, traffic must first reach the **right region**:

| Technique | How |
| --- | --- |
| **GeoDNS / latency-based DNS** | DNS returns the IP of the nearest or healthiest region (e.g. Route 53) |
| **Anycast** | The same IP is announced from many locations; the network routes users to the closest one (CDNs, Cloudflare, Google Cloud's global load balancer) |
| **CDN in front** | Static and cacheable content served at the edge; dynamic requests forwarded to the nearest origin |

```flow
User in Mumbai looks up api.example.com
GeoDNS returns the ap-south region
Regional load balancer
App servers in that region
```

## Avoiding a Single Point of Failure

The load balancer itself must be redundant:

- **Managed cloud load balancers** are already redundant across availability zones.
- Self-hosted balancers run as an **active–passive pair** sharing a virtual IP (keepalived/VRRP), or **active–active** behind DNS or anycast.

## Load Balancing Inside Microservices

| Style | Example |
| --- | --- |
| Server-side | Kubernetes Services, internal cloud load balancers |
| Client-side | Spring Cloud LoadBalancer with service discovery |
| Service mesh sidecars | Envoy in Istio — per-request balancing, retries, outlier detection |

See [Service Discovery & Load Balancing](/microservices/microservices-basics/service-discovery-load-balancing/).

## Interview Questions

### What does a load balancer do?

Distributes requests across healthy servers, removes failed servers via health checks, enables horizontal scaling and zero-downtime deployments, and often terminates TLS.

### Layer 4 vs Layer 7 load balancing?

Layer 4 routes by IP and port without inspecting content — fast and protocol-agnostic. Layer 7 understands HTTP and can route by path, host, headers or cookies, and rewrite requests.

### Which algorithm would you use when request times vary a lot?

Least connections (or least response time / power-of-two-choices), so long requests don't pile up on one server as they would with plain round robin.

### What are sticky sessions, and why avoid them?

Routing a user's requests to the same server, usually because sessions are in memory. They cause uneven load and lost sessions on failure; stateless servers with shared session storage or tokens are better.

### How do you avoid the load balancer being a single point of failure?

Use a managed, multi-zone cloud load balancer, or run redundant balancers (active–passive with a floating IP, or active–active behind DNS/anycast).

## Key Takeaways

- ✅ Load balancers spread traffic, remove unhealthy servers and enable horizontal scaling.
- ✅ L4 is fast and protocol-agnostic; L7 routes on HTTP content.
- ✅ Pick algorithms by workload: round robin, least connections, consistent hashing.
- ✅ Health checks and connection draining make failures and deployments invisible to users.
- ✅ Prefer stateless servers over sticky sessions; make the balancer itself redundant.
- ✅ Use GeoDNS, anycast and CDNs for global traffic.
