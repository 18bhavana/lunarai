---
title: Repository Methods (Derived Queries)
subtitle: How Spring Data parses method names into queries, prefixes like findBy, existsBy, countBy and deleteBy, Top and First, Distinct, IgnoreCase, And and Or, supported return types, and the pitfalls of derived queries.
order: 2
---

## Introduction

A large share of everyday database access in Spring applications is written as **repository method names** instead of JPQL or SQL. Spring Data reads the method name and builds the query for you.

Instead of writing:

```sql
SELECT * FROM employee WHERE department = 'IT';
```

you declare:

```java
List<Employee> findByDepartment(String department);
```

## How It Works

```flow
Application starts
Spring scans repository interfaces
Parses each method name into a query — fails fast if a property doesn't exist
Creates a repository proxy
At call time: the JPQL query runs through Hibernate
Hibernate generates SQL for the database
```

`findByDepartment` is split into **find** (the subject), **By** (the separator) and **Department** (the criteria) → `select e from Employee e where e.department = ?1`.

## The Sample Entity

```java
@Entity
public class Employee {
    @Id
    @GeneratedValue
    private Integer id;
    private String name;
    private String email;
    private String department;
    private BigDecimal salary;
    private Integer age;
    private Boolean active;
    private LocalDate joiningDate;
}
```

## Naming Rules

```text
<prefix>[Distinct|TopN|FirstN]By<Property><Keyword>[And|Or<Property><Keyword>…][OrderBy<Property>Asc|Desc]
```

```java
findByName(String name)
findBySalaryGreaterThan(BigDecimal salary)
findByAgeBetween(Integer min, Integer max)
findByDepartmentAndSalary(String dept, BigDecimal salary)
findByNameIgnoreCase(String name)
```

## Prefixes

| Prefix | Purpose |
| --- | --- |
| `findBy`, `readBy`, `getBy`, `queryBy`, `searchBy`, `streamBy` | Retrieve data — functionally equivalent |
| `existsBy` | `boolean` — does any row match? |
| `countBy` | `long` — how many rows match? |
| `deleteBy`, `removeBy` | Delete matching entities |

## findBy

```java
List<Employee> findByDepartment(String department);
```

```java
List<Employee> list = repository.findByDepartment("IT");
```

For a collection return type, **no matching rows → an empty list** — never `null`. One row gives a list with one element.

## findById and Optional

```java
Optional<Employee> emp = repository.findById(10);   // built into CrudRepository
emp.ifPresent(System.out::println);
Employee e = repository.findById(10).orElseThrow(() -> new EmployeeNotFoundException(10));
```

`Optional` makes "the row might not exist" explicit.

### Single-Result Methods

```java
Optional<Employee> findByEmail(String email);   // ✅ preferred
Employee findByEmail(String email);              // returns null if nothing matches
```

> [!WARNING]
> If a single-result method matches **more than one row**, Spring throws `IncorrectResultSizeDataAccessException`. Use single results only for unique columns, or use `findFirstBy…`.

## existsBy

```java
boolean existsByEmail(String email);
```

```java
if (repository.existsByEmail(email)) {
    throw new DuplicateEmailException(email);
}
```

Spring generates an efficient existence check (it selects a single row with a limit) rather than loading entities. Used for registration, duplicate checks and validation.

> [!NOTE]
> An `existsBy` check followed by an insert isn't race-free — two requests can both see "not exists". Back it with a **unique constraint** in the database.

## countBy

```java
long countByDepartment(String department);
```

```output Generated SQL
select count(e1_0.id) from employee e1_0 where e1_0.department=?
```

## deleteBy and removeBy

```java
@Transactional
long deleteByDepartment(String department);   // returns how many were deleted
```

> [!IMPORTANT]
> A derived `deleteBy…` method **doesn't run a single `DELETE`**. Spring first **selects** the matching entities, then calls `EntityManager.remove()` on **each** — so cascades and lifecycle callbacks run, but deleting 10,000 rows means 10,000 deletes. For bulk deletes, use a `@Modifying @Query("delete from Employee e where e.department = :dept")` (see *@Query & JPQL*). Derived deletes also need a transaction (`@Transactional` on the method or the calling service).

`removeBy…` is identical to `deleteBy…`.

## Top and First

