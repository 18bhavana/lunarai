---
title: Keys, Foreign Keys & Constraints
subtitle: Primary, candidate, alternate, super, composite, natural and surrogate keys; UNIQUE, NOT NULL, DEFAULT and CHECK; foreign keys, referential integrity and CASCADE / SET NULL / RESTRICT.
order: 25
---

## Introduction

This chapter covers the foundation of relational database design: keys, constraints, relationships and referential integrity.

You'll learn primary, foreign, candidate, alternate, composite, super, natural and surrogate keys; the `UNIQUE`, `NOT NULL`, `CHECK` and `DEFAULT` constraints; referential integrity; `ON DELETE CASCADE`, `ON DELETE SET NULL`, `ON DELETE RESTRICT` and `ON UPDATE CASCADE`; and enterprise design best practices — among the most important SQL and database-design interview topics for experienced Java backend developers.

## Why Do We Need Constraints?

| Employee ID | Name |
| --- | --- |
| 101 | John |
| 101 | David |

Two employees share ID 101. Who does employee 101 represent — John or David? This causes duplicate data, incorrect updates, invalid relationships, data inconsistency and application bugs. **Constraints prevent such problems at the database level.**

## What Is a Constraint?

A constraint is a **rule enforced by the database** to maintain the accuracy, consistency and integrity of data:

- Employee ID must be unique.
- Employee name cannot be `NULL`.
- Salary cannot be negative.
- Email must not be duplicated.
- Every order must belong to an existing customer.
- Order status must contain only allowed values.

```flow-h
No constraints
Invalid data enters the database
Data quality degrades
Application logic becomes unreliable
```

## Why Constraints Matter Even When Java Validates Data

A common interview question: *if validation already exists in Java or Spring Boot, why do we still need database constraints?*

Because the database may receive data from Spring Boot applications, batch jobs, SQL scripts, admin tools, data-migration tools, other microservices, ETL pipelines and manual database operations. **Application validation alone cannot guarantee database integrity.**

**Application validation + database constraints = strong data integrity.**

| Application validation provides | Database constraints provide |
| --- | --- |
| Better user experience | Final integrity enforcement |
| Early validation | Protection against every data-entry path |
| Friendly error messages | |

## Main Types of Constraints

| Constraint | Purpose |
| --- | --- |
| `PRIMARY KEY` | Uniquely identifies each row |
| `FOREIGN KEY` | Creates and protects table relationships |
| `UNIQUE` | Prevents duplicate values |
| `NOT NULL` | Makes a value mandatory |
| `CHECK` | Restricts allowed values |
| `DEFAULT` | Supplies a default value |

## What Is a Key?

A key is one or more columns used to identify rows, enforce uniqueness, create relationships and access data efficiently. The important types are **super, candidate, primary, alternate, composite, foreign, natural and surrogate** keys.

## PRIMARY KEY

A primary key **uniquely identifies every row** in a table. It:

- must be unique;
- cannot contain `NULL`;
- can contain one or multiple columns;
- exists only once per table (one primary key constraint);
- is automatically indexed in MySQL — in InnoDB it is the **clustered index** that physically organizes the table.

```sql
CREATE TABLE employee (
    employee_id   INT PRIMARY KEY,
    employee_name VARCHAR(100),
    salary        DECIMAL(10, 2)
);
```

### Valid, Duplicate and NULL Inserts

```sql
-- Valid: 101 doesn't exist yet
INSERT INTO employee (employee_id, employee_name, salary)
VALUES (101, 'John', 70000);

-- Rejected: duplicate primary key value 101
INSERT INTO employee (employee_id, employee_name, salary)
VALUES (101, 'David', 80000);

-- Rejected: a primary key cannot be NULL
INSERT INTO employee (employee_id, employee_name, salary)
VALUES (NULL, 'John', 70000);
```

```output Duplicate key error
ERROR 1062 (23000): Duplicate entry '101' for key 'employee.PRIMARY'
```

`NULL` means *unknown*, and an unknown value cannot uniquely identify a row.

### Table-Level Syntax

A primary key can also be defined separately — both approaches are valid:

```sql
CREATE TABLE employee (
    employee_id   INT,
    employee_name VARCHAR(100),
    salary        DECIMAL(10, 2),
    PRIMARY KEY (employee_id)
);
```

### AUTO_INCREMENT Primary Key

