---
title: System Design Cheat Sheet & Practice
subtitle: The interview framework on one page, the building blocks and when to use each, key numbers, common trade-offs, a checklist of non-functional concerns, and practice problems with hints.
order: 14
---

## Introduction

A one-page summary of the whole topic for revision — plus practice problems to apply it.

## Quick Revision

| Topic | Remember |
| --- | --- |
| Framework | Requirements → estimates → API → data model → high-level design → deep dives → trade-offs |
| Requirements | Functional (features) vs non-functional (scale, latency, availability, consistency, durability) |
| Estimation | 1 day ≈ 10⁵ s; QPS = DAU × actions ÷ 10⁵; peak ≈ 2–10×; storage × retention × replication |
| Latency | Memory ~100 ns · SSD ~100 µs · DC round trip ~0.5 ms · cross-continent ~150 ms |
| Nines | 99.9% ≈ 8.8 h/yr · 99.99% ≈ 53 min/yr · 99.999% ≈ 5 min/yr |
| Scaling | Scale up first; scale out with stateless services behind load balancers |
| Load balancing | L4 vs L7; round robin, least connections, consistent hashing; health checks |
| Caching | Cache-aside + TTL; delete on write; stampede, penetration, avalanche, hot keys; CDN for static/media |
| Databases | SQL for transactions and relations; key-value, document, wide-column, graph for specific patterns |
| Replication | Leader–follower; read replicas; lag; sync vs async; failover |
| Sharding | Shard key = high cardinality + even load + query-aligned; consistent hashing |
| CAP | During a partition choose C or A; PACELC adds latency vs consistency |
| Consistency | Strong for money/inventory; eventual for feeds/counters; read-your-writes for UX |
| Async | Queues for tasks, streams for events; at-least-once → idempotent consumers; DLQs |
| Rate limiting | Token bucket (bursts), sliding window counter (smooth); Redis; 429 + Retry-After |
| APIs | REST resources, status codes, idempotency keys, cursor pagination, versioning |
| Real time | SSE (one-way), WebSockets (two-way), webhooks (server-to-server) |
| Resilience | Timeouts, retries + jitter, circuit breakers, bulkheads, fallbacks, load shedding |

## Building Blocks — When to Use Each

| Component | Use when |
| --- | --- |
| **Load balancer** | More than one server; you need redundancy and zero-downtime deploys |
| **CDN** | Static assets, images, video, global users |
| **Cache (Redis)** | Read-heavy data, expensive computations, sessions, counters |
| **Relational DB** | Transactions, relationships, flexible queries |
| **NoSQL store** | Huge scale with simple access patterns, flexible schema, high write volume |
| **Object storage (S3)** | Files, media, backups, data lake |
| **Search engine** | Full-text search, filters, facets |
| **Message queue** | Background jobs, smoothing bursts, decoupling a task from the request |
| **Event stream (Kafka)** | Many consumers of the same events, replay, data pipelines |
| **Rate limiter** | Public APIs, expensive operations, login/OTP endpoints |
| **API gateway** | Many services behind one entry point; auth, routing, limits |
| **Unique ID generator** | Distributed IDs without a single database sequence (Snowflake, UUIDv7) |
| **Consensus store (etcd/ZooKeeper)** | Leader election, distributed locks, critical configuration |

## Common Trade-offs

| Trade-off | Think about |
| --- | --- |
| Consistency vs availability | What's worse for this feature: an error or stale data? |
| Latency vs consistency | Synchronous replication and quorums cost time |
| Latency vs throughput | Batching raises throughput but adds delay |
| SQL vs NoSQL | Query flexibility and transactions vs scale and schema flexibility |
| Push vs pull | Real-time delivery vs simplicity and load control |
| Normalised vs denormalised | Write simplicity and integrity vs read speed |
| Sync vs async | Immediate result vs resilience and decoupling |
| Monolith vs microservices | Simplicity vs independent scaling and deployment |
| Build vs buy (managed) | Control and cost vs operational effort |
| Cache freshness vs hit rate | Short TTLs = fresher data, more DB load |

## Non-Functional Checklist

Before finishing any design, check:

- ✅ **Scalability** — what breaks at 10× load? Which component scales how?
- ✅ **Availability** — any single point of failure? Multi-AZ? Failover?
- ✅ **Durability** — replication, backups, tested restores?
- ✅ **Consistency** — where is strong consistency required, and where is eventual fine?
- ✅ **Latency** — caching, CDNs, locality, parallel calls, p99 targets?
- ✅ **Security** — authentication, authorization, encryption, rate limiting, input validation?
- ✅ **Observability** — metrics, logs, traces, alerts?
- ✅ **Cost** — storage tiers, autoscaling, data transfer?
- ✅ **Operability** — deployments, configuration, schema migrations?

## Practice Problems

Use the framework for each. Hints point to the key challenges.

### 1. Design a rate limiter

*Hints:* token bucket vs sliding window counter, Redis with atomic Lua scripts, per-user and per-endpoint rules, fail-open behaviour, 429 headers. See *Rate Limiting*.

### 2. Design a news feed (like a social timeline)

*Hints:* fan-out on write (precompute feeds) vs fan-out on read; hybrid for celebrities; feed cache in Redis; ranking; pagination with cursors.

### 3. Design a chat application

*Hints:* WebSocket gateways, presence, message storage (wide-column keyed by conversation), ordering per conversation, delivery receipts, offline push notifications, pub/sub between gateway servers.

### 4. Design a ride-hailing service

*Hints:* driver location updates (high write rate), geospatial indexing (geohash, quadtrees, Redis GEO), matching, trip state machine, surge pricing, payments via saga.

### 5. Design an e-commerce checkout

*Hints:* inventory reservation with strong consistency, payment idempotency keys, order saga with compensations, outbox events, handling flash-sale spikes with queues.

### 6. Design a distributed cache

*Hints:* consistent hashing, replication, eviction (LRU/LFU), hot keys, cache-aside vs write-through, client-side routing.

### 7. Design a file storage service (like Google Drive)

*Hints:* chunking and deduplication, metadata DB vs blob storage, sync and conflict resolution, sharing permissions, CDN for downloads.

### 8. Design a video streaming platform

*Hints:* upload pipeline with asynchronous transcoding, adaptive bitrate streaming, CDN distribution, view counts with eventual consistency, recommendations.

### 9. Design a unique ID generator

*Hints:* UUID vs database sequences vs Snowflake (timestamp + machine ID + sequence); sortability, clock skew, collisions.

### 10. Design a web crawler

*Hints:* URL frontier queue, politeness per domain, deduplication with Bloom filters, distributed workers, storing pages, recrawl scheduling.

## How to Practise

1. Pick a problem and set a **45-minute timer**.
2. Write requirements and estimates **before** drawing.
3. Draw the high-level design, then pick **two deep dives**.
4. List **three trade-offs** you made and **two failure scenarios**.
5. Compare with the worked designs in this topic ([URL shortener](/system-design/system-design-basics/design-url-shortener/), [notification system](/system-design/system-design-basics/design-notification-system/)) and refine.

## Key Takeaways

- ✅ Use the same framework every time — it keeps you calm and structured.
- ✅ Know each building block's purpose, and justify every component you add.
- ✅ Numbers drive designs: estimate first.
- ✅ Every decision is a trade-off — say what you gain and what it costs.
- ✅ Finish with failures, bottlenecks, security and observability.
