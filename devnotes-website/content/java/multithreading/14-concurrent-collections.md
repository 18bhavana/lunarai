---
title: Concurrent Collections
subtitle: Synchronized wrappers vs concurrent collections, fail-fast vs fail-safe (weakly consistent and snapshot) iterators, ConcurrentHashMap atomic operations, CopyOnWriteArrayList, the BlockingQueue family and ConcurrentLinkedQueue.
order: 14
---

## Introduction

Standard collections like `ArrayList` and `HashMap` are **not thread-safe**: concurrent modification can lose entries, corrupt internal structure or throw exceptions. Java offers two ways to fix that — **synchronized wrappers** (lock everything) and the **concurrent collections** in `java.util.concurrent` (designed for concurrency from the ground up).

> [!TIP]
> `ConcurrentHashMap` internals are covered in depth in the Collections topic (*ConcurrentHashMap*). This chapter focuses on choosing and using concurrent collections correctly.

## Option 1 — Synchronized Wrappers

```java
List<String> list = Collections.synchronizedList(new ArrayList<>());
Map<String, Integer> map = Collections.synchronizedMap(new HashMap<>());
```

Every method locks **one shared lock**. Simple, but:

- all threads contend for the same lock, so throughput is poor under load;
- **compound actions** (check-then-act) still need external locking;
- **iteration** requires holding the lock for the whole loop.

```java
synchronized (list) {          // required — otherwise ConcurrentModificationException is possible
    for (String s : list) {
        process(s);
    }
}
```

`Vector` and `Hashtable` are legacy classes with the same "lock every method" approach.

## Option 2 — Concurrent Collections

| Interface | Not thread-safe | Concurrent alternative |
| --- | --- | --- |
| `Map` | `HashMap` | `ConcurrentHashMap` |
| `SortedMap` | `TreeMap` | `ConcurrentSkipListMap` |
| `Set` | `HashSet` | `ConcurrentHashMap.newKeySet()` |
| `SortedSet` | `TreeSet` | `ConcurrentSkipListSet` |
| `List` (read-mostly) | `ArrayList` | `CopyOnWriteArrayList` |
| `Queue` | `LinkedList`, `ArrayDeque` | `ConcurrentLinkedQueue`, `BlockingQueue` implementations |
| `Deque` | `ArrayDeque` | `ConcurrentLinkedDeque`, `LinkedBlockingDeque` |

## Fail-Fast vs Fail-Safe Iterators

In Java, *fail-fast* and *fail-safe* describe how iterators behave when a collection is **modified during iteration**.

### Fail-Fast Iterators

- Throw **`ConcurrentModificationException`** if the collection is structurally modified (`add()`, `remove()`) during iteration — by another thread **or by the same thread** outside the iterator.
- Work directly on the original collection.
- Track changes with an internal **`modCount`**: the iterator records it at creation and checks it on every `next()`; if it changed, it throws.
- Used by the non-concurrent collections: `ArrayList`, `LinkedList`, `HashSet`, `HashMap` and so on.

```java
List<String> names = new ArrayList<>(List.of("a", "b", "c"));
for (String n : names) {
    if (n.equals("b")) names.remove(n);   // ConcurrentModificationException
}

names.removeIf(n -> n.equals("b"));        // ✅ safe way to remove while iterating
```

> [!NOTE]
> Fail-fast behaviour is **best-effort**, not guaranteed — the Javadoc says it shouldn't be relied on for correctness. It's a bug-detection aid; under real concurrent modification you may get corrupted data instead of an exception.

### Fail-Safe Iterators

- Don't throw `ConcurrentModificationException`, even if the collection is modified during iteration.
- Used by concurrent collections from `java.util.concurrent`.

But they don't all work the same way — there are **two kinds**:

| Kind | How it works | Sees changes made during iteration? | Examples |
| --- | --- | --- | --- |
| **Snapshot** | Iterates over an immutable **copy** of the array taken when the iterator was created | ❌ Never | `CopyOnWriteArrayList`, `CopyOnWriteArraySet` |
| **Weakly consistent** | Iterates the **live** structure, tolerating concurrent changes | ⚠️ May or may not reflect them | `ConcurrentHashMap`, `ConcurrentLinkedQueue`, `ConcurrentSkipListMap`, `LinkedBlockingQueue` |

> [!IMPORTANT]
> A common misconception is that *all* fail-safe iterators work on a cloned copy. Only the **copy-on-write** collections do. `ConcurrentHashMap` does **not** copy the map — its iterator is *weakly consistent*: it never throws, never returns an element twice, and reflects some or none of the modifications made after it was created.

