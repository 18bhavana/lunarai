---
title: Correlated Subqueries
subtitle: Subqueries that depend on the outer row — department averages, row-by-row evaluation, EXISTS/NOT EXISTS, correlated UPDATE and DELETE in MySQL, indexing, and JOIN or window-function rewrites.
order: 20
---

## Introduction

Correlated subqueries are one of the most important advanced SQL concepts for product-based companies and enterprise applications — frequently asked at Amazon, Microsoft, Oracle, Walmart, Goldman Sachs, JPMorgan, Flipkart and similar companies.

By the end you'll understand what correlated subqueries are, how they differ from normal subqueries, row-by-row evaluation, `EXISTS`/`NOT EXISTS`, performance considerations and enterprise use cases.

## What is a Correlated Subquery?

> [!IMPORTANT]
> A **correlated subquery** depends on the **current row of the outer query**. Unlike a normal subquery, it can't execute independently.

```sql
SELECT ...
FROM table1 t1
WHERE column OPERATOR (
    SELECT ...
    FROM table2 t2
    WHERE t2.column = t1.column
);
```

Notice `t1.column` — the inner query **references a column from the outer query**.

## Normal vs Correlated Subquery

| Normal subquery | Correlated subquery |
| --- | --- |
| Evaluated once | Logically evaluated for each outer row |
| Independent | Depends on the outer query |
| Often easier to optimize | Needs careful optimization |
| Can run on its own | Can't run on its own |

## Employee Table

| Employee ID | Name | Department | Salary |
| --- | --- | --- | --- |
| 101 | John | IT | 70000 |
| 102 | David | IT | 90000 |
| 103 | Lisa | HR | 50000 |
| 104 | Alex | HR | 55000 |
| 105 | Mary | Finance | 80000 |
| 106 | Tom | Finance | 85000 |

## Problem: Employees Earning More Than Their Department Average

A company-wide average won't solve this — each employee must be compared with the average of **their own** department.

```sql
SELECT *
FROM employee e
WHERE salary > (
    SELECT AVG(salary)
    FROM employee
    WHERE department = e.department
);
```

The correlation is `department = e.department`: `e.department` comes from the outer query, and the inner query calculates the average for the **current employee's** department.

### How It Executes

| Employee | Department average | Comparison | Returned? |
| --- | --- | --- | --- |
| John (IT) | 80000 | 70000 > 80000 | ✗ |
| David (IT) | 80000 | 90000 > 80000 | ✓ |
| Lisa (HR) | 52500 | 50000 > 52500 | ✗ |
| Alex (HR) | 52500 | 55000 > 52500 | ✓ |
| Mary (Finance) | 82500 | 80000 > 82500 | ✗ |
| Tom (Finance) | 82500 | 85000 > 82500 | ✓ |

### Final Output

| Name | Department | Salary |
| --- | --- | --- |
| David | IT | 90000 |
| Alex | HR | 55000 |
| Tom | Finance | 85000 |

## EXISTS with Correlated Subqueries

| Customer ID | Name |
| --- | --- |
| 101 | John |
| 102 | David |
| 103 | Lisa |
| 104 | Mary |

| Order ID | Customer ID |
| --- | --- |
| 1 | 101 |
| 2 | 101 |
| 3 | 103 |

Customers who have placed at least one order:

```sql
SELECT *
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

### How EXISTS Works

For each customer, the database checks whether **at least one matching order** exists: customer 101 → yes → John is returned; customer 102 → no → David is skipped. (Result: John, Lisa.)

With `EXISTS`, the selected value doesn't matter — `SELECT 1`, `SELECT *` and `SELECT customer_id` are logically equivalent. Conventionally we write `SELECT 1` because it clearly says we only care about existence.

## NOT EXISTS

Customers who have never placed an order:

```sql
SELECT *
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);   -- David, Mary
```

`NOT EXISTS` returns an outer row only when the correlated subquery finds **no** matching row.

## Correlated UPDATE

Increase the salary by 10% for employees earning less than their department average. The natural correlated form is:

```sql
UPDATE employee e
SET salary = salary * 1.10
WHERE salary < (
    SELECT AVG(salary)
    FROM employee
    WHERE department = e.department
);
```

> [!WARNING]
> **MySQL rejects this** with *ERROR 1093: You can't specify target table 'e' for update in FROM clause* — it doesn't allow a subquery to read the same table that's being updated. (Other databases accept it.) Rewrite it with a derived table and a `JOIN`.

```sql
UPDATE employee e
JOIN (
    SELECT department,
           AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
) d ON e.department = d.department
SET e.salary = e.salary * 1.10
WHERE e.salary < d.avg_salary;
```

## Correlated DELETE — Deduplication

Goal: delete duplicate records while keeping the row with the **lowest** employee ID. The logic: *delete `e1` if another employee `e2` exists with the same email and a smaller `employee_id`.*

```sql
-- Works in many databases, but MySQL raises ERROR 1093 (same table in the subquery)
DELETE FROM employee e1
WHERE EXISTS (
    SELECT 1
    FROM employee e2
    WHERE e2.email = e1.email
      AND e2.employee_id < e1.employee_id
);
```

The MySQL way is a **self-join `DELETE`**:

```sql
DELETE e1
FROM employee e1
JOIN employee e2
    ON e2.email = e1.email
   AND e2.employee_id < e1.employee_id;
