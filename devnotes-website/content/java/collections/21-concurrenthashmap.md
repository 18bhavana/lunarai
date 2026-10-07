---
title: ConcurrentHashMap
subtitle: Thread-safe maps without a global lock — Java 7 segments vs Java 8 CAS + bin locking, atomic compound operations, weakly consistent iterators and LongAdder.
order: 21
---

## Introduction

`ConcurrentHashMap` is one of the most important Java collections for senior-level interviews, especially for questions involving multithreading, concurrent access, thread safety, atomic operations, high-throughput applications, caching, counters and Java 8+ concurrency. The central idea:

> ConcurrentHashMap allows multiple threads to safely access and update a Map concurrently **without locking the entire Map** for every operation.

| Map | Speed | Thread-safe |
| --- | --- | --- |
| HashMap | Fast | ❌ No |
| ConcurrentHashMap | Fast + concurrent | ✅ Yes |

## What Is ConcurrentHashMap?

Package:

```java
java.util.concurrent.ConcurrentHashMap
```

It implements `ConcurrentMap<K,V>` → `Map<K,V>`.

```flow-h
Map
ConcurrentMap
ConcurrentHashMap
```

```java
Map<String, Integer> map = new ConcurrentHashMap<>();
```

## Why Do We Need ConcurrentHashMap?

```java
HashMap<String, Integer> map = new HashMap<>();
```

Now multiple threads perform `put()`, `get()`, `put()` and `remove()` at the same time. `HashMap` doesn't provide the necessary thread-safety guarantees for concurrent mutation. You could synchronize:

```java
synchronized (map) {
    map.put(key, value);
}
```

But now **Thread 1 locks the entire map** and Threads 2, 3 and 4 all wait. This limits concurrency. `ConcurrentHashMap` is designed to allow much more concurrent access.

### Main Goal

ConcurrentHashMap tries to achieve **thread safety + high concurrency + good performance**, rather than **thread safety + one giant lock**.

### HashMap vs ConcurrentHashMap

| Feature | HashMap | ConcurrentHashMap |
| --- | --- | --- |
| Thread-safe | ❌ No | ✅ Yes |
| Concurrent reads | Not guaranteed | ✅ Yes |
| Concurrent updates | ❌ No | ✅ Yes |
| Null key | One allowed | ❌ Not allowed |
| Null value | Allowed | ❌ Not allowed |
| Ordering | None guaranteed | None guaranteed |
| Basic operations | O(1) average | O(1) average |
| Atomic Map operations | Limited | ✅ Yes |
| Intended for concurrency | ❌ No | ✅ Yes |

## Why Doesn't ConcurrentHashMap Allow Null?

A **very common** interview question.

```java
map.put(null, value);   // NullPointerException
map.put(key, null);     // also not allowed
```

### Why Are Nulls Prohibited?

The major reason is **ambiguity in concurrent operations**. If `map.get(key)` returns `null`, does that mean:

1. the key doesn't exist, or
2. the key exists with a null value?

For ConcurrentHashMap, eliminating null values removes this ambiguity — particularly important for atomic/concurrent APIs.

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.put("A", 10);     // valid
map.put("B", null);   // NullPointerException
```

## Java 7 vs Java 8+ Architecture

This is **extremely important** for interviews.

### Java 7 — Segments

ConcurrentHashMap used **Segments**. Each segment acted somewhat like an independently lockable portion.

```tree A thread modifying Segment 0 doesn't necessarily block another thread modifying Segment 3
ConcurrentHashMap (Java 7)
  Segment 0
  Segment 1
  Segment 2
  Segment 3
```

### Java 8+ — CAS and bin-level synchronization

The segmented architecture was **removed**. The implementation uses:

- **CAS**
- **volatile** operations
- **bin-level synchronization**
- **tree bins** for heavy collisions

This is the architecture you should focus on for modern Java interviews.

### Why Was Segmentation Removed?

Java 8 introduced a more fine-grained design. Instead of large segment locks, the implementation can synchronize **much smaller portions** of the table when necessary — only the relevant bin may need locking for certain updates. This provides better concurrency and flexibility.

```buckets Only the relevant bin is coordinated during an update
0:
1: Thread A updating
2:
3: Thread B updating
4:
```

### Java 8+ Internal Structure

```tree
ConcurrentHashMap
  table[]
    bins
      Node chain | Node → Node → Node
      TreeBin | Red-Black Tree under heavy collisions