In MySQL, surrogate numeric identifiers are commonly generated with `AUTO_INCREMENT`:

```sql
CREATE TABLE employee (
    employee_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    salary        DECIMAL(10, 2)
);

INSERT INTO employee (employee_name, salary)
VALUES ('John', 70000);   -- MySQL generates employee_id automatically
```

## Composite Primary Key

Sometimes one column alone can't identify a row. Student enrollments:

| Student ID | Course ID |
| --- | --- |
| 101 | 1 |
| 101 | 2 |
| 102 | 1 |

Neither `student_id` nor `course_id` is unique alone, but **`student_id + course_id` together** uniquely identify an enrollment:

```sql
CREATE TABLE enrollment (
    student_id INT,
    course_id  INT,
    PRIMARY KEY (student_id, course_id)
);
```

Valid: 101 + Java, 101 + SQL, 102 + Java. Invalid: 101 + Java twice.

Composite keys are common in **junction tables**, many-to-many relationships and association tables — student + course, order + product, user + role, employee + project, account + permission.

## Candidate Key

A candidate key is any **minimal** column or combination of columns that can uniquely identify a row.

| Employee ID | Email | Employee code |
| --- | --- | --- |
| 101 | john@example.com | EMP001 |

If all three values are guaranteed unique, `employee_id`, `email` and `employee_code` are all **candidate keys** — any one could be chosen as the primary key.

A candidate key must be **unique + minimal**: it must identify a row, and contain no unnecessary columns. If `employee_id` alone is unique, `employee_id + employee_name` is *not* a candidate key — `employee_name` is unnecessary. It's a **super key**.

## Primary, Alternate and Super Keys

The designer chooses one candidate key — say `employee_id` — as the primary key:

| Candidate key | Role |
| --- | --- |
| `employee_id` | Primary key |
| `email` | Alternate key |
| `employee_code` | Alternate key |

An **alternate key** is a candidate key not selected as the primary key. In SQL, alternate keys are usually enforced with `UNIQUE`.

A **super key** is *any* column or combination that uniquely identifies a row. If `employee_id` is unique, all of these are super keys: `employee_id`, `employee_id + employee_name`, `employee_id + email`, `employee_id + employee_name + email`. Only the minimal ones are candidate keys.

| Super key | Candidate key |
| --- | --- |
| Uniquely identifies a row | Uniquely identifies a row |
| May contain unnecessary columns | Must be minimal |
| Many combinations may exist | Minimal unique identifiers only |

> [!TIP]
> Every candidate key is a super key, but not every super key is a candidate key.

### Key Hierarchy

```flow
Super keys
: remove unnecessary columns
Candidate keys
: choose one
Primary key
: the remaining candidate keys
Alternate keys
```

## Natural vs Surrogate Keys

A **natural key** is a real-world business value that naturally identifies an entity — email address, passport number, employee code, ISBN, vehicle registration number:

```sql
CREATE TABLE employee (
    email         VARCHAR(255) PRIMARY KEY,   -- natural key
    employee_name VARCHAR(100)
);
```

A **surrogate key** is an artificial identifier created purely for database identity — `employee_id`, `customer_id`, `order_id`, `product_id`:

```sql
CREATE TABLE employee (
    employee_id   BIGINT AUTO_INCREMENT PRIMARY KEY,   -- surrogate key
    email         VARCHAR(255) UNIQUE,
    employee_name VARCHAR(100)
);
```

| Natural key | Surrogate key |
| --- | --- |
| Has business meaning | No business meaning |
| May change | Usually stable |
| May be large | Usually compact |
| Example: email | Example: `employee_id` |
| Can expose business information | Internal identifier |

### The Common Enterprise Pattern

**Surrogate key → `PRIMARY KEY`; business identifiers → `UNIQUE`:**

```sql
CREATE TABLE employee (
    employee_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE
);
```

### Should We Always Avoid Natural Keys?

No. Natural keys can be appropriate when they are truly stable, small, guaranteed unique and never expected to change. But enterprise applications often prefer surrogate keys because business data changes — if `email` is the primary key and a user changes their email, the primary key changes and every related foreign key may need updating. A stable `user_id` avoids this.

## UNIQUE Constraint

`UNIQUE` prevents duplicate values:

```sql
CREATE TABLE employee (
    employee_id BIGINT PRIMARY KEY,
    email       VARCHAR(255) UNIQUE
);
```

