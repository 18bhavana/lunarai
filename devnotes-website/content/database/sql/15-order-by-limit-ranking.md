---
title: ORDER BY, LIMIT and Ranking Queries
subtitle: Deterministic sorting, sorting aggregates, LIMIT/OFFSET pagination, custom CASE ordering, Top-N and Nth-highest queries, keyset pagination and Spring Data paging.
order: 15
---

## Introduction

This chapter covers how to sort results, retrieve Top-N records, find highest and lowest values, build leaderboards, paginate large datasets, implement custom business sorting, and choose production pagination strategies — used in almost every backend, from e-commerce and banking to HRMS, search APIs and dashboards.

Questions you'll be able to answer: Who are the top 10 customers? What are the latest 20 transactions? Which employees earn the most? What are the best-selling products? How do we paginate? How do we sort by custom business rules?

## Why Do We Need ORDER BY?

> [!IMPORTANT]
> SQL **does not guarantee the order of rows** unless you explicitly use `ORDER BY`.

`SELECT * FROM employees;` may *appear* to return rows in some order, but never rely on it. For the highest-paid employee, latest orders, best sellers, top customers or recent transactions, you **must** use `ORDER BY`.

### Sample Table

| id | name | department | salary |
| --- | --- | --- | --- |
| 1 | John | IT | 70000 |
| 2 | David | IT | 90000 |
| 3 | Lisa | HR | 50000 |
| 4 | Alex | HR | 55000 |
| 5 | Mary | Finance | 80000 |
| 6 | Tom | Finance | 85000 |

## ORDER BY Syntax

```sql
SELECT column_list
FROM table_name
ORDER BY column_name;
```

The default direction is `ASC`, so `ORDER BY salary` = `ORDER BY salary ASC`.

### Ascending (ASC)

Small → large, A → Z, oldest → newest.

```sql
SELECT *
FROM employees
ORDER BY salary ASC;
```

```output
Lisa  50000
Alex  55000
John  70000
Mary  80000
Tom   85000
David 90000
```

### Descending (DESC)

Large → small, Z → A, newest → oldest.

```sql
SELECT *
FROM employees
ORDER BY salary DESC;
```

```output
David 90000
Tom   85000
Mary  80000
John  70000
Alex  55000
Lisa  50000
```

## Sorting by Multiple Columns

Departments alphabetically, and employees within each department by highest salary:

```sql
SELECT *
FROM employees
ORDER BY department ASC,
         salary DESC;
```

```tree
Result
  Finance | highest salary first
  HR | highest salary first
  IT | highest salary first
```

SQL evaluates sort columns **left to right**: first `department ASC`, then `salary DESC` among rows with the same department.

## Deterministic Sorting

| id | name | salary |
| --- | --- | --- |
| 1 | Rahul | 90000 |
| 2 | Amit | 90000 |

With `ORDER BY salary DESC`, both rows have the same sort value — **their relative order isn't guaranteed**. For stable, deterministic ordering, add a **unique tie-breaker**:

```sql
SELECT *
FROM employees
ORDER BY salary DESC,
         id ASC;
```

`salary` is the primary sort; `id` is the tie-breaker. Especially important for **pagination, APIs, infinite scrolling and batch processing**.

## ORDER BY Column Position

```sql
SELECT name, department, salary
FROM employees
ORDER BY 3 DESC;          -- 3 = third selected column (salary)
```

Valid, but less readable. Prefer `ORDER BY salary DESC` — if the `SELECT` column order changes, positional sorting silently changes its meaning.

## ORDER BY Aggregate Results

Departments ordered by total salary:

```sql
SELECT department,
       SUM(salary) AS total_salary
FROM employees
GROUP BY department
ORDER BY total_salary DESC;
```

| Department | Total salary |
| --- | --- |
| Finance | 165000 |
| IT | 160000 |
| HR | 105000 |

You can sort by the expression directly (`ORDER BY SUM(salary) DESC`), but aliases are easier to read.

## LIMIT

`LIMIT` restricts the number of rows returned:

