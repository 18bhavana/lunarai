---
title: Native SQL Queries
subtitle: What native queries are, JPQL vs native SQL and when to choose each, parameters, mapping results to entities, Object[] and interface projections, native updates, deletes and inserts, pagination with countQuery, sorting, stored procedures, vendor functions, CTEs, window functions and performance.
order: 6
---

## Introduction

> [!NOTE]
> **Interview importance:** high. Enterprise applications use native SQL when JPQL can't express a query or when they need database-specific features and full control over performance.

A **native query** is raw SQL sent to the database **as written** — Hibernate doesn't translate it (it only binds parameters and maps the results).

```java
@Query(value = "SELECT * FROM employees", nativeQuery = true)
List<Employee> findAllEmployees();
```

```flow-h
Repository method
Native SQL
Database
ResultSet
Mapped to entities or projections
```

## JPQL vs Native SQL

| JPQL | Native SQL |
| --- | --- |
| Entity names and fields | Table and column names |
| Database independent | Database specific |
| Hibernate translates it to SQL | Executed as written |
| Validated at startup | Errors appear when the query runs |
| Portable, easier to maintain | Maximum flexibility |

```java
@Query("SELECT e FROM Employee e")                                   // JPQL
@Query(value = "SELECT * FROM employees", nativeQuery = true)        // native
```

## When to Use Native SQL

- Database-specific functions and syntax
- Recursive queries (`WITH RECURSIVE`)
- Optimizer hints
- Complex reporting queries
- Highly tuned SQL, or existing legacy SQL
- Features your Hibernate version's HQL doesn't support

> [!NOTE]
> Standard JPQL has no CTEs or window functions, but **Hibernate 6.2+ HQL** supports CTEs (`WITH`), window functions (`OVER`), `UNION`, and many SQL functions — check HQL before reaching for native SQL.

## Parameters

```java
@Query(value = """
       SELECT * FROM employees
       WHERE department = :dept AND salary > :salary
       """, nativeQuery = true)
List<Employee> search(@Param("dept") String dept, @Param("salary") BigDecimal salary);

@Query(value = "SELECT * FROM employees WHERE department = ?1 AND salary > ?2", nativeQuery = true)
List<Employee> searchPositional(String dept, BigDecimal salary);
```

> [!IMPORTANT]
> **Always bind parameters.** Concatenating user input into native SQL is a classic SQL-injection hole — and there's no JPQL layer in between.

## Returning Entities

```java
@Query(value = "SELECT * FROM employees WHERE department = :dept", nativeQuery = true)
List<Employee> byDepartment(@Param("dept") String dept);
```

Hibernate maps each row to an `Employee` by **column name**. The query must return **all the columns the entity maps** (with the expected names) — selecting only `id, name` into an entity fails with a missing-column error. Returned entities are **managed**, like any other loaded entity.

## Returning Selected Columns

### Object[]

```java
@Query(value = "SELECT name, salary FROM employees", nativeQuery = true)
List<Object[]> nameAndSalary();

for (Object[] row : repository.nameAndSalary()) {
    String name = (String) row[0];
    BigDecimal salary = (BigDecimal) row[1];   // a DECIMAL column comes back as BigDecimal
}
```

> [!WARNING]
> With native queries the Java types come from the **JDBC driver**: `DECIMAL` → `BigDecimal`, `BIGINT` → `Long`, `COUNT(*)` → `Long` (or `BigInteger` on some databases). Casting `row[1]` to `Double` throws `ClassCastException`. Prefer projections.

### Interface Projections

```java
public interface EmployeeView {
    String getName();
    BigDecimal getSalary();
}

@Query(value = "SELECT name, salary FROM employees", nativeQuery = true)
List<EmployeeView> findEmployeeViews();
```

Spring matches **column aliases** to getter names (`department_name AS departmentName` → `getDepartmentName()`).

### Other Options

- **`@SqlResultSetMapping`** with `@ConstructorResult` — the JPA-standard way to map native rows to a class.
- **`JdbcTemplate` / `JdbcClient`** with a `RowMapper` — often the simplest choice for heavy reporting SQL.

JPQL constructor expressions (`SELECT new …`) **don't work** in native SQL.

## Native UPDATE, DELETE and INSERT

```java
@Modifying
@Transactional
@Query(value = "UPDATE employees SET salary = :salary WHERE department = :dept", nativeQuery = true)
int updateSalary(@Param("salary") BigDecimal salary, @Param("dept") String dept);

@Modifying
@Transactional
@Query(value = "DELETE FROM employees WHERE department = :dept", nativeQuery = true)
int deleteDepartment(@Param("dept") String dept);

@Modifying
@Transactional
@Query(value = """
       INSERT INTO employees (name, department, salary)
       VALUES (:name, :department, :salary)
       """, nativeQuery = true)
int insertEmployee(@Param("name") String name,
                   @Param("department") String department,
                   @Param("salary") BigDecimal salary);
```

