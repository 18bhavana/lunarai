---
title: Advanced Analytical Queries
subtitle: Running and rolling aggregates, NTILE, PERCENT_RANK, CUME_DIST, revenue contribution, leaderboards, KPI dashboards, funnels, customer segmentation and Pareto analysis.
order: 24
---

## Introduction

Advanced analytical SQL powers business intelligence (BI), reporting dashboards, financial systems, banking analytics, customer segmentation, enterprise applications and product-company interviews.

This chapter covers running totals and averages, rolling aggregates, `NTILE()`, `PERCENT_RANK()`, `CUME_DIST()`, percentile-style analysis, revenue contribution, KPI dashboards, sales funnels, customer segmentation, enterprise reporting patterns and performance considerations — one of the most valuable SQL topics for experienced Java backend developers, data engineers and BI developers.

## What Are Analytical Queries?

Analytical queries **analyze data to answer business questions**:

- Which products generate the most revenue?
- Which customers belong to the top 10%?
- How is revenue growing over time?
- Which employees perform above average?
- Which regions contribute the most revenue?
- What percentage of total revenue comes from each customer?

Unlike transactional queries, they focus on trends, patterns, rankings, comparisons, distributions, aggregations and business KPIs.

## Transactional vs Analytical Queries

| Transactional queries | Analytical queries |
| --- | --- |
| Insert or retrieve individual records | Analyze large sets of records |
| Used in daily application operations | Used for reporting and decision-making |
| Usually simple and highly selective | Often aggregate large datasets |
| Example: find an order by ID | Example: calculate monthly revenue growth |
| Common in OLTP systems | Common in reporting and analytics |

```sql
-- Transactional
SELECT * FROM orders WHERE order_id = 1001;

-- Analytical
SELECT YEAR(order_date)  AS order_year,
       MONTH(order_date) AS order_month,
       SUM(amount)       AS monthly_revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date);
```

## Sample Sales Table

| Order ID | Customer | Month no | Month | Revenue |
| --- | --- | --- | --- | --- |
| 1 | John | 1 | Jan | 10000 |
| 2 | David | 1 | Jan | 15000 |
| 3 | Lisa | 2 | Feb | 18000 |
| 4 | John | 2 | Feb | 12000 |
| 5 | Mary | 3 | Mar | 25000 |
| 6 | David | 3 | Mar | 20000 |

> [!IMPORTANT]
> For chronological analytics, order by `month_no`, `order_date` or a `year_month` value — **not** `ORDER BY month`, which sorts the textual names alphabetically.

## Running Total

A running total shows the **cumulative value from the beginning up to the current row**. With monthly revenue of Jan 10000, Feb 18000 and Mar 25000:

```sql
SELECT month,
       revenue,
       SUM(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_revenue
FROM monthly_sales;
```

| Month | Revenue | Running revenue |
| --- | --- | --- |
| Jan | 10000 | 10000 |
| Feb | 18000 | 28000 |
| Mar | 25000 | 53000 |

- **January:** 10000 = 10000
- **February:** 10000 + 18000 = 28000
- **March:** 10000 + 18000 + 25000 = 53000

`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` means: start from the first row, include every row, stop at the current row.

### The Running-Total Pattern

Memorize this:

```sql
SUM(column_name) OVER (
    ORDER BY ordering_column
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
```

Common uses: account balances, cumulative revenue, inventory movement, total sales achieved and budget consumption.

## Running Average

The average from the first row up to the current row — `AVG(row 1)`, then `AVG(rows 1–2)`, then `AVG(rows 1–3)`…

```sql
SELECT month,
       revenue,
       AVG(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_average
FROM monthly_sales;
```

### Running Total per Customer

```sql
SELECT customer_id,
       order_date,
       amount,
       SUM(amount) OVER (
           PARTITION BY customer_id
           ORDER BY order_date, order_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS customer_running_total
FROM orders;
```

The running total **restarts for every customer** because of `PARTITION BY customer_id`.

## Rolling Aggregates

A rolling aggregate uses a **moving window** instead of calculating from the beginning — a 3-day moving average, 7-day rolling revenue, 30-day moving sales, a 3-month rolling total.

```sql
-- Rolling 3-month total
SELECT month,
       revenue,
       SUM(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS rolling_revenue
FROM monthly_sales;

-- Rolling 3-month average
SELECT month,
       revenue,
       AVG(revenue) OVER (
           ORDER BY month_no
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS rolling_average
FROM monthly_sales;
```