```sql
SELECT *
FROM employees
LIMIT 3;
```

> [!WARNING]
> `LIMIT` without `ORDER BY` doesn't mean "top three" or "latest three" — just *some* three rows, with no guaranteed logical order.

```sql
-- Top 3 highest salaries: David 90000, Tom 85000, Mary 80000
SELECT *
FROM employees
ORDER BY salary DESC
LIMIT 3;

-- Lowest 2 salaries
SELECT *
FROM employees
ORDER BY salary ASC
LIMIT 2;
```

## LIMIT with OFFSET

`OFFSET` tells MySQL how many rows to **skip**:

```sql
SELECT *
FROM employees
ORDER BY id
LIMIT 5 OFFSET 10;      -- skip the first 10 rows, return the next 5
```

MySQL also supports `LIMIT offset, row_count` — so `LIMIT 10, 5` means skip 10, return 5. For readability, many developers prefer `LIMIT 5 OFFSET 10`.

## Pagination

With a page size of 5:

```sql
SELECT * FROM employees ORDER BY id LIMIT 5 OFFSET 0;    -- page 1
SELECT * FROM employees ORDER BY id LIMIT 5 OFFSET 5;    -- page 2
SELECT * FROM employees ORDER BY id LIMIT 5 OFFSET 10;   -- page 3
```

> [!IMPORTANT]
> **OFFSET = (page number − 1) × page size.** For page 4 with size 10: (4 − 1) × 10 = **30** → `LIMIT 10 OFFSET 30`.

### Always Use Deterministic Ordering

```sql
-- ❌ Risky if many rows share the same created_at
SELECT *
FROM orders
ORDER BY created_at DESC
LIMIT 20 OFFSET 20;

-- ✅ The unique order_id is the tie-breaker
SELECT *
FROM orders
ORDER BY created_at DESC,
         order_id DESC
LIMIT 20 OFFSET 20;
```

## Real-World Examples

```sql
-- 1. Latest orders
SELECT *
FROM orders
ORDER BY order_date DESC, order_id DESC
LIMIT 10;

-- 2. Top customers by revenue
SELECT customer_id, SUM(total_amount) AS revenue
FROM orders
GROUP BY customer_id
ORDER BY revenue DESC
LIMIT 5;

-- 3. Best-selling products
SELECT product_id, SUM(quantity) AS total_sold
FROM sales
GROUP BY product_id
ORDER BY total_sold DESC
LIMIT 10;

-- 4. Highest-paid employees
SELECT *
FROM employees
ORDER BY salary DESC, id ASC
LIMIT 5;

-- 5. Recent transactions
SELECT *
FROM transactions
ORDER BY transaction_time DESC, transaction_id DESC
LIMIT 20;
```

### ORDER BY Multiple Aggregates

```sql
SELECT department,
       COUNT(*)    AS employee_count,
       AVG(salary) AS average_salary
FROM employees
GROUP BY department
ORDER BY average_salary DESC,
         employee_count DESC;
```

Highest average salary first; if equal, the department with more employees first.

## ORDER BY with CASE

`CASE` implements **custom business sorting** — IT first, Finance second, everything else last, and highest salary first within each priority:

```sql
SELECT *
FROM employees
ORDER BY CASE
             WHEN department = 'IT'      THEN 1
             WHEN department = 'Finance' THEN 2
             ELSE 3
         END,
         salary DESC;
```

Order statuses shown as URGENT → PROCESSING → PENDING → COMPLETED → CANCELLED:

```sql
SELECT *
FROM orders
ORDER BY CASE status
             WHEN 'URGENT'     THEN 1
             WHEN 'PROCESSING' THEN 2
             WHEN 'PENDING'    THEN 3
             WHEN 'COMPLETED'  THEN 4
             WHEN 'CANCELLED'  THEN 5
             ELSE 6
         END,
         created_at DESC;
```

## Top-N Queries

