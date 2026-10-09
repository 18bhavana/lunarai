---
title: INNER JOIN
subtitle: The most important SQL topic for backend developers — why joins exist, PK/FK relationships, syntax and aliases, how MySQL executes joins, multi-table joins, JOIN vs multiple queries and JPA.
order: 8
---

## Introduction

This chapter starts the **joins** phase. Ranking SQL topics for a 5+ years Java backend interview:

1. **Joins**
2. Window functions
3. Indexes
4. Subqueries
5. Transactions

Almost every Spring Boot application uses joins, either directly or through JPA/Hibernate.

## Why Do We Need Joins?

Imagine an event booking system.

| user_id | name |
| --- | --- |
| 1 | Rahul |
| 2 | Amit |
| 3 | Neha |

| order_id | user_id | amount |
| --- | --- | --- |
| 101 | 1 | 500 |
| 102 | 2 | 700 |
| 103 | 1 | 1000 |

**Who placed order 101?** The orders table has only `user_id = 1`; the users table has `1 → Rahul`. We need information from **both** tables — that's why we use a **JOIN**.

### Think Like Java

Without a join, you make two database calls:

```java
User user = userRepository.findById(1);
Order order = orderRepository.findById(101);
```

With a join, **one** SQL query returns *Rahul, order 101, amount 500* — one database trip. Much faster.

## What is INNER JOIN?

> [!IMPORTANT]
> `INNER JOIN` returns **only the rows that have matching values in both tables** — think of it as an intersection.

With users Rahul (1), Amit (2), Neha (3) and orders 101 → user 1, 102 → user 2:

| Name | Order |
| --- | --- |
| Rahul | 101 |
| Amit | 102 |

**Neha isn't returned** because she has no order.

```buckets Only the common rows appear
Users: Rahul, Amit, Neha
Orders: Rahul, Amit
Result: Rahul, Amit
```

## Primary Key and Foreign Key

`users.user_id` is the **primary key**; `orders.user_id` is a **foreign key** that references it.

```flow-h The foreign key references the primary key
orders.user_id (FK)
: references
users.user_id (PK)
```

## INNER JOIN Syntax

```sql
SELECT columns
FROM table1
INNER JOIN table2
    ON table1.column = table2.column;
```

### Real Example

```sql
SELECT u.user_id,
       u.name,
       o.order_id,
       o.amount
FROM users u
INNER JOIN orders o
    ON u.user_id = o.user_id;
```

| User | Order | Amount |
| --- | --- | --- |
| Rahul | 101 | 500 |
| Amit | 102 | 700 |
| Rahul | 103 | 1000 |

(`JOIN` on its own means `INNER JOIN`.)

### Why Use Aliases?

Instead of `users.user_id`, write `u.user_id` — cleaner and easier to read. Almost every professional SQL query uses aliases.

## How MySQL Executes an INNER JOIN

```sql
SELECT *
FROM users u
INNER JOIN orders o
    ON u.user_id = o.user_id;
```

Conceptually:

```flow
Read a row from users
Find orders rows to compare
? u.user_id = o.user_id? | Yes: Return the combined row | No: Skip
```

MySQL doesn't simply "merge" tables — it uses **join algorithms** (nested-loop joins, hash joins in MySQL 8.0.18+) and **indexes** when available. JOIN optimization has its own chapter.

## Multiple INNER JOINs

Real applications rarely join only two tables:

```sql
SELECT u.name,
       o.order_id,
       p.payment_status
FROM users u
INNER JOIN orders o
    ON u.user_id = o.user_id
INNER JOIN payments p
    ON o.order_id = p.order_id;
```

| Name | Order | Payment |
| --- | --- | --- |
| Rahul | 101 | Paid |

```flow-h
users
orders
payments
Result
```

## JOIN vs Multiple Queries

❌ **Bad approach:** find user → find orders → find payment → find ticket → find venue — possibly many database calls.

✅ **Better approach:** one JOIN query. Benefits: **one database call**, less network latency, and less application-level overhead. JOINs are often preferable to repeatedly querying related data separately (the "N+1" pattern).

## INNER JOIN with WHERE

Orders placed by users from the IT department:

```sql
SELECT u.name,
       o.order_id
FROM users u
INNER JOIN orders o
    ON u.user_id = o.user_id
WHERE u.department = 'IT';
```

### Logical Query Processing Order

```flow-h Remember this order — very important for interviews
FROM
JOIN / ON
WHERE
GROUP BY
HAVING
SELECT
ORDER BY
LIMIT
```

## Common Mistakes

### Missing ON Clause