```java
Optional<Employee> findTopByDepartment(String department);       // LIMIT 1
Optional<Employee> findFirstByOrderByJoiningDateAsc();            // earliest joiner
Optional<Employee> findTopByOrderBySalaryDesc();                  // highest paid
List<Employee> findTop3ByOrderBySalaryDesc();                     // top 3 salaries
List<Employee> findFirst5ByOrderByAgeAsc();                       // 5 youngest
```

```output Generated SQL for findTop3ByOrderBySalaryDesc
select … from employee e1_0 order by e1_0.salary desc fetch first ? rows only
```

`Top` and `First` are interchangeable. Without an `OrderBy`, "first" is whatever the database returns first — always add ordering.

## Distinct

```java
List<Employee> findDistinctByDepartment(String department);
```

Produces `select distinct e from Employee e where …`. Most useful when joining collections (which can return duplicate parent rows).

## IgnoreCase

```java
List<Employee> findByNameIgnoreCase(String name);
List<Employee> findByDepartmentAllIgnoreCase(String department);   // AllIgnoreCase = every String criterion
```

Spring generates `upper(e.name) = upper(?)`, matching `John`, `JOHN`, `john` and `JoHn`.

> [!TIP]
> Wrapping a column in `upper()` can stop the database using a normal index on that column. On large tables, use a case-insensitive collation (MySQL's default `utf8mb4_0900_ai_ci` already is) or a functional index.

## And / Or

```java
List<Employee> findByDepartmentAndSalary(String dept, BigDecimal salary);   // WHERE department=? AND salary=?
List<Employee> findByDepartmentOrSalary(String dept, BigDecimal salary);    // WHERE department=? OR salary=?
List<Employee> findByDepartmentAndSalaryAndActive(String dept, BigDecimal salary, Boolean active);
```

Parameters are bound **in the order they appear** in the method name.

## Return Types

| Return type | When |
| --- | --- |
| `Employee` / `Optional<Employee>` | At most one result |
| `List<Employee>`, `Set<Employee>`, `Collection<Employee>` | Many results |
| `Page<Employee>` / `Slice<Employee>` | With a `Pageable` parameter (see *Pagination & Sorting*) |
| `Stream<Employee>` | Process large results incrementally — must run in a transaction and be closed (try-with-resources) |
| A projection interface, record or DTO | Only some columns (see *Projections, Specifications & Auditing*) |
| `long`, `boolean` | `countBy`, `existsBy` |

```java
@Transactional(readOnly = true)
public void export() {
    try (Stream<Employee> stream = repository.streamAllByActiveTrue()) {
        stream.forEach(csvWriter::write);
    }
}
```

## Property Names Must Match the Entity

```java
private String department;   // entity field

findByDepartment(...)  // ✅
findByDept(...)        // ❌ startup error
```

```output
No property 'dept' found for type 'Employee'
```

Errors appear at **startup**, not at runtime — a nice safety net.

## Interview Questions

### How does Spring Data JPA generate repository methods?

At startup it creates a proxy for each repository interface, parses each method name into a query (validating property names), and at runtime executes it through the JPA provider (Hibernate), which generates the SQL.

### What happens if a method references a non-existent property?

The application fails to start with an exception saying no property with that name exists on the entity.

### What's the difference between findBy, readBy and getBy?

For derived queries they're functionally equivalent — it's a naming preference.

### findTopBy vs findFirstBy?

They're the same; both limit the results, and accept a number (`findTop3By…`) and ordering.

### How does a derived deleteBy method work?

It loads the matching entities and removes them one by one (so cascades and callbacks run), returning the count — it isn't a single bulk `DELETE`. It must run in a transaction.

### When should you avoid derived query methods?

When names become long and hard to read, or you need joins across several entities, aggregations, subqueries or database-specific SQL — use `@Query`, native queries or Specifications instead.

## Best Practices

- ✅ Use derived methods for simple lookups.
- ✅ Return `Optional<T>` for at most one result.
- ✅ Use `Page`/`Slice` with `Pageable` for large results.
- ✅ Switch to `@Query` or Specifications when names get unwieldy.
- ✅ Back `existsBy` checks with unique constraints; use bulk `@Modifying` queries for mass deletes.

## Key Takeaways

- ✅ Spring Data builds queries from method names: prefix + `By` + property + keyword.
- ✅ Collection results are never null; single results can be `Optional`.
- ✅ `existsBy` and `countBy` are efficient; derived `deleteBy` deletes entity by entity.
- ✅ `Top`/`First` limit results — combine with `OrderBy`.
- ✅ Property names are validated at startup.
