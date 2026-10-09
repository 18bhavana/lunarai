---
title: Database Normalization
subtitle: Redundancy and update/insert/delete anomalies, 1NF, 2NF, 3NF and BCNF with worked examples, normalization vs denormalization, and real-world schema design.
order: 26
---

## Introduction

Normalization is one of the most important database-design concepts for enterprise applications — and one of the most frequently asked SQL and system-design interview topics for Java backend developers.

This chapter covers why normalization is needed, data redundancy, update/insert/delete anomalies, **First (1NF), Second (2NF), Third (3NF) and Boyce-Codd (BCNF) Normal Forms**, real-world schema design and enterprise best practices.

## Why Do We Need Normalization?

Imagine storing employee information like this:

| Emp ID | Name | Department | Manager | Manager phone |
| --- | --- | --- | --- | --- |
| 101 | John | IT | David | 9991112222 |
| 102 | Alex | IT | David | 9991112222 |
| 103 | Lisa | HR | Mary | 8885554444 |
| 104 | Tom | IT | David | 9991112222 |

The same manager details are repeated, more storage is needed, the table is hard to maintain, and inconsistent data becomes likely. Normalization solves these issues.

## Problems Without Normalization

| Problem | What happens |
| --- | --- |
| **Data redundancy** | Repeated information — David / 9991112222 stored hundreds of times |
| **Update anomaly** | The manager's phone changes; rows 1, 2 and 4 must all be updated. Miss one and the database is inconsistent |
| **Insert anomaly** | A new department has no employees yet — its information can't be stored because employee details are required |
| **Delete anomaly** | Deleting the last HR employee also loses the HR department's information |

## What Is Normalization?

Normalization is the process of **organizing data** to eliminate redundancy, improve consistency, maintain integrity, simplify updates and reduce anomalies — by splitting tables so that each fact is stored in exactly one place.

The forms build on each other:

```flow-h
1NF — atomic values
2NF — no partial dependency
3NF — no transitive dependency
BCNF — every determinant is a candidate key
```

> [!NOTE]
> Normalization is defined in terms of **functional dependencies**: `A → B` ("A determines B") means each value of A is associated with exactly one value of B. For example, `employee_id → employee_name`.

## First Normal Form (1NF)

**Rule:** every column contains **atomic (single) values** — no lists or repeating groups.

Not in 1NF — one column holds several values:

| Student | Subjects |
| --- | --- |
| John | Java, SQL, Spring |

Converted to 1NF — each cell holds one value:

| Student | Subject |
| --- | --- |
| John | Java |
| John | SQL |
| John | Spring |

Another example — bad:

| Customer | Phone numbers |
| --- | --- |
| John | 9999999999, 8888888888 |

Good:

| Customer | Phone number |
| --- | --- |
| John | 9999999999 |
| John | 8888888888 |

In a real schema this becomes a separate `customer_phone (customer_id, phone_number)` table, keyed on both columns. Adding columns `phone1`, `phone2`, `phone3` is also a **repeating group** and doesn't satisfy the spirit of 1NF.

## Second Normal Form (2NF)

**Rules:**

- The table is already in 1NF.
- Every non-key column depends on the **entire** composite key, not just part of it (no **partial dependency**).

2NF mainly matters when the table has a **composite primary key**. A table whose key is a single column is automatically in 2NF once it's in 1NF.

### Example: an Enrollment Table

| Student ID | Course ID | Student name | Course name |
| --- | --- | --- | --- |
| 101 | 201 | John | Java |
| 101 | 202 | John | SQL |
| 102 | 201 | Alex | Java |

Primary key: **(student ID, course ID)**. The problem:

- Student name depends only on student ID.
- Course name depends only on course ID.

```flow-h
Student ID
: determines
Student name
```

Partial dependencies exist, so student and course names repeat for every enrollment.

### Converted to 2NF

**student**

| Student ID | Student name |
| --- | --- |
| 101 | John |
| 102 | Alex |

