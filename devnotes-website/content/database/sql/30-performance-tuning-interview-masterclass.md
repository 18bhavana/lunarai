---
title: Performance Tuning & Interview Masterclass
subtitle: Query optimization, EXPLAIN and EXPLAIN ANALYZE, the slow query log, join and pagination strategies, partitioning, common production problems, the top 20 interview questions and a revision roadmap.
order: 30
---

## Introduction

This chapter brings together everything from the earlier chapters and shows how MySQL is optimized in real enterprise applications.

It covers query optimization, an `EXPLAIN` deep dive, the slow query log, join optimization, pagination strategies, partitioning, common production problems, the top interview questions, production best practices and a complete revision roadmap — the knowledge expected from an experienced Java backend developer.

## Topic Review

```tree
SQL & MySQL
  Fundamentals | SELECT, WHERE, ORDER BY, LIMIT, DISTINCT, CRUD
  Joins | INNER, LEFT, RIGHT, SELF, CROSS
  Reporting | GROUP BY, HAVING, aggregate functions
  Advanced SQL | subqueries, correlated subqueries, CTEs, window functions
  Design & performance | keys, constraints, normalization, indexes, views, stored procedures
```

## Query Optimization

### Avoid SELECT *

```sql
-- Poor: on a 50-million-row table this is extremely expensive
SELECT * FROM employee;

-- Better: retrieve only the required columns
SELECT employee_name, salary FROM employee;
```

`SELECT *` causes:

- more disk I/O;
- more memory usage;
- more network traffic and unnecessary data transfer;
- lost covering-index opportunities;
- application code that depends on the table structure.

**Enterprise rule:** avoid `SELECT *` in production queries unless every column is genuinely required.

### Use WHERE Properly

Filter unnecessary rows as early as possible:

```sql
SELECT employee_id, employee_name, salary
FROM employee
WHERE department = 'IT';
```

### Optimize JOINs

```sql
SELECT o.order_id, o.order_date, c.customer_name
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id;
```

Columns used in join conditions should be indexed:

```sql
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
```

`customers.customer_id` is usually already indexed as the primary key. (InnoDB also creates an index on a foreign-key column automatically if none exists.)

### Use Composite Indexes

```sql
SELECT order_id, order_date, status
FROM orders
WHERE customer_id = 100
  AND order_date > '2026-01-01';

CREATE INDEX idx_customer_order_date ON orders (customer_id, order_date);
```

Why this order? `customer_id` is an **equality** condition and `order_date` is a **range** condition. Equality columns go first, the range column last, so the index matches the query's access pattern.

### Avoid Functions on Indexed Columns

```sql
-- Bad: the function prevents efficient use of an index on order_date
SELECT * FROM orders WHERE YEAR(order_date) = 2026;

-- Better
SELECT *
FROM orders
WHERE order_date >= '2026-01-01'
  AND order_date <  '2027-01-01';
```

This is also safer than `BETWEEN` when the column holds date **and time** values, because the upper boundary is explicit and exclusive. A predicate the optimizer can use an index for is called **sargable**.

### Let the Database Count

```sql
-- Bad: fetch every row, then count in Java
SELECT * FROM orders;

-- Better: return only the count
SELECT COUNT(*) FROM orders;
```

> [!NOTE]
> InnoDB doesn't store an exact row count, so `COUNT(*)` on a huge table still scans an index (it picks the smallest one). For dashboards that only need an approximate total, a cached or summary count may be good enough.

### EXISTS vs IN

`EXISTS` expresses *"do matching rows exist?"* clearly:

