---
title: Sorting and Built-in Functions
subtitle: ORDER BY with multiple columns, NULL ordering and custom CASE sorting, plus the string, numeric and date functions used in almost every production query.
order: 4
---

## Introduction

Now that you can create tables, run CRUD operations and filter data, it's time to **sort data** and use **built-in functions** to manipulate strings, numbers and dates. Almost every backend API uses `ORDER BY` or built-in functions.

## Sample Table

| id | name | department | salary | city | joining_date |
| --- | --- | --- | --- | --- | --- |
| 1 | Rahul | IT | 70000 | Bangalore | 2022-01-10 |
| 2 | Amit | HR | 50000 | Delhi | 2021-05-10 |
| 3 | Neha | IT | 90000 | Mumbai | 2020-09-10 |
| 4 | Raj | Finance | 60000 | Bangalore | 2023-02-10 |
| 5 | Ankit | IT | 75000 | Chennai | 2022-08-10 |

## ORDER BY

> [!IMPORTANT]
> By default, SQL does **not** guarantee the order of returned rows. If you need a specific order, always use `ORDER BY`.

### Ascending Order (Default)

```sql
SELECT *
FROM employees
ORDER BY salary;          -- same as ORDER BY salary ASC
```

| Name | Salary |
| --- | --- |
| Amit | 50000 |
| Raj | 60000 |
| Rahul | 70000 |
| Ankit | 75000 |
| Neha | 90000 |

### Descending Order

```sql
SELECT *
FROM employees
ORDER BY salary DESC;     -- highest salary first
```

> [!QUESTION] What is the default sorting order?
> `ASC` (ascending).

## Sorting by Multiple Columns

Department ascending, then salary descending:

```sql
SELECT *
FROM employees
ORDER BY department ASC,
         salary DESC;
```

```tree
Result
  Finance | Raj
  HR | Amit
  IT | Neha, Ankit, Rahul
```

The second column is used **only when the first column has duplicate values**.

## Sorting with NULL Values

| Name | Salary |
| --- | --- |
| Rahul | 70000 |
| Amit | NULL |
| Neha | 90000 |

In MySQL, **`NULL`s sort first in ascending order and last in descending order**. For consistent "NULLs last" behaviour:

```sql
SELECT *
FROM employees
ORDER BY salary IS NULL,   -- 0 for real values, 1 for NULL
         salary;
```

This pushes `NULL` values to the end in ascending order. (MySQL has no `NULLS FIRST` / `NULLS LAST` syntax.)

## CASE in ORDER BY

Real-world priority — IT first, then Finance, then HR — instead of alphabetical order:

```sql
SELECT *
FROM employees
ORDER BY CASE
             WHEN department = 'IT'      THEN 1
             WHEN department = 'Finance' THEN 2
             ELSE 3
         END;
```

Frequently used in dashboards and custom business sorting. (`ORDER BY FIELD(department, 'IT', 'Finance', 'HR')` is a MySQL shortcut for the same idea.)

## String Functions

### LENGTH() and CHAR_LENGTH()

```sql
SELECT name, LENGTH(name)
FROM employees;
```

| Name | Length |
| --- | --- |
| Rahul | 5 |
| Ankit | 5 |
| Neha | 4 |

> [!WARNING]
> `LENGTH()` returns the length in **bytes**; `CHAR_LENGTH()` returns the number of **characters**. They differ for multi-byte text — `LENGTH('é')` is 2 in `utf8mb4`, `CHAR_LENGTH('é')` is 1.

### UPPER() and LOWER()

```sql
SELECT UPPER(name) FROM employees;   -- RAHUL, AMIT, NEHA, ...
SELECT LOWER(name) FROM employees;
```

### CONCAT()

```sql
SELECT CONCAT(name, ' works in ', department)
FROM employees;                      -- Rahul works in IT
```

### SUBSTRING()

```sql
SELECT SUBSTRING(name, 1, 3)
FROM employees;                      -- Rah, Ami, Neh, ...
```

Syntax: `SUBSTRING(string, start_position, length)` — positions start at **1**.

### REPLACE()

```sql
SELECT REPLACE(city, 'Bangalore', 'Bengaluru')
FROM employees;
```

### TRIM()

Removes leading and trailing spaces:

```sql
SELECT TRIM('  Rahul  ');            -- 'Rahul'
```

### LOCATE()

Finds the position of a substring (0 if not found):

```sql
SELECT LOCATE('hu', 'Rahul');        -- 3
SELECT LOCATE('xy', 'Rahul');        -- 0
```

## Numeric Functions

| Function | Example | Result |
| --- | --- | --- |
| `ROUND()` | `ROUND(123.456, 2)` | `123.46` |
| `CEIL()` — rounds up | `CEIL(123.1)` | `124` |
| `FLOOR()` — rounds down | `FLOOR(123.9)` | `123` |
| `ABS()` — absolute value | `ABS(-200)` | `200` |
| `MOD()` — remainder (Java `15 % 4`) | `MOD(15, 4)` | `3` |
| `POWER()` | `POWER(2, 5)` | `32` |

## Date & Time Functions

One of the most commonly used areas in backend applications.

```sql
SELECT NOW();        -- current date and time, e.g. 2026-07-01 09:15:30
SELECT CURDATE();    -- current date only,     e.g. 2026-07-01
SELECT CURTIME();    -- current time only
```

