---
title: Fetching Strategies & the N+1 Problem
subtitle: LAZY vs EAGER, how proxies and lazy collections work, the N+1 select problem and how to detect it, JOIN FETCH, @EntityGraph, @BatchSize and default batch fetch size, DTO projections, collection fetching with pagination, MultipleBagFetchException and JDBC batching.
order: 10
---

## Introduction

The **N+1 problem** is the most common JPA performance bug — and the most common JPA interview question after entity states.

> [!NOTE]
> **Interview importance:** very high. Be ready to explain N+1, show how to detect it, and compare JOIN FETCH, entity graphs, batch fetching and DTOs.

## LAZY vs EAGER

| | LAZY | EAGER |
| --- | --- | --- |
| When the association loads | On first access | Immediately, with the owner |
| How | A **proxy** (for single entities) or a lazy **collection wrapper** | A join or an extra select |
| Risk | `LazyInitializationException` outside a transaction | Loading data you don't need, N+1 |

Defaults: `@ManyToOne`/`@OneToOne` **EAGER**, `@OneToMany`/`@ManyToMany` **LAZY**.

> [!IMPORTANT]
> **Make everything LAZY**, then fetch what each use case needs. `EAGER` is a static decision you can't undo per query — and JPQL queries load EAGER associations with **separate selects**, which is itself an N+1.

## The N+1 Problem

```java
List<Employee> employees = employeeRepository.findAll();          // 1 query
for (Employee e : employees) {
    System.out.println(e.getDepartment().getName());              // +1 query per employee
}
```

```output Hibernate SQL log
select … from employees e1_0
select … from departments d1_0 where d1_0.id=?
select … from departments d1_0 where d1_0.id=?
select … from departments d1_0 where d1_0.id=?
… (one per distinct department)
```

**1 query** for the list + **N queries** for the associations. With 1,000 rows that's up to 1,001 round trips — fast in development with 5 rows, painful in production.

It often hides in **JSON serialization**: Jackson walks `employee.department` on every element (with OSIV on).

### Detecting It

- Enable SQL logging in development: `logging.level.org.hibernate.SQL=DEBUG` (and `org.hibernate.orm.jdbc.bind=TRACE` for parameters).
- `spring.jpa.properties.hibernate.generate_statistics=true` logs query counts per session.
- Assert query counts in tests (e.g. with datasource-proxy or Hypersistence Utils).

## Fix 1 — JOIN FETCH

```java
@Query("SELECT e FROM Employee e JOIN FETCH e.department")
List<Employee> findAllWithDepartment();
```

```sql
select e1_0.id, …, d1_0.id, d1_0.name
from employees e1_0
join departments d1_0 on d1_0.id = e1_0.department_id
```

One query. Use `LEFT JOIN FETCH` if the association can be null. Fetching a **collection** duplicates the parent per child row in SQL — Hibernate 6 de-duplicates the parent entities automatically (in Hibernate 5 you needed `DISTINCT`).

## Fix 2 — @EntityGraph

The same result without writing JPQL — works on derived queries and built-in methods:

```java
@EntityGraph(attributePaths = {"department"})
List<Employee> findByActiveTrue();

@EntityGraph(attributePaths = {"department", "projects"})
Optional<Employee> findWithDetailsById(Long id);

@Override
@EntityGraph(attributePaths = "department")
List<Employee> findAll();
```

Or define it on the entity with `@NamedEntityGraph` and reference it by name. An entity graph is a **fetch graph**: listed attributes are fetched eagerly for that query, others use their mapped fetch type.

## Fix 3 — Batch Fetching

Instead of one query per association, Hibernate loads lazy associations **in batches** using `IN (…)`:

```properties
spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

or per association/class:

```java
@OneToMany(mappedBy = "department")
@BatchSize(size = 50)
private List<Employee> employees;
```

```sql
select … from departments where id in (?, ?, ?, …)   -- up to 50 ids at a time
```

N+1 becomes **1 + N/50**. It's a great **global safety net** — it needs no query changes and works with pagination.

## Fix 4 — DTO Projections

For read-only screens and APIs, select exactly what you need:

```java
public record EmployeeRow(Long id, String name, String departmentName) { }

@Query("""
       SELECT new com.example.dto.EmployeeRow(e.id, e.name, d.name)
       FROM Employee e JOIN e.department d
       """)