```sql
SELECT c.customer_id, c.customer_name
FROM customer c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

`IN` can be just as efficient in modern MySQL, because the optimizer may transform both into a semi-join. **Don't assume `EXISTS` is always faster than `IN`** — choose by correct semantics (remember the `NOT IN` + `NULL` trap), index properly and verify with `EXPLAIN` / `EXPLAIN ANALYZE`.

## EXPLAIN Deep Dive

```sql
EXPLAIN
SELECT * FROM employee WHERE department = 'IT';
```

| id | type | key | rows | Extra |
| --- | --- | --- | --- | --- |
| 1 | ref | idx_department | 200 | Using where |

| Column | Meaning |
| --- | --- |
| `type` | Access method |
| `possible_keys` | Indexes MySQL could use |
| `key` | Index actually selected |
| `key_len` | How much of the index is used (useful for composite indexes) |
| `ref` | Columns or constants compared with the index |
| `rows` | Estimated rows examined |
| `filtered` | Estimated percentage of rows passing the condition |
| `Extra` | Additional execution information |

### Important `type` Values

| Type | Meaning |
| --- | --- |
| `system` | Table has only one row |
| `const` | At most one matching row |
| `eq_ref` | One matching row for each row of the previous table |
| `ref` | Non-unique index lookup |
| `range` | Index range scan |
| `index` | Full index scan |
| `ALL` | Full table scan |

For large tables, investigate an unexpected `ALL`. A full table scan isn't automatically wrong, but it's expensive when only a few rows are needed.

### Important `Extra` Values

| Extra | Meaning |
| --- | --- |
| `Using index` | Covering index — no table lookup |
| `Using where` | Rows are filtered after being read |
| `Using filesort` | An extra sort step (the index doesn't provide the order) |
| `Using temporary` | A temporary table is used (common with `GROUP BY` / `DISTINCT`) |

### EXPLAIN ANALYZE

MySQL 8.0.18+ supports:

```sql
EXPLAIN ANALYZE
SELECT * FROM employee WHERE salary > 70000;
```

Unlike `EXPLAIN`, `EXPLAIN ANALYZE` **executes** the query and reports actual timings and row counts, so you can compare optimizer estimates with actual execution. It helps find incorrect row estimates, expensive operations, slow joins, unexpected scans and bottlenecks.

> [!WARNING]
> Because `EXPLAIN ANALYZE` really runs the statement, be careful on production with very slow queries — and with `UPDATE`/`DELETE`, which it does execute (MySQL 8.0.18+ supports them for `EXPLAIN ANALYZE` only from later 8.0 releases; test on a copy).

## Slow Query Log

MySQL can record slow-running queries:

```text
slow_query_log  = ON
long_query_time = 2      # seconds
```

Queries slower than the threshold are logged for analysis. Production teams use the slow query log to find frequently slow queries, missing indexes, expensive scans, poor join strategies and queries needing optimization. Tools such as `mysqldumpslow` or Percona's `pt-query-digest` aggregate the log by query pattern; `log_queries_not_using_indexes` can also log unindexed queries.

## Pagination Strategies

### LIMIT / OFFSET Pagination

```sql
SELECT *
FROM employee
ORDER BY employee_id
LIMIT 10 OFFSET 10000;
```

The database still has to read and **skip the first 10,000 rows** before returning the next 10. As the offset grows:

| Offset | Cost |
| --- | --- |
| 100 | Usually manageable |
| 100,000 | More expensive |
| 10,000,000 | Potentially very expensive |

### Keyset Pagination (Seek Method)

Instead of a large offset, continue from the **last key seen**:

```sql
SELECT *
FROM employee
WHERE employee_id > 10000
ORDER BY employee_id
LIMIT 10;
```

| Page | Condition | Remembered last ID |
| --- | --- | --- |
| 1 | *(none)* | 10 |
| 2 | `WHERE employee_id > 10` | 20 |
| 3 | `WHERE employee_id > 20` | 30 |

Benefits: efficient for large datasets, no scanning and skipping of large offsets, works well for infinite scrolling, and stable when rows are inserted between requests.

> [!NOTE]
> `WHERE employee_id > 10000` returns the same rows as `OFFSET 10000` only if IDs are contiguous — keyset pagination continues from a **key value**, not a row position. When the sort column isn't unique, add a tie-breaker: `WHERE (created_at, id) > (?, ?) ORDER BY created_at, id`.

### OFFSET vs Keyset

| OFFSET pagination | Keyset pagination |
| --- | --- |
| Easy to implement | Requires a cursor / last key |
| Can jump directly to page numbers | Best for next/previous navigation |
| Slower at large offsets | Efficient for large datasets |
| Can skip or repeat rows when data changes | More stable with deterministic ordering |

## Partitioning

A table with **500 million rows** may be partitioned by year, month, region or numeric ranges:

```sql
CREATE TABLE orders (
    order_id    BIGINT NOT NULL,
    order_date  DATE   NOT NULL,
    customer_id BIGINT NOT NULL,
    amount      DECIMAL(12, 2),
    PRIMARY KEY (order_id, order_date)
)
PARTITION BY RANGE (YEAR(order_date)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION pmax  VALUES LESS THAN MAXVALUE
);
```

Benefits can include partition pruning, easier archival, easier management of very large datasets and **fast deletion of old data** (`ALTER TABLE orders DROP PARTITION p2024` instead of a huge `DELETE`).

> [!IMPORTANT]
> Partitioning is **not a replacement for proper indexing**, and poorly designed partitioning adds complexity without improving performance. MySQL also requires every primary key and unique key to **include all partitioning columns** (hence `PRIMARY KEY (order_id, order_date)` above), and partitioned InnoDB tables **can't have foreign keys**.

### Partition Pruning

With the table partitioned by year:

```sql
SELECT *
FROM orders
WHERE order_date >= '2026-01-01'
  AND order_date <  '2027-01-01';
