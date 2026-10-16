---
title: Derived Query Keywords
subtitle: Every common keyword Spring Data JPA understands in method names — comparison, Between, Before/After, Like, Containing, StartingWith, In, True/False, Null, IgnoreCase and OrderBy — combining them, nested properties and associations, and when to stop.
order: 3
---

## Introduction

This chapter is the vocabulary for derived queries: the **keywords** Spring Data JPA recognises when it parses repository method names.

```java
List<Employee> findBySalaryGreaterThan(BigDecimal salary);
```

```flow-h
find
By
Salary
GreaterThan
WHERE salary > ?
```

All examples use the `Employee` entity from the previous chapter (`name`, `email`, `department`, `salary`, `age`, `active`, `joiningDate`).

## Equality

| Method | SQL |
| --- | --- |
| `findByDepartment(String d)` | `WHERE department = ?` |
| `findByDepartmentIs(String d)` | `WHERE department = ?` |
| `findByDepartmentEquals(String d)` | `WHERE department = ?` |
| `findByDepartmentNot(String d)` / `IsNot` | `WHERE department <> ?` |

> [!NOTE]
> Passing `null` to a simple equality method like `findByEmail(null)` makes Spring Data generate `WHERE email IS NULL` rather than `= NULL` (which would never match). Be explicit with `findByEmailIsNull()` if that's what you mean.

## Comparison

| Method | SQL |
| --- | --- |
| `findBySalaryGreaterThan(BigDecimal s)` | `salary > ?` |
| `findBySalaryGreaterThanEqual(BigDecimal s)` | `salary >= ?` |
| `findBySalaryLessThan(BigDecimal s)` | `salary < ?` |
| `findBySalaryLessThanEqual(BigDecimal s)` | `salary <= ?` |
| `findBySalaryBetween(BigDecimal min, BigDecimal max)` | `salary BETWEEN ? AND ?` (inclusive) |

```java
repository.findBySalaryGreaterThan(new BigDecimal("50000"));
```

## Dates

Works with `LocalDate`, `LocalDateTime`, `Instant` and `Date`:

| Method | SQL |
| --- | --- |
| `findByJoiningDateBefore(LocalDate d)` | `joining_date < ?` |
| `findByJoiningDateAfter(LocalDate d)` | `joining_date > ?` |
| `findByJoiningDateBetween(LocalDate from, LocalDate to)` | `joining_date BETWEEN ? AND ?` |

## String Matching

| Method | Pattern | Matches for input |
| --- | --- | --- |
| `findByNameLike(String p)` | Exactly what you pass — `"%John%"` | You add the `%` yourself |
| `findByNameNotLike(String p)` | `NOT LIKE` your pattern | |
| `findByNameStartingWith(String s)` | `LIKE 'Jo%'` | `Jo` → John, Joseph, Jordan |
| `findByNameEndingWith(String s)` | `LIKE '%son'` | `son` → Jackson, Anderson, Wilson |
| `findByNameContaining(String s)` | `LIKE '%oh%'` | `oh` → John, Johnson, Johny |
| `findByNameNotContaining(String s)` | `NOT LIKE '%oh%'` | |

`StartingWith`, `EndingWith` and `Containing` add the wildcards **and escape** any `%` or `_` in the input, so user input can't change the pattern. With `Like`, you're responsible for both.

> [!TIP]
> `LIKE 'abc%'` (`StartingWith`) can use an index; `LIKE '%abc%'` (`Containing`) can't, and scans the table. For real search on large tables, use full-text indexes or a search engine.

## Collections of Values

| Method | SQL |
| --- | --- |
| `findByDepartmentIn(Collection<String> depts)` | `department IN (?, ?, …)` |
| `findByDepartmentNotIn(Collection<String> depts)` | `department NOT IN (…)` |

```java
repository.findByDepartmentIn(List.of("IT", "HR", "Finance"));
```

One query instead of three — prefer it to calling `findByDepartment` in a loop.

## Booleans

| Method | SQL |
| --- | --- |
| `findByActiveTrue()` / `findByActiveIsTrue()` | `active = true` |
| `findByActiveFalse()` / `findByActiveIsFalse()` | `active = false` |

## Null Checks

| Method | SQL |
| --- | --- |
| `findByEmailIsNull()` / `findByEmailNull()` | `email IS NULL` |
| `findByEmailIsNotNull()` / `findByEmailNotNull()` | `email IS NOT NULL` |

## Case and Ordering

| Method | SQL |
| --- | --- |
| `findByNameIgnoreCase(String n)` | `upper(name) = upper(?)` |
| `findByDepartmentOrderBySalaryAsc(String d)` | `… ORDER BY salary ASC` |
| `findByDepartmentOrderBySalaryDescNameAsc(String d)` | `… ORDER BY salary DESC, name ASC` |

## Combining Keywords