```

## CAS and Volatile

### CAS

CAS means **Compare-And-Swap**.

```flow-h
Expected value
Compare
If unchanged
Replace atomically
```

For example: `current = null`, `expected = null`, `newNode = X` → `CAS(current, null, X)`. If another thread changed the location first, **CAS fails**, and the operation can retry or take another path.

### Why CAS Is Useful

CAS allows certain operations to happen **without taking a traditional lock**.

```flow This is one of the foundations of high-concurrency Java data structures
Thread A
CAS → success
---
Thread B
CAS → failure
retry
```

### Volatile Reads

ConcurrentHashMap also relies heavily on **memory-visibility guarantees**: Thread A writes → memory visibility → Thread B reads. Volatile semantics help ensure threads see appropriate updates. You don't need to memorize every internal memory-barrier detail for most interviews. The key terms are **CAS, volatile, synchronization**.

## Locking Behaviour

### Does ConcurrentHashMap Lock the Entire Map?

**No.** This is one of the biggest differences from `Collections.synchronizedMap(...)`, which typically uses a single synchronization mechanism around operations. ConcurrentHashMap uses a much more fine-grained approach:

```refs Threads can make progress concurrently where the implementation permits
Thread A -> Bin 1
Thread B -> Bin 8
Thread C -> Bin 15
```

### Important Clarification

> [!WARNING]
> Don't say *"ConcurrentHashMap never locks."* That's incorrect. Modern ConcurrentHashMap can use synchronization for certain updates, particularly when modifying an occupied bin.

The better statement: *it avoids a single global lock and uses fine-grained synchronization combined with CAS and volatile operations.*

### get() Operation

```java
map.get(key);
```

```flow-h Reads are designed to be highly concurrent
key
hash
table index
bin
find matching key
return value
```

### Are Reads Locked?

Normally, simple reads such as `get()` and `containsKey()` do **not** require locking the entire Map. This is a major reason ConcurrentHashMap scales much better than a single-lock approach for read-heavy workloads.

### put() Operation

```flow This is a simplified mental model, not the exact source-code algorithm
put(key, value)
calculate hash
find bin
? Empty? | Yes: CAS insert | No: synchronize bin, then update/insert
```

### Empty Bin + CAS

If the target bin is empty, the implementation can often attempt to insert using CAS: **empty bin → CAS(null, newNode) → success**. No conventional lock is required for that insertion path.

### Occupied Bin

If the bin already contains nodes (`Node → Node → Node`), the implementation may **synchronize on an appropriate node/bin structure** while modifying that bin. This prevents conflicting updates to that portion of the table.

### Why Fine-Grained Locking Helps

Thread A on Bin 2 and Thread B on Bin 9 may proceed concurrently. Contrast this with `synchronizedMap` → one lock → only one thread at a time. This is the key scalability advantage.

## Collisions, Tree Bins and Resizing

### Hash Collisions

ConcurrentHashMap still has to deal with hash collisions — e.g. Keys A, B and C all → bucket 5 (`A → B → C`). If collisions become heavy enough, tree-based structures can be used.

### Tree Bins

Similar to modern HashMap, ConcurrentHashMap can use tree bins: **many collisions → TreeBin → Red-Black Tree**. This prevents a heavily contended/collided bin from degrading into a long linear chain.

### Treeification Threshold

You may encounter `TREEIFY_THRESHOLD = 8` and `MIN_TREEIFY_CAPACITY = 64`. These are implementation details and should not be treated as universal API guarantees. For interviews: **know that sufficiently collision-heavy bins can become tree-based.**

### Resize

ConcurrentHashMap also needs resizing when the table becomes sufficiently full: small table → threshold exceeded → resize → larger table. But resizing is designed to happen **concurrently**.

### Concurrent Resizing

One impressive feature is that **multiple threads can participate in resizing** — threads encountering the resize can help transfer bins. This is different from *"one thread locks the entire Map and moves everything."* Modern ConcurrentHashMap has mechanisms for **cooperative resizing**.

### Why Resizing Is Complicated

Other threads may simultaneously perform `get()`, `put()` and `remove()` while buckets are being moved. The implementation uses specialized coordination/state mechanisms so threads can safely interact with the old and new tables during transfer. For interviews: understand **cooperative resizing**, not every source-level transfer detail.

### size()

A common misconception is *"`size()` always takes one global lock."* Not necessarily. ConcurrentHashMap maintains internal **counting mechanisms** designed for concurrency (counters/cells that may be aggregated). For interview purposes: its size accounting is designed to work efficiently under concurrent updates.

### mappingCount()

```java
map.mappingCount();
```

returns a `long`, because a very large concurrent map can conceptually exceed the `int` range used by `Map.size()`. For most applications `size()` is sufficient, but `mappingCount()` is worth knowing.

### isEmpty() and Stale Answers

```java
map.isEmpty();
```

> [!NOTE]
> In a concurrently changing Map, the answer describes the state observed at that point and **can become stale immediately** — another thread may change the map right after you check.

### No Snapshot Semantics

`map.size()` doesn't mean *"freeze the Map and calculate an immutable snapshot."* Likewise, iteration doesn't represent a guaranteed immutable snapshot.

### No Ordering Guarantee

ConcurrentHashMap doesn't guarantee insertion order or sorted order. For insertion order use `LinkedHashMap`; for sorted concurrent keys use **`ConcurrentSkipListMap`**.

## Weakly Consistent Iterators

This is a major interview topic. ConcurrentHashMap iterators are **weakly consistent** — they do not behave like ordinary fail-fast iterators.

### What Does Weakly Consistent Mean?

```java
for (String key : map.keySet()) {
    // ...
}
```

while another thread modifies the Map. The iterator:

- Does **not** throw `ConcurrentModificationException` merely because concurrent updates occur.
- **May** reflect some updates made after iteration begins.
- Is **not** guaranteed to provide a snapshot of the Map at one exact moment.

Think: iteration sees a **moving** Map — safe from fail-fast CME, but not a snapshot.

### Fail-Fast vs Weakly Consistent vs Snapshot

| Collection | Iterator style | Behaviour |
| --- | --- | --- |
| ArrayList, HashMap | Fail-fast | Concurrent modification may throw `ConcurrentModificationException` |
| ConcurrentHashMap | Weakly consistent | Doesn't fail; may see some changes; not a snapshot |
| CopyOnWriteArrayList | Snapshot-style | Iterates a stable snapshot taken at the start |

These are three different concepts.

### Is ConcurrentHashMap's Iterator Fail-Safe?

You will often hear *"ConcurrentHashMap has fail-safe iterators."* This terminology is common in interview discussions, but **"weakly consistent"** is the more precise JDK terminology. Use it in a senior-level interview.

### Example

```java
// Thread 1
for (Integer key : map.keySet()) {
    System.out.println(key);
}
```

```java
// Thread 2
map.put(100, "X");
```

The iterator does not simply fail because of that concurrent modification — but you should not assume it must see `100` either. The iteration is **not a snapshot**.

### Weakly Consistent Views

`keySet()`, `values()` and `entrySet()` provide views designed for concurrent use. Iteration over them is weakly consistent: **safe under concurrent modification + not a snapshot + may reflect some concurrent changes**.

### Modifying While Iterating

```java
for (String key : map.keySet()) {
    map.put("X", 10);
}
```

With ConcurrentHashMap this doesn't inherently produce the fail-fast behaviour associated with HashMap iterators. However, modifying a collection while traversing it can still have application-level consequences, so don't treat weak consistency as *"iteration sees everything predictably."*

## Atomic Compound Operations

### putIfAbsent()

One of the most useful methods. Naive approach:

```java
if (!map.containsKey(key)) {
    map.put(key, value);
}
```

This is **not atomic**. Two threads can both call `containsKey` → `false`, then both `put` — a **race condition**.

Correct approach:

```java
map.putIfAbsent(key, value);
```

This provides an **atomic compound operation**: *if absent + put* happens as one Map operation.

### computeIfAbsent()

```java
map.computeIfAbsent(key, k -> createValue(k));
```

Meaning: if the key isn't present, compute and associate the value. Especially useful for caches, grouping, per-key state and lazy initialization.

### Example — Grouping

```java
ConcurrentHashMap<String, List<Integer>> map = new ConcurrentHashMap<>();

