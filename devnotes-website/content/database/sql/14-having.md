---
title: HAVING and Advanced Group Filtering
subtitle: Filtering aggregated groups — WHERE vs HAVING, HAVING with COUNT/SUM/AVG/MIN/MAX, combining both, HAVING without GROUP BY, HAVING with JOINs and the cardinality trap.
order: 14
---

## Introduction

The previous chapter used `GROUP BY` with `COUNT()`, `SUM()`, `AVG()`, `MIN()` and `MAX()`. Now we'll **filter those aggregated groups** with the `HAVING` clause — central to reporting APIs, analytics dashboards, revenue reports, sales analysis, management reports, booking statistics and SQL interviews.

Learn to answer business questions such as:

- Which departments have more than 10 employees?
- Which customers spent more than 1,00,000?
- Which products generated revenue above 10 lakh?
- Which cities have more than 50 customers?
- Which sales regions crossed their monthly targets?

## Why Do We Need HAVING?

Goal: departments with **more than two employees**. First, SQL must group employees by department:

```sql
SELECT department,
       COUNT(*) AS employee_count
FROM employees
GROUP BY department;
```

| Department | Employee count |
| --- | --- |
| IT | 3 |
| HR | 2 |
| Finance | 2 |

Now we want only `employee_count > 2`. But `COUNT(*)` exists **only after grouping**, and `WHERE` logically executes **before** `GROUP BY` — so it can't filter the aggregated result. That's why SQL provides `HAVING`:

```sql
SELECT department,
       COUNT(*) AS employee_count
FROM employees
GROUP BY department
HAVING COUNT(*) > 2;
```

| Department | Employee count |
| --- | --- |
| IT | 3 |

> [!IMPORTANT]
> **`WHERE` filters rows. `HAVING` filters groups.**

## SQL Logical Execution Order

```sql
SELECT department,
       AVG(salary) AS average_salary
FROM employees
WHERE salary > 50000
GROUP BY department
HAVING AVG(salary) > 75000
ORDER BY average_salary DESC
LIMIT 5;
```

```flow-h
FROM
WHERE
GROUP BY
HAVING
SELECT
ORDER BY
LIMIT
```

Aggregate values are calculated as part of grouped processing, so `HAVING` can use them.

```flow-h Understanding this order answers many interview questions
WHERE → individual rows
GROUP BY → groups
HAVING → filtered groups
```

## WHERE vs HAVING

| WHERE | HAVING |
| --- | --- |
| Filters individual rows | Filters groups |
| Executes logically before `GROUP BY` | Executes logically after `GROUP BY` |
| Normally for non-aggregate row conditions | Commonly for aggregate conditions |
| Reduces rows before grouping | Filters after groups are created |
| e.g. `salary > 50000` | e.g. `AVG(salary) > 75000` |

The simplest way to remember: **`WHERE` — which rows should participate? `HAVING` — which groups should survive?**

## Sample Employee Table

| id | name | department | salary |
| --- | --- | --- | --- |
| 1 | John | IT | 70000 |
| 2 | David | IT | 90000 |
| 3 | Lisa | HR | 50000 |
| 4 | Alex | HR | 55000 |
| 5 | Mary | Finance | 80000 |
| 6 | Tom | Finance | 85000 |
| 7 | Kevin | IT | 95000 |

## HAVING with COUNT()

Departments with more than two employees:

```sql
SELECT department,
       COUNT(*) AS employee_count
FROM employees
GROUP BY department
HAVING COUNT(*) > 2;     -- IT: 3
```

```flow-h
GROUP BY department: IT 3, HR 2, Finance 2
HAVING COUNT(*) > 2
IT 3
```

## HAVING with AVG()

Departments whose average salary is greater than 75,000:

```sql
SELECT department,
       AVG(salary) AS average_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > 75000;
```

| Department | Average salary |
| --- | --- |
| IT | 85000 |
| Finance | 82500 |

## HAVING with SUM()

Departments whose total salary exceeds 1,50,000:

```sql
SELECT department,
       SUM(salary) AS total_salary
FROM employees
GROUP BY department
HAVING SUM(salary) > 150000;
```

| Department | Total salary |
| --- | --- |
| IT | 255000 |
| Finance | 165000 |

## HAVING with MAX()

Departments where the highest salary is **above** 90,000:

```sql
SELECT department,
       MAX(salary) AS highest_salary
FROM employees
GROUP BY department
HAVING MAX(salary) > 90000;    -- IT: 95000
```

"Above 90,000" means `> 90000`; "90,000 or above" would be `>= 90000`.

## HAVING with MIN()

Departments whose minimum salary is below 55,000:

