---
title: HashMap Internals
subtitle: The full HashMap chain end to end — hash spreading, bucket math, collisions vs duplicates, treeification rules, resize bit-split, modCount and 50+ interview answers.
order: 22
---

## Introduction

This is one of the **highest-value** Java Collections chapters for interviews. If an interviewer asks *"Explain how HashMap works internally,"* you should be able to walk through this entire chain:

```flow
put(key, value)
hashCode()
hash spreading
bucket index
? Empty bucket? | Yes: insert | No: collision → equals() comparison
---
equals() comparison
? Same key? | Yes: replace | No: add node
? Too many collisions? | Yes: treeification | No: keep list
```

Then understand: **size → threshold exceeded → resize → capacity doubles → entries redistributed**.

Let's break this down deeply without repeating concepts already covered in previous chapters.

## What Is HashMap?

`HashMap<K,V>` is a hash-table-based implementation of `Map`.

```java
Map<String, Integer> map = new HashMap<>();
```

It provides **average** `get()`, `put()` and `remove()` in **O(1)**, assuming good hash distribution. The important word is **average** — poor hashing or extreme collisions can change the performance characteristics.

## Internal Structure

```buckets Node<K,V>[] table
0:
1: Node
2:
3: Node, Node
4:
```

Each bucket can contain **nothing**, **linked nodes**, or — when collision conditions warrant — a **tree bin**.

### Node Structure

```java
static class Node<K,V> {
    final int hash;
    final K key;
    V value;
    Node<K,V> next;
}
```

So each entry essentially stores **hash, key, value, next**. The actual JDK implementation contains additional details, but this is the important interview model.

## The put() Process

```java
map.put("Java", 100);
```

```flow-h The two methods/concepts interviewers want you to understand: hashCode() and equals()
"Java"
hashCode()
hash spreading
bucket index
inspect bucket
insert/update
```

### Step 1 — hashCode()

For the key `"Java"`, Java first obtains `key.hashCode()`, which produces an integer. For a custom object:

```java
class Employee {
    int id;

    @Override
    public int hashCode() {
        return id;
    }
}
```

HashMap uses that hash information to determine where the entry should go.

### hashCode() Does NOT Directly Give the Bucket

A common interview mistake is saying *"HashMap uses hashCode as the bucket index."* **Not exactly.** `hashCode()` returns an integer that can be any `int` value. HashMap needs to transform that value into a valid table index, and modern HashMap also performs a **hash-spreading** step.

### Hash Spreading

Conceptually, Java 8+ HashMap uses `h ^ (h >>> 16)` where `h = key.hashCode()`.

```flow-h
original hash
upper bits mixed into lower bits
spread hash
```

**Why?** Because bucket selection relies heavily on the **lower bits** when the table size is a power of two. Mixing higher bits into lower bits helps distribute keys more effectively.

### Why Mix the Upper Bits?

Suppose two keys have hash codes where the **lower bits are identical** but the **upper bits differ**. If only the lower bits influenced bucket selection, those differences would be wasted. `h ^ (h >>> 16)` mixes information from the high bits into the low bits, improving distribution.

### Bucket Index Calculation

One of the most frequently asked HashMap questions. For a table length `n`:

```java
int index = (n - 1) & hash;
```

### Why Not %?

You might expect `hash % n`. HashMap instead uses `hash & (n - 1)` when `n` is a power of two.

| Value | Binary |
| --- | --- |
| n = 16 | `10000` |
| n − 1 = 15 | `01111` |

Therefore `hash & 01111` extracts the relevant lower bits. Bitwise masking is efficient and works cleanly because HashMap maintains power-of-two capacities.

### Why Must Capacity Be a Power of Two?

A classic interview question. If capacity = 16, then capacity − 1 = 15 = `00001111`. Masking becomes straightforward — `hash & 00001111` efficiently maps hashes to indices **0 → 15**. A non-power-of-two capacity would not give the same useful bitmask behaviour.

### Complete Hash Calculation

```flow-h This sequence is extremely important
key
key.hashCode()
h ^ (h >>> 16)
(n - 1) & hash
bucket index
```

### Example

Suppose `hash = 101101011010` and capacity = 16. Then `n − 1 = 15 = 1111`, and the final bucket is determined from the relevant lower bits through `hash & 1111`. The exact numeric result isn't important — **the mechanism is**.

### Empty Bucket

Suppose `index = 5` and `table[5] == null`. HashMap simply inserts `table[5] → Node("Java", 100)`. Done.

### Occupied Bucket