map.computeIfAbsent("Java", k -> new ArrayList<>()).add(10);
```

Result: `Java → [10]`. If `Java` already exists, the existing list is returned.

### Important Concurrency Caveat

> [!IMPORTANT]
> `computeIfAbsent()` makes the **Map operation** atomic, but that does **not** automatically make the **mutable value** thread-safe. `ConcurrentHashMap<String, List<Integer>>` doesn't mean the `ArrayList` stored as a value is thread-safe. Reason about **Map concurrency** and **value-object concurrency** separately — a strong senior-level point.

### compute()

```java
map.compute(key, (k, oldValue) -> /* ... */);
```

Atomically computes a new value. Useful for atomic per-key state transitions.

### merge()

```java
map.merge(key, 1, Integer::sum);
```

Useful for counters: *existing value + new value*, with the remapping function applied atomically for the key.

### Concurrent Counter Example

```java
ConcurrentHashMap<String, Integer> counts = new ConcurrentHashMap<>();

counts.merge("Java", 1, Integer::sum);
```

If `Java → 4`, after the merge `Java → 5`. This is far safer than:

```java
counts.put("Java", counts.get("Java") + 1);
```

because the latter is a **non-atomic read-modify-write** sequence.

### Why get() + put() Is Dangerous

```java
Integer value = map.get("Java");
map.put("Java", value + 1);
```

```flow-h Expected 12, actual 11 — a lost update
Thread A reads 10
Thread B reads 10
A writes 11
B writes 11
```

Use `merge()` or another suitable atomic approach.

### Atomicity Is Usually Per-Key

Methods such as `putIfAbsent()`, `compute()`, `computeIfAbsent()`, `computeIfPresent()`, `merge()` and `replace()` provide atomic semantics **for their Map operation**. But don't infer that *every sequence of multiple Map operations is automatically atomic*:

```java
if (map.containsKey(a) && map.containsKey(b)) {
    // ...
}
```

is **not** one atomic transaction.

### Compound Operations Cheat Sheet

| Not atomic | Atomic alternative |
| --- | --- |
| `if (!map.containsKey(k)) { map.put(k, v); }` | `map.putIfAbsent(k, v);` |
| `map.put(k, map.get(k) + 1);` | `map.merge(k, 1, Integer::sum);` |

### replace()

```java
map.replace(key, oldValue, newValue);
```

Compare-and-replace semantics: *if current == oldValue, replace with newValue* — atomic for that mapping.

### replaceAll() and forEach()

```java
map.replaceAll((key, value) -> /* ... */);

