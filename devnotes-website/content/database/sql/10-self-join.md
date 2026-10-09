---
title: SELF JOIN
subtitle: Joining a table to itself — employee/manager and category hierarchies, why aliases are essential, INNER vs LEFT self joins, multi-level joins and self-referencing JPA entities.
order: 10
---

## Introduction

A favourite interview topic, because it tests whether you truly understand how joins work. Unlike `INNER JOIN` or `LEFT JOIN`, a **SELF JOIN is not a separate keyword**:

> [!IMPORTANT]
> A SELF JOIN simply means **joining a table with itself using different aliases**.

The pattern is extremely common: employee → manager, category → parent category, comment → parent comment, organization hierarchies and family trees.

## What is a SELF JOIN?

Joining a table with itself, using different aliases, so that **different rows of the same table can be related to each other**. There is still only **one physical table**.

| employee_id | employee_name | manager_id |
| --- | --- | --- |
| 1 | Rahul | 3 |
| 2 | Amit | 3 |
| 3 | Neha | NULL |
| 4 | Raj | 5 |
| 5 | Ankit | NULL |

Rahul's manager is employee 3, Amit's manager is employee 3 and Raj's manager is employee 5. **But where is the manager's name?** The row stores only the manager's **ID**. For Rahul (`manager_id = 3`) we need to find the row with `employee_id = 3` — Neha. Both live in the **same table**, which is why we use a self join.

## Why Do We Need a SELF JOIN?

Requirement: show **employee name and manager name**.

| Current | Required |
| --- | --- |
| Rahul — manager ID 3 | Rahul — Neha |

```flow
Without a self join
Employee
Get manager ID
Another lookup
Get manager name
---
With a self join
employees table
Join the same table
Employee name + manager name in one query
```

## Why Aliases Are Essential

```sql
SELECT *
FROM employees
JOIN employees;     -- ❌ error: Not unique table/alias: 'employees'
```

The same table appears twice, and SQL needs a way to distinguish the two **logical roles**. We use aliases: `employees e` (the employee) and `employees m` (the manager).

> [!NOTE]
> `e` and `m` refer to the **same physical table**, but they represent **different logical roles** in the query.

## SELF JOIN Syntax

```sql
SELECT e.employee_name AS employee,
       m.employee_name AS manager
FROM employees e
INNER JOIN employees m
    ON e.manager_id = m.employee_id;
```

The join condition `e.manager_id = m.employee_id` means: *take the employee's `manager_id` and find the row whose `employee_id` matches it.*

```refs
e = employee row, e.manager_id = 3 -> m: the row with employee_id 3 | Neha
```

## INNER SELF JOIN

Returns only rows that **have** a matching related row.

```flow-h
Rahul (manager_id = 3)
Find employee_id = 3
Neha
Return Rahul → Neha
```

| Employee | Manager |
| --- | --- |
| Rahul | Neha |
| Amit | Neha |
| Raj | Ankit |

Neha and Ankit don't appear because their `manager_id` is `NULL`, so they have no matching manager row.

## LEFT SELF JOIN

Requirement: show **every** employee, including CEOs or top-level employees without managers.

```sql
SELECT e.employee_name AS employee,
       m.employee_name AS manager
FROM employees e
LEFT JOIN employees m
    ON e.manager_id = m.employee_id;
```

| Employee | Manager |
| --- | --- |
| Rahul | Neha |
| Amit | Neha |
| Neha | NULL |
| Raj | Ankit |
| Ankit | NULL |

### INNER vs LEFT Self Join

| INNER SELF JOIN | LEFT SELF JOIN |
| --- | --- |
| Only employees with managers | All employees |
| Removes top-level employees | Keeps top-level employees |
| Requires a matching manager | Manager can be `NULL` |

## Category Hierarchy Example

Self joins aren't limited to employees.

| category_id | category_name | parent_category_id |
| --- | --- | --- |
| 1 | Electronics | NULL |
| 2 | Mobile | 1 |
| 3 | Laptop | 1 |
| 4 | Android | 2 |

```tree
Electronics
  Mobile
    Android
  Laptop
```

Requirement: display each category with its parent category.

```sql
SELECT c.category_name AS category,
       p.category_name AS parent_category
FROM categories c
LEFT JOIN categories p
    ON c.parent_category_id = p.category_id;
```