Then we have a **hash collision** — e.g. Key A → bucket 5 and Key B → bucket 5. Even if `A != B`, they can still map to the same bucket. This is completely normal.

## Collisions vs Duplicate Keys

### Hash Collision

A collision means **different keys → same bucket**. It does **not** necessarily mean `hashCode(A) == hashCode(B)`. Two different hash codes can still map to the same bucket, because the final bucket index uses only part of the hash.

> [!IMPORTANT]
> Same bucket does **not** imply same hash code.

### Collision Example

Key A with hash 10 and Key B with hash 26: with a small table (16 buckets), `10 & 15 = 10` and `26 & 15 = 10`, so both map to the same bucket. HashMap stores both:

```buckets
9:
10: A, B
11:
```

### How Does HashMap Distinguish Colliding Keys?

It uses **hash + `equals()`**: same bucket → compare stored hash → if necessary compare keys with `equals()`. The `equals()` method determines whether the key is actually the same logical key.

### Collision ≠ Duplicate Key

This distinction is critical.

| Collision | Duplicate key |
| --- | --- |
| Different keys | Same logical key |
| Same bucket | Same bucket |
| `equals()` == false | `equals()` == true |
| Bucket holds multiple entries | Existing value is replaced |

### Example

```java
map.put("A", 10);
map.put("B", 20);
```

If A and B collide, the bucket holds `A → B` — both remain. But after `map.put("A", 30);` the map holds `A → 30`, `B → 20`: the existing A mapping is updated.

## The equals() / hashCode() Contract

> If `a.equals(b)` is true, `a.hashCode()` **must** equal `b.hashCode()`.

Otherwise HashMap can place logically equal keys into different buckets.

### Example of a Broken Contract

```java
class Employee {
    int id;

    @Override
    public boolean equals(Object o) {
        Employee e = (Employee) o;
        return id == e.id;
    }

    @Override
    public int hashCode() {
        return System.identityHashCode(this);
    }
}
```

Now `e1.equals(e2)` → `true`, but `e1.hashCode() != e2.hashCode()` can occur. HashMap's assumptions are broken.

### Correct Contract

If `a.equals(b) == true`, then `a.hashCode() == b.hashCode()` must also be true. But the **reverse is NOT required** — an extremely common interview question.

### Same Hash ≠ Equal Objects

Two objects can have the **same `hashCode()`** but **`equals() == false`**. That's a collision: `A.hashCode() → 100`, `B.hashCode() → 100`, `A.equals(B) → false` — HashMap stores both.

### Roles of hashCode() and equals()

```flow When looking for a key
calculate hash
find bucket
compare candidate hash
compare keys with equals()
? Same key? | Yes: found | No: next candidate
```

> [!TIP]
> **`hashCode()` → locate the area. `equals()` → identify the exact key.** One of the best ways to remember their roles.

## get() and remove() Internals

### get()

```java
map.get(key);
```

```flow-h If no matching key exists: null
key
hashCode()
spread hash
bucket index
compare candidate
equals()
return value
```

### remove()

```java
map.remove(key);
```

```flow-h If the key doesn't exist, no mapping is removed
hash
bucket
search
equals()
remove matching node
```

## Java 7 vs Java 8 and Treeification

### Java 7 vs Java 8 HashMap

A very important interview topic.

```flow
Java 7
bucket
Node → Node → Node | linked list only
---
Java 8+
bucket
heavy collision chain
TreeBin → Red-Black Tree
```

This is one of the major improvements.

### Why Treeification Was Introduced

A heavily collided bucket `A → B → C → D → E → F → G → H → …` makes searching approach **O(n)**. Treeification changes the structure to a **balanced tree**, so lookup becomes approximately **O(log n)** within that tree.

```tree
D
  B
    A
    C
  F
    E
    G
```

### Red-Black Tree

The tree structure used for treeified HashMap bins is a **self-balancing Red-Black Tree**. The goal is to prevent the collision structure from degenerating into a long linear chain.

### Treeification Threshold

```java
TREEIFY_THRESHOLD = 8
```

Treeification is **considered** when a bin becomes sufficiently populated. But HashMap doesn't immediately treeify every bin that reaches eight nodes.

### Minimum Treeify Capacity

```java
MIN_TREEIFY_CAPACITY = 64
```

```flow Once the table is large enough, treeification can occur when the collision threshold is reached
bin gets crowded
? Table capacity < 64? | Yes: resize instead of treeify | No: treeify
```

### Why Resize Instead of Treeify?

A small table naturally causes more collisions. With capacity = 16 and one bucket containing many entries, rather than immediately building a tree, HashMap may prefer to resize to 32 or 64, spreading entries across more buckets.

