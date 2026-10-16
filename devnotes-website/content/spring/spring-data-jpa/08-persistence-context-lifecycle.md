---
title: Persistence Context & Entity Lifecycle
subtitle: The persistence context as a first-level cache and unit of work, the four entity states, persist, merge, remove and detach, dirty checking, flush modes and timing, getReferenceById, LazyInitializationException, Open Session in View and lifecycle callbacks.
order: 8
---

## Introduction

Most "JPA magic" — updates without `save()`, lazy loading, `LazyInitializationException`, stale data after bulk updates — is explained by one concept: the **persistence context**.

> [!NOTE]
> **Interview importance:** very high. "What is dirty checking?", "What are the entity states?" and "Why do I get LazyInitializationException?" are among the most common Hibernate questions.

## What Is the Persistence Context?

The **persistence context** is the set of entity instances an `EntityManager` (Hibernate `Session`) is currently managing. In Spring it normally lives for the duration of a **transaction**.

It acts as:

- a **first-level cache** — loading the same id twice returns the **same object** without a second query;
- an **identity map** — at most one managed instance per entity id;
- a **unit of work** — it tracks changes and writes them at flush time.

```java
@Transactional
public void demo() {
    Employee a = repository.findById(1L).orElseThrow();   // SELECT
    Employee b = repository.findById(1L).orElseThrow();   // no SQL — same persistence context
    System.out.println(a == b);                            // true
}
```

> [!NOTE]
> The first-level cache only applies to lookups **by id** (`findById`, `em.find`) within one persistence context. A JPQL query like `findByEmail` still goes to the database (though returned rows are resolved to the already-managed instances). It's not shared between transactions — that's the optional **second-level cache** (see *Caching, Connection Pooling & Migrations*).

## The Four Entity States

```flow
new Employee() — TRANSIENT: not known to JPA, no id
persist() / save() — MANAGED: tracked by the persistence context
Transaction ends, or detach() / clear() — DETACHED: has an id, no longer tracked
merge() — changes copied onto a MANAGED instance again
remove() — REMOVED: deleted at flush
```

| State | In persistence context? | In database? | Changes saved automatically? |
| --- | --- | --- | --- |
| **Transient** (new) | ❌ | ❌ | ❌ |
| **Managed** (persistent) | ✅ | ✅ (or will be at flush) | ✅ |
| **Detached** | ❌ | ✅ | ❌ |
| **Removed** | ✅ (scheduled for deletion) | Until flush | — |

## persist, merge, remove and detach

```java
Employee e = new Employee("Asha");   // transient
em.persist(e);                       // managed — INSERT at flush (or immediately with IDENTITY)

em.detach(e);                        // detached — further changes ignored
e.setName("Asha R");

Employee managed = em.merge(e);      // copies state onto a managed instance
// managed != e — 'e' itself stays detached!

em.remove(managed);                  // removed — DELETE at flush
```

> [!IMPORTANT]
> `merge()` **returns** the managed instance; the argument stays detached. Keep using the returned object: `entity = repository.save(entity)`.

| Operation | Behaviour |
| --- | --- |
| `persist(transient)` | Makes it managed; no return value |
| `persist(detached)` | Throws (`EntityExistsException` / `PersistentObjectException`) |
| `merge(detached or transient)` | Loads (SELECT) or creates the managed copy, copies state, returns it |
| `remove(managed)` | Schedules a delete; `remove(detached)` throws `IllegalArgumentException` |
| `detach(e)` / `clear()` | Stops tracking one / all entities |
| `refresh(e)` | Reloads state from the database, overwriting changes |

## Dirty Checking

When an entity becomes managed, Hibernate keeps a **snapshot** of its loaded state. At flush time it compares each managed entity with its snapshot and issues `UPDATE`s for the ones that changed.

```java
@Transactional
public void rename(Long id, String newName) {
    Employee e = repository.findById(id).orElseThrow();   // managed + snapshot
    e.setName(newName);                                    // just a field change
}   // commit → flush → dirty check → UPDATE employees SET name=? … WHERE id=?
```

No `save()` call is needed. If nothing changed, no `UPDATE` runs.

> [!TIP]
> Dirty checking compares **every** managed entity at flush. Loading 50,000 entities just to read them costs memory and CPU — use `@Transactional(readOnly = true)` (Hibernate then skips snapshots and dirty checks) or DTO projections for read-only work.

By default Hibernate updates all columns; `@DynamicUpdate` on the entity makes it include only changed columns.

## Flushing

**Flush** = sending pending SQL (`INSERT`/`UPDATE`/`DELETE`) to the database. It's **not** a commit — the transaction can still roll back.

Hibernate flushes automatically (`FlushModeType.AUTO`):

- **before a transaction commits**;
- **before a query** whose results could be affected by pending changes (so queries see your own writes);
- when you call `flush()` / `saveAndFlush()` explicitly.

