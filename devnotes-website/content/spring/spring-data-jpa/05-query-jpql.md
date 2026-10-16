---
title: "@Query & JPQL"
subtitle: Why @Query exists, JPQL vs SQL, named and positional parameters, LIKE, aggregates, GROUP BY and HAVING, @Modifying updates and deletes and their persistence-context pitfalls, joins, JOIN FETCH, subqueries, DTO projections and common mistakes.
order: 5
---

## Introduction

> [!NOTE]
> **Interview importance:** high. `@Query` is one of the most-asked Spring Data JPA topics — almost every enterprise application uses it for queries too complex for derived methods.

## Why @Query?

Derived methods are great for simple lookups. But this query:

```sql
SELECT * FROM employee
WHERE department = 'IT' AND salary > 70000 AND joining_date > '2023-01-01'
ORDER BY salary DESC;
```

becomes:

```java
findByDepartmentAndSalaryGreaterThanAndJoiningDateAfterOrderBySalaryDesc(...)
```

As requirements grow, method names become unreadable. `@Query` lets you write the query directly and give the method a meaningful name.

## What Is JPQL?

**JPQL** (Jakarta Persistence Query Language) is an **object-oriented** query language. It works with **entity names and fields**, not table and column names.

```java
@Entity
@Table(name = "employees")
public class Employee {
    @Id
    private Integer id;
    private String name;
    private String department;
    private BigDecimal salary;
}
```

| JPQL | SQL |
| --- | --- |
| `SELECT e FROM Employee e` | `SELECT … FROM employees` |
| Entity names (`Employee`) | Table names (`employees`) |
| Entity fields (`e.salary`) | Column names (`salary`) |
| Database independent | Database specific |
| Translated by Hibernate | Executed directly |

## Basic @Query

```java
@Query("SELECT e FROM Employee e")
List<Employee> getEmployees();

@Query("""
       SELECT e FROM Employee e
       WHERE e.department = 'IT'
       """)
List<Employee> getItEmployees();
```

Text blocks (`"""`) keep multi-line queries readable.

### Selecting Specific Fields

```java
@Query("SELECT e.name FROM Employee e")
List<String> getNames();

@Query("SELECT e.name, e.salary FROM Employee e")
List<Object[]> getNamesAndSalaries();   // each row: [0] = name, [1] = salary
```

`Object[]` works, but DTO projections (below) are type-safe and clearer.

## Named Parameters

```java
@Query("""
       SELECT e FROM Employee e
       WHERE e.department = :dept AND e.salary > :salary
       """)
List<Employee> search(@Param("dept") String dept, @Param("salary") BigDecimal salary);
```

