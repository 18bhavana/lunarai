---
title: CASE WHEN, IF(), COALESCE(), IFNULL() and NULL Handling
subtitle: Decision-making SQL in depth — searched vs simple CASE, WHEN order, three-valued logic, NULL in comparisons, arithmetic and NOT IN, IFNULL vs COALESCE, and conditional aggregation for dashboards.
order: 16
---

## Introduction

This chapter goes deeper into writing SQL that **makes decisions, categorizes data, handles missing values, replaces `NULL`, produces business-friendly output, builds conditional reports and performs conditional aggregation** — used heavily in enterprise reporting, banking, e-commerce, HRMS, payroll, analytics dashboards and Spring Boot reporting APIs.

Typical requirements:

- If salary > 80,000 → *High Salary*
- If stock > 0 → *In Stock*
- If bonus is `NULL` → show `0`
- Use the mobile number if available, otherwise the home phone, otherwise the office phone
- Count high-salary and low-salary employees separately

## Why Do We Need Conditional Logic?

| id | name | salary | bonus | department |
| --- | --- | --- | --- | --- |
| 1 | John | 70000 | 5000 | IT |
| 2 | David | 90000 | NULL | IT |
| 3 | Lisa | 50000 | 3000 | HR |
| 4 | Alex | 55000 | NULL | HR |
| 5 | Mary | 80000 | 7000 | Finance |

Business users may not want to see `NULL` — they may want *No Bonus* or `0`. Instead of `Salary = 90000` they may want *High Salary*. This is where conditional expressions become essential.

## CASE WHEN

`CASE` lets SQL **make decisions** — conceptually like Java's `if / else if / else`.

```sql
CASE
    WHEN condition1 THEN result1
    WHEN condition2 THEN result2
    ELSE default_result
END
```

```flow
? Condition 1 true? | Yes: Return result 1 | No: Check condition 2
? Condition 2 true? | Yes: Return result 2 | No: Return the ELSE result
```

## Searched CASE

A **searched CASE** evaluates complete Boolean conditions:

```sql
SELECT name,
       salary,
       CASE
           WHEN salary >= 90000 THEN 'Excellent'
           WHEN salary >= 70000 THEN 'Good'
           WHEN salary >= 50000 THEN 'Average'
           ELSE 'Needs Improvement'
       END AS performance
FROM employees;
```

| Name | Salary | Performance |
| --- | --- | --- |
| John | 70000 | Good |
| David | 90000 | Excellent |
| Lisa | 50000 | Average |
| Alex | 55000 | Average |
| Mary | 80000 | Good |

Useful when conditions involve `>`, `<`, `>=`, `<=`, `BETWEEN`, multiple columns, `AND` or `OR`.

### Salary Band

```sql
SELECT name,
       salary,
       CASE
           WHEN salary > 80000                 THEN 'High Salary'
           WHEN salary BETWEEN 60000 AND 80000 THEN 'Medium Salary'
           ELSE 'Low Salary'
       END AS salary_band
FROM employees;
```

Remember **`BETWEEN` is inclusive**: `salary BETWEEN 60000 AND 80000` means `salary >= 60000 AND salary <= 80000`.

## Simple CASE

A **simple CASE** compares **one expression** against multiple values:

```sql
SELECT name,
       department,
       CASE department
           WHEN 'IT'      THEN 'D001'
           WHEN 'HR'      THEN 'D002'
           WHEN 'Finance' THEN 'D003'
           ELSE 'Unknown'
       END AS department_code
FROM employees;
```

| Simple CASE | Searched CASE |
| --- | --- |
| `CASE department WHEN 'IT' THEN ...` | `CASE WHEN salary >= 90000 THEN ...` |
| One expression against multiple exact values | Ranges, complex conditions, multiple columns |

## Order of WHEN Conditions

`CASE` conditions are evaluated **top to bottom**, and **the first match wins**.

```sql
-- ❌ Wrong order
CASE
    WHEN salary >= 50000 THEN 'Average'
    WHEN salary >= 70000 THEN 'Good'
    WHEN salary >= 90000 THEN 'Excellent'
END
```

For `salary = 90000`, the first condition (`90000 >= 50000`) is already true, so the result is **Average** — later conditions are never reached.

```sql
-- ✅ Correct order
CASE
    WHEN salary >= 90000 THEN 'Excellent'
    WHEN salary >= 70000 THEN 'Good'
    WHEN salary >= 50000 THEN 'Average'
    ELSE 'Needs Improvement'
END
```

