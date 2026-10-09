---
title: Advanced Window Functions
subtitle: LAG, LEAD, FIRST_VALUE, LAST_VALUE and NTH_VALUE — previous/next-row comparisons, month-over-month and year-over-year growth, moving averages, running max/min, window frames and ROWS vs RANGE.
order: 23
---

## Introduction

Advanced window functions are used extensively in enterprise reporting, financial analytics, time-series analysis, banking, sales dashboards, stock-market analytics and product-company interviews. They let you **compare one row with another without complex self-joins**.

You'll learn `LEAD()`, `LAG()`, `FIRST_VALUE()`, `LAST_VALUE()`, `NTH_VALUE()`, window frames, previous- and next-row comparisons, month-over-month growth and growth percentages, moving averages, and running maximums and minimums.

## Sample Monthly Sales Table

| Month no | Month | Revenue |
| --- | --- | --- |
| 1 | Jan | 100000 |
| 2 | Feb | 120000 |
| 3 | Mar | 95000 |
| 4 | Apr | 140000 |
| 5 | May | 170000 |

> [!TIP]
> For reliable ordering, use a real ordering column (`month_no`, `sale_month`, `order_date`) — not month **names**, which sort alphabetically.

## What Are Value Window Functions?

They let one row access values from **other rows** in the same result:

| Function | Accesses |
| --- | --- |
| `LAG()` | A previous row |
| `LEAD()` | A next row |
| `FIRST_VALUE()` | The first row of the frame |
| `LAST_VALUE()` | The last row of the frame |
| `NTH_VALUE()` | The Nth row of the frame |

## LAG()

Returns a value from a **previous** row:

```sql
LAG(expression, offset, default_value) OVER (ORDER BY column)
```

| Parameter | Meaning |
| --- | --- |
| `expression` | Column whose previous value you want |
| `offset` | How many rows back to look (default 1) |
| `default_value` | Returned when no previous row exists (default `NULL`) |

### Basic LAG()

```sql
SELECT month,
       revenue,
       LAG(revenue) OVER (ORDER BY month_no) AS previous_month_revenue
FROM monthly_sales;
```

| Month | Revenue | Previous month revenue |
| --- | --- | --- |
| Jan | 100000 | NULL |
| Feb | 120000 | 100000 |
| Mar | 95000 | 120000 |
| Apr | 140000 | 95000 |
| May | 170000 | 140000 |

January has no previous row, so it gets `NULL`.

### LAG() with an Offset and a Default

```sql
-- Two rows back
SELECT month, revenue,
       LAG(revenue, 2) OVER (ORDER BY month_no) AS revenue_two_months_ago
FROM monthly_sales;

-- 0 instead of NULL for the first row
SELECT month, revenue,
       LAG(revenue, 1, 0) OVER (ORDER BY month_no) AS previous_revenue
FROM monthly_sales;
```

## LEAD()

Returns a value from a **following** row: `LEAD(expression, offset, default_value) OVER (ORDER BY column)`.

```sql
SELECT month,
       revenue,
       LEAD(revenue) OVER (ORDER BY month_no) AS next_month_revenue
FROM monthly_sales;
```

| Month | Revenue | Next month revenue |
| --- | --- | --- |
| Jan | 100000 | 120000 |
| Feb | 120000 | 95000 |
| Mar | 95000 | 140000 |
| Apr | 140000 | 170000 |
| May | 170000 | NULL |

May has no next row → `NULL`. Look two rows ahead with `LEAD(revenue, 2)`.

| Function | Direction | Meaning |
| --- | --- | --- |
| `LAG()` | Backward | Previous row (behind) |
| `LEAD()` | Forward | Next row (ahead) |

## Month-over-Month Growth

**Growth = current revenue − previous revenue.**

```sql
SELECT month,
       revenue,
       LAG(revenue) OVER (ORDER BY month_no)           AS previous_revenue,
       revenue - LAG(revenue) OVER (ORDER BY month_no) AS growth
FROM monthly_sales;
```

| Month | Revenue | Previous revenue | Growth |
| --- | --- | --- | --- |
| Jan | 100000 | NULL | NULL |
| Feb | 120000 | 100000 | 20000 |
| Mar | 95000 | 120000 | −25000 |
| Apr | 140000 | 95000 | 45000 |
| May | 170000 | 140000 | 30000 |

