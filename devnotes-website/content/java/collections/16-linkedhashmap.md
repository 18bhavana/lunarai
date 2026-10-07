---
title: LinkedHashMap
subtitle: HashMap plus predictable ordering — before/after links, insertion vs access order, and building an LRU cache with removeEldestEntry().
order: 16
---

## Introduction

`LinkedHashMap` is essentially **HashMap + predictable ordering**.

```flow-h
HashMap
: + doubly linked list
LinkedHashMap
```

It gives you the fast average lookup characteristics of `HashMap` while maintaining a predictable iteration order.

The two modes you must know for interviews are:

1. **Insertion order**
2. **Access order**

The second one leads directly to the classic **LRU Cache** interview problem.

## What is LinkedHashMap?

Package:

```java
java.util.LinkedHashMap
```

```flow LinkedHashMap inherits HashMap's hashing behaviour and adds ordering information
Map
HashMap
LinkedHashMap | Hash table + linked ordering
```

## Why Does LinkedHashMap Exist?

```java
Map<Integer, String> map = new HashMap<>();
```

You cannot rely on `HashMap` iteration order. If you need *"give me entries in the order they were inserted"*, use:

```java
Map<Integer, String> map = new LinkedHashMap<>();

map.put(3, "C");
map.put(1, "A");
map.put(2, "B");
```

```output
3 → C
1 → A
2 → B
```

## Internal Structure

This is the most important internal concept. A normal HashMap has **table → bucket → Node → Node**. `LinkedHashMap` additionally maintains links between entries: **hash table + doubly linked list**.

```flow-h
head
[A]
<->
[B]
<->
[C]
<->
[D]
tail
```

Each entry participates in:

1. The hash table structure
2. The linked ordering structure

### LinkedHashMap Entry

HashMap's basic node contains **hash, key, value, next**. `LinkedHashMap` adds ordering links **before** and **after**:

```flow-h One LinkedHashMap entry
hash
key
value
next | bucket chain
before | ordering
after | ordering
```

- `next` is associated with the **hash bucket**.
- `before` and `after` maintain the **linked ordering**.

### Two Structures at the Same Time

This is the key to understanding `LinkedHashMap`.

```java
map.put(10, "A");
map.put(20, "B");
map.put(30, "C");
```

```flow
Hash structure
Entries distributed across buckets by hash
Fast lookup
---
Ordering structure
10 ⇄ 20 ⇄ 30
Predictable iteration
```

## Insertion Order

The default constructor uses **insertion-order** behaviour:

```java
Map<Integer, String> map = new LinkedHashMap<>();

map.put(10, "A");
map.put(20, "B");
map.put(30, "C");
```

Iteration: `10, 20, 30`.

### Updating an Existing Key

Important interview detail:

```java
map.put(10, "A");
map.put(20, "B");
map.put(30, "C");
map.put(20, "Updated");
```

Does `20` move to the end? **No**, in normal insertion-order mode. The result is still `10, 20, 30` — only the value changes.

### Why Doesn't Updating Move It?

Because the key already exists. In insertion-order mode:

> The ordering represents the order in which entries were **inserted**, not the order in which values were updated.

So `map.put(existingKey, newValue);` doesn't normally change its position.

## Access Order

`LinkedHashMap` has another mode: **`accessOrder = true`**.

```java
LinkedHashMap<Integer, String> map = new LinkedHashMap<>(16, 0.75f, true);
```

| Last argument | Mode |
| --- | --- |
| `true` | Access order |
| `false` (default) | Insertion order |

### Insertion Order vs Access Order

```flow
Insertion order
10 · 20 · 30
: get(10)
10 · 20 · 30 | unchanged
---
Access order
10 · 20 · 30
: get(10)
20 · 30 · 10 | accessed entry moves to the end
```

The accessed entry moves to the end. **This is the foundation of LRU caches.**

### What Counts as an Access?

In access-order mode, several Map operations can count as an access, including `get()`, `getOrDefault()`, `putIfAbsent()`, `replace()`, `compute()`, `computeIfAbsent()`, `computeIfPresent()` and `merge()` — depending on whether the operation actually accesses/replaces an existing mapping according to the API semantics.