```

This pattern is commonly used in enterprise data-cleaning and deduplication jobs (run it in a transaction and check the row count first).

## Real-World Business Examples

```sql
-- 1. Employees above their department average
SELECT *
FROM employee e
WHERE salary > (
    SELECT AVG(salary) FROM employee WHERE department = e.department
);

-- 2. Customers with orders
SELECT *
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

-- 3. Products never sold
SELECT *
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.product_id = p.product_id);

-- 4. Highest-paid employees in each department
SELECT *
FROM employee e
WHERE salary = (
    SELECT MAX(salary) FROM employee WHERE department = e.department
);

-- 5. Latest order per customer
SELECT *
FROM orders o
WHERE order_date = (
    SELECT MAX(order_date) FROM orders WHERE customer_id = o.customer_id
);
```

- Example 4 returns **all** tied employees if several share a department's maximum salary.
- Example 5 can return several orders for a customer placed on the same latest date. If exactly one row per customer is required, use a window function such as `ROW_NUMBER()` with a deterministic tie-breaker.

## Performance Considerations

A correlated subquery is **logically** evaluated using values from the current outer row — e.g. for 1,000 employees, the correlated condition is checked using each employee's department. But modern optimizers may **transform** correlated subqueries into more efficient plans.

> [!NOTE]
> More accurately: *a correlated subquery logically depends on each outer row, but the optimizer may avoid literally re-running the inner query from scratch for every row.*

### Importance of Indexing

Without appropriate indexes → potentially slow; with them → much faster. Correlation columns that commonly need indexes: `department`, `customer_id`, `product_id` and `email`.

```sql
CREATE INDEX idx_employee_department ON employee (department);
CREATE INDEX idx_orders_customer_id  ON orders (customer_id);
CREATE INDEX idx_sales_product_id    ON sales (product_id);
```

For some queries, composite indexes are even better — e.g. for the latest order per customer:

```sql
CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date);
```

## Correlated Subquery vs JOIN

```sql
-- Correlated subquery
SELECT *
FROM employee e
WHERE salary > (
    SELECT AVG(salary) FROM employee WHERE department = e.department
);

-- JOIN alternative: aggregate once per department, then join
SELECT e.*
FROM employee e
JOIN (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
) d ON e.department = d.department
WHERE e.salary > d.avg_salary;
```

The JOIN form can be easier for the optimizer and may perform better on large datasets — but it depends on the engine, indexes, data distribution, optimizer, table size and execution plan. Verify with `EXPLAIN` or `EXPLAIN ANALYZE`.

## Correlated Subquery vs Window Function

The same department-average problem with a window function:

```sql
SELECT *
FROM (
    SELECT e.*,
           AVG(salary) OVER (PARTITION BY department) AS avg_department_salary
    FROM employee e
) x
WHERE salary > avg_department_salary;
```

Window functions are often cleaner for analytical queries (covered in the next chapters).

## Interview Questions

### Q1. Employees earning above their department average.

```sql
SELECT *
FROM employee e
WHERE salary > (
    SELECT AVG(salary) FROM employee WHERE department = e.department
);
```

### Q2. The highest-paid employee in every department.

```sql
SELECT *
FROM employee e
WHERE salary = (
    SELECT MAX(salary) FROM employee WHERE department = e.department
);
```

### Q3. Customers with no orders.

```sql
SELECT *
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

### Q4. The latest order for every customer.

```sql
SELECT *
FROM orders o
WHERE order_date = (
    SELECT MAX(order_date) FROM orders WHERE customer_id = o.customer_id
);
```

### Q5. Products never purchased.

```sql
SELECT *
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.product_id = p.product_id);
```

### Q6. What is a correlated subquery, in one line?

A subquery that references columns from the outer query and is logically evaluated in the context of each outer row.

## Common Mistakes

### Mistake 1 — Forgetting the Correlation

```sql
SELECT *
FROM employee
WHERE salary > (SELECT AVG(salary) FROM employee);
```

