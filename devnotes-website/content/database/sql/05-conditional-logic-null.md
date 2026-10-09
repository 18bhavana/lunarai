---
title: Conditional Logic and NULL Handling
subtitle: If-else inside SQL — understanding NULL, CASE (searched and simple), IF(), IFNULL(), NULLIF(), COALESCE(), nested CASE, conditional sorting and conditional aggregation.
order: 5
---

## Introduction

So far our queries have only **retrieved** data. Now you'll learn how to **transform data while querying it** — one of the most common topics in dashboards, reports, Spring Boot APIs, JPA native queries, banking projects and 5+ years interviews.

## Sample Employee Table

| id | name | department | salary | bonus | manager_id |
| --- | --- | --- | --- | --- | --- |
| 1 | Rahul | IT | 70000 | 5000 | 10 |
| 2 | Amit | HR | 50000 | NULL | NULL |
| 3 | Neha | IT | 90000 | 7000 | 10 |
| 4 | Raj | Finance | 60000 | NULL | 20 |
| 5 | Ankit | IT | 75000 | 4000 | 10 |

## Why Do We Need Conditional Logic?

Your manager asks: *show salary grades.* Instead of `Rahul | 70000`, they want `Rahul | Medium` — no Java code, no Spring Boot code, everything inside SQL.

```java
if (salary >= 80000)       grade = "High";
else if (salary >= 60000)  grade = "Medium";
else                       grade = "Low";
```

SQL equivalent:

```sql
CASE
    WHEN salary >= 80000 THEN 'High'
    WHEN salary >= 60000 THEN 'Medium'
    ELSE 'Low'
END
```

## Understanding NULL

One of the most misunderstood topics in SQL interviews. Many developers think `NULL` = empty. ❌ **Wrong.**

> [!IMPORTANT]
> `NULL` means **unknown / no value exists** — not zero, not an empty string.

| Question | NULL means |
| --- | --- |
| Employee joining date? | Unknown |
| Manager assigned? | Not assigned |
| Bonus? | Not available |

### Comparing with NULL

```sql
WHERE bonus = NULL;     -- ❌ returns no rows
WHERE bonus IS NULL;    -- ✅
```

## CASE Expression

The most important topic in this chapter.

```sql
CASE
    WHEN condition THEN result
    WHEN condition THEN result
    ELSE result
END
```

### Example 1 — Salary Grade

```sql
SELECT name,
       salary,
       CASE
           WHEN salary >= 80000 THEN 'High'
           WHEN salary >= 60000 THEN 'Medium'
           ELSE 'Low'
       END AS salary_grade
FROM employees;
```

| Name | Salary | Grade |
| --- | --- | --- |
| Rahul | 70000 | Medium |
| Amit | 50000 | Low |
| Neha | 90000 | High |

### How CASE Executes

MySQL checks conditions **from top to bottom**:

```flow-h Once a condition matches, the rest are skipped
salary = 90000
? >= 80000? | Yes: High — stop
```

(Without an `ELSE`, a row matching nothing gets `NULL`.)

### Example 2 — Simple CASE

```sql
SELECT name,
       CASE department
           WHEN 'IT'      THEN 'Technology'
           WHEN 'HR'      THEN 'Human Resources'
           WHEN 'Finance' THEN 'Accounts'
           ELSE 'Other'
       END
FROM employees;
```

This form compares a **single expression** (`department`) against different values.

## IF()

A MySQL-specific function: `IF(condition, true_value, false_value)`.

```sql
SELECT name,
       IF(salary >= 70000, 'Eligible', 'Not Eligible')
FROM employees;
```

Java equivalent: `salary >= 70000 ? "Eligible" : "Not Eligible"`.

### CASE vs IF

| CASE | IF |
| --- | --- |
| Standard SQL | MySQL-specific |
| Multiple conditions | Best for simple true/false |
| More portable | Shorter syntax |

> [!TIP]
> **Interview tip:** prefer `CASE` if you want SQL that works across different database systems.

## IFNULL()

Replace `NULL` with another value:

```sql
SELECT name,
       IFNULL(bonus, 0)
FROM employees;
```

Amit's bonus shows `0` instead of `NULL`. Very useful for reports.

## NULLIF()

Returns `NULL` if two expressions are **equal**; otherwise the first:

```sql
SELECT NULLIF(10, 10);   -- NULL
SELECT NULLIF(10, 20);   -- 10
```

### Why is NULLIF Useful? — Division by Zero

```sql
-- Risky if bonus can be 0
SELECT salary / bonus
FROM employees;

-- Explicit and portable
SELECT salary / NULLIF(bonus, 0)
FROM employees;
```

If `bonus` is `0`, `NULLIF` returns `NULL`, so the division yields `NULL` instead of dividing by zero.

> [!NOTE]
> In a MySQL `SELECT`, dividing by zero already returns `NULL` with a warning, but in strict mode it raises an error inside `INSERT`/`UPDATE`, and most other databases always raise an error. `NULLIF` makes the intent explicit and works everywhere.

## COALESCE()

One of the most asked interview functions. Returns the **first non-`NULL` value**:

```sql
SELECT COALESCE(NULL, NULL, 100, 200);   -- 100
```

### Real Example

| mobile | office_phone | home_phone |
| --- | --- | --- |
| NULL | 9876543210 | 9988776655 |

