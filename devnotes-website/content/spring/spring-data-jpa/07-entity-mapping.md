---
title: Entity Mapping Essentials
subtitle: What makes a class an entity, @Table and @Column, primary keys and generation strategies (IDENTITY, SEQUENCE, UUID), enums with EnumType.STRING, dates, BigDecimal for money, @Transient, @Lob, embeddables, naming strategies and schema validation.
order: 7
---

## Introduction

Before relationships, fetching and transactions, every JPA developer needs to map a single class to a table correctly. Most production bugs in this area come from a few choices: the id strategy, enum storage, money types and schema management.

## What Makes a Class an Entity

```java
@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    protected Employee() { }   // required by JPA

    public Employee(String name) { this.name = name; }
}
```

An entity class must:

- be annotated with `@Entity` and have an `@Id`;
- have a **no-arg constructor** (`public` or `protected`) — Hibernate instantiates it by reflection;
- not be `final`, and not have `final` persistent fields or methods — Hibernate creates **proxy subclasses** for lazy loading;
- be a top-level class (records **can't** be entities — they're final and immutable, though they're great as projections and embeddables in Hibernate 6.2+).

Every non-`static`, non-`@Transient` field is persistent by default.

## @Table and @Column

```java
@Entity
@Table(name = "employees",
       uniqueConstraints = @UniqueConstraint(name = "uk_employee_email", columnNames = "email"),
       indexes = @Index(name = "idx_employee_department", columnList = "department"))
public class Employee {

    @Column(name = "full_name", nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(precision = 12, scale = 2)
    private BigDecimal salary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
```

| Attribute | Meaning |
| --- | --- |
| `name` | Column name |
| `nullable`, `length`, `precision`, `scale`, `unique` | Used for **DDL generation** (and `nullable` hints) |
| `insertable`, `updatable` | Leave the column out of `INSERT` / `UPDATE` statements |
| `columnDefinition` | Raw DDL fragment — database specific, avoid if possible |

> [!NOTE]
> `nullable = false` and `length` don't validate anything at runtime by themselves — they shape the generated schema. Use **Bean Validation** (`@NotNull`, `@Size`) for application-level checks, and real database constraints for guarantees.

## Primary Keys and Generation Strategies

| Strategy | How it works | Notes |
| --- | --- | --- |
| `IDENTITY` | Auto-increment column (MySQL `AUTO_INCREMENT`, PostgreSQL `IDENTITY`) | Hibernate must `INSERT` immediately on `persist` to learn the id → **disables JDBC insert batching** |
| `SEQUENCE` | A database sequence (`nextval`) | Best for PostgreSQL/Oracle; supports batching; `allocationSize` pre-allocates ids |
| `TABLE` | A table simulating a sequence | Slow, rarely used |
| `AUTO` (default) | Provider picks | Hibernate 6 picks `SEQUENCE` (and on MySQL emulates it with a table) — be explicit |
| `UUID` | `@GeneratedValue(strategy = GenerationType.UUID)` (JPA 3.1) | Generated in Java; no database round trip |

```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "employee_seq")
@SequenceGenerator(name = "employee_seq", sequenceName = "employee_seq", allocationSize = 50)
private Long id;
```

With `allocationSize = 50`, Hibernate fetches one sequence value and assigns the next 50 ids in memory — far fewer round trips. The database sequence must increment by the same amount.

> [!TIP]
> **Which to choose?** MySQL: `IDENTITY` is the norm (MySQL has no sequences). PostgreSQL/Oracle: `SEQUENCE` with an `allocationSize`. Distributed systems or ids created before saving: UUIDs — preferably time-ordered (UUIDv7), because random UUIDv4 primary keys fragment B-tree indexes.

Use **wrapper types** (`Long`, `Integer`) for ids so a new entity has `null` — that's how `save()` knows to `persist`.

## Enums — Always STRING

```java
public enum Status { ACTIVE, ON_LEAVE, TERMINATED }

@Enumerated(EnumType.STRING)
@Column(length = 20)
private Status status;
```

> [!WARNING]
> The default is `EnumType.ORDINAL` — storing `0, 1, 2`. Insert a new constant in the middle (or reorder them) and **every existing row silently changes meaning**. Always use `EnumType.STRING`; for custom codes, use an `AttributeConverter`.

## Dates and Times

```java
private LocalDate joiningDate;        // DATE
private LocalDateTime updatedAt;      // TIMESTAMP (no time zone)
private Instant createdAt;            // TIMESTAMP — an absolute moment
private OffsetDateTime scheduledFor;  // TIMESTAMP WITH TIME ZONE where supported
```

`java.time` types are supported directly — no `@Temporal` needed (that's only for legacy `java.util.Date`/`Calendar`). Store moments as `Instant` (UTC) and set `spring.jpa.properties.hibernate.jdbc.time_zone=UTC` for predictable behaviour.

## Money — BigDecimal

```java
@Column(precision = 12, scale = 2, nullable = false)
private BigDecimal amount;
```

`double` and `float` can't represent most decimal fractions exactly (`0.1 + 0.2 = 0.30000000000000004`). Use `BigDecimal` mapped to `DECIMAL`/`NUMERIC`, and compare with `compareTo`, not `equals` (`2.0` and `2.00` aren't `equals`).

## @Transient, @Lob and Converters

```java
@Transient
private int age;          // computed, not stored

@Lob
private String biography; // large text (CLOB/TEXT)

@Convert(converter = YesNoConverter.class)
private Boolean remote;   // stored as 'Y' / 'N'
```

```java
@Converter
public class YesNoConverter implements AttributeConverter<Boolean, String> {
    public String convertToDatabaseColumn(Boolean value) { return value == null ? null : value ? "Y" : "N"; }
    public Boolean convertToEntityAttribute(String db) { return db == null ? null : db.equals("Y"); }
}
```

Use the `jakarta.persistence.Transient` annotation — not the `transient` keyword, which also affects Java serialization.

## Embeddables — Value Objects

```java
@Embeddable
public class Address {
    private String street;
    private String city;
    private String zip;
}

@Entity
public class Customer {
    @Id @GeneratedValue
    private Long id;

    @Embedded
    private Address homeAddress;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "street", column = @Column(name = "work_street")),
        @AttributeOverride(name = "city",   column = @Column(name = "work_city")),
        @AttributeOverride(name = "zip",    column = @Column(name = "work_zip"))
    })
    private Address workAddress;
}
```

The columns live in the `customer` table — an embeddable has **no identity or table of its own**. Great for `Money`, `Address`, `DateRange`.

## Naming Strategy

Spring Boot's default naming strategy maps `camelCase` fields to `snake_case` columns: `joiningDate` → `joining_date`, `EmployeeProfile` → `employee_profile`. That's why you rarely need `@Column(name = …)`.

## Schema Management

| `spring.jpa.hibernate.ddl-auto` | Use |
| --- | --- |
| `create-drop` | Tests — create on start, drop on shutdown |
| `create` | Throwaway local databases |
| `update` | Local development only — never production |
| `validate` | **Production** — check that entities match the schema, fail on mismatch |
| `none` | Production when another tool fully owns the schema |

Use **Flyway** or **Liquibase** migrations as the source of truth for the schema, with `ddl-auto=validate`.

## Interview Questions

### Why does an entity need a no-arg constructor?

Hibernate creates instances by reflection when loading rows (and for proxies), then sets fields. The constructor can be `protected` to keep it out of your API.

### IDENTITY vs SEQUENCE?

`IDENTITY` uses an auto-increment column, so Hibernate must insert immediately to get the id, which prevents insert batching. `SEQUENCE` fetches ids from a sequence (in blocks with `allocationSize`), allowing batching. Use `IDENTITY` on MySQL and `SEQUENCE` on PostgreSQL/Oracle.

### Why EnumType.STRING instead of ORDINAL?

`ORDINAL` stores the constant's position; adding or reordering constants silently corrupts existing data. `STRING` stores the name and is safe to extend.

### Why BigDecimal for money?

Binary floating-point types can't represent decimal fractions exactly, causing rounding errors. `BigDecimal` with `DECIMAL(p, s)` is exact.

### Can a Java record be a JPA entity?

No — entities need a no-arg constructor, mutable state and non-final classes for proxies. Records work well as DTO projections and (in Hibernate 6.2+) embeddables.

### What does ddl-auto=validate do?

At startup Hibernate checks that tables and columns for the entities exist with compatible types and fails if they don't — it never changes the schema.

## Key Takeaways

- ✅ Entities need `@Entity`, `@Id`, a no-arg constructor and non-final classes.
- ✅ Choose the id strategy deliberately; `IDENTITY` disables insert batching.
- ✅ Always map enums with `EnumType.STRING`, money with `BigDecimal`.
- ✅ Use `java.time` types and embeddables for value objects.
- ✅ Production: Flyway/Liquibase + `ddl-auto=validate`.