> [!IMPORTANT]
> When ranges overlap, write the most specific or highest threshold **first**.

## IF() Function

MySQL's `IF(condition, value_if_true, value_if_false)`:

```sql
SELECT name,
       salary,
       IF(salary >= 70000, 'Eligible', 'Not Eligible') AS promotion_status
FROM employees;
```

| Name | Promotion status |
| --- | --- |
| John | Eligible |
| David | Eligible |
| Lisa | Not Eligible |
| Alex | Not Eligible |
| Mary | Eligible |

### Nested IF()

```sql
SELECT name,
       IF(salary >= 90000, 'High',
          IF(salary >= 70000, 'Medium', 'Low')) AS salary_band
FROM employees;
```

This quickly becomes hard to read — prefer `CASE` for complex logic.

### CASE vs IF()

| CASE | IF() |
| --- | --- |
| SQL-standard conditional expression | MySQL-specific function |
| Supports multiple conditions cleanly | Best for simple true/false conditions |
| More portable | Less portable |
| Better for complex logic | Shorter for simple checks |

**Recommendation:** `IF()` can be convenient for a simple binary condition; prefer `CASE` for multiple or complex conditions, and for portability.

## Understanding NULL

`NULL` means **unknown, missing, not available or not yet assigned**. It does **not** mean `0`, an empty string `''` or `FALSE`.

| Value | Meaning |
| --- | --- |
| `bonus = 0` | The bonus is known to be zero |
| `bonus = NULL` | The bonus value is unknown or missing |

The exact business meaning of `NULL` depends on the data model.

### IS NULL and IS NOT NULL

```sql
SELECT * FROM employees WHERE bonus = NULL;       -- ❌ doesn't test for NULL

SELECT * FROM employees WHERE bonus IS NULL;      -- ✅ employees without a bonus value
SELECT * FROM employees WHERE bonus IS NOT NULL;  -- ✅ employees with a bonus value
```

> [!IMPORTANT]
> Check `NULL` with `IS NULL` / `IS NOT NULL` — never `= NULL` or `!= NULL`.

## NULL in Comparisons

