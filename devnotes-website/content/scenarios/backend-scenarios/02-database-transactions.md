---
title: Database & Transaction Scenarios
subtitle: "Scenario questions 11–20: connection pool exhaustion, queries that slow down at millions of rows or only in production, losing the database at peak, concurrent updates, rollbacks, @Transactional that doesn't roll back, self-invocation, offset vs keyset pagination, and retries after a lost response."
order: 2
---

## Introduction

Most backend production incidents end at the database. These scenarios test whether you understand connection pools, indexes and execution plans, transactions and locking. The *Spring Data JPA & Hibernate* track covers each topic in depth. Links are given in the answers.

## Scenario Questions

### Q11. Your database connection pool is exhausted. How would you identify and resolve the issue?

**Symptoms:**

```output
HikariPool-1 - Connection is not available, request timed out after 30000ms
(total=10, active=10, idle=0, waiting=42)
```

**Identify the cause:**

1. **Metrics:** `hikaricp_connections_active`, `_pending` and `_usage` (how long each connection is held). Long usage times point to long transactions.
2. **Leak detection:** set `spring.datasource.hikari.leak-detection-threshold=20000`. Hikari logs the stack trace of code that held a connection for more than 20 s.
3. **Thread dumps:** what are the threads holding connections doing? Often they're waiting on an HTTP call **inside a `@Transactional` method**.
4. **Database:** slow queries and lock waits keep connections busy (`SHOW PROCESSLIST`, `pg_stat_activity`).

**Common root causes and fixes:**

| Cause | Fix |
| --- | --- |
| Remote calls or file processing inside a transaction | Move them outside; keep transactions short |
| Open Session in View holding a connection for the whole request | `spring.jpa.open-in-view=false` |
| Slow queries | Indexes, query tuning, pagination |
| `REQUIRES_NEW` nesting (two connections per request) | Redesign, or size for it |
| Leaked connections in manual JDBC code | try-with-resources |
| Too many instances for the database's limit | Size the pool so instances × pool size fits the database |

Increasing the pool size is the **last** step, not the first. A bigger pool on a struggling database usually makes things worse. See [Caching, Connection Pooling & Migrations](/spring/spring-data-jpa/caching-pooling-migrations/).

### Q12. A SQL query runs quickly with a small dataset but becomes extremely slow when the table contains millions of records. How would you optimize it?

With little data, a **full table scan** is cheap. With millions of rows it isn't. Start with the execution plan:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 AND status = 'SHIPPED' ORDER BY created_at DESC LIMIT 20;
```

Look for full scans (`type: ALL` in MySQL, `Seq Scan` in PostgreSQL), filesorts, and huge row estimates.

**Fixes:**

- **Add the right index.** A composite index matching the filter and sort, with equality columns first: `CREATE INDEX idx_orders_cust_status_created ON orders (customer_id, status, created_at)`.
- **Make conditions index-friendly.** No functions on indexed columns (`WHERE DATE(created_at) = …` → a range), no leading wildcards (`LIKE '%x'`), and no implicit type conversions (comparing a `VARCHAR` column with a number).
- **Select only the needed columns.** A covering index can then answer the query without touching the table.
- **Paginate,** and use keyset pagination for deep pages (Q19).
- **Rewrite heavy patterns:** `OR` → `UNION`, correlated subqueries → joins, `NOT IN` with NULLs → `NOT EXISTS`.
- **Keep statistics fresh** (`ANALYZE TABLE` / `ANALYZE`).
- **For very large tables:** partitioning (by date), archiving old rows, or precomputed summary tables for reports.

Then measure again. Index changes also slow down writes a little, so add only the indexes you need.

### Q13. A query performs well locally but becomes slow in production. What would you check?

- **Data volume and distribution.** Production may have millions of rows, or skewed values (one customer with 2 million orders) that change the plan.
- **The execution plan in production,** which can differ because of different statistics, indexes or database version. Run `EXPLAIN` there, or on a production-sized copy.
- **Missing indexes in production:** a migration that wasn't applied, or an index created only locally by `ddl-auto`.
- **Concurrency:** locks and blocking from other transactions, which don't exist locally.
- **Resources:** database CPU, I/O, buffer pool or cache hit ratio, and noisy neighbours on shared hosts.
- **Network latency:** more round trips (N+1) cost much more than on localhost.
- **Parameter-sensitive plans:** a plan cached for one parameter value is bad for another.
- **Configuration:** isolation level, collation and character set (index usability), and database parameters.

Check the slow query log, compare plans, and test against realistic data before release.

### Q14. Your application loses its database connection during peak traffic. How should the service behave?

It should **degrade gracefully and recover automatically**, never hang or crash.

- **Fail fast:** a short `connection-timeout` (for example 2–5 s instead of 30 s) so threads don't pile up waiting.
- **Return a clear error:** `503 Service Unavailable` with a `Retry-After` header, not a stack trace or a hang.
- **Readiness probes:** report the instance as not ready so the load balancer stops sending traffic (`management.endpoint.health.probes.enabled=true`, with the DB check in the readiness group). Keep the database **out of the liveness probe**, otherwise Kubernetes restarts every pod during a database blip.
- **Recover automatically:** Hikari validates and replaces broken connections. Set `max-lifetime` below the database and firewall timeouts.
- **Retry carefully:** retry idempotent reads with backoff and jitter. Don't blindly retry writes (see Q20).
- **Degrade:** serve cached data for reads where acceptable. Queue writes (to Kafka or an outbox) if the business allows it.
- **Protect the database when it comes back:** circuit breakers and rate limiting avoid a thundering herd.

Also find out **why** it happened: too many connections from all instances, failover, network problems, or the database running out of resources.

### Q15. Two requests update the same employee or order record simultaneously. How would you prevent data inconsistency?

The risk is the **lost update**: both read version A, both write, and the second write overwrites the first.

**Options:**

1. **Optimistic locking (the default choice):**

```java
@Entity
public class Order {
    @Version
    private Long version;
}
```

The second update fails with `ObjectOptimisticLockingFailureException`. Then **retry**, or return `409 Conflict` so the user can reload. For REST APIs, send the version as an `ETag` and require `If-Match` on updates.

2. **Pessimistic locking** for hot rows where conflicts are frequent (stock, seat booking):

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT o FROM Order o WHERE o.id = :id")
Optional<Order> findForUpdate(@Param("id") Long id);
```

