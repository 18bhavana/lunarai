---
title: Indexes & Query Performance
subtitle: How B-Tree indexes work, clustered vs secondary indexes, composite indexes and the leftmost-prefix rule, covering, unique and full-text indexes, selectivity and reading EXPLAIN.
order: 27
---

## Introduction

Indexes are the **single most important feature for improving MySQL query performance**, and one of the top five SQL interview topics for experienced Java backend developers.

This chapter covers what indexes are, how B-Tree indexes work, clustered vs secondary (non-clustered) indexes, composite, covering, unique and full-text indexes, index selectivity, `EXPLAIN`, real-world performance tuning and interview questions.

## Why Do We Need Indexes?

Suppose an `employee` table has **10 million rows**:

```sql
SELECT *
FROM employee
WHERE employee_id = 500000;
```

Without an index MySQL reads row 1, row 2, row 3 … row 10,000,000 — a **full table scan**. Very slow.

Think of a book. Without an index you read every page. With one:

```flow-h
Open the index
Find the page
Jump directly there
```

That is exactly how MySQL indexes work.

## What Is an Index?

An index is a **special data structure that helps MySQL locate rows quickly** without scanning the entire table. Indexes speed up `SELECT`, `JOIN`, `WHERE`, `ORDER BY` and `GROUP BY`, and can make queries hundreds or thousands of times faster.

## B-Tree Index

MySQL's default index type is the **B-Tree** (InnoDB actually uses a **B+Tree**: all values live in the leaf pages, which are linked together for fast range scans).

```tree
50
  20
    10
    30
  80
    70
    90
```

Searching for **70**: 50 → 80 → 70, instead of checking every row.

| Without an index | With a B-Tree index |
| --- | --- |
| O(n) — check every row | O(log n) — follow one path from root to leaf |

Real B-Tree nodes hold hundreds of keys each, so even a table with millions of rows is usually only **3–4 levels deep**.

### Creating and Dropping an Index

```sql
CREATE INDEX idx_employee_name ON employee (employee_name);

DROP INDEX idx_employee_name ON employee;
```

## Clustered Index (Primary Index)

In InnoDB, **the primary key is the clustered index**:

```sql
CREATE TABLE employee (
    employee_id   INT PRIMARY KEY,
    employee_name VARCHAR(100)
);
```

Rows are **physically stored in primary-key order** — the leaf pages of the clustered index *are* the table rows. There is only **one** clustered index per table.

> [!NOTE]
> If a table has no primary key, InnoDB uses the first `UNIQUE` index whose columns are all `NOT NULL`; if there is none, it generates a hidden 6-byte row ID (`GEN_CLUST_INDEX`). Always define an explicit primary key.

## Secondary (Non-Clustered) Index

```sql
CREATE INDEX idx_department ON employee (department);
```

The index stores **department + the primary key**. MySQL finds the matching entries, then uses the primary key to fetch the complete row from the clustered index (a "lookup").

```flow-h
Secondary index — department → primary key
: primary key lookup
Clustered index — full row
```

> [!TIP]
> Because every secondary index entry contains the primary key, a **long primary key makes every secondary index bigger**. That's one more reason compact surrogate keys (`BIGINT`) are popular.

## Composite Index

A composite index contains **multiple columns**:

```sql
CREATE INDEX idx_dept_salary ON employee (department, salary);
```

Useful for queries like:

```sql
SELECT *
FROM employee
WHERE department = 'IT'
  AND salary > 70000;
```

### Leftmost Prefix Rule

With the composite index `(department, salary, joining_date)`:

| Query | Uses the index? |
| --- | --- |
| `WHERE department = ...` | ✅ Yes |
| `WHERE department = ... AND salary = ...` | ✅ Yes |
| `WHERE department = ... AND salary = ... AND joining_date = ...` | ✅ Yes — all three columns |
| `WHERE salary = 70000` | ❌ Not efficiently — the leading column `department` is skipped |

An index is sorted by its first column, then the second within it, and so on — like a phone book sorted by surname then first name. You can't look up everyone named "John" without reading the whole book.

