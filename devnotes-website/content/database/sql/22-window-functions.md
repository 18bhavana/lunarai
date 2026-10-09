---
title: Window Functions
subtitle: OVER(), PARTITION BY and ORDER BY in windows, ROW_NUMBER vs RANK vs DENSE_RANK, Top-N per group, department aggregates beside every row, running totals and window frames, and filtering window results.
order: 22
---

## Introduction

**Window functions** are one of the most powerful SQL features in **MySQL 8.0+** and one of the most frequently tested topics in SQL interviews. If you understand them well, many difficult SQL problems become much easier.

You'll learn `OVER()`, `PARTITION BY`, `ORDER BY` inside window functions, `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, window functions vs `GROUP BY`, Top-N per group, running totals, enterprise analytics queries and performance considerations.

## What is a Window Function?

> [!IMPORTANT]
> A **window function** performs a calculation across a set of related rows **while preserving every individual row** in the result.

That's the biggest difference from `GROUP BY`:

```flow
GROUP BY
Multiple rows
Grouped together
One row per group
---
Window function
Multiple rows
Calculation per window
Every original row preserved
```

## GROUP BY Example

| Employee ID | Name | Department | Salary |
| --- | --- | --- | --- |
| 101 | John | IT | 70000 |
| 102 | David | IT | 90000 |
| 103 | Lisa | HR | 50000 |
| 104 | Alex | HR | 55000 |
| 105 | Mary | Finance | 80000 |
| 106 | Tom | Finance | 85000 |

```sql
SELECT department,
       AVG(salary) AS avg_salary
FROM employee
GROUP BY department;
```

| Department | Avg salary |
| --- | --- |
| IT | 80000 |
| HR | 52500 |
| Finance | 82500 |

The individual employee rows **disappear** — we get one row per department.

## Window Function Example

Show each employee's name, department, salary **and** their department's average salary:

```sql
SELECT name,
       department,
       salary,
       AVG(salary) OVER (PARTITION BY department) AS department_average
FROM employee;
```

| Name | Department | Salary | Department average |
| --- | --- | --- | --- |
| John | IT | 70000 | 80000 |
| David | IT | 90000 | 80000 |
| Lisa | HR | 50000 | 52500 |
| Alex | HR | 55000 | 52500 |
| Mary | Finance | 80000 | 82500 |
| Tom | Finance | 85000 | 82500 |

**Every employee row is preserved** — this is the power of window functions.

## GROUP BY vs Window Functions

| GROUP BY | Window functions |
| --- | --- |
| Reduces rows | Preserves rows |
| One row per group | Every original row |
| Grouped summaries | Analytics |
| Can't directly show row details next to aggregates | Shows row details and aggregate results together |
| Uses `GROUP BY` | Uses `OVER()` |
| Excellent for summary reports | Excellent for ranking and analytics |

> [!TIP]
> **One-liner:** `GROUP BY` collapses rows into groups; window functions calculate across related rows **without collapsing** them.

## What is OVER()?

`OVER()` tells SQL that a function should operate as a **window function**: `FUNCTION() OVER (...)`.

```sql
AVG(salary) OVER ()
SUM(amount) OVER ()
ROW_NUMBER() OVER (ORDER BY salary DESC)
RANK()       OVER (ORDER BY salary DESC)
DENSE_RANK() OVER (ORDER BY salary DESC)
```

### Aggregate Without vs With OVER()

```sql
SELECT AVG(salary) FROM employee;        -- one row: the company average
```

```sql
SELECT name,
       salary,
       AVG(salary) OVER () AS company_average
FROM employee;
```

| Name | Salary | Company average |
| --- | --- | --- |
| John | 70000 | 71666.67 |
| David | 90000 | 71666.67 |
| Lisa | 50000 | 71666.67 |
| Alex | 55000 | 71666.67 |
| Mary | 80000 | 71666.67 |
| Tom | 85000 | 71666.67 |

The average is calculated across all employees, but every row remains visible. With **no `PARTITION BY`, the entire result set is one window.**

## What is PARTITION BY?

`PARTITION BY` divides rows into logical groups called **partitions** — think of it as a *virtual `GROUP BY`* that **doesn't collapse rows**.

```buckets The window calculation runs independently inside each partition
IT: John, David
HR: Lisa, Alex
Finance: Mary, Tom
```

| `GROUP BY department` | `PARTITION BY department` |
| --- | --- |
| 3 departments → **3 rows** | 6 employees → **6 rows preserved** |

## ORDER BY Inside a Window

