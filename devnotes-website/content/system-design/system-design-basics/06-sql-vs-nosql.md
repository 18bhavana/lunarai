---
title: Choosing a Database — SQL vs NoSQL
subtitle: Relational databases and ACID, the four NoSQL families — key-value, document, wide-column and graph — search engines, time-series and object storage, how to choose by access pattern, polyglot persistence, and common misconceptions.
order: 6
---

## Introduction

"SQL or NoSQL?" isn't a matter of fashion — it depends on the **data's shape**, the **access patterns**, the **consistency needs** and the **scale**. Most real systems use several kinds of storage, each for what it does best.

## Relational (SQL) Databases

MySQL, PostgreSQL, Oracle, SQL Server — tables with a fixed schema, rows and columns, relationships through foreign keys, and SQL for queries. (See the [SQL & MySQL topic](/database/sql/).)

| Strengths | Limitations |
| --- | --- |
| **ACID transactions** across many rows and tables | Scaling writes beyond one primary needs sharding |
| Powerful queries — joins, aggregations, ad-hoc reporting | Schema changes on huge tables need care |
| Strong consistency and constraints (FKs, unique, check) | Not ideal for unstructured or highly variable data |
| Mature tooling, well understood | Object–relational mismatch (ORMs help) |

**Use for:** orders, payments, accounts, inventory, bookings — anything relational and transactional. Modern relational databases scale further than many people assume (read replicas, partitioning, very large single instances).

## NoSQL Families

### Key-Value Stores

Redis, Amazon DynamoDB (also document-like), Memcached, etcd.

```text
GET  session:9f1c2a7e  →  {"userId": 42, "cart": [...]}
SET  rate:user:42  17  EX 60
```

| Strengths | Limitations |
| --- | --- |
| Extremely fast lookups by key | No queries by value (without secondary indexes) |
| Simple, easy to scale horizontally | No joins or relationships |

**Use for:** caching, sessions, rate limiting, leaderboards, feature flags, shopping carts.

### Document Databases

MongoDB, Couchbase, Firestore, Amazon DocumentDB — JSON-like documents, flexible schema.

```json
{
  "_id": "ORD-1001",
  "customer": { "id": "C-42", "name": "Ravi" },
  "items": [ { "sku": "SKU-1", "qty": 2, "price": 499 } ],
  "status": "PAID"
}
```

| Strengths | Limitations |
| --- | --- |
| Flexible schema; nested data in one read | Joins are limited or expensive — design documents around queries |
| Maps naturally to objects | Denormalised data can become inconsistent |
| Horizontal scaling via sharding | Multi-document transactions exist but are costlier |

**Use for:** product catalogues, content management, user profiles, event data with varying fields.

### Wide-Column Stores

Apache Cassandra, ScyllaDB, HBase, Google Bigtable — rows identified by a **partition key**, with many columns, spread across many nodes.

| Strengths | Limitations |
| --- | --- |
| Massive write throughput and linear horizontal scaling | Queries must follow the partition key — model tables per query |
| Multi-datacentre replication, high availability | No joins; limited ad-hoc queries |
| Tunable consistency | Eventual consistency by default |

**Use for:** time-series and event logs, messaging history, IoT data, activity feeds — huge write volumes queried by key.

### Graph Databases

Neo4j, Amazon Neptune — nodes and relationships as first-class data.

```text
(Ravi)-[:FOLLOWS]->(Asha)-[:FOLLOWS]->(Kiran)
MATCH (me)-[:FOLLOWS]->()-[:FOLLOWS]->(suggestion) RETURN suggestion
```

**Use for:** social graphs, recommendations, fraud rings, network and dependency analysis — queries that traverse many relationships, which are slow as SQL joins.

## Other Specialised Stores

| Store | Examples | Use for |
| --- | --- | --- |
| **Search engines** | Elasticsearch, OpenSearch, Solr | Full-text search, filters and facets, log analytics |
| **Time-series** | InfluxDB, TimescaleDB, Prometheus | Metrics, sensor readings, time-window queries |
| **Object storage** | Amazon S3, Azure Blob, GCS, MinIO | Images, video, files, backups, data lakes |
| **Analytical (OLAP)** | Snowflake, BigQuery, ClickHouse, Redshift | Reporting over billions of rows |
| **Event log** | Apache Kafka | Durable, replayable event streams (not a query database) |