> [!WARNING]
> *"8 nodes means tree"* is an incomplete interview answer.

### Correct Interview Answer

> [!TIP]
> *"When does HashMap treeify?"* — When a bin becomes sufficiently large, around the treeification threshold of 8 nodes, HashMap may convert it to a tree, **provided the table has reached the minimum capacity of 64**. Otherwise, resizing is preferred.

### Untreeification

A tree bin can later be converted back to a linked structure when the number of nodes becomes sufficiently small. A commonly cited implementation threshold is:

```java
UNTREEIFY_THRESHOLD = 6
```

The exact transition conditions are implementation details, but the concept is: **many collisions → tree; entries decrease → potentially linked list**.

### Why Not Keep the Tree Forever?

A tree has more structural overhead than a simple linked node chain. If the bin becomes small again, the linked representation may be more efficient, so HashMap can reduce unnecessary overhead.

### Treeification Is Per Bucket

HashMap doesn't become *"entire Map → Red-Black Tree."* Instead:

| Bucket | Structure |
| --- | --- |
| 1 | Linked list |
| 2 | Empty |
| 3 | Tree |
| 4 | Linked list |

Only collision-heavy bins are treeified.

### HashMap Is Still a Hash Table

Even with tree bins, HashMap is an **array of buckets**; some buckets may contain trees. It doesn't become a `TreeMap`.

| HashMap | TreeMap |
| --- | --- |
| Hash table | Red-Black Tree |
| O(1) average lookup | O(log n) |

HashMap's treeification is only a mechanism for handling collisions inside individual buckets.

## Load Factor, Capacity, Size and Threshold

### Load Factor

> Load factor controls **when HashMap resizes**.

Default load factor: **0.75**.

```text
threshold = capacity × loadFactor
          = 16 × 0.75
          = 12
```

Once the size crosses the threshold, resizing occurs.

### Why 0.75?

A compromise between **memory usage** and **collision frequency**.

| Load factor | Buckets | Collisions | Memory |
| --- | --- | --- | --- |
| Lower | More | Fewer | More |
| Higher | Fewer | More | Less |

### Capacity vs Size vs Threshold

| Term | Meaning | Example |
| --- | --- | --- |
| Capacity | Number of buckets | 16 |
| Size | Number of mappings | 10 |
| Threshold | Approximately when resizing is triggered: capacity × load factor | 12 |

With capacity 16 and size 10, the Map has 16 buckets but only 10 entries.

### Load Factor Trade-Off

- **Lower load factor (e.g. 0.50):** more buckets → fewer collisions → more memory.
- **Higher load factor (e.g. 0.90):** fewer buckets → potentially more collisions → less table memory.

The default **0.75** is a practical balance.

### Does a Higher Load Factor Always Mean Faster?

**No.** A higher load factor can increase collisions, leading to longer bins, more comparisons and potentially more tree bins. The correct load factor depends on workload and memory/performance trade-offs.

### Does a Lower Load Factor Always Mean Faster?

**No.** You consume more memory and may get diminishing returns. Performance and memory must be balanced.

## Resizing

### Resize

When `size > threshold`, HashMap grows. For the normal growth path: **16 → 32 → 64 → 128**. Capacity generally **doubles**.

### Why Double the Capacity?

Doubling allows HashMap to efficiently redistribute entries. Because capacity remains a power of two, the new bucket position can be determined efficiently — an important Java 8+ implementation optimization.

### Rehashing

The term "rehashing" is often used loosely. Strictly speaking, when HashMap resizes, it doesn't necessarily recompute each key's original `hashCode()` from scratch. It **redistributes entries based on the existing hash information** and the new table capacity.

> [!NOTE]
> A better modern-Java explanation: **resize + redistribution**, rather than imagining every key's hashCode being recalculated.

### The Important Resize Trick

With old capacity 16 and new capacity 32, an existing entry's new index is either its **old index** or **old index + old capacity**, depending on a particular hash bit.

```flow-h One of the clever optimizations in Java 8 HashMap resizing
old bucket 5
? Hash bit 16 set? | No: new bucket 5 | Yes: new bucket 21 (5 + 16)
```

### Why Only One Bit Matters During Doubling

Because **new capacity = old capacity × 2**, the mask gains **one additional bit**. Each existing entry can generally remain at the same index or move to *old index + old capacity*, depending on that bit. For example, an entry in bucket 3 of a 16-bucket table goes to bucket **3** or **19** (`3 + 16`) after resizing to 32. This avoids recalculating the complete bucket placement from scratch.

### Resize Visualization

```buckets Before — capacity 16
3: A, B
7: C
12: D, E
```

