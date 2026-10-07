---
title: Map Interface
subtitle: Key-value storage — unique keys, core and Java 8 methods (computeIfAbsent, merge), views, and choosing the right Map.
order: 14
---

## Introduction

We are now entering the **most important part of the Collections Framework for interviews**. `Map` is fundamentally different from `List`, `Set`, `Queue` and `Deque`. The key idea is:

> A Map stores data as **key-value pairs**. Keys are unique; values don't have to be.

## What is Map?

Package:

```java
java.util.Map
```

A Map represents **Key → Value** associations:

| Key | Value |
| --- | --- |
| 101 | "Thimmaraju" |
| 102 | "Rahul" |
| 103 | "Priya" |

Here the keys are `101, 102, 103` and the values are `Thimmaraju, Rahul, Priya`.

## Map Is NOT a Collection

This is a common interview question.

```tree
Iterable
  Collection
    List
    Set
    Queue
```

```tree Map is a separate hierarchy
Map
  HashMap
    LinkedHashMap
  TreeMap
  …
```

`Map` does **not** extend `Collection`. **Why?** Because a Collection represents **individual elements** (`A, B, C`), while a Map represents **associations** (`A → 100, B → 200, C → 300`).

However, a Map provides **Collection views**:

```java
map.keySet();
map.values();
map.entrySet();
```

## Map Basics

### Basic Example

```java
Map<Integer, String> employees = new HashMap<>();

employees.put(101, "John");
employees.put(102, "David");
employees.put(103, "Sarah");
```

```refs
101 -> John
102 -> David
103 -> Sarah
```

### Keys Must Be Unique

```java
Map<Integer, String> map = new HashMap<>();

map.put(101, "John");
map.put(102, "David");
map.put(101, "Mike");
```

Final result: `101 → Mike`, `102 → David`. The second `put(101, …)` **replaces** the previous value; it does not create another entry.

### Values Can Be Duplicated

```java
map.put(101, "John");
map.put(102, "John");
map.put(103, "John");
```

Valid. So remember: **Key → unique, Value → can repeat.**

## Core Map Methods

The most important methods: `put()`, `get()`, `remove()`, `containsKey()`, `containsValue()`, `size()`, `isEmpty()`, `clear()` — and the views `keySet()`, `values()`, `entrySet()`.

### put()

Adds or updates a mapping.

```java
map.put("A", 100);   // A → 100 (new)
map.put("A", 200);   // A → 200 (updated)
```

### Return Value of put()

Important interview detail.

```java
Map<String, Integer> map = new HashMap<>();

System.out.println(map.put("A", 100));
System.out.println(map.put("A", 200));
```

```output
null
100
```

**Why?** The first insertion has no previous value → `null`. The second returns the previous value → `100`.

> [!IMPORTANT]
> `put()` returns the **previous value** associated with the key, or `null` if there was none.

### get()

```java
Integer value = map.get("A");   // 200
map.get("X");                   // null — key not present
```

### The get() + null Problem

```java
map.put("A", null);

map.get("A");   // null
map.get("X");   // also null
```

So you cannot always distinguish **"key exists with a null value"** from **"key doesn't exist"** using `get()` alone. Use:

```java
map.containsKey("A");
```

### containsKey()

Checks whether a key exists. This is generally the correct operation when your question is *"Does this key exist?"*

```java
if (map.containsKey("A")) {
    // ...
}
```

### containsValue()

Checks whether a value exists:

```java
map.containsValue("John");
```

Unlike key lookup, value searching generally requires examining entries — typically **O(n)**. `containsKey()` is designed around key lookup; `containsValue()` typically scans values.

### remove()

```java
map.remove(101);
```

The entire mapping (`101 → John`) disappears. `remove(key)` returns the previous value, or `null` if there was no mapping.

### remove(key, value)

A conditional version:

```java
map.remove(101, "John");
```

