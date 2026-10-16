---
title: Advanced Hibernate Features
subtitle: "Soft deletes with @SoftDelete and @SQLRestriction, JSON columns, @Formula and @DynamicUpdate, change history with Hibernate Envers, domain events, StatelessSession for bulk jobs, multiple data sources, read-replica routing, multi-tenancy, Querydsl, and when R2DBC or plain JDBC is the better tool."
order: 16
---

## Introduction

These features solve specific production problems. You won't need all of them in every project, but you should recognise each one and know when to reach for it.

## Soft Deletes

Instead of removing rows, mark them as deleted. That keeps history, allows "undo", and protects foreign keys from breaking.

### Hibernate 6.4+: @SoftDelete

```java
@Entity
@SoftDelete   // adds a boolean 'deleted' column
public class Customer {
    @Id @GeneratedValue
    private Long id;
    private String name;
}
```

- `repository.delete(customer)` runs `UPDATE customer SET deleted = true WHERE id = ?`.
- Every query, `find` and association load automatically adds `deleted = false`.
- `@SoftDelete(strategy = SoftDeleteType.ACTIVE)` stores an `active` flag instead, and `columnName` changes the column name.

### Older Versions: @SQLDelete + @SQLRestriction

```java
@Entity
@SQLDelete(sql = "UPDATE customer SET deleted_at = now() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")   // replaced @Where in Hibernate 6.3
public class Customer {
    private Instant deletedAt;
}
```

This approach also lets you store **when** a row was deleted.

> [!WARNING]
> Soft deletes have costs:
> - Unique constraints must take the flag into account, otherwise a deleted `email` blocks re-registration. PostgreSQL supports partial indexes (`… WHERE deleted_at IS NULL`); MySQL needs a workaround.
> - Native queries **don't** get the filter automatically.
> - The tables keep growing, so archive old rows.
> - Data-protection laws (such as GDPR erasure requests) may still require a real delete.

## JSON Columns

```java
@Entity
public class Product {
    @Id @GeneratedValue
    private Long id;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> attributes;   // JSON in MySQL, jsonb in PostgreSQL

    @JdbcTypeCode(SqlTypes.JSON)
    private Dimensions dimensions;            // a POJO or record, serialized with Jackson
}
```

Hibernate 6 maps JSON natively, with no custom types needed. It's useful for flexible, rarely queried attributes. Data you filter or join on belongs in **real columns**.

## @Formula — Computed, Read-Only Values

```java
@Entity
public class Order {
    @Formula("(SELECT COUNT(*) FROM order_line l WHERE l.order_id = id)")
    private int lineCount;

    @Formula("price * quantity")
    private BigDecimal total;
}
```

The SQL fragment is added to the `SELECT` every time the entity loads. It's never written back, and it's database specific. Keep formulas cheap, because a subquery in a formula runs for every row loaded.

## @DynamicUpdate

```java
@Entity
@DynamicUpdate
public class Account { … }
```

By default Hibernate's `UPDATE` sets **every** column, which lets it reuse one cached statement. `@DynamicUpdate` generates SQL with **only the changed columns**. That helps very wide tables, and reduces conflicts when concurrent transactions change different columns. The cost is building the SQL at runtime.

## Hibernate Envers — Change History

```xml
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-envers</artifactId>
</dependency>
```

```java
@Entity
@Audited
public class Employee {
    @Id @GeneratedValue
    private Long id;
    private BigDecimal salary;

    @NotAudited
    private String lastLoginIp;
}
```

Envers writes every change to `employee_aud` together with a revision number, and stores revision metadata (id and timestamp) in `revinfo`.

```java
AuditReader reader = AuditReaderFactory.get(entityManager);
List<Number> revisions = reader.getRevisions(Employee.class, id);
Employee asOfRevision = reader.find(Employee.class, id, revisions.get(0));
```

Spring Data also provides `RevisionRepository` through the `spring-data-envers` module:

```java
public interface EmployeeRepository
        extends JpaRepository<Employee, Long>, RevisionRepository<Employee, Long, Long> { }

// @EnableJpaRepositories(repositoryFactoryBeanClass = EnversRevisionRepositoryFactoryBean.class)
Revisions<Long, Employee> history = repository.findRevisions(id);
```

To record **who** made each change, add a custom revision entity with a `RevisionListener`.

| Spring Data auditing | Envers |
| --- | --- |
| Created/modified time and user on the row itself | A full history of every version of the row |
| No extra tables | `_aud` tables and `revinfo` |

## Domain Events

```java
@Entity
public class Order extends AbstractAggregateRoot<Order> {

    public void place() {
        this.status = OrderStatus.PLACED;
        registerEvent(new OrderPlacedEvent(this.id));
    }
}
```

```java
@Component
class OrderEmailListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void on(OrderPlacedEvent event) { emailService.sendConfirmation(event.orderId()); }
}
```

Events are published when you call `repository.save(order)`. **Saving is required**: dirty checking alone doesn't publish them. Using `AFTER_COMMIT` means the email goes out only if the order was actually stored. For reliable delivery to other services, use the **transactional outbox** pattern (see the Microservices track).

## StatelessSession — Bulk Processing

```java
try (StatelessSession session = entityManagerFactory.unwrap(SessionFactory.class).openStatelessSession()) {
    Transaction tx = session.beginTransaction();
    for (Employee e : employeesToImport) {
        session.insert(e);   // straight to SQL, with nothing kept in memory
    }
    tx.commit();
}
```

A `StatelessSession` has **no persistence context**: no first-level cache, no dirty checking, no cascades and no lazy loading. Every call is an immediate SQL statement. That's ideal for imports, exports and batch jobs over millions of rows, combined with JDBC batching. Spring Batch and plain `JdbcTemplate.batchUpdate` are the other common options.

## Multiple Data Sources

When one service talks to two databases, each one gets its own `DataSource`, `EntityManagerFactory`, transaction manager and repository package:

```java
@Configuration
@EnableJpaRepositories(
        basePackages = "com.example.billing.repo",
        entityManagerFactoryRef = "billingEmf",
        transactionManagerRef = "billingTx")
class BillingDbConfig {

    @Bean
    @ConfigurationProperties("app.datasource.billing")
    DataSource billingDataSource() { return DataSourceBuilder.create().build(); }

    @Bean
    LocalContainerEntityManagerFactoryBean billingEmf(EntityManagerFactoryBuilder builder) {
        return builder.dataSource(billingDataSource())
                .packages("com.example.billing.domain")
                .persistenceUnit("billing")
                .build();
    }

    @Bean
    PlatformTransactionManager billingTx(EntityManagerFactory billingEmf) {
        return new JpaTransactionManager(billingEmf);
    }
}
```

- Mark the main database's beans `@Primary`, and name the transaction manager explicitly elsewhere: `@Transactional("billingTx")`.
- A single `@Transactional` **doesn't span both databases**. Use sagas or the outbox pattern, or (rarely) JTA/XA.

## Read-Replica Routing

Send read-only transactions to a replica:

```java
public class ReadWriteRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly() ? "replica" : "primary";
    }
}
```

```java
@Bean
@Primary
DataSource dataSource(DataSource primary, DataSource replica) {
    var routing = new ReadWriteRoutingDataSource();
    routing.setTargetDataSources(Map.of("primary", primary, "replica", replica));
    routing.setDefaultTargetDataSource(primary);
    routing.afterPropertiesSet();
    return new LazyConnectionDataSourceProxy(routing);   // delay choosing until the first statement
}
```

`@Transactional(readOnly = true)` methods then read from the replica.

> [!IMPORTANT]
> The `LazyConnectionDataSourceProxy` wrapper is essential. Without it, Spring fetches the connection **before** the read-only flag is set, so every transaction goes to the primary. Also remember **replication lag**: a user may not see their own write straight away, so read-after-write flows should stay on the primary.

