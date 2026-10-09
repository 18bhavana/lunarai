---
title: Many-to-Many Relationships and Junction Tables
subtitle: Relationship types, why M:N can't be stored directly, junction tables, composite vs surrogate keys, junction tables with business data, @ManyToMany in JPA and indexing mapping tables.
order: 11
---

## Introduction

This chapter is as much about **database design** as SQL. Almost every real-world application contains many-to-many relationships — user ↔ role, student ↔ course, user ↔ event, order ↔ product, product ↔ category. Understand this, and you'll also understand what happens behind JPA's `@ManyToMany`.

## Types of Database Relationships

### One-to-One (1:1)

One person has one passport; one passport belongs to one person.

```tree
person (person_id, name)
  passport (passport_id, person_id, passport_number)
```

### One-to-Many (1:N)

One customer can have many orders; each order belongs to one customer. The **foreign key usually lives on the "many" side**: `orders.customer_id → customers.customer_id`.

```tree
Customer 1
  Order 101
  Order 102
  Order 103
```

### Many-to-Many (M:N)

One student can enroll in many courses, and one course contains many students.

```buckets
Rahul: Java, MySQL, Spring Boot
Java: Rahul, Amit, Neha
```

## What is a Many-to-Many Relationship?

> [!IMPORTANT]
> One record in table A can relate to **many** records in table B, **and** one record in table B can relate to **many** records in table A. A relational database represents this with a **third table**.

## Why Can't We Store Many-to-Many Directly?

Rahul studies Java, MySQL and Spring Boot. A **bad** design:

| student_id | courses |
| --- | --- |
| 1 | Java, MySQL, Spring Boot |

Problems:

- ❌ Not normalized — violates the atomic-value rule of **First Normal Form (1NF)**
- ❌ Difficult to search individual courses
- ❌ Difficult to update relationships
- ❌ Impossible to enforce foreign keys
- ❌ Difficult to join with a `courses` table

To find all students enrolled in Java, developers end up writing fragile queries like `WHERE courses LIKE '%Java%'` — which can produce incorrect matches (`JavaScript`!) and performs poorly as the system grows.

### Another Bad Approach — Multiple Columns

| student | course1 | course2 | course3 |
| --- | --- | --- | --- |
| Rahul | Java | MySQL | Spring |

What happens when Rahul enrolls in a fourth course? Add `course4`. A fifth? `course5`. This design **doesn't scale**. Relationships should be represented using **rows**, not an ever-growing number of columns.

## The Solution — A Junction Table

Instead of storing multiple values in one column, create **three tables**:

| student_id | student_name |
| --- | --- |
| 1 | Rahul |
| 2 | Amit |

| course_id | course_name |
| --- | --- |
| 101 | Java |
| 102 | MySQL |
| 103 | Spring Boot |

**student_course:**

| student_id | course_id |
| --- | --- |
| 1 | 101 |
| 1 | 102 |
| 1 | 103 |
| 2 | 101 |

```flow-h student_course connects the other two tables
students (student_id)
student_course (student_id, course_id)
courses (course_id)
```

This middle table is called a **junction table**, **bridge table**, **mapping table**, **association table** or **join table** — all the same concept.

## Designing a Many-to-Many Schema

```sql
CREATE TABLE students (
    student_id   INT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    course_id   INT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL
);

CREATE TABLE student_course (
    student_id INT NOT NULL,
    course_id  INT NOT NULL,

    PRIMARY KEY (student_id, course_id),

    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id)  REFERENCES courses (course_id)
);
```

`PRIMARY KEY (student_id, course_id)` is a **composite primary key** — the **combination** must be unique. `(1, 101)`, `(1, 102)` and `(2, 101)` are allowed, but `(1, 101)` can't appear twice. The composite key **prevents duplicate student-course relationships**.

## Querying Many-to-Many Data

Requirement: display student name and course name.

```sql
SELECT s.student_name,
       c.course_name
FROM students s
INNER JOIN student_course sc
    ON s.student_id = sc.student_id
INNER JOIN courses c
    ON sc.course_id = c.course_id;
```

