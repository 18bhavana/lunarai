---
title: Database Fundamentals and MySQL Architecture
subtitle: Why databases exist, DBMS vs RDBMS, how MySQL executes a query, InnoDB vs MyISAM, data types, constraints, keys and AUTO_INCREMENT.
order: 1
---

## Introduction

We'll learn MySQL from first principles. By the end of this chapter you should understand **why MySQL is designed the way it is**, not just how to write SQL.

Topics: what a database is, DBMS vs RDBMS, why MySQL, MySQL architecture, storage engines (InnoDB vs MyISAM), database objects, data types, constraints, keys, `AUTO_INCREMENT`, and a real production scenario.

## What is a Database?

Imagine you're building an **event ticket booking system** with users (Raj, Rahul, Ankit), tickets (101, 102, 103) and payments (500, 600, 700). Where do you store them — Excel? A text file? JSON? A Java `ArrayList`?

None of these are suitable, because:

- Data gets lost on restart.
- Multiple users can't safely update it.
- Searching is slow.
- Relationships are difficult to manage.

**A database stores data in a structured, persistent and efficient way.**

### Real Example

Think about an ATM. When you withdraw 500, your balance goes from 10,000 to 9,500 — and millions of such updates happen every day. A database guarantees **no data loss**, **correct balances**, **safe simultaneous access** by many users, and **fast retrieval**.

## What is a DBMS?

**DBMS = Database Management System** — software that helps us store, retrieve, update, delete and secure data. Examples: MySQL, PostgreSQL, Oracle Database, SQL Server.

### The Problem with a Simple DBMS

Suppose we store users and orders like this:

| ID | Name |
| --- | --- |
| 1 | Raj |

| OrderId | User |
| --- | --- |
| 101 | Raj |

Tomorrow Raj changes his name to **Rajesh**. The users table now says `Rajesh`, but the orders table still says `Raj` — **the data is inconsistent**.

## What is an RDBMS?

**RDBMS = Relational Database Management System.** It stores data in **tables** and connects them using **relationships**.

| user_id | name |
| --- | --- |
| 1 | Raj |

| order_id | user_id |
| --- | --- |
| 100 | 1 |

Instead of storing the name in `orders`, we store the **`user_id`**:

```flow-h
users.user_id
: referenced by
orders.user_id
```

**Advantages:** no duplication, consistency, better performance and easy joins.

> [!QUESTION] Why is an RDBMS better than a DBMS?
> Relationships, referential integrity, normalization, reduced redundancy, SQL support and ACID transactions.

## Why MySQL?

- Open source
- Fast and reliable
- Huge community
- Easy to learn
- Excellent Spring Boot support
- Used by startups and enterprises

Companies using MySQL include Meta (for many internal workloads), Netflix (in parts of its infrastructure), Uber (alongside other databases), Airbnb and Shopify.

> [!NOTE]
> Large companies rarely use a single database technology — they combine MySQL with other databases depending on the workload.

## MySQL Architecture

One of the most commonly misunderstood topics.

```flow
Client (Spring Boot)
JDBC driver
MySQL server — SQL parser
Optimizer
Executor
Storage engine (InnoDB)
Disk files
```

1. **Spring Boot sends** `SELECT * FROM users;`
2. **The parser checks** — is the syntax valid? Does the table exist? Any mistakes?
3. **The optimizer decides** — scan the whole table, or use an index? It chooses the **least-cost execution plan**.
4. **The executor** runs the query.
5. **The storage engine** (usually InnoDB) fetches the rows.
6. **The result** returns to Java.

```flow-h
MySQL rows
JDBC
Hibernate
Spring Boot
```

> [!QUESTION] Does MySQL execute SQL directly?
> No. The pipeline is **SQL → parser → optimizer → executor → storage engine → disk**. Understanding this flow explains why indexes, statistics and query structure matter.

## Storage Engines

A **storage engine** decides how data is stored and retrieved — think of it as the *implementation* behind your tables.

| InnoDB (default) | MyISAM |
| --- | --- |
| ✅ Transactions | ❌ No transactions |
| ✅ Row-level locking | ❌ Table-level locking |
| ✅ Foreign keys | ❌ No foreign keys |
| ✅ Crash recovery | ✅ Fast reads |
| ✅ MVCC for concurrent reads and writes | Mostly found in legacy systems |
| Best for almost every modern application | |

> [!QUESTION] Which storage engine should Spring Boot applications use?
> **InnoDB** — because it supports transactions, foreign keys, better concurrency and crash recovery.

## Database Objects

```tree We'll work with these throughout the course
Database
  Tables
  Views
  Indexes
  Stored procedures
  Functions
  Triggers
```

For now, focus on **databases and tables**.

## Data Types

Choosing the right data type matters for **performance and correctness**.

