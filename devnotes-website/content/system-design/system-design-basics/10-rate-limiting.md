---
title: Rate Limiting
subtitle: Why rate limits matter, where to enforce them, the token bucket, leaky bucket, fixed window, sliding window log and sliding window counter algorithms with their trade-offs, distributed rate limiting with Redis, HTTP 429 and headers, and designing a rate limiter.
order: 10
---

## Introduction

A **rate limiter** controls how many requests a client can make in a period of time — for example, *100 requests per minute per API key*. Requests over the limit are rejected (usually with **HTTP 429 Too Many Requests**).

## Why Rate Limit?

| Reason | Example |
| --- | --- |
| **Protect against abuse and DoS** | Stop one client flooding the API |
| **Fairness** | One heavy user can't starve everyone else |
| **Cost control** | Limit calls to paid third-party APIs (SMS, maps, AI models) |
| **Security** | Slow down brute-force login and OTP guessing |
| **Business tiers** | Free plan: 1,000 calls/day; paid plan: 100,000 |
| **Protect downstream services** | Don't send a dependency more than it can handle |

## Where to Enforce Limits

```flow-h
Client
CDN / WAF — coarse IP limits
API gateway — per user / API key
Service — per operation, e.g. login attempts
Outbound client — respect partner quotas
```

| Key to limit by | Use |
| --- | --- |
| User ID / API key | Authenticated APIs and paid tiers |
| IP address | Anonymous traffic (careful — many users can share one IP behind NAT) |
| Endpoint + user | Stricter limits on expensive or sensitive operations |
| Tenant | Fairness in multi-tenant SaaS |

## The Algorithms

### 1. Token Bucket

A bucket holds up to **capacity** tokens and is refilled at a steady **rate**. Each request takes a token; with no tokens left, the request is rejected.

```flow
Bucket capacity 10, refill 5 tokens per second
Request arrives
? Token available? | Yes: take one and allow the request | No: reject — 429
Tokens refill continuously up to capacity
```

| Pros | Cons |
| --- | --- |
| Allows **short bursts** (up to capacity) while enforcing an average rate | Two parameters to tune |
| Memory-efficient — a count and a timestamp per key | |
| Widely used — AWS API Gateway, Stripe, Spring Cloud Gateway's Redis limiter | |

### 2. Leaky Bucket

Requests enter a **queue** (the bucket) and are processed at a **fixed rate**, like water leaking from a hole; when the queue is full, new requests are dropped.

| Pros | Cons |
| --- | --- |
| Perfectly smooth output rate — protects fragile downstreams | Bursts are queued or dropped, adding latency |
| Simple FIFO | Old queued requests can delay fresh ones |

### 3. Fixed Window Counter

Count requests per fixed time window (e.g. per calendar minute); reset at each boundary.

```text
Limit 100 per minute
12:00:00–12:00:59  → counter 0…100, then reject
12:01:00            → counter resets to 0
```

| Pros | Cons |
| --- | --- |
| Very simple — one counter per key per window | **Boundary burst**: 100 requests at 12:00:59 plus 100 at 12:01:00 = 200 in two seconds |

### 4. Sliding Window Log

Store a timestamp for every request; count those within the last window (e.g. 60 s) on each new request.

| Pros | Cons |
| --- | --- |
| Precise — no boundary problem | Memory grows with the request rate — a timestamp per request |

### 5. Sliding Window Counter

Combine the current and previous fixed windows, weighting the previous one by how much of it still overlaps the sliding window:

```text
limit = 100/min; now = 12:01:15 (25% into the current minute)
previous minute = 80 requests, current minute = 30 requests
estimate = 30 + 80 × (1 − 0.25) = 30 + 60 = 90  → allowed (under 100)
```

| Pros | Cons |
| --- | --- |
| Smooths the boundary problem with only two counters | Approximate (assumes requests were evenly spread) — accurate enough in practice |