map.forEach((key, value) -> /* ... */);
```

Don't interpret `replaceAll()` as an atomic transaction over the entire Map. Concurrent collections provide strong guarantees for **individual operations**, not arbitrary multi-operation business transactions. Bulk traversal methods (and parallel bulk-operation APIs) are designed with concurrent Map semantics in mind rather than requiring you to freeze the entire Map.

### putIfAbsent() vs computeIfAbsent()

| Situation | Use |
| --- | --- |
| Value already available | `map.putIfAbsent(key, value)` |
| Value should be created lazily | `map.computeIfAbsent(key, k -> createValue(k))` |

### replace() vs put()

`map.put(key, newValue)` **unconditionally** inserts/replaces. `map.replace(key, oldValue, newValue)` only replaces if the current value matches the expected old value — useful for atomic conditional updates.

### Compare-and-Set Mental Model

*Current value == expected? → Yes → replace.* This is similar conceptually to CAS-style coordination and useful for simple state transitions.

### Example — State Transition

An order is `NEW` and you want `NEW → PROCESSING`:

```java
map.replace(orderId, "NEW", "PROCESSING");
```

The operation succeeds only if the expected current state is still `"NEW"`.

## computeIfAbsent() Details

### Avoid Recursive Mutation

Don't perform complex Map mutations from inside the mapping function that recursively modify the same Map — e.g. a mapping function that calls `computeIfAbsent()` on the same map again. Keep mapping functions **simple, side-effect controlled and non-recursive** where practical.

### Mapping Function Should Not Return Null

For `computeIfAbsent()`, if the mapping function returns `null`, **the mapping isn't inserted**. This differs from ordinary `put()` because ConcurrentHashMap doesn't permit null values.

### merge() and Null

Since ConcurrentHashMap doesn't allow null values, a remapping function returning `null` **removes** an existing mapping according to the `Map.merge()` contract.

### compute() Returning Null

```java
map.compute(key, (k, v) -> null);
```

If a mapping exists, returning `null` removes it. If no mapping exists, it remains absent. This follows the `Map.compute()` semantics.

### Does ConcurrentHashMap Guarantee Only One Computation?

For `computeIfAbsent`, the mapping function is applied **atomically for the key** according to the method's contract. Multiple threads don't simply perform an uncontrolled check-then-put race for the same missing key. However, mapping functions should still be written carefully and should not assume arbitrary global serialization across unrelated keys.

### Per-Key Atomicity

Operations on **key A** and **key B** are each atomic, and ConcurrentHashMap is designed to allow operations on unrelated keys to proceed concurrently where possible. This is one reason it scales well.

## Real-World Patterns

### Atomic Counter Pattern

```java
ConcurrentHashMap<String, Long> counts = new ConcurrentHashMap<>();

