---
title: Database Replication, Partitioning & Sharding
subtitle: Leader–follower replication, read replicas and replication lag, synchronous vs asynchronous replication, multi-leader and leaderless designs, failover, vertical and horizontal partitioning, sharding strategies, consistent hashing, hot spots and resharding.
order: 7
---

## Introduction

A single database server eventually runs out of capacity — or fails. **Replication** keeps copies of the same data on several machines (for availability and read scaling). **Sharding** splits data across machines (for write and storage scaling). Most large systems use both.

| | Replication | Sharding (partitioning) |
| --- | --- | --- |
| What | The **same** data on several nodes | **Different** data on different nodes |
| Solves | Availability, read scaling, locality | Write throughput, storage size |
| Cost | Replication lag, failover complexity | Cross-shard queries, rebalancing, routing |

## Leader–Follower Replication

The most common setup (MySQL, PostgreSQL, MongoDB replica sets, Redis):

```flow
Application writes go to the leader (primary)
Leader records each change in its log — binlog or WAL
Followers (replicas) apply the log
Reads can be served by followers
```

```refs
Writes -> Leader | the single source of truth for writes
Reads -> Follower 1, Follower 2, Follower 3 | scale reads horizontally
```

### Read Replicas and Replication Lag

Followers usually apply changes **asynchronously**, so they lag behind by milliseconds — or seconds under load. That causes classic bugs:

| Anomaly | Example | Fix |
| --- | --- | --- |
| **Read-your-own-writes** | A user updates their profile, refreshes, and sees the old value (read from a lagging replica) | Read the user's own data from the leader for a short time after a write, or track the write's position |
| **Monotonic reads** | Two refreshes hit different replicas; data appears to go back in time | Pin a user's reads to one replica |
| **Stale reporting** | Dashboards a few seconds behind | Usually acceptable — say so |

In Spring, routing reads to replicas can be done with `@Transactional(readOnly = true)` plus a routing `DataSource`, or a proxy layer such as ProxySQL.

### Synchronous vs Asynchronous Replication

| Synchronous | Asynchronous |
| --- | --- |
| The leader waits for followers before confirming a write | The leader confirms immediately; followers catch up |
| **No data loss** on leader failure | Recent writes can be **lost** if the leader dies |
| Slower writes; a slow follower blocks writes | Fast writes |