`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` = previous 2 rows + current row = **at most 3 rows**. Used heavily in financial forecasting, sales-trend analysis, stock-market analysis, demand forecasting and performance dashboards.

### Running vs Rolling

| Running calculation | Rolling calculation |
| --- | --- |
| Starts from the first row | Uses a fixed moving window |
| Window keeps growing | Window moves forward |
| Example: cumulative revenue | Example: 3-month moving average |
| `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` | `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` |

> [!NOTE]
> `N PRECEDING` with `ROWS` counts **rows**, not calendar time. A "7-day" rolling window is only correct if there is exactly one row per day — fill missing dates first (for example with a recursive date CTE) or aggregate per day before applying the frame.

## NTILE()

`NTILE()` divides ordered rows into a specified number of **approximately equal-sized buckets**:

```sql
NTILE(number_of_buckets) OVER (ORDER BY column)
```

| Call | Buckets |
| --- | --- |
| `NTILE(2)` | 2 groups |
| `NTILE(4)` | Quartiles |
| `NTILE(10)` | Deciles |
| `NTILE(100)` | 100 buckets |

### Salary Quartiles

```sql
SELECT name,
       salary,
       NTILE(4) OVER (ORDER BY salary DESC) AS salary_quartile
FROM employee;
```

The highest salaries land in quartile 1 and the lowest in quartile 4.

### Uneven Buckets

10 rows can't be split equally into `NTILE(4)`, so the bucket sizes are **3, 3, 2, 2** — the larger buckets are assigned first.

> [!IMPORTANT]
> `NTILE()` distributes rows as evenly as possible, but bucket sizes can differ by **at most one row**.

### NTILE() and Ties

`NTILE()` divides **rows**, not distinct values — employees with equal salaries can fall into **different buckets**. If the business rule is *"all customers with the same revenue must belong to the same segment"*, `NTILE()` may not be the right tool.

## Customer Segmentation with NTILE()

First calculate revenue per customer, then divide customers into quartiles:

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
),
customer_segments AS (
    SELECT customer_id,
           revenue,
           NTILE(4) OVER (ORDER BY revenue DESC) AS quartile
    FROM customer_revenue
)
SELECT *
FROM customer_segments;
```

| Quartile | Interpretation |
| --- | --- |
| 1 | Highest-value customers |
| 2 | High-value customers |
| 3 | Medium-value customers |
| 4 | Lower-value customers |

Add `WHERE quartile = 1` to the final `SELECT` to get only the **top-quartile** customers.

### Labelled Segments

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
),
customer_segments AS (
    SELECT customer_id,
           revenue,
           NTILE(4) OVER (ORDER BY revenue DESC) AS segment
    FROM customer_revenue
)
SELECT customer_id,
       revenue,
       CASE
           WHEN segment = 1 THEN 'VIP'
           WHEN segment = 2 THEN 'High Value'
           WHEN segment = 3 THEN 'Medium Value'
           ELSE 'Low Value'
       END AS customer_segment
FROM customer_segments;
```

## PERCENT_RANK()

Returns the **relative rank** of a row between **0 and 1**:

```text
PERCENT_RANK = (RANK − 1) / (total rows − 1)
```

```sql
SELECT name,
       salary,
       PERCENT_RANK() OVER (ORDER BY salary) AS percent_rank
FROM employee;
```

For six distinct salaries:

| Name | Salary | Percent rank |
| --- | --- | --- |
| Lisa | 50000 | 0.00 |
| Alex | 55000 | 0.20 |
| John | 70000 | 0.40 |
| Mary | 80000 | 0.60 |
| Tom | 85000 | 0.80 |
| David | 90000 | 1.00 |