```

MySQL can scan only the relevant partition instead of all of them — **partition pruning**. `EXPLAIN` shows the partitions touched in its `partitions` column.

## Denormalization

A highly normalized schema means many JOINs, which can make reporting queries expensive. Enterprise reporting systems may use summary tables, denormalized schemas, precomputed aggregates, materialized-view patterns and data warehouses to improve read performance.

Denormalization should be **intentional, measured and documented** — don't denormalize without a demonstrated performance requirement.

## Common Production Problems

### 1. Missing Index

```sql
SELECT * FROM customer WHERE email = 'abc@gmail.com';
```

No suitable index → large table → full scan → slow query. A possible fix:

```sql
CREATE UNIQUE INDEX idx_customer_email ON customer (email);
```

### 2. The N+1 Query Problem

```flow-h
Load 100 customers — 1 query
For each customer, load orders — 100 queries
101 queries in total
```

Common with ORM frameworks such as Hibernate. Solutions: proper JOINs, fetch joins (`JOIN FETCH`), entity graphs, batch fetching (`@BatchSize`), DTO projections and query-specific fetching strategies.

### 3. Cartesian Join

```sql
SELECT * FROM a, b;   -- no join condition
```

With 10,000 rows in each table, the result has **100,000,000 rows**. Always verify join conditions.

### 4. Locking Issues

```flow-h
BEGIN
Update rows
Application does slow work
More queries
COMMIT
```

Locks are held for the whole time. Keep transactions **short, focused and consistent**, and commit or roll back quickly — don't call external services inside a transaction.

### 5. Too Many Indexes

Indexes help reads but add overhead to every `INSERT`, `UPDATE` and `DELETE`. Monitor and remove genuinely unused or redundant indexes after careful analysis (`sys.schema_unused_indexes` and `sys.schema_redundant_indexes` help).

### 6. Large Result Sets

Returning millions of rows to a Java application causes high database load, high network usage, high application memory and long response times. Use pagination, streaming where appropriate, filtering, aggregation and batch processing.

## Top 20 Interview Questions

### 1. Explain the logical SQL query processing order.

```flow-h
FROM / JOIN
WHERE
GROUP BY
HAVING
Window functions
SELECT
DISTINCT
ORDER BY
LIMIT
```

This is the **logical** order, not necessarily the physical order the optimizer chooses. Window functions are evaluated after `HAVING`, which is why they can't be used in `WHERE`.

### 2. Difference between WHERE and HAVING?

`WHERE` filters **rows before grouping** and can't filter aggregate results directly. `HAVING` filters **groups after aggregation** and is used with aggregate functions.

### 3. Clustered vs secondary index?

In InnoDB the primary key is the **clustered index** — its leaf nodes contain the row data. A secondary index stores the secondary key plus the primary-key value, which is then used for a clustered-index lookup.

### 4. What is a covering index?

An index containing every column needed to satisfy a query. For `SELECT department, salary FROM employee WHERE department = 'IT'`, the index `(department, salary)` lets the query be answered directly from the index.

### 5. Explain the leftmost-prefix rule.

An index on `(a, b, c)` efficiently supports the leading prefixes `(a)`, `(a, b)` and `(a, b, c)`. Skipping the leading column usually prevents normal use of the composite index for lookups.

### 6. Difference between ROW_NUMBER(), RANK() and DENSE_RANK()?

| Salary | ROW_NUMBER() | RANK() | DENSE_RANK() |
| --- | --- | --- | --- |
| 100 | 1 | 1 | 1 |
| 100 | 2 | 1 | 1 |
| 90 | 3 | 3 | 2 |

`ROW_NUMBER()` always gives unique numbers; `RANK()` gives ties the same rank and leaves gaps; `DENSE_RANK()` gives ties the same rank without gaps.

### 7. CTE vs subquery?

CTEs improve readability, break complex logic into named steps, can be referenced several times, and support recursion for hierarchical queries. Subqueries suit smaller nested operations and are concise for simple cases. Performance depends on the query and optimizer.

### 8. Procedure vs function?

A **stored procedure** is called with `CALL`, can perform multi-step operations and supports `IN`, `OUT` and `INOUT`. A **stored function** returns one value, can be used inside SQL expressions and is typically used for reusable calculations.

### 9. Explain normalization.

Organizing data to reduce unnecessary redundancy, prevent update anomalies and improve integrity. Common forms: 1NF → 2NF → 3NF → BCNF.

### 10. Explain EXPLAIN.

`EXPLAIN` shows the optimizer's execution plan — access methods, index selection, join order, estimated rows and additional operations.

### 11. Why is SELECT * discouraged?

It retrieves unnecessary columns and increases I/O, network traffic and memory use, and it can prevent covering-index optimizations.

### 12. DELETE vs TRUNCATE vs DROP?

| | DELETE | TRUNCATE | DROP |
| --- | --- | --- | --- |
| Removes | Selected rows (`WHERE`) | All rows | The whole table |
| Type | DML | DDL | DDL |
| Rollback | Yes, inside a transaction | No — implicit commit | No — implicit commit |
| Fires `DELETE` triggers | Yes | No | No |
| Resets `AUTO_INCREMENT` | No | Yes | Table is gone |

```sql
DELETE FROM employee WHERE employee_id = 101;
TRUNCATE TABLE employee;
DROP TABLE employee;
```

### 13. Explain the ACID properties.

- **Atomicity** — all operations succeed or all fail.
- **Consistency** — transactions move the database from one valid state to another.
- **Isolation** — concurrent transactions don't incorrectly interfere with each other.
- **Durability** — committed data survives failures (InnoDB's redo log).

### 14. What is a deadlock?

Transactions waiting for each other's locks in a cycle:

| Transaction A | Transaction B |
| --- | --- |
| Locks row 1 | Locks row 2 |
| Waits for row 2 | Waits for row 1 |

InnoDB detects the deadlock and rolls back one transaction (the "victim", error 1213). Applications should be prepared to **retry** deadlock victims, and can reduce deadlocks by accessing rows in a consistent order.

### 15. What is MVCC?

**Multi-Version Concurrency Control** keeps multiple versions of rows so consistent reads can usually happen **without blocking writers**. InnoDB implements it with undo logs, transaction IDs and read views.

### 16. Explain isolation levels.

MySQL supports `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ` and `SERIALIZABLE`. InnoDB's default is **`REPEATABLE READ`**. Higher isolation gives stronger consistency guarantees but may increase contention.

### 17. What is an index scan?

Reading entries from an index. Depending on the query, MySQL may do an index lookup, a range scan, a full index scan or a full table scan. An index scan isn't automatically efficient — the number of rows examined still matters.

### 18. What is keyset pagination?

Paging with the last retrieved ordering key instead of a large `OFFSET`:

```sql
SELECT *
FROM employee
WHERE employee_id > 10000
ORDER BY employee_id
LIMIT 10;
```

### 19. When would you denormalize?

When measured read-performance requirements justify controlled redundancy — reporting, analytics, dashboards, data warehouses and precomputed summaries.

### 20. How do you troubleshoot a slow query?

1. Identify the slow query (slow query log, APM).
2. Run `EXPLAIN`.
3. Use `EXPLAIN ANALYZE` where appropriate.
4. Check indexes.
5. Check rows examined.
6. Review join order and conditions.
7. Remove unnecessary columns.
8. Rewrite non-sargable predicates.
9. Check locking and transaction behavior.
10. Measure again after optimizing.

Never assume an optimization worked — **verify it**.

## Enterprise Performance Checklist

Before deploying important SQL:

- ✅ Avoid unnecessary `SELECT *`.
- ✅ Index according to actual query patterns.
- ✅ Verify execution plans with `EXPLAIN`, and `EXPLAIN ANALYZE` when actual metrics are needed.
- ✅ Reduce unnecessary rows and columns.
- ✅ Optimize join conditions; use covering indexes where beneficial.
- ✅ Prefer keyset pagination for large sequential datasets.
- ✅ Keep transactions short.
- ✅ Monitor slow queries, and review unused and redundant indexes.
- ✅ Measure before and after optimizing.

## Mini Project — Optimize a Query

```sql
SELECT *
FROM orders o
JOIN customer c ON o.customer_id = c.customer_id
WHERE YEAR(o.order_date) = 2026
ORDER BY o.order_date DESC;
```

**Step 1 — remove `SELECT *`:**

```sql
SELECT o.order_id, o.order_date, o.amount, c.customer_id, c.customer_name
FROM orders o
JOIN customer c ON o.customer_id = c.customer_id
WHERE YEAR(o.order_date) = 2026
ORDER BY o.order_date DESC;
```

**Step 2 — rewrite the date filter:**

```sql
SELECT o.order_id, o.order_date, o.amount, c.customer_id, c.customer_name
FROM orders o
JOIN customer c ON o.customer_id = c.customer_id
WHERE o.order_date >= '2026-01-01'
  AND o.order_date <  '2027-01-01'
