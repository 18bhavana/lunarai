---
title: MySQL Date and Time Functions
subtitle: DATE, DATETIME and TIMESTAMP, extracting parts, DATE_ADD/DATE_SUB, DATEDIFF vs TIMESTAMPDIFF, DATE_FORMAT, daily/monthly/quarterly reports, half-open ranges, sargable date filters and time zones.
order: 17
---

## Introduction

Date and time handling is one of the most practically important areas of SQL. Almost every enterprise application works with transaction timestamps, order dates, joining dates, login history, subscription expiry dates, bookings, invoices, audit logs and reporting periods.

You'll learn to answer: What is the current date and time? Which orders were placed today? What was this month's revenue? Which subscriptions expire in the next 7 days? How many years of experience does an employee have? What's the monthly or quarterly revenue? How do we filter dates efficiently using indexes?

## Date and Time Data Types

| Type | Stores | Example | Use for |
| --- | --- | --- | --- |
| `DATE` | `YYYY-MM-DD` | `2026-07-14` | Birth, joining, invoice and expiry dates |
| `TIME` | `HH:MM:SS` | `10:35:45` | Times of day, durations |
| `DATETIME` | `YYYY-MM-DD HH:MM:SS` | `2026-07-14 10:35:45` | Business date-times |
| `TIMESTAMP` | Date and time | `2026-07-14 10:35:45` | `created_at`, `updated_at`, audit timestamps |

> [!IMPORTANT]
> `DATETIME` and `TIMESTAMP` have **different ranges and time-zone behaviour**: `TIMESTAMP` is converted to UTC for storage and back to the session time zone on read, and is limited to 1970–2038; `DATETIME` stores the value as given (years 1000–9999). Choose based on requirements rather than treating them as identical.

### Sample Orders Table

| Order ID | Customer | Amount | Order date |
| --- | --- | --- | --- |
| 101 | John | 2500 | 2026-01-10 |
| 102 | David | 5000 | 2026-02-15 |
| 103 | Mary | 1800 | 2026-02-20 |
| 104 | Lisa | 7500 | 2026-03-05 |
| 105 | Alex | 4200 | 2026-03-18 |

## Current Date and Time

### NOW()

```sql
SELECT NOW();      -- e.g. 2026-07-14 10:35:45
```

Common uses: audit logs, login history, transaction timestamps, record creation time.

```sql
INSERT INTO audit_logs (user_id, action, created_at)
VALUES (101, 'LOGIN', NOW());
```

### CURDATE() and CURTIME()

```sql
SELECT CURDATE();         -- 2026-07-14 (same as CURRENT_DATE())
SELECT CURTIME();         -- 10:35:45
```

| Function | Returns | Example |
| --- | --- | --- |
| `NOW()` | Date + time | `2026-07-14 10:35:45` |
| `CURDATE()` | Date only | `2026-07-14` |
| `CURTIME()` | Time only | `10:35:45` |

## Extracting Parts

### DATE() and TIME()

```sql
SELECT DATE(NOW());       -- 2026-07-14
SELECT TIME(NOW());       -- 10:35:45

SELECT order_id,
       DATE(created_at) AS order_date
FROM orders;
```

### YEAR(), MONTH() and DAY()

```sql
SELECT customer, YEAR(order_date)  AS order_year  FROM orders;
SELECT customer, MONTH(order_date) AS order_month FROM orders;   -- January = 1, December = 12
SELECT customer, DAY(order_date)   AS order_day   FROM orders;   -- 2026-03-18 → 18
```

### MONTHNAME() and DAYNAME()

```sql
SELECT MONTHNAME(order_date) AS month_name FROM orders;   -- January, February, March
SELECT DAYNAME(order_date)   AS day_name   FROM orders;   -- Monday, Tuesday, ...
```

Useful for human-readable reports.

### WEEK() and QUARTER()

```sql
SELECT WEEK(order_date) AS week_number
FROM orders;
```

Week numbering depends on the **mode** argument (the default mode starts weeks on Sunday). Where ISO week rules matter, choose the mode explicitly (e.g. `WEEK(order_date, 3)`).

```sql
SELECT order_date,
       QUARTER(order_date) AS quarter   -- 1 to 4
FROM orders;
```

| Months | Quarter |
| --- | --- |
| January – March | Q1 |
| April – June | Q2 |
| July – September | Q3 |
| October – December | Q4 |

### LAST_DAY()

