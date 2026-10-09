---
title: Subqueries
subtitle: Queries inside queries — single-row and multi-row subqueries, IN, NOT IN and the NULL trap, EXISTS and NOT EXISTS, ANY and ALL, scalar subqueries, derived tables, nesting, second-highest salary and subquery vs JOIN.
order: 19
---

## Introduction

This chapter opens the **advanced SQL** phase with one of its most important topics: **subqueries**, also called **nested queries** — heavily used in banking, payroll, e-commerce, HRMS, reporting systems, analytics dashboards, Spring Boot backend APIs and SQL interviews.

By the end you'll confidently use single-row and multi-row subqueries; subqueries in `WHERE`, `SELECT` and `FROM`; nested subqueries; `IN`, `NOT IN`, `EXISTS`, `NOT EXISTS`, `ANY` and `ALL`; scalar subqueries and derived tables — and you'll know the `NOT IN` + `NULL` problem and the performance considerations.

## What Is a Subquery?

> [!IMPORTANT]
> A **subquery** is a query **inside** another SQL query.

```sql
SELECT *
FROM employees
WHERE salary > (
    SELECT AVG(salary)
    FROM employees
);
```

`SELECT AVG(salary) FROM employees` is the **inner query** (subquery); `SELECT * FROM employees WHERE salary > (...)` is the **outer query**.

```flow-h
Outer query needs a value or result set
Subquery produces it
Outer query uses the result
```

If the average salary is 69,000, the query conceptually becomes `SELECT * FROM employees WHERE salary > 69000;`.

> [!NOTE]
> For a simple **non-correlated** subquery, it helps to think of the inner query as producing a result the outer query uses. But SQL is declarative — the optimizer may transform or execute it differently. In a **correlated** subquery (next chapter), the inner query depends on values from the outer query.

## Sample Employee Table

| Employee ID | Name | Department | Salary |
| --- | --- | --- | --- |
| 101 | John | IT | 70000 |
| 102 | David | IT | 90000 |
| 103 | Lisa | HR | 50000 |
| 104 | Alex | HR | 55000 |
| 105 | Mary | Finance | 80000 |

## Types of Subqueries

```tree
Subqueries
  By rows returned
    Single-row
    Multi-row
  By position
    In WHERE
    In SELECT
    In FROM
  By dependency
    Non-correlated
    Correlated
```

## Single-Row Subqueries

A single-row subquery returns **exactly one row**, and is used with `=`, `>`, `<`, `>=`, `<=` or `<>`.

### Highest-Paid Employee

```sql
SELECT *
FROM employees
WHERE salary = (
    SELECT MAX(salary)
    FROM employees
);
```

The inner query returns `90000`, so the outer query becomes `WHERE salary = 90000` → **David, 90000**.

### Why Not Just ORDER BY + LIMIT?

`SELECT * FROM employees ORDER BY salary DESC LIMIT 1;` also works — but if **two** employees earn 90000, the subquery version returns **all employees tied for the highest salary**, while `LIMIT 1` returns only one row.

### Lowest-Paid and Above-Average Employees

```sql
SELECT *
FROM employees
WHERE salary = (SELECT MIN(salary) FROM employees);

SELECT *
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);   -- above 69,000
```

## Multi-Row Subqueries

A multi-row subquery returns **several rows**, so you generally can't use `=` with it. Use `IN`, `ANY` or `ALL` instead.

If a subquery returns `IT` and `HR`, `WHERE department = (SELECT ...)` fails with *Subquery returns more than 1 row*; write `WHERE department IN (SELECT ...)` instead.

## IN with Subqueries

| Customer ID | Customer name |
| --- | --- |
| 101 | John |
| 102 | David |
| 103 | Lisa |
| 104 | Mary |

| Order ID | Customer ID | Amount |
| --- | --- | --- |
| 1 | 101 | 5000 |
| 2 | 102 | 8000 |
| 3 | 101 | 2500 |
| 4 | 103 | 7000 |

Find customers who placed at least one order:

```sql
SELECT *
FROM customers
WHERE customer_id IN (
    SELECT customer_id
    FROM orders
);
```

The subquery returns 101, 102, 101, 103; the outer query checks whether each `customer_id` is **present in** that result → **John, David, Lisa**.

### DISTINCT in an IN Subquery

You may write `IN (SELECT DISTINCT customer_id FROM orders)`, but don't add `DISTINCT` automatically — for membership, duplicates don't change the logical result, and the optimizer may already handle it efficiently. Check the execution plan.

## NOT IN

Find customers who never placed an order:

```sql
SELECT *
FROM customers
WHERE customer_id NOT IN (
    SELECT customer_id
    FROM orders
);
```

Expected result: **Mary**. However, `NOT IN` has an extremely important problem.

## The NOT IN + NULL Problem

Suppose the subquery returns 101, 102, 103 **and `NULL`**:

```sql
WHERE customer_id NOT IN (101, 102, 103, NULL)
```

SQL uses **three-valued logic** — TRUE, FALSE and UNKNOWN. `customer_id <> NULL` is always UNKNOWN, so `NOT IN` + `NULL` makes the condition **never true** and the query **returns no rows** — even though Mary has no orders.

### Safer Solution — NOT EXISTS

```sql
SELECT *
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

> [!IMPORTANT]
> Be careful with `NOT IN` whenever `NULL` is possible; `NOT EXISTS` is usually the safer choice for anti-matching. One of the most important SQL interview concepts.

You could filter `NULL`s explicitly (`... WHERE customer_id IS NOT NULL`), but when the requirement is *rows with no matching related row*, `NOT EXISTS` is clearer.

## EXISTS

`EXISTS` checks whether the subquery returns **at least one row**:

```sql
SELECT *
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

For each customer it asks: *does at least one matching order exist?* Yes → return the customer; no → skip it.

### Why SELECT 1?

A common interview question. `EXISTS` cares only about **whether a row exists**, not what the row contains — so `SELECT 1` clearly says *"I only care about existence."* `SELECT *` inside `EXISTS` behaves the same; `SELECT 1` is just a clear, widely used convention.

## NOT EXISTS

`NOT EXISTS` is true when **no matching row exists**:

```sql
SELECT *
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);   -- Mary
```

| Customer | Matching order? | NOT EXISTS |
| --- | --- | --- |
| 101 | Yes | FALSE |
| 104 | No | TRUE |

## IN vs EXISTS

```sql
-- IN: is this value present in the result set?
SELECT *
FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders);

-- EXISTS: does at least one matching row exist?
SELECT *
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id
);
```

### Performance

A common oversimplification is *"EXISTS is always faster than IN."* **Not universally true.** Modern MySQL optimizers transform many `IN`, `EXISTS` and `JOIN` queries (semi-join strategies). Performance depends on table sizes, indexes, data distribution, query structure, MySQL version and the execution plan.

```flow-h
Write correct, clear SQL
Add appropriate indexes
Check EXPLAIN
Measure actual performance
```

## NOT IN vs NOT EXISTS

| NOT IN | NOT EXISTS |
| --- | --- |
| A `NULL` in the subquery result causes UNKNOWN logic (often no rows) | Not affected by that `NULL` trap |
| Fine when the column is guaranteed `NOT NULL` | Safer and clearer for anti-matching |

For anti-matching requirements — customers without orders, products never sold, employees without assignments — `NOT EXISTS` is often the safer and clearer choice.

## ANY

`ANY` means the comparison must be true for **at least one** value. HR salaries are 50000 and 55000:

```sql
SELECT *
FROM employees
WHERE salary > ANY (
    SELECT salary
    FROM employees
    WHERE department = 'HR'
);
```

*Salary greater than at least one HR salary.* Since the smallest HR salary is 50000, any salary above it qualifies — for this comparison, `> ANY(...)` is conceptually like comparing with `MIN(...)` (for a non-empty subquery, with `NULL`s handled).

## ALL

`ALL` means the comparison must be true for **every** value:

```sql
SELECT *
FROM employees
WHERE salary > ALL (
    SELECT salary
    FROM employees
    WHERE department = 'HR'
);
```

The employee must earn more than **every** HR employee — more than 55000. For this comparison, `> ALL(...)` is conceptually like comparing with `MAX(...)`.

### ANY vs ALL

| Expression | Result | Why |
| --- | --- | --- |
| `65 > ANY (50, 60, 70)` | TRUE | 65 > 50 |
| `65 > ALL (50, 60, 70)` | FALSE | 65 > 70 is false |

> [!NOTE]
> **Empty subquery:** a comparison with `ANY` (empty set) is FALSE, while with `ALL` (empty set) it's TRUE — an advanced interview detail. `NULL` values in the subquery can also affect quantified comparisons.

## Subqueries in WHERE

The most common location — comparing against aggregates, membership checks, existence checks and filtering based on another table:

```sql
SELECT * FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);
SELECT * FROM employees WHERE salary = (SELECT MAX(salary) FROM employees);
SELECT * FROM customers WHERE customer_id IN (SELECT customer_id FROM orders);
```

