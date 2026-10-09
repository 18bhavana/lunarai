---
title: Week 1 Revision and SQL Problem Solving
subtitle: Recap of fundamentals, CRUD, filtering, functions, conditional logic and transactions — plus 30 graded practice problems with solutions, interview questions and a mini project.
order: 7
---

## Introduction

You've completed the first week of the plan. The goal of this chapter is not to learn something new — it's to **make everything you've learned permanent**.

## Week 1 Recap

| Chapter | Topics |
| --- | --- |
| Fundamentals | Database, DBMS vs RDBMS, MySQL architecture, storage engines, data types, constraints, keys |
| DDL & CRUD | DDL, DML, `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE` |
| Filtering | `WHERE`, `LIKE`, `IN`, `BETWEEN`, `NULL`, `REGEXP` |
| Functions | `ORDER BY`, string, numeric and date functions |
| Conditional logic | `CASE`, `IF()`, `COALESCE()`, `IFNULL()`, `NULLIF()` |
| Transactions | ACID, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, auto-commit, `@Transactional` |

## The Schema

| id | name | department | salary | city | manager_id | joining_date |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Rahul | IT | 70000 | Bangalore | 10 | 2022-01-10 |
| 2 | Amit | HR | 50000 | Delhi | NULL | 2021-04-10 |
| 3 | Neha | IT | 90000 | Mumbai | 10 | 2020-03-10 |
| 4 | Raj | Finance | 60000 | Bangalore | 20 | 2023-05-10 |
| 5 | Ankit | IT | 75000 | Chennai | 10 | 2022-08-10 |

> [!TIP]
> Turn on **Practice mode** to hide the solutions below and try each problem first.

## Level 1 Questions (Easy)

### Problem 1 — Display all employees.

```sql
SELECT *
FROM employees;
```

### Problem 2 — Display only names.

```sql
SELECT name
FROM employees;
```

### Problem 3 — Display employee names and salaries.

```sql
SELECT name, salary
FROM employees;
```

### Problem 4 — Display all IT employees.

```sql
SELECT *
FROM employees
WHERE department = 'IT';
```

### Problem 5 — Salary greater than 70,000.

```sql
SELECT *
FROM employees
WHERE salary > 70000;
```

### Problem 6 — Employees from Bangalore.

```sql
SELECT *
FROM employees
WHERE city = 'Bangalore';
```

### Problem 7 — Employees from Bangalore working in IT.

```sql
SELECT *
FROM employees
WHERE city = 'Bangalore'
  AND department = 'IT';
```

### Problem 8 — Employees from Bangalore OR Delhi.

```sql
SELECT *
FROM employees
WHERE city IN ('Bangalore', 'Delhi');
```

### Problem 9 — Employees whose salary is between 60K and 80K.

```sql
SELECT *
FROM employees
WHERE salary BETWEEN 60000 AND 80000;
```

### Problem 10 — Employees without managers.

```sql
SELECT *
FROM employees
WHERE manager_id IS NULL;
```

## Level 2 Questions (Intermediate)

### Problem 11 — Names starting with R.

```sql
SELECT *
FROM employees
WHERE name LIKE 'R%';
```

### Problem 12 — Names ending with t.

```sql
SELECT *
FROM employees
WHERE name LIKE '%t';
```

### Problem 13 — Names containing "ah".

```sql
SELECT *
FROM employees
WHERE name LIKE '%ah%';
```

### Problem 14 — Sort by salary descending.

```sql
SELECT *
FROM employees
ORDER BY salary DESC;
```

### Problem 15 — Sort by department, then salary descending.

```sql
SELECT *
FROM employees
ORDER BY department, salary DESC;
```

### Problem 16 — Display names in uppercase.

```sql
SELECT UPPER(name)
FROM employees;
```

### Problem 17 — Display the first 3 letters of each name.

```sql
SELECT SUBSTRING(name, 1, 3)
FROM employees;
```

### Problem 18 — Display each employee's time in the company (days).

```sql
SELECT name,
       DATEDIFF(CURDATE(), joining_date)
FROM employees;
```

### Problem 19 — Display today's date.

```sql
SELECT CURDATE();
```

### Problem 20 — Display the current timestamp.

```sql
SELECT NOW();
```

## Level 3 Questions (Advanced)

### Problem 21 — Salary band.

```sql
SELECT name,
       CASE
           WHEN salary >= 80000 THEN 'High'
           WHEN salary >= 60000 THEN 'Medium'
           ELSE 'Low'
       END
FROM employees;
```

### Problem 22 — Replace a NULL bonus with zero.

```sql
SELECT IFNULL(bonus, 0)
FROM employees;
```

### Problem 23 — Display the first available phone.

```sql
SELECT COALESCE(mobile, office_phone, home_phone)
FROM users;
```

### Problem 24 — Department expansion.

```sql
SELECT CASE department
           WHEN 'IT' THEN 'Technology'
           WHEN 'HR' THEN 'Human Resources'
           ELSE department
       END
FROM employees;
```

