---
title: Caching & CDNs
subtitle: Where caches live, cache-aside, read-through, write-through and write-behind, TTLs and invalidation, eviction policies, cache stampedes and hot keys, Redis vs local caches, Spring @Cacheable, and content delivery networks.
order: 5
---

## Introduction

A **cache** stores copies of frequently used data in fast storage (memory) so future requests are served quickly without hitting the slower source (a database or another service). Caching is usually the **single biggest performance win** in read-heavy systems.

> "There are only two hard things in computer science: cache invalidation and naming things." — Phil Karlton

## Where Caches Live

```flow-h
Browser cache
CDN edge
API gateway or reverse-proxy cache
Application cache — local or Redis
Database buffer pool
```

| Layer | Caches | Example |
| --- | --- | --- |
| **Client** | Static files, API responses | HTTP `Cache-Control`, `ETag` |
| **CDN** | Images, JS/CSS, video, cacheable pages | Cloudflare, CloudFront, Akamai |
| **Reverse proxy / gateway** | Whole HTTP responses | NGINX, Varnish |
| **Application — local** | Hot objects inside each instance | Caffeine |
| **Application — distributed** | Shared objects across instances | Redis, Memcached |
| **Database** | Pages and query plans | MySQL buffer pool |

## Caching Strategies

### Cache-Aside (Lazy Loading) — the Most Common

The application manages the cache:

```flow
Read — look in the cache
? Cache hit? | Yes: return the cached value | No: read from the database, store in the cache with a TTL, return it
```

```java
public Product getProduct(long id) {
    Product cached = redis.get("product:" + id);
    if (cached != null) return cached;                       // hit
    Product product = productRepository.findById(id).orElseThrow();
    redis.set("product:" + id, product, Duration.ofMinutes(10));   // miss → populate
    return product;
}
```

On writes, **update the database, then delete the cache key** so the next read reloads fresh data.

| Pros | Cons |
| --- | --- |
| Only requested data is cached | The first request after a miss is slow |
| Cache failure isn't fatal — reads fall back to the DB | Data can be stale until the TTL expires or the key is deleted |

### Read-Through

The cache sits in front of the database and loads missing entries itself (the cache library calls a loader). Same behaviour as cache-aside, but the logic lives in the cache layer.

### Write-Through

Every write goes to the cache **and** the database synchronously.

| Pros | Cons |
| --- | --- |
| Cache always fresh | Slower writes |
| No stale reads for written data | Caches data that may never be read |

### Write-Behind (Write-Back)

Writes go to the cache immediately and are flushed to the database **asynchronously**.

| Pros | Cons |
| --- | --- |
| Very fast writes; batches DB updates | **Data loss** if the cache fails before flushing |
| Absorbs write spikes | More complex consistency |

### Refresh-Ahead

Proactively reload popular entries before they expire, so users never hit a miss for hot keys.

| Strategy | Best for |
| --- | --- |
| Cache-aside | General read-heavy workloads — the default |
| Write-through | Data read right after being written |
| Write-behind | Write-heavy workloads tolerant of small losses (counters, metrics) |
| Refresh-ahead | Predictable hot keys |

## Invalidation and TTL

Cached data becomes **stale** when the source changes. Options:

- **TTL (time to live)** — entries expire after a set time. Simple and always worth setting as a safety net.
- **Delete on write** — remove the key when the data changes (cache-aside).
- **Event-driven invalidation** — services publish change events; caches delete or update the affected keys.
- **Versioned keys** — `product:42:v7`; a new version makes old entries irrelevant.

> [!WARNING]
> **Delete, don't update, on write** in cache-aside. If two requests update the cache concurrently, a slower one can overwrite newer data with older data. Deleting the key forces the next reader to load the current value. (A brief race is still possible — a short TTL limits the damage.)

## Eviction Policies

When memory is full, something must go:

| Policy | Evicts | Notes |
| --- | --- | --- |
| **LRU** (least recently used) | Entries not used for the longest time | The common default |
| **LFU** (least frequently used) | Entries used least often | Keeps long-term popular items |
| **FIFO** | The oldest entries | Simple, rarely optimal |
| **TTL-based** | Expired entries first | Combine with LRU/LFU |
| **W-TinyLFU** | Frequency-aware admission + LRU | Caffeine's policy — excellent hit rates |

Redis is configured with `maxmemory` and a policy such as `allkeys-lru` or `allkeys-lfu`.