`ORDER BY` determines the **sequence of rows inside the window**:

```sql
SELECT name,
       salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_num
FROM employee;
```

The database logically orders employees from highest to lowest salary, then assigns row numbers.

## ROW_NUMBER()

Assigns a **unique sequential number** to every row: `ROW_NUMBER() OVER (ORDER BY column)`.

| Name | Salary | Row number |
| --- | --- | --- |
| David | 90000 | 1 |
| Tom | 85000 | 2 |
| Mary | 80000 | 3 |
| John | 70000 | 4 |
| Alex | 55000 | 5 |
| Lisa | 50000 | 6 |

### ROW_NUMBER() Never Repeats

Even if Tom and Mary both earned 85000, they'd get **different** numbers (2 and 3). `ROW_NUMBER()` never gives the same number to two rows.

### Deterministic ROW_NUMBER()

`ROW_NUMBER() OVER (ORDER BY salary DESC)` doesn't define which **tied** employee comes first. Add a tie-breaker:

```sql
ROW_NUMBER() OVER (ORDER BY salary DESC, employee_id ASC)
```

Highest salary first; if salaries are equal, lowest `employee_id` first.

> [!TIP]
> When using `ROW_NUMBER()` in production logic, include a deterministic tie-breaker whenever duplicate ordering values are possible.

### ROW_NUMBER() with PARTITION BY

Rank employees independently inside each department:

```sql
SELECT name,
       department,
       salary,
       ROW_NUMBER() OVER (
           PARTITION BY department
           ORDER BY salary DESC
       ) AS row_num
FROM employee;
```

| Name | Department | Salary | Row number |
| --- | --- | --- | --- |
| Tom | Finance | 85000 | 1 |
| Mary | Finance | 80000 | 2 |
| Alex | HR | 55000 | 1 |
| Lisa | HR | 50000 | 2 |
| David | IT | 90000 | 1 |
| John | IT | 70000 | 2 |

`PARTITION BY` **resets** the numbering for each department.

```flow-h Mental model
PARTITION BY department — separate departments
ORDER BY salary DESC — sort inside each
ROW_NUMBER() — 1, 2, 3… inside each
```

## RANK()

`RANK()` lets tied rows share a rank — but **skips ranks after a tie**. With David 90000, Tom 85000, Mary 85000, John 70000:

```sql
SELECT name,
       salary,
       RANK() OVER (ORDER BY salary DESC) AS rank_no
FROM employee;
```

| Name | Salary | Rank |
| --- | --- | --- |
| David | 90000 | 1 |
| Tom | 85000 | 2 |
| Mary | 85000 | 2 |
| John | 70000 | 4 |

**Rank 3 is skipped.** Think of a competition: two people share 2nd place, so the next person is 4th — **competition ranking**.

## DENSE_RANK()

`DENSE_RANK()` also gives tied values the same rank, but **doesn't skip** ranks:

```sql
SELECT name,
       salary,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS rank_no
FROM employee;
```

| Name | Salary | Dense rank |
| --- | --- | --- |
| David | 90000 | 1 |
| Tom | 85000 | 2 |
| Mary | 85000 | 2 |
| John | 70000 | 3 |

## ROW_NUMBER() vs RANK() vs DENSE_RANK()

One of the most common SQL interview questions.

| Salary | ROW_NUMBER | RANK | DENSE_RANK |
| --- | --- | --- | --- |
| 90000 | 1 | 1 | 1 |
| 85000 | 2 | 2 | 2 |
| 85000 | 3 | 2 | 2 |
| 70000 | 4 | 4 | 3 |

| Function | Ties | Gaps | Use when |
| --- | --- | --- | --- |
| `ROW_NUMBER()` | Different numbers | — | Every row needs a unique number; exactly one row per group; removing duplicates; pagination; deterministic Top-N rows |
| `RANK()` | Same rank | Skipped | Competition-style ranking where gaps are acceptable |
| `DENSE_RANK()` | Same rank | Not skipped | Ties share a position without gaps; the **Nth distinct value** |

> [!TIP]
> **Shortcut:** unique numbering → `ROW_NUMBER()`; ties + gaps → `RANK()`; ties + no gaps → `DENSE_RANK()`.

## Highest-Paid Employee Per Department

One of the most common interview problems:

```sql
WITH ranked_employees AS (
    SELECT e.*,
           ROW_NUMBER() OVER (
               PARTITION BY department
               ORDER BY salary DESC
           ) AS rn
    FROM employee e
)
SELECT *
FROM ranked_employees
WHERE rn = 1;
```