```java
@Transactional
public void example() {
    Employee e = new Employee("Ravi");
    repository.save(e);                     // with SEQUENCE: no SQL yet

    long count = repository.countByName("Ravi");   // auto-flush → INSERT, then the count query
}
```

Hibernate also orders statements at flush: inserts, then updates, then collection changes, then deletes.

## getReferenceById — Proxies Without a Query

```java
Department dept = departmentRepository.getReferenceById(10L);   // no SELECT — a lazy proxy
employee.setDepartment(dept);                                    // only the id is needed for the FK
```

Perfect for setting a foreign key without loading the parent. Accessing a non-id field on the proxy triggers the `SELECT`; if the row doesn't exist, you get `EntityNotFoundException` at that point.

## LazyInitializationException

```java
public EmployeeDto get(Long id) {                   // no @Transactional
    Employee e = repository.findById(id).orElseThrow();
    return new EmployeeDto(e.getName(), e.getDepartment().getName());   // 💥
}
```

```output
org.hibernate.LazyInitializationException: could not initialize proxy [Department#7] - no Session
```

`findById` ran in its own short transaction; by the time you touch the lazy `department` proxy, the persistence context is closed, so Hibernate can't load it.

**Fixes (in order of preference):**

1. **Fetch what you need in the query** — `JOIN FETCH`, `@EntityGraph`, or a DTO projection.
2. **Do the work inside a `@Transactional` service method** and map to DTOs before returning.
3. ❌ Not: `FetchType.EAGER` everywhere, or `hibernate.enable_lazy_load_no_trans=true` (opens a new session per lazy load — an N+1 machine).

## Open Session in View (OSIV)

Spring Boot enables `spring.jpa.open-in-view=true` by default and logs a warning about it. OSIV keeps the persistence context open for the **whole HTTP request**, including view rendering and JSON serialization, so lazy loading "just works" in controllers.

| OSIV on | OSIV off (`spring.jpa.open-in-view=false`) |
| --- | --- |
| No `LazyInitializationException` in controllers | Lazy access outside a transaction fails fast |
| Hidden lazy queries during serialization (N+1) | Data needs are explicit in queries |
| Holds a database connection for the whole request | Connection released after the transaction |

> [!TIP]
> Most teams turn OSIV **off** for REST APIs, fetch explicitly and return DTOs — it makes queries visible and frees connections sooner.

## Lifecycle Callbacks

```java
@Entity
public class Employee {
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
```

Available: `@PrePersist`, `@PostPersist`, `@PreUpdate`, `@PostUpdate`, `@PreRemove`, `@PostRemove`, `@PostLoad` — on the entity or in an `@EntityListeners` class. They **don't run for bulk JPQL/native statements**. For created/modified fields, Spring Data auditing (see *Projections, Specifications & Auditing*) is usually cleaner.

## Interview Questions

### What is the persistence context?

The set of managed entity instances for an `EntityManager` — a first-level cache and unit of work that guarantees one instance per id and tracks changes until flush. In Spring it's usually transaction-scoped.

### What are the JPA entity states?

Transient (new, not tracked), managed (tracked; changes saved automatically), detached (has an id but isn't tracked) and removed (scheduled for deletion).

### What is dirty checking?

Hibernate compares managed entities with snapshots of their loaded state at flush time and generates `UPDATE` statements for changed ones — so updates inside a transaction need no `save()`.

### persist vs merge?

`persist` makes a new instance managed (and fails for detached ones). `merge` copies the state of a detached or new object onto a managed instance — loading it if needed — and returns that managed instance.

### flush vs commit?

Flush sends pending SQL to the database within the transaction; commit makes the transaction's changes permanent. A flushed change can still be rolled back.

### What causes LazyInitializationException and how do you fix it?

Accessing an uninitialised lazy association after the persistence context has closed. Fix it by fetching the data you need (JOIN FETCH, entity graphs, DTOs) inside the transaction — not by making everything EAGER.

### What is Open Session in View and should you use it?

It keeps the persistence context open for the whole web request so lazy loading works in the view layer. It hides N+1 queries and holds connections longer; many teams disable it for APIs.

### findById vs getReferenceById?

`findById` queries immediately (or uses the first-level cache) and returns `Optional`. `getReferenceById` returns a lazy proxy without a query — ideal for setting foreign keys — and fails only when you access missing data.

## Key Takeaways

- ✅ The persistence context = first-level cache + identity map + unit of work.
- ✅ Managed entities are saved automatically via dirty checking; detached ones aren't.
- ✅ `merge` returns the managed instance — use it.
- ✅ Flush ≠ commit; Hibernate auto-flushes before commits and relevant queries.
- ✅ Fix `LazyInitializationException` with explicit fetching, not EAGER or OSIV.
