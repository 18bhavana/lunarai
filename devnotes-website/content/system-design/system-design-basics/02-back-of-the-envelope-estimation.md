---
title: Back-of-the-Envelope Estimation
subtitle: Powers of two and data sizes, latency numbers every developer should know, converting daily users into requests per second, estimating storage, bandwidth, cache size and servers, and a worked example.
order: 2
---

## Introduction

**Back-of-the-envelope estimation** means quick, rough calculations to understand the size of a problem — *is this 10 requests per second or 100,000?* The goal is the right **order of magnitude**, not precision.

## Useful Numbers

### Data Sizes

| Unit | Approximate size |
| --- | --- |
| 1 KB (kilobyte) | 10³ bytes — a short text message |
| 1 MB | 10⁶ bytes — a high-quality photo |
| 1 GB | 10⁹ bytes — a movie at low quality |
| 1 TB | 10¹² bytes |
| 1 PB | 10¹⁵ bytes |

| Data | Typical size |
| --- | --- |
| A `long` / timestamp | 8 bytes |
| A UUID | 16 bytes (36 as text) |
| A URL | ~100 bytes |
| A tweet-sized post | ~300 bytes of text + metadata |
| A JSON API response | 1–10 KB |
| A compressed image | 100 KB – 2 MB |
| One minute of HD video | ~50–100 MB |

### Time

| Period | Seconds |
| --- | --- |
| 1 day | 86,400 ≈ **10⁵** (round to 100,000 for estimates) |
| 1 month | ≈ 2.5 × 10⁶ |
| 1 year | ≈ 3 × 10⁷ |

### Latency Numbers Every Developer Should Know

Rounded, order-of-magnitude values — they change with hardware, but the ratios matter:

| Operation | Approximate latency |
| --- | --- |
| L1 cache reference | 1 ns |
| Main memory reference | 100 ns |
| Compress 1 KB with a fast codec | ~2 µs |
| Read 1 MB sequentially from memory | ~3 µs |
| Random read from an NVMe SSD | ~20–100 µs |
| Round trip within a data centre | ~0.5 ms |
| Read 1 MB sequentially from SSD | ~0.2–1 ms |
| Redis / Memcached GET over the network | ~0.2–1 ms |
| Simple indexed database query | ~1–5 ms |
| Disk seek on a spinning HDD | ~10 ms |
| Round trip between continents (e.g. India ↔ US) | ~150–250 ms |

Lessons:

- **Memory is ~1,000× faster than SSD**, and far faster than the network → caches matter.
- **Network round trips dominate** → avoid chatty calls; batch and parallelise.
- **Cross-region calls are slow** → serve users from nearby regions and CDNs.
- **Sequential I/O beats random I/O** → append-only logs (Kafka) are fast.

### Availability

| Availability | Downtime per year | Per month |
| --- | --- | --- |
| 99% ("two nines") | ~3.65 days | ~7.3 hours |
| 99.9% | ~8.8 hours | ~43 minutes |
| 99.99% | ~53 minutes | ~4.3 minutes |
| 99.999% | ~5.3 minutes | ~26 seconds |

## From Users to Requests per Second

```text
Average QPS = daily active users × actions per user per day ÷ 86,400
Peak QPS    ≈ average QPS × 2–10   (depending on how spiky traffic is)
```

Example: **10 million** daily active users, **20** requests each per day:

```text
10,000,000 × 20 = 200,000,000 requests/day
200,000,000 ÷ 100,000 (≈ seconds per day) ≈ 2,000 requests/s on average
Peak (× 3)                                 ≈ 6,000 requests/s
```

> [!TIP]
> Rounding a day to **100,000 seconds** makes mental maths easy and is accurate enough: "X per day ÷ 10⁵ = X per second".

## Estimating Storage

```text
Storage = new records per day × size per record × retention days × replication factor
```

Example: 1 million new posts per day, 1 KB each, kept for 5 years, 3 replicas:

```text
1,000,000 × 1 KB      = 1 GB/day
× 365 × 5             ≈ 1.8 TB
× 3 replicas          ≈ 5.5 TB
```

Add media separately — 10% of posts with a 500 KB image adds 50 GB/day, about **90 TB** over 5 years before replication, so images belong in object storage behind a CDN.

## Estimating Bandwidth

```text
Bandwidth = requests per second × average response size
```

6,000 requests/s × 10 KB = **60 MB/s** (~480 Mbit/s) of egress at peak — fine for a cluster, a lot for a single server.

## Estimating Cache Size

The **80/20 rule**: roughly 20% of the data serves 80% of the reads. Cache the hot 20% of a day's reads:

```text
Cache ≈ 0.2 × daily read requests × response size
```

200 million reads/day × 0.2 × 1 KB ≈ **40 GB** — a few Redis nodes.

## Estimating Servers

```text
Servers ≈ peak QPS ÷ QPS one server can handle (with headroom)
```

If one instance handles ~500 requests/s for this workload at safe utilisation: 6,000 ÷ 500 = **12 instances**, plus extras for failures and deployments → about 15–16.

## A Worked Example: a Photo-Sharing App

| Assumption | Value |
| --- | --- |
| Daily active users | 50 million |
| Photo uploads per user per day | 0.2 → 10 million/day |
| Photo views per user per day | 50 → 2.5 billion/day |
| Average photo size (compressed) | 500 KB |
| Metadata per photo | 1 KB |

| Estimate | Calculation | Result |
| --- | --- | --- |
| Upload QPS | 10 M ÷ 10⁵ | ~100/s (peak ~300/s) |
| View QPS | 2.5 B ÷ 10⁵ | ~25,000/s (peak ~75,000/s) |
| Read:write ratio | 25,000 : 100 | 250 : 1 — very read-heavy |
| New photo storage per day | 10 M × 500 KB | ~5 TB/day |
| Photo storage per year | 5 TB × 365 | ~1.8 PB (before replication) |
| Metadata per year | 10 M × 1 KB × 365 | ~3.7 TB |
| Peak egress | 75,000 × 500 KB | ~37 GB/s |

Conclusions: object storage (S3) for photos, a **CDN** for the enormous read bandwidth, caching for metadata, a sharded or NoSQL metadata store, and asynchronous processing (thumbnails) for uploads.

## Interview Questions

### How do you estimate QPS?

Daily active users × actions per user ÷ ~86,400 (≈10⁵) seconds for the average, then multiply by a peak factor of 2–10.

### Why does the read/write ratio matter?

Read-heavy systems benefit most from caching, CDNs and read replicas; write-heavy systems need write-optimised storage, partitioning and queues.

### How fast is memory compared with disk and network?

Main memory access is ~100 ns; an SSD random read ~20–100 µs; a data-centre round trip ~0.5 ms; a cross-continent round trip ~150 ms — which is why caching and locality matter so much.

### What does 99.99% availability allow?

About 53 minutes of downtime per year, or about 4 minutes per month.

## Key Takeaways

- ✅ Aim for the right order of magnitude; state your assumptions.
- ✅ A day ≈ 10⁵ seconds: X per day ÷ 10⁵ ≈ X per second.
- ✅ Estimate QPS (average and peak), storage (× retention × replication), bandwidth, cache and servers.
- ✅ Memory ≫ SSD ≫ network ≫ cross-region in speed — design around it.
- ✅ Let the numbers justify caches, CDNs, sharding and queues.
