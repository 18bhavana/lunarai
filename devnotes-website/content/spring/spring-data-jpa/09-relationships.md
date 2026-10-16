---
title: Relationships & Cascading
subtitle: "@ManyToOne, @OneToMany, @OneToOne and @ManyToMany, the owning side and mappedBy, join columns and join tables, bidirectional helper methods, cascade types, orphanRemoval, default fetch types, equals/hashCode for entities and JSON recursion."
order: 9
---

## Introduction

Relationships are where JPA gets powerful — and where most mapping bugs live. The key ideas: **which side owns the foreign key**, **what cascades**, and **what loads when**.

> [!NOTE]
> **Interview importance:** very high. Expect questions on `mappedBy`, owning side, cascade vs orphanRemoval, and why `@ManyToMany` with `List` or `CascadeType.ALL` is risky.

## The Four Relationship Types

| Annotation | Example | Foreign key lives in | Default fetch |
| --- | --- | --- | --- |
| `@ManyToOne` | Many employees → one department | The "many" table (`employees.department_id`) | **EAGER** |
| `@OneToMany` | One department → many employees | The other side's table | LAZY |
| `@OneToOne` | One user → one profile | Either table | **EAGER** |
| `@ManyToMany` | Students ↔ courses | A **join table** | LAZY |

> [!WARNING]
> `@ManyToOne` and `@OneToOne` default to **EAGER**. Always write `fetch = FetchType.LAZY` on them — EAGER associations load on every query and are a common N+1 source.

## @ManyToOne — The Most Common Mapping

```java
@Entity
public class Employee {
    @Id @GeneratedValue
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;
}
```

```sql
CREATE TABLE employees (
    id BIGINT PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES departments(id)
);
```

A unidirectional `@ManyToOne` is often all you need.

## Bidirectional @OneToMany and the Owning Side

```java
@Entity
public class Department {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "department", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Employee> employees = new ArrayList<>();

    public void addEmployee(Employee e) {      // helper keeps both sides in sync
        employees.add(e);
        e.setDepartment(this);
    }

    public void removeEmployee(Employee e) {
        employees.remove(e);
        e.setDepartment(null);
    }
}
```

```refs
employees.department_id -> departments | id
```

| Side | Mapping | Role |
| --- | --- | --- |
| `Employee.department` | `@ManyToOne` + `@JoinColumn` | **Owning** — controls `department_id` |
| `Department.employees` | `@OneToMany(mappedBy = "department")` | **Inverse** — a read-only mirror |

> [!IMPORTANT]
> **Only the owning side is written to the database.** `mappedBy` names the field on the owning side. If you only do `department.getEmployees().add(e)` without `e.setDepartment(department)`, the foreign key stays `null`. That's why bidirectional mappings need **helper methods** that set both sides.

### Unidirectional @OneToMany — Avoid

```java
@OneToMany                     // no mappedBy, no @JoinColumn
private List<Employee> employees;
```

Without `mappedBy`, Hibernate creates a **join table** (`department_employees`) and extra statements. If you need it, add `@JoinColumn(name = "department_id")` — but a `@ManyToOne` on the child (optionally bidirectional) is usually the better design.

## @OneToOne

```java
@Entity
public class User {
    @Id @GeneratedValue
    private Long id;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Profile profile;
}

@Entity
public class Profile {
    @Id
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId                         // profile.id = user.id — shared primary key
    @JoinColumn(name = "user_id")
    private User user;
}
```

> [!NOTE]
> On the **inverse** (`mappedBy`) side of a `@OneToOne`, Hibernate can't know whether the related row exists without querying, so `LAZY` there is often ignored and the profile loads anyway. `@MapsId` on the owning side (shared primary key) is the most efficient mapping; mapping only the owning side is another option.

## @ManyToMany

```java
@Entity
public class Student {
    @Id @GeneratedValue
    private Long id;

    @ManyToMany
    @JoinTable(name = "student_course",
               joinColumns = @JoinColumn(name = "student_id"),
               inverseJoinColumns = @JoinColumn(name = "course_id"))
    private Set<Course> courses = new HashSet<>();

    public void enroll(Course c) { courses.add(c); c.getStudents().add(this); }
}

@Entity
public class Course {
    @Id @GeneratedValue
    private Long id;

    @ManyToMany(mappedBy = "courses")
    private Set<Student> students = new HashSet<>();
}
```

> [!TIP]
> - Use a **`Set`**, not a `List`: with a `List` ("bag"), removing one element makes Hibernate delete **all** join rows for the owner and re-insert the rest.
> - **Never `CascadeType.REMOVE`/`ALL`** on `@ManyToMany` — deleting a student would delete shared courses.
> - Need extra columns (enrolment date, grade)? Replace it with an **entity for the join table** (`Enrollment`) and two `@ManyToOne`s.