| Name | Department | Salary |
| --- | --- | --- |
| Tom | Finance | 85000 |
| Alex | HR | 55000 |
| David | IT | 90000 |

```flow-h How it works
Partition by department
Sort by salary DESC
Number rows
Keep rn = 1
```

### ROW_NUMBER() and Ties

If two employees share a department's highest salary, `WHERE rn = 1` returns only **one** of them. To return **all** tied employees, use `RANK()` or `DENSE_RANK()`:

```sql
WITH ranked_employees AS (
    SELECT e.*,
           DENSE_RANK() OVER (
               PARTITION BY department
               ORDER BY salary DESC
           ) AS salary_rank
    FROM employee e
)
SELECT *
FROM ranked_employees
WHERE salary_rank = 1;
```

## Top-N Per Group

Top 3 employees per department:

```sql
WITH ranked_employees AS (
    SELECT e.*,
           ROW_NUMBER() OVER (
               PARTITION BY department
               ORDER BY salary DESC
           ) AS rn
    FROM employee e
)
SELECT *
FROM ranked_employees
WHERE rn <= 3;
```

This is **Top-N per group** — one of the most important window-function patterns. Memorize the template:

```sql
WITH ranked_data AS (
    SELECT t.*,
           ROW_NUMBER() OVER (
               PARTITION BY group_column
               ORDER BY ranking_column DESC
           ) AS rn
    FROM table_name t
)
SELECT *
FROM ranked_data
WHERE rn <= N;
```

Examples: top 3 employees per department, top 5 products per category, top 10 customers per region, latest transaction per account, most recent order per customer.

### Second-Highest Salary in Each Department

```sql
WITH ranked_employees AS (
    SELECT e.*,
           DENSE_RANK() OVER (
               PARTITION BY department
               ORDER BY salary DESC
           ) AS salary_rank
    FROM employee e
)
SELECT *
FROM ranked_employees
WHERE salary_rank = 2;
```

**Why `DENSE_RANK()`?** The requirement usually means the second-highest **distinct** salary — and if several employees earn it, all of them should be returned.

### Lowest-Paid Employee Per Department

Same pattern with `ORDER BY salary ASC` and `WHERE rn = 1`.

## Aggregates Beside Every Row

```sql
-- Department average beside every employee
SELECT name, department, salary,
       AVG(salary) OVER (PARTITION BY department) AS department_average
FROM employee;

-- Salary vs department average
SELECT name, department, salary,
       AVG(salary) OVER (PARTITION BY department)          AS department_average,
       salary - AVG(salary) OVER (PARTITION BY department) AS difference_from_average
FROM employee;

-- Department payroll
SELECT name, department, salary,
       SUM(salary) OVER (PARTITION BY department) AS department_payroll
FROM employee;

-- Company average and company payroll (no PARTITION BY = one window)
SELECT name, salary,
       AVG(salary) OVER () AS company_average,
       SUM(salary) OVER () AS company_payroll
FROM employee;
```

Compare each employee with their department without losing employee-level detail — very useful in payroll analysis, performance reports and compensation analytics.

## Running Totals

| Order date | Amount |
| --- | --- |
| 2026-01-01 | 1000 |
| 2026-01-02 | 2000 |
| 2026-01-03 | 1500 |

```sql
SELECT order_date,
       amount,
       SUM(amount) OVER (
           ORDER BY order_date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_total
FROM orders;
```

| Date | Amount | Running total |
| --- | --- | --- |
| 2026-01-01 | 1000 | 1000 |
| 2026-01-02 | 2000 | 3000 |
| 2026-01-03 | 1500 | 4500 |

Row 1 = 1000; row 2 = 1000 + 2000 = 3000; row 3 = 1000 + 2000 + 1500 = 4500 — the window **expands** from the first row to the current row.

### Why Specify ROWS Explicitly?

