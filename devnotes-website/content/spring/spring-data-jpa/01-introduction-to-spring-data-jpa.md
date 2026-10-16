---
title: Introduction to Spring Data JPA
subtitle: From JDBC and Hibernate to Spring Data JPA, the layers involved, setup and configuration, a first entity and repository, CRUD methods, how save() decides between persist and merge, and the repository interface hierarchy.
order: 1
---

## Why Spring Data JPA?

Before Spring Data JPA, we used Hibernate directly:

```java
Session session = sessionFactory.openSession();
Employee emp = session.get(Employee.class, 1);
session.close();
```

Or the standard JPA API:

```java
EntityManager em = entityManagerFactory.createEntityManager();
Employee emp = em.find(Employee.class, 1);
```

Lots of boilerplate. Spring Data JPA reduces this to:

```java
employeeRepository.findById(1);
```

No implementation class, no SQL, no `EntityManager`, no `Session` — the repository implementation is generated automatically.

## The Evolution

```flow-h
JDBC — SQL and ResultSets by hand
Hibernate — an ORM maps objects to tables
JPA — the standard ORM API (Jakarta Persistence)
Spring Data JPA — repositories generated on top of JPA
```

| Layer | Role |
| --- | --- |
| **JDBC** | Low-level API to send SQL and read rows |
| **Hibernate** | An ORM (object-relational mapper) — the most popular **JPA implementation**; generates and runs SQL |
| **JPA** | A specification (`jakarta.persistence.*`): `@Entity`, `EntityManager`, JPQL |
| **Spring Data JPA** | A Spring layer that generates repository implementations on top of JPA |

## What Spring Data JPA Provides

CRUD operations · pagination and sorting · derived query methods · JPQL and native queries · projections · Specifications and dynamic queries · auditing · locking · entity graphs · transaction integration.

## Architecture

```flow
Controller
Service — business logic and @Transactional
Repository — Spring Data JPA interface
Hibernate — JPA provider; generates SQL
JDBC
Database
```

## Setup

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/company
spring.datasource.username=root
spring.datasource.password=root

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
```

> [!WARNING]
> `ddl-auto=update` (or `create`) is for **local development only**. In production use `validate` or `none`, and manage schema changes with migration tools like **Flyway** or **Liquibase** — `update` can't drop or rename columns safely and gives you no history. Likewise, keep `show-sql` off in production (use a logger such as `org.hibernate.SQL=DEBUG` when needed).

## A First Entity

```java
@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String name;
    private String department;
    private BigDecimal salary;      // use BigDecimal for money, not double

    protected Employee() { }        // JPA requires a no-arg constructor

    // constructors, getters and setters
}
```

Entity mapping is covered in detail in *Entity Mapping Essentials*.

## A Repository

```java
public interface EmployeeRepository extends JpaRepository<Employee, Integer> {
}
```

No implementation — Spring creates one at startup (a proxy backed by `SimpleJpaRepository`). The `@Repository` annotation isn't needed on Spring Data interfaces; Spring Boot detects them automatically.

## A Service

```java
@Service
public class EmployeeService {

    private final EmployeeRepository repository;

    public EmployeeService(EmployeeRepository repository) {   // constructor injection
        this.repository = repository;
    }
}
```

## CRUD Operations

| Operation | Method |
| --- | --- |
| Insert / update | `repository.save(employee)` |
| Insert / update many | `repository.saveAll(list)` |
| Find one | `repository.findById(id)` → `Optional<Employee>` |
| Find all | `repository.findAll()` |
| Count | `repository.count()` |
| Exists | `repository.existsById(id)` |
| Delete | `repository.delete(employee)` / `deleteById(id)` |

## How save() Works

`save()` is implemented in `SimpleJpaRepository`:

```java
if (entityInformation.isNew(entity)) {
    entityManager.persist(entity);   // INSERT
    return entity;
} else {
    return entityManager.merge(entity);   // copy state onto a managed instance → UPDATE if changed
}
```

```flow
repository.save(entity)
? Is the entity new — null id, or null @Version? | Yes: EntityManager.persist — INSERT | No: EntityManager.merge — SELECT if needed, then UPDATE
```

| Situation | Result |
| --- | --- |
| `new Employee()` with a `null` id | `persist` → `INSERT` |
| An entity loaded by `findById`, then modified | `merge` → `UPDATE` |
| A detached entity with an id (e.g. built from a request DTO) | `merge` → `SELECT` to load it, then `UPDATE` |

> [!NOTE]
> "New" means the **id is null** (for wrapper types like `Integer`/`Long`) — or, if the entity has a `@Version` field, that the version is null. With a **primitive** `int` id, Spring can't tell, so prefer wrapper types for ids.

### You Often Don't Need save() for Updates

Inside a transaction, loaded entities are **managed**; Hibernate detects changes (*dirty checking*) and writes them on commit:

```java
@Transactional
public void raiseSalary(int id, BigDecimal amount) {
    Employee e = repository.findById(id).orElseThrow();
    e.setSalary(e.getSalary().add(amount));
    // no save() needed — UPDATE is issued automatically at commit
}
```

See *Persistence Context & Entity Lifecycle*.

## The Repository Hierarchy

```tree
Repository | marker interface
  CrudRepository | save, findById, findAll, delete, count, existsById
    ListCrudRepository | same methods, returning List
  PagingAndSortingRepository | findAll(Sort), findAll(Pageable)
    ListPagingAndSortingRepository
  JpaRepository | extends both List variants + JPA-specific methods