The lowest-ranked row always gets **0**; the highest gets **1** when its rank reaches the final position (it won't if the top values are tied). Because `PERCENT_RANK()` is based on `RANK()`, **ties affect the result**.

## CUME_DIST()

**Cumulative distribution** — the proportion of rows whose ordering value is **less than or equal to** the current row's value (for ascending order):

```text
CUME_DIST = rows with value ≤ current value / total rows
```

```sql
SELECT name,
       salary,
       CUME_DIST() OVER (ORDER BY salary) AS cumulative_distribution
FROM employee;
```

| Name | Salary | Cumulative distribution |
| --- | --- | --- |
| Lisa | 50000 | 0.1667 |
| Alex | 55000 | 0.3333 |
| John | 70000 | 0.5000 |
| Mary | 80000 | 0.6667 |
| Tom | 85000 | 0.8333 |
| David | 90000 | 1.0000 |

First row: 1 ÷ 6 = 0.1667. Last row: 6 ÷ 6 = 1.0000.

## PERCENT_RANK() vs CUME_DIST()

A common interview question.

| Feature | PERCENT_RANK() | CUME_DIST() |
| --- | --- | --- |
| Measures | Relative rank | Cumulative distribution |
| First row | 0 | At least 1/N |
| Last row | Can be 1 | Always 1 |
| Based on | Rank position | Rows at or below the current value |
| Ties | Same percent rank | Same cumulative distribution for peers |

**Memory trick:** `PERCENT_RANK` — *where does this row rank?* `CUME_DIST` — *what proportion of rows are at or below this value?*

### RANK() vs PERCENT_RANK()

For four rows where the middle two tie:

| RANK() | PERCENT_RANK() |
| --- | --- |
| 1 | 0.00 |
| 2 | 0.33 |
| 2 | 0.33 |
| 4 | 1.00 |

`RANK()` is an integer ranking; `PERCENT_RANK()` is a relative ranking between 0 and 1.

### Choosing Between NTILE, PERCENT_RANK and CUME_DIST

| Business question | Function |
| --- | --- |
| Divide customers into 4 groups | `NTILE(4)` |
| How highly ranked is this customer? | `PERCENT_RANK()` |
| What percentage of customers spend this amount or less? | `CUME_DIST()` |

## Top 10% Customers

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
),
customer_rank AS (
    SELECT customer_id,
           revenue,
           PERCENT_RANK() OVER (ORDER BY revenue) AS pr
    FROM customer_revenue
)
SELECT *
FROM customer_rank
WHERE pr >= 0.90;
```

> [!IMPORTANT]
> This is a **relative-rank interpretation** of "top 10%". Depending on the number of rows, ties and the exact business definition, the result may not contain exactly 10% of customers. For *"10 approximately equal groups"*, use `NTILE(10)`; an exact statistical percentile threshold needs additional percentile logic.

### Top 10% Using NTILE()

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
),
customer_segments AS (
    SELECT customer_id,
           revenue,
           NTILE(10) OVER (ORDER BY revenue DESC) AS decile
    FROM customer_revenue
)
SELECT *
FROM customer_segments
WHERE decile = 1;
```

This returns the first approximately equal-sized bucket.

## Revenue Contribution Percentage

*What percentage of total company revenue does each customer contribute?* Combine the grouped aggregate with a window function over the grouped rows:

```sql
SELECT customer_id,
       SUM(amount) AS revenue,
       ROUND(SUM(amount) * 100.0 / SUM(SUM(amount)) OVER (), 2) AS revenue_percentage
FROM orders
GROUP BY customer_id;
```

### Understanding SUM(SUM(amount)) OVER ()

- **Inner `SUM(amount)`** — revenue per customer, because of `GROUP BY customer_id`.
- **Outer `SUM(...) OVER ()`** — a window over the grouped rows that adds the customer totals together.

```flow-h
Customer A revenue, Customer B revenue, Customer C revenue
: window SUM
Total company revenue
```

Window functions run **after** `GROUP BY`, which is why they can aggregate an aggregate.

### More Readable with a CTE

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
)
SELECT customer_id,
       revenue,
       ROUND(revenue * 100.0 / SUM(revenue) OVER (), 2) AS revenue_percentage
FROM customer_revenue;
```

The same pattern gives **product revenue contribution** — group `sales` by `product_id` instead.

## Sales Leaderboards

```sql
WITH salesperson_revenue AS (
    SELECT salesperson, SUM(amount) AS revenue
    FROM sales
    GROUP BY salesperson
)
SELECT salesperson,
       revenue,
       RANK() OVER (ORDER BY revenue DESC) AS ranking
FROM salesperson_revenue;
```

Salespeople with equal revenue share a rank and **the next rank is skipped**. If gaps aren't wanted, use `DENSE_RANK() OVER (ORDER BY revenue DESC)`. Ranking products works the same way:

```sql
WITH product_revenue AS (
    SELECT product_id, SUM(amount) AS revenue
    FROM sales
    GROUP BY product_id
)
SELECT product_id,
       revenue,
       RANK() OVER (ORDER BY revenue DESC) AS product_rank