| | Fail-fast | Fail-safe (snapshot / weakly consistent) |
| --- | --- | --- |
| Exception on concurrent modification | `ConcurrentModificationException` | None |
| Works on | The original collection | A snapshot copy, or the live structure |
| Memory overhead | None | Copy-on-write: a full copy per write |
| Sees latest changes | — | Snapshot: no; weakly consistent: maybe |
| Examples | `ArrayList`, `HashMap` | `CopyOnWriteArrayList`, `ConcurrentHashMap` |

## ConcurrentHashMap — Use the Atomic Methods

`ConcurrentHashMap` locks only small parts of the table (per-bin locking plus CAS since Java 8), so many threads can read and write at once. Reads don't lock at all.

But **individual calls being thread-safe doesn't make your logic atomic**:

```java
ConcurrentHashMap<String, Integer> hits = new ConcurrentHashMap<>();

// ❌ Race: two threads read the same value and both write value + 1
Integer current = hits.get(page);
hits.put(page, current == null ? 1 : current + 1);

// ✅ Atomic per key
hits.merge(page, 1, Integer::sum);
```

| Method | Atomic operation |
| --- | --- |
| `putIfAbsent(k, v)` | Insert only if no mapping exists |
| `computeIfAbsent(k, fn)` | Compute and insert if absent — the classic cache loader |
| `computeIfPresent(k, fn)` | Update only if present |
| `compute(k, fn)` | Compute a new value from the old (or `null`) |
| `merge(k, v, fn)` | Insert `v`, or combine with the existing value |
| `remove(k, v)` / `replace(k, old, new)` | Conditional remove / replace |

```java
// A thread-safe local cache: the loader runs at most once per key
Map<Long, Customer> cache = new ConcurrentHashMap<>();
Customer c = cache.computeIfAbsent(id, customerRepository::load);

// Counting with LongAdder values for very hot keys
ConcurrentHashMap<String, LongAdder> counts = new ConcurrentHashMap<>();
counts.computeIfAbsent(event, k -> new LongAdder()).increment();
```

> [!WARNING]
> The function passed to `compute*` / `merge` runs **while part of the map is locked**. Keep it short, and **never modify the same map** inside it — that can deadlock or throw `IllegalStateException`. Also, `ConcurrentHashMap` doesn't allow `null` keys or values (a `null` from `get()` must unambiguously mean "absent").

`size()` is an estimate under concurrent updates; `mappingCount()` returns a `long`.

## CopyOnWriteArrayList

Every write (`add`, `set`, `remove`) **copies the entire underlying array**; reads and iteration use the current array without any locking.

```java
List<OrderListener> listeners = new CopyOnWriteArrayList<>();

listeners.add(auditListener);              // rare: copies the array

for (OrderListener l : listeners) {        // frequent: no lock, no CME
    l.onOrderPlaced(order);
}
```

| Good for | Bad for |
| --- | --- |
| Read-mostly lists — listeners, observers, configuration, routing tables | Frequent writes or large lists — each write is O(n) and allocates a full copy |
| Iterating while other threads modify | Needing to see updates during an ongoing iteration |

Iterators are snapshots and don't support `remove()` (it throws `UnsupportedOperationException`).

## BlockingQueue — the Producer–Consumer Workhorse

A `BlockingQueue` adds operations that **wait** when the queue is empty (on take) or full (on put):

| Operation | Throws | Returns a special value | Blocks | Times out |
| --- | --- | --- | --- | --- |
| Insert | `add(e)` | `offer(e)` → `false` | `put(e)` | `offer(e, time, unit)` |
| Remove | `remove()` | `poll()` → `null` | `take()` | `poll(time, unit)` |
| Examine | `element()` | `peek()` → `null` | — | — |

```java
BlockingQueue<Order> queue = new ArrayBlockingQueue<>(1_000);

// Producer — e.g. a request thread
if (!queue.offer(order, 100, TimeUnit.MILLISECONDS)) {
    throw new ServiceUnavailableException("Order queue full");
}

// Consumer — a background worker
while (!Thread.currentThread().isInterrupted()) {
    Order next = queue.take();    // waits for work
    process(next);
}
```

### Implementations

| Implementation | Characteristics |
| --- | --- |
| `ArrayBlockingQueue` | Bounded, array-backed, one lock; optional fairness |
| `LinkedBlockingQueue` | Optionally bounded (**unbounded by default**), separate locks for head and tail → higher throughput |
| `PriorityBlockingQueue` | Unbounded, ordered by priority / `Comparator` |
| `DelayQueue` | Elements become available only after their delay expires — scheduled retries |
| `SynchronousQueue` | Zero capacity: each `put` waits for a matching `take` — a direct hand-off |
| `LinkedTransferQueue` | `transfer()` waits until a consumer receives the element |
| `LinkedBlockingDeque` | Blocking double-ended queue |

> [!TIP]
> Always give `LinkedBlockingQueue` a capacity in production. Bounded queues provide **back-pressure**: producers slow down or fail fast instead of filling the heap.

### Graceful Shutdown with a Poison Pill