> [!IMPORTANT]
> Access-order LinkedHashMap can **reorder entries** as a result of map operations.

### get() Can Modify LinkedHashMap

This surprises many candidates. With `accessOrder = true`, calling `map.get(key);` can move the accessed entry to the tail. Therefore, unlike an ordinary HashMap lookup:

> A `get()` can cause a structural ordering change in an access-order LinkedHashMap.

This matters during iteration.

### Access Order Example

```java
LinkedHashMap<Integer, String> map = new LinkedHashMap<>(16, 0.75f, true);

map.put(1, "A");
map.put(2, "B");
map.put(3, "C");
```

```flow-h
1 → 2 → 3
: get(2)
1 → 3 → 2
: get(1)
3 → 2 → 1
```

## LRU Cache

LRU means **Least Recently Used**. Suppose the cache capacity is 3:

```flow-h B was least recently used, so it was removed
[A] [B] [C]
: access A
[B] [C] [A]
: insert D
[C] [A] [D]
```

`LinkedHashMap`'s access-order mode makes this pattern extremely convenient.

### Building an LRU Cache

Classic implementation:

```java
class LRUCache<K, V> extends LinkedHashMap<K, V> {

    private final int capacity;

    public LRUCache(int capacity) {
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}
```

Usage:

```java
LRUCache<Integer, String> cache = new LRUCache<>(3);

cache.put(1, "A");
cache.put(2, "B");
cache.put(3, "C");

cache.get(1);

cache.put(4, "D");
```

The least recently used entry (`2`) is automatically removed.

### removeEldestEntry()

This method is the key to the LRU implementation:

```java
protected boolean removeEldestEntry(Map.Entry<K,V> eldest)
```

If it returns `true`, the eldest entry is removed after an insertion. For an LRU cache: `return size() > capacity;`

### Why removeEldestEntry() Is Useful

Without it, you'd need: **insert → check capacity → find least-recently-used entry → remove it**. `LinkedHashMap` already maintains the ordering, so **access-order + `removeEldestEntry()`** gives you a simple LRU cache.

### LRU Logic

With access order: **Head = Least Recently Used … Most Recently Used = Tail**. So the **eldest = least recently used** entry when the map is being used as an LRU cache.

### LRU Example Step-by-Step

Capacity **3**:

```flow
Insert A, B, C
A → B → C
: access A
B → C → A
: access B
C → A → B
: insert D
A → B → D | C removed — least recently used
```

### removeEldestEntry() Subtlety

The method is called **after** a new mapping has been inserted. Therefore the common condition `return size() > capacity;` works naturally: with capacity = 3, inserting the 4th entry makes size = 4, `4 > 3`, so the eldest is removed.

### Is an LRU Cache O(1)?

The standard LinkedHashMap-based implementation provides approximately:

| Operation | Complexity |
| --- | --- |
| get() | O(1) average |
| put() | O(1) average |
| remove eldest | O(1) |

This makes it a very attractive implementation for an in-memory LRU cache. The actual performance still depends on hashing and implementation details.

### Is LinkedHashMap a Thread-Safe LRU Cache?

> [!WARNING]
> **No** — an important trap. `LinkedHashMap` doesn't become thread-safe simply because it implements LRU behaviour. For concurrent applications, additional synchronization/concurrency design is required.

## Comparisons

### LinkedHashMap vs HashMap

| Feature | HashMap | LinkedHashMap |
| --- | --- | --- |
| Hash-based lookup | ✅ | ✅ |
| Average lookup | O(1) | O(1) |
| Ordering guarantee | ❌ | ✅ |
| Insertion order | ❌ | ✅ |
| Access order | ❌ | ✅ |
| Extra links | ❌ | ✅ |
| Memory overhead | Lower | Higher |
| Thread-safe | ❌ | ❌ |

The trade-off: **predictable ordering ↔ additional memory / bookkeeping**.

