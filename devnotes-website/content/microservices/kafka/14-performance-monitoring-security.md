---
title: Kafka in Production — Performance, Monitoring & Security
subtitle: Choosing partition counts, tuning producers and consumers for throughput or latency, broker sizing, the metrics that matter (consumer lag, under-replicated partitions), alerting, encryption, authentication and ACLs, and a production checklist.
order: 14
---

## Introduction

Getting Kafka working locally is easy; running it well in production means choosing the right partition counts, tuning clients for your workload, watching a handful of key metrics, and locking the cluster down. This chapter collects those practices.

## Choosing the Number of Partitions

Partitions are the unit of parallelism — and the hardest setting to change later.

```text
partitions ≥ max(target throughput / throughput per producer partition,
                 target throughput / throughput per consumer)
```

Example: you need **60 MB/s**; one consumer instance processes **5 MB/s** → at least **12 partitions** (rounding up to allow growth, perhaps 24).

| Guideline | Why |
| --- | --- |
| Base it on **consumer** processing speed, not just broker capacity | Consumer parallelism is capped by the partition count |
| Leave headroom (2–3× expected load) | Adding partitions later breaks key → partition mapping |
| Don't go wild | Each partition costs file handles, memory, replication traffic and longer failovers |
| Prefer counts with many divisors (6, 12, 24, 36) | Spread evenly across varying consumer counts |

## Tuning Producers

| Goal | Settings |
| --- | --- |
| **Throughput** | `linger.ms` 10–50, `batch.size` 64–256 KB, `compression.type=lz4` or `zstd`, more `buffer.memory` |
| **Low latency** | `linger.ms` 0–5, smaller batches, `acks=1` only if you can accept the durability trade-off |
| **Durability** | `acks=all`, idempotence on, topic `min.insync.replicas=2` |

## Tuning Consumers

| Goal | Settings / actions |
| --- | --- |
| **Throughput** | `fetch.min.bytes` higher (e.g. 64 KB), `fetch.max.wait.ms` 100–500, larger `max.poll.records`, batch processing (bulk DB writes) |
| **Avoid rebalances** | Process each poll well within `max.poll.interval.ms`; cooperative assignor or the new group protocol; static membership |
| **Parallelism** | More partitions + consumers; Spring Kafka `concurrency` |

> [!TIP]
> The bottleneck is almost always the **consumer's processing** (database writes, HTTP calls), not Kafka. Batch database operations, avoid per-record remote calls where possible, and measure.

## Broker and Cluster Sizing

- **Disk:** daily volume × retention days × replication factor, plus ~30–40% headroom. Fast disks (NVMe/SSD); separate disks or volumes for logs if possible.
- **Memory:** Kafka relies on the **OS page cache** — give brokers plenty of RAM but a modest JVM heap (typically 4–8 GB); the rest serves cached reads.
- **Network:** often the real limit — replication multiplies traffic (RF = 3 means each write is copied twice more).
- **Brokers:** at least 3 for RF = 3; spread them across availability zones with `broker.rack`.
- **Controllers:** a dedicated quorum of 3 (or 5) KRaft controllers for production clusters.

## The Metrics That Matter

| Metric | Healthy | Why it matters |
| --- | --- | --- |
| **Consumer lag** (per group, per partition) | Stable and low | Rising lag = consumers can't keep up, are stuck, or failing |
| **Under-replicated partitions** | **0** | Replicas falling behind — risk to durability |
| **Under-min-ISR / offline partitions** | **0** | Writes failing or data unavailable |
| **Active controller count** | Exactly 1 | Controller health |
| **Request latency** (produce / fetch, p99) | Within your SLOs | Broker or disk saturation |
| **Request handler / network thread idle %** | Not near 0% | Brokers overloaded |
| **Disk usage** | Below ~70–80% | A full disk takes brokers down |
| **ISR shrink / expand rate** | Rare | Flapping replicas indicate network or disk problems |
| **Producer error / retry rate** | Near 0 | Failing sends |
| **Rebalance rate** | Rare | Unstable consumers |

Kafka exposes metrics over **JMX**; collect them with Prometheus (JMX exporter, Kafka exporter for lag), Micrometer in Spring Boot, Burrow, or a managed platform's dashboards, and visualise them in Grafana.

### Alert on Symptoms

- 🚨 Consumer lag growing for more than N minutes on a critical group.
- 🚨 Under-replicated or offline partitions > 0.
- 🚨 Disk usage above 80%.
- 🚨 Records arriving in a dead-letter topic.
- 🚨 No messages produced to a topic that should always have traffic.

## Security

By default, a Kafka cluster accepts **unencrypted, unauthenticated** connections — fine on a laptop, unacceptable in production.

