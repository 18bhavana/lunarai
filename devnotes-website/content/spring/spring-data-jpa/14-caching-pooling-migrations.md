---
title: Caching, Connection Pooling & Migrations
subtitle: "Hibernate's second-level cache and query cache, cache concurrency strategies and when not to cache, sizing and tuning the HikariCP connection pool, leak detection, and versioned schema migrations with Flyway and Liquibase."
order: 14
---

## Introduction

Three pieces of infrastructure sit under every JPA application in production:

- the **second-level cache**, which can avoid repeated database reads;
- the **connection pool**, which decides how many queries can run at once;
- **schema migrations**, which keep every environment's tables in step with the entities.

## The Two Cache Levels

| | First-level cache | Second-level cache (L2) |
| --- | --- | --- |
| Scope | One persistence context (one transaction) | The whole `EntityManagerFactory` (shared across transactions and threads) |
| Enabled | Always, can't be turned off | Opt-in, needs a cache provider |
| Stores | Entity instances | Entity **data** (dehydrated state), keyed by id |
| Used by | `find` / `findById` within the transaction | `find` / `findById`, lazy loading by id, natural-id lookups |

```flow
findById(42)
? In the persistence context (first level)? | Yes: Return the same instance | No: Check the second-level cache
? In the second-level cache? | Yes: Build the entity from cached data — no SQL | No: SELECT from the database, then store in the cache
```

> [!IMPORTANT]
> The L2 cache does **not** serve JPQL or derived queries like `findByEmail`. Those always hit the database, unless you also enable the **query cache**.

## Enabling the Second-Level Cache

```xml
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-jcache</artifactId>
</dependency>
<dependency>
    <groupId>org.ehcache</groupId>
    <artifactId>ehcache</artifactId>
    <classifier>jakarta</classifier>
</dependency>
```

```properties
spring.jpa.properties.hibernate.cache.use_second_level_cache=true
spring.jpa.properties.hibernate.cache.region.factory_class=jcache
spring.jpa.properties.hibernate.javax.cache.provider=org.ehcache.jsr107.EhcacheCachingProvider
# only entities marked @Cacheable are cached (this is the default)
spring.jpa.properties.jakarta.persistence.sharedCache.mode=ENABLE_SELECTIVE
```

```java
@Entity
@Cacheable
@org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Country {
    @Id
    private String code;
    private String name;

    @OneToMany(mappedBy = "country")
    @org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
    private Set<State> states;   // collections are cached separately, and only if annotated
}
```

A collection cache stores only the **ids** of its elements. For it to help, the element entity (`State`) must be cached too.

### Concurrency Strategies

| Strategy | Use for |
| --- | --- |
| `READ_ONLY` | Data that never changes (country codes, currencies). Fastest; updates throw. |
| `NONSTRICT_READ_WRITE` | Rarely updated data where briefly stale reads are fine |
| `READ_WRITE` | Updatable data: soft locks keep the cache consistent with committed data |
| `TRANSACTIONAL` | JTA transactional cache providers only |

### The Query Cache

```properties
spring.jpa.properties.hibernate.cache.use_query_cache=true
```

```java
@QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
List<Country> findByRegion(String region);
```

The query cache stores the **result ids** for a query and its parameters, and the entities come from the entity cache. Any write to a table the query uses **invalidates all cached queries on that table**, so it only pays off for rarely changing tables.

### When to Use It, and When Not To

- ✅ Reference and lookup data that is read constantly and changed rarely: countries, product categories, configuration.
- ❌ Frequently updated or very large tables: you pay invalidation and memory costs for few hits.
- ❌ Data that is also changed **outside Hibernate** (other services, scripts, bulk SQL): the cache doesn't know and serves stale data. Bulk JPQL updates evict the whole affected region.
- ⚠️ With several application instances, a **local** cache (Ehcache on-heap) can differ between nodes. Use a distributed provider (Infinispan, Hazelcast, Redis via Redisson) or keep the TTLs short.

> [!TIP]
> Many teams skip the L2 cache and use **Spring's `@Cacheable` on service methods** (with Redis or Caffeine) to cache DTOs. That's easier to reason about, and it works for any query.

## Connection Pooling with HikariCP

Opening a database connection takes milliseconds: TCP, TLS and authentication. A **connection pool** keeps connections open and lends them out. Spring Boot uses **HikariCP** by default.

```flow-h
Request thread
Borrows a connection from Hikari
Runs the transaction
Returns the connection to the pool
```

