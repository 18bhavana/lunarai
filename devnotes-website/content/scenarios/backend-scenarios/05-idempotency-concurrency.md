---
title: Idempotency, Concurrency & Duplicates
subtitle: "Scenario questions 41–48: duplicate order clicks, retried payments that already succeeded, concurrent balance updates, scheduled jobs on several instances, storing idempotency keys and handling concurrent duplicates, lost responses, optimistic vs pessimistic locking, and safety across instances."
order: 5
---

## Introduction

An operation is **idempotent** if doing it twice has the same effect as doing it once. In distributed systems, requests are retried by users, browsers, gateways, HTTP clients and message brokers, so every operation that changes state must be idempotent or protected against duplicates.

| HTTP method | Idempotent by definition? |
| --- | --- |
| `GET`, `HEAD`, `PUT`, `DELETE` | ✅ |
| `POST`, `PATCH` | ❌ Make them idempotent with keys or constraints |

## Scenario Questions

### Q41. A customer clicks the Place Order button multiple times. How would you prevent duplicate orders?

Use several layers, because each one alone can fail:

1. **UI:** disable the button after the first click and show a spinner. This improves the experience but **isn't a guarantee**: double submits, refreshes and network retries still happen.
2. **An idempotency key per checkout:** the client generates a UUID when the checkout page loads and sends it as `Idempotency-Key` on every attempt. The server stores the key with a unique constraint, and a repeat returns the **original order** instead of creating a new one (see Q45).
3. **A database constraint as the final guard:**

```sql
ALTER TABLE orders ADD CONSTRAINT uk_orders_checkout UNIQUE (checkout_id);
```

```java
try {
    return orderRepository.saveAndFlush(Order.from(cmd));
} catch (DataIntegrityViolationException e) {
    return orderRepository.findByCheckoutId(cmd.checkoutId()).orElseThrow();   // already created
}
```

4. **Cart state:** convert the cart to an order once, by moving it from `ACTIVE` to `CHECKED_OUT` atomically, so a second conversion finds nothing to convert.

The response to a duplicate should look like the original success (same order ID, `200` or `201`), so the client behaves correctly.

### Q42. A payment request is retried because of a timeout, but the original payment actually succeeded. How would you avoid charging the customer twice?

A timeout means **"unknown"**, not "failed".

- **Send the same idempotency key on the retry.** Payment providers (Stripe, Razorpay, Adyen) deduplicate by key and return the original successful result instead of charging again. Use a stable key such as `payment-<orderId>-<attemptNo>`, and reuse it for retries of the same attempt.
- **Before retrying, check the status:** query the provider by your reference (order ID or merchant transaction ID).
- **Keep a local payment record** with a state machine (`INITIATED → PENDING → SUCCEEDED / FAILED`), created **before** calling the provider. A retry sees `PENDING` and checks status instead of starting a new charge.
- **Webhooks:** the provider notifies you of the final result. Process webhooks idempotently by event ID.
- **Reconciliation:** a daily job compares the provider's settlement report with your records and automatically **refunds** genuine duplicates.

```flow
Create local payment INITIATED (key = payment-123-1)
Call the provider with the idempotency key
? Response received? | Yes: Store SUCCEEDED or FAILED | No: Mark PENDING → query status with the same key, or wait for the webhook
```

### Q43. Two threads attempt to update the same account balance simultaneously. How would you ensure correctness?

**The bug:**

```java
Account a = repo.findById(id).orElseThrow();   // both threads read 1000
a.setBalance(a.getBalance().subtract(amount)); // both write 1000 - x
// one withdrawal is lost
```

**Solutions:**

1. **Atomic update in SQL.** This is the simplest and fastest option, and it enforces the business rule in the same statement:

```java
@Modifying
@Query("UPDATE Account a SET a.balance = a.balance - :amt WHERE a.id = :id AND a.balance >= :amt")
int withdraw(@Param("id") Long id, @Param("amt") BigDecimal amt);   // 0 rows → insufficient funds
```