FROM product_revenue;
```

## KPI Dashboards

A KPI dashboard summarizes important business metrics.

```sql
-- Per department: employee count, average/highest/lowest salary, total payroll
SELECT department,
       COUNT(*)              AS employee_count,
       ROUND(AVG(salary), 2) AS average_salary,
       MAX(salary)           AS highest_salary,
       MIN(salary)           AS lowest_salary,
       SUM(salary)           AS total_payroll
FROM employee
GROUP BY department;

-- Company-wide
SELECT COUNT(*)                   AS total_employees,
       COUNT(DISTINCT department) AS total_departments,
       ROUND(AVG(salary), 2)      AS average_salary,
       MAX(salary)                AS highest_salary,
       MIN(salary)                AS lowest_salary,
       SUM(salary)                AS total_payroll
FROM employee;
```

### Monthly and Quarterly Revenue Dashboards

A production-style query includes the **year**:

```sql
SELECT YEAR(order_date)            AS order_year,
       MONTH(order_date)           AS order_month,
       SUM(amount)                 AS revenue,
       COUNT(*)                    AS total_orders,
       COUNT(DISTINCT customer_id) AS unique_customers,
       ROUND(AVG(amount), 2)       AS average_order_value
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date)
ORDER BY order_year, order_month;

SELECT YEAR(order_date)    AS order_year,
       QUARTER(order_date) AS order_quarter,
       SUM(amount)         AS revenue
FROM orders
GROUP BY YEAR(order_date), QUARTER(order_date)
ORDER BY order_year, order_quarter;
```

Grouping only by `MONTH(order_date)` merges January 2025 and January 2026 into one group.

### Department Performance Analysis

```sql
WITH department_metrics AS (
    SELECT department,
           COUNT(*)    AS employee_count,
           AVG(salary) AS average_salary,
           SUM(salary) AS payroll
    FROM employee
    GROUP BY department
)
SELECT department,
       employee_count,
       average_salary,
       payroll,
       RANK() OVER (ORDER BY average_salary DESC)        AS salary_rank,
       ROUND(payroll * 100.0 / SUM(payroll) OVER (), 2) AS payroll_percentage
FROM department_metrics;
```

## Sales Funnel Analysis

A sales funnel represents customers moving through stages:

```flow-h
Lead
Qualified
Proposal
Won
```

```sql
SELECT stage, COUNT(*) AS customers
FROM sales_pipeline
GROUP BY stage;
```

| Stage | Customers |
| --- | --- |
| Lead | 1200 |
| Qualified | 700 |
| Proposal | 350 |
| Won | 150 |

### Funnel Conversion Rates

Counts alone are useful, but conversion rates are more informative:

```sql
WITH funnel AS (
    SELECT SUM(stage = 'Lead')      AS leads,
           SUM(stage = 'Qualified') AS qualified,
           SUM(stage = 'Proposal')  AS proposals,
           SUM(stage = 'Won')       AS won
    FROM sales_pipeline
)
SELECT leads, qualified, proposals, won,
       ROUND(qualified * 100.0 / NULLIF(leads, 0), 2)     AS lead_to_qualified_percentage,
       ROUND(proposals * 100.0 / NULLIF(qualified, 0), 2) AS qualified_to_proposal_percentage,
       ROUND(won * 100.0 / NULLIF(proposals, 0), 2)       AS proposal_to_won_percentage
FROM funnel;
```

`SUM(stage = 'Lead')` works in MySQL because a comparison evaluates to 1 or 0.

> [!IMPORTANT]
> This assumes each stage count represents the customers who **reached** that stage. If the table only stores each customer's *current* stage, a customer at "Won" is not counted under "Lead", and the ratios are wrong. Real funnel analysis may need customer-level stage history, event timestamps, deduplication and stage ordering.

## Pareto Analysis — the 80/20 Rule

*Which customers generate the first 80% of cumulative revenue?*

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
),
revenue_contribution AS (
    SELECT customer_id,
           revenue,
           SUM(revenue) OVER (
               ORDER BY revenue DESC, customer_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS cumulative_revenue,
           SUM(revenue) OVER () AS total_revenue
    FROM customer_revenue
)
SELECT customer_id,
       revenue,
       cumulative_revenue,
       ROUND(cumulative_revenue * 100.0 / NULLIF(total_revenue, 0), 2) AS cumulative_revenue_percentage
FROM revenue_contribution
ORDER BY revenue DESC, customer_id;
```

