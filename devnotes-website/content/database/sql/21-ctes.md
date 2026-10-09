---
title: Common Table Expressions (CTEs)
subtitle: Named temporary result sets with WITH — single, multiple and chained CTEs, recursive CTEs for sequences and hierarchies, CTE vs subquery, temporary table and view, and materialization.
order: 21
---

## Introduction

**Common Table Expressions (CTEs)** are one of the most powerful SQL features in **MySQL 8.0+**. They make complex SQL cleaner, easier to debug, modular and more maintainable — which is why they're widely used in enterprise applications.

You'll learn what CTEs are and why they're useful; single, multiple and chained CTEs; recursive CTEs; CTEs vs subqueries vs temporary tables; enterprise reporting use cases; and performance considerations.

## What is a CTE?

> [!IMPORTANT]
> A **CTE** is a **temporary named result set** that exists only for the duration of a **single SQL statement**. Think of it as giving a name to a query's result so you can reference it in the main statement.

```sql
WITH cte_name AS (
    SELECT ...
)
SELECT *
FROM cte_name;
```

```flow-h
WITH cte
Run the CTE query
Named result set
Used by the main query
```

## Why Use CTEs?

Complex SQL often contains deeply nested subqueries — `SELECT (SELECT (SELECT ...))` — which become hard to read, debug and maintain, and difficult to follow in code reviews. With CTEs:

```flow-h Complex logic becomes much easier to understand
Step 1: build data
Step 2: transform data
Step 3: final output
```

## Employee Table

| Employee ID | Name | Department | Salary |
| --- | --- | --- | --- |
| 101 | John | IT | 70000 |
| 102 | David | IT | 90000 |
| 103 | Lisa | HR | 50000 |
| 104 | Alex | HR | 55000 |
| 105 | Mary | Finance | 80000 |
| 106 | Tom | Finance | 85000 |

## Simple CTE

```sql
WITH employee_cte AS (
    SELECT *
    FROM employee
)
SELECT *
FROM employee_cte;
```

The CTE `employee_cte` contains the result of `SELECT * FROM employee`, and the main query reads from it.

> [!NOTE]
> A CTE is **not** a permanent table. It exists only while the statement executes — afterwards it disappears.

## CTE with Filtering

Employees earning more than 70,000:

```sql
WITH high_salary_employees AS (
    SELECT *
    FROM employee
    WHERE salary > 70000
)
SELECT *
FROM high_salary_employees;
```

| Name | Salary |
| --- | --- |
| David | 90000 |
| Mary | 80000 |
| Tom | 85000 |

## CTE with Aggregation

A department-wise average salary report:

```sql
WITH department_salary AS (
    SELECT department,
           AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT *
FROM department_salary;
```

| Department | Avg salary |
| --- | --- |
| IT | 80000 |
| HR | 52500 |
| Finance | 82500 |

## Using a CTE in the Main Query

Employees earning more than their own department's average:

```sql
WITH department_salary AS (
    SELECT department,
           AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT e.*
FROM employee e
JOIN department_salary d
    ON e.department = d.department
WHERE e.salary > d.avg_salary;
```

| Name | Department | Salary |
| --- | --- | --- |
| David | IT | 90000 |
| Alex | HR | 55000 |
| Tom | Finance | 85000 |

### How the Query Works

1. **Run the CTE** → IT 80000, HR 52500, Finance 82500.
2. **Join employees with their department average** → John/IT/80000, David/IT/80000, Lisa/HR/52500, Alex/HR/52500, Mary/Finance/82500, Tom/Finance/82500.
3. **Apply `WHERE e.salary > d.avg_salary`** → David, Alex, Tom.

This is an alternative to the correlated subquery from the previous chapter.

## Multiple CTEs

```sql
WITH
    cte1 AS (
        SELECT ...
    ),
    cte2 AS (
        SELECT ...
    )
SELECT ...
```

```sql
WITH
    department_salary AS (
        SELECT department, AVG(salary) AS avg_salary
        FROM employee
        GROUP BY department
    ),
    high_salary_employees AS (
        SELECT *
        FROM employee
        WHERE salary > 70000
    )
SELECT *
FROM high_salary_employees;
```

> [!WARNING]
> Use **one** `WITH` keyword and separate CTEs with commas: `WITH cte1 AS (...), cte2 AS (...)`. Writing `WITH cte1 AS (...) WITH cte2 AS (...)` is a syntax error.

## Chained CTEs

One CTE can reference a **previously defined** CTE:

```sql
WITH
    department_salary AS (
        SELECT department, AVG(salary) AS avg_salary
        FROM employee
        GROUP BY department
    ),
    above_average_employees AS (
        SELECT e.*
        FROM employee e
        JOIN department_salary d
            ON e.department = d.department
        WHERE e.salary > d.avg_salary
    )
SELECT *
FROM above_average_employees;
```