3. **Atomic conditional updates** for simple changes:

```sql
UPDATE product SET stock = stock - 1 WHERE id = ? AND stock > 0;   -- check that 1 row was updated
```

4. **Database constraints** (unique keys, checks) as the last line of defence.

See [Transactions & Locking](/spring/spring-data-jpa/transactions-locking/) and Q47 for choosing between them.

### Q16. An exception occurs halfway through a business operation. How would you ensure that partial database changes are rolled back?

Run the whole operation in **one transaction**, at the service layer:

```java
@Service
public class OrderService {

    @Transactional(rollbackFor = Exception.class)
    public Order placeOrder(PlaceOrderCommand cmd) {
        Order order = orderRepository.save(Order.from(cmd));
        inventoryService.reserve(cmd.items());   // same transaction (REQUIRED)
        paymentRecordRepository.save(new PaymentRecord(order));
        return order;                             // an exception anywhere → everything rolls back
    }
}
```

Checklist:

- The method is **public** and called **from another bean**, through the Spring proxy.
- The exception **propagates** out of the method. Don't catch it and carry on.
- The exception type triggers rollback. Unchecked exceptions do by default; checked ones need `rollbackFor`.
- All repositories use the **same data source** and transaction manager.
- The tables use a transactional engine (InnoDB, not MyISAM).

If the operation also calls **other services or Kafka**, a database rollback can't undo those. Use the outbox pattern or a saga with compensating actions (Q21, Q26).

### Q17. Your @Transactional annotation is present, but the transaction is not rolling back. What could be wrong?

| Cause | Explanation |
| --- | --- |
| **Checked exception** | By default only `RuntimeException` and `Error` roll back. Use `rollbackFor = Exception.class`. |
| **Exception caught inside the method** | The proxy never sees it. Rethrow it, or call `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`. |
| **Self-invocation** | `this.method()` bypasses the proxy, so there's no transaction (Q18). |
| **Method not public, or the class is final** | It isn't proxied (with JDK proxies or older Spring versions). |
| **The bean isn't Spring-managed** | It was created with `new`. |
| **Wrong transaction manager** | With multiple data sources, the default manager covers a different database. |
| **`REQUIRES_NEW` or `NOT_SUPPORTED` inside** | That part commits independently. |
| **Non-transactional storage** | MyISAM tables, DDL statements that auto-commit (MySQL), or calls to other systems. |
| **The annotation is from the wrong package** | On Spring Boot 3, an old `javax.transaction.Transactional` import is silently ignored. Use `org.springframework.transaction.annotation.Transactional` (or `jakarta.transaction.Transactional`). |
| **Async work** | `@Async` methods or new threads run outside the caller's transaction. |

