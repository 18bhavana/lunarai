---
title: JPA & Hibernate Interview Cheat Sheet
subtitle: The whole topic on one page — repositories, queries, mapping, the persistence context, relationships, fetching and N+1, transactions and locking, inheritance, caching, pooling, migrations and testing — plus the most-asked interview questions, scenario questions and classic traps.
order: 17
---

## Introduction

A one-page revision of Spring Data JPA and Hibernate, followed by the questions interviewers ask most.

## Quick Revision

| Topic | Remember |
| --- | --- |
| Layers | Spring Data JPA (repositories) → JPA (spec) → Hibernate (implementation) → JDBC |
| `JpaRepository` | CRUD + paging/sorting + flush, batch deletes, `getReferenceById` |
| `save()` | `persist` if new (null id / null `@Version`), else `merge` |
| Derived queries | `findBy…`, `existsBy`, `countBy`, `deleteBy` (loads then removes each) |
| Pagination | `PageRequest.of(page, size, sort)` (0-based); `Page` = +count, `Slice` = +1 row; keyset for deep pages |
| `@Query` | JPQL on entities; `@Modifying` + transaction for bulk updates — bypasses the persistence context |
| Native SQL | `nativeQuery = true`; projections for partial rows; `countQuery` for pages |
| Mapping | No-arg constructor, wrapper id, `EnumType.STRING`, `BigDecimal`, `ddl-auto=validate` |
| ID strategy | `IDENTITY` (MySQL, no insert batching) vs `SEQUENCE` + `allocationSize` |
| Entity states | Transient → managed → detached / removed |
| Dirty checking | Managed entities' changes saved at flush — no `save()` needed |
| Flush vs commit | Flush sends SQL; commit makes it permanent |
| Relationships | Owning side has the FK; `mappedBy` = inverse; helpers sync both sides |
| Defaults | `@ManyToOne`/`@OneToOne` EAGER, `@OneToMany`/`@ManyToMany` LAZY → make all LAZY |
| Cascade | Parent → child only; `orphanRemoval` deletes children removed from the collection |
| N+1 | Fix with JOIN FETCH, `@EntityGraph`, batch fetching, DTOs |
| Transactions | Proxy-based; runtime exceptions roll back; self-invocation bypasses it |
| Propagation | `REQUIRED` joins; `REQUIRES_NEW` suspends and starts a new one |
| Locking | `@Version` optimistic; `@Lock(PESSIMISTIC_WRITE)` → `SELECT … FOR UPDATE` |
| Projections | Closed interfaces or records select only the needed columns; Specifications for dynamic filters |
| Inheritance | `SINGLE_TABLE` (default, fast, nullable columns) · `JOINED` (normalised, joins) · `@MappedSuperclass` (shared fields only) |
| Composite keys | `@EmbeddedId` (or `@IdClass`) with `equals`/`hashCode`; join entities use `@MapsId` |
| L2 cache | Shared, opt-in, lookups by id; for read-mostly data; the query cache is rarely worth it |
| HikariCP | Small fixed pool (default 10); exhaustion = transactions held too long |
| Migrations | Flyway/Liquibase + `ddl-auto=validate`; never edit applied scripts; expand and contract |
| Testing | `@DataJpaTest` + Testcontainers; flush and clear; transactional tests hide lazy-loading bugs |
| Advanced | `@SoftDelete`, JSON columns, Envers, `StatelessSession`, replica routing with `LazyConnectionDataSourceProxy` |

## Most-Asked Questions

### What's the difference between JPA, Hibernate and Spring Data JPA?

JPA is the specification (annotations, `EntityManager`, JPQL). Hibernate is the most popular implementation, which maps entities and generates SQL. Spring Data JPA sits on top and generates repository implementations, query methods, paging and auditing.

### CrudRepository vs JpaRepository?

`CrudRepository` offers basic CRUD. `JpaRepository` extends the list-returning CRUD and paging/sorting repositories and adds JPA-specific methods like `flush`, `saveAndFlush`, `deleteAllInBatch` and `getReferenceById`.

### findById vs getReferenceById?

`findById` hits the database (or the first-level cache) and returns an `Optional`. `getReferenceById` returns a lazy proxy without a query — ideal for setting foreign keys; it fails with `EntityNotFoundException` only when data is accessed.

### What is the first-level cache?

The persistence context: within one transaction, loading the same entity by id returns the same instance without another query. It's per `EntityManager`, unlike the optional, shared second-level cache.

### What is dirty checking?

At flush, Hibernate compares managed entities with their loaded snapshots and issues `UPDATE`s for changes — so modifying a managed entity in a transaction is enough.

### What is the N+1 problem and how do you solve it?

One query loads N parents, then each lazy association access runs another query. Solve it with `JOIN FETCH`, `@EntityGraph`, `@BatchSize`/`default_batch_fetch_size`, or DTO projections.

### Why is FetchType.EAGER discouraged?

It loads associations on every query, can't be overridden per query, and causes extra selects (N+1) for JPQL queries. Use LAZY and fetch per use case.

### What causes LazyInitializationException?

Accessing an uninitialised lazy association after the persistence context closed. Fetch the data inside the transaction or return DTOs.

### What does mappedBy mean?

It marks the inverse side of a bidirectional relationship and names the owning field. Only the owning side's changes update the foreign key.

### Explain @Transactional propagation REQUIRED vs REQUIRES_NEW.

`REQUIRED` joins the current transaction (or starts one). `REQUIRES_NEW` suspends it and runs a separate transaction that commits or rolls back independently.