> [!TIP]
> If you compile with `-parameters` (Spring Boot's Maven and Gradle plugins do), `@Param` can be omitted when the parameter name matches. Keeping it is still common and explicit.

## Positional Parameters

```java
@Query("SELECT e FROM Employee e WHERE e.department = ?1 AND e.salary > ?2")
List<Employee> search(String dept, BigDecimal salary);
```

`?1` is the first method parameter, `?2` the second. **Named parameters are preferred** — reordering method parameters can't silently break them.

> [!IMPORTANT]
> Never build JPQL by concatenating user input (`"… WHERE e.name = '" + name + "'"`). Parameters are bound safely and prevent **JPQL/SQL injection**.

## LIKE

```java
@Query("SELECT e FROM Employee e WHERE e.name LIKE %:name%")
List<Employee> searchByName(@Param("name") String name);
```

`%:name%` is a **Spring Data extension** to JPQL — it wraps the bound value in wildcards. `John` matches John, Johnny and Johnson. For case-insensitive search: `WHERE upper(e.name) LIKE upper(concat('%', :name, '%'))`.

## ORDER BY

```java
@Query("SELECT e FROM Employee e ORDER BY e.salary DESC")
List<Employee> allBySalary();

@Query("SELECT e FROM Employee e WHERE e.department = :dept")
List<Employee> byDepartment(@Param("dept") String dept, Sort sort);   // dynamic sort
```

## Aggregate Functions

```java
@Query("SELECT COUNT(e) FROM Employee e")
long totalEmployees();

@Query("SELECT SUM(e.salary) FROM Employee e")
BigDecimal totalSalary();

@Query("SELECT AVG(e.salary) FROM Employee e")
Double averageSalary();          // AVG always returns Double

@Query("SELECT MIN(e.salary) FROM Employee e")
BigDecimal minSalary();

@Query("SELECT MAX(e.salary) FROM Employee e")
BigDecimal maxSalary();
```

> [!NOTE]
> `SUM`, `MIN`, `MAX` and `AVG` return `null` on an empty table — use wrapper types, or `COALESCE(SUM(e.salary), 0)`.

## GROUP BY and HAVING

```java
@Query("""
       SELECT e.department, COUNT(e)
       FROM Employee e
       GROUP BY e.department
       HAVING COUNT(e) > 5
       """)
List<Object[]> largeDepartments();
```

```sql
SELECT department, COUNT(id) FROM employees
GROUP BY department
HAVING COUNT(id) > 5;
```

Better with a record:

```java
public record DepartmentCount(String department, long count) { }

@Query("""
       SELECT new com.example.dto.DepartmentCount(e.department, COUNT(e))
       FROM Employee e
       GROUP BY e.department
       """)
List<DepartmentCount> countByDepartment();
```

## UPDATE and DELETE with @Modifying

```java
@Modifying
@Transactional
@Query("UPDATE Employee e SET e.salary = :salary WHERE e.department = :dept")
int updateSalary(@Param("salary") BigDecimal salary, @Param("dept") String dept);

@Modifying
@Transactional
@Query("DELETE FROM Employee e WHERE e.department = :dept")
int deleteDepartment(@Param("dept") String dept);
```

The return value is the **number of rows affected**.

### Why @Modifying?

Spring treats every `@Query` as a `SELECT` by default. Without `@Modifying`, an update fails with `InvalidDataAccessApiUsageException` (Hibernate refuses to run a DML statement as a select query).

### Why @Transactional?

Modifications must run in a transaction so they can be committed (or rolled back). Without one you get `TransactionRequiredException`. Put `@Transactional` on the repository method or — better — on the calling service method.

### Bulk Statements Bypass the Persistence Context

> [!WARNING]
> A `@Modifying` query goes **straight to the database**. It:
>
> - **doesn't update entities already loaded** in the persistence context — they now hold stale values;
> - **doesn't trigger cascades or lifecycle callbacks** (`@PreUpdate`, `@PreRemove`) — entity listeners and auditing won't run;
> - **doesn't increment `@Version`** unless you do it in the query (`SET e.version = e.version + 1`), so optimistic locking is bypassed.

Spring Data's two options handle the first problem:

```java
@Modifying(flushAutomatically = true, clearAutomatically = true)
@Query("UPDATE Employee e SET e.active = false WHERE e.lastLogin < :cutoff")
int deactivateInactive(@Param("cutoff") LocalDateTime cutoff);
```

| Option | Effect |
| --- | --- |
| `flushAutomatically = true` | Flushes pending changes **before** the bulk query, so they aren't lost or overwritten |
| `clearAutomatically = true` | Clears the persistence context **after** it, so later reads load fresh data (unflushed changes are discarded — hence flush first) |

### Can JPQL Insert?

Standard JPQL has no `INSERT … VALUES`. Hibernate 6 HQL supports `INSERT INTO Entity (…) SELECT …` and `VALUES`, but normally you just call `save()`.

## JOINs

```java
@Entity
public class Employee {
    @ManyToOne(fetch = FetchType.LAZY)
    private Department department;
}
```

```java
@Query("""
       SELECT e FROM Employee e
       JOIN e.department d
       WHERE d.name = :name
       """)
List<Employee> byDepartmentName(@Param("name") String name);
```

You join **the association** (`e.department`), not a table — Hibernate adds the `ON` condition from the mapping.

```java
// LEFT JOIN — keeps employees without a department
@Query("SELECT e FROM Employee e LEFT JOIN e.department d WHERE d IS NULL OR d.active = true")
```

> [!NOTE]
> `@ManyToOne` and `@OneToOne` are **EAGER by default** in JPA. Set `fetch = FetchType.LAZY` explicitly, and fetch what you need per query — see *Fetching Strategies & the N+1 Problem*.

## JOIN FETCH

Accessing `employee.getDepartment()` on a lazy association can trigger an extra query per employee — the **N+1 problem**. `JOIN FETCH` loads the association in the same SQL query:

```java
@Query("SELECT e FROM Employee e JOIN FETCH e.department")
List<Employee> allWithDepartments();
```

| `JOIN` | `JOIN FETCH` |
| --- | --- |
| Used to filter or select | Also **initialises** the association on the returned entities |
| `e.getDepartment()` may still lazy-load | No extra query |

> [!WARNING]
> **JOIN FETCH a collection + pagination:** Hibernate can't apply `LIMIT` to the joined rows, so it fetches **everything** and paginates in memory, logging *HHH90003004: firstResult/maxResults specified with collection fetch; applying in memory*. Paginate ids first, or use `@BatchSize`/`@EntityGraph` — details in *Fetching Strategies & the N+1 Problem*. Also avoid fetch-joining several collections at once (Cartesian product, or `MultipleBagFetchException`).

## IN and EXISTS

```java
@Query("SELECT e FROM Employee e WHERE e.department IN :departments")
List<Employee> inDepartments(@Param("departments") Collection<String> departments);

@Query("SELECT COUNT(e) > 0 FROM Employee e WHERE e.email = :email")
boolean emailTaken(@Param("email") String email);
```

For simple existence checks a derived `existsByEmail` is shorter and stops at the first match.

## Subqueries

```java
@Query("""
       SELECT e FROM Employee e
       WHERE e.salary > (SELECT AVG(e2.salary) FROM Employee e2)
       """)
List<Employee> aboveAverage();
```

Employees earning above the company average. JPQL supports subqueries in `WHERE` and `HAVING` (Hibernate 6 also allows them in `SELECT` and `FROM`).

## DTO Projections

### Constructor Expressions

```java
public record EmployeeSummary(Integer id, String name, String department, BigDecimal salary) { }

@Query("""
       SELECT new com.example.dto.EmployeeSummary(e.id, e.name, e.department, e.salary)
       FROM Employee e
       WHERE e.department = :dept AND e.active = true
       ORDER BY e.salary DESC
       """)
List<EmployeeSummary> summaries(@Param("dept") String dept);
```

- The class must be referenced by its **fully qualified name**, with a matching constructor.
- Only the listed columns are selected — less memory, no dirty checking, nothing to lazy-load.

### Interface Projections

```java
public interface EmployeeView {
    String getName();
    BigDecimal getSalary();
}

@Query("SELECT e.name AS name, e.salary AS salary FROM Employee e")
List<EmployeeView> views();
```

Aliases must match the getter names. More in *Projections, Specifications & Auditing*.

## Pagination with @Query

```java
@Query(value = "SELECT e FROM Employee e WHERE e.department = :dept",
       countQuery = "SELECT COUNT(e) FROM Employee e WHERE e.department = :dept")
Page<Employee> byDepartment(@Param("dept") String dept, Pageable pageable);
```

Spring derives the count query for simple JPQL; provide `countQuery` when the main query has fetch joins or is expensive.

## Internal Flow

```flow
Repository method with @Query
Spring Data validates the JPQL at startup
Hibernate parses JPQL into SQL for the dialect
SQL runs over JDBC
Rows are mapped to entities, DTOs or values
```

Because JPQL is parsed at startup, a typo in an entity or field name fails fast.

## Native Queries

When JPQL isn't enough, run SQL directly:

```java
@Query(value = "SELECT * FROM employees WHERE YEAR(joining_date) = 2025", nativeQuery = true)
List<Employee> joinedIn2025();
```

Covered in the next chapter, *Native SQL Queries*.

## Performance Tips

- **Prefer JPQL** unless you need database-specific SQL.
- **Return DTOs** for read-only screens and APIs.
- **Use JOIN FETCH deliberately** — one association at a time, never with collection pagination.
- **Use `@Modifying` for bulk changes** instead of loading and saving thousands of entities — but remember it skips the persistence context, callbacks and versioning.
- **Index** columns in `WHERE`, `JOIN` and `ORDER BY`.

## Common Mistakes

- ❌ **Missing `@Modifying`** on an `UPDATE`/`DELETE`.
- ❌ **Missing a transaction** for modifying queries.
- ❌ **Table names in JPQL** — `SELECT * FROM employees` (use `SELECT e FROM Employee e`).
- ❌ **Column names instead of fields** — `WHERE employee_name = :name` (use `e.name`).
- ❌ **Reading stale entities after a bulk update** — use `clearAutomatically`.
- ❌ **Concatenating user input** into the query string.

## Interview Questions

### What's the difference between JPQL and SQL?

JPQL queries entities and their fields and is database-independent; SQL queries tables and columns. Hibernate translates JPQL into SQL for the configured dialect.

### When should you use @Query instead of derived methods?

When method names get too long, or you need joins, aggregations, subqueries, DTO projections, bulk updates or deletes.

### Why is @Modifying required?

Spring assumes `@Query` methods are selects. `@Modifying` tells it to execute an `UPDATE`/`DELETE` (via `executeUpdate`) and return the affected row count.

### What problems can @Modifying queries cause?

They bypass the persistence context: loaded entities become stale, cascades, callbacks and auditing don't run, and `@Version` isn't incremented. Use `flushAutomatically`/`clearAutomatically` and update the version manually if needed.

### What is JOIN FETCH?

A join that also initialises the association on the returned entities in the same query, avoiding lazy-loading queries (N+1). Avoid it with collection pagination.

### Named vs positional parameters?

Named parameters (`:dept` with `@Param`) are readable and order-independent; positional ones (`?1`) depend on parameter order. Both bind values safely.

## Key Takeaways

- ✅ JPQL uses entity names and fields; Hibernate turns it into SQL.
- ✅ Use parameters — never string concatenation.
- ✅ `UPDATE`/`DELETE` queries need `@Modifying` and a transaction, and bypass the persistence context.
- ✅ `JOIN FETCH` solves N+1 for an association — not with collection pagination.
- ✅ Constructor expressions, records and interface projections return only what you need.