```sql
SELECT COALESCE(mobile, office_phone, home_phone)
FROM users;   -- 9876543210
```

MySQL checks left to right and returns the first value that isn't `NULL`.

### IFNULL vs COALESCE

| Function | Purpose |
| --- | --- |
| `IFNULL(a, b)` | Replace `NULL` with **one** fallback value (MySQL-specific) |
| `COALESCE(a, b, c, d)` | Return the first non-`NULL` value from **many** options (standard SQL) |

## Nested CASE

```sql
SELECT name,
       CASE
           WHEN department = 'IT' THEN
               CASE
                   WHEN salary >= 80000 THEN 'Senior IT'
                   ELSE 'Junior IT'
               END
           ELSE department
       END
FROM employees;
```

Useful, but use it sparingly. If the logic becomes too complex, consider handling part of it in the application layer.

## CASE in ORDER BY

Business wants IT first, then Finance, then HR:

```sql
SELECT *
FROM employees
ORDER BY CASE
             WHEN department = 'IT'      THEN 1
             WHEN department = 'Finance' THEN 2
             ELSE 3
         END;
```

This creates a **custom sort order**.

## Conditional Aggregation (Preview)

Aggregation is covered in detail later, but here's a sneak peek — total salary only for IT:

```sql
SELECT SUM(CASE
               WHEN department = 'IT' THEN salary
               ELSE 0
           END)
FROM employees;
```

This pattern appears frequently in dashboards and reporting.

## Real Spring Boot Examples

### Status Mapping

Stored statuses are `1`, `2`, `3`. Instead of converting in Java:

```sql
SELECT CASE status
           WHEN 1 THEN 'Pending'
           WHEN 2 THEN 'Approved'
           WHEN 3 THEN 'Rejected'
       END
FROM requests;
```

### Default Value

```sql
SELECT IFNULL(city, 'Unknown')
FROM users;
```

### Optional Contact Number

```sql
SELECT COALESCE(mobile, office_phone, home_phone, 'No Contact')
FROM users;
```

## Performance Tips

✅ Using `CASE` in the `SELECT` list is fine — it doesn't affect how rows are filtered.

❌ **Avoid wrapping indexed columns in functions in `WHERE`:**

```sql
-- ❌ The function hides the column from the index
WHERE IFNULL(status, 0) = 1;

-- ✅ Same result, index-friendly (NULL becomes 0, which is not 1)
WHERE status = 1;

-- If NULL should count as 1, i.e. IFNULL(status, 1) = 1:
WHERE status = 1 OR status IS NULL;
```

Wrapping an indexed column in a function often prevents MySQL from using the index efficiently.

## Interview Questions

### Q1. Difference between CASE and IF()?

`CASE` is standard SQL and supports many branches; `IF()` is a MySQL-specific function for a single true/false choice.

### Q2. Difference between IFNULL() and COALESCE()?

`IFNULL(a, b)` takes exactly two arguments and is MySQL-specific; `COALESCE()` takes any number of arguments, returns the first non-`NULL`, and is standard SQL.

### Q3. What does NULLIF() do?

It returns `NULL` when its two arguments are equal, otherwise the first argument — commonly used to avoid division by zero.

### Q4. Why can't we compare NULL using =?

Because `NULL` is unknown; any comparison with it evaluates to UNKNOWN rather than TRUE. Use `IS NULL`.

### Q5. Does CASE stop after the first matching condition?

Yes. Conditions are evaluated top to bottom, and the first match wins.

### Q6. Can CASE be used inside ORDER BY?

Yes — to define custom sort orders.

### Q7. What is conditional aggregation?

Using `CASE` inside an aggregate function (e.g. `SUM(CASE WHEN ... THEN x ELSE 0 END)`) to aggregate only the rows meeting a condition — often to build several metrics in one query.

### Q8. Which function would you use for multiple fallback values?

`COALESCE()`.

## Hands-On Assignment

Using the `employees` table:

1. Classify salaries as Low, Medium and High.
2. Display "No Bonus" if the bonus is `NULL`.
3. Display "No Manager" if `manager_id` is `NULL`.
4. Show "Technology" instead of "IT".
5. Display the first available phone number using `COALESCE()` (create sample columns if needed).
6. Sort employees with IT first, Finance second and everyone else last.
7. Write a query that avoids division by zero using `NULLIF()`.
8. Calculate the total salary paid only to IT employees using `CASE`.

### Challenge Problems

1. Create five salary bands using `CASE`.
2. Display "Experienced" if an employee has worked for more than three years; otherwise "New".
3. Replace every `NULL` salary with the department average (hint: you'll need subqueries — think about the approach first).
4. Use nested `CASE` to classify employees by both department and salary.
5. Return the first available contact from mobile, office, home, or "Not Available".

## Cheat Sheet

| Function | Purpose |
| --- | --- |
| `CASE` | Multiple conditional branches |
| `IF()` | Simple true/false condition (MySQL-specific) |
| `IFNULL()` | Replace `NULL` with one fallback value |
| `NULLIF()` | Return `NULL` if two expressions are equal |
| `COALESCE()` | Return the first non-`NULL` value |
| `IS NULL` | Check for `NULL` |
| `IS NOT NULL` | Check for non-`NULL` values |