```sql
SELECT LAST_DAY('2026-02-10');          -- 2026-02-28

SELECT order_date,
       LAST_DAY(order_date) AS month_end
FROM orders;
```

Useful for billing cycles, month-end reports, subscriptions and financial reporting.

## Date Arithmetic

### DATE_ADD()

Syntax: `DATE_ADD(date, INTERVAL value unit)`.

```sql
SELECT DATE_ADD(order_date, INTERVAL 30 DAY) FROM orders;
SELECT DATE_ADD(CURDATE(), INTERVAL 3 MONTH);
SELECT DATE_ADD(CURDATE(), INTERVAL 1 YEAR);
```

### DATE_SUB()

```sql
SELECT DATE_SUB(order_date, INTERVAL 7 DAY) FROM orders;
SELECT DATE_SUB(CURDATE(), INTERVAL 7 DAY);     -- seven days ago
SELECT DATE_SUB(CURDATE(), INTERVAL 1 YEAR);    -- one year ago
```

### INTERVAL

Common units: `INTERVAL 10 DAY`, `INTERVAL 3 MONTH`, `INTERVAL 2 YEAR`, `INTERVAL 5 HOUR`, `INTERVAL 30 MINUTE`. You can also write `CURDATE() + INTERVAL 1 DAY`.

```sql
SELECT DATE_ADD(NOW(), INTERVAL 5 HOUR);
```

## Date Differences

### DATEDIFF()

Returns the difference in **days**: `DATEDIFF(end_date, start_date)`.

```sql
SELECT DATEDIFF('2026-03-31', '2026-03-01');    -- 30
```

Argument order matters — `DATEDIFF(later, earlier)` is positive; reversing them returns a negative value.

```sql
SELECT customer_name,
       DATEDIFF(CURDATE(), joining_date) AS days_with_company
FROM customers;
```

### TIMESTAMPDIFF()

Calculates the difference in a **specified unit**: `TIMESTAMPDIFF(unit, start, end)`.

```sql
-- Employee experience in completed years
SELECT name,
       TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) AS experience_years
FROM employees;

-- Difference in months
SELECT TIMESTAMPDIFF(MONTH, start_date, end_date);

-- Difference in hours
SELECT TIMESTAMPDIFF(HOUR, login_time, logout_time);
```

### DATEDIFF() vs TIMESTAMPDIFF()

| DATEDIFF() | TIMESTAMPDIFF() |
| --- | --- |
| Difference in days | Supports many units |
| Simple date difference | More flexible |
| Ignores the time portion | Years, months, hours, minutes, … |
| `DATEDIFF(end, start)` | `TIMESTAMPDIFF(unit, start, end)` — note the reversed order |

Need days → `DATEDIFF()`; need years, months or hours → `TIMESTAMPDIFF()`.

## DATE_FORMAT()

Converts a date into a formatted **string**:

```sql
SELECT DATE_FORMAT(order_date, '%d-%m-%Y') AS formatted_date
FROM orders;                                     -- 10-01-2026

SELECT DATE_FORMAT(NOW(), '%d-%m-%Y %H:%i:%s');
```

| Specifier | Meaning |
| --- | --- |
| `%Y` | Four-digit year |
| `%y` | Two-digit year |
| `%m` | Numeric month |
| `%M` | Full month name |
| `%d` | Day of month |
| `%H` | Hour (24-hour) |
| `%i` | Minutes |
| `%s` | Seconds |

> [!TIP]
> Use formatting mainly for **display**. Store values in proper date/time types.

## Reports

### Daily Reports

```sql
-- Daily order count
SELECT DATE(order_date) AS order_day,
       COUNT(*)         AS total_orders
FROM orders
GROUP BY DATE(order_date)
ORDER BY order_day;

-- Daily revenue
SELECT DATE(order_date) AS order_day,
       SUM(amount)      AS revenue
FROM orders
GROUP BY DATE(order_date)
ORDER BY order_day;
```

### Monthly Sales Report

```sql
SELECT YEAR(order_date)      AS order_year,
       MONTH(order_date)     AS order_month,
       MONTHNAME(order_date) AS month_name,
       SUM(amount)           AS revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date), MONTHNAME(order_date)
ORDER BY order_year, order_month;
```

**Why include the year?** Because `GROUP BY MONTH(order_date)` combines January 2025 + January 2026 + January 2027 into **one** group. For multi-year data, always group by **year + month**.

### Yearly and Quarterly Revenue

