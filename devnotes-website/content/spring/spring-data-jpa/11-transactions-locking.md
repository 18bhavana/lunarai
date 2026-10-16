---
title: Transactions & Locking
subtitle: "How @Transactional works through proxies, where to put it, readOnly, rollback rules for checked exceptions, propagation (REQUIRED, REQUIRES_NEW, NESTED…), isolation levels, the self-invocation trap, optimistic locking with @Version and pessimistic locks with @Lock."
order: 11
---

## Introduction

Every write in a JPA application runs inside a transaction — and most subtle data bugs (lost updates, partial writes, "my rollback didn't happen") come from misunderstanding how Spring's `@Transactional` works.

> [!NOTE]
> **Interview importance:** very high. Propagation, rollback rules, self-invocation and optimistic locking come up in almost every backend interview.

## How @Transactional Works

```java
@Service
public class TransferService {

    @Transactional
    public void transfer(Long fromId, Long toId, BigDecimal amount) {
        Account from = accounts.findById(fromId).orElseThrow();
        Account to = accounts.findById(toId).orElseThrow();
        from.withdraw(amount);
        to.deposit(amount);
    }   // commit → both UPDATEs, or neither
}
```

Spring wraps the bean in a **proxy**. Calls go through it:

```flow
Caller calls transferService.transfer()
Proxy: begin transaction — get a connection, open the persistence context
Your method runs
? Did it throw a RuntimeException or Error? | Yes: Rollback | No: Flush and commit
Proxy releases the connection
```

## Where to Put It

- ✅ On **service methods** — a transaction should cover one business operation (several repository calls).
- Repository methods are already transactional: `SimpleJpaRepository` reads use `readOnly = true`, writes use `@Transactional`.
- ❌ Not on controllers — keep transactions short and away from HTTP/view concerns.
- It works on **public** methods called **through the proxy** (Spring 6 also supports protected and package-private methods with class-based proxies, but keep it public).

## readOnly = true

```java
@Transactional(readOnly = true)
public List<EmployeeDto> list() { … }
```

- Hibernate sets the session to read-only: **no snapshots, no dirty checking, no flush** — less memory and CPU.
- Spring can route to a read replica (with a routing `DataSource`) and the JDBC driver may optimise.
- It's a hint, not a security mechanism — but use it for all query-only service methods.

## Rollback Rules

> [!WARNING]
> By default Spring rolls back only on **unchecked exceptions** (`RuntimeException`) and `Error`. A **checked exception** (`IOException`, a custom `Exception` subclass) **commits** the transaction!

```java
@Transactional(rollbackFor = Exception.class)          // roll back on checked exceptions too
public void importFile(Path file) throws IOException { … }

@Transactional(noRollbackFor = EmailFailedException.class)
public void register(User u) { … }
```

Catching an exception inside the method and not rethrowing it means **no rollback** — the proxy never sees it. And if an inner transactional call marked the transaction rollback-only, the outer commit fails with `UnexpectedRollbackException`.

## Propagation

What happens when a transactional method calls another?

| Propagation | Behaviour |
| --- | --- |
| `REQUIRED` (default) | Join the current transaction; create one if none |
| `REQUIRES_NEW` | **Suspend** the current transaction and start an independent one |
| `NESTED` | A savepoint inside the current transaction — partial rollback. Works with `DataSourceTransactionManager`; `JpaTransactionManager` disables it by default because a savepoint can't roll back the persistence context |
| `SUPPORTS` | Join if one exists, otherwise run without |
| `MANDATORY` | Must be called inside a transaction, else exception |
| `NOT_SUPPORTED` | Suspend any transaction; run without |
| `NEVER` | Exception if a transaction exists |

```java
@Service
public class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String event) { auditRepository.save(new AuditLog(event)); }
}

@Transactional
public void placeOrder(Order o) {
    orders.save(o);
    audit.record("ORDER_PLACED");   // committed even if placeOrder later rolls back
    payment.charge(o);              // throws → order rolled back, audit row kept
}
```

> [!TIP]
> `REQUIRES_NEW` uses a **second connection** while the first is held. Under load, nested `REQUIRES_NEW` calls can exhaust the connection pool — use it sparingly (audit logs, outbox-independent records).

## The Self-Invocation Trap

```java
@Service
public class ReportService {
    public void generateAll() {
        for (Long id : ids) generate(id);   // ❌ this.generate() — bypasses the proxy
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void generate(Long id) { … }      // no new transaction!
}
```

Calls **within the same class** don't go through the proxy, so `@Transactional` (and `@Async`, `@Cacheable`) on the called method is ignored. Fixes: move the method to **another bean**, inject the bean's own proxy (`@Lazy` self-injection), or use `TransactionTemplate` programmatically.

```java
transactionTemplate.executeWithoutResult(status -> generateOne(id));
```

## Isolation Levels