| Student | Course |
| --- | --- |
| Rahul | Java |
| Rahul | MySQL |
| Rahul | Spring Boot |
| Amit | Java |

```flow-h
students
: s.student_id = sc.student_id
student_course
: sc.course_id = c.course_id
courses
Student name + course name
```

## Real Example — User ↔ Role

Extremely common in Spring Boot security applications.

| id | name |
| --- | --- |
| 1 | Rahul |

| id | role |
| --- | --- |
| 1 | ADMIN |
| 2 | USER |

| user_id | role_id |
| --- | --- |
| 1 | 1 |
| 1 | 2 |

Rahul has **ADMIN** and **USER**. One user has many roles, and one role has many users → **many-to-many**.

```sql
SELECT u.name,
       r.role
FROM users u
INNER JOIN user_role ur
    ON u.id = ur.user_id
INNER JOIN roles r
    ON ur.role_id = r.id;
```

## Composite Key vs Surrogate Key

A common database-design and interview topic.

### Option 1 — Composite Primary Key

```sql
CREATE TABLE student_course (
    student_id INT NOT NULL,
    course_id  INT NOT NULL,
    PRIMARY KEY (student_id, course_id)
);
```

| ✅ Advantages | ❌ Disadvantages |
| --- | --- |
| Prevents duplicate combinations naturally | Composite-key mappings need more ORM configuration |
| No extra ID column | Foreign keys referencing the relationship need multiple columns |
| Represents the natural uniqueness of the relationship | Entity identity is more cumbersome in JPA/Hibernate |

### Option 2 — Surrogate Primary Key

```sql
CREATE TABLE student_course (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id  INT NOT NULL,

    UNIQUE (student_id, course_id),

    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id)  REFERENCES courses (course_id)
);
```

| ✅ Advantages | ❌ Disadvantages |
| --- | --- |
| Simple single-column primary key | Adds an extra column |
| Easier to reference from other tables | Still needs a `UNIQUE` constraint to prevent duplicates |
| Often convenient with JPA/Hibernate | |
| Easier to evolve into a full domain entity | |

### Which One Should You Use?

- **Pure mapping table** (only `student_id`, `course_id`) → a composite primary key is often a clean design.
- **Relationship with its own identity or lifecycle** (e.g. `enrollment_date`, `status`, `grade`, `created_by`, `updated_at`) → model it as a separate entity with its own primary key.

> [!NOTE]
> There's no universal rule that enterprise Java projects must always use surrogate keys. Choose based on the domain, the lifecycle, ORM requirements and how the relationship will be referenced.

## Junction Tables with Additional Columns

A junction table isn't always just a connector — sometimes **the relationship itself contains business data**. One order contains many products, and one product appears in many orders:

| order_item_id | order_id | product_id | quantity | unit_price | discount |
| --- | --- | --- | --- | --- | --- |
| 1 | 101 | 501 | 2 | 500 | 50 |
| 2 | 101 | 502 | 1 | 1000 | 0 |

`quantity`, `unit_price` and `discount` belong to the **relationship** between an order and a product — not only to the order, and not only to the product. This makes `order_item` a **real business entity**.

### Important Design Insight

Instead of thinking *Order — many-to-many — Product*, it's often better to think:

```flow-h Extremely common in production systems
Order
: 1 → many
OrderItem
: many → 1
Product
```

## Spring Boot / JPA @ManyToMany

```java
@Entity
public class User {

    @Id
    private Long id;

    @ManyToMany
    private Set<Role> roles;
}
```

JPA uses a **join table** to represent the relationship. A more explicit mapping:

```java
@Entity
public class User {

    @Id
    private Long id;

    @ManyToMany
    @JoinTable(
            name = "user_role",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles;
}
```

JPQL `SELECT u FROM User u JOIN u.roles r` generates SQL similar to:

```sql
SELECT ...
FROM users u
INNER JOIN user_role ur ON u.id = ur.user_id
INNER JOIN roles r      ON ur.role_id = r.id;
```