counts.merge("login", 1L, Long::sum);
```

Much better than `counts.put("login", counts.getOrDefault("login", 0L) + 1);`, which isn't atomic.

### Frequency Map

```java
ConcurrentHashMap<String, Integer> frequency = new ConcurrentHashMap<>();

frequency.merge(word, 1, Integer::sum);
```

Useful for concurrent log processing, event counting, request counters and metrics aggregation.

### Cache Pattern

```java
ConcurrentHashMap<String, User> cache = new ConcurrentHashMap<>();

User user = cache.computeIfAbsent(userId, this::loadUser);
```

```flow-h The Map operation is designed to be safe under concurrent access
lookup
missing?
load
store
return
```

Advantages: thread-safe Map + atomic per-key initialization + no explicit global lock. But production caches often also need **TTL, maximum size, eviction, refresh and metrics** — ConcurrentHashMap alone doesn't provide those policies.

### LongAdder and ConcurrentHashMap

A popular high-performance counter pattern. Instead of `ConcurrentHashMap<String, Long>`, use `ConcurrentHashMap<String, LongAdder>`:

```java
ConcurrentHashMap<String, LongAdder> counts = new ConcurrentHashMap<>();

counts.computeIfAbsent("requests", k -> new LongAdder()).increment();
```

This can reduce contention for heavily updated counters.

### Why LongAdder?

With many threads incrementing the same counter, an `AtomicLong` is **one shared counter → high contention**. `LongAdder` can spread updates across internal cells and combine them when reading — especially useful for high-contention metrics.

```flow-h Excellent production-level pattern
key
LongAdder
concurrent increments
```

### Mutable Values Are Still Your Problem

```java
ConcurrentHashMap<String, ArrayList<Integer>> map = new ConcurrentHashMap<>();

