---
title: Projections, Specifications & Auditing
subtitle: Interface, class/record and dynamic projections, closed vs open projections, dynamic search with Specifications and JpaSpecificationExecutor, Query by Example, custom repository fragments, and auditing with @CreatedDate, @LastModifiedBy and AuditorAware.
order: 12
---

## Introduction

Three Spring Data features that every real application ends up needing:

- **Projections** — read only the fields you need.
- **Specifications** — build `WHERE` clauses dynamically for search screens.
- **Auditing** — fill created/modified dates and users automatically.

## Projections

Loading full entities for a list screen wastes memory and triggers dirty checking and lazy loading. A **projection** returns just the needed fields.

### Interface Projections

```java
public interface EmployeeSummary {
    String getName();
    BigDecimal getSalary();
    DepartmentInfo getDepartment();      // nested projection

    interface DepartmentInfo {
        String getName();
    }
}

List<EmployeeSummary> findByActiveTrue();
```

Spring generates a query selecting only `name`, `salary` and the department's `name`, and returns proxies implementing the interface.

| Closed projection | Open projection |
| --- | --- |
| Getters match entity properties | Uses SpEL: `@Value("#{target.firstName + ' ' + target.lastName}")` |
| Spring selects **only those columns** | Spring must load the **whole entity** (`target`) — no query optimisation |

> [!TIP]
> Prefer closed projections. For computed values, use a `default` method in the interface — it doesn't stop the query optimisation.

```java
default String getDisplayName() { return getName().toUpperCase(); }
```

### Class / Record Projections (DTOs)

```java
public record EmployeeDto(String name, BigDecimal salary) { }

List<EmployeeDto> findByDepartment(String department);
```

Spring Data uses the constructor parameter names to select the matching properties. Records are immutable, simple and serialise cleanly to JSON. Nested properties aren't supported here — use a JPQL constructor expression for joins.

### Dynamic Projections

```java
<T> List<T> findByDepartment(String department, Class<T> type);

repository.findByDepartment("IT", EmployeeSummary.class);
repository.findByDepartment("IT", EmployeeDto.class);
repository.findByDepartment("IT", Employee.class);
```

One method, the caller picks the shape.

| Projection | Strengths | Limits |
| --- | --- | --- |
| Interface (closed) | Nested projections, minimal SQL | Proxies; read-only |
| Record / class | Plain objects, immutable, JSON-friendly | No nested properties in derived queries |
| JPQL `SELECT new …` | Full control, joins, aggregates | Fully qualified class name in the query |

## Specifications — Dynamic Queries

A search screen with optional filters (name, department, salary range, active) would need dozens of derived methods. **Specifications** compose predicates at runtime using the JPA Criteria API.

```java
public interface EmployeeRepository
        extends JpaRepository<Employee, Long>, JpaSpecificationExecutor<Employee> { }
```

```java
public final class EmployeeSpecs {

    public static Specification<Employee> nameContains(String text) {
        return (root, query, cb) -> text == null ? null
                : cb.like(cb.lower(root.get("name")), "%" + text.toLowerCase() + "%");
    }

    public static Specification<Employee> inDepartment(String dept) {
        return (root, query, cb) -> dept == null ? null
                : cb.equal(root.get("department").get("name"), dept);
    }

    public static Specification<Employee> salaryBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min == null && max == null) return null;
            if (min == null) return cb.le(root.get("salary"), max);
            if (max == null) return cb.ge(root.get("salary"), min);
            return cb.between(root.get("salary"), min, max);
        };
    }

    public static Specification<Employee> isActive() {
        return (root, query, cb) -> cb.isTrue(root.get("active"));
    }
}
```

A `null` predicate means "no condition" — that's how optional filters drop out.

```java
Specification<Employee> spec = Specification.allOf(
        nameContains(form.name()),
        inDepartment(form.department()),
        salaryBetween(form.minSalary(), form.maxSalary()),
        isActive());
// or chain: nameContains(...).and(inDepartment(...)).and(...)

Page<Employee> results = repository.findAll(spec, PageRequest.of(0, 20, Sort.by("name")));
```

```sql
SELECT … FROM employees e JOIN departments d ON …
WHERE lower(e.name) LIKE ? AND d.name = ? AND e.salary BETWEEN ? AND ? AND e.active = true
ORDER BY e.name LIMIT 20
```