| Layer | Mechanism |
| --- | --- |
| **Encryption in transit** | TLS (`SSL` / `SASL_SSL` listeners) between clients and brokers and between brokers |
| **Authentication** | SASL/SCRAM (username + password), mTLS (client certificates), SASL/OAUTHBEARER (OAuth tokens), Kerberos (GSSAPI) |
| **Authorization** | **ACLs** — which principal may read/write/create which topics and groups |
| **Encryption at rest** | Disk or volume encryption (Kafka doesn't encrypt stored data itself); encrypt sensitive fields in the payload if needed |

```bash
# Allow the order service to write to orders, and the email service to read it as its group
./kafka-acls.sh --bootstrap-server broker:9093 --command-config admin.properties \
  --add --allow-principal User:order-service --operation Write --topic orders

./kafka-acls.sh --bootstrap-server broker:9093 --command-config admin.properties \
  --add --allow-principal User:email-service --operation Read --topic orders --group email-service
```

```yaml
# Spring Boot client over SASL_SSL with SCRAM
spring:
  kafka:
    bootstrap-servers: broker1:9093,broker2:9093
    properties:
      security.protocol: SASL_SSL
      sasl.mechanism: SCRAM-SHA-512
      sasl.jaas.config: >
        org.apache.kafka.common.security.scram.ScramLoginModule required
        username="${KAFKA_USERNAME}" password="${KAFKA_PASSWORD}";
```

> [!WARNING]
> Never put credentials in source code or Git — inject them from environment variables or a secret manager. And remember that events often contain personal data: apply least-privilege ACLs and keep retention no longer than necessary.

## Managed Kafka

Running Kafka yourself means handling upgrades, broker failures, rebalancing partitions across brokers, monitoring and security. Managed services — **Confluent Cloud**, **Amazon MSK**, **Aiven**, **Azure Event Hubs (Kafka API)**, **Redpanda Cloud** — take much of that on. Many teams choose them unless Kafka operations are a core competency.

## Production Checklist

- ✅ Replication factor 3, `min.insync.replicas=2`, unclean leader election off.
- ✅ Producers: `acks=all`, idempotence on, sensible `linger.ms`/compression, failures logged and alerted.
- ✅ Consumers: idempotent processing, bounded retries, dead-letter topics, `ErrorHandlingDeserializer`.
- ✅ Partition counts planned with headroom; meaningful keys.
- ✅ Retention sized for the longest consumer outage; disks with headroom.
- ✅ Topic auto-creation disabled; topics defined as code.
- ✅ Schemas with a registry and compatibility checks.
- ✅ TLS + authentication + ACLs; secrets outside code.
- ✅ Monitoring: lag, under-replicated partitions, disk, latency; alerts on DLTs.
- ✅ Graceful shutdown of producers (`close()`) and consumers.

## Interview Questions

### How do you decide the number of partitions?

From the target throughput divided by the throughput of a single consumer (and producer) partition, with headroom for growth — keeping in mind that partitions can only be increased and that increasing them changes key placement.

### What is consumer lag, and how do you reduce it?

The number of records produced but not yet processed by a group. Reduce it by scaling consumers up to the partition count, adding partitions, speeding up processing (batching, fewer remote calls) and tuning fetch settings.

### What are under-replicated partitions?

Partitions whose followers aren't fully in sync with the leader. Any value above zero means reduced durability and needs investigation (broker, disk or network problems).

### How do you secure Kafka?

TLS for encryption in transit, SASL (SCRAM, OAUTHBEARER) or mTLS for authentication, ACLs for least-privilege authorization, disk encryption at rest, and credentials stored in a secret manager.

### Why does Kafka need lots of RAM but a small heap?

It serves most reads from the OS page cache; a large JVM heap only adds garbage-collection pauses.

### How would you improve producer throughput?

Increase `linger.ms` and `batch.size`, enable compression (lz4/zstd), give the producer enough `buffer.memory`, and use asynchronous sends with callbacks.

## Common Mistakes

- ❌ **Too few partitions**, capping consumer parallelism — or thousands without need.
- ❌ **Not monitoring consumer lag.**
- ❌ **A huge JVM heap** on brokers.
- ❌ **Running production without TLS, authentication or ACLs.**
- ❌ **Sizing disks without accounting for replication and retention.**
- ❌ **Tuning Kafka when the real bottleneck is the consumer's database.**

## Key Takeaways

- ✅ Plan partition counts from consumer throughput, with headroom.
- ✅ Tune producers with batching and compression; tune consumers with fetch sizes and batch processing.
- ✅ Watch consumer lag, under-replicated/offline partitions, disk, latency and DLT arrivals.
- ✅ Secure clusters with TLS, SASL or mTLS, and ACLs.
- ✅ Managed Kafka services remove much of the operational burden.
