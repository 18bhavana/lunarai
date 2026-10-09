---
title: Views & Materialized Views
subtitle: Creating, replacing and dropping views, updatable vs non-updatable views, security views, WITH CHECK OPTION, materialized-view concepts and the MySQL summary-table alternative.
order: 28
---

## Introduction

Views are heavily used in banking, healthcare, ERP, CRM, e-commerce and reporting applications.

This chapter covers what views are and why they're used; creating, modifying and deleting views; updatable vs non-updatable views; security with views; materialized-view concepts and MySQL's alternatives; performance considerations; and enterprise reporting use cases.

## What Is a View?

A view is a **virtual table created from the result of a SQL query**. Unlike a real table:

- it does **not** store data;
- it stores only the **query definition**;
- every time the view is queried, MySQL executes the underlying query.

Think of it as a **saved SQL query**.

## Why Use Views?

Suppose every report needs this join:

```sql
SELECT e.employee_id, e.employee_name, d.department_name, e.salary
FROM employee e
JOIN department d ON e.department_id = d.department_id;
```

Instead of writing it repeatedly, **create a view once and reuse it everywhere**.

## Creating a View

```sql
CREATE VIEW employee_details AS
SELECT e.employee_id,
       e.employee_name,
       d.department_name,
       e.salary
FROM employee e
JOIN department d ON e.department_id = d.department_id;

-- Query it like a table
SELECT * FROM employee_details;
```

### Example

**employee**

| Employee ID | Name | Department ID | Salary |
| --- | --- | --- | --- |
| 101 | John | 1 | 70000 |
| 102 | David | 1 | 90000 |
| 103 | Lisa | 2 | 50000 |

**department**

| Department ID | Department name |
| --- | --- |
| 1 | IT |
| 2 | HR |

**View output**

| Employee | Department | Salary |
| --- | --- | --- |
| John | IT | 70000 |
| David | IT | 90000 |
| Lisa | HR | 50000 |

### Filtering Through Views

```sql
SELECT *
FROM employee_details
WHERE salary > 80000;
```

The filter is applied to the view's result (for simple views, MySQL merges it into the underlying query so indexes can still be used).

### Replacing and Dropping a View

```sql
CREATE OR REPLACE VIEW employee_details AS
SELECT employee_id, employee_name, salary
FROM employee;

DROP VIEW employee_details;
```

`CREATE OR REPLACE VIEW` changes the definition without dropping it first. `DROP VIEW` removes only the view — the underlying tables are unchanged.

### A Simple Filtered View

```sql
CREATE VIEW it_employees AS
SELECT *
FROM employee
WHERE department_id = 1;

SELECT * FROM it_employees;
```

> [!NOTE]
> MySQL expands `SELECT *` into a fixed column list **when the view is created**. Columns later added to `employee` don't appear in the view until it's recreated. Listing columns explicitly is clearer.

## Updatable Views

A view is generally **updatable** when it's based on a single table and contains nothing that prevents each view row from mapping back to exactly one row of the underlying table:

```sql
CREATE VIEW employee_basic AS
SELECT employee_id, employee_name, salary
FROM employee;

UPDATE employee_basic
SET salary = 80000
WHERE employee_id = 101;   -- the underlying employee table is updated
```

## Non-Updatable Views

```sql
CREATE VIEW department_salary AS
SELECT department_id, AVG(salary) AS average_salary
FROM employee
GROUP BY department_id;
```

This view can't be updated — it contains `GROUP BY`, an aggregate (`AVG`) and derived rows. What would "set the average salary to 80000" even mean?

Views are typically **not updatable** when they include:

- `GROUP BY` or `HAVING`
- `DISTINCT`
- aggregate functions such as `SUM()` and `AVG()`
- `UNION` / `UNION ALL`
- subqueries in the select list
- window functions
- certain joins

> [!NOTE]
> Join views aren't always read-only in MySQL. A view over an inner join can be updated **as long as a single statement changes columns of only one base table**, and an `INSERT` can target one base table. `DELETE` through a multi-table view isn't supported.

## Views for Security

Suppose users should not see employee salaries. Create a restricted view:

```sql
CREATE VIEW employee_public AS
SELECT employee_id, employee_name, department_id
FROM employee;
```

Users query the view instead of the base table, so sensitive columns stay hidden. For this to be real security, **grant access to the view, not the table**:

```sql
GRANT SELECT ON hr.employee_public TO 'report_user'@'%';
```