```buckets After — capacity 32 (exact distribution depends on hash bits)
3: A
7: C
12: D
19: B
28: E
```

## Construction and Lazy Initialization

### Initial Capacity

`new HashMap<>(16);` specifies an initial-capacity-related **sizing expectation**, not necessarily *"allocate exactly 16 buckets immediately."* Modern HashMap is lazily initialized — the actual table allocation happens when needed, typically on the first insertion.

### Lazy Initialization

```java
HashMap<String, Integer> map = new HashMap<>();
```

Creating the HashMap does not necessarily allocate the full bucket table immediately. The table is initialized when the Map first needs storage.

### Default Capacity and Threshold

The commonly documented default initial capacity is **16** with load factor **0.75**, and the table is lazily initialized. Once the table is initialized, the resize threshold becomes approximately **12**.

> [!NOTE]
> Don't oversimplify the constructor state by saying the threshold is always 12 immediately after object creation.

### Constructor Options

```java
new HashMap<>();
new HashMap<>(32);
new HashMap<>(32, 0.75f);
new HashMap<>(existingMap);
```

### Choosing Initial Capacity

If you know approximately how many entries will be inserted, supplying a suitable initial capacity can reduce resizing:

```java
Map<String, User> users = new HashMap<>(expectedCapacity);
```

But be careful: constructor capacity is not necessarily equal to the eventual internal table length at construction time. HashMap rounds sizing to its power-of-two strategy.

## put() — Complete Flow

Combine everything for `map.put(key, value)`:

```flow This is the answer interviewers are looking for
1. Is the table initialized?
2. Calculate / spread hash
3. Calculate bucket index
? 4. Is bucket empty? | Yes: insert | No: 5. compare existing key
---
5. Compare existing key
? 6. Same key? | Yes: replace value | No: collision — traverse linked/tree bin, insert new node
: afterwards
Collision threshold reached? → treeify if eligible
size > threshold? → resize
```

### Duplicate Key During put()

```java
map.put("A", 10);
map.put("A", 20);
```

HashMap finds **same hash + keys equal**, so `A → 20`. Size remains **1**.

### New Key During Collision

If A and B land in the same bucket but `A.equals(B) == false`, the bucket holds `A → B` and the **size increases**.

### get() Does Not Modify the Map

A normal `map.get(key)` does not add an entry. It simply: **hash → bucket → search → return**.

## Null Handling

### get() and Null Values

HashMap permits null values, so `map.get("A")` returning `null` could mean **A is absent** or **A exists with a null value**. Use `map.containsKey("A")` to distinguish.

### Null Key Internals

HashMap allows **one** null key: `map.put(null, "value");` works. Internally, the null key is handled specially rather than calling `null.hashCode()`, which would cause a `NullPointerException`.

### Null Value

HashMap also allows `map.put("A", null);`. So: **null key → one allowed, null value → allowed**. This differs from `ConcurrentHashMap`.

## The Mutable Key Problem

One of the most important HashMap interview topics.

```java
class Employee {
    int id;

    @Override
    public int hashCode() {
        return id;
    }

    @Override
    public boolean equals(Object obj) {
        // ...
    }
}
```

```java
Employee e = new Employee(10);
map.put(e, "John");

e.id = 20;
```

The object remains physically in its **old bucket**, but its logical hash may now point to a **different bucket**.

```flow
Initially
Employee id = 10
hash = 10
bucket 10 | entry stored here
---
After mutation
Employee id = 20
hash = 20
bucket 20 | get(e) searches here — not found
```

### Why Does get() Fail?

Because HashMap calculates the **current** hash of `e` (20) and searches bucket 20, but the entry was originally stored in bucket 10. Therefore it isn't found.

### Best Practice

Use **immutable keys**. Good examples: `String`, `Integer`, `Long`, enums, records with immutable components, or carefully designed immutable domain objects.

### equals() Must Be Consistent

If key equality changes after insertion, Map behaviour can become unpredictable. Keys should ideally be **immutable + stable `equals()` + stable `hashCode()`** while stored.

### Why String Is an Excellent HashMap Key

`String` is effectively immutable. Its `equals()` and `hashCode()` behaviour remains stable after insertion — one reason Strings are commonly used as keys.

## Concurrency and Iteration

### Java 7 HashMap Infinite Loop Issue

A historical interview topic: *why could Java 7 HashMap experience an infinite loop during concurrent resize?* The old implementation could transfer linked-list nodes in a way that allowed concurrent resize operations to create a **cyclic linked structure** — `A → B → C` could become `A → B → C → A` — so traversal could loop forever.