```sql
SELECT YEAR(order_date) AS order_year,
       SUM(amount)      AS revenue
FROM orders
GROUP BY YEAR(order_date)
ORDER BY order_year;

SELECT YEAR(order_date)    AS order_year,
       QUARTER(order_date) AS quarter,
       SUM(amount)         AS revenue
FROM orders
GROUP BY YEAR(order_date), QUARTER(order_date)
ORDER BY order_year, quarter;
```

Common in financial reporting, sales analytics and management dashboards.

## Filtering by Date

### Today's Records

```sql
SELECT *
FROM orders
WHERE DATE(order_date) = CURDATE();
```

Logically correct — but if `order_date` is indexed, wrapping it in `DATE()` may prevent efficient index use. Better for a `DATETIME`/`TIMESTAMP` column:

```sql
SELECT *
FROM orders
WHERE order_date >= CURDATE()
  AND order_date <  CURDATE() + INTERVAL 1 DAY;
```

This is the range **today 00:00:00 up to, but not including, tomorrow 00:00:00** — index-friendly.

### Orders in the Last 30 Days

```sql
-- Calendar days: from midnight 30 days ago through today
SELECT *
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- Rolling window: the previous 30 × 24 hours from this exact moment
SELECT *
FROM orders
WHERE order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

The right choice depends on the business requirement. (Note the calendar version covers today plus the 30 previous days.)

### Orders This Month

```sql
-- Readable, but applies functions to the column
SELECT *
FROM orders
WHERE MONTH(order_date) = MONTH(CURDATE())
  AND YEAR(order_date)  = YEAR(CURDATE());

-- Index-friendly
SELECT *
FROM orders
WHERE order_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  AND order_date <  DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01');
```

Conceptually: **first day of the current month (inclusive)** up to **first day of next month (exclusive)**. This half-open range pattern is extremely important.

### Previous Month Revenue

```sql
SELECT SUM(amount) AS previous_month_revenue
FROM orders
WHERE order_date >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
  AND order_date <  DATE_FORMAT(CURDATE(), '%Y-%m-01');
```

Start of previous month ≤ `order_date` < start of current month.

## Date Range Filtering and Half-Open Ranges

All orders from 2026:

```sql
-- ❌ Avoid
SELECT * FROM orders WHERE YEAR(order_date) = 2026;

-- ✅ Prefer
SELECT *
FROM orders
WHERE order_date >= '2026-01-01'
  AND order_date <  '2027-01-01';
```

### Why `<` the Next Boundary?

```sql
WHERE order_date BETWEEN '2026-01-01' AND '2026-12-31';   -- ❌
```

If `order_date` contains a time such as `2026-12-31 15:30:00`, comparing against `2026-12-31` (midnight) **excludes the rest of the final day**. Prefer:

```sql
WHERE order_date >= '2026-01-01'
  AND order_date <  '2027-01-01';
```

This is a **half-open range**: start **inclusive**, end **exclusive**.

## Sargable Date Queries

A query is more likely to use an index efficiently when the indexed column is **directly compared** against range boundaries (a *sargable* predicate).

| Less index-friendly | Better |
| --- | --- |
| `WHERE YEAR(order_date) = 2026` | `WHERE order_date >= '2026-01-01' AND order_date < '2027-01-01'` |
| `WHERE DATE(created_at) = CURDATE()` | `WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY` |

> [!IMPORTANT]
> Avoid applying functions to indexed columns when a range condition can express the same requirement. A major production-level optimization.

## Real-World Enterprise Examples

```sql
-- 1. Employees joined this year (index-friendly)
SELECT *
FROM employees
WHERE joining_date >= MAKEDATE(YEAR(CURDATE()), 1)
  AND joining_date <  MAKEDATE(YEAR(CURDATE()) + 1, 1);

-- 2. Last 7 days revenue
SELECT SUM(amount) AS revenue
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

-- 3. Monthly dashboard
SELECT YEAR(order_date)      AS order_year,
       MONTH(order_date)     AS order_month,
       MONTHNAME(order_date) AS month_name,
       COUNT(*)              AS total_orders,
       SUM(amount)           AS revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date), MONTHNAME(order_date)
ORDER BY order_year, order_month;

-- 4. Expired memberships
SELECT *
FROM customers
WHERE expiry_date < CURDATE();

-- 5. Upcoming subscription renewals (today + the next 15 days)
SELECT *
FROM customers
WHERE expiry_date >= CURDATE()
  AND expiry_date <  CURDATE() + INTERVAL 16 DAY;

