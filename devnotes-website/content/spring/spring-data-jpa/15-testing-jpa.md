---
title: Testing the Data Layer
subtitle: "What to test in a JPA application, @DataJpaTest and TestEntityManager, why H2 can mislead you, Testcontainers with @ServiceConnection, flushing to catch constraint errors, the false confidence of transactional tests, asserting query counts to catch N+1, and test data strategies."
order: 15
---

## Introduction

Repository code looks trivial, but many JPA bugs only appear against a real database: wrong mappings, broken JPQL, missing constraints, N+1 queries and lazy-loading failures. Data-layer tests catch them before production does.

## What to Test

| Test | Worth it? |
| --- | --- |
| Built-in methods (`save`, `findById`) | ❌ Spring Data already tests these |
| Derived queries with non-obvious keywords | ✅ Quick to write, and they catch naming mistakes |
| `@Query` JPQL and native SQL | ✅ Always |
| Mappings: relationships, cascades, converters, enums, embeddables | ✅ |
| Constraints: unique, not null, foreign keys | ✅ |
| Fetch plans: N+1 and `LazyInitializationException` | ✅ For important endpoints |
| Optimistic locking and transaction behaviour | ✅ For critical flows |

## @DataJpaTest

```java
@DataJpaTest
class EmployeeRepositoryTest {

    @Autowired EmployeeRepository repository;
    @Autowired TestEntityManager em;

    @Test
    void findsActiveEmployeesInDepartment() {
        Department it = em.persist(new Department("IT"));
        em.persist(new Employee("Asha", it, true));
        em.persist(new Employee("Ravi", it, false));
        em.flush();
        em.clear();   // so the query really hits the database

        List<Employee> result = repository.findByDepartmentNameAndActiveTrue("IT");

        assertThat(result).extracting(Employee::getName).containsExactly("Asha");
    }
}
```

`@DataJpaTest` is a **test slice**:

- It starts only the JPA components: entities, repositories, the `DataSource`, Flyway or Liquibase, and `TestEntityManager`. Services and controllers aren't loaded.
- Each test is **`@Transactional` and rolled back** at the end, so tests don't affect each other.
- By default it **replaces your DataSource with an embedded in-memory database** (H2, HSQLDB or Derby) if one is on the classpath.
- SQL logging is turned on.

`TestEntityManager` is a thin wrapper around `EntityManager` for test setup: `persist`, `persistAndFlush`, `find`, `flush` and `clear`.

## Why H2 Can Mislead You

H2 isn't MySQL or PostgreSQL. Even in compatibility mode it differs in:

- native SQL syntax and functions (`DATE_FORMAT`, `jsonb`, window functions, `ON CONFLICT`);
- data types, case sensitivity and collations;
- locking and isolation behaviour;
- sequences, identity columns and DDL details.

Tests can pass on H2 and fail in production, or the other way round. Your Flyway scripts also have to work on both.

> [!TIP]
> Test against the **same database engine and version** you run in production, using Testcontainers.

## Testcontainers

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>mysql</artifactId>
    <scope>test</scope>
</dependency>
```

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)   // keep the real DataSource
@Testcontainers
class EmployeeRepositoryIT {

    @Container
    @ServiceConnection   // Spring Boot 3.1+: sets the datasource URL, username and password automatically
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");

    @Autowired EmployeeRepository repository;

    @Test
    void runsAgainstRealMySql() { … }
}
```

- A real MySQL starts in Docker, and your **Flyway migrations run against it**, which tests them too.
- `static` containers start once per test class. To share one across classes, put it in a base class or a `@TestConfiguration`.
- Without `@ServiceConnection` (older Boot versions), register the properties yourself with `@DynamicPropertySource`.

## Flush to Find Constraint Errors

```java
@Test
void rejectsDuplicateEmail() {
    repository.save(new Employee("Asha", "asha@x.com"));
    repository.save(new Employee("Asha 2", "asha@x.com"));

    assertThatThrownBy(() -> repository.flush())
            .isInstanceOf(DataIntegrityViolationException.class);
}
```

Inside a transactional test, SQL may never be sent: the transaction rolls back before any flush. Without `flush()`, this test would **pass even if the unique constraint were missing**. Flush whenever you test constraints, inserts or the SQL itself.