### Java 8 Improvement

Java 8 changed the resize mechanics and introduced tree bins. The historical infinite-loop problem associated with concurrent HashMap resizing was addressed by the changed implementation.

> [!WARNING]
> **HashMap is still not thread-safe.** Do not conclude that Java 8 made HashMap safe for concurrent modification.

### HashMap Concurrent Modification

Even though modern HashMap is improved internally, it still should not be concurrently mutated by multiple threads without external synchronization. Use **`ConcurrentHashMap`** for concurrent Map requirements.

### Fail-Fast Iterator

HashMap iterators are generally **fail-fast**:

```java
for (String key : map.keySet()) {
    map.put("X", 100);
}
```

```output
ConcurrentModificationException
```

### What Does Fail-Fast Mean?

The iterator detects certain structural modifications made outside the iterator and may throw `ConcurrentModificationException`. The purpose is to **detect programming errors early**. It is **not** a thread-safety mechanism.

### modCount

HashMap internally maintains a **modification count**. Iterators compare their `expectedModCount` against the Map's current `modCount`. If they differ unexpectedly, `ConcurrentModificationException` may be thrown.

### Fail-Fast Is Best-Effort

Fail-fast behaviour is not guaranteed as a synchronization mechanism — the JDK documentation describes it as **best-effort**. Never write business logic that depends on `ConcurrentModificationException` being thrown.

### Iterator Removal

```java
Iterator<String> iterator = map.keySet().iterator();

// ... when you want to remove the current entry:
iterator.remove();
```

Use `iterator.remove()` rather than directly modifying the Map — the supported iterator-removal mechanism.

### Structural vs Non-Structural Modification

A **structural** modification changes the Map's structure — adding or removing a mapping. Simply replacing the value of an existing mapping isn't necessarily structural, so `map.put(existingKey, newValue)` may not have the same iterator implications as adding/removing an entry.

### HashMap Is Not Synchronized

HashMap is **not thread-safe**. If multiple threads modify it concurrently, use `ConcurrentHashMap` or another appropriate synchronization strategy.

### Collections.synchronizedMap()

```java
Map<K,V> map = Collections.synchronizedMap(new HashMap<>());
```

This provides synchronized access around Map operations, but iteration requires proper external synchronization according to the wrapper's contract. For high-concurrency applications, `ConcurrentHashMap` is usually the better fit.

## Tree Bins and Comparable

### Treeification and Comparable

Tree bins need a way to order nodes. When keys are comparable in a suitable way, their ordering can help the tree structure. If keys aren't naturally comparable, HashMap has additional **tie-breaking** mechanisms.

### Do Keys Need Comparable?

**No** — a common misconception. You can use `HashMap<MyClass, String>` without `MyClass implements Comparable<MyClass>`. Treeification can still occur, using internal tie-breaking logic.

### Why Doesn't HashMap Require Comparable?

Because HashMap isn't a sorted collection. The tree is an **internal collision-management mechanism**, not a user-visible sorting feature.

### HashMap Tree Bin ≠ Sorted Map

This is extremely important. If you need sorted keys, use **`TreeMap`**. Tree bins exist only to manage collisions efficiently.

## Complexity and Hash Quality

### Worst-Case Complexity

| Situation | Complexity |
| --- | --- |
| Heavily collided linked bin (before treeification) | O(n) |
| Tree bin lookup | ≈ O(log n) |
| Normal operations with good hashing | O(1) average |

### Does Treeification Make HashMap O(log n)?

**No** — another interview trap. HashMap is still **average O(1)**. The tree only affects individual heavily collided bins. You should not describe HashMap as O(log n) just because tree bins exist.

### Why HashMap Needs Both Hash and Equals

Imagine **100,000 entries**. If HashMap used only `equals()`, it might have to compare the requested key against every entry. Hashing narrows the search: **100,000 entries → one bucket → few candidates**, then `equals()` identifies the exact key.

- `hashCode()` → narrow the search space
- `equals()` → confirm the exact key

### Performance Depends on a Good hashCode()

```java
@Override
public int hashCode() {
    return 1;
}
```

Every key maps to the same bucket (`A → B → C → D → E → …`), creating heavy collision behaviour. Modern HashMap can treeify such bins when conditions permit, but a good hash function is still essential.

### Constant Hash Code Example

```java
class BadKey {
    int id;

    @Override
    public int hashCode() {
        return 1;
    }

    @Override
    public boolean equals(Object obj) {
        return this == obj;
    }
}
```

Every key goes to the same bucket — terrible for distribution.

### HashMap Doesn't Guarantee Order

