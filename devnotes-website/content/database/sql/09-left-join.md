---
title: LEFT JOIN
subtitle: Keeping every left-side row — NULLs for missing matches, the anti-join pattern for missing records, ON vs WHERE filters, duplicates from one-to-many, multiple optional joins and JPA fetch joins.
order: 9
---

## Introduction

`LEFT JOIN` is extremely important in real-world backend development because it helps you find **missing or optional data**. If you've ever needed to answer questions like:

- Which users haven't placed an order?
- Which employees don't have managers?
- Which events have no tickets sold?
- Which customers never made a payment?

…you're looking for `LEFT JOIN`.

## Sample Tables

| user_id | name |
| --- | --- |
| 1 | Rahul |
| 2 | Amit |
| 3 | Neha |
| 4 | Ankit |

| order_id | user_id | amount |
| --- | --- | --- |
| 101 | 1 | 500 |
| 102 | 2 | 700 |
| 103 | 1 | 900 |

Notice: **Neha and Ankit have never placed an order.**

## Why Do We Need LEFT JOIN?

Your manager asks: *show me all users, even if they've never placed an order.* `INNER JOIN` can't do this, because it returns only rows with matches in both tables. This is where `LEFT JOIN` is used.

## INNER JOIN vs LEFT JOIN

**INNER JOIN** returns only matching records — Neha and Ankit disappear because they have no matching orders.

**LEFT JOIN** returns:

- Every row from the **left** table
- Matching rows from the right table
- `NULL` for right-table columns when no match exists

```buckets LEFT JOIN result
Rahul: Order 101, Order 103
Amit: Order 102
Neha: NULL
Ankit: NULL
```

> [!IMPORTANT]
> The most important rule: **LEFT JOIN preserves all rows from the left table.**

## LEFT JOIN Syntax

```sql
SELECT columns
FROM table1 t1
LEFT JOIN table2 t2
    ON t1.id = t2.id;
```

Real example:

```sql
SELECT u.name,
       o.order_id
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id;
```

| Name | Order |
| --- | --- |
| Rahul | 101 |
| Rahul | 103 |
| Amit | 102 |
| Neha | NULL |
| Ankit | NULL |

Notice: **Rahul appears twice** because he has two matching orders.

> [!WARNING]
> A join doesn't guarantee one row per user. If one user matches multiple rows in the right table, the user appears multiple times.

## How LEFT JOIN Works

```flow
Read a row from users
Search for matching orders
? Match found? | Yes: Return the user with each matching order | No: Return the user with NULL order columns
```

Unlike `INNER JOIN`, a `LEFT JOIN` preserves rows from the left table even when no matching row exists in the right table.

## Why Does NULL Appear?

Does Neha have an order? **No.** Instead of removing Neha from the result, MySQL returns `Neha | NULL`. Here `NULL` means *no matching row exists in the right table* — Neha exists in `users`, no matching `user_id` exists in `orders`, so `order_id` and `amount` are `NULL`.

## Finding Missing Records (Anti-Join)

One of the most common SQL interview patterns.

> [!QUESTION] Find users who have never placed an order.

```sql
SELECT u.user_id,
       u.name
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id
WHERE o.order_id IS NULL;
```

| user_id | Name |
| --- | --- |
| 3 | Neha |
| 4 | Ankit |

### Why Does This Work?

After the `LEFT JOIN`, the rows are Rahul–101, Rahul–103, Amit–102, Neha–NULL, Ankit–NULL. Then `WHERE o.order_id IS NULL` keeps only the rows where **no matching order exists**.

### The Anti-Join Pattern

Common interview questions: customers without orders, employees without managers, products never sold, students without courses, events with no bookings. The common solution:

```flow-h This is called an anti-join
LEFT JOIN
: +
WHERE right_table.id IS NULL
```

```sql
SELECT t1.*
FROM table1 t1
LEFT JOIN table2 t2
    ON t1.id = t2.id
WHERE t2.id IS NULL;
```

(Test a column that can't be `NULL` in a real match — usually the right table's primary key. `NOT EXISTS` is the equivalent subquery form.)

## LEFT JOIN with WHERE

One of the most important `LEFT JOIN` concepts. Requirement: *show all users, but return only their orders where the amount is greater than 500.*

```sql
SELECT u.name,
       o.amount
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id
WHERE o.amount > 500;
```

