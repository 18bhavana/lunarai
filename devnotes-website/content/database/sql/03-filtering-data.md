---
title: Filtering Data
subtitle: The heart of SQL — WHERE, comparison and logical operators, operator precedence, BETWEEN, IN, LIKE, REGEXP, NULL handling, LIMIT/OFFSET and logical execution order.
order: 3
---

## Introduction

> [!IMPORTANT]
> The vast majority of SQL queries written in production use a `WHERE` clause.

Spring Boot APIs, JPA queries, Hibernate, reports, dashboards, admin portals — everything revolves around **filtering data**.

## Sample Table

We'll use this `employees` table throughout the chapter:

| id | name | department | salary | city | manager_id |
| --- | --- | --- | --- | --- | --- |
| 1 | Rahul | IT | 70000 | Bangalore | 10 |
| 2 | Amit | HR | 50000 | Delhi | NULL |
| 3 | Neha | IT | 90000 | Mumbai | 10 |
| 4 | Raj | Finance | 60000 | Bangalore | 20 |
| 5 | Ankit | IT | 75000 | Chennai | 10 |

## WHERE Clause

Without `WHERE`, `SELECT * FROM employees;` returns **all** employees. With it:

```sql
SELECT *
FROM employees
WHERE department = 'IT';
```

```output
Rahul
Neha
Ankit
```

### Think Like Java

```sql
WHERE salary > 50000
```

```java
if (employee.getSalary() > 50000) {
    // include employee
}
```

A `WHERE` clause is essentially a **filter condition**.

## Comparison Operators

| Operator | Meaning |
| --- | --- |
| `=` | Equal |
| `!=` or `<>` | Not equal |
| `>` | Greater than |
| `>=` | Greater than or equal |
| `<` | Less than |
| `<=` | Less than or equal |

```sql
SELECT *
FROM employees
WHERE salary > 70000;
```

```output
Neha
Ankit
```

## Logical Operators

### AND — All Conditions Must Be True

```sql
SELECT *
FROM employees
WHERE department = 'IT'
  AND salary > 70000;
```

```output
Neha
Ankit
```

Java equivalent: `if (department.equals("IT") && salary > 70000)`.

### OR — Either Condition Can Be True

```sql
SELECT *
FROM employees
WHERE city = 'Delhi'
   OR city = 'Mumbai';
```

```output
Amit
Neha
```

Java equivalent: `if (city.equals("Delhi") || city.equals("Mumbai"))`.

### NOT — Reverse the Condition

```sql
SELECT *
FROM employees
WHERE NOT department = 'HR';
```

Everyone except HR employees.

### Combining AND and OR

```sql
SELECT *
FROM employees
WHERE department = 'IT'
  AND city = 'Bangalore';      -- Rahul

SELECT *
FROM employees
WHERE department = 'IT'
   OR salary > 80000;          -- Rahul, Neha, Ankit
```

### Parentheses Matter

```sql
-- ❌ Ambiguous
SELECT *
FROM employees
WHERE department = 'IT'
   OR city = 'Delhi'
  AND salary > 70000;
```

SQL evaluates **`AND` before `OR`**, so this means *IT **OR** (Delhi **AND** salary > 70000)*.

```sql
-- ✅ Correct
SELECT *
FROM employees
WHERE (department = 'IT' OR city = 'Delhi')
  AND salary > 70000;
```

> [!TIP]
> Always use parentheses for complex conditions.

## BETWEEN

Instead of `salary >= 50000 AND salary <= 70000`:

```sql
SELECT *
FROM employees
WHERE salary BETWEEN 50000 AND 70000;
```

Much cleaner — and **inclusive** on both ends.

### Dates

```sql
SELECT *
FROM orders
WHERE order_date BETWEEN '2026-01-01' AND '2026-01-31';
```

Very common in reporting.

> [!WARNING]
> If `order_date` is a `DATETIME`, `'2026-01-31'` means midnight at the start of Jan 31, so orders later that day are excluded. Prefer a half-open range: `order_date >= '2026-01-01' AND order_date < '2026-02-01'`.

## IN and NOT IN

Instead of `city = 'Delhi' OR city = 'Mumbai' OR city = 'Bangalore'`:

```sql
SELECT *
FROM employees
WHERE city IN ('Delhi', 'Mumbai', 'Bangalore');

SELECT *
FROM employees
WHERE city NOT IN ('Delhi', 'Mumbai');
```

Cleaner and easier to maintain.

> [!WARNING]
> If the `NOT IN` list (or subquery) contains a `NULL`, the condition is never true and the query returns **no rows**.

## LIKE

Pattern matching with wildcards:

| Symbol | Meaning |
| --- | --- |
| `%` | Zero or more characters |
| `_` | Exactly one character |

```sql
SELECT *
FROM employees
WHERE name LIKE 'R%';    -- starts with R: Rahul, Raj
```

| Pattern | Meaning |
| --- | --- |
| `LIKE 'R%'` | Starts with R |
| `LIKE '%a'` | Ends with a |
| `LIKE '%ah%'` | Contains "ah" |
| `LIKE '_a%'` | Second character is "a" (Rahul, Raj, Ram) |
| `LIKE '_a_'` | Exactly three characters, "a" in the middle (Raj, Ram — not Rahul) |

> [!NOTE]
> With MySQL's default (case-insensitive) collations, `LIKE 'r%'` also matches `Rahul`.

## REGEXP

Much more powerful than `LIKE`:

