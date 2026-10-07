---
title: TreeMap
subtitle: Sorted maps on a Red-Black Tree — ordering by key, comparator equivalence, floor/ceiling navigation, range views and rotations.
order: 17
---

## Introduction

`TreeMap` is the primary Java Map implementation when you need **sorted keys**. The central idea:

> TreeMap stores mappings in a **balanced Red-Black Tree, ordered by key**.

Unlike `HashMap`, where ordering isn't guaranteed, `TreeMap` continuously maintains its keys according to their natural ordering or a supplied `Comparator`.

## What is TreeMap?

Package:

```java
java.util.TreeMap
```

```flow Hierarchy
Map
SortedMap
NavigableMap
TreeMap | Red-Black Tree → sorted keys
```

### Basic Example

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

The insertion order doesn't matter — the keys are maintained in sorted order.

### TreeMap Is Sorted by Key

This is critical: `TreeMap<K, V>` sorts according to **K (the key)**, not V (the value).

```java
TreeMap<Integer, String> map = new TreeMap<>();

map.put(30, "Apple");
map.put(10, "Zebra");
map.put(20, "Mango");
```

```output
10 → Zebra
20 → Mango
30 → Apple
```

The values aren't sorted.

### Why Use TreeMap?

Use `TreeMap` when you need:

- Sorted keys
- Range queries
- First/last key
- Nearest key
- Floor/ceiling operations
- Navigational operations

For example: *"Find the greatest key less than or equal to X."* That's exactly the kind of problem `TreeMap` handles efficiently.

## Internal Data Structure

`TreeMap` uses a **Red-Black Tree**.

```tree
20
  10
    5
    15
  30
    25
    35
```

The actual implementation stores entries as tree nodes. Conceptually each node contains **key, value, left, right, parent, color**.

### What Is a Red-Black Tree?

A **self-balancing Binary Search Tree** with additional rules involving node colours (**RED** / **BLACK**). These rules ensure the tree doesn't become excessively skewed, so its height remains **O(log n)** — giving `TreeMap` predictable logarithmic operations.

### Why Not a Normal Binary Search Tree?

Inserting `10, 20, 30, 40, 50` into a normal BST could produce a tree that behaves almost like a linked list — search becomes **O(n)**:

```flow-h Unbalanced BST
10
20
30
40
50
```

A Red-Black Tree rebalances itself, so the height stays approximately logarithmic:

```tree Rebalanced
20
  10
  40
    30
    50
```

### Red-Black Tree Properties

The classic rules are:

1. Every node is either **RED** or **BLACK**.
2. The **root is black**.
3. Null leaves are treated as **black**.
4. A red node **cannot have a red child** (RED → RED is invalid).
5. Every path from a node to its descendant null leaves contains the **same number of black nodes**.

These rules maintain balance.

> [!TIP]
> For a Java interview, know the **concept and why it is used**. You usually don't need to implement a complete Red-Black Tree unless the interviewer specifically asks. Key answer: *TreeMap uses a Red-Black Tree to maintain sorted keys while keeping operations approximately O(log n).*

## TreeMap put()

```java
map.put(key, value);
```

```flow The comparison determines where the key belongs
put()
Compare key
Move left or right
Find insertion position
Insert node
Rebalance tree
```

### Natural Ordering

If no `Comparator` is supplied, keys must generally implement **`Comparable`**.

```java
TreeMap<Integer, String> map = new TreeMap<>();
```

`Integer` implements `Comparable<Integer>`, so TreeMap knows `10 < 20 < 30`.

## Comparable vs Comparator

This distinction is essential.

### Comparable

Defines **natural ordering inside the class**:

```java
class Employee implements Comparable<Employee> {

    @Override
    public int compareTo(Employee other) {
        return Integer.compare(this.id, other.id);
    }
}
```

```java
TreeMap<Employee, String> map = new TreeMap<>();
```

> [!NOTE]
> `Integer.compare(a, b)` is safer than `this.id - other.id`, which can overflow for large or negative values.

