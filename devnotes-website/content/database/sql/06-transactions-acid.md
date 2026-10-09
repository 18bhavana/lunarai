---
title: Transactions, ACID and TCL
subtitle: All-or-nothing units of work — ACID properties, COMMIT, ROLLBACK, SAVEPOINT, auto-commit, and how Spring's @Transactional maps onto database transactions.
order: 6
---

## Introduction

One of the most important topics for a Java backend developer. In 5+ years Java/Spring Boot interviews, expect questions like: What is a transaction? What does `@Transactional` do? What happens if an exception occurs? `COMMIT` vs `ROLLBACK`? What is ACID? What is auto-commit?

This chapter lays the foundation; isolation levels, locks, MVCC and deadlocks build on it.

## What is a Transaction?

A **transaction** is a group of SQL statements that execute as **one logical unit of work**. Either **everything succeeds** or **everything fails** — there is no partial success.

### Real Example

Transferring 5,000:

```flow One transaction
Account A: 50,000
: debit 5,000
45,000
---
Account B: 10,000
: credit 5,000
15,000
```

If the debit succeeds but the credit fails, **money is lost**. A transaction prevents this.

## Why Transactions Matter

A user books a ticket in a ticket booking application:

```flow-h
Insert order
Reserve seat
Process payment
Generate ticket
```

If payment fails but the seat remains reserved, the database becomes **inconsistent**. Instead: everything succeeds, **or** everything rolls back.

## ACID Properties

Every interview asks this.

### A — Atomicity

**All or nothing.** If the debit succeeds and the credit fails, **everything rolls back** — nothing is permanently changed.

### C — Consistency

The database must remain **valid** — rules and constraints are preserved.

| | Account A | Account B | Total |
| --- | --- | --- | --- |
| Before | 1000 | 500 | 1500 |
| After transfer | 800 | 700 | 1500 |

### I — Isolation

Two users book the **last ticket** simultaneously. Without isolation, both get "Booked" — **one seat sold twice**. Isolation ensures concurrent transactions don't interfere in undesirable ways.

### D — Durability

Once committed, data survives crashes: `COMMIT` → power failure → restart database → **the data is still there**.

> [!QUESTION] What does ACID stand for?
> **A**tomicity, **C**onsistency, **I**solation, **D**urability.

## COMMIT

```sql
START TRANSACTION;

UPDATE employees
SET salary = salary + 5000
WHERE id = 1;

COMMIT;   -- the change is now permanent
```

```flow-h
START TRANSACTION
UPDATE / INSERT / DELETE
COMMIT
Saved permanently
```

## ROLLBACK

```sql
START TRANSACTION;

UPDATE employees
SET salary = 100000
WHERE id = 1;

-- Oops... wrong employee. Undo everything:
ROLLBACK;
```

The original salary is restored.

```flow-h
START TRANSACTION
UPDATE / INSERT / DELETE
ROLLBACK
Everything undone
```

## SAVEPOINT

Sometimes you don't want to roll back the **entire** transaction:

```sql
START TRANSACTION;

INSERT INTO users (...);
SAVEPOINT user_created;

INSERT INTO orders (...);
-- Oops... wrong order. Roll back only to the savepoint:
ROLLBACK TO user_created;

COMMIT;
```

The user remains; the order is undone.

```flow-h
START
Insert user
SAVEPOINT
Insert order
Rollback to savepoint
Commit
```

## Auto-Commit

By default, MySQL runs in **auto-commit** mode — each statement is committed immediately after it executes:

```sql
UPDATE employees
SET salary = 60000
WHERE id = 2;      -- automatically committed
```

Disable it, and you control when changes are committed:

```sql
SET autocommit = 0;
-- multiple queries...
COMMIT;

SET autocommit = 1;   -- enable again
```

(`START TRANSACTION` also suspends auto-commit for just that one transaction.)