February: 120000 − 100000 = **+20,000**; March: 95000 − 120000 = **−25,000**.

### Growth Percentage

**Growth % = (current − previous) ÷ previous × 100.** Calculate the previous value once in a CTE:

```sql
WITH revenue_comparison AS (
    SELECT month_no,
           month,
           revenue,
           LAG(revenue) OVER (ORDER BY month_no) AS previous_revenue
    FROM monthly_sales
)
SELECT month,
       revenue,
       previous_revenue,
       revenue - previous_revenue AS growth,
       ROUND((revenue - previous_revenue) / NULLIF(previous_revenue, 0) * 100, 2) AS growth_percentage
FROM revenue_comparison;
```

`NULLIF(previous_revenue, 0)` prevents **division by zero**: if the previous revenue is 0, it becomes `NULL` and the percentage is `NULL`.

## FIRST_VALUE()

Returns the **first value** of the window:

```sql
SELECT month,
       revenue,
       FIRST_VALUE(revenue) OVER (ORDER BY month_no) AS first_month_revenue
FROM monthly_sales;
```

Every row shows **100000**, because January is the first row in the ordered window.

### Compare Every Month with the First Month

```sql
SELECT month,
       revenue,
       FIRST_VALUE(revenue) OVER (ORDER BY month_no)           AS first_month_revenue,
       revenue - FIRST_VALUE(revenue) OVER (ORDER BY month_no) AS growth_from_first_month
FROM monthly_sales;
```

Useful for investment performance, revenue growth, customer growth and stock-price analysis.

## LAST_VALUE() — and the Window Frame Problem

`LAST_VALUE()` returns the last value **in the current window frame** — extremely important. A common mistake is assuming this returns the final row of the whole result:

```sql
SELECT month,
       revenue,
       LAST_VALUE(revenue) OVER (ORDER BY month_no) AS last_revenue
FROM monthly_sales;
```

With `ORDER BY`, the **default frame ends at the current row** (`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`) — Jan's frame ends at Jan, Feb's at Feb, and so on — so `LAST_VALUE()` returns the **current row's** value.

### Correct LAST_VALUE() for the Entire Partition

```sql
SELECT month,
       revenue,
       LAST_VALUE(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS last_month_revenue
FROM monthly_sales;
```

Every row now shows **170000**. `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` means *from the first row to the last row of the partition*.

| Function | Returns |
| --- | --- |
| `FIRST_VALUE()` | First value in the window frame |
| `LAST_VALUE()` | Last value in the window frame |

> [!IMPORTANT]
> `LAST_VALUE()` often needs an **explicit window frame**, because the default frame ends at the current row.

## NTH_VALUE()

`NTH_VALUE(expression, N) OVER (...)` returns the value from the **Nth row** of the frame:

```sql
SELECT month,
       revenue,
       NTH_VALUE(revenue, 3) OVER (
           ORDER BY month_no
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS third_month_revenue
FROM monthly_sales;
```

Every row shows **95000** (March, the third ordered row).

> [!WARNING]
> `NTH_VALUE()` means the **Nth row** in the window, not the Nth highest **distinct** value. With `ORDER BY revenue DESC`, duplicates can make the third row differ from the third-highest distinct revenue — use `DENSE_RANK()` for that.

## Employee Salary Comparisons

| Name | Salary |
| --- | --- |
| Lisa | 50000 |
| Alex | 55000 |
| John | 70000 |
| Mary | 80000 |
| David | 90000 |

```sql
-- Previous salary
SELECT name, salary,
       LAG(salary) OVER (ORDER BY salary) AS previous_salary
FROM employee;
```

| Name | Salary | Previous salary |
| --- | --- | --- |
| Lisa | 50000 | NULL |
| Alex | 55000 | 50000 |
| John | 70000 | 55000 |
| Mary | 80000 | 70000 |
| David | 90000 | 80000 |

```sql
-- Next salary, and the difference from the previous employee
SELECT name, salary,
       LEAD(salary) OVER (ORDER BY salary)          AS next_salary,
       salary - LAG(salary) OVER (ORDER BY salary)  AS salary_difference
FROM employee;
```