```java
map.put("A", 1);
map.put("B", 2);
map.put("C", 3);
```

The iteration order is not guaranteed to be `A, B, C`. Use `LinkedHashMap` for insertion/access order, and `TreeMap` for sorted order.

### HashMap Memory Model

```flow-h As entries grow: size → threshold → resize → larger table
HashMap
Node[] table
buckets | 0: — · 1: Node · 2: — · 3: Node → Node · …
```

## Complete Interview Answers

> [!TIP]
> **Explain HashMap put() internally.** HashMap first computes the key's hash code and applies hash spreading. It then calculates the bucket index using `(n - 1) & hash`, where the table capacity is a power of two. If the bucket is empty, a node is inserted. If it is occupied, HashMap checks the hash and key equality to determine whether the key already exists; if so, its value is replaced. Otherwise the new entry is added to the collision structure. If the bin becomes sufficiently large, it may be treeified, provided the table is large enough. After insertion, if the size exceeds the resize threshold, the table is resized and entries are redistributed.

> [!TIP]
> **Explain get().** HashMap computes and spreads the key's hash, determines the bucket index, then searches the corresponding bin. It compares candidate hashes and uses key equality to identify the exact mapping. If the key is found, its value is returned; otherwise `null` is returned.

> [!TIP]
> **Explain collisions.** A collision occurs when different keys map to the same bucket. HashMap stores those entries in the same bin — historically as a linked list and, in modern Java, potentially as a Red-Black Tree when the collision count and table-capacity conditions justify treeification.

> [!TIP]
> **Explain rehashing.** When the number of mappings crosses the resize threshold, HashMap increases the table capacity, normally doubling it. Because the capacity remains a power of two, entries can be efficiently redistributed between their old index and old index plus the old capacity based on the relevant hash bit. The key's original hashCode doesn't need to be recomputed from scratch for every entry.

> [!TIP]
> **Explain load factor.** Load factor controls how full the hash table is allowed to become before resizing. The default is 0.75. A lower load factor generally reduces collisions at the cost of memory, while a higher load factor saves memory but can increase collisions.

> [!TIP]
> **Explain treeification.** When a bin becomes sufficiently collision-heavy, around eight nodes, HashMap may convert that bin into a Red-Black Tree. However, it first considers table capacity; if the table is too small, resizing is preferred. The commonly cited minimum treeification capacity is 64.

## Interview Questions

### Q1. Why does HashMap use a power-of-two capacity?

So bucket indexing can efficiently use `(n - 1) & hash`, and doubling the capacity during resize allows entries to either remain at the same index or move by the old capacity based on one additional hash bit.

### Q2. What is the difference between capacity, size and threshold?

- **Capacity** → number of buckets
- **Size** → number of mappings
- **Threshold** → approximate size at which resize occurs (≈ capacity × load factor)

### Q3. What is the default load factor?

0.75.

### Q4. What is the default initial capacity?

Commonly 16, with lazy table initialization.

### Q5. Why isn't a collision a problem?

Collisions are expected in hash tables. HashMap handles them through linked nodes and, for sufficiently collision-heavy bins under the right conditions, Red-Black Trees. The goal is to keep average performance efficient.

### Q6. What happens when two keys have the same hashCode?

They may map to the same bucket. HashMap then uses key equality to determine whether they represent the same logical key. If `equals() == false`, both entries can coexist.

### Q7. What happens if two keys have the same hashCode and equals() returns true?

They represent the same logical key. The new value replaces the existing value, and the size does not increase.

### Q8. Can two unequal keys have the same hashCode?

Yes — that's a collision. `hashCode(A) == hashCode(B)` with `A.equals(B) == false` is perfectly valid.

### Q9. If two objects have the same hashCode, are they equal?

No. The correct implication is: `equals() == true` ⇒ `hashCode()` must be the same. But the same `hashCode()` does **not** imply `equals()` is true.

### Q10. Why should HashMap keys be immutable?

Because changing fields used by `equals()` or `hashCode()` after insertion can cause the Map to search a different bucket from the one where the entry was stored.

### Q11. Can HashMap have a null key?

Yes — one null key.

### Q12. Can HashMap have multiple null values?

Yes — e.g. `map.put("A", null); map.put("B", null);` are both valid.

### Q13. Is HashMap thread-safe?

No. Concurrent mutation requires external synchronization or a concurrent collection such as `ConcurrentHashMap`.

### Q14. Why doesn't HashMap use hashCode() directly as the index?

Because `hashCode` is a general integer and isn't necessarily in the range `0 … capacity − 1`. HashMap spreads the hash and maps it to a valid bucket index.

