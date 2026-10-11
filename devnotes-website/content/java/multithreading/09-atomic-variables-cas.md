---
title: Atomic Variables & Compare-and-Swap
subtitle: AtomicInteger, AtomicLong and AtomicReference, how CAS works, lock-free algorithms, updateAndGet, the ABA problem, LongAdder for high contention, and when atomics aren't enough.
order: 9
---

## Introduction

Locking a whole block just to increment a counter is heavy. The `java.util.concurrent.atomic` package provides classes whose operations are **atomic without locks**, built on a CPU instruction called **compare-and-swap (CAS)**. They're the go-to tool for counters, sequence numbers, flags and single-reference state.

## The Counter, Fixed with AtomicInteger

```java
class Counter {
    private final AtomicInteger count = new AtomicInteger();

    public void increment() {
        count.incrementAndGet();    // atomic — no lost updates
    }

    public int getCount() {
        return count.get();         // always sees the latest value
    }
}
```

The race-condition program from earlier now always prints **200000**, without any `synchronized`.

## Common Atomic Classes

| Class | Holds |
| --- | --- |
| `AtomicInteger`, `AtomicLong` | An `int` / `long` |
| `AtomicBoolean` | A `boolean` |
| `AtomicReference<V>` | An object reference |
| `AtomicIntegerArray`, `AtomicLongArray`, `AtomicReferenceArray` | Arrays with atomic elements |
| `AtomicStampedReference<V>` | Reference + integer stamp (fixes ABA) |
| `LongAdder`, `LongAccumulator`, `DoubleAdder` | High-contention counters/accumulators |

## Key Methods

| Method | Meaning |
| --- | --- |
| `get()` / `set(v)` | Volatile read / write |
| `incrementAndGet()` / `getAndIncrement()` | `++x` / `x++` |
| `addAndGet(d)` / `getAndAdd(d)` | Add a delta |
| `compareAndSet(expected, new)` | Set to `new` **only if** the current value equals `expected`; returns success |
| `updateAndGet(fn)` / `getAndUpdate(fn)` | Apply a function atomically |
| `accumulateAndGet(x, fn)` | Combine with another value atomically |
| `lazySet(v)` / `setRelease(v)` | Cheaper write with weaker ordering (advanced) |

```java
AtomicInteger stock = new AtomicInteger(10);

stock.addAndGet(5);                          // 15
stock.updateAndGet(v -> v * 2);              // 30
stock.accumulateAndGet(4, Math::max);        // 30
boolean ok = stock.compareAndSet(30, 0);     // true → 0
```

## How Compare-and-Swap Works

CAS is a single atomic CPU instruction (`CMPXCHG` on x86):

```text
CAS(memoryLocation, expectedValue, newValue):
    if *memoryLocation == expectedValue:
        *memoryLocation = newValue
        return true
    else:
        return false
```

`incrementAndGet()` is essentially a **retry loop** around CAS:

```java
public int incrementAndGet() {
    int current, next;
    do {
        current = get();            // read
        next = current + 1;         // compute
    } while (!compareAndSet(current, next));   // write only if nobody changed it meanwhile
    return next;
}
```

```flow
Read current value: 5
Compute new value: 6
? CAS(5 → 6) succeeds? | Yes: done | No: another thread changed it — retry from the read
```

If another thread updated the value in between, the CAS fails and the loop simply **retries with the fresh value** — no thread ever blocks. This is called **lock-free** or **optimistic** concurrency.

| Locking (pessimistic) | CAS (optimistic) |
| --- | --- |
| Assume conflict; block others | Assume no conflict; detect and retry |
| Threads can block, be descheduled, deadlock | Threads never block; no deadlock |
| Good under very high contention on large critical sections | Excellent for small updates with low–moderate contention |

## updateAndGet — Atomic Read-Modify-Write with a Function

```java
AtomicReference<BigDecimal> balance = new AtomicReference<>(BigDecimal.ZERO);

balance.updateAndGet(b -> b.add(new BigDecimal("100.00")));
```

> [!WARNING]
> The function passed to `updateAndGet` / `accumulateAndGet` may be **called several times** when CAS retries under contention. It must be **side-effect free** — no logging, no I/O, no incrementing other counters inside it.

## AtomicReference for Immutable State

Combine `AtomicReference` with an immutable object to update several values atomically:

```java
record Range(int low, int high) { }

class RangeHolder {
    private final AtomicReference<Range> range = new AtomicReference<>(new Range(0, 10));

    public void setLow(int low) {
        range.updateAndGet(r -> {
            if (low > r.high()) throw new IllegalArgumentException("low > high");
            return new Range(low, r.high());
        });
    }
}
```

The invariant `low <= high` can never be broken, because the whole `Range` is swapped in one CAS.

## The ABA Problem