| Category | Examples | Use case |
| --- | --- | --- |
| Integer | `TINYINT`, `INT`, `BIGINT` | IDs, counts |
| Decimal | `DECIMAL(10,2)` | Money |
| Floating point | `FLOAT`, `DOUBLE` | Scientific values (avoid for currency) |
| String | `CHAR`, `VARCHAR` | Names, emails |
| Text | `TEXT` | Descriptions |
| Date & time | `DATE`, `TIME`, `DATETIME`, `TIMESTAMP` | Events, audit fields |
| Boolean | `BOOLEAN` (alias of `TINYINT(1)`) | Flags like `is_active` |
| JSON | `JSON` | Flexible structured data |

> [!TIP]
> Use **`DECIMAL`** for currency values to avoid floating-point precision issues.

## Constraints

Constraints **enforce data quality** — e.g. a user's ID cannot be `NULL` and must be unique. Common constraints:

- `PRIMARY KEY`
- `FOREIGN KEY`
- `UNIQUE`
- `NOT NULL`
- `CHECK` (enforced since MySQL 8.0.16; earlier versions parsed but ignored it)
- `DEFAULT`

Each is covered in detail in later chapters.

## Keys

| Key | Purpose |
| --- | --- |
| **Primary key** | Identifies each row uniquely; cannot be `NULL`; one per table |
| **Foreign key** | Links one table to another; enforces referential integrity |
| **Unique key** | Prevents duplicate values; in MySQL a unique column may contain multiple `NULL`s |

## AUTO_INCREMENT

Instead of manually generating IDs (1, 2, 3, 4…), MySQL automatically creates the next value:

```sql
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(100)
);
```

## Real Production Scenario

Imagine a Spring Boot API: `POST /users`.

```flow
Controller
Service
Repository
JPA
JDBC
MySQL
InnoDB
Disk
```

When you call `userRepository.save(user)`, Hibernate generates SQL, JDBC sends it to MySQL, MySQL parses and optimizes it, the storage engine writes it to disk, and the generated ID is returned to your application. Understanding this pipeline makes debugging much easier later.

## Interview Questions

### Q1. What is the difference between DBMS and RDBMS?

A DBMS stores and manages data; an RDBMS stores data in related tables linked by keys, adding referential integrity, normalization and SQL.

### Q2. Why is MySQL considered an RDBMS?

Because it stores data in tables with rows and columns, relates tables through primary and foreign keys, and is queried with SQL.

### Q3. Explain the lifecycle of a SQL query inside MySQL.

Client → parser (syntax and object checks) → optimizer (chooses the cheapest plan) → executor → storage engine (InnoDB) → disk → result back to the client.

### Q4. What is a storage engine?

The component that implements how table data is stored, indexed, locked and retrieved (e.g. InnoDB, MyISAM).

### Q5. Why is InnoDB the default storage engine?

It supports transactions, row-level locking, foreign keys, crash recovery and MVCC.

### Q6. What is the difference between CHAR and VARCHAR?

`CHAR(n)` is fixed-length (padded to `n`); `VARCHAR(n)` is variable-length and stores only the characters used (plus a length prefix).

### Q7. When would you use DECIMAL instead of FLOAT?

For exact values such as money. `FLOAT`/`DOUBLE` are approximate and introduce rounding errors.

### Q8. Why do we use primary keys?

To uniquely identify each row, and to give other tables something stable to reference.

### Q9. What is the purpose of foreign keys?

To link tables and enforce referential integrity — a child row can't point to a parent that doesn't exist.

### Q10. What does AUTO_INCREMENT do?

It automatically generates the next sequential value for a column, typically the primary key.

## Practice Assignment

Create an **event ticket booking** schema with these tables: `users`, `events`, `venues` and `tickets`. For each table:

- Add a primary key.
- Use appropriate data types.
- Include `created_at` and `updated_at` columns.
- Add `NOT NULL` where appropriate.
- Use `AUTO_INCREMENT` for IDs.

Don't worry about foreign keys yet — they're covered later.

### Homework

1. Install MySQL (if not already installed) and connect using MySQL Workbench or another SQL client.
2. Create the `event_booking` database.
3. Create the four tables listed above.
4. Insert at least 10 rows into each table.
5. Draw the relationships you think should exist between the tables.

## Cheat Sheet

| Topic | Key takeaway |
| --- | --- |
| Database | Stores data persistently |
| DBMS | Software to manage databases |
| RDBMS | Stores related data in tables |
| MySQL | Popular open-source RDBMS |
| InnoDB | Default storage engine with transactions |
| Primary key | Unique identifier for a row |
| Foreign key | Connects related tables |
| `AUTO_INCREMENT` | Generates sequential IDs |
| `DECIMAL` | Use for money |
| `VARCHAR` | Variable-length strings |