### LinkedHashMap vs TreeMap

| Feature | LinkedHashMap | TreeMap |
| --- | --- | --- |
| Structure | Hash table + links | Red-Black Tree |
| Ordering | Insertion/access | Sorted keys |
| Average lookup | O(1) | O(log n) |
| Key sorting | ❌ | ✅ |
| LRU support | ✅ | ❌ |
| Null key | One allowed | Generally not |
| Duplicate keys | ❌ | ❌ |

Choose based on the required ordering semantics.

### When to Use Which?

- Use **`HashMap`** when ordering doesn't matter.
- Use **`LinkedHashMap`** when you need predictable insertion order or access order — e.g. an API response that must preserve insertion order.

## Iteration and Views

### entrySet()

Iteration is predictable because the linked structure controls traversal:

```java
for (Map.Entry<Integer, String> entry : map.entrySet()) {
    System.out.println(entry.getKey() + " = " + entry.getValue());
}
```

The iteration follows the LinkedHashMap's ordering mode.

### keySet() and values()

These views also reflect the map's ordering. After `put(3, "C")`, `put(1, "A")`, `put(2, "B")`, `keySet()` iterates `3, 1, 2` and `values()` follows the same entry ordering.

### Does LinkedHashMap Sort Keys?

**No.** This is an important distinction.

```java
map.put(30, "C");
map.put(10, "A");
map.put(20, "B");
```

LinkedHashMap gives `30, 10, 20` — not `10, 20, 30`. If you need sorted keys, use **`TreeMap`**.

## Null, Capacity and Constructors

### Null Keys and Values

`LinkedHashMap` inherits HashMap's basic null behaviour: **one null key** and **multiple null values**.

```java
map.put(null, "A");
map.put(null, "B");
```

Final mapping: `null → B`.

### Capacity and Load Factor

`LinkedHashMap` supports the same capacity/load-factor configuration as HashMap:

```java
new LinkedHashMap<>(100, 0.75f);
```

The linked structure adds ordering information, but the underlying hash-table capacity/load-factor concepts remain relevant.

### Access-Order Constructor

Memorize this constructor:

```java
new LinkedHashMap<>(initialCapacity, loadFactor, accessOrder);
```

```java
new LinkedHashMap<>(16, 0.75f, true);
```

| Argument | Meaning |
| --- | --- |
| `16` | Initial capacity |
| `0.75f` | Load factor |
| `true` | Access order |

With `new LinkedHashMap<>()`, the default is `accessOrder = false`, so **insertion order** is the default.

## Common Interview Questions

### Why does LinkedHashMap maintain insertion order?

It maintains additional linked ordering information between entries, allowing iteration to follow insertion order independently of the hash-table bucket arrangement.

### How does LinkedHashMap achieve O(1) lookup while maintaining order?

It uses HashMap's hash-table mechanism for lookup and an additional doubly linked structure for ordering. Lookup and ordering are therefore handled by **separate structures** — an excellent senior-level answer.

### What is the difference between insertion order and access order?

- **Insertion order:** the order entries were inserted.
- **Access order:** the order entries were most recently accessed — especially useful for LRU caches.

### Does put() move an existing key to the end?

- **Insertion-order mode:** No.
- **Access-order mode:** An operation that accesses an existing mapping can move it to the tail. The exact behaviour depends on the Map operation being used.

### Why use LinkedHashMap instead of TreeMap?

If you need insertion order or access order, use `LinkedHashMap`. If you need sorted keys, use `TreeMap`.

### Is LinkedHashMap thread-safe?

No. Like `HashMap`, it isn't inherently thread-safe.

### Can LinkedHashMap have duplicate keys?

No. It follows Map semantics: keys are unique; duplicate values are allowed.

### Can LinkedHashMap contain null?

Yes. It supports one null key and multiple null values.

## Coding Questions

### Insertion order output

```java
Map<Integer, String> map = new LinkedHashMap<>();

map.put(3, "C");
map.put(1, "A");
map.put(2, "B");

for (Integer key : map.keySet()) {
    System.out.println(key);
}
```