### When does @Transactional not roll back?

On checked exceptions (by default), when exceptions are caught inside the method, and when the method is called via self-invocation or isn't proxied.

### Optimistic vs pessimistic locking?

Optimistic: a `@Version` column is checked on update; conflicts throw and you retry — best for low contention. Pessimistic: `SELECT … FOR UPDATE` locks the row so others wait — best for hot rows.

### Which inheritance strategy would you choose?

`SINGLE_TABLE` by default, for speed and simple polymorphic queries. `JOINED` when subclasses have many fields or need NOT NULL constraints. `@MappedSuperclass` when you only share fields and never query the base type. Avoid `TABLE_PER_CLASS`.

### First-level vs second-level cache?

The first-level cache is per persistence context and always on. The second-level cache is shared across transactions, opt-in, and serves lookups by id. Use it for read-mostly reference data.

### How do you manage schema changes in production?

With versioned Flyway or Liquibase migrations applied at deployment, `ddl-auto=validate`, and expand-and-contract steps so old and new application versions both work during a rollout.

### How do you test repositories?

With `@DataJpaTest` against the real database engine via Testcontainers, flushing so the SQL actually runs and clearing so reads hit the database. Critical flows are tested without a test-level transaction, and query counts are asserted to catch N+1.

## Scenario Questions

### The app slows down and logs "Connection is not available, request timed out". What do you check?

Look at the pool metrics (active, pending) and turn on leak detection. Look for long transactions (remote calls inside `@Transactional`), Open Session in View, nested `REQUIRES_NEW` calls and slow queries. Fix those before making the pool bigger.

### Deleted customers must stay in the database for auditing. How?

Soft deletes with `@SoftDelete` (or `@SQLDelete` + `@SQLRestriction`), unique constraints that account for the deleted flag, and Envers if you need the full change history.

### An API listing 100 orders runs 301 queries. What do you do?

Turn on SQL logging, identify the lazy associations being touched (often during JSON serialization), then fetch them with `JOIN FETCH`/`@EntityGraph` or return a DTO projection; enable `default_batch_fetch_size` as a safety net and consider disabling OSIV.

### Two users book the last seat at the same time and both succeed. How do you prevent it?

Use `@Version` optimistic locking (one update fails → retry or show "sold out"), a pessimistic `FOR UPDATE` lock on the seat row, or an atomic conditional update (`UPDATE … SET available = false WHERE id = ? AND available = true`, check 1 row updated), backed by a unique constraint.

### Importing 1 million rows with saveAll() is very slow. Why?

`IDENTITY` ids disable JDBC batching, every entity stays in the persistence context (dirty checking grows), and each insert is a round trip. Use `SEQUENCE` ids, `hibernate.jdbc.batch_size`, `order_inserts`, flush and clear every N rows — or use `JdbcTemplate.batchUpdate` / database bulk-load tools.

### After a @Modifying update, the entity you read still shows the old value. Why?

Bulk queries bypass the persistence context, so the already-loaded entity is stale. Use `@Modifying(clearAutomatically = true, flushAutomatically = true)` or refresh the entity.

### A paginated endpoint with JOIN FETCH runs out of memory. Why?

Fetch-joining a collection with pagination makes Hibernate load every row and paginate in memory (HHH90003004). Paginate parent ids first, then fetch their collections, or use batch fetching.

### An audit row must be saved even when the main operation fails. How?

Write it in a separate bean method with `@Transactional(propagation = REQUIRES_NEW)` — it commits independently of the outer transaction.

## Common Traps

| Trap | Reality |
| --- | --- |
| "`save()` always runs an `UPDATE`" | It persists new entities and merges others; managed entities don't need `save()` at all |
| "Derived `deleteBy` is one `DELETE`" | It selects, then removes each entity |
| "`@ManyToOne` is lazy" | It's EAGER by default |
| "`flush()` commits" | It only sends SQL; commit or rollback still follows |
| "Checked exceptions roll back" | Not by default — use `rollbackFor` |
| "`@Transactional` works on any method" | Only through the proxy — not self-invocation |
| "`EnumType` default is fine" | `ORDINAL` breaks when constants are reordered |
| "`List` is fine for `@ManyToMany`" | Bags delete and re-insert join rows; use `Set` |
| "`CascadeType.ALL` everywhere is convenient" | REMOVE on shared or parent associations deletes data you meant to keep |
| "`ddl-auto=update` is fine in production" | Use migrations and `validate` |
| "JPQL bulk updates bump `@Version` and run auditing" | They bypass both |
| "The second-level cache caches my queries" | It serves lookups by id; queries need the separate query cache |
| "A bigger connection pool is faster" | Past roughly cores × 2, it adds contention |
| "Passing on H2 means it works on MySQL" | Dialects differ; test with Testcontainers |
| "`@SoftDelete` covers native queries" | Native SQL must filter deleted rows itself |

## Configuration Cheat Sheet

```properties
# production-friendly defaults
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false

# batching and fetching
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
spring.jpa.properties.hibernate.default_batch_fetch_size=50

# development only: see the SQL
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.orm.jdbc.bind=TRACE
```

## Key Takeaways

- ✅ Know the persistence context — it explains dirty checking, caching, flushing and lazy loading.
- ✅ LAZY everywhere, fetch explicitly, watch for N+1.
- ✅ Owning side, `mappedBy`, cascades and `orphanRemoval` decide what gets written.
- ✅ Transactions are proxy-based; know the rollback rules and propagation.
- ✅ Prevent lost updates with `@Version` or pessimistic locks.