```sql
-- Highest-paid employee
SELECT * FROM employees ORDER BY salary DESC LIMIT 1;

-- Top 3 highest-paid employees
SELECT * FROM employees ORDER BY salary DESC LIMIT 3;

-- Top 5 customers by revenue
SELECT customer_id, SUM(total_amount) AS revenue
FROM orders
GROUP BY customer_id
ORDER BY revenue DESC
LIMIT 5;
```

### Top-N Rows vs Top-N Distinct Values

With salaries 100000, 90000, 90000, 80000:

```sql
SELECT *
FROM employees
ORDER BY salary DESC
LIMIT 2;                  -- two employee rows: 100000, 90000

SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 2;                  -- two distinct values: 100000, 90000
```

These are different requirements. Always clarify: **do you need the top N rows or the top N distinct values?**

## Second and Nth Highest Salary

### Second Highest Distinct Salary

```sql
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 1;
```

**Why `DISTINCT`?** With 100000, 90000, 90000, 80000, the query without `DISTINCT` happens to work for second place. But if the **highest** salary is duplicated (100000, 100000, 90000), `ORDER BY salary DESC LIMIT 1 OFFSET 1` returns **100000** — not the second-highest distinct salary. `DISTINCT` matters whenever the requirement is about distinct values.

### Nth Highest Distinct Salary

General pattern: **OFFSET = N − 1**. Fifth-highest distinct salary:

```sql
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 4;
```

> [!NOTE]
> MySQL's `LIMIT`/`OFFSET` accept only constants or `?` placeholders — not expressions like `N - 1`. For a dynamic N, compute the offset in the application (bound parameter) or use a window function such as `DENSE_RANK()`.

## Keyset Pagination

`OFFSET` pagination is simple:

```sql
SELECT *
FROM orders
ORDER BY order_id DESC
LIMIT 20 OFFSET 500000;
```

But for large offsets, the database still has to process and **skip** all those earlier rows. For large datasets, **keyset pagination** (also called **seek pagination**) is often far more efficient.

### Basic Keyset Pagination

```sql
-- First page
SELECT *
FROM orders
ORDER BY order_id DESC
LIMIT 20;

-- The last returned ID was 9500, so the next page is:
SELECT *
FROM orders
WHERE order_id < 9500
ORDER BY order_id DESC
LIMIT 20;
```

Instead of *"skip 500,000 rows"*, we say *"continue after the last seen record"* — and an index on `order_id` takes MySQL straight there.

### Keyset Pagination with Multiple Sort Columns

With `ORDER BY created_at DESC, order_id DESC`, the next page continues using **both** values:

```sql
SELECT *
FROM orders
WHERE created_at < :lastCreatedAt
   OR (created_at = :lastCreatedAt AND order_id < :lastOrderId)
ORDER BY created_at DESC,
         order_id DESC
LIMIT 20;
```

This preserves the same ordering used by the query. (MySQL also accepts the row-constructor form `WHERE (created_at, order_id) < (:lastCreatedAt, :lastOrderId)`.)

### OFFSET vs Keyset Pagination

| OFFSET pagination | Keyset pagination |
| --- | --- |
| Easy to implement | More complex |
| Supports jumping directly to page numbers | Usually next/previous navigation |
| Can become slow for very large offsets | Efficient for deep pagination |
| Pages can shift when rows are inserted or deleted | More stable for continuously changing data |
| Common in admin tables | Common in feeds and infinite scrolling |

## Spring Boot Pagination

```java
Pageable pageable = PageRequest.of(page, size);

Pageable pageable = PageRequest.of(page, size, Sort.by("salary").descending());

Page<Employee> findAll(Pageable pageable);
```

Spring Data page numbers are **zero-based** — page 0 is the first page, page 1 the second.

### Multiple Sort Fields

```java
Sort sort = Sort.by(
        Sort.Order.desc("salary"),
        Sort.Order.asc("id"));

Pageable pageable = PageRequest.of(page, size, sort);
```

Conceptually `ORDER BY salary DESC, id ASC` — the unique ID is again a deterministic tie-breaker.

> [!TIP]
> Returning `Page<T>` makes Spring Data run an extra `COUNT(*)` query for the total; return `Slice<T>` when you only need "is there a next page?".