## Subqueries in SELECT — Scalar Subqueries

```sql
SELECT name,
       salary,
       (SELECT AVG(salary) FROM employees) AS company_average
FROM employees;
```

| Name | Salary | Company average |
| --- | --- | --- |
| John | 70000 | 69000 |
| David | 90000 | 69000 |
| Lisa | 50000 | 69000 |
| Alex | 55000 | 69000 |
| Mary | 80000 | 69000 |

The subquery returns **one value**, displayed beside every row. A subquery used where a single value is expected is a **scalar subquery** — it must return **at most one row**; otherwise MySQL raises *Subquery returns more than 1 row*.

```sql
SELECT order_id,
       amount,
       (SELECT AVG(amount) FROM orders) AS average_order_amount
FROM orders;
```

Useful for reports that compare each row with a company-wide metric.

## Subqueries in FROM — Derived Tables

A subquery in the `FROM` clause creates a **derived table**:

```sql
SELECT AVG(department_total_salary)
FROM (
    SELECT department,
           SUM(salary) AS department_total_salary
    FROM employees
    GROUP BY department
) AS department_salary;
```

The inner query creates a temporary logical result:

| Department | Department total salary |
| --- | --- |
| IT | 160000 |
| HR | 105000 |
| Finance | 80000 |

The outer query then calculates the **average department payroll**.

> [!WARNING]
> In MySQL, **a derived table must have an alias**: `SELECT * FROM (SELECT * FROM employees) AS e;`

```flow-h
Inner query creates a result set
Outer query treats it like a table
```

```sql
SELECT *
FROM (
    SELECT department,
           AVG(salary) AS average_salary
    FROM employees
    GROUP BY department
) AS department_average
WHERE average_salary > 60000;
```

First calculate the average salary per department, then keep departments averaging above 60,000.

## Nested Subqueries

A subquery can contain another subquery:

```sql
SELECT *
FROM employees
WHERE department = (
    SELECT department
    FROM employees
    WHERE salary = (
        SELECT MAX(salary)
        FROM employees
    )
);
```

```flow-h Result: John, David
Find the maximum salary (90000)
Find that employee's department (IT)
Find all employees in IT
```

### An Important Problem with This Query

If several top earners belong to **different** departments, the middle subquery returns multiple rows — but the outer query uses `=`, which expects a single value. Safer:

```sql
SELECT *
FROM employees
WHERE department IN (
    SELECT department
    FROM employees
    WHERE salary = (SELECT MAX(salary) FROM employees)
);
```

Choose operators based on **how many rows the subquery can return**.

## Real-World Business Examples

### 1. Highest-Revenue Customer

```sql
SELECT *
FROM customers
WHERE customer_id = (
    SELECT customer_id
    FROM orders
    GROUP BY customer_id
    ORDER BY SUM(amount) DESC
    LIMIT 1
);
```

This returns one customer — if several are tied, `LIMIT 1` returns only one. A tie-safe version with nested aggregation:

```sql
SELECT c.*
FROM customers c
WHERE c.customer_id IN (
    SELECT customer_id
    FROM orders
    GROUP BY customer_id
    HAVING SUM(amount) = (
        SELECT MAX(total_amount)
        FROM (
            SELECT customer_id, SUM(amount) AS total_amount
            FROM orders
            GROUP BY customer_id
        ) AS customer_totals
    )
);
```

(MySQL doesn't allow `LIMIT` inside an `IN`/`ANY`/`ALL` subquery, which is one more reason for this form.) Window functions make ranking problems much cleaner later.

### 2. Products Never Sold

```sql
SELECT *
FROM products p
WHERE NOT EXISTS (
    SELECT 1
    FROM sales s
    WHERE s.product_id = p.product_id
);
```

### 3. Employees Above the Company Average

```sql
SELECT *
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
```

**Company** average ≠ **department** average. Comparing each employee with their own department's average needs a correlated subquery (next chapter) or another advanced technique.

### 4. Customers with Orders

```sql
SELECT *
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

### 5. Highest Monthly Revenue

```sql
SELECT *
FROM monthly_sales
WHERE revenue = (SELECT MAX(revenue) FROM monthly_sales);
```

Returns **all** months tied for the highest revenue.

### 6. Orders Above the Average Order Amount

```sql
SELECT *
FROM orders
WHERE amount > (SELECT AVG(amount) FROM orders);
```

### 7. Departments Above the Company-Average Salary

```sql
SELECT department,
       AVG(salary) AS department_average
FROM employees
GROUP BY department
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees);
```

Subqueries can also be used inside **`HAVING`** conditions.

## Second-Highest Salary

One of the most frequently asked SQL interview questions.

```sql
SELECT MAX(salary) AS second_highest_salary
FROM employees
WHERE salary < (
    SELECT MAX(salary)
    FROM employees
);
```

```flow-h Result: 80000
Find the highest salary (90000)
Find the maximum salary below 90000
```

### Employee(s) with the Second-Highest Salary

```sql
SELECT *
FROM employees
WHERE salary = (
    SELECT MAX(salary)
    FROM employees
    WHERE salary < (SELECT MAX(salary) FROM employees)
);
```

Returns **all employees tied** at the second-highest distinct salary. With salaries 90000, 90000, 80000, 70000, the second-highest **distinct** salary is **80000**, not 90000 — the `MAX()` approach handles distinct levels naturally.

## Department with the Highest Payroll

```sql
SELECT department,
       SUM(salary) AS total_salary