List<EmployeeRow> rows();
```

One query, no entities, no lazy loading, no dirty checking — usually the fastest option.

## Comparison

| Technique | Queries | Good for | Watch out for |
| --- | --- | --- | --- |
| `JOIN FETCH` | 1 | A specific use case needing the association | Collections + pagination; several collections |
| `@EntityGraph` | 1 | The same, declaratively, on derived methods | Same as JOIN FETCH |
| `@BatchSize` / `default_batch_fetch_size` | 1 + N/size | A global default; collections with pagination | Still several queries |
| DTO projection | 1 | Read-only views and APIs | Not managed — can't update through it |
| `FetchType.EAGER` | ❌ | Almost never | Loads everywhere, N+1 in JPQL |

## Collections and Pagination

```java
@Query("SELECT d FROM Department d JOIN FETCH d.employees")
Page<Department> findAllWithEmployees(Pageable pageable);   // ⚠️
```

```output
HHH90003004: firstResult/maxResults specified with collection fetch; applying in memory
```

SQL `LIMIT` would cut the joined rows mid-collection, so Hibernate loads **all** rows and paginates in memory — fine with 10 departments, a memory bomb with 100,000. (Setting `hibernate.query.fail_on_pagination_over_collection_fetch=true` turns the warning into an error.)

**Fix — two queries:**

```java
@Query("SELECT d.id FROM Department d")
Page<Long> findPageOfIds(Pageable pageable);

@Query("SELECT d FROM Department d JOIN FETCH d.employees WHERE d.id IN :ids")
List<Department> findWithEmployees(@Param("ids") List<Long> ids);
```

…or paginate the parents normally and let `@BatchSize` load their collections.

## MultipleBagFetchException

```java
@Query("SELECT p FROM Post p JOIN FETCH p.comments JOIN FETCH p.tags")   // both are List
```

```output
MultipleBagFetchException: cannot simultaneously fetch multiple bags
```

Fetching two `List` collections at once creates a Cartesian product (comments × tags) that Hibernate refuses to de-duplicate for bags. Fixes: fetch **one collection per query** (and the second in another query or via `@BatchSize`), or use `Set`s — which avoids the exception but still multiplies rows.

## Writing Efficiently — JDBC Batching

```properties
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
```

```java
@Transactional
public void importAll(List<Employee> employees) {
    for (int i = 0; i < employees.size(); i++) {
        em.persist(employees.get(i));
        if (i % 50 == 49) { em.flush(); em.clear(); }   // keep the persistence context small
    }
}
```

Statements are sent in groups of 50 instead of one by one. Remember: **`IDENTITY` ids disable insert batching** — use `SEQUENCE` for bulk inserts.

## Interview Questions

### What is the N+1 problem?

Loading N entities with one query and then triggering one more query per entity to load an association — N+1 round trips instead of one or two.

### How do you fix N+1?

Fetch the association with `JOIN FETCH` or an `@EntityGraph`, enable batch fetching (`@BatchSize` / `default_batch_fetch_size`), or use DTO projections. Don't switch to EAGER.

### Why is EAGER fetching considered bad?

It applies to every query, loading data you often don't need; with JPQL it's loaded by extra selects, causing N+1; and it can't be turned off per query.

### JOIN FETCH vs @EntityGraph?

Both fetch associations in the same query. `JOIN FETCH` is written in JPQL; `@EntityGraph` is declarative and works on derived and inherited repository methods.

### What happens when you paginate a query with a collection JOIN FETCH?

Hibernate can't apply `LIMIT` in SQL, so it loads all rows and paginates in memory (warning HHH90003004). Paginate ids first, or use batch fetching.

### What is MultipleBagFetchException?

The error when fetch-joining two or more `List` (bag) collections in one query. Fetch one collection per query or use batch fetching.

### How do you make bulk inserts fast?

Enable `hibernate.jdbc.batch_size`, order inserts, use `SEQUENCE` ids (IDENTITY prevents batching), and flush/clear the persistence context periodically.

## Key Takeaways

- ✅ LAZY everywhere; fetch per use case.
- ✅ N+1 = 1 list query + 1 query per row — watch the SQL log.
- ✅ Fix with JOIN FETCH, `@EntityGraph`, batch fetching or DTOs.
- ✅ Never paginate a collection fetch; fetch one bag per query.
- ✅ Batch writes with `jdbc.batch_size` and `SEQUENCE` ids.