It removes the mapping **only if both key and value match**. Useful for conditional updates and concurrent-style logic.

### replace()

```java
map.replace(101, "Mike");
```

Unlike `put()`, `replace()` only operates when the key **already exists**. There is also:

```java
map.replace(101, "John", "Mike");
```

which replaces only when the current value matches `"John"`.

## Modern Map Methods (Java 8+)

### putIfAbsent()

Very important modern Map method.

```java
map.putIfAbsent(101, "John");
```

It inserts **only if the key doesn't already have a mapping**.

```flow This is particularly useful when you don't want to overwrite an existing value
putIfAbsent(key, value)
? Key exists? | Yes: do nothing | No: insert
```

### computeIfAbsent()

One of the most useful Map methods. Suppose:

```java
Map<String, List<Integer>> map = new HashMap<>();
```

You want a list for a key, creating it only when necessary. Instead of verbose code:

```java
if (!map.containsKey("Java")) {
    map.put("Java", new ArrayList<>());
}
map.get("Java").add(10);
```

use:

```java
map.computeIfAbsent("Java", k -> new ArrayList<>()).add(10);
```

This pattern is extremely common in real Java code.

### computeIfPresent()

Runs a computation only when the key is already mapped:

```java
map.computeIfPresent("A", (key, value) -> value + 10);
```

If `A → 100`, it becomes `A → 110`.

### compute()

Runs the remapping function **regardless** of whether the key currently exists:

```java
map.compute("A", (key, value) -> value == null ? 1 : value + 1);
```

Useful for counters and state updates.

### merge()

Very useful for counting.

```java
Map<String, Integer> counts = new HashMap<>();
```

Instead of:

```java
if (counts.containsKey(word)) {
    counts.put(word, counts.get(word) + 1);
} else {
    counts.put(word, 1);
}
```

use:

```java
counts.merge(word, 1, Integer::sum);
```

For `Java Java Python` the result is `Java → 2`, `Python → 1`.

### getOrDefault()

```java
int count = map.getOrDefault("Java", 0);
```

If `Java → 5`, returns `5`; if absent, returns `0`. Useful for counters and lookup logic.

### forEach()

```java
map.forEach((key, value) -> System.out.println(key + " = " + value));
```

Concise and readable.

### replaceAll()

Transforms all values:

```java
map.replaceAll((key, value) -> value + 10);
```

`A → 100, B → 200` becomes `A → 110, B → 210`.

### clear(), size() and isEmpty()

- `map.clear();` → removes all mappings → `{}`
- `map.size();` → number of key-value **mappings**. For `A → 10, B → 20, C → 30`, `size()` is **3, not 6** — a mapping consists of one key and one value.
- `map.isEmpty();` → `true` if there are no mappings.

## Map Views

### keySet()

Returns a **Set** view of the keys.

```java
Set<Integer> keys = map.keySet();   // 101, 102, 103
```

Because keys are unique, a `Set` is appropriate.

### values()

Returns a **Collection** view of values.

```java
Collection<String> values = map.values();   // John, David, Sarah
```

**Why Collection instead of Set?** Because values can be duplicated.

### entrySet()

Returns a Set of key-value entries. Each entry contains a key and a value.

```java
Set<Map.Entry<Integer, String>> entries = map.entrySet();
```

### Best Way to Iterate a Map

Prefer:

```java
for (Map.Entry<Integer, String> entry : map.entrySet()) {
    System.out.println(entry.getKey() + "=" + entry.getValue());
}
```

**Why?** Because you get both key and value directly.

### Why Not keySet() + get()?

```java
for (Integer key : map.keySet()) {
    System.out.println(key + " = " + map.get(key));
}
```

This performs a **separate lookup for every key**. With `entrySet()` you access the mapping directly.

> [!TIP]
> When you need both keys and values, prefer `entrySet()`.

### Map Views Are Backed by the Map

This is an important concept.

```java
Set<Integer> keys = map.keySet();
```

