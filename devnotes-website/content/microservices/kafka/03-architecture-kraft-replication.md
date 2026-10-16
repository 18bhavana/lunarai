---
title: Kafka Architecture, KRaft & Replication
subtitle: Brokers, controllers and the KRaft metadata quorum that replaced ZooKeeper, leaders, followers and in-sync replicas, high watermark, acks and min.insync.replicas, leader election, and how Kafka survives broker failures.
order: 3
---

## Introduction

Kafka's durability and availability come from **replication**: every partition is copied to several brokers, and a controller keeps track of who leads each partition. This chapter explains the moving parts — and the big architectural change of recent years, **KRaft** replacing ZooKeeper.

## The Cluster at a Glance

```tree
Kafka cluster
  Controllers (KRaft quorum) | cluster metadata, leader election
  Broker 1 | leader for orders-P0, follower for orders-P1
  Broker 2 | leader for orders-P1, follower for orders-P2
  Broker 3 | leader for orders-P2, follower for orders-P0
```

Leadership is spread across brokers so every broker shares the load.

## ZooKeeper → KRaft

Older Kafka clusters stored their metadata (brokers, topics, partition leaders, configuration) in a separate **Apache ZooKeeper** cluster. Since **Kafka 3.3**, Kafka can manage metadata itself with **KRaft** (Kafka Raft), and **Kafka 4.0 removed ZooKeeper support entirely**.

| ZooKeeper mode (legacy) | KRaft mode (current) |
| --- | --- |
| Two systems to deploy, secure and monitor | One system |
| Metadata in ZooKeeper | Metadata in an internal, replicated log (`__cluster_metadata`) |
| Controller failover could take a long time on large clusters | Fast failover — standby controllers already have the metadata |
| Practical limit of tens of thousands of partitions | Scales to millions of partitions |
| Removed in Kafka 4.0 | The only mode from Kafka 4.0 |

> [!NOTE]
> Many tutorials, interview question banks and older notes still describe ZooKeeper's role. That knowledge is useful for legacy systems, but for new clusters the answer to *"what does ZooKeeper do in Kafka?"* is: **nothing — Kafka 4 uses KRaft.**

### Controllers and Brokers

In KRaft, each node has a **role**:

| Role | Responsibility |
| --- | --- |
| **Controller** | Part of a Raft quorum (usually 3 or 5 nodes) that stores the metadata log, elects partition leaders and handles broker membership |
| **Broker** | Stores partitions and serves producers and consumers |
| **Combined** (`broker,controller`) | Both — fine for development, not recommended for large production clusters |

One controller is the **active controller**; the others are hot standbys. A quorum of `2n + 1` controllers tolerates `n` failures — 3 controllers survive 1 failure.

## Replication

Each partition has a **replication factor** (RF) — the number of copies. RF = 3 is the production norm.

```refs
Broker 1 -> orders-P0 leader | handles all reads and writes
Broker 2, Broker 3 -> orders-P0 followers | fetch from the leader
```

- The **leader** handles produce and (by default) fetch requests.
- **Followers** continuously fetch from the leader to stay up to date.
- If the leader fails, one of the in-sync followers is elected the new leader.

### In-Sync Replicas (ISR)

The **ISR** is the set of replicas — leader included — that are fully caught up with the leader. A follower drops out of the ISR if it falls behind for longer than `replica.lag.time.max.ms` (30 seconds by default), and rejoins once it catches up.

### High Watermark

The **high watermark** is the offset up to which **all** in-sync replicas have the data. Consumers can only read up to the high watermark, so they never see a record that could disappear in a leader failover.

```buckets
Leader: offset 0, offset 1, offset 2, offset 3, offset 4
Follower A (in sync): offset 0, offset 1, offset 2, offset 3
Follower B (in sync): offset 0, offset 1, offset 2, offset 3
```

Here the high watermark is offset 4 (records 0–3 are committed); offset 4 is not yet visible to consumers.

## Producer acks and min.insync.replicas

How durable a write is depends on two settings working together.

### acks (producer setting)

| `acks` | The producer gets a success response when… | Risk |
| --- | --- | --- |
| `0` | It has sent the request — no response awaited | Data loss on any failure |
| `1` | The **leader** has written it | Lost if the leader dies before followers copy it |
| `all` (= `-1`) | **All in-sync replicas** have it | Safest; slightly higher latency |

Since Kafka 3.0 the producer default is **`acks=all`** (with idempotence enabled).

