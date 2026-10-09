---
title: "@Repository"
subtitle: The data access layer — why @Repository is more than @Component, persistence exception translation, Spring Data JPA proxies, query methods, @Query and CrudRepository vs JpaRepository.
order: 4
---

## Introduction

So far we've seen the controller layer (HTTP requests) and the service layer (business logic). Now let's move to the **database layer** — where most enterprise applications spend a significant amount of time.

> [!QUESTION] If @Repository is also a @Component, why do we need another annotation?
> One of the most common interview questions. Let's answer it from the ground up.

## What is @Repository?

`@Repository` marks a class as the **Data Access Layer (DAO)**. Its responsibility is to:

- Read data
- Insert data
- Update data
- Delete data
- Execute SQL / JPQL / Criteria queries
- Interact with Hibernate / JPA

```java
@Repository
public class UserRepository {

    public User findById(Long id) {
        ...
    }
}
```

Spring registers it as a bean **and** provides additional database-specific behaviour.

## What is the Data Access Layer?

When a user logs into an application:

```flow-h Only the repository should communicate with the database
Browser
Controller
Service
Repository
Database
```

### Responsibilities of a Repository

A repository should only perform **persistence operations** — `save(user)`, `findById(id)`, `delete(user)`, `findAll()`. Not business logic.

### Real Enterprise Example

An online banking system: `TransferController` → `TransferService` → `AccountRepository` → Oracle database.

```java
@Repository
public class AccountRepository {

    public Account findByAccountNo(String account) {
    }

    public void updateBalance() {
    }
}
```

Business decisions remain in the service layer.

## Internal Working

```flow
Component scan
Found @Repository
@Repository is a @Component
BeanDefinition
Bean created
ApplicationContext
```

Just like `@Service`. Conceptually:

```java
@Component
public @interface Repository {
}
```

So Spring discovers it during component scanning.

## Then Why Use @Repository? — Exception Translation

Because Spring gives it special database behaviour. The biggest one is **exception translation** — a favourite interview topic.

### The Problem Without Exception Translation

Hibernate might throw `org.hibernate.exception.ConstraintViolationException`, JDBC might throw `SQLIntegrityConstraintViolationException` or `SQLException`, and every database vendor reports errors differently:

| Database | Duplicate-key error |
| --- | --- |
| Oracle | `ORA-00001` |
| MySQL | `Duplicate entry...` |
| PostgreSQL | `ERROR: duplicate key value...` |

Handling vendor-specific exceptions throughout your application would make your code hard to maintain.

### The Spring Solution

Spring converts vendor-specific exceptions into a **common hierarchy**. Instead of `SQLException`, you receive a **`DataAccessException`** (e.g. `DataIntegrityViolationException`).

```flow
SQLException / Hibernate exception
: @Repository proxy translates
Spring DataAccessException
```

Instead of catching:

```java
catch (SQLException e) {
}
```

you catch:

```java
catch (DataAccessException e) {
}
```

Your code now works regardless of whether the database is Oracle, MySQL, PostgreSQL or SQL Server.

### Exception Translation Internals

During startup Spring registers **`PersistenceExceptionTranslationPostProcessor`**. This `BeanPostProcessor` does:

```flow This is the extra functionality @Repository provides beyond @Component
Repository bean
Create proxy
Intercept exception
Translate exception
Throw DataAccessException
```

## Spring Data JPA Repositories

Nowadays we rarely write repositories manually:

```java
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
}
```

Notice: **no implementation, no SQL, no object creation.** Spring generates the implementation automatically at runtime.

```flow-h You never see the implementation — Spring creates it
UserRepository interface
Spring Data JPA
Dynamic proxy
SimpleJpaRepository behind it
Bean registered
```

> [!NOTE]
> For Spring Data interfaces, the `@Repository` annotation is **optional** — Spring Data finds interfaces extending `Repository` by itself and still applies exception translation. Many teams add it anyway for readability.

### What Happens When You Call save()?

```java
userRepository.save(user);
```

```flow A single line travels through multiple layers before executing SQL
Controller
Service
Repository proxy
SimpleJpaRepository
EntityManager
Hibernate
JDBC
Database
```

### Repository vs EntityManager

Without Spring Data:

```java
@Repository
public class UserRepository {

    @PersistenceContext
    EntityManager entityManager;
}

entityManager.persist(user);            // insert
entityManager.find(User.class, id);     // find
```