To return **only** the customers that make up the first 80%, keep the rows whose cumulative revenue *before* them is still under 80% — this includes the customer who crosses the line:

```sql
-- ...same CTEs...
SELECT customer_id, revenue
FROM revenue_contribution
WHERE (cumulative_revenue - revenue) * 100.0 / NULLIF(total_revenue, 0) < 80
ORDER BY revenue DESC, customer_id;
```

## Analytical Query Processing Pattern

Many enterprise analytical queries follow this structure:

```flow
Filter raw data
Aggregate data
Apply window functions
Calculate business metrics
Filter / rank / segment
Generate the final report
```

CTEs are excellent for organizing these steps:

```sql
WITH base_data AS (
    SELECT ...
    FROM ...
    WHERE ...
),
aggregated_data AS (
    SELECT ...,
           SUM(...) AS metric
    FROM base_data
    GROUP BY ...
),
analytical_data AS (
    SELECT *,
           RANK() OVER (...)        AS ranking,
           SUM(metric) OVER (...)   AS running_total
    FROM aggregated_data
)
SELECT *
FROM analytical_data
WHERE ...;
```

## Performance Considerations

Analytical queries often involve large scans, sorting, grouping, window functions, temporary results and memory, so performance must be considered carefully.

### Filter Early

When only the current year is required, don't process all history — filter first, then aggregate and apply window functions:

```sql
SELECT ...
FROM orders
WHERE order_date >= '2026-01-01'
  AND order_date <  '2027-01-01';
```

**Reduce data early → aggregate → apply expensive analytics.**

### Indexing

Indexes may help filtering columns, join columns, date ranges, partitioning columns and ordering columns:

```sql
CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date);
CREATE INDEX idx_orders_order_date    ON orders (order_date);
```

Indexes don't guarantee that all window-function sorting can be avoided — always inspect the actual plan with `EXPLAIN SELECT ...` or `EXPLAIN ANALYZE SELECT ...`. Look for full table scans, expensive sorts, large intermediate results, poor join strategies and missing indexes.

## Interview Questions

### Q1. Divide employees into salary quartiles.

```sql
SELECT name, salary,
       NTILE(4) OVER (ORDER BY salary DESC) AS salary_quartile
FROM employee;
```

### Q2. Calculate running revenue.

```sql
SELECT order_date,
       amount,
       SUM(amount) OVER (
           ORDER BY order_date, order_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_revenue
FROM orders;
```

### Q3. Find the top 10% of customers.

Use `PERCENT_RANK() OVER (ORDER BY revenue)` over per-customer revenue and keep `pr >= 0.90` (see *Top 10% Customers* above), or `NTILE(10)` and keep decile 1.

### Q4. Calculate each customer's revenue contribution percentage.

```sql
WITH customer_revenue AS (
    SELECT customer_id, SUM(amount) AS revenue
    FROM orders
    GROUP BY customer_id
)
SELECT customer_id,
       revenue,
       ROUND(revenue * 100.0 / SUM(revenue) OVER (), 2) AS revenue_percentage
FROM customer_revenue;
```

### Q5. Explain NTILE(), PERCENT_RANK() and CUME_DIST().

- `NTILE()` divides rows into approximately equal buckets.
- `PERCENT_RANK()` returns a relative ranking between 0 and 1.
- `CUME_DIST()` returns a cumulative distribution greater than 0 and up to 1.

### Q6. Why is NTILE() not an exact percentile function?

It only splits rows into equal-count buckets by position; it doesn't compute a percentile value, and ties can be split across buckets.

## Common Mistakes

- ❌ **Sorting textual month names** — `ORDER BY month` on Jan/Feb/Mar sorts alphabetically. Use `month_no` or a real date.
- ❌ **Confusing `RANK()` with `PERCENT_RANK()`** — integer rank vs relative rank between 0 and 1.
- ❌ **Using `NTILE()` for exact statistical percentiles** — it divides rows into buckets; it doesn't calculate a percentile value.
- ❌ **Assuming `NTILE()` keeps ties together** — equal values may land in different buckets.
- ❌ **Ignoring deterministic ordering** — `ORDER BY order_date` is ambiguous when orders share a date; use `ORDER BY order_date, order_id`.
- ❌ **Grouping months without the year** — avoid `GROUP BY MONTH(order_date)` for multi-year data; use `GROUP BY YEAR(order_date), MONTH(order_date)`.
- ❌ **Applying analytics before filtering** — processing millions of unnecessary rows is expensive; filter as early as possible.