Check by enabling `logging.level.org.springframework.transaction=DEBUG` (or `org.springframework.orm.jpa=DEBUG`) to see when transactions begin, commit and roll back.

### Q18. A method annotated with @Transactional calls another transactional method in the same class, but the expected transaction behavior does not occur. Why?

Spring applies `@Transactional` through a **proxy** that wraps the bean. External calls go through the proxy, but a call from one method of the bean to another (`this.inner()`) **goes directly to the object**, so the inner method's annotation is ignored.

```java
@Service
public class ReportService {
    @Transactional
    public void outer() {
        inner();                        // ❌ REQUIRES_NEW is ignored: same transaction
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inner() { … }
}
```

**Fixes:**

- **Move `inner()` to another bean** and inject it. This is the cleanest option.
- **Self-inject** the proxy: `@Autowired @Lazy ReportService self;` then call `self.inner()`.
- **Use `TransactionTemplate`** for programmatic control:

```java
transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
transactionTemplate.executeWithoutResult(status -> doInner());
```

The same trap applies to `@Async`, `@Cacheable` and `@Retryable`.

### Q19. Your application needs to paginate millions of database records. Would you use offset pagination or keyset pagination, and why?

**Keyset (seek) pagination** for large or deep datasets:

```sql
-- offset: the database reads and discards 1,000,000 rows
SELECT * FROM orders ORDER BY id LIMIT 50 OFFSET 1000000;

-- keyset: jumps straight to the position through the index
SELECT * FROM orders WHERE id > :lastSeenId ORDER BY id LIMIT 50;
```

| | Offset | Keyset |
| --- | --- | --- |
| Speed on deep pages | Gets slower as the offset grows | Constant (uses the index) |
| Consistency while data changes | Rows shift: duplicates or skipped rows | Stable |
| Jump to page N | ✅ | ❌ Next and previous only |
| Total count | Usually computed (an expensive `COUNT`) | Not needed |

- **Use offset** for small, bounded result sets or admin screens that need page numbers ("page 3 of 12").
- **Use keyset** for feeds, infinite scroll, APIs (cursor-based: `?after=eyJpZCI6MTIzfQ`) and batch jobs.

The sort key must be **unique and indexed**. Use a tie-breaker: `ORDER BY created_at, id` with `WHERE (created_at, id) > (?, ?)`. Spring Data supports this with `ScrollPosition.keyset()` and `Window<T>`. See [Pagination & Sorting](/spring/spring-data-jpa/pagination-sorting/).

### Q20. A database update succeeds, but the application fails before returning a response. How would you handle the client's retry?

The client can't tell whether the request succeeded, so it retries, and a naive server performs the operation **twice**. Make the operation **idempotent**:

1. **Idempotency key:** the client sends a unique `Idempotency-Key` header (a UUID) per logical operation, and reuses it on retries.
2. **Store the key in the same transaction as the business change,** with a unique constraint:

```sql
CREATE TABLE idempotency_record (
    idem_key      VARCHAR(64) PRIMARY KEY,
    request_hash  VARCHAR(64) NOT NULL,
    response_body TEXT,
    status        VARCHAR(20) NOT NULL,   -- IN_PROGRESS / COMPLETED
    created_at    TIMESTAMP NOT NULL
);
```

3. **On a retry** with the same key: return the **stored response** without running the operation again. If the request body differs (a different hash), return `422`. If the first request is still running, return `409` (or wait).
4. **Natural idempotency** where possible: `PUT` with the full state, `DELETE`, or a unique business key (`order_ref`) with a unique constraint, so a duplicate insert fails and you return the existing resource.

Expire old keys after 24–72 hours. Q45 covers storage and concurrency in more detail.

## Key Takeaways

- ✅ Pool exhaustion almost always means connections held too long. Find out why before resizing.
- ✅ Slow-at-scale queries need `EXPLAIN`, composite and covering indexes, and index-friendly predicates.
- ✅ Lose the database gracefully: fail fast, return 503, use readiness probes, recover automatically.
- ✅ Prevent lost updates with `@Version`, pessimistic locks, or atomic conditional updates.
- ✅ Rollbacks need proxy calls, propagated runtime exceptions (or `rollbackFor`), and one transaction manager.
- ✅ Use keyset pagination at scale, and idempotency keys for safe retries.
