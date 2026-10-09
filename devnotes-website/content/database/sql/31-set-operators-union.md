---
title: Set Operators — UNION & UNION ALL
subtitle: UNION vs UNION ALL, the column-count and type rules, output column names, ORDER BY on combined results, source columns, UNION vs JOIN, and INTERSECT / EXCEPT in MySQL.
order: 31
---

## Introduction

Set operators combine the results of multiple queries. Though a relatively small topic, it's frequently asked in SQL interviews and widely used in enterprise reporting.

This chapter covers `UNION`, `UNION ALL` and the difference between them, the rules for using `UNION`, ordering combined results, combining multiple tables, real-world use cases, performance considerations and common interview questions.

## What Is a Set Operator?

A set operator **combines the results of two or more `SELECT` queries into a single result set**.

| Employee name |
| --- |
| John |
| David |

| Manager name |
| --- |
| Alex |
| Lisa |

Combined output: **John, David, Alex, Lisa**.

## UNION

`UNION` combines results and **removes duplicate rows**:

```sql
SELECT employee_name FROM employee
UNION
SELECT manager_name FROM manager;
```

If **employee** contains John and David, and **manager** contains John and Alex:

| UNION result |
| --- |
| John |
| David |
| Alex |

John appears in both tables but only **once** in the result. (`UNION` is shorthand for `UNION DISTINCT`.)

## UNION ALL

`UNION ALL` combines results **without removing duplicates**:

```sql
SELECT employee_name FROM employee
UNION ALL
SELECT manager_name FROM manager;
```

| UNION ALL result |
| --- |
| John |
| David |
| John |
| Alex |

Duplicates remain.

## UNION vs UNION ALL

| Feature | UNION | UNION ALL |
| --- | --- | --- |
| Removes duplicates | Yes | No |
| Keeps duplicates | No | Yes |
| Extra duplicate-elimination work | Yes | No |
| Performance | Usually slower | Usually faster |
| Best for | Unique combined results | Combining all rows |

## Rules for UNION

### Rule 1 — Same Number of Columns

```sql
-- Correct: both queries return 2 columns
SELECT employee_id, employee_name FROM employee
UNION
SELECT customer_id, customer_name FROM customer;

-- Incorrect
SELECT employee_id FROM employee
UNION
SELECT customer_id, customer_name FROM customer;
```

```output Error
ERROR 1222 (21000): The used SELECT statements have a different number of columns
```

### Rule 2 — Compatible Data Types

```sql
SELECT employee_name FROM employee
UNION
SELECT customer_name FROM customer;
```

Both columns hold compatible character data. Corresponding columns should have compatible types — **query 1 column 1 with query 2 column 1, query 1 column 2 with query 2 column 2**, and so on. Columns are matched **by position, not by name**.

> [!NOTE]
> MySQL derives each result column's type from **all** the branches (for example, mixing `INT` and `VARCHAR` gives a string column), so mismatched types may silently convert rather than fail.

### Column Names in UNION Results

The output column names are taken from the **first** `SELECT`:

```sql
SELECT employee_name AS name FROM employee
UNION
SELECT customer_name FROM customer;
```

The output column is `name` — so define meaningful aliases in the first query.

## ORDER BY with UNION

`ORDER BY` is applied **once, to the final combined result**:

```sql
SELECT employee_name AS name FROM employee
UNION
SELECT customer_name FROM customer
ORDER BY name;
```

```flow-h
Query 1, Query 2
UNION
Combined result
ORDER BY
```

> [!NOTE]
> To sort or limit an individual branch, wrap it in parentheses: `(SELECT ... ORDER BY salary DESC LIMIT 5) UNION ALL (SELECT ...)`. An `ORDER BY` inside a branch **without** a `LIMIT` is ignored by the optimizer, because it can't affect the combined result.

## Combining More Than Two Queries

```sql
-- All unique cities across three tables
SELECT city FROM customer
UNION
SELECT city FROM supplier
UNION
SELECT city FROM warehouse;

-- All rows from three yearly tables; duplicates preserved
SELECT * FROM sales_2024
UNION ALL
SELECT * FROM sales_2025
UNION ALL
SELECT * FROM sales_2026;
```

`SELECT *` with set operators only works safely if every table has **identical columns in the same order** — list the columns explicitly in production code.

## Practical Example

**employee**: (1, John), (2, David). **customer**: (101, Lisa), (102, Mary).

```sql
SELECT employee_name AS name FROM employee
UNION
SELECT customer_name FROM customer;
```

| Name |
| --- |
| John |
| David |
| Lisa |
| Mary |

### Adding a Source Column

In enterprise reporting you often need to know **where each row came from**:

```sql
SELECT employee_id   AS id,
       employee_name AS name,
       'EMPLOYEE'    AS source
FROM employee
UNION ALL
SELECT customer_id,
       customer_name,
       'CUSTOMER'
FROM customer;
```

| ID | Name | Source |
| --- | --- | --- |
| 1 | John | EMPLOYEE |
| 2 | David | EMPLOYEE |
| 101 | Lisa | CUSTOMER |
| 102 | Mary | CUSTOMER |

Extremely useful in consolidated reports.

## Real-World Examples

```sql
-- 1. Current + archived orders
SELECT * FROM orders_current
UNION ALL
SELECT * FROM orders_archive;

-- 2. Employee directory: a unique list of people
SELECT employee_name FROM employee
UNION
SELECT contractor_name FROM contractor;

-- 3. Customer email list: unique addresses
SELECT email FROM customer
UNION
SELECT email FROM vendor;

-- 4. Regional sales report
SELECT region, revenue FROM north_sales
UNION ALL
SELECT region, revenue FROM south_sales;
```

> [!WARNING]
> `UNION` removes duplicates by **value**, not identity. In the directory example, two *different* people both called "John Smith" collapse into one row. If rows represent distinct entities, include an identifying column (ID plus a source column) or use `UNION ALL`.

## Performance

```flow-h
Execute query 1
Execute query 2
Combine results
Remove duplicates
Return final result
```

`UNION` needs that extra duplicate-elimination step — MySQL typically builds a temporary table with a unique index to produce distinct rows.

```flow-h
Execute query 1
Execute query 2
Combine results
Return all rows
```

`UNION ALL` skips it, so it's generally **faster** (and since MySQL 5.7 can often stream rows without a temporary table).

### Which One Should You Use?

```flow
? Do I need duplicate elimination? | Yes: UNION | No: UNION ALL
```

Enterprise systems often prefer `UNION ALL` when duplicates are acceptable or impossible, because unnecessary duplicate elimination adds overhead.

## UNION vs JOIN

These are often confused.

**UNION combines results vertically** — table A's rows (John, David) followed by table B's rows (Lisa, Mary) give one column of four rows: John, David, Lisa, Mary.

**JOIN combines related columns horizontally** — employee + department give rows of *employee name | department name*:

```sql
SELECT e.employee_name, d.department_name
FROM employee e
JOIN department d ON e.department_id = d.department_id;
```

| UNION | JOIN |
| --- | --- |
| Combines rows | Combines columns |
| Vertical combination | Horizontal combination |
| Requires compatible result structures | Requires a relationship / join condition |
| Used for similar datasets | Used for related datasets |

## INTERSECT and EXCEPT in MySQL

> [!IMPORTANT]
> MySQL supports `INTERSECT` and `EXCEPT` natively from **MySQL 8.0.31**. On older versions (and for portability), they must be emulated with `EXISTS`, `NOT EXISTS` or joins.

```sql
-- MySQL 8.0.31+
SELECT employee_id FROM employee
INTERSECT
SELECT employee_id FROM manager;

SELECT employee_id FROM employee
EXCEPT
SELECT employee_id FROM manager;
```

### Emulating INTERSECT

`INTERSECT` = rows present in **both** result sets:

```sql
-- Using EXISTS
SELECT e.employee_id
FROM employee e
WHERE EXISTS (
    SELECT 1
    FROM manager m
    WHERE m.employee_id = e.employee_id
);

-- Using INNER JOIN
SELECT DISTINCT e.employee_id
FROM employee e
INNER JOIN manager m ON e.employee_id = m.employee_id;
```

### Emulating EXCEPT

`EXCEPT` = rows in the first result that are **not** in the second:

```sql
SELECT e.employee_id
FROM employee e
WHERE NOT EXISTS (
    SELECT 1
    FROM manager m
    WHERE m.employee_id = e.employee_id
);
```

`NOT EXISTS` is safer than `NOT IN` when the subquery may contain `NULL` values.

## NULL Behavior

`UNION` eliminates duplicates across complete rows, and for this purpose **`NULL`s are treated as equal**:

```sql
SELECT NULL AS value
UNION
SELECT NULL;        -- one row

SELECT NULL AS value
UNION ALL
SELECT NULL;        -- two rows
```

## Interview Questions

### Q1. Difference between UNION and UNION ALL?

| UNION | UNION ALL |
| --- | --- |
| Removes duplicate rows | Keeps duplicate rows |
| Extra duplicate-elimination work | No duplicate elimination |
| Usually slower | Usually faster |

### Q2. Why is UNION ALL faster?

Because it doesn't perform duplicate elimination — it can combine and return rows directly.

### Q3. What are the rules for using UNION?

All participating queries must return the same number of columns, with compatible data types in corresponding positions; use a final `ORDER BY` to sort the combined result.

### Q4. How are columns matched?