```sql
SELECT YEAR(joining_date)  FROM employees;
SELECT MONTH(joining_date) FROM employees;
SELECT DAY(joining_date)   FROM employees;
```

### DATEDIFF()

```sql
SELECT DATEDIFF(CURDATE(), joining_date)
FROM employees;
```

Returns the number of **days** between two dates (first minus second).

### DATE_ADD() and DATE_SUB()

```sql
SELECT DATE_ADD(CURDATE(), INTERVAL 30 DAY);   -- useful for expiry dates
SELECT DATE_SUB(CURDATE(), INTERVAL 7 DAY);    -- useful for "last 7 days" reports
```

### LAST_DAY()

```sql
SELECT LAST_DAY(CURDATE());   -- last day of the current month
```

## Nesting Functions

Functions can be combined — the innermost runs first:

```sql
SELECT UPPER(TRIM(name))
FROM employees;
```

```flow-h
TRIM(name)
UPPER(...)
```

```sql
SELECT CONCAT(UPPER(name), ' - ', department)
FROM employees;
```

## Real Spring Boot Example

```java
List<Employee> findAllByOrderBySalaryDesc();
```

Generated SQL:

```sql
SELECT *
FROM employees
ORDER BY salary DESC;
```

JPQL:

```java
@Query("""
        SELECT e
        FROM Employee e
        ORDER BY e.joiningDate DESC
        """)
```

generates `... ORDER BY joining_date DESC`.

A projection such as `SELECT UPPER(e.name) FROM Employee e` makes Hibernate generate SQL that uses the **database function**, reducing work in your Java application.

## Performance Tips

### Avoid Functions on Indexed Columns in WHERE

```sql
-- ❌ Often prevents index usage
WHERE YEAR(joining_date) = 2026

-- ✅ The index can be used efficiently
WHERE joining_date >= '2026-01-01'
  AND joining_date <  '2027-01-01'
```

### ORDER BY on Indexed Columns

Sorting by an indexed column can be much faster, because MySQL may read rows **in index order** instead of performing an extra sort (a "filesort").

### Avoid Unnecessary Sorting

If the UI doesn't need sorted results, don't add `ORDER BY` out of habit — sorting large datasets is expensive.

## Interview Questions

### Q1. What is the default order of ORDER BY?

Ascending (`ASC`).

### Q2. How does sorting by multiple columns work?

Rows are sorted by the first column; the second column only breaks ties among rows with equal values in the first, and so on.

### Q3. Difference between CHAR_LENGTH() and LENGTH()?

`CHAR_LENGTH()` counts characters; `LENGTH()` counts bytes. They differ for multi-byte characters.

### Q4. Difference between NOW() and CURDATE()?

`NOW()` returns the current date **and time**; `CURDATE()` returns only the date.

### Q5. Why should you avoid functions on indexed columns in WHERE?

Because the index stores raw column values; wrapping the column in a function forces MySQL to compute the function for every row, usually causing a full scan.

### Q6. What does DATEDIFF() return?

The number of days between two dates (`DATEDIFF(a, b)` = a − b), ignoring the time part.

### Q7. Difference between ROUND(), CEIL() and FLOOR()?

`ROUND()` rounds to the nearest value (optionally to N decimals); `CEIL()` always rounds up; `FLOOR()` always rounds down.

### Q8. Can you use CASE inside ORDER BY?

Yes — it's the standard way to implement custom sort priorities.

## Hands-On Assignment

Using the `employees` table:

1. Display employees by highest salary.
2. Display employees by department, then salary descending.
3. Show all employee names in uppercase.
4. Show the first three letters of each employee's name.
5. Concatenate employee name and department.
6. Display employees who joined this year.
7. Display the number of days each employee has worked.
8. Display the last day of the current month.
9. Round the average salary to two decimal places.
10. Display each employee's name after trimming leading or trailing spaces.

### Challenge Problems

1. Display employees ordered by salary descending, then name ascending.
2. Show names longer than 5 characters.
3. Display employees who joined within the last 365 days.
4. Replace "IT" with "Technology" in the output without changing the stored data.
5. Sort employees with IT first, then Finance, then everyone else.

## Cheat Sheet

| Function / clause | Purpose |
| --- | --- |
| `ORDER BY` | Sort rows |
| `ASC` | Ascending order (default) |
| `DESC` | Descending order |
| `LENGTH()` / `CHAR_LENGTH()` | Length in bytes / characters |
| `UPPER()` / `LOWER()` | Change case |
| `CONCAT()` | Join strings |
| `SUBSTRING()` | Extract part of a string |
| `REPLACE()` | Replace text |
| `TRIM()` | Remove leading/trailing spaces |
| `LOCATE()` | Find a substring's position |
| `ROUND()` / `CEIL()` / `FLOOR()` | Round nearest / up / down |
| `ABS()` | Absolute value |
| `MOD()` | Remainder |
| `POWER()` | Exponentiation |
| `NOW()` / `CURDATE()` | Current date-time / date |
| `DATEDIFF()` | Days between dates |
| `DATE_ADD()` / `DATE_SUB()` | Add / subtract time |
| `LAST_DAY()` | Last day of the month |