FROM employees
GROUP BY department
HAVING SUM(salary) = (
    SELECT MAX(department_total)
    FROM (
        SELECT SUM(salary) AS department_total
        FROM employees
        GROUP BY department
    ) AS department_totals
);
```

Returns every department tied for the highest payroll.

## Performance Considerations

Not every problem should automatically be solved with a subquery. Alternatives include JOINs, CTEs, window functions, pre-aggregated tables and proper indexes.

```sql
-- Subquery
SELECT * FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders);

-- JOIN (needs DISTINCT, because a customer can have many orders)
SELECT DISTINCT c.*
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id;

-- EXISTS
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

All three express similar requirements. The best choice depends on **correctness, readability, duplicates, `NULL` semantics, indexes, the execution plan and actual performance**.

## Subquery vs JOIN

**A subquery** is often natural when comparing against an aggregate, checking membership or existence, or using one query's result to filter another:

```sql
SELECT * FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);
```

**A JOIN** is often natural when combining **columns** from multiple related tables:

```sql
SELECT c.customer_name, o.order_id, o.amount
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id;
```

> [!TIP]
> **Interview answer:** don't say *"JOIN is always faster than a subquery"* or *"EXISTS is always faster than IN."* Say: *the best approach depends on the query, indexes, data distribution, optimizer decisions and the execution plan* — and check with `EXPLAIN`.

## Interview Questions

### Q1. Find employees earning above the average salary.

```sql
SELECT * FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
```

### Q2. Find the highest-paid employee.

```sql
SELECT * FROM employees
WHERE salary = (SELECT MAX(salary) FROM employees);
```

### Q3. Find the lowest-paid employee.

```sql
SELECT * FROM employees
WHERE salary = (SELECT MIN(salary) FROM employees);
```

### Q4. Find customers who never placed an order.

```sql
SELECT * FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

### Q5. Find products that were sold.

```sql
SELECT * FROM products p
WHERE EXISTS (SELECT 1 FROM sales s WHERE s.product_id = p.product_id);
```

### Q6. Display the company average salary beside every employee.

```sql
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) AS company_average
FROM employees;
```

### Q7. Find the second-highest salary.

```sql
SELECT MAX(salary) AS second_highest_salary
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

### Q8. What is a scalar subquery?

A subquery used where **one value** is expected — e.g. `WHERE salary > (SELECT AVG(salary) FROM employees)`.

### Q9. What is a derived table?

A **subquery in the `FROM` clause** whose result the outer query treats like a table (it needs an alias).

### Q10. Why is NOT EXISTS often safer than NOT IN?

Because `NOT IN` + a `NULL` in the subquery result produces UNKNOWN logic (usually no rows); `NOT EXISTS` avoids that trap.

### Q11. What is the difference between ANY and ALL?

`ANY` — the condition must be true for at least one value; `ALL` — it must be true for every value.

### Q12. Can a subquery be used in SELECT, FROM and WHERE?

Yes — those are the common locations, and subqueries can appear in other valid contexts such as `HAVING`.

## Common Mistakes

- ❌ **Using `=` with multiple rows** — `WHERE department = (SELECT department FROM employees)` fails with *Subquery returns more than 1 row*. Use `IN (...)` when that matches the requirement.
- ❌ **Using `NOT IN` without considering `NULL`** — prefer `NOT EXISTS`.
- ❌ **Assuming the subquery always executes first physically** — that's a useful logical model for simple non-correlated subqueries, but SQL describes *what* result you want; the optimizer decides *how*.
- ❌ **Using a subquery when a simple query is enough** — e.g. `WHERE salary = (SELECT salary FROM employees WHERE employee_id = 101)` may be valid, but don't nest without a reason.
- ❌ **Ignoring duplicate rows in JOIN rewrites** — `SELECT c.* FROM customers c JOIN orders o ...` returns a customer once per order; `EXISTS` returns each customer once.
- ❌ **Assuming `EXISTS` is always faster** — verify with `EXPLAIN` and measurements.
- ❌ **Forgetting derived-table aliases** — `SELECT * FROM (SELECT * FROM employees);` is an error; add `AS e`.