### Comparator

Defines ordering **outside the class**:

```java
TreeMap<Employee, String> map = new TreeMap<>(
        Comparator.comparingInt(Employee::getSalary)
);
```

Now the TreeMap sorts keys by salary.

### Comparator Takes Priority

If you supply `new TreeMap<>(comparator)`, the TreeMap uses **that Comparator** for key ordering rather than the key's natural ordering. This is useful when the same class needs different sorting requirements.

```java
class Employee {
    String name;
    int salary;
}

TreeMap<Employee, String> map = new TreeMap<>(Comparator.comparingInt(e -> e.salary));
```

Now TreeMap's ordering is determined by salary.

## Key Equivalence: compare() == 0

### Critical Comparator Trap

TreeMap uses its ordering comparison to determine **key equivalence**.

```java
Comparator<Employee> comparator = Comparator.comparingInt(Employee::getSalary);
```

Two different Employees with the same salary compare as `compare(a, b) == 0`. TreeMap can therefore treat them as **the same key** for Map purposes, even if `a.equals(b) == false`. This is a major interview concept.

### compareTo() == 0 and Key Uniqueness

For TreeMap, key uniqueness is effectively determined by **`compareTo()` / `Comparator`**, not simply by `equals()`.

Employee A (salary 50000) and Employee B (salary 50000) with a salary-only comparator → `compare(A, B) == 0` → treated as equivalent keys.

> [!IMPORTANT]
> TreeMap's ordering should generally be **consistent with equals** when possible.

### Comparator Consistency Trap

```java
Comparator<String> comparator = (a, b) -> Integer.compare(a.length(), b.length());

TreeMap<String, Integer> map = new TreeMap<>(comparator);

map.put("Java", 1);
map.put("Code", 2);
```

Both strings have length 4, so `compare("Java", "Code") == 0`. The second insertion **replaces the first mapping's value** — the map ends up with a single entry (key `"Java"`, value `2`). This is why Comparator design matters enormously with TreeMap.

## TreeMap get()

```java
map.get(key);
```

TreeMap starts at the **root**:

```flow It continues until found or not found. Because the tree is balanced: O(log n)
Root
compare()
? Key smaller? | Yes: go left | No: go right
compare again
```

## TreeMap Complexity

| Operation | Complexity |
| --- | --- |
| put() | O(log n) |
| get() | O(log n) |
| remove() | O(log n) |
| containsKey() | O(log n) |
| firstKey() / lastKey() | O(log n) |
| lowerKey() / higherKey() | O(log n) |
| floorKey() / ceilingKey() | O(log n) |

TreeMap trades HashMap's average O(1) lookup for a **guaranteed sorted structure + navigational operations**.

## Navigation Methods

Given keys `10, 20, 30, 40` (values A, B, C, D):

### firstKey() and lastKey()

```java
map.firstKey();   // 10 — smallest key
map.lastKey();    // 40 — largest key
```

### firstEntry() and lastEntry()

Retrieve the complete mapping:

```java
map.firstEntry();   // 10 = A
map.lastEntry();    // 40 = D
```

### lowerKey()

Greatest key **strictly less** than the specified key:

```java
map.lowerKey(30);   // 20
```

### floorKey()

Greatest key **less than or equal** to the specified key:

```java
map.floorKey(30);   // 30
map.floorKey(35);   // 30
```

### higherKey()

Smallest key **strictly greater** than the specified key:

```java
map.higherKey(30);   // 40
```

### ceilingKey()

Smallest key **greater than or equal** to the specified key:

```java
map.ceilingKey(30);   // 30
map.ceilingKey(35);   // 40
```

### The Four Important Navigation Methods

Memorize this table:

| Method | Meaning | Think |
| --- | --- | --- |
| `lowerKey(k)` | < k | left, strictly |
| `floorKey(k)` | <= k | left or same |
| `ceilingKey(k)` | >= k | right or same |
| `higherKey(k)` | > k | right, strictly |