```java
static final Order POISON_PILL = new Order(-1);

// Producer, when done:
queue.put(POISON_PILL);

// Consumer:
while (true) {
    Order o = queue.take();
    if (o == POISON_PILL) break;
    process(o);
}
```

## ConcurrentLinkedQueue

A **non-blocking**, unbounded, lock-free (CAS-based) FIFO queue. `offer` and `poll` never block — `poll()` returns `null` when empty. Use it when threads shouldn't wait for elements; use a `BlockingQueue` when consumers need to wait for work.

## Choosing a Thread-Safe Collection

| Need | Use |
| --- | --- |
| General-purpose thread-safe map / cache | `ConcurrentHashMap` |
| Sorted concurrent map or set | `ConcurrentSkipListMap` / `ConcurrentSkipListSet` |
| Thread-safe set | `ConcurrentHashMap.newKeySet()` |
| Read-mostly list, iterated often | `CopyOnWriteArrayList` |
| Producer–consumer hand-off with back-pressure | `ArrayBlockingQueue` / bounded `LinkedBlockingQueue` |
| Non-blocking queue | `ConcurrentLinkedQueue` |
| Delayed / scheduled items | `DelayQueue` |
| Data that never changes after construction | `List.of`, `Map.of` — immutable collections need no locking at all |

## Interview Questions

### Q1. What is the difference between fail-fast and fail-safe iterators?

Fail-fast iterators (`ArrayList`, `HashMap`) throw `ConcurrentModificationException` when the collection is structurally modified during iteration, detected via `modCount`. Fail-safe iterators (concurrent collections) don't throw: copy-on-write collections iterate a snapshot, while `ConcurrentHashMap` and similar iterate the live structure in a weakly consistent way.

### Q2. Does ConcurrentHashMap's iterator work on a copy?

No — that's true only for `CopyOnWriteArrayList` / `CopyOnWriteArraySet`. `ConcurrentHashMap`'s iterator is weakly consistent: it traverses the live table and may or may not reflect concurrent changes, but never throws `ConcurrentModificationException`.

### Q3. Collections.synchronizedMap vs ConcurrentHashMap?

`synchronizedMap` wraps every method in one lock, so all access is serialized and iteration needs manual locking. `ConcurrentHashMap` uses fine-grained locking and CAS, allows concurrent reads and writes, offers atomic compound operations, and has weakly consistent iterators.

### Q4. Is `if (!map.containsKey(k)) map.put(k, v)` thread-safe on a ConcurrentHashMap?

No — the check and the put are separate calls. Use `putIfAbsent` or `computeIfAbsent`.

### Q5. When would you use CopyOnWriteArrayList?

For lists that are read and iterated far more often than they're modified — listeners, subscribers, configuration. Each write copies the whole array, so it's a poor fit for write-heavy data.

### Q6. What is a BlockingQueue?

A queue whose `put()` waits for space and `take()` waits for an element — the standard building block for producer–consumer designs. Bounded implementations provide back-pressure.

### Q7. Why doesn't ConcurrentHashMap allow null keys or values?

Because in a concurrent map, `get()` returning `null` must mean "absent" — otherwise you couldn't distinguish a `null` value from a missing key without a separate, racy `containsKey()` call.

## Common Mistakes

- ❌ **Using `HashMap` from multiple threads** — lost entries and corrupted state.
- ❌ **Check-then-act on a concurrent map** instead of `putIfAbsent` / `compute*` / `merge`.
- ❌ **Iterating a synchronized wrapper without holding its lock.**
- ❌ **Believing every fail-safe iterator works on a copy.**
- ❌ **`CopyOnWriteArrayList` for write-heavy data.**
- ❌ **Unbounded `LinkedBlockingQueue`** in producer–consumer pipelines.
- ❌ **Modifying the map inside its own `computeIfAbsent` function.**

## Best Practices

- ✅ Prefer concurrent collections over synchronized wrappers.
- ✅ Use the atomic compound methods of `ConcurrentHashMap`.
- ✅ Use bounded blocking queues for producer–consumer hand-offs.
- ✅ Prefer immutable collections for data that doesn't change.
- ✅ Choose by access pattern: read-mostly vs write-heavy, blocking vs non-blocking, sorted vs unsorted.

## Key Takeaways

- ✅ Synchronized wrappers serialize everything; concurrent collections allow real concurrency.
- ✅ Fail-fast iterators throw `ConcurrentModificationException`; fail-safe iterators are either snapshots (copy-on-write) or weakly consistent (`ConcurrentHashMap`).
- ✅ `ConcurrentHashMap` is thread-safe per call — use `merge`, `compute*` and `putIfAbsent` for atomic logic.
- ✅ `CopyOnWriteArrayList` suits read-mostly lists.
- ✅ `BlockingQueue` implements producer–consumer with built-in waiting and back-pressure.
