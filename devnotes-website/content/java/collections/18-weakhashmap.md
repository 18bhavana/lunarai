---
title: WeakHashMap
subtitle: Maps with weakly referenced keys — strong vs weak references, GC-driven entry removal, ReferenceQueue, and why it is not a cache.
order: 18
---

## Introduction

`WeakHashMap` is one of those Java collections that interviewers use to distinguish between someone who knows the API and someone who understands **Java references + Garbage Collection**. The central idea:

> WeakHashMap allows entries to **disappear automatically** when their **keys** are no longer strongly reachable elsewhere.

The important word is **key**.

```flow-h
WeakHashMap
Weak references to keys
GC can collect unreachable keys
Corresponding mappings disappear
```

## What Is WeakHashMap?

Package:

```java
java.util.WeakHashMap
```

It implements `Map<K,V>`.

```java
Map<Key, String> map = new WeakHashMap<>();
```

Unlike `HashMap`, the Map does **not strongly retain its keys**.

## HashMap vs WeakHashMap References

This is the most important distinction.

```flow
HashMap
HashMap
: strong reference
Key | stays reachable through the Map
---
WeakHashMap
WeakHashMap
: weak reference
Key | eligible for GC if no other strong references exist
```

- **HashMap** — as long as the HashMap contains the key, the key remains strongly reachable through the Map.
- **WeakHashMap** — if there are no other strong references to the key, the key can become eligible for garbage collection.

### What Is a Strong Reference?

Most normal Java references are strong references:

```java
Employee employee = new Employee();
```

Here `employee → Employee object`. As long as `employee` is strongly reachable, the object isn't eligible for GC.

### What Is a Weak Reference?

A weak reference **does not prevent** an object from being garbage collected.

| Reference | Effect |
| --- | --- |
| Strong: `variable → Object` | Keeps the object reachable |
| Weak: `WeakRef → Object` | Doesn't keep the object alive |

This is the behaviour `WeakHashMap` relies on.

## The Key Lifecycle

### The Key Relationship

```java
Key key = new Key();

WeakHashMap<Key, String> map = new WeakHashMap<>();

map.put(key, "Data");
```

```refs The key is still strongly reachable because the key variable exists
key (strong), WeakHashMap (weak) -> Key object
```

### What Happens When the Strong Reference Disappears?

```java
key = null;
```

```refs Only a weak reference remains, so the Key becomes eligible for GC
key = null, WeakHashMap (weak) -> Key object | eligible for GC
```

If there are no other strong references to that Key, it becomes eligible for GC. After garbage collection and WeakHashMap's cleanup processing, the corresponding entry can disappear.

### GC Is Not Deterministic

> [!WARNING]
> Don't say *"Setting key = null immediately removes the entry."* That's incorrect.

The correct sequence is:

```flow Garbage collection timing is not deterministic
Strong reference disappears
Key becomes eligible for GC
GC may collect key
Reference processing occurs
WeakHashMap expunges stale entry
```

### Example

```java
WeakHashMap<Object, String> map = new WeakHashMap<>();

Object key = new Object();
map.put(key, "Hello");

System.out.println(map.size());
```

```output
1
```

Now `key = null;` — the entry becomes eligible for eventual removal once the key is collected. You should **not** write code that assumes the next statement will definitely print `0`.

## Values Can Keep Keys Alive

### Why Doesn't the Value Keep the Key Alive?

This is a subtle but important point. WeakHashMap is designed so that the map's internal entry does **not** create a strong path from the map to its key. However, you must be careful if the **value itself** strongly references its key:

```java
Key key = new Key();
map.put(key, key);
```

```flow-h The value itself can provide a strong path to the key, so the key may not become collectible
WeakHashMap
Entry
Value
Key
```

### The Key Must Be Weakly Reachable

The basic condition: **no strong reference path to the key → key eligible for GC**. The WeakHashMap's weak reference alone does not keep it alive.

### Value Can Accidentally Keep Key Alive

A sophisticated interview question:

```java
class Data {
    Key key;
}
```

```java
Key key = new Key();
Data data = new Data(key);
map.put(key, data);
```

```flow-h The value strongly references the key — this defeats the intended weak-key behaviour
WeakHashMap
value
Data
Key
```

> [!IMPORTANT]
> **General rule:** ensure the value does not unintentionally maintain a strong reference back to the key. This is particularly important in metadata/cache designs.

## How Cleanup Works

### Weak References Internally

The implementation uses mechanisms from `java.lang.ref`, particularly weak references:

```flow-h The implementation can then detect when the referenced key has been cleared
WeakHashMap
Entry
WeakReference<Key>
```

### ReferenceQueue