## SQL vs NoSQL

| | SQL | NoSQL |
| --- | --- | --- |
| Data model | Tables and relations | Key-value, document, wide-column, graph |
| Schema | Fixed, enforced | Flexible / schema-on-read |
| Transactions | Multi-row ACID | Often single-record; multi-record varies |
| Queries | Rich SQL, joins, ad hoc | Optimised for known access patterns |
| Scaling | Vertical + replicas; sharding is harder | Usually designed for horizontal scaling |
| Consistency | Strong by default | Often eventual or tunable |
| Best for | Relational, transactional data | Huge scale, flexible data, specific access patterns |

## How to Choose

```flow
? Need multi-entity transactions and complex queries or reporting? | Yes: relational — PostgreSQL or MySQL | No: keep asking
? Simple lookups by key at very high speed? | Yes: key-value — Redis or DynamoDB | No: keep asking
? Flexible, nested documents read as a whole? | Yes: document — MongoDB | No: keep asking
? Enormous write volume queried by partition key? | Yes: wide-column — Cassandra | No: keep asking
? Deep relationship traversal? | Yes: graph — Neo4j
```

Questions to ask:

1. What are the **main queries**? (Design storage around them.)
2. What's the **read/write ratio** and the expected **data size**?
3. How **consistent** must the data be? Can a read be slightly stale?
4. Do you need **transactions** across entities?
5. How will the **schema evolve**?
6. What does the team **know how to operate**?

> [!TIP]
> In interviews, a good default is: *"A relational database for the core transactional data; Redis for caching; object storage plus a CDN for media; Elasticsearch for search; Kafka for events"* — then justify any change from that based on the requirements.

## Polyglot Persistence

Large systems use the right store per job — often one per microservice:

```tree
E-commerce platform
  Order and payment services | PostgreSQL — transactions
  Catalogue service | MongoDB — flexible product attributes
  Search service | Elasticsearch — full-text and facets
  Cart and sessions | Redis — fast key-value
  Media | S3 + CDN
  Activity history | Cassandra — high write volume
  Events between services | Kafka
```

The cost: more systems to run, secure, back up and keep in sync (usually through events or CDC).

## Common Misconceptions

- ❌ *"NoSQL is always faster."* — Only for the access patterns it's designed for; ad-hoc queries can be much slower.
- ❌ *"SQL doesn't scale."* — Relational databases handle very large workloads with replicas, partitioning and sharding (Vitess, Citus).
- ❌ *"NoSQL means no schema."* — The schema still exists; it's just enforced by your code instead of the database.
- ❌ *"Pick one database for everything."* — Different data has different needs.

## Interview Questions

### When would you choose SQL over NoSQL?

When data is relational, needs multi-entity ACID transactions, strong consistency, constraints, or flexible querying and reporting — orders, payments, accounts.

### When would you choose NoSQL?

For massive scale with simple, known access patterns, flexible or nested data, very high write throughput, or specialised needs like key-value caching or graph traversal.

### What are the main types of NoSQL databases?

Key-value (Redis, DynamoDB), document (MongoDB), wide-column (Cassandra, HBase) and graph (Neo4j).

### What is polyglot persistence?

Using different storage technologies for different parts of a system, each chosen for its data and access patterns.

### Why do you model Cassandra tables around queries?

Because data is distributed and retrieved by partition key without joins, so each query pattern needs a table whose key matches it.

## Key Takeaways

- ✅ Relational databases: ACID, joins, constraints — the default for transactional data.
- ✅ Key-value for speed, document for flexible objects, wide-column for huge write volumes, graph for relationships.
- ✅ Search engines, time-series stores, object storage and Kafka fill specialised roles.
- ✅ Choose by access patterns, consistency, scale and team expertise.
- ✅ Polyglot persistence is normal — and adds operational cost.