The common compromise is **semi-synchronous**: wait for **at least one** follower, the rest async (MySQL semi-sync, PostgreSQL synchronous standbys, Kafka's `min.insync.replicas`).

### Failover

When the leader fails, a follower is **promoted**:

```flow
Leader stops responding
Health monitor detects it — timeout
Most up-to-date follower is promoted to leader
Clients and other followers switch to the new leader
Old leader, if it returns, rejoins as a follower
```

Risks: losing unreplicated writes (async), **split brain** (two nodes both think they're leader — prevented with consensus/quorums and fencing), and choosing timeouts that are neither too eager nor too slow. Managed services (Amazon RDS / Aurora, Cloud SQL) automate this.

## Multi-Leader and Leaderless Replication

| Model | How | Use | Challenge |
| --- | --- | --- | --- |
| **Multi-leader** | Several nodes accept writes (often one per region) | Multi-region writes, offline-capable apps | **Write conflicts** — need resolution (last-write-wins, merge, CRDTs) |
| **Leaderless** | Clients write to and read from several replicas; quorums decide | Cassandra, DynamoDB-style stores | Tunable consistency; read repair and anti-entropy |

### Quorums

With **N** replicas, write to **W** and read from **R** nodes. If **W + R > N**, every read overlaps at least one node with the latest write.

| N | W | R | Effect |
| --- | --- | --- | --- |
| 3 | 2 | 2 | Strong reads with one node down — the common choice |
| 3 | 3 | 1 | Fast reads, writes fail if any node is down |
| 3 | 1 | 1 | Fastest, but reads may be stale (W + R ≤ N) |

## Partitioning

### Vertical Partitioning

Split **by columns or features**: move large or rarely used columns (e.g. `profile_photo`, `bio`) to another table, or move whole feature areas to separate databases — which is what database-per-service does.

### Horizontal Partitioning (Sharding)

Split **by rows**: each shard holds a subset of rows, with the same schema.

```buckets
Shard 1: users 1–1,000,000
Shard 2: users 1,000,001–2,000,000
Shard 3: users 2,000,001–3,000,000
```

### Choosing a Shard Key

The **shard key** decides which shard a row lives on — the most important decision in sharding.

| Strategy | How | Pros | Cons |
| --- | --- | --- | --- |
| **Range-based** | Key ranges per shard (A–F, G–M…; or dates) | Efficient range queries | **Hot spots** — new data piles onto the latest shard |
| **Hash-based** | `hash(key) % shards` | Even distribution | Range queries hit every shard; changing shard count moves most keys |
| **Consistent hashing** | Keys and shards on a hash ring | Adding a shard moves only ~1/N of keys | Slightly more complex |
| **Directory / lookup** | A table maps each key to its shard | Total flexibility; easy to move tenants | The directory is a dependency and must be fast and available |
| **Geographic** | By user region | Data near users; data-residency compliance | Uneven region sizes |

A good shard key:

- has **high cardinality** (many distinct values);
- spreads load **evenly**;
- matches the **most common queries**, so most requests hit one shard — for example, `user_id` for user-centric apps, `tenant_id` for SaaS.

### Consistent Hashing

```flow
Hash each shard (and several virtual nodes per shard) onto a ring from 0 to 2³²
Hash the key onto the same ring
Walk clockwise to the first node — that node stores the key
Adding a node only takes over keys from its neighbour on the ring
```

With plain `hash % N`, going from 4 to 5 shards moves about 80% of keys. With consistent hashing, only about **1/N** move. **Virtual nodes** (many ring positions per physical node) keep the distribution even. Used by Cassandra, DynamoDB, Redis Cluster's hash slots (a related idea) and many distributed caches.

## Problems Sharding Creates

| Problem | Mitigation |
| --- | --- |
| **Cross-shard queries** ("top 10 products across all users") | Scatter-gather, precomputed aggregates, a separate analytics store |
| **Cross-shard transactions** | Avoid by choosing the shard key well; sagas otherwise |
| **Joins across shards** | Denormalise; co-locate related data on the same shard |
| **Hot spots** (a celebrity user, a giant tenant) | Split hot keys further; dedicated shards for huge tenants |
| **Resharding** as data grows | Consistent hashing, many small logical shards mapped onto fewer physical nodes, online migration tools |
| **Unique IDs across shards** | Snowflake-style IDs, UUIDs, or ID ranges per shard |

> [!TIP]
> Shard **last**, not first. Exhaust simpler options — query optimisation, indexes, caching, read replicas, vertical scaling, archiving old data — before taking on sharding's complexity. Tools like Vitess (MySQL), Citus (PostgreSQL) or natively distributed databases (CockroachDB, YugabyteDB, Spanner) can hide much of it.

## Interview Questions

### What is the difference between replication and sharding?

Replication copies the same data to several nodes for availability and read scaling; sharding splits different data across nodes for write and storage scaling.

### What is replication lag, and what problems does it cause?

The delay before followers apply the leader's changes. It causes stale reads, such as users not seeing their own updates (read-your-writes) or data appearing to move backwards (monotonic reads).

### Synchronous vs asynchronous replication?

Synchronous waits for followers before confirming — no data loss but slower and less available; asynchronous confirms immediately — fast but recent writes can be lost on failover. Semi-synchronous waits for one follower.

### How do you choose a shard key?

High cardinality, even distribution, and alignment with the dominant queries so most requests touch a single shard — e.g. `user_id` or `tenant_id`; avoid monotonically increasing keys with range sharding.

### What is consistent hashing and why is it useful?

Placing both keys and nodes on a hash ring so each key belongs to the next node clockwise; adding or removing a node only moves about 1/N of the keys, unlike `hash % N`.

### What is a quorum?

Requiring W replicas to acknowledge writes and R replicas to answer reads; when W + R > N, reads are guaranteed to see the latest acknowledged write.

## Key Takeaways

- ✅ Replication = same data on many nodes (availability, read scaling); sharding = data split across nodes (write and storage scaling).
- ✅ Leader–follower with read replicas is the common pattern; plan for replication lag.
- ✅ Synchronous replication avoids data loss at the cost of speed; semi-sync is the usual compromise.
- ✅ The shard key decides everything — high cardinality, even load, query-aligned.
- ✅ Consistent hashing minimises data movement when nodes change.
- ✅ Shard only after simpler scaling options are exhausted.