map.computeIfAbsent("A", k -> new ArrayList<>()).add(10);
```

The Map operation may be thread-safe, but concurrent `.add()` calls on the same `ArrayList` are **not** automatically made safe by the Map. Alternatives include `CopyOnWriteArrayList` or `Collections.synchronizedList`, depending on workload.

## Performance and Hashing

### Hash Distribution Still Matters

ConcurrentHashMap is hash-based. Poor `hashCode()` implementations can still cause collisions and increased contention/work in a bin. Good hash distribution remains important.

### Hash Collision ≠ Thread Collision

| Concept | Meaning |
| --- | --- |
| Hash collision | Two keys map to the same bin (A → bin 4, B → bin 4) |
| Thread contention | Multiple threads compete to modify the same shared state |

They can be related (many keys in the same bin → more localized contention), but they are not the same thing.

### Typical Complexity

| Operation | Complexity |
| --- | --- |
| get() | O(1) average |
| put() | O(1) average |
| remove() | O(1) average |

Subject to hashing, collisions, resizing, contention and implementation details. Tree bins can make heavily collided lookup behaviour logarithmic within the tree structure.

### Is ConcurrentHashMap Faster Than HashMap?

Not necessarily for **single-threaded** workloads — HashMap has less concurrency-related machinery. The advantage appears when **multiple threads share a Map**. Don't say *"ConcurrentHashMap is always faster."* Better: *"It is designed to provide much better concurrency and scalability than coarse-grained synchronization, while retaining efficient average Map operations."*

### Is ConcurrentHashMap Lock-Free?

**No** — another common trap. It uses **CAS + volatile + synchronization**. Some operations may proceed without locking, but the overall data structure is not simply "lock-free."

### Why HashMap Is Not Thread-Safe

Simplistic answer: *"Because multiple threads can modify it."* Better answer: *HashMap doesn't provide the synchronization and memory-visibility guarantees required for concurrent mutation. Concurrent operations can race, producing lost updates and inconsistent observations, and compound operations such as check-then-act are not atomic.*

## Comparisons

### ConcurrentHashMap vs Hashtable

| Hashtable | ConcurrentHashMap |
| --- | --- |
| Legacy | Modern |
| Synchronized methods | Fine-grained concurrency |
| Coarser locking | High throughput |
| — | Atomic compound operations |
| No null key/value | No null key/value |

### Why Is Hashtable Usually Slower?

Hashtable: **one synchronized method → coarse-grained contention**. ConcurrentHashMap: **fine-grained coordination + CAS + volatile + localized synchronization**. Therefore more threads can make progress concurrently.

### ConcurrentHashMap vs synchronizedMap()

```java
Map<K,V> map = Collections.synchronizedMap(new HashMap<>());
```

This provides synchronization around Map operations, but generally uses a **common lock**. ConcurrentHashMap offers better concurrency, weakly consistent iteration and atomic concurrent Map methods.

| Feature | synchronizedMap | ConcurrentHashMap |
| --- | --- | --- |
| Thread-safe | ✅ Yes | ✅ Yes |
| Synchronization | Common lock | Highly concurrent |
| Fine-grained concurrency | Limited | ✅ Yes |
| Concurrent reads | Serialized by wrapper locking | ✅ Yes |
| Null key | Depends on backing Map | ❌ No |
| Null value | Depends on backing Map | ❌ No |
| Weakly consistent iterator | ❌ No | ✅ Yes |
| Atomic `computeIfAbsent()` | Depends on Map default semantics | Designed for concurrent use |
| High-throughput concurrency | Lower | Better |

### ConcurrentHashMap vs CopyOnWriteArrayList

These solve different problems: **ConcurrentHashMap** → concurrent key-value access; **CopyOnWriteArrayList** → concurrent list access with many reads/few writes. Choose based on the data structure required.

### ConcurrentHashMap vs ConcurrentSkipListMap

| ConcurrentHashMap | ConcurrentSkipListMap |
| --- | --- |
| Unordered | Sorted |
| Average O(1) | O(log n) |

If you need `floorKey()`, `ceilingKey()` or range queries in a concurrent environment, **ConcurrentSkipListMap** is often the appropriate choice.

## Common Interview Traps

| Question | Answer |
| --- | --- |
| Is `ConcurrentHashMap<String, List<String>>` fully thread-safe? | ❌ No — mapping operations are concurrent-safe, but the `List` values may not be. |
| Can I store null? | ❌ No — neither `put(null, value)` nor `put(key, null)`. |
| Does it lock the entire Map during `put()`? | ❌ No — fine-grained coordination, not one global lock. |
| Is it completely lock-free? | ❌ No — CAS + volatile + synchronization, depending on the bin/table state. |
| Is its iterator fail-safe? | Prefer **weakly consistent**: no CME merely because of concurrent modifications, and no snapshot semantics. |
| Why not synchronize HashMap manually? | You can, but coarse-grained locking reduces concurrency. |
| Why not use Hashtable? | Legacy synchronized Map with coarser synchronization — ConcurrentHashMap is generally preferred. |
| Is `get()` atomic? | A single `get()` has well-defined concurrent behaviour, but `get() + get() + put()` as a sequence is not atomic. |
| Is `if (!map.containsKey(k)) map.put(k, v);` thread-safe? | ❌ No — use `map.putIfAbsent(k, v)`. |
| Is `map.put(key, map.get(key) + 1);` thread-safe? | ❌ No — use `map.merge(key, 1, Integer::sum)` or a `LongAdder` pattern. |

## Coding Questions

### putIfAbsent on an existing key

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.put("A", 10);
map.putIfAbsent("A", 20);

System.out.println(map.get("A"));
```

```output
10
```

Because `A` already exists.

### merge()

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.put("A", 10);
map.merge("A", 5, Integer::sum);
```

Result: `A → 15`.

### computeIfAbsent()

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.computeIfAbsent("A", k -> 100);
```