**course**

| Course ID | Course name |
| --- | --- |
| 201 | Java |
| 202 | SQL |

**enrollment**

| Student ID | Course ID |
| --- | --- |
| 101 | 201 |
| 101 | 202 |
| 102 | 201 |

Every non-key column now depends on the entire key of its table.

## Third Normal Form (3NF)

**Rules:**

- The table is already in 2NF.
- There is **no transitive dependency** — a non-key column must not depend on another non-key column.

### Example

| Employee ID | Department | Manager |
| --- | --- | --- |
| 101 | IT | David |
| 102 | IT | David |
| 103 | HR | Mary |

```flow-h
Employee ID
Department
Manager
```

Manager depends on **department**, not directly on the employee — `employee_id → department → manager` is a transitive dependency.

### Converted to 3NF

**employee**

| Employee ID | Department |
| --- | --- |
| 101 | IT |
| 102 | IT |
| 103 | HR |

**department**

| Department | Manager |
| --- | --- |
| IT | David |
| HR | Mary |

No transitive dependency remains. (In practice the department would have a surrogate `department_id` that `employee` references as a foreign key.)

> [!TIP]
> The classic summary of 3NF: every non-key column depends on **the key, the whole key, and nothing but the key**.

## Boyce-Codd Normal Form (BCNF)

BCNF is a **stricter version of 3NF**.

**Rule:** for every non-trivial functional dependency `X → Y`, **X must be a candidate key** (more precisely, a super key) — every determinant must be a key.

### Example: a Teaching Table

| Teacher | Subject | Classroom |
| --- | --- | --- |
| John | Java | A101 |
| John | Spring | A101 |
| David | SQL | B201 |

Business rules: one teacher always teaches in one classroom; a classroom can host many subjects. So `teacher → classroom` — but **teacher is not a candidate key** (the key is teacher + subject). This violates BCNF.

### Converted to BCNF

**teacher**

| Teacher | Classroom |
| --- | --- |
| John | A101 |
| David | B201 |

**teaching**

| Teacher | Subject |
| --- | --- |
| John | Java |
| John | Spring |
| David | SQL |

> [!NOTE]
> Strictly speaking, the example above already breaks **2NF**: classroom depends on *part* of the composite key (teacher). The case BCNF uniquely catches is one where the table is in 3NF but a non-key column determines **part of a key**.
>
> Classic example: `(student, subject, teacher)` where each teacher teaches exactly one subject (`teacher → subject`) and each student has one teacher per subject (`student, subject → teacher`). The candidate keys are (student, subject) and (student, teacher). Every column is part of some key, so 3NF is satisfied — but `teacher → subject` has a determinant that isn't a key, so BCNF is violated. The fix is to split into `teacher_subject (teacher, subject)` and `student_teacher (student, teacher)`.

## Normalization Summary

| Normal form | Removes |
| --- | --- |
| 1NF | Repeating groups and multi-valued attributes |
| 2NF | Partial dependency |
| 3NF | Transitive dependency |
| BCNF | Remaining anomalies where a non-key determinant exists |

## Real-World Enterprise Example

**Before normalization** — one `orders` table: order ID, customer, customer city, product, price. Customer city and product price repeat on every row, and it's hard to maintain.

**After normalization:**

```refs
orders.customer_id -> customer | customer_id, name, city
order_items.order_id -> orders | order_id, customer_id
order_items.product_id -> product | product_id, name, price
```

| Table | Columns |
| --- | --- |
| `customer` | customer_id, name, city |
| `product` | product_id, name, price |
| `orders` | order_id, customer_id |
| `order_items` | order_id, product_id, quantity |

Much cleaner.

> [!TIP]
> Order items usually store the **price at the time of purchase** too (`unit_price`). That isn't a normalization violation — it's a different fact (the agreed sale price), and it must not change when the product's current price changes.

## Normalization vs Denormalization

