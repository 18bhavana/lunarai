---
title: Scalability, Availability & Reliability
subtitle: Vertical vs horizontal scaling, stateless services, scaling a web app step by step from one server to many, latency vs throughput, availability and nines, redundancy and failover, single points of failure, and multi-region designs.
order: 3
---

## Introduction

A **scalable** system handles more load by adding resources. An **available** system keeps serving requests when parts of it fail. A **reliable** system does the right thing consistently. These goals drive most system design decisions.

## Vertical vs Horizontal Scaling

| Vertical scaling (scale up) | Horizontal scaling (scale out) |
| --- | --- |
| Bigger machine — more CPU, RAM, faster disk | More machines sharing the work |
| Simple — no code changes | Needs load balancing and stateless design |
| Hard upper limit and rising cost | Practically unlimited |
| Single point of failure | Redundancy — one machine can fail |
| Often needs downtime to resize | Add or remove nodes without downtime |
| Good first step, especially for databases | The standard approach for web and app tiers |

## Stateless Services Make Scaling Easy

A **stateless** service keeps no client data in memory between requests — every request carries what's needed (a token), and shared state lives in a database, cache or queue. Then any instance can serve any request, and instances can be added or removed freely.

| Stateful (hard to scale) | Stateless (easy to scale) |
| --- | --- |
| HTTP sessions in server memory | Sessions in Redis, or JWTs |
| Uploaded files on local disk | Files in object storage (S3) |
| In-memory caches as the source of truth | Shared cache (Redis) + database |
| Scheduled jobs on "the" server | Distributed scheduler or a leader-elected job |

## Scaling a Web Application Step by Step

```flow
1 — One server running the app and the database
2 — Separate the database onto its own server
3 — Several app servers behind a load balancer (stateless)
4 — Add a cache (Redis) for frequent reads
5 — Read replicas for the database
6 — CDN for static files and media
7 — Message queues for slow or background work
8 — Shard the database as writes and data grow
9 — Multiple regions for latency and disaster recovery
```

Each step solves the bottleneck that appears next — don't jump to step 9 for a small system.

## Latency vs Throughput

| Latency | Throughput |
| --- | --- |
| Time for **one** request — milliseconds | Requests handled **per second** |
| Measured as percentiles: p50, p95, **p99** | Measured as QPS / TPS / MB/s |
| Improved by caching, locality, fewer hops, faster queries | Improved by more instances, parallelism, batching |

They're related but different: batching raises throughput but can add latency. Users feel the **tail latency** (p99) — one slow call among ten parallel calls makes the whole page slow.

## Availability

**Availability** = the fraction of time a system is up and serving correctly:

| Target | Downtime per year |
| --- | --- |
| 99.9% | ~8.8 hours |
| 99.99% | ~53 minutes |
| 99.999% | ~5 minutes |

### Availability of Combined Components

- **In series** (A *and* B are both needed): availability **multiplies down** — two 99.9% services give 99.8%.
- **In parallel** (either A *or* B is enough): availability **goes up** — two independent 99% replicas give 1 − 0.01² = 99.99%.

That's why long synchronous call chains hurt, and why **redundancy** helps.

## Redundancy and Failover

Remove **single points of failure (SPOFs)** — any component whose failure stops the whole system:

| Component | Redundancy |
| --- | --- |
| App servers | Several instances behind a load balancer, across availability zones |
| Load balancer | A managed (cloud) load balancer or an active–passive pair |
| Database | Primary + replicas with automatic failover |
| Cache | Replicated Redis (Sentinel or Cluster) |
| Message broker | Replicated Kafka (RF = 3) |
| Data centre | Multiple availability zones; multiple regions for critical systems |

| Failover style | Behaviour |
| --- | --- |
| **Active–passive** | A standby takes over when the active node fails (some failover time) |
| **Active–active** | All nodes serve traffic; losing one just reduces capacity |

## Reliability Techniques

- **Health checks** so load balancers and orchestrators route around bad instances.
- **Timeouts, retries, circuit breakers and bulkheads** to contain failures (see [Resilience Patterns](/microservices/microservices-basics/resilience-patterns/)).
- **Graceful degradation** — drop non-essential features instead of failing completely.
- **Load shedding** — reject excess requests quickly (429/503) to protect the core.
- **Backups and tested restores**; replication is not a backup (it replicates mistakes too).
- **Chaos testing** — deliberately kill instances to prove the system survives.

## Multi-Region Designs

| Pattern | How | Trade-off |
| --- | --- | --- |
| **Active–passive (disaster recovery)** | One region serves traffic; another is ready to take over | Simple; failover takes minutes; standby capacity is idle |
| **Active–active** | Several regions serve users at once | Low latency worldwide and high availability, but cross-region data consistency is hard |

Key measures for disaster recovery:

- **RPO (Recovery Point Objective)** — how much data you can afford to lose (e.g. 5 minutes).
- **RTO (Recovery Time Objective)** — how long recovery may take (e.g. 1 hour).

## Interview Questions

### Vertical vs horizontal scaling?

Vertical scaling adds resources to one machine — simple but limited and a single point of failure. Horizontal scaling adds machines behind a load balancer — needs stateless design but scales far further and adds redundancy.

### Why should services be stateless?

So any instance can handle any request, which makes horizontal scaling, load balancing, failover and rolling deployments simple. State moves to databases, caches and object storage.

### What is a single point of failure?

A component whose failure makes the whole system unavailable. Remove them with redundancy at every tier.

### How does availability combine across components?

Components in series multiply their availabilities (lower overall); redundant components in parallel increase availability.

### What are RPO and RTO?

RPO is the maximum acceptable data loss measured in time; RTO is the maximum acceptable time to restore service after a disaster.

## Key Takeaways

- ✅ Scale up first for simplicity; scale out for real growth and redundancy.
- ✅ Stateless services are the foundation of horizontal scaling.
- ✅ Scale step by step, solving the current bottleneck.
- ✅ Track latency percentiles (p99) and throughput separately.
- ✅ Availability falls in series and rises with redundancy — remove SPOFs.
- ✅ Plan disaster recovery with explicit RPO and RTO targets.