Result: `A → 100`. If `A` already exists, the mapping function isn't used to replace the existing mapping.

### compute()

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.put("A", 10);
map.compute("A", (k, v) -> v + 5);
```

Result: `A → 15`.

### replace()

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.put("A", 10);
map.replace("A", 10, 20);
```

Result: `A → 20`. If another thread changes `A` before the conditional replacement, the replacement may fail.

### Null key and null value

```java
ConcurrentHashMap<String, String> map = new ConcurrentHashMap<>();

map.put(null, "A");   // NullPointerException
map.put("A", null);   // NullPointerException
```

### Race condition

Two threads execute:

```java
if (!map.containsKey("A")) {
    map.put("A", 100);
}
```

Could both threads believe `A` is absent? **Yes** — both `containsKey` calls can return `false` before either `put()`. Use `map.putIfAbsent("A", 100);`.

### Counter

Two threads execute `map.put("count", map.get("count") + 1);`. Is this atomic? **No** — a possible lost update. Better:

```java
map.merge("count", 1, Integer::sum);
```

### Iteration

Thread A iterates `map.keySet()` while Thread B calls `map.put(100, "X")`. Does ConcurrentHashMap necessarily throw `ConcurrentModificationException`? **No** — its iterators are weakly consistent.

## Senior Interview Questions

### Explain ConcurrentHashMap architecture in Java 8+.

Java 8+ ConcurrentHashMap no longer uses the old Segment-based architecture from Java 7. It uses a table of bins, CAS for certain initialization/update paths, volatile memory semantics for visibility, and synchronized blocks on specific bins when required. Collision-heavy bins can use tree structures. This provides much finer-grained concurrency than locking the entire Map.

### Why is ConcurrentHashMap better than synchronizedMap for high concurrency?

A synchronized Map typically serializes operations through a common lock, whereas ConcurrentHashMap uses a more fine-grained concurrency design. Reads can proceed concurrently, and updates generally coordinate only around the relevant part of the table, allowing unrelated operations to make progress concurrently.

### Why doesn't ConcurrentHashMap allow null?

Null would make the result of operations such as `get()` ambiguous, because `null` could mean either "no mapping" or "mapping exists with a null value." ConcurrentHashMap's atomic and concurrent APIs avoid this ambiguity by prohibiting null keys and values.

### What is the difference between fail-fast and weakly consistent iterators?

A fail-fast iterator detects certain structural modifications and may throw `ConcurrentModificationException`. A weakly consistent iterator, as used by ConcurrentHashMap, can iterate while concurrent modifications occur without failing merely because of those modifications. It may reflect some concurrent changes and doesn't represent a guaranteed snapshot.

### Why is containsKey() + put() unsafe?

Because it is a **check-then-act** sequence — the state can change between the two operations. Use `putIfAbsent()` for the atomic operation.

### Why is get() + put() unsafe for counters?

Because **read + modify + write** is not one atomic operation. Use `merge()` or a suitable counter structure.

### Does ConcurrentHashMap guarantee snapshot iteration?

No. Its iterators are weakly consistent, not snapshot iterators.

### Does ConcurrentHashMap guarantee ordering?

No — neither insertion order nor sorted order. Use `ConcurrentSkipListMap` when concurrent sorted-key behaviour is required.

### Can ConcurrentHashMap make its values thread-safe?

No. If the value is an `ArrayList`, it is still an `ArrayList`. Map thread safety and value-object thread safety are separate concerns.

### What is CAS?

CAS, or Compare-And-Swap, atomically checks whether a memory location still contains an expected value and, if so, replaces it with a new value. ConcurrentHashMap uses CAS for certain low-level concurrent update paths.

### What happens during heavy hash collisions?

Many keys → same bin → collision chain → treeification when conditions are met → TreeBin / Red-Black Tree. This helps maintain better lookup behaviour under collision-heavy conditions.

### Does ConcurrentHashMap use segments?

Java 7 used segmentation; Java 8+ removed the Segment-based architecture and uses finer-grained bin-level coordination with CAS and synchronization.

### What changed between Java 7 and Java 8?

| Java 7 | Java 8+ |
| --- | --- |
| Segments | CAS |
| | Bin-level synchronization |
| | Volatile operations |
| | Tree bins |
| | Cooperative resizing |

One of the most frequently asked ConcurrentHashMap questions.

