---
title: CAP Theorem & Consistency Models
subtitle: The CAP theorem stated correctly, CP vs AP systems with examples, PACELC and the latency trade-off, strong, eventual and causal consistency, ACID vs BASE, and how to choose consistency per feature.
order: 8
---

## Introduction

In a distributed system, data lives on several machines connected by a network that can fail. The **CAP theorem** and **consistency models** describe what guarantees are possible when that happens — and why "it depends" is the honest answer to many design questions.

## The CAP Theorem

A distributed data store can't simultaneously guarantee all three of:

| Property | Meaning |
| --- | --- |
| **C — Consistency** | Every read sees the most recent write (linearizability — as if there were one copy) |
| **A — Availability** | Every request to a non-failing node gets a non-error response |
| **P — Partition tolerance** | The system keeps working when the network drops or delays messages between nodes |

### What CAP Really Says

Network partitions **will** happen, so **P isn't optional**. CAP really says: **during a partition, you must choose between consistency and availability.**

```flow
Network partition splits node A from node B
A write arrives at node A
? Prefer consistency or availability? | Consistency: B refuses reads and writes it can't confirm — errors or timeouts | Availability: B keeps answering, possibly with stale data
```

> [!IMPORTANT]
> "Pick two of three" is a popular but misleading summary. A "CA" distributed system doesn't really exist — you can't opt out of network partitions. When the network is healthy, a well-designed system can be both consistent and available.

### CP vs AP Systems

| CP — consistency over availability | AP — availability over consistency |
| --- | --- |
| Rejects or delays requests during a partition rather than return stale data | Always answers, possibly with stale or conflicting data, and reconciles later |
| Examples: ZooKeeper, etcd, Kafka's KRaft metadata quorum, HBase, a relational primary with synchronous replicas | Examples: Cassandra and DynamoDB (with default settings), DNS, CDN caches, shopping carts |
| Use for: bank balances, inventory at checkout, leader election, configuration | Use for: social feeds, product catalogues, view counts, recommendations |

Many databases are **tunable**: Cassandra with `QUORUM` reads and writes behaves much more like CP; with `ONE` it's AP.

## PACELC — the Rest of the Story

CAP only covers partitions. **PACELC** adds what happens the rest of the time:

> If there's a **P**artition, choose **A**vailability or **C**onsistency; **E**lse, choose **L**atency or **C**onsistency.

Even without failures, strong consistency costs latency — synchronous replication and quorum reads mean waiting for other nodes, possibly in other regions.

| System | During a partition | Normally |
| --- | --- | --- |
| Cassandra, DynamoDB (default) | PA | EL — fast, eventually consistent |
| Spanner, CockroachDB | PC | EC — consistent, higher latency |

## Consistency Models

From strongest to weakest:

| Model | Guarantee | Example |
| --- | --- | --- |
| **Strong (linearizable)** | Every read returns the latest write, as if there were one copy | A single primary database; consensus systems |
| **Sequential** | All nodes see operations in the same order (not necessarily real-time) | — |
| **Causal** | Operations that are causally related are seen in order; unrelated ones may differ | A reply is never seen before the comment it answers |
| **Read-your-writes** | A user always sees their own updates | After editing a profile, you see the edit |
| **Monotonic reads** | Once you've seen a value, you never see an older one | Refreshing doesn't "go back in time" |
| **Eventual** | If writes stop, all replicas eventually converge | DNS, CDN caches, replicated feeds |

> [!TIP]
> Strong consistency everywhere is expensive; eventual consistency everywhere is confusing for users. Most systems combine **eventual consistency for most data** with **session guarantees** (read-your-writes, monotonic reads) and **strong consistency for the few operations that need it** (payments, stock reservation).

## ACID vs BASE

| ACID (traditional databases) | BASE (many distributed / NoSQL systems) |
| --- | --- |
| **A**tomicity — all or nothing | **B**asically **A**vailable — the system keeps responding |
| **C**onsistency — constraints always hold | **S**oft state — state may change without new input as replicas converge |
| **I**solation — concurrent transactions don't interfere | **E**ventually consistent — replicas converge over time |
| **D**urability — committed data survives failures | |

Note that the **C** in ACID (integrity constraints) is a different idea from the **C** in CAP (all nodes agreeing on the latest value).

## Choosing Consistency per Feature

| Feature | Consistency needed | Approach |
| --- | --- | --- |
| Money transfer, payment capture | Strong | ACID transaction on one primary; idempotency keys |
| Seat or stock reservation at checkout | Strong for the decision | Conditional update / row lock on the owning service |
| Order status shown to the customer | Read-your-writes | Read from the primary after a write, or return the new state |
| Product catalogue, prices on listing pages | Eventual (seconds–minutes) | Replicas, caches, CDN |
| Likes, views, follower counts | Eventual — approximate is fine | Counters in Redis, batched writes |
| Search index | Eventual | Updated from events / CDC |

## Interview Questions

### What is the CAP theorem?

In a distributed data store, during a network partition you must choose between consistency (every read sees the latest write) and availability (every request gets a response). Partition tolerance isn't optional in a real network.

### Give examples of CP and AP systems.

CP: ZooKeeper, etcd, HBase, a primary database with synchronous replication — they refuse requests rather than return stale data. AP: Cassandra or DynamoDB with default settings, DNS, CDNs — they keep answering and reconcile later.

### What is PACELC?

An extension of CAP: during a partition choose availability or consistency; otherwise choose lower latency or stronger consistency.

### What is eventual consistency?

A guarantee that if no new writes occur, all replicas will eventually converge to the same value; reads in between may be stale.

### ACID vs BASE?

ACID provides atomic, consistent, isolated, durable transactions; BASE systems favour availability, allow soft state and converge eventually — trading immediate consistency for scale and availability.

### Would you design a banking system as AP or CP?

CP for balances and transfers — refusing or delaying an operation is better than double-spending — while non-critical parts (statements, notifications, analytics) can be eventually consistent.

## Key Takeaways

- ✅ CAP: during a partition, choose consistency or availability — partitions can't be avoided.
- ✅ CP systems refuse stale answers; AP systems answer and reconcile later.
- ✅ PACELC adds the everyday latency-vs-consistency trade-off.
- ✅ Consistency models range from strong to eventual; session guarantees fix most user-visible issues.
- ✅ Choose consistency per feature: strong for money and inventory decisions, eventual for feeds and counters.