Now you understand what happens behind `@ManyToMany`.

### Important JPA Design Consideration

Direct `@ManyToMany` works well for **simple** relationships. But if `user_role` needs additional columns (`assigned_date`, `assigned_by`, `status`), a direct `@ManyToMany` becomes limiting. Make the relationship its own entity — **User → UserRole → Role**:

```java
@Entity
public class UserRole {

    @Id
    private Long id;

    @ManyToOne
    private User user;

    @ManyToOne
    private Role role;

    private LocalDateTime assignedDate;
}
```

A very important production-level design pattern.

## Real Production Examples

| Relationship | Tables | Typical extra columns / purpose |
| --- | --- | --- |
| User ↔ Role | users → user_role → roles | Authentication, authorization, RBAC |
| Student ↔ Course | students → student_course → courses | `enrollment_date`, `status`, `grade` |
| Order ↔ Product | orders → order_items → products | `quantity`, `unit_price`, `discount` |
| Product ↔ Category | products → product_category → categories | A product in several categories |
| Customer ↔ Account | customers → customer_account → accounts | Joint bank accounts |

## Performance Tips

### 1. Index the Foreign Keys

Mapping tables are queried through their foreign keys (`student_id`, `course_id`), so those columns need indexes.

### 2. Understand Composite Index Order

`PRIMARY KEY (student_id, course_id)` is especially useful for queries **beginning with** `WHERE student_id = ?`. For frequent `WHERE course_id = ?` lookups you need an index **starting with** `course_id`:

```sql
CREATE INDEX idx_student_course_course
    ON student_course (course_id);
```

Composite index column order matters. (InnoDB actually creates an index on `course_id` automatically for its foreign key if none exists — but it's worth knowing why it's needed.)

### 3. Prevent Duplicate Relationships

Use `PRIMARY KEY (student_id, course_id)` or `UNIQUE (student_id, course_id)`. Without one, duplicate mappings can occur.

### 4. Never Store Comma-Separated Relationship IDs

`course_ids = "101,102,103"` ❌ → rows in `student_course` ✅. Normalized rows are easier to query, index, join, validate, update and enforce with foreign keys.

## Common Mistakes

- ❌ **Storing multiple values in one column** (`Java,SQL,Spring`) — use a junction table.
- ❌ **Missing a unique constraint** — without `PRIMARY KEY`/`UNIQUE (student_id, course_id)`, `Rahul → Java` can be inserted twice.
- ❌ **Forgetting foreign keys** — invalid relationships like `student_id = 999, course_id = 888` can be inserted even when those records don't exist. Foreign keys maintain **referential integrity**.
- ❌ **Using a direct `@ManyToMany` when the relationship has business data** (`assigned_date`, `assigned_by`, `status`) — create a `UserRole` entity instead.

## Interview Questions

### Q1. What is a many-to-many relationship?

A relationship where a row in each table can relate to many rows in the other (e.g. students and courses).

### Q2. Why can't we store multiple values in one column?

It violates 1NF, can't be indexed or constrained with foreign keys, and makes searching, updating and joining unreliable.

### Q3. What is a junction table?

A third table holding pairs of foreign keys that link the two sides of a many-to-many relationship.

### Q4. What are other names for a junction table?

Bridge, mapping, association or join table.

### Q5. How do you convert a many-to-many relationship into relational tables?

Keep the two entity tables and add a junction table with a foreign key to each, plus a primary key or unique constraint on the pair.

### Q6. What is the difference between a composite key and a surrogate key?

A composite key uses the natural combination of columns (e.g. `student_id, course_id`); a surrogate key is an artificial single column (e.g. an `AUTO_INCREMENT` id) with no business meaning.

### Q7. Why does Hibernate create a join table for @ManyToMany?

Because a many-to-many can't be represented by a single foreign key in either table.

### Q8. Can a junction table contain additional columns?

Yes — and then it's usually a business entity of its own (e.g. `order_items`).