By **position**. In `SELECT employee_id, employee_name FROM employee UNION SELECT customer_id, customer_name FROM customer`, `employee_id` maps to `customer_id` and `employee_name` to `customer_name`.

### Q5. Which query determines the output column names?

The **first** `SELECT`. With `SELECT employee_name AS person_name ... UNION SELECT customer_name ...`, the output column is `person_name`.

### Q6. Can UNION combine more than two queries?

Yes:

```sql
SELECT name FROM employee
UNION
SELECT name FROM customer
UNION
SELECT name FROM vendor;
```

### Q7. UNION vs JOIN?

`UNION` combines rows vertically; `JOIN` combines related columns horizontally.

### Q8. When should you use UNION ALL?

When duplicates are acceptable or impossible, when every row must be preserved, or when maximum performance is needed.

### Q9. How do you emulate INTERSECT or EXCEPT in MySQL?

On MySQL 8.0.31+ use them directly. Otherwise emulate `INTERSECT` with `EXISTS` or an inner join plus `DISTINCT`, and `EXCEPT` with `NOT EXISTS` (or a `LEFT JOIN ... WHERE right.key IS NULL`).

## Common Mistakes

- ❌ **Different number of columns** — `SELECT id FROM employee UNION SELECT id, name FROM customer` fails because the result structures don't match.
- ❌ **Wrong column order** — even if MySQL can convert the types, the logical mapping is wrong:

```sql
-- Wrong: names land in the id column and ids in the name column
SELECT employee_id, employee_name FROM employee
UNION
SELECT customer_name, customer_id FROM customer;

-- Correct
SELECT employee_id, employee_name FROM employee
UNION
SELECT customer_id, customer_name FROM customer;
```

- ❌ **Using `UNION` when duplicates don't matter** — `UNION ALL` is usually the better choice.
- ❌ **Assuming `UNION` sorts the final result** — never rely on implicit ordering; if order matters, use `ORDER BY`.
- ❌ **Using `NOT IN` carelessly for `EXCEPT` logic** — if the subquery returns a `NULL`, `NOT IN` returns no rows at all:

```sql
-- Risky
SELECT employee_id
FROM employee
WHERE employee_id NOT IN (SELECT employee_id FROM manager);

-- Safer
SELECT e.employee_id
FROM employee e
WHERE NOT EXISTS (
    SELECT 1 FROM manager m WHERE m.employee_id = e.employee_id
);
```

## Mini Project

Given `employee` (employee_id, name), `contractor` (contractor_id, name) and `customer` (customer_id, name), write queries to:

1. Display all unique people using `UNION`.
2. Display all people including duplicates using `UNION ALL`.
3. List all unique cities from the `customer` and `vendor` tables.
4. Merge current and archived orders.
5. Add a source column identifying where each record came from.
6. Compare the execution plans of `UNION` and `UNION ALL`.

## Practice Problems

**Easy**

1. Combine two employee lists.
2. Use `UNION ALL`.
3. Sort combined results.
4. Remove duplicate names.
5. Combine three tables.

**Medium**

1. Merge yearly sales data.
2. Merge customer and vendor email lists.
3. Create a company directory.
4. Replace `UNION` with `UNION ALL` where appropriate.
5. Add a source column to a combined result.

**Interview level**

1. Explain `UNION` vs `UNION ALL`.
2. Why is `UNION ALL` faster?
3. What are the rules for using `UNION`?
4. Explain `UNION` vs `JOIN`.
5. How would you emulate set intersection or difference in MySQL?

## Best Practices

- ✅ Use `UNION ALL` unless duplicate removal is a business requirement.
- ✅ Make every `SELECT` return the same number of columns, with matching types in the correct logical order.
- ✅ Apply `ORDER BY` to the final combined result.
- ✅ Add a source column when consolidated reports need traceability.
- ✅ Use `NOT EXISTS` for set-difference logic, especially when `NULL`s are possible.
- ✅ Verify execution plans for large set-operation queries.

Set operators are common in data migration, archive reporting, multi-year reports, consolidated dashboards, customer and vendor directories, banking transaction history, enterprise reporting APIs, data reconciliation and combining active with historical datasets.

## Key Takeaways

- ✅ `UNION` combines result sets and removes duplicate rows; `UNION ALL` keeps them and is generally faster.
- ✅ All queries must return the same number of columns with compatible types; columns are matched by position.
- ✅ Output column names come from the first `SELECT`.
- ✅ Use an explicit `ORDER BY` when the final order matters.
- ✅ `UNION` combines rows vertically, while `JOIN` combines related columns horizontally.
- ✅ `INTERSECT` and `EXCEPT` exist from MySQL 8.0.31; otherwise emulate them with `EXISTS` / `NOT EXISTS`.