CAS checks only that the value **looks the same**, not that it **didn't change**:

| Step | Thread 1 | Thread 2 | Value |
| --- | --- | --- | --- |
| 1 | Reads **A** | | A |
| 2 | (paused) | Changes A → **B** | B |
| 3 | | Changes B → **A** | A |
| 4 | CAS(A → C) **succeeds** | | C |

Thread 1 can't tell that the value changed twice. For counters this is harmless; for lock-free data structures (stacks, linked lists) where `A` is a node that was removed and reused, it can corrupt the structure.

**Fix:** `AtomicStampedReference` pairs the reference with a version stamp that increases on every change:

```java
AtomicStampedReference<Node> top = new AtomicStampedReference<>(null, 0);

int[] stampHolder = new int[1];
Node current = top.get(stampHolder);
top.compareAndSet(current, newNode, stampHolder[0], stampHolder[0] + 1);
```

(It's the same idea as optimistic locking with a `@Version` column in JPA.)

## LongAdder — Counters Under Heavy Contention

When many threads hammer one `AtomicLong`, they all CAS the same memory location and most attempts fail and retry. `LongAdder` spreads updates across **multiple internal cells** and sums them on read:

```java
LongAdder requests = new LongAdder();

requests.increment();          // very cheap even with hundreds of threads
long total = requests.sum();   // adds up all cells
```

| `AtomicLong` | `LongAdder` |
| --- | --- |
| One value; every update contends | Many cells; updates rarely contend |
| `get()` is exact and cheap | `sum()` is a moment-in-time estimate under concurrent updates, and costlier |
| Supports `compareAndSet` | No CAS — only add/increment/sum/reset |
| Use for sequence numbers, IDs | Use for statistics: request counts, metrics |

`ConcurrentHashMap` uses the same idea internally to count its entries, and Micrometer counters use it too.

## When Atomics Aren't Enough

Atomic classes make **one variable** atomic. Two separate atomics updated one after the other are **not** atomic together:

```java
AtomicInteger available = new AtomicInteger(10);
AtomicInteger reserved  = new AtomicInteger(0);

// ❌ Another thread can observe available + reserved != 10 in between
available.decrementAndGet();
reserved.incrementAndGet();
```

Either put both values in one immutable object behind an `AtomicReference`, or use a lock.

## Interview Questions

### Q1. What are atomic variables?

Classes in `java.util.concurrent.atomic` (such as `AtomicInteger` and `AtomicReference`) whose operations — increment, add, compare-and-set, update — are atomic without locks, and which have volatile visibility semantics.

### Q2. What is CAS?

Compare-and-swap: an atomic CPU instruction that sets a memory location to a new value only if it currently holds an expected value. Atomic classes use it in retry loops to implement lock-free updates.

### Q3. AtomicInteger vs volatile int?

`volatile int` gives visibility but `count++` still loses updates. `AtomicInteger` gives visibility **and** atomic read-modify-write operations like `incrementAndGet()`.

### Q4. AtomicInteger vs synchronized?

Atomics are lock-free and faster for single-variable updates; threads never block. `synchronized` is needed when several variables or a larger block must change together.

### Q5. What is the ABA problem and how do you solve it?

A CAS succeeds because the value is back to what was expected, even though it changed in between. Solve it with a version stamp — `AtomicStampedReference` — or by never reusing values (immutable nodes).

### Q6. When would you use LongAdder over AtomicLong?

For high-contention counters and statistics where many threads increment and reads are infrequent. Use `AtomicLong` when you need exact reads or CAS — for example, generating IDs.

## Common Mistakes

- ❌ **Using `volatile` for counters** instead of an atomic.
- ❌ **Calling `get()` then `set()`** — that's two operations; use `incrementAndGet`, `updateAndGet` or `compareAndSet`.
- ❌ **Side effects inside `updateAndGet` lambdas** — they may run more than once.
- ❌ **Assuming two atomics updated in sequence are atomic together.**
- ❌ **Using `AtomicLong` for hot metrics** under heavy contention — `LongAdder` scales far better.

## Best Practices

- ✅ Use `AtomicInteger`/`AtomicLong` for simple counters and sequence numbers.
- ✅ Use `AtomicReference` + an immutable value object for multi-field atomic state.
- ✅ Use `LongAdder` for high-throughput statistics.
- ✅ Keep update functions pure.
- ✅ Switch to a lock when logic involves several variables or I/O.

## Key Takeaways

- ✅ Atomic classes provide lock-free, thread-safe single-variable operations.
- ✅ They're built on CAS: compare, and swap only if unchanged; otherwise retry.
- ✅ Lock-free means no blocking and no deadlock, but possible retries under contention.
- ✅ The ABA problem is solved with version stamps (`AtomicStampedReference`).
- ✅ `LongAdder` beats `AtomicLong` for heavily contended counters.