## Multi-Tenancy

One application serving many customers (tenants):

| Model | Isolation | Cost |
| --- | --- | --- |
| Database per tenant | Strongest | Most expensive; many pools |
| Schema per tenant | Strong | Moderate; migrations run per schema |
| Shared tables with a `tenant_id` column | Weakest; relies on correct filtering | Cheapest; easiest to run |

For the shared-table model, Hibernate 6 provides `@TenantId`. You implement a `CurrentTenantIdentifierResolver` (usually reading the tenant from the security context), and Hibernate adds `tenant_id = ?` to every query and sets the column on insert. For per-schema or per-database models you implement a `MultiTenantConnectionProvider`.

## Querydsl and jOOQ

| Tool | Approach |
| --- | --- |
| **Specifications** (built into Spring Data) | Criteria API predicates, verbose but standard |
| **Querydsl** | Generated `QEmployee` classes and a fluent, type-safe API: `employee.salary.gt(50000).and(employee.active.isTrue())`. Repositories extend `QuerydslPredicateExecutor`. |
| **jOOQ** | Type-safe SQL generated from your database schema: full SQL power, outside JPA |

Querydsl's original project has slowed down. Check that a maintained fork (such as OpenFeign's) supports your Hibernate version before adopting it.

## When JPA Isn't the Right Tool

- **Heavy reporting, analytics and complex SQL**: `JdbcClient` / `JdbcTemplate` or jOOQ, mapped straight to DTOs.
- **Massive bulk loads**: the database's bulk loaders, `JdbcTemplate.batchUpdate` or `StatelessSession`.
- **Fully reactive stacks (WebFlux)**: JPA is **blocking**. Use **Spring Data R2DBC**, a simpler non-blocking mapper without lazy loading or a persistence context. With Java 21 virtual threads, blocking JPA in a normal Spring MVC application often scales well enough.

Most real applications mix them: JPA for the domain model and writes, and SQL for reports.

## Interview Questions

### How do you implement soft deletes in Hibernate?

Use `@SoftDelete` in Hibernate 6.4+, or `@SQLDelete` with `@SQLRestriction` in older versions. Both turn deletes into updates and filter out deleted rows. Remember unique constraints, native queries and data-erasure requirements.

### Spring Data auditing vs Hibernate Envers?

Auditing stores who created or last changed a row, and when, in that row. Envers keeps every historical version in `_aud` tables with revision numbers, so you can see a row as it was at any revision.

### What is a StatelessSession?

A Hibernate session without a persistence context: no caching, dirty checking, cascades or lazy loading. Each operation runs SQL immediately. It's ideal for bulk jobs.

### How do you configure two databases in Spring Boot?

Give each database its own `DataSource`, `EntityManagerFactory`, transaction manager and `@EnableJpaRepositories` package, with one set marked `@Primary`. A local transaction can't span both.

### How do you route reads to a replica?

Use an `AbstractRoutingDataSource` that chooses the replica when the current transaction is read-only, wrapped in a `LazyConnectionDataSourceProxy` so the choice happens after the transaction starts. Keep read-after-write flows on the primary.

### Can you use JPA with Spring WebFlux?

JPA is blocking, so it would tie up event-loop threads. Use Spring Data R2DBC for reactive access, or offload JPA calls to a bounded scheduler, or use Spring MVC with virtual threads instead.

## Key Takeaways

- ✅ Soft deletes: use `@SoftDelete` (6.4+), and plan unique constraints and native queries around it.
- ✅ Hibernate 6 maps JSON natively. `@Formula` computes read-only values; `@DynamicUpdate` writes only the changed columns.
- ✅ Envers keeps full history; domain events plus `AFTER_COMMIT` listeners react to saved changes.
- ✅ `StatelessSession` suits bulk jobs. Multiple databases need separate factories and transaction managers.
- ✅ Replica routing needs `LazyConnectionDataSourceProxy`.
- ✅ Use plain SQL tools or R2DBC where JPA doesn't fit.