Many developers expect `NULL = NULL` to be TRUE. But SQL uses **three-valued logic** — TRUE, FALSE and **UNKNOWN** — and comparisons involving `NULL` produce **UNKNOWN**. That's why `bonus = NULL` doesn't work as an equality check. (MySQL's null-safe operator `<=>` treats `NULL <=> NULL` as true.)

### NULL and NOT IN — an Interview Trap

```sql
SELECT *
FROM employees
WHERE department_id NOT IN (1, 2, NULL);
```

This returns **no rows**: `NOT IN (1, 2, NULL)` means `<> 1 AND <> 2 AND <> NULL`, and the last comparison is always UNKNOWN. It's especially dangerous with subqueries:

```sql
SELECT *
FROM customers
WHERE customer_id NOT IN (SELECT customer_id FROM orders);
```

If the subquery returns a single `NULL`, the query returns nothing. A safer pattern:

```sql
SELECT *
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

(`EXISTS`/`NOT EXISTS` are covered in the subquery chapters.)

## NULL in Arithmetic

With `salary = 70000` and `bonus = NULL`:

```sql
SELECT salary + bonus
FROM employees;          -- NULL, because 70000 + NULL = NULL
```

If a missing bonus should count as zero:

```sql
SELECT salary + IFNULL(bonus, 0) AS total_compensation
FROM employees;

SELECT salary + COALESCE(bonus, 0) AS total_compensation
FROM employees;
```

## IFNULL()

`IFNULL(expression, replacement)` replaces `NULL` with another value:

```sql
SELECT name,
       IFNULL(bonus, 0) AS bonus
FROM employees;
```

| Name | Bonus |
| --- | --- |
| John | 5000 |
| David | 0 |
| Lisa | 3000 |
| Alex | 0 |
| Mary | 7000 |

```sql
SELECT name,
       IFNULL(email, 'Not Available') AS email
FROM employees;
```

`IFNULL()` takes **exactly two** arguments.

## COALESCE()

`COALESCE(value1, value2, value3, ...)` returns the **first non-`NULL` value**.

| mobile | home_phone | office_phone |
| --- | --- | --- |
| NULL | NULL | 9876543210 |

```sql
SELECT COALESCE(mobile, home_phone, office_phone, 'No Contact') AS contact_number
FROM employees;          -- 9876543210
```

```flow-h Once a non-NULL value is found, later values aren't needed
mobile: NULL
home_phone: NULL
office_phone: 9876543210
Return it
```

### Preferred Contact

```sql
SELECT customer_name,
       COALESCE(mobile, email, office_phone, 'Not Available') AS preferred_contact
FROM customers;
```

Priority: mobile → email → office phone → *Not Available*.

### IFNULL() vs COALESCE()

| IFNULL() | COALESCE() |
| --- | --- |
| Two arguments | Multiple arguments |
| MySQL-specific | SQL standard |
| Simple `NULL` replacement | Multiple fallback values |
| `IFNULL(value, fallback)` | `COALESCE(v1, v2, v3, ...)` |

`IFNULL(bonus, 0)` and `COALESCE(bonus, 0)` are equivalent; for several fallbacks, only `COALESCE` works. Use `IFNULL()` for a simple MySQL-specific replacement and `COALESCE()` for portability or multiple fallbacks.

## Conditional Aggregation

One of the most important SQL interview topics. Count **high-salary** and **low-salary** employees in one query by combining `CASE` + `SUM()`:

```sql
SELECT department,
       SUM(CASE WHEN salary >= 70000 THEN 1 ELSE 0 END) AS high_salary_employees,
       SUM(CASE WHEN salary <  70000 THEN 1 ELSE 0 END) AS low_salary_employees
FROM employees
GROUP BY department;
```

| Department | High salary | Low salary |
| --- | --- | --- |
| IT | 2 | 0 |
| HR | 0 | 2 |
| Finance | 1 | 0 |

### How Does It Work?

`CASE WHEN salary >= 70000 THEN 1 ELSE 0 END` turns each row into `1` (high salary) or `0` (not). `SUM(...)` then adds them: `1 + 1 + 0 + 0 + 1 = 3` high earners.

> [!TIP]
> In MySQL a comparison already evaluates to `1` or `0`, so `SUM(salary >= 70000)` is a shorthand — but the explicit `CASE` is portable and clearer in interviews.

## COUNT() with CASE

```sql
SELECT COUNT(CASE WHEN salary > 70000 THEN 1 END) AS high_earners
FROM employees;
```

**Why does this work?** When the condition is true, `CASE` returns `1`; when false (no `ELSE`), it returns `NULL` — and `COUNT(expression)` counts only non-`NULL` values.

### SUM(CASE…) vs COUNT(CASE…)

```sql
SUM(CASE WHEN salary > 70000 THEN 1 ELSE 0 END)   -- SUM pattern
COUNT(CASE WHEN salary > 70000 THEN 1 END)        -- COUNT pattern
```

Both count matching rows. Many developers prefer the `SUM` form in interviews because the counting logic is explicit.

> [!WARNING]
> **Classic trap:** `COUNT(CASE WHEN salary > 70000 THEN 1 ELSE 0 END)` counts **every** row, because both `1` and `0` are non-`NULL`. Drop the `ELSE`, or use `SUM`.

## SUM() with CASE

Revenue for **PAID** and **PENDING** orders in one query:

```sql
SELECT SUM(CASE WHEN status = 'PAID'    THEN total_amount ELSE 0 END) AS paid_revenue,
       SUM(CASE WHEN status = 'PENDING' THEN total_amount ELSE 0 END) AS pending_revenue
FROM orders;
```

Department-wise conditional salary:

```sql
SELECT department,
       SUM(CASE WHEN salary >= 70000 THEN salary ELSE 0 END) AS high_salary_total
FROM employees
GROUP BY department;
```

## AVG() with CASE

Average salary of employees earning at least 70,000:

```sql
SELECT AVG(CASE WHEN salary >= 70000 THEN salary END) AS average_high_salary
FROM employees;
```

Non-matching rows return `NULL`, and since `AVG()` ignores `NULL`, **only qualifying salaries participate**. (Using `ELSE 0` here would be wrong — the zeros would drag the average down.)

## Real-World Business Examples

```sql
-- 1. Customer category
SELECT customer_name,
       CASE
           WHEN total_purchase >= 100000 THEN 'Platinum'
           WHEN total_purchase >= 50000  THEN 'Gold'
           ELSE 'Silver'
       END AS customer_type
FROM customers;

-- 2. Employee bonus report
SELECT name, salary, IFNULL(bonus, 0) AS bonus
FROM employees;

-- 3. Product availability (portable CASE version of IF(stock > 0, ...))
SELECT product_name,
       CASE WHEN stock > 0 THEN 'In Stock' ELSE 'Out of Stock' END AS status
FROM products;

-- 4. Student result
SELECT student_name,
       CASE
           WHEN marks >= 90 THEN 'A'
           WHEN marks >= 75 THEN 'B'
           WHEN marks >= 60 THEN 'C'
           ELSE 'Fail'
       END AS grade
FROM students;

-- 5. Preferred contact
SELECT customer_name,
       COALESCE(mobile, email, office_phone, 'Not Available') AS contact
FROM customers;

-- 6. Payment status dashboard
SELECT COUNT(*) AS total_payments,
       SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successful_payments,
       SUM(CASE WHEN status = 'FAILED'  THEN 1 ELSE 0 END) AS failed_payments,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_payments
FROM payments;
```

One query produces total, successful, failed and pending payments — extremely common in dashboard APIs.

## CASE in ORDER BY

```sql
SELECT *
FROM orders
ORDER BY CASE status
             WHEN 'URGENT'     THEN 1
             WHEN 'PROCESSING' THEN 2
             WHEN 'PENDING'    THEN 3
             WHEN 'COMPLETED'  THEN 4
             WHEN 'CANCELLED'  THEN 5
             ELSE 6
         END,
         created_at DESC;
```

Useful when alphabetical sorting doesn't match business priority.

## CASE in UPDATE

```sql
UPDATE employees
SET bonus = CASE
                WHEN salary >= 90000 THEN 10000
                WHEN salary >= 70000 THEN 7000
                ELSE 3000
            END;
```

Salary ≥ 90000 → bonus 10000; ≥ 70000 → 7000; otherwise 3000.

> [!WARNING]
> Without a `WHERE` clause, **every row** is updated. Always verify the affected rows and the business requirement.

## Interview Questions

### Q1. Replace NULL salary with 0.

```sql
SELECT IFNULL(salary, 0) AS salary FROM employees;
-- portable:
SELECT COALESCE(salary, 0) AS salary FROM employees;
```

### Q2. Categorize salaries.

```sql
SELECT name,
       CASE
           WHEN salary >= 80000 THEN 'High'
           WHEN salary >= 60000 THEN 'Medium'
           ELSE 'Low'
       END AS salary_category
FROM employees;
```

### Q3. Find employees without bonuses.

```sql
SELECT *
FROM employees
WHERE bonus IS NULL;
```

### Q4. Count employees earning above 70,000.

```sql
SELECT SUM(CASE WHEN salary > 70000 THEN 1 ELSE 0 END) AS high_earners
FROM employees;
```

### Q5. Display the first available phone number.

```sql
SELECT COALESCE(mobile, home_phone, office_phone) AS contact_number
FROM employees;
```

### Q6. What is the difference between NULL and 0?

`NULL` is an unknown or missing value; `0` is a known numeric value.

### Q7. What is the difference between IFNULL() and COALESCE()?

`IFNULL()` takes two arguments and is MySQL-specific; `COALESCE()` takes many and is SQL standard.

### Q8. Why doesn't column = NULL work?

Because comparisons with `NULL` evaluate to UNKNOWN. Use `column IS NULL`.

### Q9. What is conditional aggregation?

Combining an aggregate function with `CASE` — e.g. `SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)` — to compute several conditional metrics in one query.

### Q10. What happens if CASE has no ELSE?

If no `WHEN` matches, `CASE` returns `NULL`.

## Common Mistakes

- ❌ **Comparing with NULL** — `bonus = NULL` → use `bonus IS NULL`.
- ❌ **Using `!= NULL`** — use `bonus IS NOT NULL`.
- ❌ **Wrong `CASE` condition order** — `>= 50000` first captures everything above 50,000; put the highest threshold first.
- ❌ **Forgetting `ELSE`** — non-matching rows return `NULL`. Fine if intended; otherwise add e.g. `ELSE 'Low'`.
- ❌ **Deeply nested `IF()` for complex logic** — use a multi-branch `CASE`.
- ❌ **`COUNT(CASE ... THEN 1 ELSE 0 END)`** — counts both 1 and 0. Use `COUNT(CASE ... THEN 1 END)` or `SUM(CASE ... THEN 1 ELSE 0 END)`.
- ❌ **Ignoring NULL in arithmetic** — `salary + bonus` is `NULL` when bonus is `NULL`; use `salary + COALESCE(bonus, 0)` if business logic treats a missing bonus as zero.

## Mini Project

| Name | Salary | Bonus | Department |
| --- | --- | --- | --- |
| John | 70000 | 5000 | IT |
| David | 90000 | NULL | IT |
| Lisa | 50000 | 3000 | HR |
| Alex | 55000 | NULL | HR |
| Mary | 80000 | 7000 | Finance |

```sql
-- 1. Replace NULL bonus with 0
SELECT name, IFNULL(bonus, 0) AS bonus
FROM employees;