-- Same thing for a pure DATE column (BETWEEN includes both boundaries)
SELECT *
FROM customers
WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 15 DAY);

-- 6. Today's birthdays
SELECT *
FROM employees
WHERE MONTH(birth_date) = MONTH(CURDATE())
  AND DAY(birth_date)   = DAY(CURDATE());

-- 7. Customers who joined more than five years ago
SELECT *
FROM customers
WHERE joining_date < CURDATE() - INTERVAL 5 YEAR;

-- 8. Subscriptions expiring in the next seven days
SELECT *
FROM subscriptions
WHERE expiry_date >= CURDATE()
  AND expiry_date <  CURDATE() + INTERVAL 8 DAY;
```

For birthdays (example 6), applying functions is acceptable — the requirement intentionally compares **recurring month/day values**, not a continuous date range.

## Interview Questions

### Q1. Find employees who joined in the last year.

```sql
SELECT *
FROM employees
WHERE joining_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR);
```

### Q2. Find monthly revenue.

```sql
SELECT YEAR(order_date) AS order_year,
       MONTH(order_date) AS order_month,
       SUM(amount) AS revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date)
ORDER BY order_year, order_month;
```

### Q3. Find employee experience.

```sql
SELECT name,
       TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) AS experience_years
FROM employees;
```

### Q4. Find today's orders.

```sql
SELECT *
FROM orders
WHERE order_date >= CURDATE()
  AND order_date <  CURDATE() + INTERVAL 1 DAY;
```

### Q5. Find orders placed this month.

```sql
SELECT *
FROM orders
WHERE order_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  AND order_date <  DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01');
```

### Q6. Find quarterly revenue.

```sql
SELECT YEAR(order_date) AS order_year,
       QUARTER(order_date) AS quarter,
       SUM(amount) AS revenue
FROM orders
GROUP BY YEAR(order_date), QUARTER(order_date)
ORDER BY order_year, quarter;
```

### Q7. Find orders from the previous 30 days.

```sql
SELECT *
FROM orders
WHERE order_date >= NOW() - INTERVAL 30 DAY;
```

### Q8. What is the difference between DATEDIFF() and TIMESTAMPDIFF()?

`DATEDIFF()` returns the difference in days; `TIMESTAMPDIFF()` returns it in the unit you request (year, month, hour, minute, …).

### Q9. Why is YEAR(order_date) = 2026 potentially slower?

Applying a function to an indexed column can prevent MySQL from using the index for a range lookup. Prefer `order_date >= '2026-01-01' AND order_date < '2027-01-01'`.

## Common Mistakes

- ❌ **Applying functions to indexed columns** — `YEAR(order_date) = 2026` → use a range.
- ❌ **Ignoring the year** — `WHERE MONTH(order_date) = 3` returns March from **every** year. For March 2026: `order_date >= '2026-03-01' AND order_date < '2026-04-01'`.
- ❌ **Using `DATEDIFF()` for years** — it returns days. For completed years use `TIMESTAMPDIFF(YEAR, joining_date, CURDATE())`.
- ❌ **Grouping only by month** — combines the same month across years; group by `YEAR(...)` and `MONTH(...)`.
- ❌ **End-of-day filtering with `23:59:59`** — `BETWEEN '2026-07-14 00:00:00' AND '2026-07-14 23:59:59'` misses fractional seconds. Use `created_at >= '2026-07-14' AND created_at < '2026-07-15'`.
- ❌ **Ignoring time zones** — if the database stores UTC but the business report is in Australia/Adelaide, a transaction near midnight belongs to different calendar dates depending on the zone. Always define the **storage**, **business** and **API** time zones before implementing date-based reporting.

## Mini Project

```sql
-- 1. Today's orders
SELECT *
FROM orders
WHERE order_date >= CURDATE()
  AND order_date <  CURDATE() + INTERVAL 1 DAY;

-- 2. This month's revenue
SELECT SUM(amount) AS monthly_revenue
FROM orders
WHERE order_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  AND order_date <  DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01');

-- 3. Revenue by month
SELECT YEAR(order_date) AS order_year,
       MONTH(order_date) AS order_month,
       MONTHNAME(order_date) AS month_name,
       SUM(amount) AS revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date), MONTHNAME(order_date)
ORDER BY order_year, order_month;

-- 4. Orders placed in the last 15 days
SELECT *
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 15 DAY);

-- 5. Customers who joined more than five years ago
SELECT *
FROM customers
WHERE joining_date < CURDATE() - INTERVAL 5 YEAR;