### Entry Versions

Every major navigation operation has an **Entry** equivalent: `lowerEntry()`, `floorEntry()`, `ceilingEntry()`, `higherEntry()`. Instead of returning only the key, they return a `Map.Entry<K,V>`:

```java
Map.Entry<Integer, String> entry = map.floorEntry(35);
```

### pollFirstEntry() and pollLastEntry()

Return **and remove** the smallest / largest mapping.

```java
map.pollFirstEntry();
```

For `10 → A, 20 → B, 30 → C`, after `pollFirstEntry()` the map is `20 → B, 30 → C`. `pollLastEntry()` removes the largest mapping. Useful for min/max processing, priority-style workflows and ordered data management.

### descendingMap() and descendingKeySet()

```java
map.descendingMap();      // reverse-order view: 30, 20, 10
map.descendingKeySet();   // keys in descending order
```

Useful when you need reverse traversal without copying the Map.

## Range Queries

One of TreeMap's biggest advantages. For keys `10, 20, 30, 40, 50`, to get **20 through 40**:

```java
map.subMap(20, true, 40, true);   // 20, 30, 40
```

### subMap()

Modern form: `subMap(fromKey, fromInclusive, toKey, toInclusive)`.

```java
map.subMap(20, true, 40, false);   // 20, 30 — 20 included, 40 excluded
```

### headMap()

Entries **before** a specified key:

```java
map.headMap(30);         // 10, 20
map.headMap(30, true);   // 10, 20, 30
```

### tailMap()

Entries **from** a specified key onward:

```java
map.tailMap(30);          // 30, 40, 50
map.tailMap(30, false);   // 40, 50
```

### Range Views Are Views

This is important. `subMap()`, `headMap()` and `tailMap()` return **views**, not necessarily independent copies. Modifications can affect the original TreeMap. This is useful but requires care.

## NavigableMap and SortedMap

`TreeMap` implements `NavigableMap<K,V>`, which provides navigation operations (`lower`, `floor`, `ceiling`, `higher`) plus `pollFirstEntry()`, `pollLastEntry()` and `descendingMap()`.

| Interface | Provides |
| --- | --- |
| `SortedMap` | `firstKey()`, `lastKey()`, `subMap()`, `headMap()`, `tailMap()` |
| `NavigableMap` | Adds `lower` / `floor` / `ceiling` / `higher`, plus descending and polling operations |

`NavigableMap` is an enhanced version of `SortedMap`.

## Null Handling

### Null Keys

A common interview trap. `TreeMap` generally does **not** permit a null key when using natural ordering:

```java
TreeMap<Integer, String> map = new TreeMap<>();

map.put(null, "A");
```

```output
NullPointerException
```

**Why?** Because TreeMap needs to compare keys.

### Null Values

Null values are generally allowed — `map.put(10, null);` — the issue is the key comparison, not the value.

### Can a Comparator Support Null Keys?

Potentially yes, if the supplied Comparator explicitly handles `null`:

```java
TreeMap<Integer, String> map = new TreeMap<>(
        Comparator.nullsFirst(Comparator.naturalOrder())
);
```

> [!NOTE]
> Null-key behaviour depends on the ordering mechanism being used.

## Thread Safety

Like `HashMap` and `LinkedHashMap`, `TreeMap` is **not** inherently thread-safe. For concurrent sorted-map requirements, Java provides **`ConcurrentSkipListMap`** rather than a synchronized TreeMap implementation.

## Comparisons

### TreeMap vs HashMap

| Feature | HashMap | TreeMap |
| --- | --- | --- |
| Internal structure | Hash table | Red-Black Tree |
| Ordering | None guaranteed | Sorted keys |
| Average get() | O(1) | O(log n) |
| put() | O(1) avg | O(log n) |
| Range queries | Not natural | Excellent |
| Navigation | ❌ No | ✅ Yes |
| Null key | One allowed | Generally no |
| Thread-safe | ❌ No | ❌ No |