`JpaSpecificationExecutor` provides `findAll(spec)`, `findAll(spec, pageable)`, `findOne(spec)`, `count(spec)`, `exists(spec)` and `delete(spec)`.

> [!TIP]
> String attribute names (`"salary"`) aren't checked at compile time. The Hibernate JPA **static metamodel** (`Employee_.salary`, generated by `hibernate-jpamodelgen`) makes them type-safe. **Querydsl** is a popular alternative with a fluent, type-safe API.

## Query by Example (QBE)

For simple "match the fields I filled in" searches:

```java
Employee probe = new Employee();
probe.setDepartment("IT");
probe.setName("jo");

ExampleMatcher matcher = ExampleMatcher.matching()
        .withIgnoreNullValues()
        .withIgnoreCase()
        .withMatcher("name", m -> m.startsWith())
        .withIgnorePaths("salary", "age");    // ignore primitive or defaulted fields

List<Employee> found = repository.findAll(Example.of(probe, matcher));
```

QBE is simple, but limited: only `AND` of equality/string matching, no ranges (`salary > x`), no `OR` across fields, no nested collections. For anything more, use Specifications.

## Custom Repository Methods

When you need hand-written code (Criteria API, `JdbcTemplate`, complex logic), add a **fragment**:

```java
public interface EmployeeRepositoryCustom {
    List<Employee> search(EmployeeSearch criteria);
}

class EmployeeRepositoryCustomImpl implements EmployeeRepositoryCustom {   // "Impl" suffix is required
    @PersistenceContext
    private EntityManager em;

    public List<Employee> search(EmployeeSearch criteria) { /* Criteria API or JPQL */ }
}

public interface EmployeeRepository
        extends JpaRepository<Employee, Long>, EmployeeRepositoryCustom { }
```

Spring finds the `Impl` class and merges it into the repository proxy.

## Auditing

Automatically record who created or changed a row, and when.

### 1. Enable It

```java
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaConfig {

    @Bean
    AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .filter(Authentication::isAuthenticated)
                .map(Authentication::getName);
    }
}
```

### 2. A Base Class

```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class Auditable {

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;
}

@Entity
public class Employee extends Auditable { … }
```

On `persist`, all four are set; on each update, `updatedAt` and `updatedBy` change. `@MappedSuperclass` shares the mapped fields without creating a table for the base class.

> [!WARNING]
> Auditing runs through **entity lifecycle callbacks**, so JPQL/native bulk updates (`@Modifying`) **don't update** these fields — set them in the query. For full change history (old and new values), use **Hibernate Envers** (`@Audited`).

## Interview Questions

### What are projections in Spring Data JPA?

Ways to return only part of an entity: interface projections (closed or open), class/record DTOs, and dynamic projections chosen by a `Class<T>` parameter. Closed projections select only the needed columns.

### Closed vs open projections?

Closed projections expose getters matching entity properties, so Spring selects only those columns. Open projections use SpEL over the whole entity, so the full entity is loaded.

### What is a Specification?

A reusable predicate built with the JPA Criteria API (`root`, `query`, `criteriaBuilder`) that can be combined with `and`/`or` at runtime. Repositories extending `JpaSpecificationExecutor` accept them, which suits dynamic search screens.

### Specifications vs Query by Example?

QBE matches a probe object's non-null fields with equality or string matching — simple but no ranges or ORs. Specifications support any predicate, joins and combinations.

### How does Spring Data auditing work?

`@EnableJpaAuditing` plus `AuditingEntityListener` fill `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy` and `@LastModifiedBy` in persist/update callbacks; the user comes from an `AuditorAware` bean.

### How do you add a custom method to a repository?

Create a fragment interface and an implementation class named with the `Impl` suffix, then extend the fragment in the repository interface.

## Key Takeaways

- ✅ Use projections (closed interfaces or records) for read-only views.
- ✅ Specifications build dynamic, composable, pageable queries; `null` = no filter.
- ✅ QBE suits simple equality searches only.
- ✅ Fragments with `Impl` classes add custom repository code.
- ✅ `@EnableJpaAuditing` + `AuditorAware` fill audit columns — not for bulk updates.