| Level | Dirty read | Non-repeatable read | Phantom read |
| --- | --- | --- | --- |
| `READ_UNCOMMITTED` | Possible | Possible | Possible |
| `READ_COMMITTED` (PostgreSQL, Oracle, SQL Server default) | ❌ | Possible | Possible |
| `REPEATABLE_READ` (MySQL InnoDB default) | ❌ | ❌ | Possible in the standard (InnoDB mostly prevents them) |
| `SERIALIZABLE` | ❌ | ❌ | ❌ |

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
```

`Isolation.DEFAULT` uses the database's level. Higher isolation = more locking or more serialization failures to retry. Most applications keep the default and use **locking** for the specific rows that need it.

## The Lost Update Problem

```text
T1: read stock = 10        T2: read stock = 10
T1: stock = 10 - 3 = 7     T2: stock = 10 - 5 = 5
T1: commit (7)             T2: commit (5)   ← T1's update is lost; should be 2
```

Two solutions: **optimistic** or **pessimistic** locking.

## Optimistic Locking — @Version

```java
@Entity
public class Product {
    @Id @GeneratedValue
    private Long id;
    private int stock;

    @Version
    private Long version;
}
```

```sql
UPDATE product SET stock = ?, version = 8 WHERE id = ? AND version = 7
```

If another transaction already changed the row, the version doesn't match, **0 rows** update, and Hibernate throws `OptimisticLockException` (Spring: `ObjectOptimisticLockingFailureException`). Catch it and **retry** or tell the user the data changed.

- No database locks are held — great for low-contention data (most business entities).
- Also protects **across requests**: send the version to the client and back, so a stale form submission fails.
- ⚠️ JPQL/native bulk updates don't increment the version unless you do it yourself.

```java
@Retryable(retryFor = ObjectOptimisticLockingFailureException.class, maxAttempts = 3)
@Transactional
public void reserve(Long productId, int qty) { … }
```

(`@Retryable` comes from Spring Retry — and must wrap the transaction, not run inside it.)

## Pessimistic Locking — @Lock

```java
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findForUpdate(@Param("id") Long id);
}
```

```sql
SELECT … FROM product WHERE id = ? FOR UPDATE
```

The row stays locked until the transaction ends; other writers (and `FOR UPDATE` readers) **wait**.

| | Optimistic (`@Version`) | Pessimistic (`@Lock`) |
| --- | --- | --- |
| Mechanism | Version check at update time | Database row lock (`SELECT … FOR UPDATE`) |
| Conflicts | Detected → exception → retry | Prevented → others wait |
| Best for | Low contention, long user think time | High contention, short critical sections (stock, seats, balances) |
| Risks | Retries under heavy contention | Waiting, deadlocks, timeouts |

`PESSIMISTIC_READ` takes a shared lock (`FOR SHARE`); `PESSIMISTIC_WRITE` an exclusive one. Always lock rows in a **consistent order** to avoid deadlocks, and keep locked transactions short.

> [!TIP]
> For simple counters, an atomic update avoids both: `UPDATE Product p SET p.stock = p.stock - :qty WHERE p.id = :id AND p.stock >= :qty` — check that it updated 1 row.

## Keep Transactions Short

- ❌ Don't call slow external APIs, send emails or wait for user input inside a transaction — it holds a connection and locks.
- ✅ Do the remote call first (or after commit — `@TransactionalEventListener(phase = AFTER_COMMIT)`), and keep the database part tight.

## Interview Questions

### How does @Transactional work?

Spring creates a proxy around the bean. On a call, the proxy starts (or joins) a transaction, invokes the method, then commits — or rolls back on a runtime exception — and releases the connection.

### Which exceptions cause a rollback?

By default unchecked exceptions (`RuntimeException`) and `Error`. Checked exceptions commit unless you configure `rollbackFor`.

### Why doesn't @Transactional work when calling a method in the same class?

Self-invocation bypasses the Spring proxy, so the annotation on the called method isn't applied. Move it to another bean, self-inject, or use `TransactionTemplate`.

### REQUIRED vs REQUIRES_NEW?

`REQUIRED` joins the existing transaction (one commit or rollback for everything). `REQUIRES_NEW` suspends it and runs an independent transaction that commits or rolls back on its own.

### What does readOnly = true do?

It hints that no writes will occur: Hibernate skips dirty checking and flushing, and the driver or routing data source can optimise. Use it for query-only methods.

### Optimistic vs pessimistic locking?

Optimistic uses a `@Version` column and fails the update if the row changed since it was read (then you retry). Pessimistic locks the row with `SELECT … FOR UPDATE` so others wait. Optimistic for low contention; pessimistic for hot rows.

### How does @Version work?

Hibernate adds `WHERE version = ?` to updates and increments it. If no row matches, someone else changed it, and an `OptimisticLockException` is thrown.

## Key Takeaways

- ✅ `@Transactional` works through proxies — public methods, called from another bean.
- ✅ Put it on service methods; use `readOnly = true` for reads.
- ✅ Checked exceptions don't roll back by default — use `rollbackFor`.
- ✅ `REQUIRED` joins, `REQUIRES_NEW` runs independently (and uses another connection).
- ✅ Prevent lost updates with `@Version` (optimistic) or `@Lock(PESSIMISTIC_WRITE)`.
- ✅ Keep transactions short — no remote calls inside.