ORDER BY o.order_date DESC;
```

**Step 3 — add appropriate indexes:**

```sql
CREATE INDEX idx_orders_order_date_customer ON orders (order_date, customer_id);
```

The index serves the date range **and** the `ORDER BY` (MySQL can read it backwards for `DESC`, avoiding a filesort), and includes `customer_id` for the join. Make sure `customer.customer_id` is indexed — normally through its primary key.

**Step 4 — run `EXPLAIN`** on the rewritten query and check `type`, `possible_keys`, `key`, `rows`, `filtered` and `Extra`.

**Step 5 — explain the improvements:**

| Before | After |
| --- | --- |
| `SELECT *` | Required columns only |
| `YEAR(order_date)` — poor index use | Index-friendly date range |
| Unindexed access path | Indexed range and join columns |
| Unverified | Execution plan verified |

Result: less work and better scalability.

## Final Practice Challenges

**Easy**

1. Explain `GROUP BY`.
2. Explain `HAVING`.
3. Explain `LEFT JOIN`.
4. Explain a primary key.
5. Explain a foreign key.

**Medium**

1. Write a query using a CTE.
2. Rank employees by salary.
3. Find the second-highest salary.
4. Build a running-total report.
5. Optimize a slow query.

**Advanced**

1. Design an e-commerce database.
2. Optimize a complex JOIN query.
3. Explain ACID.
4. Design indexes for a banking application.
5. Build a complete executive dashboard using window functions and CTEs.

## Best Practices

- ✅ Understand execution plans before optimizing.
- ✅ Write correct, readable SQL first, then optimize based on evidence.
- ✅ Prefer window functions over overly complex self-joins where appropriate.
- ✅ Design indexes from real query patterns, not assumptions, and understand the leftmost-prefix rule.
- ✅ Balance normalization with reporting performance.
- ✅ Use transactions correctly; understand locking, deadlocks and isolation levels.
- ✅ Recognize and solve the N+1 query problem.
- ✅ Keep business logic primarily in the application layer unless database-side execution offers a clear benefit.

## Revision Roadmap

| Week | Revise | Practice |
| --- | --- | --- |
| 1 — SQL fundamentals | `SELECT`, `WHERE`, operators, CRUD, `ORDER BY`, `LIMIT`, string and date functions | 20–30 SQL queries |
| 2 — Joins & aggregation | `INNER`, `LEFT`, `RIGHT` and `SELF JOIN`, `GROUP BY`, `HAVING`, aggregate functions | 15–20 join and reporting problems |
| 3 — Advanced SQL | Subqueries, correlated subqueries, CTEs, window and ranking functions, `LEAD()`, `LAG()` | 15–20 advanced SQL problems |
| 4 — Design & performance | Keys, constraints, normalization, indexes, views, stored procedures, transactions, `EXPLAIN`, query optimization | Analyze and optimize real SQL queries |

### Where to Go Next

| Area | Topics |
| --- | --- |
| Database depth | Replication, backup and recovery, advanced partitioning, InnoDB architecture, optimizer internals, locking and deadlock analysis |
| Spring Data | Spring Data JPA, Hibernate performance tuning, JPQL, Criteria API, entity graphs, batch processing, N+1 optimization |
| System design | Database scaling, sharding, read replicas, Redis caching, message queues, microservice data patterns, distributed transactions |
| Production engineering | Docker, Kubernetes, CI/CD, monitoring, observability, database metrics, production troubleshooting |

## Key Takeaways

- ✅ Fetch only the columns and rows you need; let the database filter, aggregate and count.
- ✅ Index join columns and design composite indexes as equality columns first, range column last.
- ✅ Keep predicates sargable — no functions on indexed columns; use half-open date ranges.
- ✅ Read `EXPLAIN` (`type`, `key`, `rows`, `Extra`) and confirm with `EXPLAIN ANALYZE`.
- ✅ Use the slow query log to find what to optimize.
- ✅ Prefer keyset pagination for deep pages; partition only very large tables, and never instead of indexing.
- ✅ Watch for missing indexes, N+1 queries, Cartesian joins, long transactions, too many indexes and huge result sets.
- ✅ Measure before and after every optimization.