### Problem 25 — Custom department order.

```sql
SELECT *
FROM employees
ORDER BY CASE
             WHEN department = 'IT'      THEN 1
             WHEN department = 'Finance' THEN 2
             ELSE 3
         END;
```

## Transaction Questions

### Problem 26 — Transfer money.

```sql
START TRANSACTION;

UPDATE account
SET balance = balance - 5000
WHERE id = 1;

UPDATE account
SET balance = balance + 5000
WHERE id = 2;

COMMIT;
```

### Problem 27 — Undo a transaction.

```sql
ROLLBACK;
```

### Problem 28 — Create a savepoint.

```sql
SAVEPOINT payment_done;
```

### Problem 29 — Roll back to a savepoint.

```sql
ROLLBACK TO payment_done;
```

### Problem 30 — Disable auto-commit.

```sql
SET autocommit = 0;
```

## Interview Questions (Must Know)

### Q1. Difference between DELETE, TRUNCATE and DROP?

`DELETE` removes selected rows and can be rolled back; `TRUNCATE` removes all rows quickly, resets `AUTO_INCREMENT` and can't be rolled back; `DROP` removes the table itself.

### Q2. Difference between CHAR and VARCHAR?

`CHAR` is fixed-length and padded; `VARCHAR` is variable-length.

### Q3. Difference between WHERE and HAVING?

`WHERE` filters rows before grouping; `HAVING` filters groups after `GROUP BY` (covered in the HAVING chapter).

### Q4. Difference between IFNULL() and COALESCE()?

`IFNULL` takes two arguments (MySQL-specific); `COALESCE` takes many and returns the first non-`NULL` (standard SQL).

### Q5. Difference between CASE and IF()?

`CASE` is standard and supports many branches; `IF()` is a MySQL-specific single true/false choice.

### Q6. Difference between NOW() and CURDATE()?

`NOW()` returns date and time; `CURDATE()` returns only the date.

### Q7. Difference between COMMIT and ROLLBACK?

`COMMIT` makes changes permanent; `ROLLBACK` undoes uncommitted changes.

### Q8. What is ACID?

Atomicity, Consistency, Isolation and Durability — the guarantees of a reliable transaction.

### Q9. Difference between DBMS and RDBMS?

An RDBMS stores data in related tables linked by keys, adding referential integrity and SQL; a plain DBMS doesn't enforce relationships.

### Q10. Explain the MySQL query flow.

```flow-h
Client
JDBC
Parser
Optimizer
Executor
Storage engine
Disk
```

## Mini Project — Employee Management System

1. Create the tables `employees` and `departments`.
2. Insert 10 employees.
3. Write queries for: IT employees, highest salary, lowest salary, employees from Bangalore, salary > 70000, joined after 2022, names starting with A, uppercase names, salary bands and department expansion.
4. Transactions: increase salaries → roll back → increase again → commit.

## Week 1 Cheat Sheet

### SQL Logical Execution Order

```flow-h
FROM
WHERE
GROUP BY
HAVING
SELECT
ORDER BY
LIMIT
```

### LIKE

| Wildcard | Meaning |
| --- | --- |
| `%` | Any number of characters |
| `_` | Exactly one character |

### NULL

`NULL` ≠ `0` ≠ `''`. Always use `IS NULL` / `IS NOT NULL`.

### CASE, COALESCE and Transactions

| Construct | Shape |
| --- | --- |
| `CASE` | `CASE WHEN ... THEN ... ELSE ... END` |
| `COALESCE` | `COALESCE(NULL, NULL, 100)` → `100` |
| Transaction | `START TRANSACTION` → SQL → `COMMIT` or `ROLLBACK` |

## Week 1 Challenge

Try solving these without looking at the answers:

1. Find employees earning exactly 75,000.
2. Find employees not in IT.
3. Find employees whose names have exactly 5 characters.
4. Show salaries rounded to the nearest thousand.
5. Display employee names with their city in uppercase.
6. Replace `NULL` manager IDs with "No Manager".
7. Sort employees by salary descending and then name ascending.
8. Show employees who joined in the last 365 days.
9. Classify salaries into Low, Medium and High using `CASE`.
10. Simulate a money transfer using `START TRANSACTION`, `COMMIT` and `ROLLBACK`.

## What You Can Do Now

- ✅ CRUD operations and DDL commands
- ✅ Filtering (`WHERE`, `LIKE`, `IN`, `BETWEEN`)
- ✅ Sorting (`ORDER BY`)
- ✅ String, numeric and date functions
- ✅ Conditional logic (`CASE`, `IF`, `COALESCE`, `IFNULL`, `NULLIF`)
- ✅ Transactions (`COMMIT`, `ROLLBACK`, `SAVEPOINT`)
- ✅ The SQL execution order and common interview questions

This is already enough to handle many day-to-day backend queries in a Spring Boot application.