```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=10
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.leak-detection-threshold=20000
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `maximum-pool-size` | 10 | The most connections the pool will open |
| `minimum-idle` | Same as the max | Hikari recommends a fixed-size pool |
| `connection-timeout` | 30 s | How long a thread waits for a free connection before failing |
| `idle-timeout` | 10 min | Idle connections above `minimum-idle` are closed |
| `max-lifetime` | 30 min | Connections are retired before the database or a firewall kills them; keep it below the database's timeout |
| `leak-detection-threshold` | 0 (off) | Logs a stack trace when a connection is held longer than this |

### Sizing the Pool

Bigger isn't better. The database can only run a few queries truly in parallel, roughly one per CPU core, plus some overlap for disk and network waits. HikariCP's starting formula is:

```text
connections = (database CPU cores × 2) + effective disk spindles
```

That gives about 10–20 connections for a typical database server. Also remember the total across all instances: **10 pods × 20 connections = 200** connections to one database, which may exceed its `max_connections`.

### Symptoms of Pool Exhaustion

```output
HikariPool-1 - Connection is not available, request timed out after 30000ms
(total=10, active=10, idle=0, waiting=37)
```

Common causes:

- **Long transactions**: remote API calls, file processing or slow queries inside `@Transactional`.
- **Open Session in View** holding a connection for the whole HTTP request, including JSON serialization.
- **`REQUIRES_NEW`** taking a second connection while the first is still held. Under load this can deadlock the pool.
- **Leaks** from manual JDBC code that never closes connections. Turn on `leak-detection-threshold` to find them.

Watch the `hikaricp_connections_active` and `hikaricp_connections_pending` metrics (exposed through Actuator and Micrometer).

## Schema Migrations

`ddl-auto=update` can't rename columns, migrate data, or tell you what changed. Production schemas are managed with **versioned migration scripts** stored in Git and applied automatically at startup or in the deployment pipeline.

### Flyway

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>   <!-- database module for MySQL; PostgreSQL uses flyway-database-postgresql -->
</dependency>
```

```tree
src/main/resources/db/migration
  V1__create_employee.sql
  V2__add_email_to_employee.sql
  V3__backfill_email.sql
  R__employee_report_view.sql | repeatable — re-applied when its checksum changes
```

```sql
-- V2__add_email_to_employee.sql
ALTER TABLE employee ADD COLUMN email VARCHAR(255);
CREATE UNIQUE INDEX uk_employee_email ON employee (email);
```

```properties
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.enabled=true
# for an existing database that predates Flyway
spring.flyway.baseline-on-migrate=true
```

How it works:

1. At startup, Spring Boot runs Flyway **before** JPA initialises.
2. Flyway reads the `flyway_schema_history` table to see which versions have already been applied.
3. It runs any new `V…` scripts in version order, each in a transaction where the database allows it, and records them with a checksum.
4. Hibernate's `validate` then checks that the entities match the resulting schema.

> [!WARNING]
> **Never edit a migration that has already run.** Flyway detects the checksum change and refuses to start. Add a new version instead. Undo migrations are a paid Flyway feature, so plan **forward fixes** (a new script that reverses the change).

### Liquibase

```yaml
# src/main/resources/db/changelog/db.changelog-master.yaml
databaseChangeLog:
  - changeSet:
      id: 1
      author: devnotes
      changes:
        - createTable:
            tableName: employee
            columns:
              - column: { name: id, type: BIGINT, autoIncrement: true, constraints: { primaryKey: true } }
              - column: { name: name, type: VARCHAR(100), constraints: { nullable: false } }
```

| Flyway | Liquibase |
| --- | --- |
| Plain SQL files, versioned by name | Changelogs in YAML, XML, JSON or SQL |
| Simple and predictable | Database-independent changes, preconditions, contexts, rollback blocks |
| History in `flyway_schema_history` | History in `DATABASECHANGELOG` (plus a lock table) |

Both are well supported by Spring Boot. Pick one per project.

### Zero-Downtime Changes

During a rolling deployment, old and new versions of the application run at the same time, so schema changes must work with both. Use **expand and contract**:

```flow
Expand — add the new column as nullable; deploy code that writes both the old and new columns
Migrate — backfill the existing rows in batches
Switch — deploy code that reads only the new column
Contract — drop the old column in a later release
```

Avoid renaming or dropping a column in the same release as the code change.

## Interview Questions

### First-level vs second-level cache?

The first-level cache is the persistence context: per transaction, always on, holding entity instances. The second-level cache is shared across transactions at the `EntityManagerFactory` level, opt-in, and stores entity data by id.

### Does the second-level cache cache query results?

No. It serves lookups by id. Query results need the separate query cache, which is invalidated whenever a table in the query changes.

### Which entities are good candidates for the L2 cache?

Read-mostly reference data that only this application changes, for example countries, categories and configuration. Avoid frequently updated tables and data that other systems modify.

### Why use a connection pool, and how do you size it?

Opening connections is expensive, so the pool reuses them. Keep it small: roughly (database cores × 2) + spindles. Count the total across all instances, and shorten transactions rather than enlarging the pool.

### What causes "Connection is not available, request timed out"?

All connections are busy: long transactions, Open Session in View, `REQUIRES_NEW` nesting, slow queries or leaks. Use the leak detection and pool metrics to find the cause.

### Why use Flyway or Liquibase instead of ddl-auto=update?

They give versioned, reviewable, repeatable migrations that can transform data and rename or drop columns safely. `update` can't, and it leaves no history. In production, use migrations with `ddl-auto=validate`.

## Key Takeaways

- ✅ The L2 cache is for read-mostly data, looked up by id. The query cache is rarely worth it.
- ✅ Choose the cache concurrency strategy by how often the data changes, and beware of multiple nodes.
- ✅ HikariCP: small fixed pools, `max-lifetime` below the database timeout, and leak detection turned on.
- ✅ Pool exhaustion usually means transactions held too long.
- ✅ Flyway or Liquibase owns the schema, Hibernate only validates it, and changes follow expand and contract.
