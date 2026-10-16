---
title: "Design: URL Shortener"
subtitle: A complete worked design of a TinyURL / bit.ly-style service — requirements, estimates, API, data model, short-code generation with Base62, counters and hashing, 301 vs 302 redirects, caching, scaling, analytics, expiry, abuse prevention and trade-offs.
order: 12
---

## Introduction

The URL shortener is the classic first system design question. It looks simple, but it touches almost every building block: ID generation, storage choices, caching, read-heavy scaling, and analytics.

## Step 1 — Requirements

### Functional

- Given a long URL, return a **short URL** (e.g. `https://sho.rt/aZ3kQ9b`).
- Visiting the short URL **redirects** to the original.
- Optional **custom alias** (`sho.rt/diwali-sale`) and **expiry date**.
- Basic **click analytics** (count, referrer, country) — nice to have.

### Non-Functional

- **Very low redirect latency** (< 50 ms at p99, excluding the user's network).
- **High availability** for redirects — broken links hurt every page that embeds them.
- **Read-heavy**: redirects vastly outnumber creations.
- Short codes must be **unique** and hard to guess sequentially (to prevent enumerating everyone's links).
- Durable — created links mustn't be lost.

## Step 2 — Estimates

| Assumption | Value |
| --- | --- |
| New URLs per day | 100 million |
| Read : write ratio | 100 : 1 |
| Retention | 10 years |
| Average record size | ~500 bytes (URL + metadata) |

| Estimate | Calculation | Result |
| --- | --- | --- |
| Write QPS | 100 M ÷ 10⁵ | ~1,000/s (peak ~3,000/s) |
| Read QPS | 1,000 × 100 | ~100,000/s (peak ~300,000/s) |
| Total URLs in 10 years | 100 M × 365 × 10 | ~365 billion |
| Storage | 365 B × 500 B | ~180 TB (before replication) |
| Cache (hot 20% of daily reads) | 0.2 × 10 B reads/day × 500 B | ~1 TB — or far less, since a small set of links gets most clicks |

### How Long Must the Code Be?

With **Base62** characters (`a–z`, `A–Z`, `0–9`):

| Length | Combinations |
| --- | --- |
| 6 | 62⁶ ≈ 56.8 billion |
| **7** | 62⁷ ≈ **3.5 trillion** |
| 8 | 62⁸ ≈ 218 trillion |

7 characters cover 365 billion URLs with lots of room to spare.

## Step 3 — API

```text
POST /api/v1/urls
  body: { "longUrl": "https://…", "customAlias": "diwali-sale"?, "expiresAt": "2026-12-31"? }
  → 201 Created { "shortUrl": "https://sho.rt/aZ3kQ9b", "code": "aZ3kQ9b" }

GET /{code}
  → 302 Found, Location: https://… (or 404 / 410 Gone if expired)

GET /api/v1/urls/{code}/stats
  → 200 { "clicks": 18234, "topCountries": [...] }

DELETE /api/v1/urls/{code}
  → 204
```

## Step 4 — Data Model

```text
url_mapping
  code         VARCHAR(10)  PRIMARY KEY
  long_url     TEXT
  user_id      BIGINT       NULL
  created_at   TIMESTAMP
  expires_at   TIMESTAMP    NULL
```

Access is almost entirely **key lookup by `code`**, with no joins — a perfect fit for a **key-value / wide-column store** (DynamoDB, Cassandra) at this scale. A sharded relational database (MySQL/PostgreSQL partitioned by `code`) also works, especially at smaller scale.

## Step 5 — High-Level Design

```flow
Client
Load balancer
Stateless app servers
Cache — Redis: code → long URL
Database — code → long URL, sharded and replicated
```

- **Create:** app server generates a unique code → writes `(code, longUrl)` to the database → returns the short URL.
- **Redirect:** app server looks up the code in Redis → on a miss, reads the database and fills the cache → responds with a redirect.

## Step 6 — Deep Dives

### Generating Short Codes

#### Option A — Hash the URL

```text
MD5 / SHA-256 (longUrl) → take the first 41 bits → Base62 → up to 7 characters (2⁴¹ < 62⁷)
```

| Pros | Cons |
| --- | --- |
| Same URL → same code (deduplication) | **Collisions** — check the database and re-hash with a salt if taken |
| No coordination between servers | The check-then-insert needs a unique constraint to be race-safe |

#### Option B — Unique Counter + Base62 Encoding

Give each URL a unique numeric ID and encode it in Base62:

```java
private static final String ALPHABET =
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

static String toBase62(long id) {
    StringBuilder sb = new StringBuilder();
    do {
        sb.append(ALPHABET.charAt((int) (id % 62)));
        id /= 62;
    } while (id > 0);
    return sb.reverse().toString();
}
```

```output
toBase62(125)            → "21"
toBase62(3_500_000_000L) → "3ORDSU"
```

How to get unique IDs without a single bottleneck:

| Approach | How |
| --- | --- |
| **Range allocation** | A coordinator (database row, ZooKeeper/etcd) hands each app server a block of IDs (e.g. 1,000,000 at a time); servers allocate locally |
| **Snowflake-style IDs** | 64-bit IDs from timestamp + machine ID + sequence — unique without coordination |
| **Pre-generated key service** | A separate service generates random unique codes in advance and hands them out |

| Pros | Cons |
| --- | --- |
| No collisions | Sequential IDs are **guessable** — scramble them (e.g. multiply by a large odd number modulo 62⁷, or shuffle the alphabet) |
| Simple, fast | Needs an ID-allocation mechanism |

#### Option C — Random Codes

Generate 7 random Base62 characters and insert with a unique constraint; on conflict, try again. With 3.5 trillion possibilities and hundreds of billions used, collisions are occasional and cheap to retry.

> [!TIP]
> A strong interview answer: **range-allocated counters + Base62, with obfuscation** for predictable performance and no collisions — or random codes with a unique constraint for simplicity. Explain the trade-off either way.

#### Custom Aliases

Check availability and insert with the same unique constraint on `code`; reserve words like `api`, `admin`, `login`.

### 301 vs 302 Redirects

| 301 Moved Permanently | 302 Found (temporary) |
| --- | --- |
| Browsers and CDNs **cache** the redirect | Every click reaches your servers |
| Less load, faster repeat visits | Full click analytics; you can change or expire the target |
| Analytics miss cached clicks | More load |

Choose **302** (or 307) when analytics or link changes matter; 301 when minimising load matters most.

### Serving 300,000 Redirects per Second

- **Cache** hot codes in Redis (read-through, LRU) — a small fraction of links gets most of the traffic, so hit rates are very high.
- A **local in-memory cache** on each app server for the very hottest codes.
- **Database replicas** for cache misses; shard by `code` (hash) for even distribution.
- Optionally serve redirects from **CDN edge functions** for global low latency.
- Keep app servers **stateless** and autoscaled behind the load balancer.

### Analytics Without Slowing Redirects

```flow-h
Redirect served immediately
Click event published asynchronously to Kafka
Stream processor aggregates counts
Analytics store — ClickHouse or Cassandra
```

Never write to the analytics database on the redirect path.

### Expiry and Cleanup

- Check `expires_at` on read → **410 Gone** (or 404).
- Set matching **TTLs** in the cache.
- A background job (or database TTL feature in Cassandra/DynamoDB) deletes expired rows.

### Abuse Prevention

- **Rate-limit** creation per user / IP.
- **Scan URLs** against malware and phishing lists (Google Safe Browsing) on creation and periodically.
- Show an **interstitial warning** for flagged links.
- Non-sequential codes prevent enumeration.

## Step 7 — Bottlenecks and Trade-offs

| Concern | Decision |
| --- | --- |
| ID generation as a bottleneck | Range allocation or Snowflake IDs — no per-request coordination |
| Database read load | Redis + local cache; replicas |
| Hot links (a viral tweet) | Local cache + CDN; replicate hot keys |
| Region failure | Multi-region replication of the key-value store; GeoDNS |
| Consistency | A new link must be readable immediately by its creator — write-through to the cache on creation, or read from the primary |
| Storage growth | Sharding by code; expire and archive old links |

## Interview Questions

### How do you generate short codes?

Hash the URL and handle collisions, Base62-encode a unique ID from range allocation or Snowflake-style generation (obfuscated to avoid guessability), or generate random codes with a unique constraint and retry on conflict.

### How many characters do you need?

With Base62, 7 characters give about 3.5 trillion combinations — enough for hundreds of billions of URLs.

### 301 or 302?

302 if you need analytics or the ability to change or expire links (every click reaches you); 301 to minimise load, since browsers cache it.

### How do you scale reads?

Stateless app servers, Redis and local caches for hot codes, database read replicas, sharding by code, and optionally CDN edge redirects.

### Which database would you choose?

A key-value or wide-column store (DynamoDB, Cassandra) for simple, massive key lookups — or a sharded relational database at moderate scale.

## Key Takeaways

- ✅ Clarify the read-heavy, latency-sensitive nature first; estimate QPS and storage.
- ✅ 7 Base62 characters cover trillions of codes.
- ✅ Counter + Base62 (obfuscated), hashing with collision handling, or random codes with a unique constraint.
- ✅ Caching is the core of redirect performance; analytics go asynchronous.
- ✅ Choose 301 vs 302 deliberately; handle expiry, abuse and hot links.