## Decision Framework

```flow
Need a Map
? Multiple threads access/update it? | No: HashMap | Yes: need sorted keys?
---
Need sorted keys?
? Sorted? | Yes: ConcurrentSkipListMap | No: ConcurrentHashMap
```

If you need insertion/access order, ConcurrentHashMap doesn't provide it — you need a different concurrency design.

### Complete Map Selection

```tree
Map
  HashMap | general fast lookup
  LinkedHashMap | insertion/access order
  TreeMap | sorted keys
  WeakHashMap | weak keys
  IdentityHashMap | identity keys
  EnumMap | enum keys
  ConcurrentHashMap | concurrent unordered Map
  ConcurrentSkipListMap | concurrent sorted Map
```

### Final Mental Model

```tree
ConcurrentHashMap | fine-grained concurrency · high throughput
  CAS
  Volatile
  Synchronization
```

| Map | Thread safety | Concurrency model |
| --- | --- | --- |
| HashMap | ❌ Not thread-safe | — |
| synchronizedMap | ✅ Thread-safe | Coarse-grained locking |
| ConcurrentHashMap | ✅ Thread-safe | Fine-grained concurrency, atomic Map operations, weakly consistent iterators |

## Map Interview Master Table

| Map | Ordering | Thread-safe | Key semantics | Internal idea | Best use |
| --- | --- | --- | --- | --- | --- |
| HashMap | None guaranteed | ❌ | `equals()` / `hashCode()` | Hash table | General lookup |
| LinkedHashMap | Insertion/access | ❌ | `equals()` / `hashCode()` | Hash table + links | Ordered Map / LRU |
| TreeMap | Sorted | ❌ | Comparable / Comparator | Red-Black Tree | Sorted/range operations |
| WeakHashMap | None guaranteed | ❌ | Weak keys | Weak references | Lifecycle-sensitive metadata |
| IdentityHashMap | None guaranteed | ❌ | `==` | Array + probing | Object identity |
| EnumMap | Enum declaration order | ❌ | Enum keys | Array-based | Enum → value |
| ConcurrentHashMap | None guaranteed | ✅ | `equals()` / `hashCode()` | Concurrent hash table | High-concurrency Map |
| ConcurrentSkipListMap | Sorted | ✅ | Ordering | Skip list | Concurrent sorted Map |

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| ConcurrentHashMap | Thread-safe concurrent Map |
| Package | `java.util.concurrent` |
| Java 7 | Segment-based architecture |
| Java 8+ | CAS + bin-level synchronization + volatile |
| Entire Map lock | ❌ No |
| Concurrent reads | ✅ Yes |
| Concurrent updates | ✅ Yes |
| Average get() / put() | O(1) |
| Null key / null value | ❌ Not allowed |
| Ordering | None guaranteed |
| Tree bins | ✅ Yes |
| CAS | Used in concurrent update paths |
| Resizing | Cooperative/concurrent |
| Iterator | Weakly consistent |
| Fail-fast | ❌ No |
| Snapshot iterator | ❌ No |
| `putIfAbsent()` | Atomic conditional insertion |
| `computeIfAbsent()` | Atomic lazy computation |
| `compute()` | Atomic per-key computation |
| `merge()` | Atomic per-key merge |
| `replace()` | Conditional replacement |
| Thread-safe values | Not automatically |
| High-contention counters | LongAdder can help |
| Concurrent sorted Map | ConcurrentSkipListMap |

### Interview Readiness Checklist

- Why HashMap isn't thread-safe and why ConcurrentHashMap exists
- Java 7 Segment architecture vs Java 8+ architecture
- CAS, volatile semantics, bin-level synchronization
- Why the whole Map isn't locked; concurrent reads and writes
- Hash collisions, tree bins and treeification
- Resizing and cooperative resizing
- Why null keys/values aren't allowed
- `putIfAbsent()`, `computeIfAbsent()`, `compute()`, `merge()`, `replace()`
- Atomic vs non-atomic compound operations
- Weakly consistent iterators; fail-fast vs weakly consistent
- ConcurrentHashMap vs HashMap / Hashtable / synchronizedMap / ConcurrentSkipListMap
- ConcurrentHashMap + LongAdder
- Why a thread-safe Map doesn't make mutable values thread-safe
- Real-world cache/counter patterns