A key implementation concept is **`ReferenceQueue`**. A simplified lifecycle:

```flow This is a very good senior-level interview answer
Key
WeakReference
Key becomes unreachable
GC clears weak reference
Reference enqueued
WeakHashMap processes queue
Entry removed
```

### Why Does WeakHashMap Need ReferenceQueue?

When a key gets garbage collected, the Map must eventually remove the corresponding entry. The `ReferenceQueue` provides a mechanism for **detecting processed weak references**: Garbage Collector → clears weak reference → ReferenceQueue → WeakHashMap cleanup → remove stale entry.

### Does WeakHashMap Run a Background Thread?

**No** — an important misconception. `WeakHashMap` doesn't require a dedicated background thread constantly scanning all keys. Cleanup is integrated with Map operations and reference processing: **Map operation → process stale references → remove obsolete entries**. The exact implementation details can vary by Java version.

## GC-Sensitive Behaviour

### size() Can Change Unexpectedly

One of the most important WeakHashMap interview traps. You insert several keys, then external strong references disappear. After GC, `map.size()` **can become smaller**.

> [!IMPORTANT]
> The contents of WeakHashMap can change as a **side effect of garbage collection**. This is fundamentally different from normal Map implementations.

### Why This Matters

With `HashMap`, an entry normally remains until you explicitly remove it or clear the Map. With `WeakHashMap`: **key becomes unreachable → GC → entry may disappear**. So the Map's contents are partly dependent on **object reachability**.

### System.gc() Trap

You might see examples like:

```java
key = null;
System.gc();
```

and expect `map.size() == 0`. **Don't rely on this.** `System.gc()` is only a **request/hint** to the JVM — it doesn't guarantee immediate garbage collection.

> [!WARNING]
> WeakHashMap behaviour must never depend on a specific GC timing.

### Does WeakHashMap Guarantee Immediate Removal?

**No.** The correct wording: *entries whose keys have been garbage collected become eligible for removal, and the Map removes stale entries as it processes cleared references.* Don't say *"the entry disappears immediately when the key becomes unreachable."*

### Iteration Behaviour

Because entries can disappear due to GC, iteration should not assume that a previously observed entry will remain indefinitely if its key has become weakly reachable.

```java
for (Map.Entry<Key, String> entry : map.entrySet()) {
    System.out.println(entry.getValue());
}
```

Remember: the Map is **GC-sensitive**.

## Weak Keys, Not Weak Values

This is extremely important. WeakHashMap's special behaviour is primarily about **WEAK KEYS**, not weak values. The values are not automatically weak simply because the Map is a WeakHashMap.

| Part of `WeakHashMap<K,V>` | Reference | Lifecycle |
| --- | --- | --- |
| K (key) | Weakly referenced | GC-sensitive |
| V (value) | Ordinary reference | Not automatically weak |

## WeakHashMap Is Not a Normal Cache

A common interview misconception: *"WeakHashMap is an LRU cache."* **No.**

- **LRU** (Least Recently Used) is about **access recency**.
- **WeakHashMap** is about **object reachability**.

```flow They solve different problems: WeakHashMap ≠ LRU Cache
WeakHashMap
Key reachability
GC
Entry disappears
---
LinkedHashMap LRU
Access order
Least recently used
Evict entry
```

### WeakHashMap and Cache Design

A common mistake: *"I'll use WeakHashMap as my application cache."* Be careful. A cache generally requires explicit semantics around size, eviction, expiration, refresh, concurrency, hit rate and memory limits.

WeakHashMap instead says: *"If nobody strongly needs this key, the association can disappear."* Those are very different semantics.

## Use Cases

### Typical Use Case

WeakHashMap is useful when you want to:

> Associate metadata with an object **without making the object stay alive** solely because of that association.

You don't want a metadata map that keeps objects alive forever. WeakHashMap can help avoid that retention.

### Example — Object Metadata

```java
WeakHashMap<Object, String> metadata = new WeakHashMap<>();

Object object = new Object();
metadata.put(object, "Temporary metadata");
```

As long as `object` is strongly reachable, the mapping can exist. Once the object is otherwise unreachable, the mapping can eventually disappear.

### Example — Listener/Metadata Associations

Weak references can be useful for metadata, temporary associations and object-lifecycle tracking, where you don't want the tracking structure itself to extend the lifetime of the tracked object. The exact design should still be evaluated carefully; WeakHashMap is not automatically the right solution for every memory-management problem.

### Example — Temporary Object Metadata

```java
class Parser {
    // ...
}

WeakHashMap<Object, Metadata> metadata = new WeakHashMap<>();
```

The metadata association for parser-created objects doesn't need to extend their lifetime. This is a much better conceptual use case than treating WeakHashMap as a traditional cache.