`john@example.com` and `david@example.com` are valid; `john@example.com` twice is rejected.

Unlike a primary key, a table can have **multiple** `UNIQUE` constraints:

```sql
CREATE TABLE employee (
    employee_id   BIGINT PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE,
    email         VARCHAR(255) UNIQUE
);
```

### PRIMARY KEY vs UNIQUE

| PRIMARY KEY | UNIQUE |
| --- | --- |
| Uniquely identifies each row | Enforces uniqueness |
| Cannot contain `NULL` | `NULL` behavior depends on the DBMS |
| One per table | Multiple allowed |
| The main row identifier | Usually protects business identifiers |

> [!IMPORTANT]
> A MySQL `UNIQUE` index can contain **multiple `NULL` values**, because `NULL`s aren't treated as equal for uniqueness. If the column must always have a value, combine them: `email VARCHAR(255) NOT NULL UNIQUE`.

### Composite UNIQUE Constraint

Uniqueness can span several columns — this prevents assigning the same role to the same user twice:

```sql
CREATE TABLE user_role (
    user_id BIGINT,
    role_id BIGINT,
    UNIQUE (user_id, role_id)
);
```

## NOT NULL Constraint

`NOT NULL` makes a column **mandatory**:

```sql
CREATE TABLE employee (
    employee_id   BIGINT PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL
);

-- Rejected
INSERT INTO employee (employee_id, employee_name)
VALUES (101, NULL);
```

Use `NOT NULL` when the business rule says *this value must always exist* — employee name, order date, product price, transaction amount, account status. Don't make every column `NOT NULL` automatically; the decision should reflect the business requirement.

## DEFAULT Constraint

A default value is used **when no value is supplied**:

```sql
CREATE TABLE employee (
    employee_id BIGINT PRIMARY KEY,
    status      VARCHAR(20) DEFAULT 'ACTIVE'
);

INSERT INTO employee (employee_id) VALUES (101);
```

| Employee ID | Status |
| --- | --- |
| 101 | ACTIVE |

### DEFAULT Doesn't Replace an Explicit NULL

The default applies only when the column is **omitted** (or written as `DEFAULT`). Explicitly inserting `NULL` into a nullable column stores `NULL`. If the value must always exist, declare:

```sql
status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
```

> [!NOTE]
> With `NOT NULL DEFAULT 'ACTIVE'`, an explicit `NULL` is **not** silently converted to the default — in MySQL's strict SQL mode (the default) the insert fails with *Column 'status' cannot be null*. Omit the column, or write `DEFAULT`, to get `'ACTIVE'`.

## CHECK Constraint

A `CHECK` constraint validates that a value satisfies a condition:

```sql
CREATE TABLE employee (
    employee_id BIGINT PRIMARY KEY,
    salary      DECIMAL(10, 2),
    CONSTRAINT chk_employee_salary CHECK (salary >= 0)
);

-- Rejected
INSERT INTO employee (employee_id, salary) VALUES (101, -5000);
```

> [!IMPORTANT]
> **Before MySQL 8.0.16**, `CHECK` syntax was parsed but **ignored**. From **8.0.16** onwards, `CHECK` constraints are enforced — a useful interview point when discussing legacy MySQL systems.

### Multiple CHECKs and Allowed Values

```sql
CREATE TABLE product (
    product_id   BIGINT PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    price        DECIMAL(10, 2) NOT NULL,
    stock        INT NOT NULL,
    CONSTRAINT chk_product_price CHECK (price > 0),
    CONSTRAINT chk_product_stock CHECK (stock >= 0)
);

CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,
    status   VARCHAR(20) NOT NULL,
    CONSTRAINT chk_order_status
        CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'))
);
```

Invalid statuses are now rejected.

## FOREIGN KEY

A foreign key **creates a relationship between tables**.

| Customer ID | Name |
| --- | --- |
| 101 | John |
| 102 | David |

| Order ID | Customer ID |
| --- | --- |
| 1 | 101 |
| 2 | 102 |

`orders.customer_id` references `customer.customer_id` — `orders.customer_id` is the foreign key.

```refs
orders.customer_id -> customer | customer_id (primary key)
```

The referenced table (`customer`) is the **parent**; the table containing the foreign key (`orders`) is the **child**.