> [!WARNING]
> DDL statements (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`) cause an **implicit commit** in MySQL — they can't be rolled back, and they commit whatever was pending in the current transaction.

## SQL Command Categories

| Category | Purpose | Commands |
| --- | --- | --- |
| DDL | Define database structure | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` |
| DML | Manipulate data | `INSERT`, `UPDATE`, `DELETE` |
| DQL | Retrieve data | `SELECT` |
| TCL | Manage transactions | `COMMIT`, `ROLLBACK`, `SAVEPOINT` |
| DCL | Manage permissions | `GRANT`, `REVOKE` |

## Spring Boot and @Transactional

One of the most common interview topics.

```java
public void transferMoney() {
    debit();
    credit();
}
```

If the debit succeeds and the credit fails, without a transaction **money is lost**. Using Spring:

```java
@Transactional
public void transferMoney() {
    debit();
    credit();
}
```

```flow
? Did both steps succeed? | Yes: COMMIT | No — exception: ROLLBACK — everything undone
```

> [!WARNING]
> By default Spring rolls back only on **unchecked** exceptions (`RuntimeException` and `Error`). A **checked** exception thrown from a `@Transactional` method **commits** unless you declare `@Transactional(rollbackFor = Exception.class)`.

### How It Works

```flow
Controller
Service — @Transactional proxy
START TRANSACTION
Repository → JPA → MySQL (SQL statements)
COMMIT / ROLLBACK
```

Spring starts and ends the database transaction for you.

## Real Production Example — Ticket Booking

```flow
Create order
Reserve seat
? Payment succeeded? | Yes: Generate ticket → COMMIT | No: ROLLBACK — no order, no seat, no ticket
```

This prevents inconsistent data.

## Common Mistakes

### Forgetting COMMIT

`START TRANSACTION` → `UPDATE` → close the session. When a session ends with an open transaction, InnoDB **rolls it back** — your changes are lost.

### Long Operations Inside a Transaction

```flow-h ❌ Bad
START TRANSACTION
Call external API
Wait 30 seconds
COMMIT
```

Long-running transactions hold locks longer than necessary and reduce concurrency.

### Unrelated Work in One Transaction

Keep each transaction focused on **one business operation**. Smaller transactions generally perform better and reduce lock contention.

## Interview Questions

### Q1. What is a transaction?

A group of SQL statements executed as one logical unit of work — all of them succeed or none of them take effect.

### Q2. Explain ACID.

Atomicity (all or nothing), Consistency (constraints stay valid), Isolation (concurrent transactions don't interfere incorrectly) and Durability (committed changes survive crashes).

### Q3. Difference between COMMIT and ROLLBACK?

`COMMIT` makes the transaction's changes permanent; `ROLLBACK` undoes all uncommitted changes.

### Q4. What is SAVEPOINT?

A named checkpoint inside a transaction; `ROLLBACK TO savepoint` undoes only the work done after it.

### Q5. What is auto-commit?

The default mode where each statement is committed automatically as soon as it runs.

### Q6. What does @Transactional do in Spring Boot?

It wraps the method in a database transaction via a proxy: it begins a transaction before the method, commits on success and rolls back on failure.

### Q7. What happens if an exception occurs inside a @Transactional method?

For unchecked exceptions (`RuntimeException`, `Error`) the transaction is rolled back. Checked exceptions commit by default unless `rollbackFor` is configured.

### Q8. Why should transactions be kept short?

Open transactions hold locks and undo history; long ones block other users, cause contention and increase deadlock risk.

### Q9. Difference between DDL, DML, DQL, DCL and TCL?

DDL defines structure, DML changes data, DQL reads data, DCL manages permissions and TCL controls transactions.

### Q10. Why are transactions important in banking applications?

Because a transfer touches several rows (debit and credit); without atomicity a failure midway would create or destroy money.

## Hands-On Assignment

```sql
CREATE TABLE accounts (
    id      INT PRIMARY KEY,
    name    VARCHAR(50),
    balance DECIMAL(10,2)
);
```

| id | name | balance |
| --- | --- | --- |
| 1 | Rahul | 10000 |
| 2 | Amit | 5000 |

1. Start a transaction.
2. Transfer 2,000 from Rahul to Amit.
3. Commit the transaction.
4. Repeat the transfer but roll it back.
5. Create a savepoint after debiting Rahul.
6. Credit Amit.
7. Roll back only to the savepoint.
8. Commit the remaining changes.
9. Observe how the balances change after each step.

### Challenge Problems

1. Simulate an ATM withdrawal using transactions.
2. Simulate an online shopping checkout with order, payment and inventory update.
3. Demonstrate the difference between auto-commit enabled and disabled.
4. Show how a failure after one SQL statement can be safely handled with `ROLLBACK`.
5. Explain how `@Transactional` helps in a Spring Boot service method that updates multiple tables.

## Cheat Sheet

| Command | Purpose |
| --- | --- |
| `START TRANSACTION` | Begin a transaction |
| `COMMIT` | Save changes permanently |
| `ROLLBACK` | Undo uncommitted changes |
| `SAVEPOINT name` | Create a rollback checkpoint |
| `ROLLBACK TO name` | Roll back to a checkpoint |
| `SET autocommit = 0` | Disable auto-commit |
| `SET autocommit = 1` | Enable auto-commit |

| ACID property | Meaning |
| --- | --- |
| Atomicity | All or nothing |
| Consistency | Database remains valid |
| Isolation | Transactions don't interfere incorrectly |
| Durability | Committed changes survive crashes |
