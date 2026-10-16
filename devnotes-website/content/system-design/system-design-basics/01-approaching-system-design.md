---
title: How to Approach System Design
subtitle: What system design interviews test, a repeatable step-by-step framework — requirements, estimates, API, data model, high-level design, deep dives and trade-offs — functional vs non-functional requirements, and common mistakes.
order: 1
---

## Introduction

> [!NOTE]
> **Interview importance:** essential for mid-level and senior backend roles. System design rounds are open-ended on purpose: there's no single right answer — interviewers evaluate **how you think**.

System design is deciding how the pieces of a system — clients, services, databases, caches, queues — fit together to meet its requirements at the required scale, reliability and cost.

## What Interviewers Look For

| Signal | Shown by |
| --- | --- |
| **Clarifying ambiguity** | Asking about users, scale and priorities before drawing anything |
| **Structured thinking** | Following a clear process instead of jumping between ideas |
| **Breadth** | Knowing the building blocks — load balancers, caches, queues, databases, CDNs |
| **Depth** | Going deep on one or two components when asked |
| **Trade-offs** | Explaining why you chose X over Y and what it costs |
| **Communication** | Thinking aloud, checking in with the interviewer |

## A Repeatable Framework

```flow
1 — Clarify requirements: functional and non-functional (about 5 minutes)
2 — Estimate scale: users, QPS, storage, bandwidth (about 5 minutes)
3 — Define the API (about 5 minutes)
4 — Design the data model (about 5 minutes)
5 — Draw the high-level design (10–15 minutes)
6 — Deep-dive the hardest parts (10–15 minutes)
7 — Discuss bottlenecks, failures and trade-offs (about 5 minutes)
```

### Step 1 — Clarify Requirements

**Functional requirements** — what the system does:

- *"Users can shorten a long URL and get a short link."*
- *"Visiting the short link redirects to the original URL."*
- *"Links can have an optional expiry date."*

**Non-functional requirements** — how well it does it:

| Quality | Example question |
| --- | --- |
| **Scale** | How many users? Requests per second? Data size? |
| **Latency** | What response time is acceptable — 100 ms? 1 s? |
| **Availability** | 99.9% or 99.99%? Is a short outage acceptable? |
| **Consistency** | Must every reader see the latest write immediately? |
| **Durability** | Can any data ever be lost? |
| **Read/write ratio** | Read-heavy (social feeds) or write-heavy (logging)? |
| **Security / compliance** | Personal data? Payments? Regional data laws? |

> [!TIP]
> Write the requirements down and **agree on scope**: *"I'll focus on creating and redirecting links; analytics and custom domains are out of scope unless you'd like them."* It keeps the next 40 minutes focused.

### Step 2 — Estimate Scale

Rough numbers decide the architecture: 10 requests per second fits on one server; 100,000 needs caching, sharding and many instances. See *Back-of-the-Envelope Estimation*.

### Step 3 — Define the API

```text
POST /api/urls            { longUrl, expiresAt? }  →  201 { shortUrl }
GET  /{code}                                        →  301/302 Location: longUrl
GET  /api/urls/{code}/stats                         →  200 { clicks, … }
```

The API pins down exactly what the system must support.

### Step 4 — Design the Data Model

What entities exist, how they're accessed, and which database fits the access patterns:

```text
url_mapping(code PK, long_url, user_id, created_at, expires_at)
```

### Step 5 — High-Level Design

Draw the main components and the request flow:

```flow-h
Clients
Load balancer
Stateless app servers
Cache
Database
```

Walk through the main use cases on the diagram: *"A create request goes to an app server, which generates a code, stores it, and returns the link…"*

### Step 6 — Deep Dives

Pick the hardest or most interesting parts — often guided by the interviewer:

- How are short codes generated without collisions?
- How do we serve 100,000 redirects per second with low latency?
- How is data partitioned as it grows?
- What happens when a database node fails?

### Step 7 — Bottlenecks and Trade-offs

Identify single points of failure, hot spots and scaling limits, and say how you'd address them — plus what you'd monitor.

## The Building Blocks

The rest of this topic covers each building block:

| Building block | Purpose | Chapter |
| --- | --- | --- |
| Estimation | Size the problem | Back-of-the-Envelope Estimation |
| Scaling & availability | Grow and survive failures | Scalability & Availability |
| Load balancer | Spread traffic | Load Balancing |
| Cache, CDN | Serve reads fast | Caching |
| Databases | Store data appropriately | SQL vs NoSQL |
| Replication & sharding | Scale and protect data | Replication & Sharding |
| Consistency models | Reason about correctness | CAP & Consistency |
| Queues & streams | Decouple and smooth load | Message Queues & Async Processing |
| Rate limiter | Protect the system | Rate Limiting |
| API styles | Talk to clients | API Design |

And two full worked designs: a **URL shortener** and a **notification system**.

## Common Mistakes

- ❌ **Jumping straight to a diagram** without clarifying requirements.
- ❌ **Designing for Google scale** when the problem needs 100 requests per second — or ignoring scale entirely.
- ❌ **Buzzword stacking** — adding Kafka, Kubernetes and five databases without a reason.
- ❌ **No trade-offs** — every choice has a cost; say what it is.
- ❌ **Going silent** — the interviewer can't evaluate thinking they can't hear.
- ❌ **Ignoring failures** — what happens when a node, a region or a dependency fails?

## Interview Questions

### How do you start a system design interview?

By clarifying functional and non-functional requirements, agreeing on scope, and estimating scale, before proposing any architecture.

### What's the difference between functional and non-functional requirements?

Functional requirements describe what the system does (features); non-functional requirements describe qualities — scale, latency, availability, consistency, durability, security.

### Why do back-of-the-envelope estimates matter?

They decide whether you need caching, sharding, queues or many servers at all — and show you understand the magnitude of the problem.

## Key Takeaways

- ✅ System design interviews test structured thinking and trade-offs, not one correct answer.
- ✅ Follow a framework: requirements → estimates → API → data model → high-level design → deep dives → trade-offs.
- ✅ Separate functional from non-functional requirements and agree on scope.
- ✅ Let estimates drive the design; justify every component.
- ✅ Talk through failures, bottlenecks and what you'd monitor.