## The False Confidence of Transactional Tests

Because the whole test runs in one transaction with one persistence context:

- **Lazy loading always works**, so a `LazyInitializationException` that happens in production won't happen in the test.
- **Reads can come from the first-level cache** instead of the database, unless you call `em.clear()`.
- **The production commit path doesn't run**: `@TransactionalEventListener(AFTER_COMMIT)` listeners never fire, and deferred constraints are never checked.

For service-level tests that should behave like production, use `@SpringBootTest` **without** `@Transactional` on the test, and clean up explicitly. You can truncate tables, use `@Sql` scripts, or start a fresh container.

```java
@SpringBootTest
@Sql(scripts = "/cleanup.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class OrderServiceIT {
    @Test
    void returnsOrderDtoWithoutLazyErrors() {
        OrderDto dto = orderService.getOrder(orderId);   // its own transaction, like production
        assertThat(dto.lines()).hasSize(3);
    }
}
```

## Catching N+1 in Tests

Count the statements Hibernate runs:

```java
@Autowired EntityManagerFactory emf;

@Test
void listOrdersUsesTwoQueriesAtMost() {
    Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    stats.clear();

    orderService.listOrders(PageRequest.of(0, 50));

    assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(2);
}
```

Libraries such as **datasource-proxy** or **Hypersistence Utils** (`SQLStatementCountValidator`) make this neater. A test like this fails the build if someone later adds an N+1 to the endpoint.

## Testing Optimistic Locking

```java
@Test
void secondStaleUpdateFails() {
    Long id = productRepository.save(new Product("Pen", 10)).getId();

    Product first = productRepository.findById(id).orElseThrow();    // version 0
    Product second = productRepository.findById(id).orElseThrow();   // version 0

    first.setStock(9);
    productRepository.saveAndFlush(first);                           // version becomes 1

    second.setStock(8);
    assertThatThrownBy(() -> productRepository.saveAndFlush(second))
            .isInstanceOf(ObjectOptimisticLockingFailureException.class);
}
```

Run this **without** a surrounding test transaction (plain `@SpringBootTest`, or `@Transactional(propagation = NOT_SUPPORTED)` on the test). Otherwise both `findById` calls return the **same managed instance** from the first-level cache, and no conflict ever happens.

## Test Data Strategies

| Approach | Good for |
| --- | --- |
| Build entities in the test (`em.persist`, builders, factories) | Most tests: the data is visible right next to the assertions |
| `@Sql("/data/orders.sql")` | Complex or shared fixtures, data that must match a native query |
| Flyway test migrations (`db/testdata`) | Reference data that every test needs |

Keep each test's data small and specific. Shared fixtures that every test edits become brittle.

## Interview Questions

### What does @DataJpaTest do?

It starts only the JPA slice (repositories, entities, the DataSource and migrations), wraps each test in a transaction that rolls back, and by default replaces the DataSource with an in-memory database.

### Why prefer Testcontainers over H2?

H2 differs from the production database in SQL dialect, functions, types and locking, so tests can pass or fail for the wrong reasons. Testcontainers runs the real engine and version in Docker and exercises the real migrations.

### Why call flush() in repository tests?

Hibernate defers SQL until flush, and transactional tests roll back before committing. Flushing forces the SQL to run, so constraint violations and SQL errors surface in the test.

### Why can transactional tests hide LazyInitializationException?

The persistence context stays open for the whole test, so lazy associations always load. In production the transaction has ended by then. Test such flows without a test-level transaction.

### How can you detect N+1 queries automatically?

Count statements in tests using Hibernate `Statistics`, datasource-proxy or Hypersistence Utils, and assert a maximum for important use cases.

## Key Takeaways

- ✅ Test custom queries, mappings, constraints and fetch plans, not Spring Data's built-in methods.
- ✅ `@DataJpaTest` is a fast slice; pair it with Testcontainers and `Replace.NONE`.
- ✅ Flush (and clear) so SQL really runs and reads really hit the database.
- ✅ Transactional tests hide lazy-loading and commit-time bugs. Test critical flows without them.
- ✅ Assert query counts to stop N+1 regressions.