## Interview Questions

### Q1. Find the top three highest-paid employees.

```sql
SELECT *
FROM employees
ORDER BY salary DESC
LIMIT 3;
```

### Q2. Find the latest ten orders.

```sql
SELECT *
FROM orders
ORDER BY order_date DESC, order_id DESC
LIMIT 10;
```

### Q3. Find the department with the highest total salary.

```sql
SELECT department, SUM(salary) AS total_salary
FROM employees
GROUP BY department
ORDER BY total_salary DESC
LIMIT 1;
```

### Q4. Display employees alphabetically.

```sql
SELECT *
FROM employees
ORDER BY name ASC;
```

### Q5. Find the second-highest distinct salary.

```sql
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 1;
```

### Q6. Find the fifth-highest distinct salary.

```sql
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 4;
```

### Q7. What is the difference between LIMIT and OFFSET?

`LIMIT` sets how many rows to return; `OFFSET` sets how many rows to skip first.

### Q8. Why can large OFFSET values be slow?

Because the database still has to produce and discard all the earlier rows before returning the requested page.

### Q9. What is keyset pagination?

Instead of skipping N rows, the query continues from the last seen sort value(s) — e.g. `WHERE order_id < :lastId ORDER BY order_id DESC LIMIT 20`.

### Q10. Why should pagination have deterministic ordering?

Without a unique tie-breaker, rows with equal sort values can move between pages, appear twice or be skipped.

## Common Mistakes

### Mistake 1 — LIMIT Without ORDER BY

`SELECT * FROM employees LIMIT 5;` doesn't mean "top 5" or "latest 5" — there's no guaranteed order. Use `ORDER BY id LIMIT 5` (or whatever order you actually need).

### Mistake 2 — Forgetting DESC

`ORDER BY salary LIMIT 3` returns the three **lowest** salaries, because the default is `ASC`. For the highest, use `ORDER BY salary DESC LIMIT 3`.

### Mistake 3 — Non-Deterministic Pagination

`ORDER BY created_at DESC LIMIT 20 OFFSET 20` is risky when many rows share `created_at`. Add `order_id DESC` as a tie-breaker.

### Mistake 4 — Huge OFFSET Values

`ORDER BY order_date DESC LIMIT 20 OFFSET 500000` can be expensive on large tables. Consider keyset pagination for deep sequential navigation.

### Mistake 5 — Confusing Top-N Rows with Top-N Distinct Values

`ORDER BY salary DESC LIMIT 3` returns three employee rows; `SELECT DISTINCT salary ... LIMIT 3` returns three distinct salary values.

### Mistake 6 — Assuming an Index Always Eliminates Sorting

An index *can* let MySQL satisfy `ORDER BY` without a separate sort, but that depends on the index column order, sort directions, filtering conditions, query structure and the chosen plan. Verify with `EXPLAIN` (look for `Using filesort` in `Extra`).

## Mini Project

| Customer | Amount | Order date |
| --- | --- | --- |
| A | 50000 | 2026-01-01 |
| B | 20000 | 2026-01-02 |
| A | 25000 | 2026-01-03 |
| C | 70000 | 2026-01-04 |
| B | 30000 | 2026-01-05 |
| A | 10000 | 2026-01-06 |

```sql
-- 1. Latest three orders
SELECT *
FROM orders
ORDER BY order_date DESC
LIMIT 3;

-- 2. Top two customers by total spending
SELECT customer, SUM(amount) AS total_spending
FROM orders
GROUP BY customer
ORDER BY total_spending DESC
LIMIT 2;

-- 3. Customers sorted by total spending
SELECT customer, SUM(amount) AS total_spending
FROM orders
GROUP BY customer
ORDER BY total_spending DESC;

-- 4. Five highest-value orders
SELECT *
FROM orders
ORDER BY amount DESC
LIMIT 5;

-- 5. Page 4 with page size 10: OFFSET = (4 - 1) × 10 = 30
SELECT *
FROM orders
ORDER BY order_date DESC, order_id DESC
LIMIT 10 OFFSET 30;
```