## Mini Project

Using the employees table (John IT 70000, David IT 90000, Lisa HR 50000, Alex HR 55000, Mary Finance 80000) and orders (101 → 5000, 102 → 8000, 101 → 2500, 103 → 7000):

```sql
-- 1. Employees earning above the company average
SELECT * FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- 2. The highest-paid employee
SELECT * FROM employees
WHERE salary = (SELECT MAX(salary) FROM employees);

-- 3. Customers with orders
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

-- 4. Customers without orders
SELECT * FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

-- 5. The department with the highest total salary
SELECT department, SUM(salary) AS total_salary
FROM employees
GROUP BY department
HAVING SUM(salary) = (
    SELECT MAX(department_total)
    FROM (SELECT SUM(salary) AS department_total
          FROM employees
          GROUP BY department) AS department_totals
);

-- 6. The company average beside every employee
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) AS company_average
FROM employees;
```

## Practice Problems

**Easy**

1. Find the employee with the highest salary.
2. Find the employee with the lowest salary.
3. Find employees above the company average salary.
4. Find customers who placed orders.
5. Find customers who never placed orders.
6. Find orders above the average order amount.
7. Display the company average salary beside every employee.

**Medium**

1. Find departments whose average salary exceeds 70,000.
2. Find products never sold.
3. Find customers whose purchase amount is above the average order amount.
4. Find the department with the highest payroll.
5. Find the second-highest distinct salary.
6. Find all employees earning the second-highest salary.
7. Find employees whose salary is greater than at least one HR employee.
8. Find employees whose salary is greater than every HR employee.

**Interview level**

1. Compare `IN` vs `EXISTS`.
2. Compare `NOT IN` vs `NOT EXISTS`.
3. Explain the `NOT IN` + `NULL` problem.
4. Explain scalar subqueries.
5. Explain derived tables.
6. Find the department with the highest average salary.
7. Find customers who placed at least one order without returning duplicates.
8. Rewrite an `IN` query using `EXISTS`.
9. Rewrite a subquery using a `JOIN`.
10. Explain when a `JOIN` is preferable to a subquery.
11. Explain why `EXISTS` isn't always faster than `IN`.
12. Explain `ANY` vs `ALL`.
13. Find all employees in the department of the highest-paid employee.
14. Handle multiple highest-paid employees in different departments.
15. Analyze a subquery using `EXPLAIN`.

## Best Practices

- ✅ Use subqueries when one query's result naturally feeds another.
- ✅ Choose operators based on how many rows the subquery can return — `=` only when a single value is expected; `IN` for membership.
- ✅ Use `EXISTS` when the requirement is naturally about existence, and prefer `NOT EXISTS` for anti-matching when `NULL` may affect `NOT IN`.
- ✅ Use aliases, and test complex subqueries independently.
- ✅ Understand duplicate behaviour when rewriting subqueries as joins.
- ✅ Don't assume `JOIN`, `IN` or `EXISTS` is always faster — use `EXPLAIN`, index join and filter columns, and optimize from evidence.

## Real Backend Example

`GET /api/customers/inactive` — customers who have never placed an order:

```sql
SELECT c.customer_id,
       c.customer_name,
       c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

Supporting index:

```sql
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
```

```flow
Read a customer
Check the indexed orders
? Matching order exists? | Yes: Exclude the customer | No: Return the customer
```

Extremely common for customers without orders, products never sold, employees without assignments, users without logins, accounts without transactions and events without bookings.

## Cheat Sheet

| Need | Pattern |
| --- | --- |
| Single value | Single-row / scalar subquery with `=`, `>`, `<`, … |
| Multiple values | `IN`, `ANY`, `ALL` |
| Check matching data exists | `EXISTS (SELECT 1 ... WHERE inner.fk = outer.pk)` |
| Find rows without matches | `NOT EXISTS (...)` |
| An intermediate result set | Subquery in `FROM` (derived table, with alias) |
| A value per outer row | Subquery in `SELECT` |
| Second-highest salary | `SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees)` |

> [!IMPORTANT]
> Production performance = **correct query + appropriate indexes + `EXPLAIN` + actual measurement.**