## Cache Problems

| Problem | What happens | Fix |
| --- | --- | --- |
| **Cache stampede / thundering herd** | A hot key expires; thousands of requests miss at once and hammer the DB | Lock or single-flight per key (one request reloads, others wait), refresh-ahead, random jitter on TTLs |
| **Cache penetration** | Requests for keys that don't exist always miss and hit the DB (often attacks) | Cache "not found" for a short time; Bloom filter of valid keys |
| **Cache avalanche** | Many keys expire at the same moment, or the cache cluster fails | Randomise TTLs; replicate the cache; circuit-break the DB |
| **Hot key** | One key gets a huge share of traffic and overloads one cache node | Local cache in front of Redis; replicate the key across shards |
| **Stale data** | Users see outdated values | TTLs, delete on write, event-driven invalidation |

## Local vs Distributed Cache

| Local (Caffeine) | Distributed (Redis) |
| --- | --- |
| In the application's memory — nanoseconds | Over the network — ~0.5 ms |
| Each instance has its own copy — can diverge | One shared copy for all instances |
| Lost on restart | Survives app restarts (optionally persisted) |
| Limited by heap size | Scales to many GB across a cluster |
| No extra infrastructure | Another system to run and secure |

A **two-level cache** — Caffeine in front of Redis — combines both: very fast hot reads, shared consistency for the rest.

## Caching in Spring Boot

```java
@SpringBootApplication
@EnableCaching
public class CatalogApplication { }

@Service
public class ProductService {

    @Cacheable(value = "products", key = "#id")
    public Product getProduct(long id) {
        return productRepository.findById(id).orElseThrow();   // runs only on a cache miss
    }

    @CacheEvict(value = "products", key = "#product.id")
    public Product update(Product product) {
        return productRepository.save(product);
    }
}
```

```yaml
spring:
  cache:
    type: redis
    redis:
      time-to-live: 10m
  data:
    redis:
      host: localhost
      port: 6379
```

`@Cacheable`, `@CachePut` and `@CacheEvict` work through Spring proxies — calls from inside the same class bypass them.

## Content Delivery Networks (CDNs)

A **CDN** is a network of edge servers around the world that cache content close to users:

```flow-h
User in Chennai
Nearby CDN edge — cache hit, about 10 ms
On a miss: origin server (S3 or your app) — about 200 ms
```

- Serves **static assets**, images, video and downloads — and increasingly cacheable API responses.
- Reduces latency, origin load and bandwidth costs; absorbs traffic spikes and DDoS attacks.
- Controlled with `Cache-Control` headers (`max-age`, `s-maxage`, `stale-while-revalidate`) and **versioned file names** (`app.3f9a1c.js`) so updates are picked up immediately.

## What Not to Cache

- Data that must always be exact and current — account balances at payment time, stock at final checkout.
- Highly personalised responses (or cache them per user, carefully).
- Sensitive data in shared caches without encryption and access control.

## Interview Questions

### What is cache-aside?

The application checks the cache first; on a miss it loads from the database and stores the result with a TTL; on writes it updates the database and deletes the cached entry.

### Write-through vs write-behind?

Write-through writes to the cache and the database synchronously — consistent but slower. Write-behind writes to the cache and flushes to the database asynchronously — fast but risks data loss.

### How do you keep a cache consistent with the database?

TTLs as a safety net, deleting keys on writes, event-driven invalidation, and versioned keys — accepting brief staleness where the business allows it.

### What is a cache stampede and how do you prevent it?

Many requests missing on the same hot key at once (often when it expires) and overwhelming the database. Prevent it with per-key locking / single-flight loading, refresh-ahead and TTL jitter.

### When would you use a local cache vs Redis?

A local cache (Caffeine) for tiny, very hot, rarely changing data; Redis when data must be shared across instances, is large, or must survive restarts — or both, as a two-level cache.

### What is a CDN?

A globally distributed network of edge servers that cache content close to users, reducing latency, origin load and bandwidth.

## Key Takeaways

- ✅ Cache at every layer that helps: browser, CDN, gateway, application, database.
- ✅ Cache-aside with TTLs is the default; delete keys on write.
- ✅ Choose write-through, write-behind or refresh-ahead for specific needs.
- ✅ Handle stampedes, penetration, avalanches and hot keys deliberately.
- ✅ Combine local (Caffeine) and distributed (Redis) caches; use CDNs for static and media content.
