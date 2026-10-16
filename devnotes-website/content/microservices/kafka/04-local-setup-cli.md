---
title: Running Kafka Locally & the CLI
subtitle: Starting a single-node KRaft cluster with Docker, creating and describing topics, producing and consuming from the console with keys, inspecting consumer groups and lag, resetting offsets, and the most useful admin commands.
order: 4
---

## Introduction

The fastest way to understand Kafka is to run it. This chapter starts a single-node cluster with Docker and walks through the command-line tools you'll use daily for debugging — and that interviewers sometimes ask about.

## Start Kafka with Docker

A single node acting as both broker and controller (KRaft combined mode — fine for development):

```yaml
# docker-compose.yml
services:
  kafka:
    image: apache/kafka:latest
    container_name: kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_NUM_PARTITIONS: 3
```

```bash
docker compose up -d
```

> [!TIP]
> `KAFKA_ADVERTISED_LISTENERS` is the address clients are told to connect to. If your app runs on the host, it must be `localhost:9092`; if it runs in another container on the same Docker network, it must be the container name (`kafka:9092`). A wrong advertised listener is the #1 cause of "connected, but then it hangs" problems.

The CLI scripts live inside the container under `/opt/kafka/bin`:

```bash
docker exec -it kafka bash
cd /opt/kafka/bin
```

(With a downloaded Kafka distribution they're in `bin/` — `bin\windows\*.bat` on Windows.)

## Topics

### Create a Topic

```bash
./kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic orders --partitions 3 --replication-factor 1
```

### List and Describe

```bash
./kafka-topics.sh --bootstrap-server localhost:9092 --list

./kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
```

```output Describe output
Topic: orders   PartitionCount: 3   ReplicationFactor: 1   Configs:
    Topic: orders   Partition: 0   Leader: 1   Replicas: 1   Isr: 1
    Topic: orders   Partition: 1   Leader: 1   Replicas: 1   Isr: 1
    Topic: orders   Partition: 2   Leader: 1   Replicas: 1   Isr: 1
```

`Leader` is the broker ID leading each partition, `Replicas` where copies live, `Isr` which copies are in sync.

### Change Configuration and Partitions

```bash
# Keep data for 3 days on this topic
./kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --entity-type topics --entity-name orders \
  --add-config retention.ms=259200000

# Increase partitions (can only go up — and changes key → partition mapping)
./kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic orders --partitions 6

# Delete a topic
./kafka-topics.sh --bootstrap-server localhost:9092 --delete --topic orders
```

> [!WARNING]
> Brokers create topics automatically on first use when `auto.create.topics.enable=true` (the default), using default partitions and replication. Convenient locally — but in production, typos create junk topics. Disable it and create topics deliberately (via scripts, Terraform or Spring's `NewTopic` beans).

## Producing from the Console

```bash
./kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders
>{"orderId":"ORD-1","amount":499}
>{"orderId":"ORD-2","amount":1299}
```

### With Keys

```bash
./kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders \
  --property parse.key=true --property key.separator=:
>ORD-1:{"status":"PLACED"}
>ORD-1:{"status":"PAID"}
>ORD-2:{"status":"PLACED"}
```

Both `ORD-1` events land in the same partition, in order.

## Consuming from the Console

```bash
# Only new records (default: auto.offset.reset=latest for a new consumer)
./kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders

# Everything from the beginning, showing keys, partitions and offsets
./kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders \
  --from-beginning \
  --property print.key=true --property print.partition=true --property print.offset=true
```

```output
Partition:2  Offset:0  ORD-1  {"status":"PLACED"}
Partition:2  Offset:1  ORD-1  {"status":"PAID"}
Partition:0  Offset:0  ORD-2  {"status":"PLACED"}
```

### As Part of a Consumer Group

```bash
./kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group email-service
```

Start the same command in two terminals: the partitions are split between them. Start one with a **different** `--group` and it receives every record.

## Consumer Groups and Lag

```bash
./kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

./kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group email-service
```

```output
GROUP          TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
email-service  orders  0          120             120             0    consumer-1-…
email-service  orders  1          98              143             45   consumer-2-…
email-service  orders  2          77              77              0    consumer-1-…
```

| Column | Meaning |
| --- | --- |
| `CURRENT-OFFSET` | The group's last committed offset (next record to read) |
| `LOG-END-OFFSET` | The offset the next new record will get |
| `LAG` | `LOG-END-OFFSET − CURRENT-OFFSET` — records waiting to be processed |

> [!TIP]
> **Consumer lag** is the single most important Kafka metric for application teams. Steadily growing lag means consumers can't keep up — scale out (up to the partition count), speed up processing, or investigate a stuck consumer.

### Reset Offsets (Replay or Skip)

The group must have **no active consumers** while you reset:

```bash
# Preview first
./kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group email-service \
  --topic orders --reset-offsets --to-earliest --dry-run

# Then apply
./kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group email-service \
  --topic orders --reset-offsets --to-earliest --execute
```

Other targets: `--to-latest`, `--to-offset 500`, `--shift-by -100`, `--to-datetime 2026-10-15T00:00:00.000`.

## Other Useful Tools

| Command | Use |
| --- | --- |
| `kafka-broker-api-versions.sh` | Check connectivity and supported API versions |
| `kafka-get-offsets.sh` | Earliest / latest offsets of a topic's partitions |
| `kafka-metadata-quorum.sh describe --status` | KRaft controller quorum status |
| `kafka-producer-perf-test.sh` / `kafka-consumer-perf-test.sh` | Load testing |
| `kafka-dump-log.sh` | Inspect on-disk log segments |

GUI tools such as **Kafka UI (Provectus)**, **AKHQ**, **Redpanda Console** and **Offset Explorer** show topics, messages and lag in a browser — handy locally.

## Interview Questions

### How do you check consumer lag?

`kafka-consumer-groups.sh --describe --group <group>` shows current offset, log-end offset and lag per partition; in production, lag is exported to monitoring (Burrow, Kafka exporter, Confluent Control Center, cloud dashboards).

### How do you replay messages for a consumer group?

Stop the group's consumers, then run `kafka-consumer-groups.sh --reset-offsets` with a target such as `--to-earliest` or `--to-datetime` and `--execute`; or seek programmatically in the consumer.

### What does --from-beginning do?

For a consumer **without** committed offsets, it starts at the earliest available offset instead of the latest. If the group already has committed offsets, they take precedence.

### What are advertised listeners?

The addresses a broker tells clients to use for subsequent connections. They must be reachable from the client's network.

## Common Mistakes

- ❌ **Wrong `advertised.listeners`** — clients connect to the bootstrap server, then fail to reach the address it advertises.
- ❌ **Relying on auto-created topics** in production.
- ❌ **Resetting offsets while consumers are running** — the command fails or the reset is overwritten.
- ❌ **Expecting `--from-beginning`** to work for a group that already has committed offsets.

## Key Takeaways

- ✅ A single KRaft node in Docker is enough for local development.
- ✅ `kafka-topics.sh` creates, describes and alters topics; partitions can only increase.
- ✅ The console producer and consumer can print keys, partitions and offsets — great for debugging.
- ✅ `kafka-consumer-groups.sh --describe` shows lag; `--reset-offsets` replays or skips data.
- ✅ Disable topic auto-creation in production.