### Q15. Why does HashMap use (n - 1) & hash?

Because its table size is maintained as a power of two, allowing efficient bit masking to calculate the bucket index.

### Q16. What is treeification?

Converting a collision-heavy bucket from a linked-node representation into a tree-based representation.

### Q17. Is every bucket a tree?

No. Only sufficiently collision-heavy bins can become trees. Most bins remain empty, a single node, or linked nodes.

### Q18. Is HashMap internally a Red-Black Tree?

No. It is primarily a hash table (`Node[]`), with individual collision-heavy bins potentially represented as Red-Black Trees.

### Q19. Does treeification make HashMap sorted?

No. Tree bins are internal collision-management structures. HashMap still doesn't guarantee sorted iteration.

### Q20. What is TREEIFY_THRESHOLD?

A common JDK implementation constant: **8**. It represents the bin size at which treeification may be considered — but `MIN_TREEIFY_CAPACITY = 64` also matters.

### Q21. What is UNTREEIFY_THRESHOLD?

A common implementation value: **6**. It is associated with converting a tree bin back to a linked representation when the bin becomes sufficiently small.

### Q22. Why does HashMap resize before treeifying in some cases?

If the table is too small, collisions may be caused primarily by insufficient capacity. Increasing capacity can distribute entries across more buckets more cheaply than immediately creating a tree.

### Q23. Does HashMap recompute hashCode during resize?

Don't say *"It calls hashCode() again for every key."* Better: the existing hash values are reused and entries are redistributed according to the new capacity. Java 8+ uses an efficient high-bit split during doubling.

### Q24. Why does resizing normally double capacity?

It preserves the power-of-two property and enables efficient redistribution using the old index and the old capacity offset.

### Q25. What is the worst-case lookup complexity?

O(n) for a heavily collided linked bin; O(log n) for a treeified bin; O(1) average with good hashing.

### Q26. What is the difference between HashMap and ConcurrentHashMap?

| HashMap | ConcurrentHashMap |
| --- | --- |
| Not thread-safe | Thread-safe |
| Permits null key/value | No null key/value |
| Fail-fast iterator | Weakly consistent iterator |
| General use | Designed for concurrent access |

### Q27. What happens if HashMap is modified while iterating?

A fail-fast iterator may throw `ConcurrentModificationException` for certain structural modifications. But this behaviour is best-effort, not a concurrency guarantee.

## Coding Questions

### Duplicate key

```java
Map<String, Integer> map = new HashMap<>();

map.put("A", 10);
map.put("A", 20);

System.out.println(map.size());
System.out.println(map.get("A"));
```

```output
1
20
```

### Null value present

```java
Map<String, Integer> map = new HashMap<>();

map.put("A", null);

System.out.println(map.get("A"));
System.out.println(map.containsKey("A"));
```

```output
null
true
```

### Key absent

```java
Map<String, Integer> map = new HashMap<>();

System.out.println(map.get("A"));
System.out.println(map.containsKey("A"));
```

```output
null
false
```

This demonstrates the null-value ambiguity.

### Same hash, not equal

`A.hashCode() = 100`, `B.hashCode() = 100`, `A.equals(B) = false`. Can both exist in HashMap? **Yes** — they are different logical keys despite having the same hash.

### Equal but different hash

`A.hashCode() = 100`, `B.hashCode() = 200`, `A.equals(B) = true`. Is this a valid key implementation? **No** — it violates *equal objects → same hashCode*.

### Mutable key

```java
Employee e = new Employee(10);

map.put(e, "John");
e.setId(20);

System.out.println(map.get(e));
```

Can this return `null`? **Yes**, if `id` participates in `hashCode()` and `equals()`. The classic mutable-key problem.

### Constant hashCode

If all keys return `hashCode() = 1`, all keys tend toward the same bucket. Modern HashMap can treeify the heavily collided bin when its capacity and threshold conditions permit, but performance is still much worse than having a well-distributed hash function.

### A bin reaches 8 entries

Does it automatically become a tree? **Not necessarily.** If the table capacity is below the required minimum of 64, HashMap may resize instead.

### Threshold calculation

With capacity = 16 and load factor = 0.75, the threshold is approximately `16 × 0.75 = 12`. When the size exceeds the threshold, a resize is triggered.

### Resize index

Old capacity 16 → new capacity 32. An entry from bucket **5** can generally remain at **5** or move to **21** (`5 + 16`).

## Senior-Level Questions

### Why does HashMap use hash spreading if hashCode is already provided?