> [!NOTE]
> Two refinements:
> - A **range** condition stops the index from being used for seeking on later columns. With `WHERE department = 'IT' AND salary > 70000 AND joining_date = '2024-01-01'`, the index seeks on department and salary; `joining_date` is only checked against the entries found.
> - MySQL 8.0.13+ can sometimes use a **skip scan** for `WHERE salary = 70000` when the leading column has very few distinct values — but don't design around it.

## Unique Index

Prevents duplicate values:

```sql
CREATE UNIQUE INDEX idx_email ON employee (email);
```

Useful for email, PAN, Aadhaar and passport numbers.

## Covering Index

```sql
SELECT department, salary
FROM employee
WHERE department = 'IT';
```

With the index `(department, salary)`, MySQL can answer the query **using only the index**, without reading the table rows. This is a **covering index** — very fast. `EXPLAIN` shows `Using index` in the `Extra` column.

Since InnoDB secondary indexes already contain the primary key, `SELECT employee_id, department, salary ... WHERE department = 'IT'` is covered by the same index too.

## Full-Text Index

Designed for **searching text**:

```sql
CREATE FULLTEXT INDEX idx_description ON product (description);

SELECT *
FROM product
WHERE MATCH(description) AGAINST('Laptop');
```

Better than `LIKE '%Laptop%'` for large text datasets: a leading wildcard can't use a B-Tree index, so `LIKE '%…%'` scans every row.