### Comparison

| Algorithm | Bursts | Accuracy | Memory | Typical use |
| --- | --- | --- | --- | --- |
| Token bucket | Allows up to capacity | Good | Low | General API rate limiting |
| Leaky bucket | Smoothed out | Good | Queue size | Shaping traffic to a fixed rate |
| Fixed window | Up to 2× at boundaries | Low | Lowest | Simple quotas (daily limits) |
| Sliding window log | No | Exact | High | Low-volume, strict limits |
| Sliding window counter | Minor | Very good | Low | High-volume APIs |

## Distributed Rate Limiting

With many API servers, counters must be **shared** — usually in **Redis**:

```text
-- Fixed window: one atomic counter per key per minute
key = "rl:user:42:202610151015"
count = INCR key
if count == 1 then EXPIRE key 60
if count > 100 then reject
```

- Make check-and-update **atomic** — Redis `INCR`, or a Lua script for token-bucket logic — to avoid race conditions between servers.
- Keep the limiter **fast** (sub-millisecond) and decide what happens if Redis is down: **fail open** (allow requests, risking overload) or **fail closed** (reject, risking an outage). Most APIs fail open with a local fallback limit.
- For very high scale, keep **local counters** and sync to Redis periodically, accepting slight over-admission.

In Spring Boot: Spring Cloud Gateway's `RequestRateLimiter` (Redis token bucket), **Bucket4j** (token bucket, local or distributed), or **Resilience4j RateLimiter** for outbound calls.

## Communicating Limits to Clients

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
```

- Return **429** with **`Retry-After`** so well-behaved clients back off.
- Include the current limit and remaining quota (`RateLimit-*` or the common `X-RateLimit-*` headers) on normal responses too.
- Document limits per plan; clients should retry with exponential back-off and jitter.

## Designing a Rate Limiter (Interview Outline)

1. **Requirements** — limit per user/API key/IP? Per endpoint? Limits and windows? Hard or soft? Distributed across many servers? Latency budget (~1 ms)?
2. **Algorithm** — token bucket (bursts allowed) or sliding window counter (smooth, cheap).
3. **Storage** — Redis cluster with atomic operations and TTLs.
4. **Placement** — at the API gateway as middleware; rules loaded from configuration.
5. **Response** — 429 + `Retry-After` + rate-limit headers.
6. **Failure handling** — fail open with local limits if Redis is unavailable.
7. **Scale** — shard Redis by key; local pre-counting for hot keys; monitoring of rejections.

## Interview Questions

### What is rate limiting and why is it needed?

Restricting how many requests a client can make in a time window, to prevent abuse and overload, ensure fairness, control costs and enforce plan limits.

### Explain the token bucket algorithm.

A bucket of capacity C refills at R tokens per second; each request consumes a token and is rejected when the bucket is empty. It enforces an average rate while allowing bursts up to C.

### What's the problem with fixed window counters?

Bursts at window boundaries — a client can send the full limit at the end of one window and again at the start of the next, doubling the effective rate.

### How do you rate limit across many servers?

Store counters or buckets in a shared, fast store like Redis, update them atomically (INCR or Lua scripts) with TTLs, and decide on fail-open or fail-closed behaviour if the store is unavailable.

### Which HTTP status and headers do you return when a limit is exceeded?

429 Too Many Requests with a `Retry-After` header, plus headers showing the limit, remaining requests and reset time.

## Key Takeaways

- ✅ Rate limiting protects systems, ensures fairness and controls cost.
- ✅ Token bucket allows bursts; leaky bucket smooths output; fixed window is simple but bursty at edges.
- ✅ Sliding window counter is a cheap, accurate default for high-volume APIs.
- ✅ Distributed limits need shared, atomic counters (Redis) and a fail-open/closed decision.
- ✅ Respond with 429 and `Retry-After`; enforce limits at the gateway and on sensitive operations.