They return the number of affected rows. Like JPQL bulk statements, they **bypass the persistence context** — no dirty checking, cascades, callbacks or `@Version` updates — so use `clearAutomatically = true` when you'll read the same entities afterwards.

> [!NOTE]
> Inserts are normally done with `save()`. Native inserts are for special cases — bulk loading, `INSERT … ON DUPLICATE KEY UPDATE` / `ON CONFLICT` upserts, or database-specific logic.

## Pagination

```java
@Query(value = "SELECT * FROM employees WHERE department = :dept",
       countQuery = "SELECT COUNT(*) FROM employees WHERE department = :dept",
       nativeQuery = true)
Page<Employee> byDepartment(@Param("dept") String dept, Pageable pageable);
```

```sql
SELECT * FROM employees WHERE department = 'IT' LIMIT 20 OFFSET 0;   -- page
SELECT COUNT(*) FROM employees WHERE department = 'IT';               -- totals
```

Spring adds the limit/offset for your dialect. It **tries to derive** a count query from simple native SQL, but that's fragile for joins, `GROUP BY`, subqueries or CTEs — **provide `countQuery`** for anything non-trivial. Or return a `Slice` and skip the count.

## Sorting

```java
repository.byDepartment("IT", PageRequest.of(0, 20, Sort.by("salary").descending()));
```

Spring appends `ORDER BY salary DESC` to the native SQL. This works for **simple** queries; the sort property must be a real column (or alias) in the result, and complex SQL (unions, CTEs, a hard-coded `ORDER BY`) can produce broken SQL. In those cases, write the `ORDER BY` yourself and don't pass a `Sort`.

> [!WARNING]
> Never build `ORDER BY` from raw request input in native SQL — whitelist allowed sort columns.

## Stored Procedures

```sql
CREATE PROCEDURE raise_salary(IN dept VARCHAR(50), IN pct DECIMAL(5,2), OUT updated INT)
BEGIN
    UPDATE employees SET salary = salary * (1 + pct / 100) WHERE department = dept;
    SET updated = ROW_COUNT();
END
```

```java
@Procedure(procedureName = "raise_salary")
Integer raiseSalary(String dept, BigDecimal pct);   // returns the OUT parameter
```

`@Procedure` maps **IN parameters and an OUT parameter** naturally. For procedures that return **result sets**, use a native query (`@Query(value = "CALL get_employees()", nativeQuery = true)` on MySQL) or define `@NamedStoredProcedureQuery` on the entity with `resultClasses`. Calls must run in a transaction.

## Database-Specific Functions

| Database | Example |
| --- | --- |
| MySQL | `YEAR(joining_date)`, `DATE_FORMAT(...)`, `JSON_EXTRACT(...)` |
| Oracle | `TRUNC(date_column)`, `NVL(...)`, `CONNECT BY` |
| PostgreSQL | `DATE_TRUNC('month', created_date)`, `jsonb` operators, `ILIKE` |

```java
@Query(value = "SELECT * FROM employees WHERE YEAR(joining_date) = :year", nativeQuery = true)
List<Employee> joinedIn(@Param("year") int year);
```

(Hibernate 6 HQL also has `year(...)`, `extract(...)` and `function('name', …)` for many of these.)

## CTEs (Common Table Expressions)

```java
@Query(value = """
       WITH high_earners AS (
           SELECT * FROM employees WHERE salary > :min
       )
       SELECT * FROM high_earners WHERE department = :dept
       """, nativeQuery = true)
List<Employee> highEarners(@Param("min") BigDecimal min, @Param("dept") String dept);
```

### Recursive CTEs

```sql
WITH RECURSIVE employee_tree AS (
    SELECT id, name, manager_id, 1 AS level
    FROM employees WHERE manager_id IS NULL                  -- the CEO
    UNION ALL
    SELECT e.id, e.name, e.manager_id, t.level + 1
    FROM employees e JOIN employee_tree t ON e.manager_id = t.id
)
SELECT * FROM employee_tree ORDER BY level;
```

Useful for organisation charts, category trees and folder structures (MySQL 8+, PostgreSQL; Oracle also has `CONNECT BY`).

## Window Functions

```sql
SELECT name, department, salary,
       RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;
```