| Name | Amount |
| --- | --- |
| Rahul | 900 |
| Amit | 700 |

**Neha and Ankit disappear!** Why? For unmatched users, `o.amount` is `NULL`, and `NULL > 500` doesn't evaluate to TRUE — so the `WHERE` clause removes those rows. The query effectively returns only rows with qualifying orders.

### Correct Way — Filter in the ON Clause

To preserve all users, move the right-table filter into the `ON` condition:

```sql
SELECT u.name,
       o.amount
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id
   AND o.amount > 500;
```

| Name | Amount |
| --- | --- |
| Rahul | 900 |
| Amit | 700 |
| Neha | NULL |
| Ankit | NULL |

`AND o.amount > 500` controls **which rows from `orders` are allowed to match**. It doesn't remove users from the left table.

### ON vs WHERE in a LEFT JOIN

| Filter in `WHERE` | Filter in `ON` |
| --- | --- |
| Join users and orders, **then** keep only final rows where `amount > 500` | Return every user, but only **match** orders where `amount > 500` |
| Unmatched users are removed | Unmatched users are preserved |

An extremely common interview question.

## Multiple LEFT JOINs

Real applications often contain several optional relationships — users → orders → payments → coupons:

```sql
SELECT u.name,
       o.order_id,
       p.payment_status,
       c.coupon_code
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id
LEFT JOIN payments p
    ON o.order_id = p.order_id
LEFT JOIN coupons c
    ON o.order_id = c.order_id;
```

Even if a user has no order, an order has no payment, or an order has no coupon, the earlier left-side rows still appear, with missing right-side values as `NULL`.

## LEFT JOIN vs INNER JOIN

| INNER JOIN | LEFT JOIN |
| --- | --- |
| Returns only matching rows | Returns all rows from the left table |
| Drops unmatched rows | Preserves unmatched left rows |
| Missing relationships are excluded | Missing right-side data appears as `NULL` |
| Use when a match is required | Use when a relationship is optional |

```sql
-- Only users who have orders
SELECT u.name, o.order_id
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id;

-- All users, whether they have orders or not
SELECT u.name, o.order_id
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id;
```

## Spring Boot / JPA Example

```java
@Entity
class User {

    @OneToMany(mappedBy = "user")
    private List<Order> orders;
}
```

Rahul has orders; Neha has none. JPQL:

```java
@Query("""
        SELECT DISTINCT u
        FROM User u
        LEFT JOIN FETCH u.orders
        """)
List<User> findAllUsersWithOrders();
```

Hibernate generates SQL similar to:

```sql
SELECT ...
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id;
```