```

`JpaRepository` adds `flush()`, `saveAndFlush()`, `saveAllAndFlush()`, `deleteAllInBatch()`, `getReferenceById()` and `findAll(Example)`.

> [!NOTE]
> Since **Spring Data 3**, `PagingAndSortingRepository` no longer extends `CrudRepository`, and the `List…` variants were added. `JpaRepository` still includes everything, which is why most applications simply extend it. The old `deleteInBatch()` and `getOne()` methods are deprecated in favour of `deleteAllInBatch()` and `getReferenceById()`.

## save() vs saveAndFlush()

| `save()` | `saveAndFlush()` |
| --- | --- |
| Persists or merges the entity; SQL may be deferred until flush or commit | Persists and **immediately flushes** to the database |
| Better performance — Hibernate can batch statements | Useful when later code (a native query, a trigger, a constraint check) needs the SQL to have run |

Either way, nothing is **committed** until the transaction commits.

## Behind the Scenes

```java
repository.findById(5);
```

```output Generated SQL (Hibernate lists the mapped columns)
select e1_0.id, e1_0.department, e1_0.name, e1_0.salary
from employees e1_0
where e1_0.id=?
```

```flow-h
findById
SimpleJpaRepository
EntityManager
Hibernate
JDBC
Database
```

## Interview Questions

### Why use Spring Data JPA?

It removes boilerplate by generating repository implementations, and provides CRUD, pagination, sorting, query derivation, projections and auditing on top of a JPA provider such as Hibernate.

### What's the difference between Hibernate and Spring Data JPA?

Hibernate is an ORM and the JPA implementation that maps entities and executes SQL. Spring Data JPA is a framework on top of JPA that generates repositories and reduces data-access code.

### Does Spring Data JPA replace Hibernate?

No. Spring Data JPA delegates to the JPA provider — by default Hibernate — which still generates and executes the SQL.

### What is JpaRepository?

The most complete Spring Data JPA repository interface: CRUD, paging and sorting (via the `ListCrudRepository` and `ListPagingAndSortingRepository` interfaces), plus JPA-specific operations such as flushing, batch deletes and `getReferenceById`.

### Do you need to implement repository interfaces?

No. Spring creates proxy implementations at startup.

### How does save() know whether to insert or update?

It checks whether the entity is new — a null id, or a null `@Version` — and calls `persist` (insert) for new entities and `merge` (update) otherwise.

### save() vs saveAndFlush()?

`save()` may defer the SQL until flush or commit; `saveAndFlush()` executes it immediately. Neither commits the transaction by itself.

## Best Practices

- ✅ Extend `JpaRepository` unless you have a reason to expose fewer methods.
- ✅ Keep business logic and `@Transactional` in the service layer.
- ✅ Use constructor injection.
- ✅ Use projections or DTOs instead of loading full entities you don't need.
- ✅ Use pagination instead of `findAll()` on large tables.
- ✅ Use Flyway/Liquibase and `ddl-auto=validate` in production.

## Key Takeaways

- ✅ Spring Data JPA generates repositories on top of JPA; Hibernate still does the ORM work.
- ✅ `save()` persists new entities and merges existing ones; managed entities update automatically on commit.
- ✅ `JpaRepository` combines CRUD, paging/sorting and JPA-specific methods.
- ✅ `ddl-auto=update` and `show-sql` are for development only.
