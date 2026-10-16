---
title: Inheritance, Composite Keys & Collections
subtitle: "Mapping class hierarchies with @MappedSuperclass, SINGLE_TABLE, JOINED and TABLE_PER_CLASS, polymorphic queries, composite primary keys with @EmbeddedId and @IdClass, join entities with @MapsId, @ElementCollection and @NaturalId."
order: 13
---

## Introduction

Real domain models have hierarchies (`Payment` → `CardPayment`, `UpiPayment`), tables with multi-column keys, and simple lists of values attached to an entity. This chapter covers how JPA maps each one, and the trade-offs interviewers ask about.

> [!NOTE]
> **Interview importance:** high. "Which inheritance strategies does JPA support and when would you use each?" is a classic question, and so is "How do you map a composite key?".

## Inheritance Options at a Glance

| Option | Tables | Polymorphic queries | Best for |
| --- | --- | --- | --- |
| `@MappedSuperclass` | One per **concrete** class, no table for the base | ❌ Can't query the base type | Sharing common fields (id, audit columns) |
| `SINGLE_TABLE` (default) | **One** table for the whole hierarchy | ✅ Fastest — no joins | Few subclass-specific columns, hot polymorphic queries |
| `JOINED` | Base table + one table per subclass | ✅ Joins subclass tables | Normalised schema, many subclass fields, NOT NULL constraints |
| `TABLE_PER_CLASS` | One full table per concrete class | ⚠️ `UNION` of all tables — slow | Rarely a good choice |

## @MappedSuperclass — Shared Fields Only

```java
@MappedSuperclass
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;
}

@Entity
public class Customer extends BaseEntity {
    private String name;
}

@Entity
public class Product extends BaseEntity {
    private String sku;
}
```

`customer` and `product` each get `id` and `version` columns. `BaseEntity` isn't an entity: you can't write `SELECT b FROM BaseEntity b` or have a relationship to it. It's code reuse, not real inheritance.

## SINGLE_TABLE

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "payment_type")
public abstract class Payment {
    @Id @GeneratedValue
    private Long id;
    private BigDecimal amount;
}

@Entity
@DiscriminatorValue("CARD")
public class CardPayment extends Payment {
    private String cardLast4;
}

@Entity
@DiscriminatorValue("UPI")
public class UpiPayment extends Payment {
    private String upiId;
}
```

```sql
CREATE TABLE payment (
    id           BIGINT PRIMARY KEY,
    payment_type VARCHAR(31) NOT NULL,   -- 'CARD' or 'UPI'
    amount       DECIMAL(12,2),
    card_last4   VARCHAR(4),             -- NULL for UPI rows
    upi_id       VARCHAR(100)            -- NULL for card rows
);
```

- ✅ Polymorphic queries (`SELECT p FROM Payment p`) and loading by id need **no joins**.
- ❌ Subclass columns must be **nullable**, so the database can't enforce "card payments must have `card_last4`". Use a `CHECK` constraint or Bean Validation instead.
- ❌ With many subclasses the table gets wide and sparse.

The discriminator column defaults to `DTYPE`, and the value defaults to the entity name.

## JOINED

```java
@Entity
@Inheritance(strategy = InheritanceType.JOINED)
public abstract class Payment { … }

@Entity
@PrimaryKeyJoinColumn(name = "payment_id")
public class CardPayment extends Payment { … }
```

```sql
CREATE TABLE payment      (id BIGINT PRIMARY KEY, amount DECIMAL(12,2));
CREATE TABLE card_payment (payment_id BIGINT PRIMARY KEY REFERENCES payment(id),
                           card_last4 VARCHAR(4) NOT NULL);
CREATE TABLE upi_payment  (payment_id BIGINT PRIMARY KEY REFERENCES payment(id),
                           upi_id VARCHAR(100) NOT NULL);
```

```sql
-- SELECT p FROM Payment p  →  outer-joins every subclass table
SELECT p.*, c.card_last4, u.upi_id
FROM payment p
LEFT JOIN card_payment c ON c.payment_id = p.id
LEFT JOIN upi_payment  u ON u.payment_id = p.id;
```

- ✅ A normalised schema, and subclass columns can be `NOT NULL`.
- ❌ Every polymorphic query joins all subclass tables, and every insert writes two rows. Deep or wide hierarchies get slow.

## TABLE_PER_CLASS

Each concrete class gets a table with **all** columns, including the inherited ones. A polymorphic query becomes a `UNION ALL` across every table, and ids must be unique across those tables, so `IDENTITY` generation isn't allowed (use `SEQUENCE` or UUIDs). It's rarely the right choice. If you never query the base type, `@MappedSuperclass` gives you the same tables more simply.

## Polymorphic Queries

```java
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    @Query("SELECT p FROM Payment p WHERE TYPE(p) = CardPayment")
    List<Payment> cardPaymentsOnly();

    @Query("SELECT p FROM Payment p WHERE TREAT(p AS UpiPayment).upiId = :upi")
    List<Payment> byUpiId(@Param("upi") String upi);
}
```

`findAll()` on a `Payment` repository returns a mix of `CardPayment` and `UpiPayment` instances. A `CardPaymentRepository` returns only cards.

> [!TIP]
> **Prefer composition when in doubt.** Deep entity hierarchies are hard to change. Often a single entity with a `type` enum and an embedded value object, or a separate `@OneToOne` details entity, is simpler.

## Composite Primary Keys

Some tables are keyed by several columns, for example a `flight_seat` keyed by `(flight_no, seat_no)`, or a legacy schema. JPA gives you two ways to map this.

### @EmbeddedId — Recommended

```java
@Embeddable
public class SeatId implements Serializable {
    private String flightNo;
    private String seatNo;