| Category | Parent category |
| --- | --- |
| Electronics | NULL |
| Mobile | Electronics |
| Laptop | Electronics |
| Android | Mobile |

Again: `c` = child category, `p` = parent category. Same table, different logical roles.

## Multiple SELF JOINs

Suppose we need **employee → manager → manager's manager** (CEO → Director → Manager → Developer). Join the same table multiple times:

```sql
SELECT e.employee_name  AS employee,
       m.employee_name  AS manager,
       gm.employee_name AS grand_manager
FROM employees e
LEFT JOIN employees m
    ON e.manager_id = m.employee_id
LEFT JOIN employees gm
    ON m.manager_id = gm.employee_id;
```

| Alias | Meaning |
| --- | --- |
| `e` | Employee |
| `m` | Manager |
| `gm` | Manager's manager |

```flow-h
e.manager_id
: matches
m.employee_id
: m.manager_id matches
gm.employee_id
```

This works well when the hierarchy **depth is known**. For arbitrary-depth hierarchies, a **recursive CTE** is generally better (covered in the CTE chapter).

## Spring Boot / JPA Example

```java
@Entity
public class Employee {

    @Id
    private Long employeeId;

    private String employeeName;

    @ManyToOne
    @JoinColumn(name = "manager_id")
    private Employee manager;
}
```

The `Employee` entity references another `Employee` — a **self-referencing relationship**.

```java
SELECT e
FROM Employee e
LEFT JOIN FETCH e.manager
```

Hibernate generates SQL similar to:

```sql
SELECT ...
FROM employees e
LEFT JOIN employees m
    ON e.manager_id = m.employee_id;
```

Understanding self joins helps you understand how Hibernate handles self-referencing relationships.

## Real Production Examples

| Use case | Hierarchy | Self-referencing column |
| --- | --- | --- |
| Employee hierarchy | CEO → Director → Manager → Developer | `manager_id` |
| Product categories | Electronics → Mobile → Android | `parent_category_id` |
| Comments and replies | Comment → Reply → Reply to reply | `parent_comment_id` |
| Organization tree | Company → Department → Team → Sub-team | `parent_unit_id` |

## Performance Tips

### 1. Index the Self-Referencing Column

```sql
CREATE INDEX idx_employee_manager ON employees (manager_id);
```

The join frequently searches using `e.manager_id = m.employee_id`. `employee_id` is usually the primary key and already indexed; indexing `manager_id` also helps queries that search or group employees by manager (e.g. "direct reports").

### 2. Use LEFT JOIN When Top-Level Records Must Appear

If `CEO.manager_id = NULL`, an `INNER JOIN` removes the CEO. Use `LEFT JOIN` when top-level records should remain.

### 3. Use Meaningful Aliases

`e` → employee, `m` → manager, `gm` → grand manager; for categories `c` → child, `p` → parent. Meaningful aliases make self-join queries much easier to understand.

## Common Mistakes

### Mistake 1 — Forgetting Aliases

```sql
SELECT e.employee_name, m.employee_name
FROM employees e
JOIN employees m
    ON e.manager_id = m.employee_id;
```

### Mistake 2 — The Wrong Join Condition

```sql
ON e.employee_id = m.employee_id     -- ❌ matches each employee with itself (Rahul → Rahul)
ON e.manager_id  = m.employee_id     -- ✅ employee's manager ID = manager's employee ID
```

### Mistake 3 — Using INNER JOIN When You Need Everyone

With `CEO.manager_id = NULL`, an `INNER JOIN` makes the CEO disappear; a `LEFT JOIN` keeps `CEO → NULL`.

### Mistake 4 — Thinking SELF JOIN Is a Separate Keyword

There's no `SELF JOIN` syntax. A self join is a normal `INNER JOIN` or `LEFT JOIN` where the same table appears more than once with different aliases.

## Interview Questions

### Q1. What is a SELF JOIN?

Joining a table to itself with two aliases so rows of the same table can be related (e.g. employee to manager).

### Q2. Is SELF JOIN a separate SQL keyword?

No — it's an ordinary `INNER`/`LEFT JOIN` where both sides are the same table.

### Q3. Can SQL join a table with itself?

Yes, as long as each occurrence has a different alias.