`hashCode` implementations may not distribute useful information evenly in the low bits. Because bucket selection with power-of-two capacity depends heavily on low bits, HashMap mixes higher bits into lower bits to improve distribution.

### Why is equals() called after locating a bucket?

Because multiple keys can map to the same bucket. Hashing narrows the search from **all entries → one bucket**; equality then determines **which key exactly**.

### Why can equal objects not be placed in different buckets?

They shouldn't be, assuming the `equals()`/`hashCode()` contract is correctly implemented. If `a.equals(b)`, then `a.hashCode() == b.hashCode()`, and they follow the same hash/bucket calculation.

### Why can unequal objects be in the same bucket?

Because a finite number of buckets must accommodate potentially many possible hash values. Collisions are inevitable.

### Why doesn't HashMap simply use a LinkedList for everything?

Because a long collision chain can degrade lookup toward O(n). Treeification provides better worst-case behaviour for heavily collided bins.

### Why doesn't HashMap use a tree for the entire Map?

Because hashing gives excellent average O(1) lookup. A global tree would unnecessarily turn normal lookups into O(log n). The tree is only needed for problematic individual bins.

### Why doesn't HashMap automatically resize after every collision?

Because resizing costs time and memory, and a few collisions are normal. HashMap balances **table size + collision rate + memory** using capacity and load factor.

### What happens if the load factor is 1.0?

The Map can tolerate a fuller table before resizing. This may reduce memory usage but can increase collisions. It isn't automatically better or worse — it's a trade-off.

### Why is 0.75 commonly used?

It provides a practical balance between space efficiency and lookup performance.

### What is the difference between resizing and treeification?

| Resizing | Treeification |
| --- | --- |
| Increases the number of buckets | Changes one heavily collided bin into a tree |

They solve different problems.

### Can a tree bin become a linked list again?

Yes. When the number of nodes falls sufficiently, the bin can be untreeified.

### Does HashMap use synchronization internally?

Normal HashMap is not designed as a thread-safe Map. Don't rely on its internal mechanics for synchronization — use `ConcurrentHashMap` when concurrent access is required.

## The Complete HashMap Mental Model

Memorize this. If you can explain it naturally, you understand HashMap internals at an interview-ready level.

```flow
HashMap → Node[] table
put(k, v)
hashCode()
hash spreading
(n - 1) & hash → bucket index
? Bucket? | Empty: insert | Occupied: collision → hash + equals()
---
hash + equals()
? Same key? | Yes: replace | No: add node
Bin becomes large? → treeification
size > threshold? → resize
capacity × 2 → redistribute
```

## HashMap Interview Cheat Sheet

| Concept | Remember |
| --- | --- |
| Structure | Hash table |
| Main array | `Node[] table` |
| Hash | `hashCode()` + spreading |
| Spread | `h ^ (h >>> 16)` concept |
| Bucket index | `(n - 1) & hash` |
| Capacity | Power of two |
| Default initial capacity | 16 |
| Default load factor | 0.75 |
| Threshold | capacity × load factor |
| Collision | Different keys → same bucket |
| Duplicate key | `equals()` true → replace value |
| Collision structure | Linked nodes / tree |
| Tree type | Red-Black Tree |
| Tree threshold | 8 |
| Minimum treeify capacity | 64 |
| Untreeify threshold | Commonly 6 |
| Average lookup | O(1) |
| Heavy linked collision | O(n) |
| Tree bin lookup | ≈ O(log n) |
| Resize | Usually doubles capacity |
| Resize redistribution | Old index or old index + old capacity |
| Null key | One allowed |
| Null value | Allowed |
| Ordering | None guaranteed |
| Thread-safe | ❌ No |
| Iterator | Fail-fast, best-effort |
| Mutable keys | Dangerous |
| Comparable required for treeification? | ❌ No |
| Tree bins make HashMap sorted? | ❌ No |

## Chapter Summary

When asked *"How does HashMap work?"*, don't give a 30-second shallow answer. Use this sequence:

1. HashMap maintains a bucket array.
2. On put/get, it obtains the key's `hashCode`.
3. The hash is spread to improve distribution.
4. The bucket index is calculated using `(n - 1) & hash`.
5. If the bucket is empty, insert.
6. If occupied, compare hashes and keys using `equals()`.
7. Same key → replace value.
8. Different key → collision structure.
9. Heavy collision → treeification when conditions are met.
10. When size exceeds the threshold → resize the table.
11. Capacity normally doubles.
12. Entries are redistributed efficiently using the additional hash bit.
13. Average lookup is O(1).
14. HashMap is not thread-safe.

That answer demonstrates both API-level understanding and implementation-level knowledge.