Use **HashMap** for the fastest general-purpose lookup; use **TreeMap** for sorted/navigable key operations.

### TreeMap vs LinkedHashMap

| Feature | LinkedHashMap | TreeMap |
| --- | --- | --- |
| Ordering | Insertion/access | Sorted |
| Structure | Hash table + links | Red-Black Tree |
| Lookup | O(1) avg | O(log n) |
| Range operations | Limited | Excellent |
| Navigation | ❌ No | ✅ Yes |
| LRU use | ✅ Yes | ❌ No |
| Null key | One allowed | Generally no |

### When TreeMap Is the Right Choice

Strong TreeMap signals in a requirement:

- *"Keep keys sorted."*
- *"Find the nearest key."*
- *"Find all entries between X and Y."*
- *"Find the smallest key greater than X."*

## Real-World Examples

### Price ranges

`Price → Product`: find the highest price not exceeding 5000.

```java
Integer price = products.floorKey(5000);
```

Much cleaner than scanning every entry.

### Scheduling

`timestamp → task`: find the next scheduled task after time T.

```java
map.higherEntry(timestamp);
```

### Range query

`Employee ID → Employee`: employees with IDs between 1000 and 2000.

```java
map.subMap(1000, true, 2000, true);
```

## Mutable Keys and Rebalancing

### Mutable Keys and TreeMap

HashMap has a mutable-key problem involving `hashCode()`. TreeMap has a related problem involving **ordering**. If the fields used by the Comparator/`compareTo()` change after insertion, the tree's ordering assumptions can become invalid.

```flow-h
Employee salary = 50000
insert into TreeMap
salary changes to 90000
node is now in the wrong place
```

> [!WARNING]
> Don't mutate fields that determine key ordering while the key is stored in a TreeMap.

### put() Mental Model

```flow The Red-Black Tree maintains balance after insertion
put(key, value)
Compare with root
? Smaller or larger? | Smaller: go left | Larger: go right
repeat comparison
insert node
rebalance
```

### remove() Mental Model

```flow-h O(log n)
remove(key)
Search tree
Find node
Remove node
Rebalance
Tree remains balanced
```

### Tree Rotations

Rebalancing can use **left rotations** and **right rotations**. A right rotation on a left-leaning chain:

```flow-h Rotations change structure while preserving sorted-order relationships
30 → 20 → 10 | left-leaning chain
: right rotation
20 | children: 10, 30
```

### Why Rotation Works

The in-order ordering remains `10 < 20 < 30`, but the tree becomes much more balanced. Red-Black Tree rules determine when rotations/recolouring are necessary.

## Keys, Values and Entries

### Does TreeMap Store Sorted Values?

**No.** It stores **sorted keys**. The values remain associated with their keys but don't influence tree ordering (unless the values are actually part of the key/comparator design).

### Can TreeMap Have Duplicate Values?

Yes — `map.put(10, "A"); map.put(20, "A");` is perfectly valid.

### Can TreeMap Have Duplicate Keys?

No. But remember: **"duplicate" is determined by the TreeMap's comparison**. If `compare(k1, k2) == 0`, TreeMap treats them as equivalent keys.

### firstKey() vs firstEntry()

`firstKey()` returns `K`, while `firstEntry()` returns `Map.Entry<K,V>`. Likewise `lastKey()` / `lastEntry()`.

### pollFirstEntry() vs firstEntry()

| Method | Behaviour |
| --- | --- |
| `firstEntry()` / `lastEntry()` | Inspect only |
| `pollFirstEntry()` / `pollLastEntry()` | Inspect + remove |

## Interview Scenarios

| Requirement | Use |
| --- | --- |
| Student ID → Student in sorted ID order | `TreeMap<Integer, Student>` |
| Nearest key ≤ X | `map.floorKey(x)` |
| Nearest key ≥ X | `map.ceilingKey(x)` |
| All mappings in a range | `map.subMap(from, true, to, true)` |
| Next key after X | `map.higherKey(x)` |
| Previous key before X | `map.lowerKey(x)` |