```flow-h Extremely useful for building complex reports step by step
employee table
department_salary
above_average_employees
Final SELECT
```

## Multiple CTEs with a Final Join

Department average salary **and** employee count:

```sql
WITH
    department_salary AS (
        SELECT department, AVG(salary) AS avg_salary
        FROM employee
        GROUP BY department
    ),
    department_count AS (
        SELECT department, COUNT(*) AS employee_count
        FROM employee
        GROUP BY department
    )
SELECT ds.department,
       ds.avg_salary,
       dc.employee_count
FROM department_salary ds
JOIN department_count dc
    ON ds.department = dc.department;
```

| Department | Avg salary | Employee count |
| --- | --- | --- |
| IT | 80000 | 2 |
| HR | 52500 | 2 |
| Finance | 82500 | 2 |

## Recursive CTEs

A **recursive CTE** references **itself**. Useful for employee hierarchies, organization charts, category trees, folder structures, parent-child relationships, bills of materials, generating sequences and traversing hierarchical data.

```sql
WITH RECURSIVE cte_name AS (
    -- Anchor query
    SELECT ...

    UNION ALL

    -- Recursive query
    SELECT ...
    FROM cte_name
    WHERE ...
)
SELECT *
FROM cte_name;
```

It has two parts: an **anchor query** and a **recursive query**.

### Generate Numbers from 1 to 10

```sql
WITH RECURSIVE numbers AS (
    SELECT 1 AS num
    UNION ALL
    SELECT num + 1
    FROM numbers
    WHERE num < 10
)
SELECT *
FROM numbers;
```

```output
1
2
3
4
5
6
7
8
9
10
```

### Understanding Recursive Execution

```flow
Anchor: SELECT 1 AS num → 1
: recursive member
1 → 2 → 3 → … → 9 → 10
? num < 10? | Yes: Generate the next row | No (num = 10): Recursion stops
```

### Anchor Member vs Recursive Member

| Part | SQL | Role |
| --- | --- | --- |
| **Anchor member** | `SELECT 1 AS num` | Creates the starting row(s) |
| **Recursive member** | `SELECT num + 1 FROM numbers WHERE num < 10` | References the CTE itself and generates more rows |

> [!TIP]
> The **anchor** determines the column types. If the recursive part builds longer strings (e.g. a path like `CEO > Manager A`), `CAST` the anchor column to a wide enough type, or values get truncated.

## Employee Hierarchy Example

| Employee ID | Employee name | Manager ID |
| --- | --- | --- |
| 1 | CEO | NULL |
| 2 | Manager A | 1 |
| 3 | Manager B | 1 |
| 4 | Developer A | 2 |
| 5 | Developer B | 2 |
| 6 | Developer C | 3 |

```tree
CEO
  Manager A
    Developer A
    Developer B
  Manager B
    Developer C
```

### Recursive CTE for the Hierarchy

```sql
WITH RECURSIVE employee_tree AS (
    SELECT employee_id,
           employee_name,
           manager_id
    FROM employee
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.employee_id,
           e.employee_name,
           e.manager_id
    FROM employee e
    JOIN employee_tree et
        ON e.manager_id = et.employee_id
)
SELECT *
FROM employee_tree;
```

```flow-h One of the most important recursive CTE interview questions
Anchor: CEO
Employees whose manager is the CEO: Manager A, Manager B
Employees reporting to them: Developer A, B, C
```

### Adding the Hierarchy Level

```sql
WITH RECURSIVE employee_tree AS (
    SELECT employee_id,
           employee_name,
           manager_id,
           1 AS level
    FROM employee
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.employee_id,
           e.employee_name,
           e.manager_id,
           et.level + 1
    FROM employee e
    JOIN employee_tree et
        ON e.manager_id = et.employee_id
)
SELECT *
FROM employee_tree;
```

| Employee | Level |
| --- | --- |
| CEO | 1 |
| Manager A | 2 |
| Manager B | 2 |
| Developer A | 3 |
| Developer B | 3 |
| Developer C | 3 |

## CTE vs Subquery

| CTE | Subquery |
| --- | --- |
| Easier to read | Can become deeply nested |
| Organizes complex logic | Good for simple nested logic |
| Referenced by name (even several times) | Usually written inline |
| Supports recursion | No recursive behaviour |
| Easier to debug conceptually | Deep nesting is harder to debug |
| Excellent for complex reports | Excellent for simple lookups |

> [!IMPORTANT]
> A CTE is **not automatically faster** than a subquery — the optimizer chooses the execution strategy. Use CTEs for **readability, maintainability, modularity and recursive logic**.

## CTE vs Temporary Table