## Cascade Types

Cascading propagates an `EntityManager` operation from parent to child.

| Cascade | Propagates |
| --- | --- |
| `PERSIST` | `persist()` — saving a new parent saves new children |
| `MERGE` | `merge()` |
| `REMOVE` | `remove()` — deleting the parent deletes children |
| `REFRESH` | `refresh()` |
| `DETACH` | `detach()` |
| `ALL` | All of the above |

```java
Department d = new Department("R&D");
d.addEmployee(new Employee("Asha"));
d.addEmployee(new Employee("Ravi"));
departmentRepository.save(d);   // CascadeType.PERSIST → 3 INSERTs
```

> [!WARNING]
> Cascade from **parent to child** in an aggregate (Order → OrderLines). Don't cascade from child to parent (`@ManyToOne(cascade = ALL)`) — removing one employee could delete the department and everyone in it.

## orphanRemoval vs CascadeType.REMOVE

| | `CascadeType.REMOVE` | `orphanRemoval = true` |
| --- | --- | --- |
| Deleting the **parent** | Deletes children | Deletes children |
| **Removing a child from the collection** | Nothing — the child stays (FK may become null) | **Deletes the child** |

```java
order.getLines().remove(line);   // with orphanRemoval → DELETE FROM order_lines WHERE id=?
```

Use `orphanRemoval` when a child can't exist without its parent (order lines, invoice items).

> [!NOTE]
> With `orphanRemoval`, don't **replace** the collection (`order.setLines(new ArrayList<>())`) — Hibernate loses track of it and throws *"A collection with cascade=all-delete-orphan was no longer referenced"*. Modify it with `clear()`/`add()` instead.

## equals and hashCode for Entities

Entities in `Set`s and collections need sensible `equals`/`hashCode`:

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Employee other)) return false;
    return id != null && id.equals(other.getId());
}

@Override
public int hashCode() {
    return getClass().hashCode();   // constant: stays the same before and after the id is assigned
}
```

- Comparing generated ids is fine **if `hashCode` doesn't change** when the id is assigned — hence the constant hash.
- If the entity has a **natural key** (ISBN, email), use that instead.
- ❌ Don't include **lazy associations** or collections — it triggers loading and can recurse infinitely.
- ❌ Avoid Lombok `@Data`/`@EqualsAndHashCode`/`@ToString` on entities for the same reasons.

## JSON Serialization Loops

Serializing a bidirectional entity (`Department → employees → department → …`) recurses until `StackOverflowError`. `@JsonManagedReference`/`@JsonBackReference` or `@JsonIgnore` patch it, but the real fix is **returning DTOs** from APIs instead of entities.

## Interview Questions

### What is the owning side of a relationship?

The side that maps the foreign key or join table (`@JoinColumn`/`@JoinTable`, no `mappedBy`). Only changes to the owning side are persisted; the `mappedBy` side is a read-only mirror.

### What does mappedBy do?

It marks the inverse side and names the owning field, telling Hibernate the relationship is already mapped there — so it doesn't create a second foreign key or join table.

### What are the default fetch types?

`@ManyToOne` and `@OneToOne`: EAGER. `@OneToMany` and `@ManyToMany`: LAZY. Best practice is LAZY everywhere and fetching explicitly per use case.

### cascade REMOVE vs orphanRemoval?

Both delete children when the parent is deleted; `orphanRemoval` also deletes a child as soon as it's removed from the parent's collection.

### Why avoid CascadeType.ALL on @ManyToMany?

Because the related entities are shared — removing one side would delete entities other rows still reference.

### Why use Set rather than List for @ManyToMany?

Hibernate treats an unordered `List` as a bag; removing an element deletes and re-inserts all join-table rows. A `Set` allows removing a single row. (Bags also cause `MultipleBagFetchException` when fetching two at once.)

### How do you implement equals/hashCode for entities?

Use a natural key if one exists; otherwise compare non-null ids and return a constant `hashCode`. Never include lazy associations.

## Key Takeaways

- ✅ The owning side (with the FK) is what gets saved; keep both sides in sync with helper methods.
- ✅ Make `@ManyToOne`/`@OneToOne` LAZY explicitly.
- ✅ Cascade parent → child only; `orphanRemoval` for dependent children.
- ✅ `@ManyToMany`: `Set`, no REMOVE cascade, or an explicit join entity.
- ✅ Careful `equals`/`hashCode`; return DTOs, not entity graphs, from APIs.