With Spring Data, simply `userRepository.save(user)`. Much cleaner.

### Built-In CRUD Operations

`JpaRepository` already provides `save()`, `findById()`, `findAll()`, `delete()`, `count()` and `existsById()`. No need to implement them yourself.

## Derived Query Methods

Spring can generate queries **from method names**:

| Method | Generated SQL (similar to) |
| --- | --- |
| `findByEmail(String email)` | `SELECT * FROM users WHERE email = ?` |
| `findByAgeGreaterThan(int age)` | `SELECT * FROM users WHERE age > ?` |
| `findByFirstNameAndLastName(String first, String last)` | `SELECT * FROM users WHERE first_name = ? AND last_name = ?` |

No SQL required.

## Custom Queries

Sometimes method names become too long. Use `@Query`:

```java
@Query("""
        SELECT u
        FROM User u
        WHERE u.salary > :salary
        """)
List<User> getHighSalaryEmployees(@Param("salary") double salary);
```

Now Spring executes **JPQL**. (The `"""` text block needs Java 15+; otherwise use a normal string.)

## Repository Should NOT Contain Business Logic

❌ Wrong:

```java
@Repository
public class EmployeeRepository {

    public double calculateBonus() {
    }
}
```

Bonus calculation is business logic — move it to `@Service public class EmployeeService`.

## One Repository, Many Services

```tree One repository can be reused by many services
UserRepository
  OrderService
  AdminService
  NotificationService
```

Like every stereotype bean, `@Repository` creates a **singleton** by default — every service receives the same repository bean.

## Common Mistakes

### Writing Business Logic

```java
@Repository
public class ProductRepository {

    public double calculateTax() {   // ❌ belongs in a service
    }
}
```

### Injecting a Repository into a Controller

```java
@RestController
public class UserController {

    @Autowired
    UserRepository repository;   // ❌
}
```

Correct: **Controller → Service → Repository.** Controllers should depend on services, not repositories.

### Catching SQLException Everywhere

Prefer Spring's exception hierarchy: `catch (DataAccessException e)`.

## Repository Flow in Spring Boot

```flow Understanding this flow is valuable for debugging and interviews
HTTP request
Controller
Service
Repository
JpaRepository proxy
EntityManager
Hibernate
JDBC driver
Database
Response
```

## Interview Questions

### Q1. What is @Repository?

A stereotype annotation that marks a class as part of the persistence layer. It registers the class as a Spring bean and enables automatic translation of persistence exceptions into Spring's `DataAccessException` hierarchy.

### Q2. Is @Repository different from @Component?

Yes. Both register beans, but `@Repository` also enables persistence exception translation, making database-specific exceptions easier to handle consistently.

### Q3. Why is exception translation useful?

Different databases throw different exceptions. Spring converts them into a common set of exceptions, allowing the application to remain database-independent.

### Q4. Why don't we implement JpaRepository methods?

Spring Data JPA generates the implementation dynamically at runtime using proxies (backed by `SimpleJpaRepository`).

### Q5. What is the difference between CrudRepository and JpaRepository?

| Feature | CrudRepository | JpaRepository |
| --- | --- | --- |
| CRUD operations | ✓ | ✓ |
| Pagination | ✗ | ✓ |
| Sorting | ✗ | ✓ |
| Batch operations (`deleteAllInBatch`, `saveAllAndFlush`) | ✗ | ✓ |
| JPA-specific features (`flush`, `getReferenceById`) | ✗ | ✓ |

`JpaRepository` builds on `CrudRepository` and `PagingAndSortingRepository`, adding more capabilities. (Since Spring Data 3.0, `PagingAndSortingRepository` no longer extends `CrudRepository` itself; `JpaRepository` extends both lines, plus the `List…` variants that return `List` instead of `Iterable`.)

### Q6. Can one repository be used by multiple services?

Yes. Repositories are singleton beans and are commonly shared across multiple services.

### Q7. Should repositories contain business logic?

No. Repositories should only perform data access operations. Business rules belong in the service layer.

## Key Takeaways

- ✅ `@Repository` represents the persistence layer.
- ✅ It is a specialized stereotype built on top of `@Component`.
- ✅ It provides automatic persistence exception translation.
- ✅ Spring Data JPA generates repository implementations at runtime.
- ✅ Repositories should focus exclusively on database interactions.
- ✅ Controllers talk to services; services talk to repositories.