2. **Pessimistic lock:** `SELECT … FOR UPDATE` serialises access to that row. It's good for complex rules that touch several rows. For transfers, **lock rows in a consistent order** (lowest ID first) to avoid deadlocks.
3. **Optimistic locking:** add a `@Version` column and retry on conflict. It's good when conflicts are rare.
4. **A ledger design:** instead of updating one balance, **insert** immutable debit and credit entries. The balance is their sum, or a value maintained alongside them. This gives an audit trail, and concurrency becomes simple appends plus a constraint check.

In-JVM locks (`synchronized`, `ReentrantLock`) **don't work** with several application instances. Correctness must come from the **database** or from a distributed lock.

### Q44. Two application instances execute the same scheduled job at the same time. How would you prevent duplicate execution?

`@Scheduled` runs on **every instance**. Options:

1. **ShedLock:** a lock row in the database (or Redis or ZooKeeper) ensures that only one instance runs the job:

```java
@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
class SchedulerConfig {
    @Bean
    LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .usingDbTime()
                .build());
    }
}

@Scheduled(cron = "0 0 2 * * *")
@SchedulerLock(name = "dailySettlement", lockAtLeastFor = "1m", lockAtMostFor = "30m")
public void dailySettlement() { … }
```

`lockAtMostFor` releases the lock if the instance dies mid-job. `lockAtLeastFor` stops a fast job from running again on another instance whose clock is slightly behind.