Every user is returned; orders are loaded when available. `DISTINCT` is used in JPQL fetch joins to avoid duplicate root entities when a user has multiple orders. (Hibernate 6 de-duplicates fetch-join roots automatically, so it's optional there.)

## Production Examples

### Find Inactive Users

*Business requirement: find users who have never placed an order.*

```sql
SELECT u.user_id,
       u.name
FROM users u
LEFT JOIN orders o
    ON u.user_id = o.user_id
WHERE o.order_id IS NULL;
```

```flow-h
users
LEFT JOIN orders
No matching order
Inactive user
```

### Find Events with No Bookings

```sql
SELECT e.event_id,
       e.event_name
FROM events e
LEFT JOIN tickets t
    ON e.event_id = t.event_id
WHERE t.ticket_id IS NULL;
```

### Find Employees Without a (Valid) Manager

```sql
SELECT e.name
FROM employees e
LEFT JOIN employees m
    ON e.manager_id = m.employee_id
WHERE m.employee_id IS NULL;
```

This is also a **self join** — the `employees` table is joined with itself (next chapter). It returns employees with a `NULL` `manager_id` **and** those pointing to a manager who doesn't exist.

## Performance Tips

### 1. Index the JOIN Columns

`users.user_id` (primary key) is already indexed; `orders.user_id` (foreign key) should be indexed when it's frequently used for joins.

### 2. Understand WHERE Filters on the Right Table

`WHERE o.amount > 100` after a `LEFT JOIN` removes rows where `o.amount` is `NULL`, making the query behave like an `INNER JOIN` for that condition. If you need to preserve every left row but only match qualifying right rows, use `LEFT JOIN orders o ON u.user_id = o.user_id AND o.amount > 100`.

### 3. Select Only Required Columns

Prefer `SELECT u.name, o.amount` over `SELECT *` — less data transferred, less memory, cleaner results and easier maintenance.

## Common Mistakes

- ❌ **Forgetting that LEFT JOIN keeps unmatched rows** — they don't disappear; their right-side columns become `NULL`.
- ❌ **Using `= NULL`** — write `WHERE order_id IS NULL` (or `IS NOT NULL`). Never compare `NULL` with `=` or `!=`.
- ❌ **Filtering the right table in `WHERE` without understanding the effect** — it removes unmatched users; move the filter to `ON` to keep them.
- ❌ **Assuming LEFT JOIN can't produce duplicates** — if Rahul has three orders, Rahul appears three times, because one left row matched three right rows.

## Interview Questions

### Q1. What is a LEFT JOIN?

A join that returns every row from the left table plus matching rows from the right table, with `NULL`s where there's no match.

### Q2. What is the difference between INNER JOIN and LEFT JOIN?

`INNER JOIN` returns only matched rows; `LEFT JOIN` also keeps unmatched left rows.

### Q3. When should you use LEFT JOIN?

When the related data is optional, or when you need to find rows that have no related data.

### Q4. How do you find records that don't exist in another table?

`LEFT JOIN` the other table and keep rows where its key `IS NULL` (an anti-join), or use `NOT EXISTS`.

### Q5. Why does LEFT JOIN return NULL?

Because there is no matching row in the right table, so its columns have no values.

### Q6. Why can a WHERE clause remove unmatched rows from a LEFT JOIN?

Conditions on right-table columns evaluate to UNKNOWN for `NULL` values, so `WHERE` filters those rows out.

### Q7. Can LEFT JOIN return duplicate rows?

Yes — a left row appears once for every matching right row.

### Q8. What is the difference between filtering in ON and WHERE?

A filter in `ON` restricts which right rows can match while keeping all left rows; a filter in `WHERE` removes rows from the final result.

### Q9. What is an anti-join?

A query returning rows from one table that have **no** match in another — e.g. `LEFT JOIN ... WHERE right.id IS NULL` or `NOT EXISTS`.

### Q10. How do you find users who have never placed an order?

`SELECT u.* FROM users u LEFT JOIN orders o ON u.user_id = o.user_id WHERE o.order_id IS NULL;`

### Q11. Why should JOIN columns be indexed?

So matching rows can be found with index lookups instead of scanning the right table for every left row.

### Q12. Can you use multiple LEFT JOINs in one query?

Yes — each one preserves the rows built up so far.

## Hands-On Assignment

Create `users` (user_id, name) and `orders` (order_id, user_id, amount). Insert 5 users, of which only 3 have orders. Then:

1. Display all users with their orders.
2. Display users without orders.
3. Display users whose orders exceed 500, while still showing users with no qualifying orders.
4. Count how many users have no orders.
5. Display each user with their total order amount.

### Challenge Problems

1. Find products that have never been ordered.
2. Find customers who never made a payment.
3. Find events with no ticket bookings.
4. Return all users and their latest order.
5. Explain why moving a filter from `WHERE` to `ON` changes the result of a `LEFT JOIN`.
6. Find employees who don't have a valid manager.
7. Find all customers and show only their successful payments, while preserving customers without successful payments.

## Cheat Sheet

```sql
-- LEFT JOIN
SELECT columns
FROM table1 t1
LEFT JOIN table2 t2
    ON t1.id = t2.id;

-- Anti-join: rows in table1 with no match in table2
SELECT t1.*
FROM table1 t1
LEFT JOIN table2 t2
    ON t1.id = t2.id
WHERE t2.id IS NULL;
```

| Filter placement | Effect |
| --- | --- |
| `WHERE o.amount > 500` | Unmatched users are removed |
| `ON ... AND o.amount > 500` | All users are preserved |

**Best practices:** use `LEFT JOIN` for optional relationships; use `IS NULL` to find missing records; understand `ON` vs `WHERE`; index JOIN columns; use aliases; select only required columns; remember one-to-many joins produce multiple rows.

### Remember This Forever

| Join | Meaning |
| --- | --- |
| `INNER JOIN` | Give me only matching data |
| `LEFT JOIN` | Everything from the left table + matching right data + `NULL` when no match |
| `LEFT JOIN` + `WHERE right.id IS NULL` | Find missing relationships |