```sql
SELECT department,
       MIN(salary) AS lowest_salary
FROM employees
GROUP BY department
HAVING MIN(salary) < 55000;    -- HR: 50000
```

### Orders Example

| Order ID | Customer | Amount |
| --- | --- | --- |
| 1 | A | 50000 |
| 2 | B | 20000 |
| 3 | A | 35000 |
| 4 | C | 10000 |
| 5 | B | 70000 |
| 6 | A | 25000 |

Customers spending more than 80,000:

```sql
SELECT customer,
       SUM(amount) AS total_spent
FROM orders
GROUP BY customer
HAVING SUM(amount) > 80000;
```

| Customer | Total spent |
| --- | --- |
| A | 110000 |
| B | 90000 |

A = 50000 + 35000 + 25000 = 110000; B = 20000 + 70000 = 90000; C = 10000 → filtered out.

## Combining WHERE and HAVING

Extremely common in enterprise applications. Management wants to consider only employees earning more than 50,000, group them by department, and return only departments whose average salary is above 80,000:

```sql
SELECT department,
       AVG(salary) AS average_salary
FROM employees
WHERE salary > 50000
GROUP BY department
HAVING AVG(salary) > 80000;
```

```flow
FROM employees — read rows
WHERE salary > 50000 — remove non-qualifying employees
GROUP BY department — create groups
AVG(salary) — average per group
HAVING AVG(salary) > 80000 — keep qualifying groups
```

> [!IMPORTANT]
> `WHERE` changes **which rows participate** in the aggregation. `HAVING` filters the result **after** aggregation.

### WHERE vs HAVING Changes the Meaning

```sql
-- Average salary using only employees earning more than 50,000
SELECT department, AVG(salary)
FROM employees
WHERE salary > 50000
GROUP BY department;

-- Average using all employees, then keep departments whose average exceeds 50,000
SELECT department, AVG(salary)
FROM employees
GROUP BY department
HAVING AVG(salary) > 50000;
```

These answer **completely different business questions**.

## Multiple Conditions in HAVING

```sql
SELECT department,
       COUNT(*)    AS employee_count,
       AVG(salary) AS average_salary
FROM employees
GROUP BY department
HAVING COUNT(*) >= 2
   AND AVG(salary) > 70000;
```

Departments with at least two employees **and** an average salary above 70,000. With `OR`, a department qualifies if **either** condition is true:

```sql
HAVING COUNT(*) >= 5
    OR AVG(salary) > 80000;
```

## HAVING with Multiple Aggregates

```sql
SELECT department,
       COUNT(*)    AS employee_count,
       SUM(salary) AS total_salary,
       AVG(salary) AS average_salary
FROM employees
GROUP BY department
HAVING COUNT(*) >= 2
   AND SUM(salary) > 150000
   AND AVG(salary) > 75000;
```

The department must have at least 2 employees **and** a total salary above 1,50,000 **and** an average salary above 75,000 — common in management reports and dashboards.

> [!TIP]
> MySQL also lets `HAVING` reference a `SELECT` alias (`HAVING total_salary > 150000`). That's a MySQL extension; repeating the aggregate is portable.

## Real-World Business Reports

```sql
-- 1. Top customers by spending threshold
SELECT customer_id, SUM(total_amount) AS revenue
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) > 100000;

-- 2. Best-selling products
SELECT product_id, SUM(quantity) AS total_sold
FROM sales
GROUP BY product_id
HAVING SUM(quantity) > 100;

-- 3. High-revenue products
SELECT product_id, SUM(price * quantity) AS revenue
FROM sales
GROUP BY product_id
HAVING SUM(price * quantity) > 1000000;

-- 4. Busy departments
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department
HAVING COUNT(*) >= 20;

-- 5. Cities with more than 50 customers
SELECT city, COUNT(*) AS customer_count
FROM customers
GROUP BY city
HAVING COUNT(*) > 50;

-- 6. Customers with more than 10 orders
SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 10;

-- 7. Monthly revenue above 50 lakh
SELECT YEAR(order_date)  AS order_year,
       MONTH(order_date) AS order_month,
       SUM(total_amount) AS monthly_revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date)
HAVING SUM(total_amount) > 5000000;
```

Including the year prevents the same month from different years being combined.

## HAVING Without GROUP BY

A lesser-known but valid use:

```sql
SELECT SUM(salary) AS total_salary
FROM employees
HAVING SUM(salary) > 300000;
```

There's no `GROUP BY`, so the **entire qualifying input is treated as one group**. If `SUM(salary) > 300000`, the row is returned; otherwise **no row** is returned.

## GROUP BY + HAVING + JOIN

Extremely important for production applications. Customers who have placed more than five orders:

```sql
SELECT c.customer_id,
       c.customer_name,
       COUNT(o.order_id) AS order_count
FROM customers c
INNER JOIN orders o
    ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(o.order_id) > 5;
```

```flow-h
customers
JOIN orders
GROUP BY customer
COUNT orders
HAVING count > 5
```

Products generating more than 10 lakh:

```sql
SELECT p.product_id,
       p.product_name,
       SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM products p
INNER JOIN order_items oi
    ON p.product_id = oi.product_id
GROUP BY p.product_id, p.product_name
HAVING SUM(oi.quantity * oi.unit_price) > 1000000;
```

This pattern is extremely common in reporting APIs.

## Common Interview Questions

### Q1. Find departments having more than five employees.

```sql
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department
HAVING COUNT(*) > 5;
```

### Q2. Find customers whose total purchase exceeds 50,000.

```sql
SELECT customer_id, SUM(total_amount) AS total_purchase
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) > 50000;
```

### Q3. Find products with total quantity sold above 100 units.

```sql
SELECT product_id, SUM(quantity) AS total_quantity
FROM sales
GROUP BY product_id
HAVING SUM(quantity) > 100;
```

### Q4. Find departments whose average salary exceeds 80,000.

```sql
SELECT department, AVG(salary) AS average_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > 80000;
```

### Q5. Find categories generating more than 10 lakh in revenue.

```sql
SELECT category, SUM(price * quantity) AS revenue
FROM sales
GROUP BY category
HAVING SUM(price * quantity) > 1000000;
```

### Q6. What is the difference between WHERE and HAVING?

`WHERE` filters individual rows **before** `GROUP BY`; `HAVING` filters aggregated groups **after** `GROUP BY`.

### Q7. Can HAVING be used without GROUP BY?

Yes — e.g. `SELECT SUM(salary) FROM employees HAVING SUM(salary) > 300000;`. The aggregate query treats the entire input as one group.

## Common Mistakes

### Mistake 1 — Using WHERE with Aggregate Functions

```sql
SELECT department, COUNT(*)
FROM employees
WHERE COUNT(*) > 2            -- ❌ group-level COUNT(*) doesn't exist yet
GROUP BY department;
```

Correct: `GROUP BY department HAVING COUNT(*) > 2`.

### Mistake 2 — Forgetting GROUP BY

```sql
SELECT department, SUM(salary)
FROM employees
HAVING SUM(salary) > 100000;  -- ❌ department isn't grouped (invalid with ONLY_FULL_GROUP_BY)
```

Correct:

```sql
SELECT department, SUM(salary) AS total_salary
FROM employees
GROUP BY department
HAVING SUM(salary) > 100000;
```

### Mistake 3 — Using HAVING for Row Filtering

```sql
-- Works, but the condition doesn't depend on aggregation
SELECT department, COUNT(*)
FROM employees
GROUP BY department
HAVING department = 'IT';

-- Prefer
SELECT department, COUNT(*)
FROM employees
WHERE department = 'IT'
GROUP BY department;
```

**General rule:** if a condition can correctly filter individual rows before grouping, prefer `WHERE` — it also reduces the work done by the grouping.

### Mistake 4 — Moving a Condition Between WHERE and HAVING Without Understanding the Meaning

`WHERE salary > 50000` filters **employees**; `HAVING AVG(salary) > 50000` filters **departments**. They aren't equivalent.

### Mistake 5 — Forgetting Relationship Cardinality Before Aggregation

If an order has **2** order items and **3** payment attempts, joining orders → order items → payments creates **6 rows** for that order. Then `SUM(order_amount)` counts the same order **six times**.

> [!WARNING]
> Before aggregating joined data, understand the relationship cardinality — aggregate each child table separately (e.g. in subqueries/CTEs) before joining if necessary. A major production-level SQL issue.

## Mini Project

| Product | Category | Quantity | Price |
| --- | --- | --- | --- |
| Laptop | Electronics | 20 | 50000 |
| Mouse | Electronics | 120 | 1000 |
| Keyboard | Electronics | 70 | 2000 |
| Chair | Furniture | 45 | 7000 |
| Table | Furniture | 20 | 12000 |

```sql
-- 1. Categories with revenue greater than 10,00,000
SELECT category, SUM(quantity * price) AS revenue
FROM sales
GROUP BY category
HAVING SUM(quantity * price) > 1000000;

-- 2. Products sold more than 50 units
SELECT product, SUM(quantity) AS total_quantity
FROM sales
GROUP BY product
HAVING SUM(quantity) > 50;

-- 3. Products generating revenue above 5,00,000
SELECT product, SUM(quantity * price) AS revenue
FROM sales
GROUP BY product
HAVING SUM(quantity * price) > 500000;

-- 4. Categories with an average product price above 5,000
SELECT category, AVG(price) AS average_price
FROM sales
GROUP BY category
HAVING AVG(price) > 5000;
```