```sql
CREATE TABLE customer (
    customer_id   BIGINT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL
);

CREATE TABLE orders (
    order_id    BIGINT PRIMARY KEY,
    customer_id BIGINT,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id)
);
```

## Referential Integrity

Referential integrity ensures foreign-key relationships stay valid:

```sql
-- Customer 999 doesn't exist → rejected
INSERT INTO orders (order_id, customer_id) VALUES (1, 999);
```

```flow-h
Child row references parent 999
Parent does not exist
Foreign key constraint failure
```

### Can a Foreign Key Be NULL?

Yes, if the column allows `NULL` — `customer_id BIGINT NULL` with a `NULL` value means *no customer relationship assigned yet*. If every order must belong to a customer, use `customer_id BIGINT NOT NULL`.

A foreign key enforces: **if a non-`NULL` value exists, it must reference a valid parent.**

### Foreign-Key Requirements in MySQL

- Parent and child columns must use **compatible data types** — avoid mismatches such as parent `BIGINT UNSIGNED` vs child `BIGINT`.
- The referenced parent columns must be **indexed** (usually the primary key or a unique key).
- The storage engine must support foreign keys (InnoDB does; MyISAM doesn't).
- The referenced value must exist, unless the child foreign key is `NULL`.

## What Happens When a Parent Row Is Deleted?

Customer 101 has 10 orders, and someone runs `DELETE FROM customer WHERE customer_id = 101;`. What happens to the orders depends on the **referential action**: `CASCADE`, `SET NULL`, `RESTRICT` or `NO ACTION`.

### ON DELETE CASCADE

Automatically **deletes the related child rows** when the parent is deleted:

```sql
CREATE TABLE orders (
    order_id    BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id)
        ON DELETE CASCADE
);

DELETE FROM customer WHERE customer_id = 101;   -- customer 101's orders are deleted too
```

Appropriate when the child has **no meaning without the parent** — order → order items, blog post → comments, temporary parent → dependent temporary records.

> [!WARNING]
> A single delete can trigger a large **chain** of deletions (customer → orders → order items → other dependent records). Never use `CASCADE` just because it's convenient. In banking, payments, auditing, financial transactions and regulatory records, hard deletion may be inappropriate. Also note: in MySQL, rows deleted by a cascading foreign-key action **do not fire triggers**.

### ON DELETE SET NULL

Keeps the child row but **removes the relationship**:

```sql
CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
    ON DELETE SET NULL
```

Delete the customer → keep the order → `customer_id = NULL`.

> [!IMPORTANT]
> The foreign-key column must **allow `NULL`**. `customer_id BIGINT NOT NULL` combined with `ON DELETE SET NULL` is contradictory — MySQL refuses to create such a foreign key (error 1830, *column cannot be NOT NULL*).

Useful when, for example, an employee leaves but their historical tasks are kept (`assigned_employee_id = NULL`), or an optional category is deleted but its products remain (`category_id = NULL`).

### ON DELETE RESTRICT

**Prevents deleting the parent** while related child rows exist:

```sql
CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
    ON DELETE RESTRICT
```

Customer has orders → attempt to delete the customer → **the database rejects the delete**. Use it when deleting the parent would break business rules — a customer with financial transactions, an account with transactions, a product referenced by historical records, a department with active employees. It forces the application to handle dependent data explicitly.

### NO ACTION vs RESTRICT

In the SQL standard, `NO ACTION` and `RESTRICT` can differ in **when** enforcement happens (`NO ACTION` can be deferred). In MySQL's InnoDB they behave the same — both block parent changes while dependent child rows exist. If you specify no `ON DELETE` / `ON UPDATE` clause at all, MySQL uses `NO ACTION`.

### ON UPDATE CASCADE

Automatically **updates child foreign-key values** when the referenced parent key changes:

```sql
CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id)
    ON UPDATE CASCADE
```

Customer ID 101 → 500 updates every child foreign key from 101 to 500 as well. Stable surrogate primary keys (`AUTO_INCREMENT` IDs) normally never change, so `ON UPDATE CASCADE` is mostly useful when relationships reference **mutable business keys**.

### Referential Action Comparison

| Action | Parent delete | Child rows |
| --- | --- | --- |
| `CASCADE` | Allowed | Automatically deleted |
| `SET NULL` | Allowed | Foreign key becomes `NULL` |
| `RESTRICT` | Blocked if children exist | Unchanged |
| `NO ACTION` | Effectively restricted in MySQL | Unchanged |

### Decision Guide

```flow
? Should the child disappear with the parent? | Yes: CASCADE | No: next question
? Should the child remain without the parent? | Yes: SET NULL | No: next question
? Should parent deletion be blocked? | Yes: RESTRICT
```

## Complete Customer and Orders Example

```sql
CREATE TABLE customer (
    customer_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE orders (
    order_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    order_date  DATETIME NOT NULL,
    amount      DECIMAL(12, 2) NOT NULL,
    CONSTRAINT chk_orders_amount CHECK (amount >= 0),
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
```

## Naming Constraints

Instead of letting the database generate names, give constraints meaningful names — `CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customer (customer_id)`.

| Prefix | Example |
| --- | --- |
| Primary key | `pk_employee` |
| Foreign key | `fk_orders_customer` |
| Unique key | `uk_employee_email` |
| Check | `chk_product_price` |

Meaningful names make debugging easier, migration scripts clearer and production errors easier to understand.

## Real-World Designs

### Banking

```refs
account.customer_id -> customer | customer_id
transaction.account_id -> account | account_id
```

A transaction should never reference a nonexistent account — foreign keys enforce that.

> [!WARNING]
> In financial systems, don't blindly use `ON DELETE CASCADE` for transactional records. Deleting an **account** should not automatically delete its **financial transactions** — history must be kept for auditing, compliance, reconciliation and legal requirements. Safer designs use `RESTRICT`, soft deletes and status columns.

### E-commerce

```refs
orders.customer_id -> customer | customer_id
order_item.order_id -> orders | order_id
order_item.product_id -> product | product_id
```

### University — a Many-to-Many Junction Table

One student takes many courses and one course has many students — **many-to-many**. Relational databases resolve it with a junction table holding foreign keys to both parents:

```flow-h
student
enrollment
course
```

```sql
CREATE TABLE enrollment (
    student_id      BIGINT,
    course_id       BIGINT,
    enrollment_date DATE NOT NULL,
    PRIMARY KEY (student_id, course_id),
    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id) REFERENCES student (student_id),
    CONSTRAINT fk_enrollment_course
        FOREIGN KEY (course_id)  REFERENCES course (course_id)
);
```

### HRMS

```sql
CREATE TABLE department (
    department_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE employee (
    employee_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    department_id BIGINT NOT NULL,
    CONSTRAINT fk_employee_department
        FOREIGN KEY (department_id)
        REFERENCES department (department_id)
        ON DELETE RESTRICT
);
```

A department can't be deleted while employees reference it.

## Mini Project — E-commerce Schema

Four tables: `customer`, `product`, `orders` and `order_item`.

| Table | Requirements |
| --- | --- |
| `customer` | ID primary key; name mandatory; email mandatory and unique |
| `product` | ID primary key; name mandatory; price greater than zero |
| `orders` | ID primary key; customer foreign key; order date mandatory; status defaults to `PENDING` |
| `order_item` | Order and product foreign keys; quantity positive; composite primary key (order + product) |

```sql
CREATE TABLE customer (
    customer_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE product (
    product_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    price        DECIMAL(10, 2) NOT NULL,
    CONSTRAINT chk_product_price CHECK (price > 0)
);

CREATE TABLE orders (
    order_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    order_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT chk_order_status
        CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id)
        ON DELETE RESTRICT
);

CREATE TABLE order_item (
    order_id   BIGINT,
    product_id BIGINT,
    quantity   INT NOT NULL,
    PRIMARY KEY (order_id, product_id),
    CONSTRAINT chk_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT fk_order_item_order
        FOREIGN KEY (order_id)
        REFERENCES orders (order_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_item_product
        FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON DELETE RESTRICT
);
```

### Why Different Delete Rules?

- **orders → order_item: `ON DELETE CASCADE`** — an order item has no meaning without its order.
- **product → order_item: `ON DELETE RESTRICT`** — deleting a product must not erase historical order items.

> [!IMPORTANT]
> Choose referential actions **relationship by relationship**, according to business rules.

## Spring Boot and JPA Perspective

A typical JPA entity uses a surrogate primary key and a `@ManyToOne` relationship:

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;

@ManyToOne
@JoinColumn(name = "customer_id")
private Customer customer;
```

A JPA relationship does **not** automatically guarantee a database constraint — the actual schema should still enforce the required foreign keys (in production, managed by migrations such as Flyway or Liquibase rather than `ddl-auto`).

### JPA Cascade vs Database ON DELETE CASCADE

An important interview distinction:

| JPA cascade | Database cascade |
| --- | --- |
| `cascade = CascadeType.ALL` on a mapping | `ON DELETE CASCADE` on a foreign key |
| The ORM propagates entity operations (persist, merge, remove) | The database applies the referential action |
| Only applies to changes made through the persistence context | Applies to every delete, from any source |

They are **different mechanisms** — don't confuse them.

## Soft Delete vs Physical Delete

Many enterprise applications don't physically delete important records:

```sql
UPDATE customer SET status = 'INACTIVE' WHERE customer_id = 101;
-- or
UPDATE customer SET deleted = TRUE WHERE customer_id = 101;
```

This **soft delete** supports auditing, historical reporting, recovery and compliance. Foreign-key design should consider whether records are physically deleted at all.

## Constraint Design Mental Model

Before creating a column, ask:

| Question | If yes |
| --- | --- |
| Can this value be missing? (if **no**) | `NOT NULL` |
| Must this value be unique? | `UNIQUE` |
| Does this value identify the row? | `PRIMARY KEY` |
| Does this value reference another table? | `FOREIGN KEY` |
| Must this value satisfy a rule? | `CHECK` |
| Should a value be supplied automatically? | `DEFAULT` |

For every foreign key, ask: can the child exist without the parent? Should the child disappear when the parent is deleted? Should parent deletion be blocked? Must historical data be preserved? Then choose `CASCADE`, `SET NULL`, `RESTRICT` or soft delete based on the business requirement.

## Interview Questions

### Q1. Primary key vs unique key?

| Primary key | Unique key |
| --- | --- |
| Main row identifier | Enforces uniqueness |
| One per table | Multiple allowed |
| Cannot be `NULL` | MySQL allows multiple `NULL`s |
| Automatically indexed (clustered in InnoDB) | Also backed by a unique index |

A primary key is the table's chosen unique row identifier, while a `UNIQUE` constraint enforces uniqueness on additional candidate or business keys.

### Q2. Primary key vs foreign key?

| Primary key | Foreign key |
| --- | --- |
| Identifies a row | Creates a relationship |
| Must be unique | Can contain duplicate values |
| Cannot be `NULL` | Can be `NULL` if allowed |
| Defined on its own table | References a key in another table |

`customer.customer_id` is a primary key; `orders.customer_id` is a foreign key.

### Q3. Candidate key vs primary key?

A candidate key is **any minimal unique identifier**; the primary key is **the candidate key selected** as the main identifier. With candidate keys `employee_id`, `email` and `employee_code`, `employee_id` might be chosen as the primary key.

### Q4. Candidate key vs super key?

A super key is **any** unique combination; a candidate key is a **minimal** super key. `employee_id` is both a candidate key and a super key; `employee_id + employee_name` is a super key only.

### Q5. What is referential integrity?

Referential integrity ensures every non-`NULL` foreign-key value references a valid parent key, and prevents operations that would create invalid relationships — `order.customer_id = 999` is invalid if customer 999 doesn't exist.

### Q6. CASCADE vs SET NULL vs RESTRICT?

- **CASCADE** — delete parent → delete children.
- **SET NULL** — delete parent → keep children, foreign key becomes `NULL`.
- **RESTRICT** — children exist → the parent cannot be deleted.

### Q7. What is a composite key?

A key made from two or more columns that together uniquely identify a row — for example `order_id + product_id` in an `order_item` table.

## Common Mistakes

- ❌ **Using mutable business data as the primary key** — email, phone number and username can change. Prefer stable surrogate keys like `employee_id`, `customer_id` or `user_id`.
- ❌ **Assuming `AUTO_INCREMENT` means primary key** — define the key properly: `id BIGINT AUTO_INCREMENT PRIMARY KEY`. (MySQL requires an `AUTO_INCREMENT` column to be indexed anyway, but it should be the key, not merely indexed.)
- ❌ **Missing foreign keys** — the database can then hold **orphan records**: orders for nonexistent customers, transactions for nonexistent accounts, employees in nonexistent departments.
- ❌ **Using `CASCADE` everywhere** — it can cause unexpected large-scale deletions. Ask whether the child should truly disappear; otherwise use `RESTRICT`, `SET NULL` or soft delete.
- ❌ **`SET NULL` on a `NOT NULL` column** — logically incompatible; MySQL rejects the foreign key.
- ❌ **Relying only on application validation** — Java validation can be bypassed; protect important business invariants in the database too.
- ❌ **Overusing composite primary keys** — useful in junction tables, but very wide composite keys increase index size, widen foreign keys and complicate joins and ORM mappings. Choose them based on the data model, not as a universal rule.

## Practice Problems

**Easy**

1. Create an `employee` table with a primary key.
2. Create a `UNIQUE` email column.
3. Create a `NOT NULL` name column.
4. Create a `DEFAULT` status column.
5. Create a `CHECK` constraint for salary.
6. Create an `AUTO_INCREMENT` surrogate key.

**Medium**

1. Create `customer` and `orders` tables with a foreign key.
2. Create a composite primary key.
3. Implement `ON DELETE CASCADE`.
4. Implement `ON DELETE SET NULL`.
5. Implement `ON DELETE RESTRICT`.
6. Implement `ON UPDATE CASCADE`.
7. Design a student–course enrollment table.
8. Create a composite `UNIQUE` constraint.

**Interview level**

1. Explain candidate key vs super key.
2. Explain primary key vs foreign key.
3. Explain primary key vs unique key.
4. Explain natural key vs surrogate key.
5. Explain `CASCADE` vs `RESTRICT` vs `SET NULL`.
6. Explain referential integrity.
7. Explain JPA cascade vs database cascade.
8. Design an e-commerce database with proper constraints.
9. Discuss when natural keys should be avoided.
10. Explain why application validation doesn't replace database constraints.
11. Design foreign-key behavior for a financial system.

## Best Practices

- ✅ Prefer stable primary keys; surrogate numeric keys are often the practical choice for enterprise applications.
- ✅ Protect business identifiers with `UNIQUE` — e.g. `email VARCHAR(255) NOT NULL UNIQUE`.
- ✅ Use `NOT NULL` when a value is truly mandatory.
- ✅ Use `CHECK` constraints for important domain rules — `price > 0`, `quantity > 0`, `salary >= 0`.
- ✅ Use foreign keys to enforce referential integrity, with parent and child columns of compatible types.
- ✅ Name important constraints clearly.
- ✅ Choose referential actions from business rules, and be extremely careful with `ON DELETE CASCADE`.
- ✅ Consider soft deletion for historical, financial and audit-sensitive records.
- ✅ Remember that JPA cascade and database cascade are different concepts.

Keys and constraints are fundamental in banking, e-commerce, healthcare, ERP, HRMS, inventory, insurance, payment and reservation systems, Spring Boot + MySQL applications, microservices and audit systems — every well-designed production database relies on them.

## Interview One-Liners

- **Primary key** — the chosen unique, non-`NULL` identifier for each row in a relational table.
- **Candidate key** — a minimal set of columns that can uniquely identify a row; one candidate key is selected as the primary key.
- **Foreign key** — a column or set of columns that references a key in another table and enforces referential integrity between related records.
- **Referential integrity** — every non-`NULL` foreign-key value references a valid parent row, and operations that would create invalid relationships are prevented.
- **CASCADE vs SET NULL vs RESTRICT** — `CASCADE` automatically affects dependent child rows, `SET NULL` keeps them while removing the relationship, and `RESTRICT` blocks the parent operation while dependent rows exist.

## Key Takeaways

- ✅ A primary key uniquely identifies every row; a table has one primary key constraint, which may span multiple columns.
- ✅ A candidate key is a minimal unique identifier; the chosen one becomes the primary key and the rest are alternate keys.
- ✅ Every candidate key is a super key, but not every super key is a candidate key.
- ✅ Composite keys combine columns; natural keys have business meaning; surrogate keys are artificial identifiers.
- ✅ `UNIQUE` protects additional business identifiers, `NOT NULL` makes values mandatory, `DEFAULT` fills omitted values and `CHECK` enforces domain rules.
- ✅ Foreign keys create and protect relationships; referential integrity prevents invalid references.
- ✅ `CASCADE` deletes dependent children, `SET NULL` keeps them without the relationship, `RESTRICT` blocks deletion — choose per relationship by business rules.
- ✅ Database constraints complement application-level validation.