By default a view runs with its **definer's** privileges (`SQL SECURITY DEFINER`), so `report_user` can read the view without having any privilege on `employee` itself.

## WITH CHECK OPTION

`WITH CHECK OPTION` ensures that inserts and updates made **through** a view still satisfy the view's condition:

```sql
CREATE VIEW it_employees AS
SELECT *
FROM employee
WHERE department_id = 1
WITH CHECK OPTION;

-- Fails
UPDATE it_employees
SET department_id = 2
WHERE employee_id = 101;
```

After the update, the employee would no longer satisfy `department_id = 1` and would **disappear from the view**. `WITH CHECK OPTION` prevents this.

```output Error
ERROR 1369 (HY000): CHECK OPTION failed 'hr.it_employees'
```

## Materialized Views

A **materialized view** stores query results **physically**:

| View | Materialized view |
| --- | --- |
| Stores the SQL definition | Stores query results |
| Calculated when queried | Precomputed |
| Always reflects current underlying data | Requires refresh |
| Can be slower for complex queries | Faster for expensive reads |
| Minimal additional storage | Uses additional storage |

### Does MySQL Support Materialized Views?

**No.** MySQL has no native materialized views (unlike PostgreSQL and Oracle). Developers implement similar behavior with:

- summary tables;
- scheduled events;
- stored procedures;
- ETL jobs;
- application-level caching such as Redis.

## The Summary-Table Alternative

Suppose monthly sales are expensive to calculate. Instead of running the aggregation repeatedly, create a summary table:

```sql
CREATE TABLE monthly_sales_summary (
    sales_year  INT,
    sales_month INT,
    revenue     DECIMAL(12, 2),
    PRIMARY KEY (sales_year, sales_month)
);

INSERT INTO monthly_sales_summary
SELECT YEAR(order_date), MONTH(order_date), SUM(amount)
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date);

SELECT * FROM monthly_sales_summary;
```

This can be much faster because the expensive aggregation has already been done. Include the **year**: grouping by `MONTH(order_date)` alone merges January 2025 with January 2026.

### Refreshing Summary Tables

Summary tables must be refreshed periodically — via scheduled events, stored procedures, Spring Boot `@Scheduled` jobs or batch processing — hourly, daily or weekly, depending on business requirements.

The simplest refresh:

```sql
TRUNCATE TABLE monthly_sales_summary;

INSERT INTO monthly_sales_summary
SELECT YEAR(order_date), MONTH(order_date), SUM(amount)
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date);
```

> [!WARNING]
> `TRUNCATE` commits implicitly and can't be rolled back, so between the two statements readers see an **empty** table, and if the `INSERT` fails the table stays empty. Safer options:
> - Build a new table and swap it in atomically with `RENAME TABLE`.
> - Use `DELETE` + `INSERT` inside one transaction.
> - Upsert with `INSERT ... ON DUPLICATE KEY UPDATE`.

```sql
-- Atomic swap
CREATE TABLE monthly_sales_summary_new LIKE monthly_sales_summary;

INSERT INTO monthly_sales_summary_new
SELECT YEAR(order_date), MONTH(order_date), SUM(amount)
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date);

RENAME TABLE monthly_sales_summary     TO monthly_sales_summary_old,
             monthly_sales_summary_new TO monthly_sales_summary;

DROP TABLE monthly_sales_summary_old;
```

### Scheduling the Refresh with an Event

```sql
-- Requires the event scheduler: SET GLOBAL event_scheduler = ON;
CREATE EVENT refresh_monthly_sales
ON SCHEDULE EVERY 1 DAY
STARTS '2026-01-01 02:00:00'
DO
    INSERT INTO monthly_sales_summary
    SELECT YEAR(order_date), MONTH(order_date), SUM(amount)
    FROM orders
    GROUP BY YEAR(order_date), MONTH(order_date)
    ON DUPLICATE KEY UPDATE revenue = VALUES(revenue);
```

## Real-World Examples

```sql
-- 1. Employee reporting view
CREATE VIEW employee_report AS
SELECT employee_name, department_name, salary
FROM employee
JOIN department USING (department_id);

-- 2. Customer order view
CREATE VIEW customer_orders AS
SELECT customer_name, order_date, amount
FROM orders
JOIN customer USING (customer_id);

-- 3. HR public view
CREATE VIEW employee_public AS
SELECT employee_id, employee_name
FROM employee;

-- 4. Product sales summary table
CREATE TABLE product_sales_summary AS
SELECT product_id, SUM(quantity) AS total_sold
FROM sales
GROUP BY product_id;

-- 5. Finance dashboard view
CREATE VIEW monthly_revenue AS
SELECT YEAR(order_date)  AS sales_year,
       MONTH(order_date) AS month_no,
       SUM(amount)       AS revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date);
```