### PARTITION BY with LAG()

```sql
SELECT name,
       department,
       salary,
       LAG(salary) OVER (PARTITION BY department ORDER BY salary) AS previous_salary
FROM employee;
```

Each department gets an **independent sequence**; the first employee in each department gets `NULL`.

## Moving Average

A moving average **smooths short-term fluctuations** and reveals trends. A 3-month moving average:

```sql
SELECT month,
       revenue,
       AVG(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS moving_average
FROM monthly_sales;
```

| Month | Revenue | Moving average |
| --- | --- | --- |
| Jan | 100000 | 100000 |
| Feb | 120000 | 110000 |
| Mar | 95000 | 105000 |
| Apr | 140000 | 118333.33 |
| May | 170000 | 135000 |

- **Jan:** only one row → 100000.
- **Feb:** (100000 + 120000) ÷ 2 = 110000.
- **Mar:** (100000 + 120000 + 95000) ÷ 3 = 105000.
- **Apr:** the frame slides forward — (120000 + 95000 + 140000) ÷ 3 = 118333.33; January drops out.

`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` = two previous rows + the current row = **at most 3 rows** — a rolling three-row window.

## Running Maximum, Minimum and Total

```sql
SELECT month,
       revenue,
       MAX(revenue) OVER (ORDER BY month_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_maximum,
       MIN(revenue) OVER (ORDER BY month_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_minimum,
       SUM(revenue) OVER (ORDER BY month_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM monthly_sales;
```

The running maximum is `MAX(Jan)`, then `MAX(Jan, Feb)`, then `MAX(Jan, Feb, Mar)`… Running totals are heavily used for account balances, revenue accumulation, sales dashboards, inventory movement and financial reports.

## Real-World Examples

```sql
-- 1. Month-over-month revenue growth
WITH revenue_data AS (
    SELECT month_no, month, revenue,
           LAG(revenue) OVER (ORDER BY month_no) AS previous_revenue
    FROM monthly_sales
)
SELECT month, revenue, previous_revenue,
       revenue - previous_revenue AS growth
FROM revenue_data;

-- 2. Daily stock price change
SELECT trade_date,
       price,
       LAG(price) OVER (ORDER BY trade_date)         AS previous_price,
       price - LAG(price) OVER (ORDER BY trade_date) AS daily_change
FROM stock_prices;

-- 3. Transaction balance change, per account
SELECT account_id,
       transaction_date,
       balance,
       LAG(balance) OVER (PARTITION BY account_id ORDER BY transaction_date)           AS previous_balance,
       balance - LAG(balance) OVER (PARTITION BY account_id ORDER BY transaction_date) AS balance_change
FROM account_transactions;

-- 4. Next order per customer
SELECT customer_id,
       order_date,
       LEAD(order_date) OVER (PARTITION BY customer_id ORDER BY order_date) AS next_order_date
FROM orders;
```

The next-order query helps analyze purchase frequency, repeat purchases, retention and time between orders.

### Days Until the Next Order

```sql
WITH order_sequence AS (
    SELECT customer_id,
           order_date,
           LEAD(order_date) OVER (PARTITION BY customer_id ORDER BY order_date) AS next_order_date
    FROM orders
)
SELECT customer_id,
       order_date,
       next_order_date,
       DATEDIFF(next_order_date, order_date) AS days_until_next_order
FROM order_sequence;
```

### Year-over-Year Analysis

| Year | Revenue |
| --- | --- |
| 2023 | 1000000 |
| 2024 | 1200000 |
| 2025 | 1500000 |
| 2026 | 1800000 |

```sql
WITH yearly_comparison AS (
    SELECT sales_year,
           revenue,
           LAG(revenue) OVER (ORDER BY sales_year) AS previous_year_revenue
    FROM yearly_sales
)
SELECT sales_year,
       revenue,
       previous_year_revenue,
       revenue - previous_year_revenue AS yoy_growth,
       ROUND((revenue - previous_year_revenue) / NULLIF(previous_year_revenue, 0) * 100, 2) AS yoy_growth_percentage
FROM yearly_comparison;
```