-- 2. High, Medium and Low salary bands
SELECT name, salary,
       CASE
           WHEN salary >= 80000 THEN 'High'
           WHEN salary >= 60000 THEN 'Medium'
           ELSE 'Low'
       END AS salary_band
FROM employees;

-- 3. Promotion eligibility (salary >= 70,000)
SELECT name, salary,
       CASE WHEN salary >= 70000 THEN 'Eligible' ELSE 'Not Eligible' END AS promotion_status
FROM employees;

-- 4. Employees earning more than 70,000 → 2 (David, Mary)
SELECT SUM(CASE WHEN salary > 70000 THEN 1 ELSE 0 END) AS high_earners
FROM employees;

-- 5. First available contact number
SELECT name,
       COALESCE(mobile, home_phone, office_phone, 'Not Available') AS contact_number
FROM employees;
```

Query 4 returns **2**, not 3: John earns exactly 70,000 and the condition is `> 70000`, not `>= 70000`.

## Practice Problems

**Easy**

1. Replace `NULL` salary with `0`.
2. Find employees with `NULL` bonuses.
3. Display Active or Inactive based on status.
4. Categorize marks into grades.
5. Replace missing city names with *Unknown*.

**Medium**

1. Count male and female employees using conditional aggregation.
2. Display customer loyalty levels.
3. Show product stock availability.
4. Generate student pass/fail reports.
5. Build employee performance categories.
6. Calculate total compensation (salary + bonus) while handling `NULL`.
7. Display the first available contact method.

**Interview level**

1. Count employees in each salary band.
2. Build a department-wise performance dashboard.
3. Calculate revenue by order status using conditional aggregation.
4. Find premium customers using `CASE`.
5. Generate an HR report with salary band, bonus status and promotion eligibility.
6. Count successful, failed and pending payments in one query.
7. Explain why `COUNT(CASE WHEN condition THEN 1 ELSE 0 END)` is usually wrong for conditional counting.
8. Explain how `NULL` affects `NOT IN`.

## Best Practices

- ✅ Prefer `CASE` for complex conditional logic; use `IF()` only for simple MySQL-specific true/false logic.
- ✅ Always use `IS NULL` / `IS NOT NULL`, and remember `NULL` ≠ `0` ≠ `''`.
- ✅ Use `COALESCE()` for multiple fallbacks and `IFNULL()` for a simple two-value replacement.
- ✅ Be careful with `NULL` in arithmetic and in `NOT IN` subqueries.
- ✅ Order overlapping `CASE` conditions correctly.
- ✅ Use conditional aggregation for dashboards and reports, and know `COUNT(CASE…)` vs `SUM(CASE…)`.
- ✅ Don't replace `NULL` blindly — first understand its business meaning.

## Real Backend Example

`GET /api/dashboard/payments` needs total, successful, failed and pending payments, plus successful and failed revenue:

```sql
SELECT COUNT(*) AS total_payments,
       SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)      AS successful_payments,
       SUM(CASE WHEN status = 'FAILED'  THEN 1 ELSE 0 END)      AS failed_payments,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END)      AS pending_payments,
       SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) AS successful_revenue,
       SUM(CASE WHEN status = 'FAILED'  THEN amount ELSE 0 END) AS failed_revenue
FROM payments;
```

One query produces every dashboard metric — one of the most powerful uses of **CASE + aggregate functions** in enterprise applications.

## Cheat Sheet

| Construct | Shape / use |
| --- | --- |
| Searched `CASE` | `CASE WHEN cond1 THEN r1 WHEN cond2 THEN r2 ELSE d END` |
| Simple `CASE` | `CASE column WHEN v1 THEN r1 ... ELSE d END` |
| `IF()` | `IF(condition, value_if_true, value_if_false)` |
| `NULL` check | `column IS NULL` / `IS NOT NULL` |
| `IFNULL()` | `IFNULL(bonus, 0)` — two-value replacement |
| `COALESCE()` | `COALESCE(v1, v2, v3, default)` — first non-`NULL` |
| Conditional count | `SUM(CASE WHEN c THEN 1 ELSE 0 END)` or `COUNT(CASE WHEN c THEN 1 END)` |
| Conditional sum | `SUM(CASE WHEN c THEN amount ELSE 0 END)` |
| Conditional average | `AVG(CASE WHEN c THEN value END)` |