## Performance Considerations

**Views:**

- do **not** automatically improve performance;
- simplify query reuse and improve maintainability;
- can provide a security abstraction;
- become hard to debug when deeply nested;
- still need proper indexes and optimization on the underlying query.

> [!NOTE]
> MySQL processes a view either by **merging** it into the outer query (`ALGORITHM = MERGE`, used for simple views, so outer filters can use indexes) or by materializing it into a **temporary table** first (`TEMPTABLE`, needed for views with `GROUP BY`, `DISTINCT`, aggregates or `UNION`). Filtering a large aggregated view can therefore compute the whole aggregate before the filter is applied — check with `EXPLAIN`.

**Summary tables:**

- provide faster reads;
- require additional storage;
- must be refreshed periodically;
- can contain stale data between refreshes.

## Interview Questions

### Q1. What is a view?

A virtual table based on the result of a SQL query. It stores the query, not the data.

### Q2. Does MySQL support materialized views?

No. Common alternatives are summary tables, scheduled events, stored procedures, ETL jobs and application-level caching.

### Q3. Difference between a view and a table?

| View | Table |
| --- | --- |
| Virtual | Physical |
| Stores the query definition | Stores data |
| Usually needs no significant storage | Uses storage |
| Depends on underlying tables | Exists independently |

### Q4. Difference between a view and a materialized view?

| View | Materialized view |
| --- | --- |
| Executes the underlying query | Reads stored results |
| Reflects current data | May contain stale data |
| No refresh required | Refresh required |
| Can be slower for expensive queries | Faster for reporting |

### Q5. What is WITH CHECK OPTION?

It rejects inserts or updates through a view when the resulting row would no longer satisfy the view's `WHERE` condition.

## Common Mistakes

- ❌ **Assuming views improve performance** — views improve maintainability and reusability, not necessarily execution speed.
- ❌ **Building deeply nested views** — a view built on a view on a view on a view makes debugging and performance analysis difficult. Prefer well-designed views with clear responsibilities.
- ❌ **Forgetting the summary refresh** — when summary tables simulate materialized views, stale data appears if refresh jobs fail or are missed. Always monitor refresh processes.

## Mini Project

Using `employee` (employee_id, name, department_id, salary) and `department` (department_id, department_name):

1. Create a view showing employee name, department name and salary.
2. Create a public employee view hiding salary.
3. Create an IT employee view using `WITH CHECK OPTION`.
4. Create a monthly sales summary table.
5. Write SQL to refresh the summary table.

## Practice Problems

**Easy**

1. Create a view.
2. Query a view.
3. Replace a view.
4. Drop a view.
5. Create a simple filtered view.

**Medium**

1. Create a join-based reporting view.
2. Create an updatable view.
3. Create a secure view hiding sensitive columns.
4. Use `WITH CHECK OPTION`.
5. Build a sales summary table.

**Interview level**

1. Explain view vs table.
2. Explain view vs materialized view.
3. Explain updatable vs non-updatable views.
4. Design a reporting layer using views.
5. Explain how to simulate materialized views in MySQL.

## Best Practices

- ✅ Use views to simplify complex joins.
- ✅ Restrict sensitive data through carefully designed views **and** appropriate database permissions.
- ✅ Avoid unnecessary layers of nested views.
- ✅ Use summary tables for expensive reporting queries, refreshed on a schedule that fits business requirements.
- ✅ Optimize the underlying queries and indexes used by views.

Views are widely used in banking reports, HRMS, ERP, CRM dashboards, financial reporting, healthcare, BI and Spring Boot reporting APIs; summary tables commonly accelerate dashboard and reporting workloads.

## Key Takeaways

- ✅ A view is a reusable virtual table based on a SQL query.
- ✅ Views improve readability, maintainability, reusability and security.
- ✅ Simple views can often be updated; aggregated and complex views usually can't.
- ✅ `WITH CHECK OPTION` enforces a view's filter during inserts and updates.
- ✅ MySQL has no native materialized views — summary tables with scheduled refreshes are the common alternative.