This isn't necessarily an independent copy — it is a **view**. Modifications through supported view operations can affect the original Map.

```tree These are different views of the same underlying mappings
Map
  keySet()
  values()
  entrySet()
```

## Map Implementations

The major implementations you need to know: `HashMap`, `LinkedHashMap`, `TreeMap`, `Hashtable`, `ConcurrentHashMap`, `WeakHashMap`, `IdentityHashMap`, `EnumMap`. Their selection depends on requirements.

### HashMap

The most commonly used Map: **key-value storage + fast average lookup + no ordering guarantee**.

| Operation | Complexity |
| --- | --- |
| put() | O(1) average |
| get() | O(1) average |
| remove() | O(1) average |

Internally: **HashMap → hash table → buckets**. We'll dedicate a separate chapter to HashMap internals.

### LinkedHashMap

Adds predictable iteration order: **HashMap + linked ordering structure**. By default, it maintains insertion order.

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

### TreeMap

Provides **sorted keys**. Internally: **TreeMap → Red-Black Tree**.

```java
Map<Integer, String> map = new TreeMap<>();

map.put(30, "C");
map.put(10, "A");
map.put(20, "B");
```

```output
10 → A
20 → B
30 → C
```

Typical operations: **O(log n)**.

### Hashtable

Legacy synchronized Map implementation.

```java
Hashtable<Integer, String> map = new Hashtable<>();
```

- Thread-safe through synchronization
- Does not allow null keys
- Does not allow null values
- Legacy API

For new concurrent code, prefer appropriate classes from `java.util.concurrent`, especially `ConcurrentHashMap` for general concurrent hash-map use.

### ConcurrentHashMap

Designed for concurrent access.

```java
Map<Integer, String> map = new ConcurrentHashMap<>();
```

- Thread-safe
- High concurrency
- Does not allow null keys
- Does not allow null values
- Better suited to modern concurrent applications than `Hashtable`

We'll study its internals separately.

### WeakHashMap

Uses **weak references for keys**. This allows entries to become eligible for garbage collection when their keys are no longer strongly referenced elsewhere.

```flow
Normal HashMap
Map → Key
Key stays reachable
---
WeakHashMap
Map → weak reference → Key
Key can be collected
```

Useful for certain cache/metadata scenarios. It is **not** a general-purpose replacement for a normal cache.

### IdentityHashMap

A particularly interesting Map. A normal `HashMap` compares keys using `equals()`; `IdentityHashMap` uses **`==`**.

```java
String a = new String("Java");
String b = new String("Java");
```

`a.equals(b)` is `true`, but `a == b` is `false`. `HashMap` considers them **equal keys**; `IdentityHashMap` treats them as **different keys**.

### EnumMap

A specialized Map for enum keys.

```java
enum Day {
    MONDAY, TUESDAY, WEDNESDAY
}

EnumMap<Day, String> map = new EnumMap<>(Day.class);
```

Advantages:

- Very efficient
- Compact
- Designed specifically for enum keys
- Maintains enum declaration order when iterated

If your keys are enums, `EnumMap` is often an excellent choice.

## Map Selection Guide

This table is worth memorizing:

| Requirement | Choose |
| --- | --- |
| General-purpose fast lookup | `HashMap` |
| Fast lookup + insertion order | `LinkedHashMap` |
| Sorted keys | `TreeMap` |
| Concurrent hash map | `ConcurrentHashMap` |
| Legacy synchronized map | `Hashtable` |
| Keys should be weakly referenced | `WeakHashMap` |
| Identity (`==`) key comparison | `IdentityHashMap` |
| Enum keys | `EnumMap` |

### HashMap vs LinkedHashMap vs TreeMap

