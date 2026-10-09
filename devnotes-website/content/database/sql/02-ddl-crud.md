---
title: DDL and CRUD Operations
subtitle: SQL command categories, CREATE and ALTER TABLE, DELETE vs TRUNCATE vs DROP, INSERT, UPDATE, DELETE, SELECT, pagination and the SQL that Spring Data JPA generates.
order: 2
---

## Introduction

The previous chapter covered how MySQL works internally. Now we'll start **writing SQL like a backend developer**.

> [!IMPORTANT]
> By the end of this chapter you'll understand every SQL statement that Spring Data JPA generates behind the scenes.

## SQL Command Categories

Every SQL command belongs to one of these categories:

| Category | Meaning | Commands |
| --- | --- | --- |
| **DDL** | Data Definition Language | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` |
| **DML** | Data Manipulation Language | `INSERT`, `UPDATE`, `DELETE` |
| **DQL** | Data Query Language | `SELECT` |
| **TCL** | Transaction Control Language | `COMMIT`, `ROLLBACK`, `SAVEPOINT` |
| **DCL** | Data Control Language | `GRANT`, `REVOKE` |

Think of it like Java:

| SQL | Java analogy |
| --- | --- |
| DDL | Designing classes |
| DML | Creating and changing objects |
| DQL | Reading objects |
| TCL | Undo / commit changes |
| DCL | Access control |

## DDL (Data Definition Language)

DDL changes the **structure** of the database:

```sql
CREATE DATABASE event_booking;
CREATE TABLE users (...);
ALTER TABLE users ADD COLUMN age INT;
DROP TABLE users;
```

These modify the **schema**, not the data itself.

## CREATE TABLE

A production-style `users` table:

```sql
CREATE TABLE users (
    user_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name  VARCHAR(100) NOT NULL,
    email      VARCHAR(150) UNIQUE NOT NULL,
    phone      VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Why These Data Types?

| Column type | Why? |
| --- | --- |
| `BIGINT` | Supports millions/billions of records |
| `VARCHAR` | Variable-length strings save space |
| `TIMESTAMP` | Automatically stores the time (`DEFAULT` / `ON UPDATE CURRENT_TIMESTAMP`) |
| `AUTO_INCREMENT` | Generates IDs automatically |

> [!NOTE]
> `TIMESTAMP` is stored in UTC and limited to the year **2038**; use `DATETIME` for dates beyond that or when you don't want time-zone conversion.

### Behind the Scenes

When MySQL receives `CREATE TABLE users (...)`, it stores **metadata** — table name, columns, data types, constraints and indexes — in its data dictionary, and creates the table's storage (for InnoDB, a `.ibd` tablespace file by default).

## ALTER TABLE

Real projects evolve constantly. Suppose your manager says *"We also need date of birth."* No need to recreate the table:

```sql
-- Add a column
ALTER TABLE users
    ADD COLUMN date_of_birth DATE;

-- Rename a column
ALTER TABLE users
    RENAME COLUMN phone TO mobile_number;

-- Modify the data type
ALTER TABLE users
    MODIFY mobile_number VARCHAR(20);

-- Drop a column
ALTER TABLE users
    DROP COLUMN date_of_birth;
```

> [!QUESTION] Does ALTER TABLE lock the table?
> **Sometimes.** Modern MySQL versions support many **online DDL** operations that reduce locking, but some schema changes still require a table rebuild or stronger locks, depending on the operation.

## DELETE vs TRUNCATE vs DROP

One of the most asked interview questions.

### DELETE

```sql
DELETE FROM users;
```

Removes **rows**. ✅ Can use `WHERE`. ✅ Can be rolled back (inside a transaction with InnoDB). The `AUTO_INCREMENT` counter is **not** reset.

### TRUNCATE

```sql
TRUNCATE TABLE users;
```

Deletes **all** rows, very fast, and **resets** the `AUTO_INCREMENT` counter. ❌ Can't filter rows. It behaves like a **DDL** operation — it causes an implicit commit, so it **can't be rolled back**, and it fails on a table referenced by a foreign key.

### DROP

```sql
DROP TABLE users;
```

Deletes the data, the table structure, its indexes and its constraints. **Everything is gone.**

### Comparison

| Feature | DELETE | TRUNCATE | DROP |
| --- | --- | --- | --- |
| Removes data | ✓ | ✓ | ✓ |
| Removes the table | ✗ | ✗ | ✓ |
| `WHERE` allowed | ✓ | ✗ | ✗ |
| Resets `AUTO_INCREMENT` | ✗ | ✓ | N/A |
| Can be rolled back | ✓ (in a transaction) | ✗ | ✗ |
| Table exists afterwards | ✓ | ✓ | ✗ |
| Speed on large tables | Slow (row by row) | Fast | Fast |

## INSERT

```sql
-- Single row
INSERT INTO users (full_name, email)
VALUES ('Rahul', 'rahul@gmail.com');

-- Multiple rows
INSERT INTO users (full_name, email)
VALUES ('Raj',   'raj@gmail.com'),
       ('Ankit', 'ankit@gmail.com'),
       ('Amit',  'amit@gmail.com');
```

> [!TIP]
> Always specify column names instead of relying on column order.

## UPDATE

```sql
UPDATE users
SET full_name = 'Rahul Sharma'
WHERE user_id = 1;
```

```sql
UPDATE users SET full_name = 'ABC';
```

> [!WARNING]
> **Danger:** no `WHERE` clause — **every row** becomes `ABC`. One of the most common production mistakes.

> [!TIP]
> In a SQL client, `SET SQL_SAFE_UPDATES = 1;` makes MySQL reject `UPDATE`/`DELETE` statements that have no key-based `WHERE` or `LIMIT`.

## DELETE

```sql
-- Delete one record
DELETE FROM users
WHERE user_id = 10;

-- Delete inactive users
DELETE FROM users
WHERE status = 'INACTIVE';
```

Never run `DELETE` without confirming the `WHERE` clause, unless you intentionally want to remove all rows.

## SELECT

The most frequently used SQL statement.

```sql
-- All users
SELECT *
FROM users;

-- Selected columns
SELECT user_id, full_name, email
FROM users;

-- Alias
SELECT full_name AS customer_name
FROM users;

-- Distinct values
SELECT DISTINCT city
FROM users;

-- Pagination: skip the first 20 rows, return the next 10
SELECT *
FROM users
LIMIT 10 OFFSET 20;
```

## Real Spring Boot Example

```java
User user = new User();
user.setFullName("Rahul");
user.setEmail("rahul@gmail.com");

userRepository.save(user);
```

Hibernate typically generates SQL similar to:

```sql
INSERT INTO users (full_name, email)
VALUES (?, ?);
```

Fetching a user with `userRepository.findById(1L)` becomes something like:

```sql
SELECT user_id, full_name, email, ...
FROM users
WHERE user_id = ?;
```

Changing a managed entity (`user.setFullName("Rahul Sharma")`) results in an `UPDATE` when the transaction is flushed. Understanding these statements makes it much easier to debug JPA/Hibernate issues.

## Common Mistakes

### Using SELECT * Everywhere

```sql
-- ❌
SELECT *
FROM users;

-- ✅ Only retrieve the columns you need
SELECT user_id, full_name
FROM users;
```

### Forgetting WHERE

```sql
UPDATE users SET salary = 0;
DELETE FROM users;
```

These unintentionally affect **every row**.

### Not Specifying Columns in INSERT

```sql
-- ❌
INSERT INTO users
VALUES (...);

-- ✅ Protects your code if the table structure changes later
INSERT INTO users (full_name, email)
VALUES (...);
```

## Interview Questions

### Q1. What is the difference between DDL and DML?

DDL (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`) changes the database **structure**; DML (`INSERT`, `UPDATE`, `DELETE`) changes the **data**.

### Q2. Explain DELETE, TRUNCATE and DROP.

`DELETE` removes selected rows (can use `WHERE`, can be rolled back). `TRUNCATE` removes all rows quickly, resets `AUTO_INCREMENT` and can't be rolled back. `DROP` removes the whole table, including its structure.

### Q3. Why should we avoid SELECT * in production?

It fetches unnecessary data (more I/O and network traffic), can prevent index-only (covering) reads, and breaks silently when columns are added or reordered.

### Q4. What happens if UPDATE is executed without a WHERE clause?

Every row in the table is updated.

### Q5. Why specify column names in INSERT statements?

So the statement keeps working (and stays correct) if columns are added or reordered later.

### Q6. What is the difference between VARCHAR and CHAR?

`CHAR(n)` is fixed-length and padded; `VARCHAR(n)` is variable-length and stores only what's used.

### Q7. How does Hibernate perform an INSERT?

On `save()`/`persist()` it generates a parameterized `INSERT INTO table (columns) VALUES (?, ?)` and executes it through JDBC when the session is flushed (or immediately, for `IDENTITY` IDs).

### Q8. Why is AUTO_INCREMENT useful?

It generates unique primary keys automatically and safely under concurrent inserts.

## Hands-On Assignment

Using the `event_booking` database (`users`, `events`, `venues`, `tickets`):

1. Insert at least 10 records into each table.
2. Update the name of one event.
3. Delete one ticket.
4. Add a new column `status` to the `users` table.
5. Change the length of the `phone` column.
6. Retrieve all users; only names and emails; the first five users; and distinct cities (if you add a `city` column).

### Mini Challenge

Design a `movies` table with movie ID, movie name, language, duration (minutes), release date, rating and created time. Then insert 5 movies, update one movie's rating, delete one movie, and retrieve all movies released after a chosen date.

## Cheat Sheet

| Command | Purpose |
| --- | --- |
| `CREATE` | Create database objects |
| `ALTER` | Modify table structure |
| `DROP` | Remove a database object permanently |
| `TRUNCATE` | Remove all rows quickly |
| `INSERT` | Add new rows |
| `UPDATE` | Modify existing rows |
| `DELETE` | Remove rows |
| `SELECT` | Read data |
| `LIMIT` | Restrict the number of rows returned |
| `OFFSET` | Skip a specified number of rows |