## Practice Problems

**Easy**

1. Sort employees by salary.
2. Sort employees alphabetically.
3. Display the latest five orders.
4. Display the lowest three salaries.
5. Sort departments alphabetically.

**Medium**

1. Find the top five customers by revenue.
2. Display monthly revenue in descending order.
3. Find the top ten products by quantity sold.
4. Display employees ordered by department and salary.
5. Implement pagination using `LIMIT` and `OFFSET`.

**Interview level**

1. Find the second-highest distinct salary.
2. Find the fifth-highest distinct salary.
3. Display the top three departments by average salary.
4. Find the latest order for every customer.
5. Build a leaderboard showing the top ten customers by revenue.
6. Implement keyset pagination using `created_at` and `id`.
7. Explain the difference between Top-N rows and Top-N distinct values.

> [!NOTE]
> "Latest order for every customer" is a **group-wise Top-N** problem — solved with window functions, subqueries or join-based approaches. The cleanest modern solution is covered in the window functions chapter.

## Best Practices

- ✅ Always use `ORDER BY` when the result needs a defined order.
- ✅ Combine `LIMIT` with a deterministic `ORDER BY`, adding a unique tie-breaker for stable pagination.
- ✅ Use aliases in `ORDER BY` for readable aggregate queries; prefer column names over positions.
- ✅ Paginate instead of loading entire large datasets, and be careful with very large `OFFSET` values.
- ✅ Consider keyset pagination for deep sequential navigation.
- ✅ Know Top-N rows vs Top-N distinct values.
- ✅ Use `EXPLAIN` to verify whether indexes help sorting, and design indexes for real filter/sort patterns.

## Real Backend Example

`GET /api/transactions?page=0&size=20`:

```sql
SELECT transaction_id, account_id, amount, transaction_time
FROM transactions
WHERE account_id = ?
ORDER BY transaction_time DESC, transaction_id DESC
LIMIT 20 OFFSET 0;
```

For a high-volume infinite-scroll API, keyset pagination instead:

```sql
SELECT transaction_id, account_id, amount, transaction_time
FROM transactions
WHERE account_id = ?
  AND (transaction_time < :lastTransactionTime
       OR (transaction_time = :lastTransactionTime
           AND transaction_id < :lastTransactionId))
ORDER BY transaction_time DESC, transaction_id DESC
LIMIT 20;
```

Widely used in transaction history, activity feeds, audit logs, infinite scrolling and large event streams.

## Cheat Sheet

| Goal | Pattern |
| --- | --- |
| Sort | `ORDER BY salary ASC` / `DESC` |
| Multiple columns | `ORDER BY department ASC, salary DESC` |
| Deterministic | `ORDER BY salary DESC, id ASC` |
| Top-N | `ORDER BY salary DESC LIMIT 5` |
| Page-based pagination | `ORDER BY id LIMIT 10 OFFSET 20` — OFFSET = (page − 1) × size |
| Second-highest distinct | `SELECT DISTINCT salary ... ORDER BY salary DESC LIMIT 1 OFFSET 1` |
| Aggregate sorting | `GROUP BY customer_id ORDER BY revenue DESC LIMIT 5` |
| Custom sorting | `ORDER BY CASE ... END, salary DESC` |
| Keyset pagination | `WHERE order_id < :lastOrderId ORDER BY order_id DESC LIMIT 20` |

| Combination | Use |
| --- | --- |
| `ORDER BY` + `LIMIT` | Top-N queries |
| `ORDER BY` + `LIMIT` + `OFFSET` | Page-based pagination |
| Keyset condition + `ORDER BY` + `LIMIT` | Efficient sequential pagination |

**Interview tips:** SQL doesn't guarantee row order without `ORDER BY`; `ASC` is the default; always know how ties are handled; large offsets get expensive; `DISTINCT` matters for the Nth-highest distinct value; Top-N per group differs from global Top-N — window functions solve ranking and group-wise Top-N cleanly.