| CTE | Temporary table |
| --- | --- |
| Exists for one SQL statement | Usually exists for the session |
| No explicit cleanup | May require cleanup |
| Defined inside the query | Created separately |
| Good for logical query organization | Good for multi-step processing |
| Can be recursive | Stores intermediate results |
| Not reusable by separate statements | Reusable across statements |

```sql
-- CTE
WITH employee_cte AS (SELECT * FROM employee)
SELECT * FROM employee_cte;

-- Temporary table
CREATE TEMPORARY TABLE temp_employee AS
SELECT * FROM employee;

SELECT * FROM temp_employee;
```

## CTE vs View

| CTE | View |
| --- | --- |
| Exists for one statement | Stored as a database object |
| Temporary query structure | Reusable across queries |
| No database object created | Created with `CREATE VIEW` |
| Good for query-specific logic | Good for reusable database logic |

## Real-World Business Examples

```sql
-- 1. Department salary report
WITH department_salary AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT * FROM department_salary;

-- 2. Monthly revenue
WITH monthly_revenue AS (
    SELECT YEAR(order_date)  AS order_year,
           MONTH(order_date) AS order_month,
           SUM(amount)       AS revenue
    FROM orders
    GROUP BY YEAR(order_date), MONTH(order_date)
)
SELECT *
FROM monthly_revenue
ORDER BY order_year, order_month;

-- 3. Top 10 customers by total revenue
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
)
SELECT *
FROM customer_revenue
ORDER BY revenue DESC
LIMIT 10;

-- 4. Product sales dashboard
WITH product_sales AS (
    SELECT product_id, SUM(quantity) AS total_sold
    FROM sales
    GROUP BY product_id
)
SELECT *
FROM product_sales
ORDER BY total_sold DESC;
```

In the monthly report, grouping only by `MONTH(order_date)` would combine January 2025 and January 2026 — production queries should group by **year and month**.

### Top 3 Highest-Paid Employees

```sql
WITH high_salary_employees AS (
    SELECT *
    FROM employee
)
SELECT *
FROM high_salary_employees
ORDER BY salary DESC
LIMIT 3;
```

A more useful CTE would first calculate or filter complex data before the final ranking.

## Replacing a Nested Subquery with a CTE

```sql
-- Subquery (derived table) version
SELECT *
FROM employee e
JOIN (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
) d ON e.department = d.department
WHERE e.salary > d.avg_salary;

-- CTE version
WITH department_salary AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT e.*
FROM employee e
JOIN department_salary d ON e.department = d.department
WHERE e.salary > d.avg_salary;
```

The CTE version separates the logical steps and is easier to understand.

## Performance Considerations

CTEs improve readability but aren't automatically faster than subqueries, derived tables or joins. MySQL's optimizer may **merge** the CTE into the main query or **materialize** it, depending on the query structure, MySQL version, indexes, the number of references, optimizer decisions and data volume.

### Materialization

```flow-h
Run the CTE
Store the intermediate result
Use the intermediate result
```

Materialization helps in some situations (e.g. a CTE referenced several times) but adds work in others. **Never assume a CTE automatically improves performance** — verify with `EXPLAIN` or `EXPLAIN ANALYZE`.

## Interview Questions

### Q1. Rewrite a subquery using a CTE.

```sql
WITH department_salary AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT * FROM department_salary;
```

### Q2. Employees above their department average.

```sql
WITH department_salary AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT e.*
FROM employee e
JOIN department_salary d ON e.department = d.department
WHERE e.salary > d.avg_salary;
```

### Q3. Top five customers.

```sql
WITH revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
)
SELECT *
FROM revenue
ORDER BY revenue DESC
LIMIT 5;
```

### Q4. Generate numbers from 1 to 10.

```sql
WITH RECURSIVE numbers AS (
    SELECT 1 AS num
    UNION ALL
    SELECT num + 1 FROM numbers WHERE num < 10
)
SELECT * FROM numbers;
```

### Q5. Build an employee hierarchy.

Use a recursive CTE whose anchor selects the employees with `manager_id IS NULL` and whose recursive member joins `employee e` to the CTE on `e.manager_id = et.employee_id`, carrying `et.level + 1` (see *Adding the Hierarchy Level* above).

### Q6. What is a CTE, in one line?

A temporary named result set, defined with `WITH`, that exists for a single statement and organizes complex queries into readable logical steps.

### Q7. What is a recursive CTE, in one line?

A CTE that references itself: an anchor query initializes the result and a recursive query repeatedly generates rows until a termination condition is reached.

## Common Mistakes

### Mistake 1 — Forgetting RECURSIVE

```sql
WITH numbers AS (          -- ❌ in MySQL, self-reference needs RECURSIVE
    SELECT 1
    UNION ALL
    SELECT num + 1 FROM numbers
)
```