> [!NOTE]
> Full-text search matches whole **words** (tokens), not arbitrary substrings, ignores stopwords and very short words (InnoDB's default minimum token size is 3), and ranks results by relevance. `IN BOOLEAN MODE` supports operators such as `+laptop -refurbished`.

## When Does MySQL Use an Index?

```sql
SELECT * FROM employee WHERE employee_id = 100;          -- primary key index
SELECT * FROM employee WHERE email = 'abc@gmail.com';    -- unique index
```

### When Might MySQL Ignore an Index?

```sql
SELECT * FROM employee WHERE salary > 0;
```

If almost every row matches, a full table scan is **cheaper** than thousands of index lookups, so the optimizer may skip the index. The optimizer chooses based on cost estimates and statistics.

## EXPLAIN

One of the most important commands for SQL optimization:

```sql
EXPLAIN
SELECT *
FROM employee
WHERE department = 'IT';
```

```output Typical output (simplified)
id  table     type  key             rows  Extra
1   employee  ref   idx_department  200   NULL
```

| Column | Meaning |
| --- | --- |
| `type` | Access method |
| `key` | Index actually used |
| `rows` | Estimated rows examined |
| `Extra` | Additional details (`Using index`, `Using where`, `Using filesort`, `Using temporary`) |

### Understanding `type`

From best to worst:

| Type | Meaning | Performance |
| --- | --- | --- |
| `system` | Table has a single row | Excellent |
| `const` | At most one match via primary/unique key | Excellent |
| `eq_ref` | One row per row of the previous table in a join (PK/unique) | Excellent |
| `ref` | Non-unique index lookup | Good |
| `range` | Index range scan (`BETWEEN`, `>`, `IN`) | Good |
| `index` | Full index scan | Poor |
| `ALL` | Full table scan | Worst |

Aim to avoid `ALL` on large tables whenever possible. `EXPLAIN ANALYZE` (MySQL 8.0.18+) actually runs the query and reports real row counts and timings.

## Index Selectivity

**Selectivity** = distinct values ÷ total rows.

| Column | Distinct values | Selectivity |
| --- | --- | --- |
| Email | Almost every value unique | Excellent — a good index |
| Gender | Male, Female | Poor — a bad index on its own |

A highly selective index narrows the search to a few rows; a poorly selective one still leaves half the table to read.

## Real-World Examples

```sql
-- 1. Customer search
CREATE INDEX idx_customer_name ON customer (customer_name);

-- 2. Login system
CREATE UNIQUE INDEX idx_username ON users (username);

-- 3. Banking transactions — an account's history in date order
CREATE INDEX idx_account_date ON transactions (account_id, transaction_date);

-- 4. E-commerce orders
CREATE INDEX idx_customer_status ON orders (customer_id, order_status);

-- 5. Product search
CREATE FULLTEXT INDEX idx_product_desc ON product (description);
```

## Interview Questions

### Q1. Clustered vs secondary index?

| Clustered | Secondary |
| --- | --- |
| Leaf pages store the actual rows | Stores index entries + the primary key |
| One per table | Many allowed |
| The primary key in InnoDB | Created separately |

### Q2. Why are indexes fast?

Because a B-Tree search is roughly **O(log n)** instead of **O(n)** — and the tree is shallow, so only a few pages are read.

### Q3. What is a composite index?

An index on multiple columns, for example `(department, salary)`. It follows the leftmost-prefix rule.

### Q4. What is a covering index?

An index containing every column a query needs, so MySQL can satisfy the query directly from the index without reading the table.

### Q5. What does EXPLAIN do?

Shows the execution plan — which indexes are used, the access type and the estimated rows — so you can see whether indexes are being used efficiently.

## Common Mistakes

- ❌ **Creating too many indexes** — every index must be updated on `INSERT`, `UPDATE` and `DELETE`; too many indexes slow down writes and use memory.
- ❌ **Indexing low-cardinality columns** — gender, status and yes/no flags usually give little benefit **on their own** (they can still be useful as part of a composite index, or when one value is rare).
- ❌ **Ignoring composite index order** — `(department, salary)` is different from `(salary, department)`. Column order should reflect your most common query patterns.
- ❌ **Wrapping indexed columns in functions** — `WHERE YEAR(order_date) = 2026` prevents normal index use. Rewrite it as a range on the bare column.

```sql
-- Avoid
SELECT * FROM orders WHERE YEAR(order_date) = 2026;

-- Prefer — index-friendly, and correct for DATETIME values too
SELECT *
FROM orders
WHERE order_date >= '2026-01-01'
  AND order_date <  '2027-01-01';
```

> [!WARNING]
> `BETWEEN '2026-01-01' AND '2026-12-31'` looks equivalent, but if `order_date` is a `DATETIME`, the upper bound means `2026-12-31 00:00:00` — **every order placed during 31 December after midnight is missed**. The half-open `>= … AND < …` form is safe for both `DATE` and `DATETIME`.

## Mini Project

Design indexes for this schema:

| Table | Columns |
| --- | --- |
| `customer` | customer_id, email, mobile_number |
| `orders` | order_id, customer_id, order_date, status |
| `employee` | employee_id, department, salary, joining_date |

Tasks:

1. Create a unique index for email.
2. Create a composite index for customer ID + order date.
3. Create an index to optimize department-wise salary queries.
4. Run `EXPLAIN` on a query filtering by department.
5. Check whether the query uses the expected index.

## Practice Problems

**Easy**

1. Create an index.
2. Drop an index.
3. Create a unique index.
4. Create a composite index.
5. Run `EXPLAIN` on a simple query.

**Medium**

1. Design indexes for an `orders` table.
2. Build a covering index.
3. Analyze an execution plan.
4. Improve a slow `WHERE` query.
5. Optimize a multi-column search.

**Interview level**

1. Explain clustered vs secondary indexes.
2. Explain the leftmost-prefix rule.
3. Explain covering indexes with an example.
4. Explain why indexes improve search performance.
5. Identify why a query isn't using an index and propose a solution.

## Best Practices

- ✅ Index columns frequently used in `WHERE`, `JOIN`, `ORDER BY` and `GROUP BY`.
- ✅ Prefer composite indexes when queries commonly filter on multiple columns.
- ✅ Order composite index columns by query patterns and selectivity — equality columns first, range columns last.
- ✅ Remove unused indexes to reduce write overhead.
- ✅ Use `EXPLAIN` before and after adding an index to verify the improvement.

Indexes are critical in banking transaction systems, e-commerce order processing, search APIs, CRM, HRMS, audit logging, reporting, inventory management and Spring Boot + MySQL applications — proper indexing is one of the biggest factors in database scalability.

## Key Takeaways

- ✅ Indexes dramatically improve read performance.
- ✅ MySQL primarily uses B-Tree (B+Tree) indexes.
- ✅ In InnoDB, the primary key is the clustered index; secondary indexes store the primary key.
- ✅ Composite indexes follow the leftmost-prefix rule.
- ✅ Covering indexes can eliminate table lookups.
- ✅ `EXPLAIN` is essential for understanding query execution.
- ✅ Too many indexes hurt write performance.