### Same Month, Previous Year

For monthly data across years, compare each month with the **same month last year** by partitioning on the month:

```sql
SELECT sales_year,
       sales_month,
       revenue,
       LAG(revenue) OVER (PARTITION BY sales_month ORDER BY sales_year) AS previous_year_revenue
FROM monthly_sales_history;
```

January 2026 is compared with January 2025, February 2026 with February 2025, and so on.

## Why Window Functions Beat Many Self-Joins

Before window functions, previous-row comparisons often needed a self-join. `LAG(revenue) OVER (ORDER BY month_no)` is far easier to understand than manually joining each row to its previous row — cleaner SQL, less complex logic, better readability and natural time-series analysis.

## Window Frames

A **window frame** defines exactly which rows participate in the calculation. Frame keywords: `UNBOUNDED PRECEDING`, `N PRECEDING`, `CURRENT ROW`, `N FOLLOWING` and `UNBOUNDED FOLLOWING`.

| Pattern | Frame | Rows included |
| --- | --- | --- |
| Running calculation | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` | First row → current row |
| Entire partition | `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` | First row → last row |
| Three-row moving window | `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` | Previous 2 rows + current |
| Centered window | `ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING` | Previous + current + next |

### ROWS vs RANGE

An advanced interview concept.

| ROWS | RANGE |
| --- | --- |
| Physical row positions | Peer groups based on the `ORDER BY` value |
| `2 PRECEDING` = exactly the previous two rows | Rows with equal ordering values are treated together |

> [!TIP]
> For predictable row-by-row running calculations and moving windows, `ROWS` is usually clearer.

## Deterministic Ordering

If several transactions share a date, `ORDER BY transaction_date` doesn't define their exact sequence. Add a unique tie-breaker:

```sql
LAG(balance) OVER (
    PARTITION BY account_id
    ORDER BY transaction_date, transaction_id
)
```

## Performance Considerations

Window functions commonly need **sorting, partitioning, temporary processing and memory**; performance depends on row counts, partitions, the `ORDER BY`/`PARTITION BY` columns, indexes and the optimizer. For `LAG(balance) OVER (PARTITION BY account_id ORDER BY transaction_date)`, a potentially useful index is:

```sql
CREATE INDEX idx_account_transaction_date
    ON account_transactions (account_id, transaction_date);
```

An index doesn't guarantee MySQL can eliminate all sorting — verify with `EXPLAIN` / `EXPLAIN ANALYZE`.

## Interview Questions

### Q1. Calculate month-over-month growth.

```sql
SELECT month, revenue,
       revenue - LAG(revenue) OVER (ORDER BY month_no) AS growth
FROM monthly_sales;
```

### Q2. Compare each employee's salary with the previous employee.

```sql
SELECT name, salary,
       LAG(salary) OVER (ORDER BY salary) AS previous_salary
FROM employee;
```

### Q3. Display next month's revenue.

```sql
SELECT month, revenue,
       LEAD(revenue) OVER (ORDER BY month_no) AS next_month_revenue
FROM monthly_sales;
```

### Q4. Display the first revenue.

```sql
SELECT month, revenue,
       FIRST_VALUE(revenue) OVER (ORDER BY month_no) AS first_revenue