    protected SeatId() { }
    public SeatId(String flightNo, String seatNo) { this.flightNo = flightNo; this.seatNo = seatNo; }

    @Override public boolean equals(Object o) {
        return o instanceof SeatId s && flightNo.equals(s.flightNo) && seatNo.equals(s.seatNo);
    }
    @Override public int hashCode() { return Objects.hash(flightNo, seatNo); }
}

@Entity
public class FlightSeat {
    @EmbeddedId
    private SeatId id;
    private boolean booked;
}

public interface FlightSeatRepository extends JpaRepository<FlightSeat, SeatId> {
    List<FlightSeat> findByIdFlightNo(String flightNo);   // navigate into the key
}
```

The key class must be `Serializable`, have a no-arg constructor, and implement `equals`/`hashCode` from **all** key fields. A Java `record` also works as an `@Embeddable` id in Hibernate 6.2+.

### @IdClass

```java
public class SeatKey implements Serializable {   // not annotated; field names must match the entity's @Id fields
    private String flightNo;
    private String seatNo;
    // no-arg constructor, equals, hashCode
}

@Entity
@IdClass(SeatKey.class)
public class FlightSeat {
    @Id private String flightNo;
    @Id private String seatNo;
}
```

| `@EmbeddedId` | `@IdClass` |
| --- | --- |
| One id field holding a key object | Several `@Id` fields on the entity, plus a matching key class |
| Queries use `e.id.flightNo` | Queries use `e.flightNo` |
| Key logic lives in one place | Field names are duplicated in two classes |

Composite keys can't be generated with `@GeneratedValue`. When the table allows it, many teams add a surrogate `id` and enforce the natural pair with a **unique constraint** instead, which keeps relationships simpler.

## Join Entities with @MapsId

A `@ManyToMany` with extra columns becomes an entity whose key combines both foreign keys:

```java
@Embeddable
public class EnrollmentId implements Serializable {
    private Long studentId;
    private Long courseId;
    // equals, hashCode
}

@Entity
public class Enrollment {
    @EmbeddedId
    private EnrollmentId id = new EnrollmentId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("studentId")
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("courseId")
    private Course course;

    private LocalDate enrolledOn;
    private String grade;
}
```

`@MapsId("studentId")` says that the `student` association supplies that part of the key, so the foreign key column and the key field are the same column.

## @ElementCollection — Lists of Values

When an entity owns simple values or embeddables that have no identity of their own:

```java
@Entity
public class Employee {
    @Id @GeneratedValue
    private Long id;

    @ElementCollection
    @CollectionTable(name = "employee_skill", joinColumns = @JoinColumn(name = "employee_id"))
    @Column(name = "skill")
    private Set<String> skills = new HashSet<>();

    @ElementCollection
    @CollectionTable(name = "employee_phone", joinColumns = @JoinColumn(name = "employee_id"))
    private List<Phone> phones = new ArrayList<>();   // Phone is an @Embeddable
}
```

- Stored in a separate table, **lazy** by default, and always saved and deleted with the owner. You can't query or reference the elements on their own.
- ⚠️ With a `List` (a bag), changing one element makes Hibernate **delete all rows and re-insert** the collection. Use a `Set`, or add `@OrderColumn`.
- If the elements need their own id, queries, or relationships, make them an **entity** with `@OneToMany` instead.

## @NaturalId — Business Keys

```java
@Entity
public class Book {
    @Id @GeneratedValue
    private Long id;

    @NaturalId
    @Column(nullable = false, unique = true)
    private String isbn;
}
```

```java
Book book = entityManager.unwrap(Session.class)
        .bySimpleNaturalId(Book.class)
        .load("978-0134685991");
```

Hibernate creates a unique constraint, makes the value immutable by default, and can resolve natural ids through its caches. The natural id is also a good basis for `equals`/`hashCode`.

## Interview Questions

### What inheritance strategies does JPA support?

`SINGLE_TABLE` (the default: one table with a discriminator column), `JOINED` (a base table plus a table per subclass, joined on the primary key) and `TABLE_PER_CLASS` (a full table per concrete class). `@MappedSuperclass` shares mapped fields without being an entity.

### SINGLE_TABLE vs JOINED?

`SINGLE_TABLE` is the fastest, with no joins, but subclass columns must be nullable. `JOINED` is normalised and allows NOT NULL subclass columns, but polymorphic queries join every subclass table and inserts touch several tables.

### @MappedSuperclass vs @Inheritance?

`@MappedSuperclass` only copies mappings into each subclass table: the base can't be queried or referenced. `@Inheritance` makes the base an entity, so polymorphic queries and associations to the base type work.

### How do you map a composite primary key?

With an `@Embeddable` key class used as an `@EmbeddedId`, or with `@IdClass` and several `@Id` fields. The key class must be `Serializable` and implement `equals` and `hashCode`.

### What does @MapsId do?

It tells Hibernate that a `@ManyToOne` or `@OneToOne` association provides the primary key, or part of a composite key, so the foreign key and the key share the same column.

### @ElementCollection vs @OneToMany?

`@ElementCollection` holds values or embeddables without identity, which live and die with the owner. `@OneToMany` relates to entities that have their own id and lifecycle and can be queried independently.

## Key Takeaways

- ✅ `@MappedSuperclass` is for shared fields; `@Inheritance` is for real polymorphism.
- ✅ `SINGLE_TABLE` is fast but nullable; `JOINED` is normalised but needs joins; avoid `TABLE_PER_CLASS`.
- ✅ Composite keys: prefer `@EmbeddedId` with careful `equals`/`hashCode`, or a surrogate id plus a unique constraint.
- ✅ Join entities with extra columns use `@MapsId`.
- ✅ `@ElementCollection` is for value lists: use a `Set` to avoid delete-and-reinsert.