2. **Claim work with row-level locks:** each instance claims a batch with `SELECT … FOR UPDATE SKIP LOCKED`. All instances work in parallel without processing the same rows, which scales better than one global lock.
3. **A dedicated scheduler:** a Kubernetes `CronJob` (with `concurrencyPolicy: Forbid`), Quartz in clustered mode (JDBC job store), or a workflow tool, outside the web instances.
4. **Leader election** (Spring Integration's `LockRegistryLeaderInitiator`, or Kubernetes leases) when one instance must own all the scheduled work.

Also make the job itself **idempotent**: if it runs twice anyway, the second run should find nothing to do.

### Q45. Your application uses an idempotency key. Where would you store it, and how would you handle concurrent requests with the same key?

**Where to store it:**

- **In the same database as the business data**, written in the **same transaction**. That way the key and the result commit together, and a crash can't leave one without the other. This is the most reliable option.
- **Redis** (`SET key value NX EX 86400`) is fast and expires automatically, but it isn't transactional with your database. It's fine for a first-line check, and for operations whose side effects are themselves idempotent.

**Table design:**

```sql
CREATE TABLE idempotency_key (
    key_value     VARCHAR(100) NOT NULL,
    client_id     VARCHAR(50)  NOT NULL,        -- scope keys per client
    request_hash  CHAR(64)     NOT NULL,        -- detect the same key with a different body
    status        VARCHAR(20)  NOT NULL,        -- PROCESSING / COMPLETED / FAILED
    response_code INT,
    response_body TEXT,
    created_at    TIMESTAMP    NOT NULL,
    PRIMARY KEY (client_id, key_value)
);
```

**Handling concurrent duplicates:**

```flow
Request arrives with a key
INSERT the key with status PROCESSING (the unique constraint decides the winner)
? Insert succeeded? | Yes: Process, store the response, set COMPLETED | No: Read the existing row
? Status of the existing row? | COMPLETED: Return the stored response | PROCESSING: 409 Conflict (retry later), or wait briefly
```

- The **unique constraint** makes the race safe: exactly one request inserts the row.
- If the **request hash differs** for the same key, return `422 Unprocessable Entity`, because the client is misusing the key.
- If processing **fails with a retriable error**, delete the row or mark it `FAILED`, so the client can retry.
- Clean up old keys after a retention period (24 hours to 7 days).

### Q46. A request succeeds, but the client never receives the response. The client retries the request. How should your API behave?

It should return the **same result as the first time, without doing the work again**:

- For `POST` operations, require an **idempotency key**. On the retry, find the stored record and **replay the original response** (status code and body, for example `201` with the order ID).
- For `PUT` or `DELETE`, the operation is naturally idempotent. Repeating "set the address to X" or "delete order 5" is harmless. A repeated `DELETE` can return `204` or `404`; document which.
- Use **business keys** where possible: a client-supplied `orderReference` with a unique constraint. A duplicate returns the existing resource.
- Signal that it's a replay if it helps (for example an `Idempotent-Replayed: true` header), but **don't** turn it into an error. The client is doing the right thing.

This is the same mechanism as Q20 and Q45, viewed from the API contract: document that clients **must** send an `Idempotency-Key` for unsafe operations, and may safely retry with it.

### Q47. When would you use optimistic locking versus pessimistic locking?

| | Optimistic (`@Version`) | Pessimistic (`SELECT … FOR UPDATE`) |
| --- | --- | --- |
| How it works | Read freely; the update fails if the version changed | Lock the row on read; others wait |
| Conflict handling | Exception → retry, or tell the user | Prevented, at the cost of waiting |
| Best when | Conflicts are **rare**; high read concurrency | Conflicts are **frequent** on hot rows |
| Long user think time (edit forms) | ✅ No locks held between requests | ❌ You can't hold DB locks across HTTP requests |
| Risks | Many retries under heavy contention | Deadlocks, lock timeouts, lower throughput |
| Examples | Profile edits, product updates, most CRUD | Seat or ticket booking, inventory decrements, balance transfers |

**Rules of thumb:**

- Default to **optimistic** for business entities, and expose the version through `ETag`/`If-Match` in REST APIs.
- Use **pessimistic** locks for short transactions on contended rows, with a **lock timeout** and a consistent lock order.
- For simple counters, an **atomic conditional update** beats both (Q43).

### Q48. How would you make a business operation safe when multiple instances of your Spring Boot application process the same request?

Anything held **in one JVM** (`synchronized`, local caches, in-memory flags) is invisible to other instances. Coordinate through **shared state**:

1. **Idempotency keys** with a unique constraint, so only one instance can process a given request (Q45).
2. **Database constraints and atomic statements:** unique keys, conditional updates (`WHERE status = 'PENDING'`), and inserts that fail on duplicates.
3. **Row locks or optimistic versions** on the entity being changed.
4. **A distributed lock** when you must serialise something that isn't a single row, for example Redis with Redisson (`RLock` with a lease time), ShedLock, or ZooKeeper. Use **fencing tokens** or version checks as well: a lock holder paused by GC can lose the lock without knowing it.
5. **Kafka partitioning by key:** messages for one entity go to one partition, so they're processed by one consumer at a time.
6. **State machines with guarded transitions:** `UPDATE orders SET status = 'SHIPPED' WHERE id = ? AND status = 'PAID'`. Only one instance's update can succeed.

```java
int updated = orderRepository.transition(orderId, OrderStatus.PAID, OrderStatus.SHIPPED);
if (updated == 0) {
    return;   // another instance already did it, or the order isn't in the right state
}
shippingService.createShipment(orderId);
```

Prefer database guarantees (constraints, conditional updates). They're simpler and more reliable than distributed locks.

## Key Takeaways

- ✅ UI protections help, but only server-side keys and constraints guarantee no duplicates.
- ✅ A timeout means "unknown": retry with the same idempotency key, and check status first.
- ✅ Balances need atomic updates, locks or a ledger. JVM locks don't work across instances.
- ✅ Scheduled jobs on many instances need ShedLock, `SKIP LOCKED`, or an external scheduler.
- ✅ Store idempotency keys in the business database, with a unique constraint deciding races.
- ✅ Optimistic locking for rare conflicts; pessimistic locking for hot rows.