### Does WeakHashMap Prevent Memory Leaks?

It can help prevent certain forms of memory retention. But **WeakHashMap is not a universal memory-leak solution**. You still need to understand strong references, object graphs, thread-local references, static references, listener registrations, caches and resource lifecycle. Weak references are one tool, not a magic solution.

## Null, Ordering and Thread Safety

### Null Key

WeakHashMap allows:

```java
map.put(null, "Hello");
```

Unlike ordinary weakly referenced keys, `null` itself cannot be garbage collected, so the null-key mapping does not disappear merely because of weak-key processing.

### Null Values

WeakHashMap also allows null values — `map.put(key, null);` — with no special restriction comparable to `ConcurrentHashMap`.

### Is WeakHashMap Ordered?

No ordering guarantee. For insertion order use `LinkedHashMap`; for sorted keys use `TreeMap`. WeakHashMap's purpose is weak-key lifecycle behaviour.

### Is WeakHashMap Thread-Safe?

**No.** If multiple threads access it concurrently and at least one structurally modifies it, you need an appropriate synchronization strategy. There isn't a standard `ConcurrentWeakHashMap` in the Java Collections Framework.

### WeakHashMap and Synchronization

```java
Collections.synchronizedMap(new WeakHashMap<>());
```

This does not magically create every property of a specialized concurrent collection. Iteration still requires following the normal synchronization rules for synchronized collection wrappers.

## Comparisons

### WeakHashMap vs HashMap

| Feature | HashMap | WeakHashMap |
| --- | --- | --- |
| Key reference | Strong | Weak |
| Entries disappear due to GC | ❌ No | ✅ Possible |
| Ordering | None guaranteed | None guaranteed |
| Null key | One | One |
| Null values | Yes | Yes |
| Thread-safe | ❌ No | ❌ No |
| Normal general-purpose Map | ✅ Yes | ❌ No |
| Object-lifecycle-sensitive use cases | Limited | ✅ Yes |

### WeakHashMap vs LinkedHashMap

| Feature | WeakHashMap | LinkedHashMap |
| --- | --- | --- |
| Primary purpose | Weak-key associations | Predictable ordering |
| Ordering | None guaranteed | Insertion/access |
| Automatic GC-based removal | ✅ Yes | ❌ No |
| LRU support | ❌ No | ✅ Yes |
| Thread-safe | ❌ No | ❌ No |

### WeakHashMap vs ConcurrentHashMap

| Feature | WeakHashMap | ConcurrentHashMap |
| --- | --- | --- |
| Weak keys | ✅ Yes | ❌ No |
| Thread-safe | ❌ No | ✅ Yes |
| Null key | One | ❌ Not allowed |
| Null value | ✅ Allowed | ❌ Not allowed |
| Main purpose | Weak associations | Concurrent access |

Don't choose WeakHashMap just because you want memory optimization in a multithreaded application — concurrency requirements are separate.

### WeakHashMap vs WeakReference

Don't confuse the two:

- **`WeakReference<T>`** — a reference mechanism (the building block).
- **`WeakHashMap`** — a Map implementation that uses weak references for keys (a collection abstraction).

## Java Reference Types

You should know these four categories: **Strong, Soft, Weak, Phantom**. For this chapter, the important one is `WeakReference`: a weak reference does not prevent collection when the referent is otherwise strongly unreachable.

### Weak vs Soft Reference

> [!QUESTION] WeakHashMap uses weak references. Why not soft references?
> **Weak:** the object can be collected once it is only weakly reachable.
> **Soft:** historically intended for objects that could be retained until memory pressure, although exact GC behaviour is JVM-dependent.
> WeakHashMap uses weak references because its goal is **lifecycle association**, not a memory-pressure cache policy.

## Interview Questions

### What makes WeakHashMap different from HashMap?

HashMap strongly references its keys, whereas WeakHashMap uses weak references for keys. If a WeakHashMap key is no longer strongly reachable elsewhere, it can be garbage collected and the corresponding mapping can subsequently be removed.

### When does an entry disappear from WeakHashMap?

Don't say *"when the key is set to null."* Say: *"When the key is no longer strongly reachable, it becomes eligible for garbage collection. After the key is collected and the weak reference is processed, WeakHashMap can remove the corresponding stale entry."*

### Does setting the key variable to null immediately remove the entry?

**No.** `key = null` only removes **one** strong reference. GC and reference processing determine when the key can actually be collected and the mapping cleaned up.

### Does WeakHashMap use weak values?

No. Its special semantics concern **keys**. The values remain normally referenced by the entries.

### Can the value prevent the key from being garbage collected?