```java
findByDepartmentAndSalaryGreaterThan(String dept, BigDecimal salary)
// WHERE department = ? AND salary > ?

findByDepartmentAndAgeBetween(String dept, Integer min, Integer max)
// WHERE department = ? AND age BETWEEN ? AND ?

findByNameContainingIgnoreCase(String keyword)
// WHERE upper(name) LIKE upper('%keyword%')

findByDepartmentInAndActiveTrue(Collection<String> departments)
// WHERE department IN (…) AND active = true

findTop5BySalaryGreaterThanOrderBySalaryDesc(BigDecimal salary)
// WHERE salary > ? ORDER BY salary DESC FETCH FIRST 5 ROWS ONLY
```

### A Complex Example

```java
List<Employee> findTop10ByDepartmentAndSalaryGreaterThanAndActiveTrueOrderByJoiningDateDesc(
        String dept, BigDecimal salary);
```

```flow-h
find
Top10
By
Department
And SalaryGreaterThan
And ActiveTrue
OrderBy JoiningDateDesc
```

```sql
SELECT * FROM employee
WHERE department = ? AND salary > ? AND active = true
ORDER BY joining_date DESC
LIMIT 10;
```

It works — but it's a sign to consider `@Query` or a Specification.

## Nested Properties and Associations

With a relationship:

```java
@Entity
class Employee {
    @ManyToOne(fetch = FetchType.LAZY)
    private Department department;
}

@Entity
class Department {
    private String name;
}
```

```java
List<Employee> findByDepartmentName(String name);
```

Spring navigates the association and generates a join:

```sql
SELECT e.* FROM employee e
JOIN department d ON e.department_id = d.id
WHERE d.name = ?
```

> [!TIP]
> If the path is ambiguous (for example, an entity with both `departmentName` and `department.name`), use an underscore to mark the boundary: `findByDepartment_Name(String name)`.

### Collection Associations

```java
// Employee has @ManyToMany List<Project> projects
List<Employee> findByProjectsName(String projectName);
List<Employee> findDistinctByProjectsNameIn(Collection<String> names);   // avoid duplicate employees
```

Joining a collection can return the same employee once per matching project — add `Distinct` when that's a problem.

## Keyword Summary

| Keyword | SQL |
| --- | --- |
| `Is`, `Equals` (or none) | `=` |
| `Not`, `IsNot` | `<>` |
| `GreaterThan` / `GreaterThanEqual` | `>` / `>=` |
| `LessThan` / `LessThanEqual` | `<` / `<=` |
| `Between` | `BETWEEN … AND …` |
| `Before` / `After` | `<` / `>` |
| `Like` / `NotLike` | `LIKE` / `NOT LIKE` (your pattern) |
| `StartingWith` / `EndingWith` / `Containing` | `LIKE 'x%'` / `'%x'` / `'%x%'` |
| `NotContaining` | `NOT LIKE '%x%'` |
| `In` / `NotIn` | `IN` / `NOT IN` |
| `True` / `False` | `= true` / `= false` |
| `IsNull` / `IsNotNull` | `IS NULL` / `IS NOT NULL` |
| `IgnoreCase` / `AllIgnoreCase` | `upper(…) = upper(…)` |
| `OrderBy…Asc/Desc` | `ORDER BY` |
| `Top`/`First`N, `Distinct` | Limit / `DISTINCT` |

## Interview Questions

### Can you combine several keywords in one method?

Yes — `And`, `Or`, comparisons, `Between`, `IgnoreCase`, `OrderBy`, `Top` and more are parsed into a single query, e.g. `findTop5ByDepartmentAndSalaryGreaterThanOrderBySalaryDesc(...)`.

### Containing vs StartingWith vs Like?

`Containing` → `%value%`, `StartingWith` → `value%`, `EndingWith` → `%value` — Spring adds and escapes the wildcards. `Like` uses exactly the pattern you pass.

### Can derived queries traverse relationships?

Yes. With mapped associations, `findByDepartmentName(...)` navigates `employee.department.name` and generates a join; use `_` to disambiguate paths.

### What happens if a property name doesn't match the entity?

The application fails at startup with a property-resolution error.

### When should you stop using derived queries?

When method names become long or unreadable, or you need complex joins, aggregations, subqueries or database-specific features — use `@Query`, native SQL, Specifications or Querydsl.

## Best Practices

- ✅ Keep method names readable; switch to `@Query` or Specifications when they aren't.
- ✅ Prefer `Containing`/`StartingWith` over `Like` with hand-built patterns.
- ✅ Use `In` instead of repeated single-value queries.
- ✅ Use `Pageable` for potentially large results.
- ✅ Index columns you filter and sort on.

## Key Takeaways

- ✅ Keywords map directly to SQL operators: comparisons, `Between`, `Like` variants, `In`, booleans, nulls, ordering.
- ✅ `Containing`, `StartingWith` and `EndingWith` add and escape wildcards.
- ✅ Nested properties generate joins; collection joins may need `Distinct`.
- ✅ Long method names are a signal to use another query style.