| Pattern | Meaning |
| --- | --- |
| `WHERE name REGEXP '^R'` | Starts with R |
| `WHERE name REGEXP 'a$'` | Ends with a |
| `REGEXP '[0-9]'` | Contains digits |
| `REGEXP '[A-Z]{2}'` | Two letters in a row (case-insensitive by default) |

Mostly used for validations and advanced searches. Use a binary/case-sensitive comparison (e.g. `REGEXP BINARY` or `REGEXP_LIKE(col, pattern, 'c')`) if case matters.

## NULL Handling

Suppose `manager_id` is 10, 20 or `NULL`. This is **wrong**:

```sql
WHERE manager_id = NULL      -- returns nothing
```

Correct:

```sql
WHERE manager_id IS NULL;
WHERE manager_id IS NOT NULL;
```

**Why?** `NULL` means *unknown*, not a value. Any comparison with `NULL` evaluates to **UNKNOWN**, not `TRUE`.

## LIMIT and OFFSET

```sql
-- First five employees
SELECT *
FROM employees
LIMIT 5;

-- Pagination: skip the first 20 rows, return the next 10
SELECT *
FROM employees
LIMIT 10 OFFSET 20;
```

In Spring Boot, `PageRequest.of(2, 10)` (page index 2, size 10) produces SQL similar to `LIMIT 10 OFFSET 20`.

> [!TIP]
> Without an `ORDER BY`, the order of rows — and therefore which rows land on each page — is not guaranteed.

## Logical Execution Order

Many developers think SQL executes top to bottom. Actually:

```sql
SELECT name
FROM employees
WHERE salary > 70000
ORDER BY salary;
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

This explains why aliases from the `SELECT` list usually **can't be referenced in `WHERE`** — `WHERE` is evaluated before `SELECT`.

## Real Spring Boot Example

```java
List<Employee> findByDepartmentAndSalaryGreaterThan(String department, Double salary);
```

Generated SQL:

```sql
SELECT *
FROM employees
WHERE department = ?
  AND salary > ?;
```

JPQL:

```java
@Query("""
        SELECT e
        FROM Employee e
        WHERE e.salary > :salary
        """)
```

becomes SQL similar to `SELECT * FROM employees WHERE salary > ?`. Understanding SQL makes debugging JPA much easier.

## Performance Tips

✅ `WHERE salary = 50000` uses an index efficiently (if one exists).

❌ **Avoid wrapping indexed columns in functions:**

```sql
WHERE YEAR(joining_date) = 2026
```

This often **prevents index usage**. Prefer:

```sql
WHERE joining_date >= '2026-01-01'
  AND joining_date <  '2027-01-01'
```

(More on this in the indexing chapter.) And avoid `SELECT *` — fetch only the needed columns.

## Interview Questions

### Q1. Difference between WHERE and HAVING?

`WHERE` filters **rows** before grouping; `HAVING` filters **groups** after `GROUP BY` and can use aggregates like `COUNT(*)`.

### Q2. IN vs EXISTS?

`IN` compares a value against a list or subquery result; `EXISTS` checks whether a correlated subquery returns any row. Covered in detail in the subqueries chapters.

### Q3. Difference between LIKE and REGEXP?

`LIKE` supports only the `%` and `_` wildcards; `REGEXP` supports full regular expressions (anchors, character classes, repetition).

### Q4. Why can't we use = with NULL?

Because `NULL` is unknown — `x = NULL` evaluates to UNKNOWN, never TRUE. Use `IS NULL` / `IS NOT NULL`.

### Q5. BETWEEN vs >= and <=?

They're equivalent: `BETWEEN a AND b` is inclusive on both ends. For datetimes, an explicit half-open range (`>= start AND < next`) is safer.

### Q6. Difference between % and _ in LIKE?

`%` matches zero or more characters; `_` matches exactly one.

### Q7. Why are parentheses important with AND and OR?

Because `AND` binds more tightly than `OR`; without parentheses, the condition may be grouped differently from what you intended.

### Q8. Why is WHERE YEAR(date_column) = 2026 often slower than a date range filter?

Applying a function to the column prevents MySQL from using an index on it, forcing it to evaluate every row; a range on the raw column can use the index.

## Hands-On Assignment

Using the `employees` table, write queries to:

1. Find employees in the IT department.
2. Find employees with salary greater than 70,000.
3. Find employees in Bangalore with salary above 60,000.
4. Find employees whose names start with "R".
5. Find employees whose names contain "ah".
6. Find employees without a manager.
7. Find employees from Bangalore, Chennai or Delhi.
8. Find employees whose salary is between 60,000 and 80,000.
9. Display the first three employees.
10. Display the next three employees after skipping the first three.

### Challenge Problems

1. Find employees not in the IT department.
2. Find names ending with `t`.
3. Find names having exactly 5 characters.
4. Find employees with a `NULL` manager and salary greater than 50,000.
5. Find employees who are either in Finance or have a salary above 80,000.
6. Write one query using `AND`, `OR` and `NOT` together with parentheses.

## Cheat Sheet

| Clause | Purpose |
| --- | --- |
| `WHERE` | Filter rows |
| `=` | Equal |
| `<>` / `!=` | Not equal |
| `AND` | All conditions must be true |
| `OR` | At least one condition must be true |
| `NOT` | Negate a condition |
| `BETWEEN` | Range filtering (inclusive) |
| `IN` | Match against a list of values |
| `LIKE` | Simple pattern matching |
| `REGEXP` | Advanced pattern matching |
| `IS NULL` | Find `NULL` values |
| `IS NOT NULL` | Find non-`NULL` values |
| `LIMIT` | Restrict the number of rows |
| `OFFSET` | Skip rows before returning results |