-- 6. Subscription renewals in the next seven days
SELECT *
FROM subscriptions
WHERE expiry_date >= CURDATE()
  AND expiry_date <  CURDATE() + INTERVAL 8 DAY;
```

## Practice Problems

**Easy**

1. Display the current date.
2. Display the current time.
3. Display the current date and time.
4. Extract the year from an order date.
5. Display month names.
6. Find the day of the week.
7. Find the last day of a month.

**Medium**

1. Calculate employee experience.
2. Generate monthly revenue reports.
3. Find orders from the last 30 days.
4. Find today's birthdays.
5. Find customers whose subscriptions expire this month.
6. Find revenue from the previous month.
7. Find employees who joined this year.
8. Calculate the number of days between two dates.

**Interview level**

1. Calculate customer lifetime in years.
2. Find quarterly revenue.
3. Build a monthly sales dashboard.
4. Compare revenue between the current and previous month.
5. Generate a financial report grouped by year and quarter.
6. Find the latest order from each month.
7. Explain why `DATE(column) = CURDATE()` may hurt index usage.
8. Write an index-friendly query for today's records.
9. Explain the difference between calendar-day filtering and rolling 24-hour filtering.
10. Design date filtering for an application storing UTC but reporting in a business time zone.

## Best Practices

- ✅ Store dates in proper `DATE`, `DATETIME` or `TIMESTAMP` types — not strings.
- ✅ Use `TIMESTAMPDIFF()` for years, months, hours and other units; `DATEDIFF()` for days.
- ✅ Prefer date ranges over functions on indexed columns, using half-open ranges: `>= start AND < next_boundary`.
- ✅ Group by both year and month for multi-year reports.
- ✅ Use `DATE_ADD()` / `DATE_SUB()` for date arithmetic.
- ✅ Know whether a requirement means calendar days or rolling time periods.
- ✅ Define time-zone rules clearly.
- ✅ Use `EXPLAIN` to verify index usage for large date-range queries.
- ✅ Format dates for presentation without changing how they're stored.

## Real Backend Example

`GET /api/reports/orders?fromDate=2026-07-01&toDate=2026-07-31` on a `DATETIME` column. Instead of `BETWEEN '2026-07-01' AND '2026-07-31'`:

```sql
SELECT order_id,
       customer_id,
       amount,
       order_date
FROM orders
WHERE order_date >= '2026-07-01'
  AND order_date <  '2026-08-01'
ORDER BY order_date DESC,
         order_id DESC;
```

This correctly includes `2026-07-31 23:59:59` and any fractional seconds before August 1. With an index:

```sql
CREATE INDEX idx_orders_order_date ON orders (order_date);
```

…the database can efficiently perform the date-range lookup. Extremely common in transaction APIs, booking systems, audit logs, reporting dashboards and financial applications.

## Cheat Sheet

| Goal | SQL |
| --- | --- |
| Current date and time | `NOW()` |
| Current date / time | `CURDATE()` / `CURTIME()` |
| Extract date / time | `DATE(created_at)` / `TIME(created_at)` |
| Year, month, day | `YEAR()`, `MONTH()`, `DAY()` |
| Names | `MONTHNAME()`, `DAYNAME()` |
| Quarter | `QUARTER(order_date)` |
| Last day of month | `LAST_DAY(order_date)` |
| Add / subtract time | `DATE_ADD(CURDATE(), INTERVAL 30 DAY)` / `DATE_SUB(...)` |
| Difference in days | `DATEDIFF(end_date, start_date)` |
| Difference in years | `TIMESTAMPDIFF(YEAR, start_date, end_date)` |
| Today's records | `created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY` |
| A specific year | `order_date >= '2026-01-01' AND order_date < '2027-01-01'` |
| Last 30 days (rolling) | `order_date >= NOW() - INTERVAL 30 DAY` |
| Monthly report | `GROUP BY YEAR(order_date), MONTH(order_date)` |

> [!IMPORTANT]
> **`>= start AND < next boundary`** — safe and efficient date-range filtering.

**Interview tips:** know `NOW()` vs `CURDATE()` vs `CURTIME()` and `DATEDIFF()` vs `TIMESTAMPDIFF()`; always consider the year when grouping or filtering by month; avoid functions on indexed date columns; understand half-open ranges, "today" vs "last 24 hours" and "this month" vs "last 30 days"; and be ready to discuss time zones — date correctness is both a business and a performance concern.