### Q4. Why are aliases important in a SELF JOIN?

They distinguish the two logical roles (and MySQL rejects the query without them).

### Q5. Write a query to display Employee → Manager.

`SELECT e.employee_name, m.employee_name AS manager FROM employees e LEFT JOIN employees m ON e.manager_id = m.employee_id;`

### Q6. What is the difference between an INNER SELF JOIN and a LEFT SELF JOIN?

The inner form drops employees without a manager; the left form keeps them with a `NULL` manager.

### Q7. How would you display Employee → Manager → Manager's Manager?

Join the table three times: `e LEFT JOIN m ON e.manager_id = m.employee_id LEFT JOIN gm ON m.manager_id = gm.employee_id`.

### Q8. What index would you create for an employee-manager hierarchy?

An index on `manager_id` (the primary key `employee_id` is already indexed).

### Q9. How do you find employees without managers?

`WHERE manager_id IS NULL` — or, to also catch dangling references, a `LEFT JOIN` to the manager row with `WHERE m.employee_id IS NULL`.

### Q10. Can a table reference itself using a foreign key?

Yes — e.g. `FOREIGN KEY (manager_id) REFERENCES employees(employee_id)`.

### Q11. What are real-world use cases for SELF JOIN?

Employee hierarchies, category trees, threaded comments, organization charts and family trees.

### Q12. When would you use a recursive CTE instead of multiple SELF JOINs?

When the hierarchy depth is unknown or variable — a recursive CTE walks any number of levels.

## Hands-On Assignment

Create `employees` (employee_id, employee_name, manager_id) with a CEO → Director → Manager → Developer hierarchy, then:

1. Display employee and manager.
2. Display all employees, including the CEO.
3. Display only employees without managers.
4. Display each manager and their number of direct reports.
5. Display employee, manager and manager's manager.

## Challenge Problems

### Problem 1 — Employees who report directly to Rahul.

```sql
SELECT e.employee_name
FROM employees e
JOIN employees m
    ON e.manager_id = m.employee_id
WHERE m.employee_name = 'Rahul';
```

### Problem 2 — Employees without managers.

```sql
SELECT employee_id,
       employee_name
FROM employees
WHERE manager_id IS NULL;
```

### Problem 3 — The reporting chain up to two levels.

```sql
SELECT e.employee_name  AS employee,
       m.employee_name  AS manager,
       gm.employee_name AS grand_manager
FROM employees e
LEFT JOIN employees m  ON e.manager_id = m.employee_id
LEFT JOIN employees gm ON m.manager_id = gm.employee_id;
```

### Problem 4 — A category hierarchy with parent categories.

Join `categories c` to `categories p` with `c.parent_category_id = p.category_id`.

### Problem 5 — Why is `ON e.employee_id = m.employee_id` incorrect?

Because it matches each employee with the **same** row instead of matching the employee's `manager_id` with the manager's `employee_id`. Correct: `ON e.manager_id = m.employee_id`.

## Classic Interview Question

| employee_id | employee_name | manager_id |
| --- | --- | --- |
| 1 | Rahul | 3 |
| 2 | Amit | 3 |
| 3 | Neha | NULL |

Write a query that displays `Rahul → Neha`, `Amit → Neha`, `Neha → NULL`:

```sql
SELECT e.employee_name AS employee,
       m.employee_name AS manager
FROM employees e
LEFT JOIN employees m
    ON e.manager_id = m.employee_id;
```

## Cheat Sheet

```sql
SELECT e.employee_name  AS employee,
       m.employee_name  AS manager,
       gm.employee_name AS grand_manager
FROM employees e
LEFT JOIN employees m  ON e.manager_id = m.employee_id
LEFT JOIN employees gm ON m.manager_id = gm.employee_id;
```

**Best practices:**

- ✅ Always use aliases.
- ✅ Join `manager_id` with `employee_id`.
- ✅ Index frequently queried self-referencing columns such as `manager_id`.
- ✅ Use `LEFT JOIN` when top-level records should be included.
- ✅ Keep alias names meaningful (`e`, `m`, `gm`).
- ✅ Use recursive CTEs when the hierarchy depth is unknown or dynamic.

> [!IMPORTANT]
> **SELF JOIN = same table + different aliases + a normal JOIN.**