Use `WITH RECURSIVE numbers AS (...)`.

### Mistake 2 — Infinite Recursion

`SELECT num + 1 FROM numbers;` has **no stopping condition**. Add one: `... WHERE num < 10`. Every recursive CTE must terminate — MySQL aborts it after `cte_max_recursion_depth` iterations (1000 by default) with an error.

### Mistake 3 — Using Multiple WITH Keywords

`WITH cte1 AS (...) WITH cte2 AS (...)` is wrong; write `WITH cte1 AS (...), cte2 AS (...)`.

### Mistake 4 — Using a CTE for Every Simple Query

`WITH employee_cte AS (SELECT * FROM employee) SELECT * FROM employee_cte;` when the requirement is simply `SELECT * FROM employee;`. CTEs should improve clarity, not add complexity.

### Mistake 5 — Assuming CTE Means Better Performance

**CTE = better query organization.** Performance depends on the execution plan.

## Mini Project

```sql
-- 1. A CTE for department average salaries
WITH department_salary AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT * FROM department_salary;

-- 2. Employees earning above their department average → David, Alex, Tom
WITH department_salary AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department
)
SELECT e.*
FROM employee e
JOIN department_salary d ON e.department = d.department
WHERE e.salary > d.avg_salary;

-- 3. The top three highest-paid employees → David, Tom, Mary
WITH ranked AS (SELECT * FROM employee)
SELECT * FROM ranked ORDER BY salary DESC LIMIT 3;

-- 4. Monthly revenue report
WITH monthly_revenue AS (
    SELECT YEAR(order_date) AS order_year, MONTH(order_date) AS order_month,
           SUM(amount) AS revenue
    FROM orders
    GROUP BY YEAR(order_date), MONTH(order_date)
)
SELECT * FROM monthly_revenue ORDER BY order_year, order_month;

-- 5. Numbers from 1 to 20
WITH RECURSIVE numbers AS (
    SELECT 1 AS num
    UNION ALL
    SELECT num + 1 FROM numbers WHERE num < 20
)
SELECT * FROM numbers;
```

6–7. Build the employee–manager hierarchy and add levels using the recursive `employee_tree` CTE shown above.

## Practice Problems

**Easy**

1. Create a simple CTE.
2. Filter employees using a CTE.
3. Build a department salary report.
4. Use a CTE with `ORDER BY`.
5. Use multiple CTEs.

**Medium**

1. Rewrite a nested subquery using a CTE.
2. Generate a customer revenue report.
3. Find the top-performing department.
4. Build a product sales summary.
5. Generate a recursive sequence.
6. Find employees earning above their department average.
7. Create multiple chained CTEs.

**Interview level**

1. Explain CTE vs subquery.
2. Explain CTE vs temporary table.
3. Explain CTE vs view.
4. Build an employee hierarchy using a recursive CTE.
5. Rewrite a correlated subquery using a CTE and `JOIN`.
6. Discuss when a CTE improves readability but not necessarily performance.
7. Explain anchor and recursive members.
8. Explain how infinite recursion can occur.

## Best Practices

- ✅ **Give CTEs meaningful names** — `department_salary`, `customer_revenue`, `monthly_sales`, `employee_hierarchy` — not `cte1`, `temp` or `data`.
- ✅ **Keep each CTE focused on one responsibility**: CTE 1 aggregates, CTE 2 filters, CTE 3 ranks, and the final query produces the output.
- ✅ Chain CTEs to build complex reports incrementally.
- ✅ Use recursive CTEs only when hierarchical or iterative logic is required — and always include a termination condition.
- ✅ Index columns used in joins, filters, grouping and hierarchical relationships.
- ✅ Validate performance with `EXPLAIN` / `EXPLAIN ANALYZE`.

## The CTE Mental Model

```sql
WITH
    step1 AS (...),
    step2 AS (SELECT ... FROM step1 ...),
    step3 AS (SELECT ... FROM step2 ...)
SELECT *
FROM step3;
```

Instead of one giant nested query, break the problem into **meaningful logical steps**. CTEs are common in financial reporting, banking analysis, HR analytics, sales dashboards, customer segmentation, inventory reporting, data warehousing, Spring Boot analytics APIs, BI systems, hierarchies and category trees.

## Key Takeaways

- ✅ A CTE is a temporary named result set for a single statement, defined with `WITH`.
- ✅ Separate multiple CTEs with commas; a CTE can reference earlier ones.
- ✅ Recursive CTEs reference themselves via an anchor member and a recursive member — ideal for hierarchies and sequences.
- ✅ CTEs aren't automatically faster; MySQL may merge or materialize them.
- ✅ Always inspect the execution plan for performance-critical queries.