Common ones: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, `NTILE()`, `FIRST_VALUE()`, `LAST_VALUE()`. Map results with an interface projection (`getDeptRank()`). See the SQL track's window-functions chapter for details.

## Optimizer Hints

```sql
SELECT /*+ INDEX(e idx_salary) */ * FROM employees e WHERE salary > 50000;   -- Oracle
SELECT * FROM employees USE INDEX (idx_salary) WHERE salary > 50000;           -- MySQL
```

Use hints as a last resort, after checking indexes and statistics — they tie the query to one database and one data shape.

## Performance

- **Select only the columns you need** — `SELECT id, name, salary`, not `SELECT *` (except when mapping to an entity).
- **Index filter and join columns**:

```sql
CREATE INDEX idx_department ON employees (department);
```

- **Don't wrap indexed columns in functions**:

```sql
-- ❌ the index on joining_date can't be used efficiently
WHERE YEAR(joining_date) = 2025

-- ✅ a range the index can use
WHERE joining_date >= '2025-01-01' AND joining_date < '2026-01-01'
```

- **Limit results** — paginate.
- **Read execution plans** — MySQL `EXPLAIN` / `EXPLAIN ANALYZE`, PostgreSQL `EXPLAIN ANALYZE`, Oracle `EXPLAIN PLAN`.

## A Reporting Example

```java
public interface EmployeeReportRow {
    Integer getId();
    String getName();
    String getDepartmentName();
    BigDecimal getSalary();
}

@Query(value = """
       SELECT e.id, e.name, d.department_name AS departmentName, e.salary
       FROM employees e
       JOIN departments d ON e.department_id = d.id
       WHERE e.salary > :salary
       ORDER BY e.salary DESC
       """, nativeQuery = true)
List<EmployeeReportRow> employeeReport(@Param("salary") BigDecimal salary);
```

## Decision Guide

| Requirement | JPQL / HQL | Native SQL |
| --- | --- | --- |
| Simple CRUD and entity queries | ✅ | ⚠️ unnecessary |
| Database portability | ✅ | ❌ |
| DTO constructor expressions | ✅ | ❌ (use projections or mappings) |
| Vendor-specific functions | ⚠️ some via HQL | ✅ |
| CTEs, window functions | ⚠️ Hibernate 6.2+ HQL only | ✅ |
| Recursive queries, optimizer hints | ❌ | ✅ |
| Full SQL control | ❌ | ✅ |

## Common Mistakes

- ❌ **Entity names in native SQL** — `FROM Employee` instead of `FROM employees`.
- ❌ **Forgetting `nativeQuery = true`** — the SQL is parsed as JPQL and startup fails.
- ❌ **Missing `@Modifying`** on native updates and deletes.
- ❌ **Missing `countQuery`** for complex pageable native queries.
- ❌ **Wrong casts from `Object[]`** — check the JDBC types.
- ❌ **Selecting a subset of columns into an entity.**

## Interview Questions

### When should you use a native query instead of JPQL?

For database-specific features — recursive CTEs, vendor functions, optimizer hints, stored procedures — or highly tuned SQL that JPQL/HQL can't express.

### What's the difference between JPQL and native SQL?

JPQL works on entities and is translated into SQL by Hibernate (portable, validated at startup). Native SQL is written against tables and columns and executed as is.

### Why provide countQuery for native pagination?

`Page<T>` needs the total row count. Spring can only derive a count from simple SQL; for complex native queries you supply a correct (and cheaper) `countQuery`.

### Can native queries return entities?

Yes — if the result contains all the entity's mapped columns. The entities are managed. For partial results, use interface projections, `@SqlResultSetMapping`, or `Object[]`.

### What are the disadvantages of native SQL?

Vendor lock-in, less portability, no startup validation, harder maintenance, manual result mapping, and no JPQL constructor expressions.

## Best Practices

- ✅ Prefer JPQL/HQL; use native SQL only when it adds something.
- ✅ Return projections for reports, not full entities.
- ✅ Always bind parameters; whitelist dynamic sort columns.
- ✅ Provide `countQuery` for pageable native queries.
- ✅ Check execution plans and indexes.
- ✅ Document database-specific SQL to ease future migrations.

## Key Takeaways

- ✅ Native SQL runs as written — tables, columns and vendor syntax.
- ✅ Entity results need every mapped column; partial results need projections.
- ✅ Native `@Modifying` statements bypass the persistence context.
- ✅ Pageable native queries need a `countQuery`; dynamic sorting works only for simple SQL.
- ✅ Hibernate 6 HQL now covers CTEs and window functions — native SQL is for what's left.