Yes. If the value strongly references the key, a strong path (WeakHashMap → value → key) can exist, so the key may remain strongly reachable.

### Is WeakHashMap thread-safe?

No. It requires external synchronization or another concurrency design when used concurrently.

### Is WeakHashMap an LRU cache?

No. LRU is based on access recency. WeakHashMap is based on key reachability and garbage collection.

### Why use WeakHashMap?

When you need a mapping associated with an object's lifecycle but don't want the Map itself to keep the key alive. It is useful for metadata or temporary associations where entries should naturally disappear when their keys become otherwise unreachable.

## Coding Questions

### Can the entry eventually disappear?

```java
WeakHashMap<Object, String> map = new WeakHashMap<>();

Object key = new Object();
map.put(key, "Hello");

key = null;
```

**Yes.** If no other strong reference to the key exists, the key becomes eligible for GC, and after collection/reference processing the mapping can be removed.

### What is guaranteed here?

```java
Object key = new Object();
map.put(key, "Hello");
key = null;

System.out.println(map.size());
```

**Nothing deterministic** about whether the entry has already disappeared. The key may not have been collected yet, so you cannot reliably predict the size from this code alone.

### Will this entry necessarily disappear?

```java
Object key = new Object();
map.put(key, key);
key = null;
```

**No.** The value strongly references the same key (Map → Value → Key). That strong path can prevent collection.

### Which Map should you choose?

Requirement: associate metadata with an object without making the metadata map keep that object alive.

**Answer:** `WeakHashMap<Object, Metadata>`.

## Decision Framework

```flow
Need key-value association
? Do keys need a normal strong lifetime? | Yes: HashMap | No: should entries disappear when keys become otherwise unreachable? → WeakHashMap
```

| Other requirement | Choose |
| --- | --- |
| Insertion/access order | `LinkedHashMap` |
| Sorted keys | `TreeMap` |
| Concurrency | `ConcurrentHashMap` |

### The Map Family So Far

```tree
Map
  HashMap | fast lookup
  LinkedHashMap | ordering → access order → LRU-style
  TreeMap | sorted keys
  WeakHashMap | weak keys · GC-sensitive lifecycle
```

### Most Important WeakHashMap Diagram

Memorize this — it's the entire concept:

```flow
Strong reference → Key ← weak reference ← WeakHashMap
Strong reference disappears
Key becomes weakly reachable
Eligible for GC
GC clears weak ref
ReferenceQueue
WeakHashMap cleanup
Entry disappears
```

### Interview One-Liner

> [!TIP]
> *"Explain WeakHashMap in one minute."* — WeakHashMap is a Map implementation whose keys are held using weak references. Unlike HashMap, the Map itself doesn't strongly keep its keys alive. If a key is no longer strongly reachable elsewhere, it can be garbage collected, after which the corresponding mapping can be removed. This makes WeakHashMap useful for lifecycle-sensitive metadata or temporary associations. Its behaviour is GC-dependent, it isn't thread-safe, and it shouldn't be confused with an LRU cache.

### Final Mental Model

| Map | Keys | Effect |
| --- | --- | --- |
| HashMap | Strong | Map helps keep key alive |
| WeakHashMap | Weak | Map doesn't keep key alive → key unreachable → GC → entry can disappear |

Remember: **WeakHashMap = WEAK KEYS + GC-SENSITIVE.** Not weak values. Not LRU. Not thread-safe.

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| WeakHashMap | Map with weakly referenced keys |
| Package | `java.util` |
| Main purpose | Lifecycle-sensitive associations |
| Key reference | Weak |
| Value reference | Normal/strong by default |
| GC-sensitive | ✅ Yes |
| Automatic stale-entry cleanup | ✅ Yes |
| Immediate removal | ❌ Not guaranteed |
| ReferenceQueue | Used for stale-reference processing |
| Null key | Allowed |
| Null values | Allowed |
| Ordering | None guaranteed |
| Thread-safe | ❌ No |
| LRU cache | ❌ No |
| Strong value → key reference | Can keep key alive |
| Common use | Object metadata / temporary associations |

### Interview Readiness Checklist

- What WeakHashMap is, and HashMap vs WeakHashMap
- Strong vs weak references
- Why weak keys can be garbage collected
- What happens after `key = null`
- Why GC timing is nondeterministic
- `WeakReference` and `ReferenceQueue`
- Stale-entry cleanup and why `size()` can change
- Why WeakHashMap isn't an LRU cache
- Why WeakHashMap isn't thread-safe
- Weak keys vs weak values
- How a value can accidentally keep a key alive
- Appropriate real-world use cases
- WeakHashMap vs HashMap / LinkedHashMap / ConcurrentHashMap