### min.insync.replicas (topic / broker setting)

With `acks=all`, the leader waits for all **current** ISR members. If the ISR has shrunk to just the leader, "all" means one copy. `min.insync.replicas` sets the minimum ISR size for a write to succeed:

| RF | `min.insync.replicas` | Brokers that can be down while writes still succeed | Copies guaranteed per acknowledged write |
| --- | --- | --- | --- |
| 3 | 1 (default) | 2 | 1 |
| 3 | **2** | **1** | **2** |
| 3 | 3 | 0 | 3 |

> [!IMPORTANT]
> The standard durable setup is **RF = 3, `min.insync.replicas` = 2, `acks=all`**. A write is only acknowledged once it's on at least two brokers, and the topic stays writable with one broker down. If the ISR falls below 2, producers get `NotEnoughReplicasException` instead of silently losing durability.

## Leader Election and Failover

```flow
Broker 1, leader of orders-P0, crashes
Controller notices the missed heartbeats
Controller picks a new leader from the ISR — Broker 2
Metadata updated; clients refresh it
Producers and consumers continue with Broker 2
Broker 1 returns, catches up as a follower and rejoins the ISR
```

### Unclean Leader Election

If **every** in-sync replica is lost, the only candidates are out-of-sync replicas that are missing recent data.

| `unclean.leader.election.enable` | Behaviour |
| --- | --- |
| `false` (default) | The partition stays **offline** until an in-sync replica returns — no data loss, but unavailable |
| `true` | An out-of-sync replica becomes leader — available again, but **committed records can be lost** |

It's a deliberate choice between **consistency and availability**.

### Preferred Leaders and Rack Awareness

- Each partition has a **preferred leader** (its first replica); Kafka periodically moves leadership back to it to keep load balanced.
- With `broker.rack` set, Kafka places replicas in **different racks or availability zones**, so losing a whole zone doesn't lose a partition. Consumers can also fetch from the nearest replica (`client.rack`) to cut cross-zone traffic.

## How Clients Find Leaders

```flow
Client connects to a bootstrap server
Requests cluster metadata — topics, partitions, leaders
Sends produce or fetch requests directly to each partition's leader
On a NotLeaderOrFollower error, refreshes metadata and retries
```

## Interview Questions

### What is KRaft?

Kafka's built-in Raft-based consensus protocol for managing cluster metadata, which replaced ZooKeeper. It became production-ready in Kafka 3.3, and Kafka 4.0 supports only KRaft.

### What was ZooKeeper used for?

In older versions it stored cluster metadata — brokers, topics, partition assignments and configuration — and elected the controller. Kafka 4.0 removed it.

### What is the ISR?

The in-sync replicas: the leader plus followers that are fully caught up. Only ISR members can be elected leader in a clean election, and `acks=all` waits for them.

### What do acks=all and min.insync.replicas=2 guarantee together?

A write is acknowledged only after at least two replicas have it; if fewer than two are in sync, the write fails rather than being under-replicated.

### What is the high watermark?

The highest offset replicated to all in-sync replicas. Consumers can't read beyond it, so they never see records that could be lost in a failover.

### What is unclean leader election?

Electing an out-of-sync replica as leader when no in-sync replica is available — restores availability at the cost of possible data loss. It's disabled by default.

### What happens when a broker fails?

For each partition it led, the controller elects a new leader from the ISR; clients refresh metadata and carry on. When the broker returns, it catches up and rejoins the ISR.

## Common Mistakes

- ❌ **RF = 1 in production** — one broker failure loses data.
- ❌ **`acks=all` with `min.insync.replicas=1`** — "all" can mean only the leader.
- ❌ **`min.insync.replicas` equal to RF** — any single broker failure stops writes.
- ❌ **Enabling unclean leader election** on topics that can't tolerate data loss.
- ❌ **Running production controllers combined with brokers** on large clusters.
- ❌ **Studying only ZooKeeper-era architecture** for interviews about modern Kafka.

## Key Takeaways

- ✅ Kafka 4 uses KRaft: a quorum of controllers manages metadata; ZooKeeper is gone.
- ✅ Each partition has a leader and followers; the ISR is the set of caught-up replicas.
- ✅ Consumers read only up to the high watermark.
- ✅ RF = 3, `min.insync.replicas` = 2 and `acks=all` is the standard durable configuration.
- ✅ Failover elects a new leader from the ISR; unclean election trades data safety for availability.