| Normalization | Denormalization |
| --- | --- |
| Less redundancy | Some redundancy |
| More JOINs | Fewer JOINs |
| Better consistency | Better read performance |
| Ideal for OLTP | Often used in OLAP / reporting |

### When NOT to Normalize?

Sometimes performance matters more — reporting databases, data warehouses, analytics dashboards and read-heavy applications. There, **controlled denormalization** (summary tables, duplicated columns, star schemas) may improve performance, at the cost of keeping the copies in sync.

## Interview Questions

### Q1. What is normalization?

Organizing data to reduce redundancy and improve integrity, by decomposing tables so every fact is stored once.

### Q2. Difference between 2NF and 3NF?

**2NF** removes **partial** dependencies (a non-key column depending on part of a composite key). **3NF** removes **transitive** dependencies (a non-key column depending on another non-key column).

### Q3. What is BCNF?

A stronger version of 3NF where every determinant must be a candidate key.

### Q4. What are anomalies?

Insert, update and delete anomalies — problems that arise when the same fact is stored in many places or when unrelated facts are stored together.

### Q5. Why is normalization important?

It reduces duplicate data, improves consistency, simplifies maintenance, prevents anomalies and makes the design scalable.

## Common Mistakes

- ❌ **Over-normalization** — too many tables increase JOIN complexity, can reduce query performance and make reporting harder. Balance normalization with performance needs.
- ❌ **Ignoring business rules** — normalization should support the actual business domain, not just theoretical rules; functional dependencies come from the business.
- ❌ **Assuming every database must reach BCNF** — most enterprise OLTP systems are designed in 3NF; BCNF is applied when its extra constraints bring clear benefits.

## Mini Project

Normalize this table up to 3NF:

| Order ID | Customer name | Customer city | Product | Product price |
| --- | --- | --- | --- | --- |
| 1 | John | Bangalore | Laptop | 50000 |
| 2 | John | Bangalore | Mouse | 1000 |
| 3 | David | Mysore | Keyboard | 2500 |

> [!QUESTION] Suggested solution
> Customer city depends on the customer and product price depends on the product — both are transitive dependencies through the order. Split into `customer (customer_id, name, city)`, `product (product_id, name, price)`, `orders (order_id, customer_id)` and `order_item (order_id, product_id, quantity, unit_price)`, with foreign keys from `orders` to `customer` and from `order_item` to `orders` and `product`.

## Practice Problems

**Easy**

1. Identify repeating groups.
2. Convert a table to 1NF.
3. Identify partial dependencies.
4. Convert a table to 2NF.
5. Identify transitive dependencies.

**Medium**

1. Normalize an employee–department table.
2. Normalize a student–course table.
3. Design a library-management schema.
4. Design a hospital-management schema.
5. Normalize an e-commerce order table.

**Interview level**

1. Explain 1NF, 2NF and 3NF with examples.
2. Explain BCNF with a real-world scenario.
3. Compare normalization and denormalization.
4. Explain insert, update and delete anomalies.
5. Design a fully normalized database for an online shopping application.

## Best Practices

- ✅ Aim for 3NF in most OLTP applications.
- ✅ Normalize to eliminate unnecessary redundancy.
- ✅ Denormalize only after identifying genuine performance bottlenecks.
- ✅ Model relationships from business rules rather than convenience.
- ✅ Keep lookup tables (departments, categories, countries…) separate from transactional tables.

Normalization is fundamental in banking, ERP, healthcare, HRMS, e-commerce, insurance and inventory systems and Spring Boot + MySQL enterprise applications — most production transactional databases are designed around 3NF principles.

## Key Takeaways

- ✅ 1NF ensures atomic values.
- ✅ 2NF removes partial dependencies.
- ✅ 3NF removes transitive dependencies.
- ✅ BCNF is a stricter form of 3NF for specific dependency scenarios.
- ✅ Normalization improves consistency, reduces redundancy and prevents anomalies.
- ✅ Most enterprise OLTP databases target 3NF, while reporting systems may intentionally denormalize.