### Q9. How would you design User ↔ Role?

`users`, `roles` and `user_role(user_id, role_id)` with a composite primary key and foreign keys to both tables.

### Q10. How would you design Order ↔ Product?

`orders`, `products` and an `order_items` entity holding `order_id`, `product_id`, `quantity`, `unit_price` and `discount`.

### Q11. Why should foreign keys in a mapping table be indexed?

Because every lookup in either direction goes through them; without indexes, joins scan the whole mapping table.

### Q12. Why is UNIQUE(student_id, course_id) important?

It prevents the same relationship from being recorded twice.

### Q13. When should a junction table become a separate JPA entity?

When the relationship carries its own data or lifecycle (dates, status, quantities) or must be referenced by other tables.

### Q14. Why can composite index column order matter?

A composite index is sorted by its first column, then the second, so it efficiently serves queries filtering on the leading column(s) — not queries on the second column alone.

## Hands-On Assignment

Create `students`, `courses` and `student_course`; insert 5 students and 5 courses, and assign multiple students to multiple courses. Then write queries to:

1. Display every student with their courses.
2. Display all students enrolled in Java.
3. Display all courses Rahul is enrolled in.
4. Display students not enrolled in any course.
5. Count how many students are enrolled in each course.

### Students Enrolled in Java

```sql
SELECT s.student_name
FROM students s
INNER JOIN student_course sc ON s.student_id = sc.student_id
INNER JOIN courses c         ON sc.course_id = c.course_id
WHERE c.course_name = 'Java';
```

### Rahul's Courses

```sql
SELECT c.course_name
FROM students s
INNER JOIN student_course sc ON s.student_id = sc.student_id
INNER JOIN courses c         ON sc.course_id = c.course_id
WHERE s.student_name = 'Rahul';
```

### Students Not Enrolled in Any Course

```sql
SELECT s.student_id,
       s.student_name
FROM students s
LEFT JOIN student_course sc
    ON s.student_id = sc.student_id
WHERE sc.student_id IS NULL;
```

This uses the **anti-join** pattern from the LEFT JOIN chapter.

## Challenge Problems

1. Design **User ↔ Role** → users, user_role, roles.
2. Design **Product ↔ Category** → products, product_category, categories.
3. Design **Order ↔ Product** with `quantity`, `unit_price` and `discount` → orders, order_items, products, with `order_items` treated as a business entity.
4. Explain why storing `Java,SQL,Spring` in one column is bad design — it violates normalization, makes searching and indexing individual relationships difficult, prevents foreign-key enforcement, and complicates updates and deletes.
5. Write the query displaying student name and course name (see *Querying Many-to-Many Data* above).

## Real Interview Scenario

> [!QUESTION] One user can register for many events, and one event can have many registered users. How would you design the database?
> **users → user_event → events.** The `user_event` table could hold booking date, ticket count, booking status and payment status — at which point it's more than a connector: it represents a real business relationship and may deserve its own application entity.

## Cheat Sheet

| Relationship | Implementation |
| --- | --- |
| One-to-one | Person 1 — 1 Passport |
| One-to-many | Customer 1 — many Orders (FK on the many side) |
| Many-to-many | Students — student_course — Courses |

```sql
-- Composite-key junction table
CREATE TABLE student_course (
    student_id INT NOT NULL,
    course_id  INT NOT NULL,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id)  REFERENCES courses (course_id)
);

-- Surrogate-key alternative
--   id BIGINT AUTO_INCREMENT PRIMARY KEY,
--   UNIQUE (student_id, course_id)
```

**Best practices:**

- ✅ Always use a junction table for many-to-many relationships.
- ✅ Never store comma-separated relationship values.
- ✅ Use foreign keys to maintain referential integrity.
- ✅ Prevent duplicate mappings with a composite primary key or unique constraint.
- ✅ Index columns based on actual query patterns, and understand composite index order.
- ✅ Allow additional relationship attributes when needed — and promote the junction table to a JPA entity when it holds business data.