```output
3
1
2
```

Because insertion order is maintained.

### Updating an existing key

```java
LinkedHashMap<Integer, String> map = new LinkedHashMap<>();

map.put(1, "A");
map.put(2, "B");
map.put(3, "C");

map.put(2, "Updated");
```

Iteration order: `1, 2, 3`. Updating an existing mapping does not move it in default insertion-order mode.

### Access order

```java
LinkedHashMap<Integer, String> map = new LinkedHashMap<>(16, 0.75f, true);

map.put(1, "A");
map.put(2, "B");
map.put(3, "C");

map.get(1);
```

Order: `2, 3, 1` — because `1` was accessed and moved to the end.

### LRU

```java
LRUCache<Integer, String> cache = new LRUCache<>(2);

cache.put(1, "A");
cache.put(2, "B");

cache.get(1);

cache.put(3, "C");
```

Final entries: `1 → A`, `3 → C`.

```flow-h Why?
1 → 2
: get(1)
2 → 1
: put(3)
2 → 1 → 3
: capacity exceeded, eldest 2 removed
1 → 3
```

## Important Traps

### Predictable is not Sorted

`LinkedHashMap` guarantees **predictable** iteration order — don't confuse that with **sorted**. Insertion order `30 → 10 → 20` remains `30 → 10 → 20`; it doesn't become `10 → 20 → 30`.

### LRU and Thread Safety

`LinkedHashMap + accessOrder = true` does **not** automatically create a thread-safe LRU cache. For multithreaded applications, you need an appropriate concurrency strategy.

### get() and Modification

In access-order mode, `map.get(key);` can reorder the linked list. Therefore a `get()` can affect iteration behaviour. This is one of the most useful advanced LinkedHashMap interview details.

### Memory Trade-Off

Compared with `HashMap`, each entry needs additional ordering references:

| Entry | Fields |
| --- | --- |
| HashMap entry | key / value / hash / next |
| LinkedHashMap entry | key / value / hash / next **+ before / after** |

So `LinkedHashMap` uses **more memory** in exchange for predictable ordering.

## Decision Framework

```flow
Need a Map
? Does ordering matter? | No: HashMap | Yes: what ordering?
---
What ordering?
? Which? | Insertion: LinkedHashMap | Access: LinkedHashMap (accessOrder = true) → LRU cache | Sorted keys: TreeMap
```

For concurrent access, use **`ConcurrentHashMap`**.

### HashMap vs LinkedHashMap vs TreeMap

| Map | Lookup | Ordering |
| --- | --- | --- |
| HashMap | Fast | No ordering |
| LinkedHashMap | Fast | Predictable insertion/access order |
| TreeMap | O(log n) | Sorted keys |

### Final Mental Model

```tree
LinkedHashMap | predictable iteration
  Hash Table | fast lookup
  Linked List | ordering
    Default | insertion order
    accessOrder = true | access order → LRU cache
```

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| LinkedHashMap | HashMap + ordering |
| Lookup | Hash-based |
| Ordering | Insertion or access |
| Default order | Insertion |
| Access order | Constructor flag `true` |
| Internal ordering | Doubly linked structure |
| Average get() / put() | O(1) |
| Sorted keys | ❌ No |
| Duplicate keys | ❌ No |
| Duplicate values | ✅ Yes |
| Null key | One allowed |
| Null values | Allowed |
| Thread-safe | ❌ No |
| LRU cache | Excellent fit |
| `removeEldestEntry()` | Useful for bounded caches |

### Interview Readiness Checklist

- How LinkedHashMap differs from HashMap
- How it maintains ordering (hash table + linked-list structure)
- Insertion order vs access order, and `accessOrder = true`
- Why `get()` can reorder entries
- `removeEldestEntry()` and how to implement an LRU cache
- LinkedHashMap vs HashMap / TreeMap
- Why LinkedHashMap uses more memory
- Why it isn't thread-safe
- Why predictable order isn't the same as sorted order
- Complexity of common operations
- How existing-key updates behave in insertion-order mode