```sql
SELECT *
FROM users
INNER JOIN orders;      -- ❌
```

This doesn't say how the tables are related. In MySQL it silently becomes a **cross join** — every user paired with every order (a Cartesian product). Always specify the join condition:

```sql
SELECT *
FROM users u
INNER JOIN orders o
    ON u.user_id = o.user_id;
```

### Joining the Wrong Columns

```sql
ON users.user_id = orders.order_id    -- ❌
ON users.user_id = orders.user_id     -- ✅
```

Always join **logically related** columns.

### Ambiguous Columns

If both tables contain `id`, `SELECT id` fails with *Column 'id' in field list is ambiguous*. Qualify it: `SELECT users.id` or `SELECT u.id`.

## Spring Boot / JPA Example

```java
@Entity
class User {

    @OneToMany(mappedBy = "user")
    private List<Order> orders;
}
```

When Hibernate needs users with their orders, it may generate SQL involving a join such as:

```sql
SELECT *
FROM users u
INNER JOIN orders o
    ON u.user_id = o.user_id;
```

JPQL:

```java
SELECT u
FROM User u
JOIN u.orders o
```

In JPQL, **`JOIN` is an inner join by default**. Understanding SQL joins helps you understand Hibernate-generated SQL.

> [!NOTE]
> A `@OneToMany` is **lazy** by default: simply loading a `User` doesn't join `orders` — the orders are fetched with a separate query on first access, unless you use `JOIN FETCH` or an entity graph.

## Performance Tips

### Index the JOIN Columns

`users.user_id` is the primary key, so it's already indexed. `orders.user_id` is a foreign key and **should be indexed** for frequent joins (InnoDB creates an index for a foreign key automatically if none exists). Indexes can significantly improve join performance.

### Join on Keys

Prefer primary key ↔ foreign key joins. Avoid joining on columns such as name, address or city unless the business requirement needs it — they may not be unique, may change over time, are larger than numeric IDs, and perform worse.

### Select Only Needed Columns

```sql
SELECT *                     -- ❌

SELECT u.name, o.amount      -- ✅
```

Less data transferred, less memory, a cleaner result set and potentially better performance.

## Interview Questions

### Q1. What is an INNER JOIN?

A join that returns only the rows with matching values in both tables, based on the `ON` condition.

### Q2. What is the difference between INNER JOIN and LEFT JOIN?

`INNER JOIN` drops rows without a match; `LEFT JOIN` keeps every row from the left table and fills the right side with `NULL`s when there's no match.

### Q3. Why do we use table aliases?

To shorten queries, make them more readable, disambiguate columns and enable self joins.

### Q4. Why should JOIN columns be indexed?

So MySQL can look up matching rows directly instead of scanning the whole table for each row.

### Q5. What happens if the ON clause is omitted?

In MySQL the join becomes a cross join (Cartesian product) — every row of one table combined with every row of the other.

### Q6. Can you join more than two tables?

Yes — chain as many `JOIN ... ON ...` clauses as needed.

### Q7. Explain the logical execution order of a JOIN query.

`FROM` → `JOIN`/`ON` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`.

### Q8. Why can one JOIN query be better than multiple database queries?

It needs one round trip instead of many, lets the database optimize the whole operation, and avoids N+1 query patterns.

## Hands-On Assignment

Create the tables `users` (user_id, name), `orders` (order_id, user_id, amount) and `payments` (payment_id, order_id, payment_status), insert sample data, then write queries to:

1. Display user name with order ID.
2. Display user name with order amount.
3. Display order amount with payment status.
4. Display user name, order ID and payment status.
5. Display only orders where amount > 500.
6. Display orders for Rahul only.
7. Display all paid orders.

### Challenge Problems

1. Join three tables.
2. Join four tables.
3. Display the highest-value order with the customer's name.
4. Display orders placed after a specific date.
5. Write a Spring Data JPA repository query that returns users with their orders.
6. Explain why indexing `user_id` improves JOIN performance.

## Real Interview Scenario

> [!QUESTION] Display the customer name, order ID, payment status, event name and venue name.
> You need to join **users → orders → payments → tickets → events → venues**. By the end of the joins chapters, you'll write these multi-table queries confidently.

## Cheat Sheet

```sql
SELECT columns
FROM table1 t1
INNER JOIN table2 t2
    ON t1.id = t2.id;
```

**Best practices:**

- ✅ Join on primary key ↔ foreign key relationships
- ✅ Use table aliases (`u`, `o`, `p`)
- ✅ Index frequently used JOIN columns
- ✅ Select only required columns
- ✅ Always use the correct JOIN condition