This compares employees with the **company-wide** average, not their department average.

### Mistake 2 — Missing Table Aliases

`WHERE department = department` may simply compare the inner column with **itself** (always true). Write `department = e.department` — better still, alias both sides:

```sql
SELECT *
FROM employee e
WHERE salary > (
    SELECT AVG(e2.salary)
    FROM employee e2
    WHERE e2.department = e.department
);
```

### Mistake 3 — Ignoring Performance

Correlated subqueries on very large datasets can be expensive. Ask: can this be rewritten as a JOIN? Would a window function be clearer? Are the correlation columns indexed? What does `EXPLAIN` show?

## EXISTS vs IN

```sql
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

SELECT * FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders);
```

Both often produce the same result. `EXISTS` is especially natural when you only need to check whether a related row exists, the subquery is correlated, or the inner table has many matching rows. Modern optimizers may generate similar plans for both — inspect the plan rather than assuming one is universally faster.

## NOT EXISTS vs NOT IN

If the `NOT IN` subquery returns a `NULL`, it can produce unexpected results (usually no rows) because of three-valued logic. `NOT EXISTS` is safer:

```sql
SELECT *
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

> [!TIP]
> **Interview rule:** for anti-join logic, `NOT EXISTS` is often preferred because it handles `NULL` behaviour more safely than `NOT IN`.

## Mini Project

Using **employee** (John IT 70000, David IT 90000, Lisa HR 50000, Alex HR 55000, Mary Finance 80000, Tom Finance 85000) and **orders** (101 → 2026-01-01, 101 → 2026-02-10, 102 → 2026-03-01, 103 → 2026-02-15):

```sql
-- 1. Employees earning above their department average → David, Alex, Tom
SELECT *
FROM employee e
WHERE salary > (SELECT AVG(salary) FROM employee WHERE department = e.department);

-- 2. Highest-paid employee in each department → David, Alex, Tom
SELECT *
FROM employee e
WHERE salary = (SELECT MAX(salary) FROM employee WHERE department = e.department);

-- 3. Customers with orders
SELECT *
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

-- 4. Customers without orders
SELECT *
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

-- 5. Latest order for every customer → 101: 2026-02-10, 102: 2026-03-01, 103: 2026-02-15
SELECT *
FROM orders o
WHERE order_date = (SELECT MAX(order_date) FROM orders WHERE customer_id = o.customer_id);

-- 6. Products that have never been sold
SELECT *
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.product_id = p.product_id);
```

## Practice Problems

**Easy**

1. Find employees earning above their department average.
2. Find department toppers.
3. Find customers with orders.
4. Find customers without orders.
5. Find products that have been sold.

**Medium**

1. Find employees earning below their department average.
2. Find the oldest employee in each department.
3. Find customers whose latest order was placed this month.
4. Find departments where every employee earns above 60,000.
5. Delete duplicate email records while keeping the oldest row.

**Interview level**

1. Compare correlated subqueries and joins.
2. Explain when `EXISTS` may outperform `IN`.
3. Optimize a correlated subquery using indexing.
4. Rewrite a correlated subquery using a derived table and `JOIN`.
5. Solve "top employee per department" using a correlated subquery, a `JOIN` and a window function.

## Best Practices

- ✅ Use table aliases to make correlations explicit — on both the outer and inner references.
- ✅ Index columns used in correlated predicates.
- ✅ Prefer `EXISTS` for checking the existence of related rows, and `NOT EXISTS` for anti-join logic when `NULL`s may be involved.
- ✅ Consider rewriting expensive correlated subqueries as `JOIN`s, and window functions for analytical and ranking problems.
- ✅ Remember MySQL's ERROR 1093 for `UPDATE`/`DELETE` statements that read the same table in a subquery — use a join or derived table.
- ✅ Use `EXPLAIN` / `EXPLAIN ANALYZE`, and never assume a correlated subquery literally runs once per outer row.

## Enterprise Usage

Payroll calculations, banking transaction validation, fraud detection, HR performance reports, CRM customer analysis, inventory management, Spring Boot reporting APIs, data-quality jobs, duplicate detection, missing-relationship detection, latest-record queries and business-rule validation.

## Key Takeaways

- ✅ A correlated subquery references columns from the outer query and can't execute independently.
- ✅ `EXISTS` and `NOT EXISTS` are the most common correlated-subquery patterns.
- ✅ They're powerful but can become expensive on large datasets — proper indexing is essential.
- ✅ Many correlated queries can also be solved with `JOIN`s or window functions.
- ✅ `NOT EXISTS` is generally safer than `NOT IN` when `NULL`s are possible.
- ✅ Optimizers may transform correlated queries internally — always verify with the actual execution plan.