## Coding and Tricky Questions

### firstKey() and lastKey()

```java
TreeMap<Integer, String> map = new TreeMap<>();

map.put(30, "C");
map.put(10, "A");
map.put(20, "B");

System.out.println(map.firstKey());
System.out.println(map.lastKey());
```

```output
10
30
```

### floorKey() and ceilingKey()

Given keys `10, 20, 30, 40`: `map.floorKey(25)` → **20**, `map.ceilingKey(25)` → **30**.

### lowerKey() and higherKey()

Given keys `10, 20, 30, 40`: `map.lowerKey(30)` → **20**, `map.higherKey(30)` → **40**.

Remember: **lower → <**, **higher → >**, **floor → <=**, **ceiling → >=**.

### Does TreeMap use equals() to determine whether two keys are the same?

Not directly. TreeMap relies on its ordering — `compareTo()` or `Comparator.compare()`. If comparison returns zero, the keys are considered equivalent for Map operations.

### Why can two objects that are not equal according to equals() behave as the same TreeMap key?

Because the Comparator may return `compare(a, b) == 0`, and TreeMap uses that ordering comparison to identify equivalent keys.

### Why is TreeMap slower than HashMap for simple lookup?

`HashMap`: hash calculation → bucket → **O(1)** average. `TreeMap`: tree traversal → **O(log n)**. But TreeMap provides capabilities HashMap doesn't: **sorting + range queries + navigation**.

## Decision Framework

| Need | Choose |
| --- | --- |
| Sorted keys | `TreeMap` |
| floor / ceiling / lower / higher / range | `TreeMap` |
| Only fast average lookup | `HashMap` |
| Insertion/access order | `LinkedHashMap` |
| Concurrent sorted map | `ConcurrentSkipListMap` |

### Final Mental Model

```tree
TreeMap
  Red-Black Tree
    Left subtree | smaller keys
    Right subtree | larger keys
```

Every key follows: **Key → Comparator / compareTo() → left or right → balanced tree**.

The main trade-off:

| Map | Lookup | Capability |
| --- | --- | --- |
| HashMap | O(1) average | No ordering |
| TreeMap | O(log n) | Sorted + navigable |

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| TreeMap | Sorted Map |
| Internal structure | Red-Black Tree |
| Ordering | Key ordering |
| Natural ordering | Comparable |
| Custom ordering | Comparator |
| put() / get() / remove() | O(log n) |
| `firstKey()` | Smallest key |
| `lastKey()` | Largest key |
| `lowerKey()` | < key |
| `floorKey()` | <= key |
| `ceilingKey()` | >= key |
| `higherKey()` | > key |
| `subMap()` | Range view |
| `headMap()` | Keys before boundary |
| `tailMap()` | Keys from boundary |
| `descendingMap()` | Reverse-order view |
| Null key | Generally not with natural ordering |
| Null values | Allowed |
| Duplicate keys | No |
| Duplicate values | Yes |
| Thread-safe | No |
| Concurrent sorted alternative | ConcurrentSkipListMap |

### Interview Readiness Checklist

- What TreeMap is and why it uses a Red-Black Tree
- Why a Red-Black Tree is preferred over an unbalanced BST
- Red-Black Tree balancing concept
- TreeMap `put()`, `get()` and `remove()` flows
- Comparable vs Comparator
- Why Comparator consistency with equals matters
- Why `compare() == 0` can mean equivalent TreeMap keys
- `firstKey()` / `lastKey()`, `lowerKey()` / `floorKey()`, `ceilingKey()` / `higherKey()`
- `subMap()` / `headMap()` / `tailMap()` and why range results are views
- `descendingMap()`
- TreeMap vs HashMap / LinkedHashMap
- Null-key behaviour
- Mutable ordering-key problem
- Why TreeMap isn't thread-safe
- When to choose TreeMap