| Feature | HashMap | LinkedHashMap | TreeMap |
| --- | --- | --- | --- |
| Ordering | None guaranteed | Insertion/access order | Sorted keys |
| Typical get | O(1) avg | O(1) avg | O(log n) |
| Typical put | O(1) avg | O(1) avg | O(log n) |
| Structure | Hash table | Hash table + links | Red-Black Tree |
| Null key | One allowed | One allowed | Generally no |
| Duplicate keys | No | No | No |

## Multiple Values per Key

### Map Does Not Mean Duplicate Keys

```java
map.put("A", 10);
map.put("A", 20);
```

This doesn't produce `A → 10` and `A → 20`. It produces **`A → 20`**. If you need multiple values per key, `Map<String, List<Integer>>` is a common design — e.g. `Java → [10, 20, 30]`, `Python → [40, 50]`.

### Map of Lists Pattern

```java
Map<String, List<Integer>> map = new HashMap<>();

map.computeIfAbsent("Java", k -> new ArrayList<>()).add(10);
map.computeIfAbsent("Java", k -> new ArrayList<>()).add(20);
```

Result: `Java → [10, 20]`. This pattern appears frequently in real projects and coding interviews.

## Keys, Equality and Null

### Map and equals() / hashCode()

For hash-based Maps such as `HashMap`, key lookup depends on hashing and equality:

```flow-h This is why mutable keys can be dangerous
hashCode()
bucket
equals()
matching key
```

### Mutable Key Problem

```java
Map<Employee, String> map = new HashMap<>();
```

If `Employee.hashCode()` depends on `employee.id` and you change the ID after insertion (`employee.id = 999;`), the key's hash can change. Now the Map may be **unable to find the entry** using the mutated key.

> [!WARNING]
> Keys used in hash-based Maps should generally be **immutable** with respect to fields involved in `equals()` and `hashCode()`. This becomes very important in the HashMap chapter.

### Map and Null

Null behaviour differs by implementation:

| Map | Null key | Null value |
| --- | --- | --- |
| HashMap | ✅ One | ✅ Yes |
| LinkedHashMap | ✅ One | ✅ Yes |
| TreeMap | ❌ Generally no (natural ordering) | ✅ Yes |
| Hashtable | ❌ No | ❌ No |
| ConcurrentHashMap | ❌ No | ❌ No |
| WeakHashMap | ✅ One | ✅ Yes |
| IdentityHashMap | ✅ One | ✅ Yes |
| EnumMap | ❌ No | ✅ Yes |

The exact behaviour should always be considered implementation-specific.

## Interview Scenarios

### Fastest average lookup, no ordering

```java
Map<Integer, Employee> employees = new HashMap<>();
```

### Insertion order preserved

```java
Map<Integer, Employee> employees = new LinkedHashMap<>();
```

### Keys automatically sorted

```java
Map<Integer, Employee> employees = new TreeMap<>();
```

### Multiple threads access and update a Map

```java
Map<Integer, Employee> employees = new ConcurrentHashMap<>();
```

Don't simply use `HashMap` without external synchronization.

### Keys are enum values

Use `EnumMap<MyEnum, String>` rather than automatically defaulting to `HashMap`.

## Frequently Asked Interview Questions

### Q1. Is Map a Collection?

No. `Map` is a separate hierarchy.

### Q2. Can Map contain duplicate keys?

No. A key maps to at most one value at a time.

### Q3. Can Map contain duplicate values?

Yes.

### Q4. What happens when you put the same key twice?

The new value replaces the previous value.

### Q5. Difference between keySet() and entrySet()?

- `keySet()` → keys only
- `entrySet()` → key + value

### Q6. Why does values() return Collection rather than Set?

Because duplicate values are allowed.

### Q7. Why is entrySet() preferred when iterating keys and values?

It provides each key-value mapping directly without performing a separate lookup.

### Q8. Why is HashMap generally O(1)?

Hashing allows the implementation to locate the appropriate bucket directly on average.

### Q9. Why is TreeMap O(log n)?

It uses a balanced Red-Black Tree.

### Q10. HashMap vs LinkedHashMap?