## Mini Project

Given the `sales` and `orders` tables, write queries to:

1. Calculate running revenue.
2. Calculate running average revenue.
3. Calculate a rolling three-month total.
4. Calculate a rolling three-month average.
5. Divide customers into four revenue quartiles.
6. Find the highest-value customer quartile.
7. Find customers in the top relative 10%.
8. Calculate each customer's revenue contribution percentage.
9. Generate a sales leaderboard.
10. Build a department KPI dashboard.
11. Calculate monthly revenue.
12. Calculate quarterly revenue.
13. Build a sales funnel report.
14. Calculate funnel conversion rates.
15. Build a Pareto-style cumulative revenue report.

## Practice Problems

**Easy**

1. Calculate running totals.
2. Calculate running averages.
3. Generate salary quartiles.
4. Generate revenue rankings.
5. Calculate cumulative distributions.
6. Calculate revenue contribution percentages.

**Medium**

1. Build a rolling-average report.
2. Generate customer segments.
3. Build a monthly KPI dashboard.
4. Analyze quarterly revenue.
5. Build a sales leaderboard.
6. Calculate customer revenue contribution.
7. Build a product revenue leaderboard.

**Interview level**

1. Explain `NTILE()` vs `RANK()`.
2. Explain `PERCENT_RANK()` vs `CUME_DIST()`.
3. Explain why `NTILE()` is not an exact percentile function.
4. Build a customer segmentation report.
5. Design an executive KPI dashboard.
6. Build an 80/20 Pareto analysis.
7. Explain how ties affect analytical functions.
8. Optimize a complex analytical query.
9. Explain running vs rolling calculations.
10. Design a multi-stage analytical query using CTEs and window functions.

## Best Practices

- ✅ Use window functions for analytical calculations instead of complex self-joins.
- ✅ Filter unnecessary rows before applying expensive analytical operations.
- ✅ Use real dates or numeric sequence columns for chronological ordering.
- ✅ Add deterministic tie-breakers when ordering values repeat.
- ✅ Choose the function by requirement — ranking: `RANK` / `DENSE_RANK`; buckets: `NTILE`; relative ranking: `PERCENT_RANK`; cumulative distribution: `CUME_DIST`; running: `UNBOUNDED PRECEDING`; rolling: `N PRECEDING`.
- ✅ Use descriptive aliases for calculated columns.
- ✅ Use CTEs to split complex analytical queries into logical steps.
- ✅ Test analytical queries on realistic production-scale data, and inspect performance with `EXPLAIN` / `EXPLAIN ANALYZE`.

## The Mental Model

```flow
Raw transactional data
Filter relevant data
Aggregate
Apply window functions
Rank / segment / compare
Calculate business KPIs
Dashboard / report
```

Advanced analytical queries are widely used in banking analytics, financial forecasting, executive dashboards, sales performance tracking, customer segmentation, fraud detection, inventory optimization, data warehousing, BI, Spring Boot reporting APIs, customer retention, product analytics, revenue analysis and performance scorecards.

## Interview One-Liners

- **NTILE()** — `NTILE(N)` divides ordered rows into N approximately equal-sized buckets, with bucket sizes differing by at most one row.
- **PERCENT_RANK()** — returns the relative rank of a row as `(RANK − 1) / (total rows − 1)`, a value between 0 and 1.
- **CUME_DIST()** — returns the proportion of rows whose ordering value is less than or equal to the current row's value (for ascending order).

## Key Takeaways

- ✅ Analytical queries turn raw transactional data into business insights.
- ✅ Running totals and averages accumulate from the first row; rolling calculations use a moving fixed-size window.
- ✅ `NTILE()` divides rows into approximately equal buckets — it isn't an exact percentile, and equal values may be split across buckets.
- ✅ `PERCENT_RANK()` measures relative rank between 0 and 1; `CUME_DIST()` measures cumulative distribution.
- ✅ Revenue contribution percentages combine grouped aggregates with window functions.
- ✅ CTEs structure complex analytical queries; analytical queries power dashboards, KPIs, segmentation and executive reporting.
- ✅ Performance depends heavily on filtering, indexing, sorting and execution plans.