Query 4 calculates the average price of the **rows/products** in the table. For a **quantity-weighted** average selling price:

```sql
SELECT category,
       SUM(quantity * price) / NULLIF(SUM(quantity), 0) AS weighted_average_price
FROM sales
GROUP BY category
HAVING SUM(quantity * price) / NULLIF(SUM(quantity), 0) > 5000;
```

```sql
-- 5. Categories having at least two products
SELECT category, COUNT(*) AS product_count
FROM sales
GROUP BY category
HAVING COUNT(*) >= 2;

-- If the same product can appear in multiple rows, count unique products
SELECT category, COUNT(DISTINCT product) AS product_count
FROM sales
GROUP BY category
HAVING COUNT(DISTINCT product) >= 2;
```

## Practice Problems

**Easy**

1. Find departments having more than three employees.
2. Find customers spending more than 20,000.
3. Find products with total quantity sold above 10 units.
4. Find cities with more than five customers.
5. Find departments with an average salary above 60,000.

**Medium**

1. Find products generating revenue above 5 lakh.
2. Find categories having more than five products.
3. Find customers placing more than ten orders.
4. Find employees earning above their department's average salary.
5. Find months where total revenue exceeded 50 lakh.

> [!NOTE]
> Medium problem 4 can't be solved with a simple `GROUP BY` + `HAVING` if you must return individual employee rows. Common solutions: a subquery, a correlated subquery or a window function (covered in later chapters).

**Interview level**

1. Find the top five customers by revenue.
2. Find departments with both a high employee count and a high average salary.
3. Find products appearing in more than ten distinct orders.
4. Find cities with the highest total sales.
5. Build a department dashboard (employee count, average salary, maximum salary) returning only departments whose total salary exceeds 10 lakh:

```sql
SELECT department,
       COUNT(*)    AS employee_count,
       AVG(salary) AS average_salary,
       MAX(salary) AS maximum_salary,
       SUM(salary) AS total_salary
FROM employees
GROUP BY department
HAVING SUM(salary) > 1000000;
```

## Best Practices

- ✅ Use `WHERE` to filter rows before grouping.
- ✅ Use `HAVING` for aggregate-based filtering.
- ✅ Combine `WHERE` and `HAVING` when both row-level and group-level filtering are required.
- ✅ Alias aggregate columns for readable reports.
- ✅ Understand the SQL logical execution order.
- ✅ Understand join cardinality before aggregating.
- ✅ Use `COUNT(DISTINCT ...)` to count unique values.
- ✅ Don't move conditions between `WHERE` and `HAVING` without understanding how it changes the result.
- ✅ Validate reporting queries against realistic data volumes.

## Real Backend Example

A Spring Boot API exposes `GET /api/reports/high-value-customers`: return **active** customers who spent more than 1,00,000 during 2026.

```sql
SELECT c.customer_id,
       c.customer_name,
       SUM(o.total_amount) AS total_spent
FROM customers c
INNER JOIN orders o
    ON c.customer_id = o.customer_id
WHERE c.status = 'ACTIVE'
  AND o.order_date >= '2026-01-01'
  AND o.order_date <  '2027-01-01'
GROUP BY c.customer_id, c.customer_name
HAVING SUM(o.total_amount) > 100000
ORDER BY total_spent DESC;
```

This single query combines **JOIN + WHERE + GROUP BY + SUM() + HAVING + ORDER BY** — exactly the kind of query used in enterprise reporting APIs.

## Cheat Sheet

The classic pattern:

```sql
SELECT group_column,
       AGGREGATE_FUNCTION(column)
FROM table
WHERE row_condition
GROUP BY group_column
HAVING aggregate_condition;
```

```flow-h
Raw data
WHERE → filtered rows
GROUP BY → groups
Aggregate functions
HAVING → filtered groups
```

| Clause | Example | Filters |
| --- | --- | --- |
| `WHERE` | `WHERE salary > 50000` | Individual rows, before grouping |
| `HAVING` | `HAVING AVG(salary) > 75000` | Aggregated groups |
| Multiple conditions | `HAVING COUNT(*) >= 2 AND AVG(salary) > 70000` | Groups meeting all conditions |
| Without `GROUP BY` | `SELECT SUM(salary) FROM employees HAVING SUM(salary) > 300000` | The whole table as one group |

**Interview tips:** the `WHERE` vs `HAVING` difference is almost guaranteed in SQL interviews; know how moving a condition between them changes the meaning; know `HAVING` works without an explicit `GROUP BY`; and be careful when aggregating after joining several one-to-many relationships.