`HashMap` has no ordering guarantee; `LinkedHashMap` maintains predictable iteration order.

### Q11. HashMap vs TreeMap?

`HashMap` uses hashing and provides O(1) average basic operations. `TreeMap` uses a balanced tree and provides sorted keys with O(log n) operations.

### Q12. HashMap vs ConcurrentHashMap?

`HashMap` is not thread-safe. `ConcurrentHashMap` is designed for concurrent access.

### Q13. Why can't ConcurrentHashMap store null?

Because `null` would create ambiguity between **key absent** and **key mapped to null**, and its concurrent APIs rely on this distinction.

### Q14. What is WeakHashMap?

A Map whose keys are weakly referenced, allowing entries to become eligible for garbage collection when keys are no longer strongly reachable elsewhere.

### Q15. What is IdentityHashMap?

A Map that uses reference identity (`==`) rather than normal object equality (`equals()`) for key comparison.

### Tricky: size and value after a duplicate key

```java
Map<String, Integer> map = new HashMap<>();

map.put("A", 10);
map.put("B", 20);
map.put("A", 30);

System.out.println(map.size());
System.out.println(map.get("A"));
```

```output
2
30
```

Because `"A"` is a duplicate key.

### Tricky: get() returns null twice

```java
Map<String, Integer> map = new HashMap<>();

map.put("A", null);

System.out.println(map.get("A"));
System.out.println(map.get("B"));
```

Both print `null`. To distinguish them: `map.containsKey("A")` returns `true`, while `map.containsKey("B")` returns `false`.

### Tricky: duplicate values

```java
Map<Integer, String> map = new HashMap<>();

map.put(1, "A");
map.put(2, "A");
map.put(3, "B");

map.size();   // 3
```

Duplicate values don't matter. Only duplicate keys are replaced.

## The Map Decision Framework

```tree Common choices
Map
  Need fast lookup? | HashMap
  Need insertion order? | LinkedHashMap
  Need sorted keys? | TreeMap
```

| Special requirement | Choose |
| --- | --- |
| Concurrent access | `ConcurrentHashMap` |
| Enum keys | `EnumMap` |
| Weakly referenced keys | `WeakHashMap` |
| Reference identity comparison | `IdentityHashMap` |

### Final Mental Model

```tree
Map | Key → Value association
  Key | unique
  Value | duplicates OK
```

| View | Gives |
| --- | --- |
| `keySet()` | Keys |
| `values()` | Values |
| `entrySet()` | Key + Value |

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| Map | Key-value association |
| Extends Collection? | ❌ No |
| Duplicate keys | ❌ No |
| Duplicate values | ✅ Yes |
| `put()` | Add/update mapping |
| `get()` | Retrieve value |
| `remove()` | Remove mapping |
| `containsKey()` | Check key |
| `containsValue()` | Check value |
| `keySet()` | Key view |
| `values()` | Value view |
| `entrySet()` | Entry view |
| HashMap | Fast average lookup |
| LinkedHashMap | Predictable order |
| TreeMap | Sorted keys |
| ConcurrentHashMap | Concurrent access |
| WeakHashMap | Weakly referenced keys |
| IdentityHashMap | `==` key comparison |
| EnumMap | Enum keys |

### Interview Readiness Checklist

- Why Map is not a Collection
- Why keys must be unique
- Whether values can be duplicated
- What happens when the same key is inserted twice
- `put()` return value
- `get()` vs `containsKey()`
- `keySet()` vs `values()` vs `entrySet()`
- Why `entrySet()` is preferred for key-value iteration
- `putIfAbsent()`, `computeIfAbsent()`, `compute()`, `merge()`
- HashMap vs LinkedHashMap vs TreeMap
- HashMap vs ConcurrentHashMap
- WeakHashMap, IdentityHashMap, EnumMap
- Why mutable Map keys are dangerous
- Null behaviour across Map implementations