`SUM(amount) OVER (ORDER BY order_date)` uses the **default frame** `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which treats rows with the **same `order_date` as peers** — they're added together and all get the same running total. For predictable row-by-row totals, write the `ROWS` frame explicitly and add a unique tie-breaker:

```sql
SUM(amount) OVER (
    ORDER BY order_date, order_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
```

### Running Total Per Customer

```sql
SELECT customer_id,
       order_date,
       amount,
       SUM(amount) OVER (
           PARTITION BY customer_id
           ORDER BY order_date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS customer_running_total
FROM orders;
```

The running total **resets for each customer**.

## Real-World Examples

### Top Salesperson Per Region

```sql
WITH sales_rank AS (
    SELECT s.*,
           ROW_NUMBER() OVER (PARTITION BY region ORDER BY sales DESC) AS rn
    FROM sales s
)
SELECT *
FROM sales_rank
WHERE rn = 1;
```

### Top Five Customers

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
),
ranked_customers AS (
    SELECT customer_id,
           revenue,
           RANK() OVER (ORDER BY revenue DESC) AS customer_rank
    FROM customer_revenue
)
SELECT *
FROM ranked_customers
WHERE customer_rank <= 5;
```

Step 1 aggregates revenue, step 2 ranks customers, step 3 filters the top 5.

### Product Leaderboard

```sql
WITH product_sales AS (
    SELECT product_id, SUM(quantity) AS total_sold
    FROM sales
    GROUP BY product_id
)
SELECT product_id,
       total_sold,
       DENSE_RANK() OVER (ORDER BY total_sold DESC) AS product_rank
FROM product_sales;
```

Products with equal sales get the same rank, with no gaps.

### Daily Revenue Running Total

If several orders exist on the same day, **aggregate daily revenue first**:

```sql
WITH daily_revenue AS (
    SELECT order_date, SUM(amount) AS daily_revenue
    FROM orders
    GROUP BY order_date
)
SELECT order_date,
       daily_revenue,
       SUM(daily_revenue) OVER (
           ORDER BY order_date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_revenue
FROM daily_revenue;
```

## Filtering Window Function Results

```sql
SELECT *,
       ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
FROM employee
WHERE rn = 1;          -- ❌ doesn't work
```

`WHERE` is logically evaluated **before** window functions run, so `rn` doesn't exist yet. Use a **CTE** (the standard pattern) or a **derived table**:

```sql
WITH ranked_employees AS (
    SELECT e.*,
           ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
    FROM employee e
)
SELECT * FROM ranked_employees WHERE rn = 1;

SELECT *
FROM (
    SELECT e.*,
           ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
    FROM employee e
) ranked_employees
WHERE rn = 1;
```

Both are valid; the CTE is often easier to read.

## Window ORDER BY vs Final ORDER BY

| Window `ORDER BY` | Final `ORDER BY` |
| --- | --- |
| `ROW_NUMBER() OVER (ORDER BY salary DESC)` | `ORDER BY department, salary DESC` |
| Determines how the window function calculates | Determines how the final result is displayed |

> [!WARNING]
> The `ORDER BY` inside `OVER()` does **not** guarantee the final display order. Add a final `ORDER BY` when output ordering matters.

## Performance Considerations

Window functions are often cleaner than correlated subqueries, self joins and deeply nested queries — but they may need **sorting, partitioning and temporary work areas**. Performance depends on the number of rows and partitions, sort columns, indexes, memory and the execution plan.

### Indexing

For `ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC)`, a potentially useful index is:

```sql
CREATE INDEX idx_employee_department_salary
    ON employee (department, salary DESC);
```

An index doesn't guarantee MySQL avoids sorting for every window query — inspect the plan with `EXPLAIN` / `EXPLAIN ANALYZE`.

## Interview Questions

### Q1. Highest-paid employee per department.

```sql
WITH ranked AS (
    SELECT e.*,
           ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn
    FROM employee e
)
SELECT * FROM ranked WHERE rn = 1;
```

### Q2. Display each employee's rank by salary.

```sql
SELECT name, salary,
       RANK() OVER (ORDER BY salary DESC) AS salary_rank
FROM employee;
```

### Q3. Display dense salary ranks.

```sql
SELECT name, salary,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS salary_rank
FROM employee;
```

### Q4. Calculate department payroll beside each employee.

```sql
SELECT name, department, salary,
       SUM(salary) OVER (PARTITION BY department) AS department_payroll
FROM employee;
```

### Q5. Display running revenue.

```sql
SELECT order_date, amount,
       SUM(amount) OVER (
           ORDER BY order_date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_revenue
FROM orders;
```

### Q6. Second-highest salary per department.

```sql
WITH ranked_employees AS (
    SELECT e.*,
           DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS salary_rank
    FROM employee e
)
SELECT * FROM ranked_employees WHERE salary_rank = 2;
```

### Q7. Latest order per customer.

```sql
WITH ranked_orders AS (
    SELECT o.*,
           ROW_NUMBER() OVER (
               PARTITION BY customer_id
               ORDER BY order_date DESC, order_id DESC
           ) AS rn
    FROM orders o
)
SELECT * FROM ranked_orders WHERE rn = 1;
```

A very common enterprise pattern.

### Q8. ROW_NUMBER() vs RANK() vs DENSE_RANK() in one line?

`ROW_NUMBER()` gives every row a unique number; `RANK()` gives ties the same rank **with** gaps; `DENSE_RANK()` gives ties the same rank **without** gaps.

## Common Mistakes

- ❌ **Forgetting `ORDER BY` for ranking** — `ROW_NUMBER() OVER ()` is allowed, but the numbering is arbitrary. Use `ROW_NUMBER() OVER (ORDER BY salary DESC, employee_id)`.
- ❌ **Confusing `GROUP BY` with `PARTITION BY`** — `GROUP BY` reduces rows; `PARTITION BY` keeps them.
- ❌ **Choosing the wrong ranking function** — unique numbering → `ROW_NUMBER()`; competition ranking → `RANK()`; continuous ranking → `DENSE_RANK()`.
- ❌ **Filtering a window function directly in `WHERE`** — wrap it in a CTE or derived table.
- ❌ **Ignoring ties** — for "all highest-paid employees", don't blindly use `ROW_NUMBER()`; use `RANK()` or `DENSE_RANK()`.
- ❌ **Assuming the window `ORDER BY` controls the final output** — add a final `ORDER BY`.

## Mini Project

Using the `employee` and `orders` tables, write queries to:

1. Rank all employees by salary.
2. Rank employees independently inside each department.
3. Find the highest-paid employee in every department.
4. Find all employees tied for the highest salary in every department.
5. Find the top three employees in each department.
6. Find the second-highest distinct salary in each department.
7. Display the department average salary beside every employee.
8. Display the department payroll beside every employee.
9. Calculate a running total of daily sales.
10. Find the latest order for every customer.

## Practice Problems

**Easy**

1. Generate row numbers for all employees.
2. Generate salary rankings.
3. Generate dense salary rankings.
4. Calculate the company average salary.
5. Calculate the department average salary.
6. Calculate department payroll.

**Medium**

1. Find the top two employees per department.
2. Find the lowest-paid employee per department.
3. Generate a running total.
4. Build a customer revenue leaderboard.
5. Rank products by quantity sold.
6. Find the latest order per customer.
7. Find the second-highest salary per department.

**Interview level**

1. Explain `ROW_NUMBER()` vs `RANK()` vs `DENSE_RANK()`.
2. Find all employees with the second-highest salary in each department.
3. Rewrite a correlated subquery using window functions.
4. Build a sales leaderboard with ties.
5. Compare window functions with `GROUP BY`.
6. Explain why window functions can't normally be filtered directly in `WHERE`.
7. Explain the window `ORDER BY` vs the final query `ORDER BY`.
8. Solve Top-N per group.
9. Explain deterministic ranking and tie-breakers.

## Best Practices

- ✅ Always define a meaningful ordering for ranking functions, with a deterministic tie-breaker (`ORDER BY salary DESC, employee_id ASC`).
- ✅ Use `PARTITION BY` for independent logical groups.
- ✅ Use `ROW_NUMBER()` when exactly one row must be selected; `RANK()`/`DENSE_RANK()` when ties matter; `DENSE_RANK()` for Nth distinct value problems.
- ✅ Filter window results with CTEs or derived tables.
- ✅ Use an explicit `ROWS` frame for predictable running totals.
- ✅ Add a final `ORDER BY` when output order matters, and verify performance with `EXPLAIN`.

## The Window Function Mental Model

```flow
FROM / WHERE — prepare rows
PARTITION BY — create logical groups
ORDER BY inside OVER() — order rows in each group
Window function — calculate rank, aggregate or running value
Final ORDER BY — display the result
```

Window functions are heavily used in banking transaction analysis, sales leaderboards, payroll and HR analytics, financial dashboards, inventory reporting, customer segmentation, BI, Spring Boot analytics APIs, fraud detection, latest-record queries, deduplication, Top-N reports, running balances and revenue analysis.

## Key Takeaways

- ✅ Window functions calculate without collapsing rows; `OVER()` defines the window.
- ✅ `PARTITION BY` creates independent groups; `ORDER BY` inside `OVER()` sets the logical sequence.
- ✅ `ROW_NUMBER()` — unique numbers; `RANK()` — ties with gaps; `DENSE_RANK()` — ties without gaps.
- ✅ Top-N per group is one of the most important patterns.
- ✅ Filter window results with CTEs or derived tables.
- ✅ Running totals need an explicit frame for predictable row-by-row behaviour.
- ✅ Window functions simplify many queries that once needed correlated subqueries or self joins.