FROM monthly_sales;
```

### Q5. Display the actual last revenue.

```sql
SELECT month, revenue,
       LAST_VALUE(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS last_revenue
FROM monthly_sales;
```

### Q6. Calculate a three-month moving average.

```sql
SELECT month, revenue,
       AVG(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS moving_average
FROM monthly_sales;
```

### Q7. Find the third value.

```sql
SELECT month, revenue,
       NTH_VALUE(revenue, 3) OVER (
           ORDER BY month_no
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS third_value
FROM monthly_sales;
```

### Q8. LEAD vs LAG in one line?

`LAG()` reads a value from a **previous** row and `LEAD()` from a **following** row, according to the ordering inside the window.

### Q9. Why does LAST_VALUE() need an explicit frame?

Because the default frame ends at the current row; to get the true final value of the partition, the frame must extend to `UNBOUNDED FOLLOWING`.

## Common Mistakes

- ❌ **Confusing `LEAD()` and `LAG()`** — `LAG()` = previous row, `LEAD()` = next row.
- ❌ **Using an incorrect ordering column** — `ORDER BY month` with Jan/Feb/Mar/Apr sorts alphabetically, not chronologically. Use `month_no` or a real date.
- ❌ **Forgetting deterministic ordering** — use `ORDER BY transaction_date, transaction_id` when ties are possible.
- ❌ **Incorrect `LAST_VALUE()`** — without `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, it returns the current row's value.
- ❌ **Assuming `NTH_VALUE()` means Nth highest distinct value** — use `DENSE_RANK()` for that.
- ❌ **Division by zero in growth calculations** — use `NULLIF(previous_revenue, 0)`.
- ❌ **Repeating the same window expression many times** — compute it once in a CTE and reuse it.

## Mini Project

Using the `monthly_sales` table, write queries to:

1. Display the previous month's revenue.
2. Display the next month's revenue.
3. Display revenue from two months ago.
4. Calculate month-over-month growth.
5. Calculate month-over-month growth percentage.
6. Display the first month's revenue beside every row.
7. Display the final month's revenue beside every row.
8. Display the third month's revenue beside every row.
9. Calculate a three-month moving average.
10. Calculate the running maximum revenue.
11. Calculate the running minimum revenue.
12. Calculate cumulative revenue.

## Practice Problems

**Easy**

1. Use `LAG()` to show the previous value.
2. Use `LEAD()` to show the next value.
3. Display the first salary.
4. Display the last salary.
5. Display the third row's revenue using `NTH_VALUE()`.

**Medium**

1. Build a sales growth report.
2. Calculate employee salary differences.
3. Generate a running minimum.
4. Generate a running maximum.
5. Build a moving-average report.
6. Calculate days between customer orders.
7. Compare every month's revenue with the first month.

**Interview level**

1. Explain `LEAD()` vs `LAG()`.
2. Explain `FIRST_VALUE()` vs `LAST_VALUE()`.
3. Explain why `LAST_VALUE()` often requires an explicit window frame.
4. Explain `ROWS` vs `RANGE`.
5. Build a financial dashboard with running totals and moving averages.
6. Calculate month-over-month growth percentage.
7. Calculate year-over-year growth.
8. Compare window functions with self-joins for time-series analysis.
9. Explain deterministic ordering in window functions.
10. Explain why `NTH_VALUE()` differs from `DENSE_RANK()`.

## Best Practices

- ✅ Use meaningful `ORDER BY` columns — real dates or numeric sequences, not month names.
- ✅ Use `PARTITION BY` when calculations must restart per customer, department, account, product or region.
- ✅ Add deterministic tie-breakers when ordering values can repeat.
- ✅ Define the full frame explicitly for `LAST_VALUE()`, and use explicit `ROWS` frames for running and moving calculations.
- ✅ Protect percentage calculations with `NULLIF()`.
- ✅ Reuse window results through CTEs.
- ✅ Prefer window functions over complicated self-joins for previous/next-row analysis, and validate performance with `EXPLAIN`.

## The Mental Model

```flow-h
Rows
PARTITION BY — independent groups
ORDER BY — row sequence
Window frame — visible rows
LAG / LEAD / FIRST / LAST / NTH
```

Used extensively in banking analysis and balance tracking, financial forecasting, stock analytics, fraud detection, payroll analysis, retention dashboards, sales-trend reporting, revenue growth analysis, BI, Spring Boot analytics APIs, time-series analysis, inventory movement and audit systems.

## Key Takeaways

- ✅ `LAG()` reads a previous row and `LEAD()` a following row; both support offsets and defaults.
- ✅ `FIRST_VALUE()` / `LAST_VALUE()` return the first/last value of the **frame** — `LAST_VALUE()` usually needs a full-partition frame.
- ✅ `NTH_VALUE()` returns the Nth row's value, not the Nth highest distinct value.
- ✅ `LAG()` is ideal for month-over-month and year-over-year comparisons.
- ✅ Window frames control which rows participate; moving averages use sliding frames; running calculations use `UNBOUNDED PRECEDING` to `CURRENT ROW`.
- ✅ Deterministic ordering is essential when ordering values repeat.
