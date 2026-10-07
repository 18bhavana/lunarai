---
title: HashMap
subtitle: HashMap from the inside — Node<K,V>, hash spreading, (n-1) & hash, put/get flows, collisions, treeification, load factor and resizing.
order: 15
---

## Introduction

`HashMap` is one of the most important Java interview topics — the implementation you should understand **internally**, not just at API level. The central idea:

> HashMap converts a key into a **hash**, uses that hash to locate a **bucket**, and then uses **equality** to identify the exact key.

We'll build the internals without repeating the basic Map concepts from the Map Interface chapter.

## HashMap at a Glance

```java
Map<Integer, String> map = new HashMap<>();

map.put(101, "Java");
map.put(102, "Spring");
```

```flow-h
HashMap
Hash Table
Bucket
Entry | 102 → Spring
```

| Operation | Average | Worst / pathological |
| --- | --- | --- |
| put() | O(1) | O(log n) with tree bins |
| get() | O(1) | O(log n) with tree bins |
| remove() | O(1) | O(log n) with tree bins |
| containsKey() | O(1) | O(log n) with tree bins |

The O(1) figure assumes **good hash distribution**.

## What Does HashMap Actually Store?

Internally, `HashMap` maintains an array called the **table**:

```java
Node<K,V>[] table;
```

Each occupied bucket contains a chain/tree of nodes. A simplified `Node` looks like:

```java
static class Node<K,V> {
    final int hash;
    final K key;
    V value;
    Node<K,V> next;
}
```

So each entry contains **hash, key, value, next**. The `next` reference allows multiple entries to exist in the same bucket.

### HashMap Internal Structure

```java
map.put("A", 100);
map.put("B", 200);
map.put("C", 300);
```

```buckets table
0:
1: [A, 100]
2: [B, 200]
3: [C, 300]
```

If two keys land in the same bucket, they are chained: `bucket 2 → [A,100] → [B,200]`. That's a **hash collision**.

## The put() Journey

When you execute `map.put(key, value);` think:

```flow If the bucket becomes sufficiently crowded, it may be converted from a linked structure to a tree
put()
Calculate hash
Calculate bucket index
Check bucket
? Empty? | Yes: Insert | No: Compare existing keys
---
Compare existing keys
? Same key? | Yes: Replace value | No: Collision handling
```

## Step 1 — Calculate the Hash

For a key like `"Java"`, HashMap obtains `key.hashCode()`. But modern HashMap doesn't simply use that value directly — it performs additional **bit mixing**.

### Hash Spreading

Conceptually, Java 8+ HashMap uses `h ^ (h >>> 16)`. The implementation's hash method is essentially:

```java
static final int hash(Object key) {
    int h;
    return (key == null)
            ? 0
            : (h = key.hashCode()) ^ (h >>> 16);
}
```

**Why?** Because the bucket index uses only **part** of the hash. Mixing high bits into low bits helps improve distribution.

### Why Mix the Hash?

If a key's `hashCode()` has poor variation in its low bits, many keys can land in the same bucket.

```flow-h This reduces unnecessary collisions
Original hash
Mix high bits into low bits
Better bucket distribution
```

### Null-Key Special Case

`HashMap` permits **one** null key:

```java
map.put(null, "Hello");
```

HashMap assigns **`hash = 0`** to a null key, so null handling doesn't require calling `null.hashCode()` — which obviously isn't possible.

## Step 2 — Calculate the Bucket Index

For a table of size `n`:

```java
index = (n - 1) & hash;
```

This is one of the most frequently asked HashMap questions. **Why not `hash % n`?** Because bitwise AND is efficient when `n` is a **power of two**.

### Why Capacity Is a Power of 2

Typical capacities: `16, 32, 64, 128, 256, …`

Suppose `n = 16` → `n - 1 = 15` → binary `1111`. Therefore `hash & 1111` efficiently extracts the relevant lower bits. This is the basis for `(hash & (n - 1))`.

### Why Not Any Arbitrary Capacity?

| n | n − 1 | Binary | Mask quality |
| --- | --- | --- | --- |
| 16 | 15 | `1111` | Clean bit mask |
| 10 | 9 | `1001` | Distribution properties not equivalent |

HashMap therefore uses power-of-two table sizes.

## Step 3 — Find the Bucket

After calculating `index = (n - 1) & hash`, HashMap accesses `table[index]`. If `table[index] == null`, the entry can be inserted directly. If not, **collision handling** begins.

## Collisions and Treeification

### Collision

A collision occurs when **different keys map to the same bucket** — e.g. Key A → bucket 5 and Key B → bucket 5. Even if `A.equals(B) == false`, they can still share a bucket.

> [!IMPORTANT]
> Same bucket does **not** mean same key.

### Collision Handling

Modern HashMap can use a **linked list** or a **Red-Black tree** inside a bucket.

```flow-h Initially: bucket 5 holds a chain
A
B
C
```

If the collision chain becomes large enough, bucket 5 may become a Red-Black Tree. This is called **treeification**.

### Why Treeify?

Suppose one bucket has many entries: `A → B → C → D → E → F → G → H`. Searching a long linked list can approach **O(n)**; a balanced tree provides approximately **O(log n)** within that bucket. So treeification improves **worst-case** collision behaviour.

### Treeification Threshold

```java
TREEIFY_THRESHOLD = 8
```

When a bucket's node count reaches the relevant threshold, HashMap **may** attempt to treeify the bucket.

> [!NOTE]
> Eight entries in a bucket does not automatically mean "convert immediately to a tree." HashMap also considers the overall table capacity.

### Minimum Treeify Capacity

```java
MIN_TREEIFY_CAPACITY = 64
```

If the table is too small, HashMap prefers **resizing** rather than treeifying.

```flow This distinction is frequently tested
Bucket becomes crowded
? Capacity < 64? | Yes: Resize | No: Treeify
```

### Why Resize Instead of Treeify?

A small table (e.g. size 16 with many entries) can naturally create collisions simply because there aren't enough buckets. Rather than immediately creating trees, **increasing the number of buckets** spreads the entries out. So *small table + collisions → resize first* is generally more efficient.

### Untreeification

A tree bin doesn't necessarily remain a tree forever. If entries are removed and the number falls sufficiently, HashMap can convert the tree back into a linked structure.

```java
UNTREEIFY_THRESHOLD = 6
```

```flow-h The exact transition logic includes implementation details beyond simply comparing one number
Many collisions
Tree
Entries removed
Small enough
Linked structure
```

## Load Factor, Capacity and Threshold

### Load Factor

Default load factor: **`0.75f`**. Suppose capacity = 16, load factor = 0.75:

```text
Threshold = 16 × 0.75 = 12
```

When the number of entries reaches the resize threshold, HashMap expands.

### What Does Load Factor Mean?

Load factor controls the trade-off between **memory** and **collision frequency**.

| Load factor | Buckets | Collisions | Memory |
| --- | --- | --- | --- |
| Lower | More | Fewer | More |
| Higher | Fewer | Potentially more | Less |

The default 0.75 is a practical compromise.

### Capacity vs Size vs Threshold

These are often confused.

| Term | Meaning | Example |
| --- | --- | --- |
| Capacity | Number of buckets | 16 |
| Size | Number of mappings currently stored | 10 |
| Threshold | Approximate size at which resizing occurs: capacity × loadFactor | 12 |

## Resizing

### What Happens During Resize?

Suppose capacity = 16, threshold = 12, and HashMap needs to resize. The table becomes **16 → 32**. Generally, HashMap **doubles** its capacity, and the threshold is recalculated accordingly.

### Why Double the Capacity?

Doubling gives HashMap a convenient property. If the old capacity is 16 and the new capacity is 32, an existing entry generally either **stays at the same index** or **moves by +16**. This is determined by a particular hash bit, which makes resizing more efficient than recomputing arbitrary bucket positions from scratch.

### The Resize Bit Trick

Old capacity 16, new capacity 32 — the new bit being introduced is `16`. For each entry, conceptually:

```java
if ((hash & oldCapacity) == 0) {
    // same index
} else {
    // old index + old capacity
}
```

This is one reason power-of-two capacities are so useful.

### Does Rehashing Call hashCode() Again?

This is a subtle interview question. During resize, HashMap generally does **not** need to call the key's `hashCode()` again for every entry. The stored hash is already available in each node; it uses the old hash and the capacity bit to determine the new position.

> [!WARNING]
> Don't casually say *"Every resize calls hashCode() again for every key."* That's not how modern HashMap resizing works.

## The get() Journey

```java
map.get("Java");
```

```flow
get(key)
Calculate hash
Calculate bucket index
Check first node
hash matches? → equals()?
? Found? | Yes: return value | No: continue in bucket (tree search or node traversal)
```

If the bucket is a tree, HashMap searches the Red-Black Tree; if it's a linked structure, it traverses the nodes.

### Why Both hash and equals()?

If two keys have **different** hash codes, they cannot be the same logical key in a correctly implemented hash-based Map. So HashMap can first check the **hash** before calling **`equals()`**, which avoids unnecessary equality comparisons.

- Hash differs → not the key.
- Hash same → check `equals()`.

## The equals() / hashCode() Contract

This is one of the most important HashMap concepts. If `a.equals(b)` is `true`, then `a.hashCode() == b.hashCode()` **must** be true. The reverse isn't required: two different objects can have the same hash (`hashCode()` same, `equals()` false) — that's a collision.

### Wrong hashCode() Implementation

```java
class Employee {

    int id;

    @Override
    public boolean equals(Object o) {
        // ...
    }
}
```

If `hashCode()` isn't overridden consistently, two logically equal Employees may have different hashes, and HashMap can place them into different buckets. Result: `equals()` says *same*, HashMap lookup says *different*. This violates the required contract.

### Correct Implementation

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Employee other)) return false;
    return id == other.id;
}

@Override
public int hashCode() {
    return Integer.hashCode(id);
}
```

Now: same `id` → `equals()` true → same hash.

### Mutable Keys — Major Trap

```java
Map<Employee, String> map = new HashMap<>();

Employee e = new Employee(101);
map.put(e, "John");

e.setId(999);
```

If `id` participates in `hashCode()`: **old hash → bucket A** becomes **new hash → bucket B**, but the entry is physically still in its original bucket. Now `map.get(e)` **may fail**.

> [!WARNING]
> Don't mutate fields that participate in `equals()` / `hashCode()` while an object is being used as a HashMap key.

## Thread Safety and Iteration

### Why HashMap Isn't Thread-Safe

Two threads calling `put()` at the same time may both modify internal state concurrently. Without appropriate synchronization, operations can interfere with each other, and visibility/ordering guarantees aren't provided. Therefore `HashMap` is **not** a concurrent Map. For concurrent access, **`ConcurrentHashMap`** is usually the appropriate choice.

### HashMap vs ConcurrentHashMap

| Feature | HashMap | ConcurrentHashMap |
| --- | --- | --- |
| Thread-safe | ❌ No | ✅ Yes |
| Null key | ✅ One | ❌ No |
| Null values | ✅ Yes | ❌ No |
| Concurrent operations | ❌ No | ✅ Yes |
| General use | Yes | Concurrent applications |

We'll deep-dive into ConcurrentHashMap later.

### Fail-Fast Iterator

HashMap iterators are generally **fail-fast**.

```java
for (Integer key : map.keySet()) {
    if (key == 10) {
        map.remove(key);
    }
}
```

```output
ConcurrentModificationException
```

because the Map was structurally modified outside the iterator.

### Correct Iterator Removal

```java
Iterator<Integer> iterator = map.keySet().iterator();

while (iterator.hasNext()) {
    Integer key = iterator.next();
    if (key == 10) {
        iterator.remove();
    }
}
```

The iterator knows about its own removal operation.

> [!IMPORTANT]
> **Fail-fast is not thread safety.** Its purpose is to detect some structural modifications during iteration. It is a best-effort bug-detection mechanism, not a synchronization mechanism.

### HashMap Doesn't Guarantee Ordering

```java
Map<Integer, String> map = new HashMap<>();

map.put(3, "C");
map.put(1, "A");
map.put(2, "B");
```

You cannot write code assuming the iteration will be `3, 1, 2` or `1, 2, 3`. Neither ordering should be relied upon. For insertion order use **`LinkedHashMap`**; for sorted keys use **`TreeMap`**.

## Null Handling

HashMap permits **one null key** and **multiple null values**.

```java
map.put(null, "A");
map.put(null, "B");
```

Result: `null → B`. Only one null key exists because keys are unique.

### Why Does HashMap Allow Null but ConcurrentHashMap Doesn't?

HashMap can represent `key → null` without needing concurrent atomic semantics. `ConcurrentHashMap` deliberately disallows null because concurrent operations need a clear distinction between **key absent** and **key mapped to null**. This simplifies its concurrent API semantics.

## Constructors and Capacity

### Constructors

```java
new HashMap<>();
new HashMap<>(32);
new HashMap<>(32, 0.75f);
```

Parameters: `initialCapacity` and `loadFactor`.

### Initial Capacity Is Not Allocated Immediately

Creating `new HashMap<>(100);` doesn't necessarily mean an array of 100 buckets is immediately allocated. HashMap table allocation is **lazy** and occurs when needed, such as during the first insertion. Requested capacities are also **normalized** to HashMap's power-of-two sizing rules.

### Default Capacity

The commonly documented default initial capacity is **16** with load factor **0.75**. Remember that the internal table is lazily allocated, so the backing array isn't necessarily created at constructor invocation.

### Initial Capacity and Performance

If you know approximately how many entries will be stored, providing an appropriate initial capacity can reduce repeated resizing:

```java
Map<Integer, Employee> map = new HashMap<>(1000);
```

But don't blindly over-allocate — more buckets mean more memory.

## HashMap's Core Formulas

This deserves memorization.

| Concept | Formula / constant |
| --- | --- |
| Hash spreading | `h ^ (h >>> 16)` |
| Bucket index | `(n - 1) & hash` |
| Resize threshold | `capacity × loadFactor` |
| Default load factor | `0.75` |
| Treeification | `TREEIFY_THRESHOLD = 8` |
| Minimum treeify capacity | `MIN_TREEIFY_CAPACITY = 64` |
| Untreeification threshold | `UNTREEIFY_THRESHOLD = 6` |

> [!NOTE]
> These are implementation constants in current OpenJDK-style HashMap implementations, not universal guarantees of every Java implementation/version.

### Complete put() Mental Model

```flow
put(key, value)
hash(key) → spread hash bits
bucket = hash & (n-1)
table[bucket]
? Empty or occupied? | Empty: insert | Occupied: compare keys
---
Compare keys
? Same key? | Yes: replace value | No: add to collision chain (list or tree)
: afterwards
size > threshold? → resize
```

### Complete get() Mental Model

```flow
get(key)
calculate hash
calculate bucket
table[index]
check candidate: hash + equals()
? Found? | Yes: return value | No: return null
```

## Performance in Practice

### Why HashMap Is Fast

HashMap avoids searching every entry:

```flow-h With a good hash distribution: O(1) average
Key
Hash
Bucket
Small number of candidates
Equality check
```

That's the fundamental reason HashMap is so widely used.

### Poor Hash Distribution

Suppose every key returns:

```java
@Override
public int hashCode() {
    return 1;
}
```

Then A, B, C, D … all go to **bucket X**. Everything goes into one bucket and HashMap loses much of its expected performance advantage. With modern treeification, sufficiently large collision bins can become trees, but a pathological hash function is still a poor design.

### Same Hash ≠ Same Key

A classic interview question: `A.hashCode() = 100` and `B.hashCode() = 100` — does HashMap treat A and B as the same key? **No.** It checks **hash + `equals()`**. If `A.equals(B) == false`, both entries can coexist.

### HashMap and Object Identity

HashMap normally uses **logical equality** (`equals()`), not reference identity (`==`). Therefore two `new String("Java")` objects represent the same logical key if `equals()` returns true and their hashes agree. For identity-based key semantics, Java provides **`IdentityHashMap`**.

### Why containsKey() Is Better Than get() != null

```java
map.put("A", null);
```

Then `map.get("A") == null` is true — but the key exists. Therefore `map.containsKey("A")` is the correct test when you specifically want to know whether the key exists.

### putIfAbsent() vs put()

| Method | Behaviour |
| --- | --- |
| `map.put("A", 10)` | Insert or replace — always updates the mapping |
| `map.putIfAbsent("A", 20)` | Insert only when absent — doesn't overwrite an existing mapping |

### Memory Model

HashMap has memory overhead from the **table array + Node objects + references + hash values**. Compared with a simple array, it's substantially more memory-intensive — but that trade-off buys fast key-based lookup.

### HashMap vs ArrayList Lookup

To find the Employee with ID 5000:

- **ArrayList** → iterate through elements → potentially **O(n)**
- **HashMap** → employeeId → hash → bucket → employee → **O(1)** average

```java
Map<Long, Employee> employees = new HashMap<>();

Employee employee = employees.get(10025L);
```

This is much more appropriate than repeatedly scanning a List when lookup by ID is the primary operation.

## Java 7 vs Java 8+ HashMap

This is a common senior-level interview topic.

- **Older Java (Java 7-era):** collision buckets were linked structures. Heavy collisions could lead to poor worst-case lookup behaviour.
- **Java 8+:** HashMap introduced **treeification** of sufficiently large collision bins.

```flow
Java 7-era
bucket → linked list
---
Java 8+
bucket → linked list
: sufficiently crowded
Red-Black Tree
```

This significantly improves pathological collision behaviour (a bucket chain of `A → … → H` drops from O(n) to O(log n) search).

### Does HashMap Always Use Red-Black Trees?

**No.** Only sufficiently crowded bins can become tree bins. Most normal buckets are either empty, a single node, or a small linked structure. Tree bins are for unusually collision-heavy situations.

## Interview Scenarios

### Two different keys have the same hash code. What happens?

**Strong answer:** They can land in the same bucket. HashMap then distinguishes them using key equality. The bucket may use a linked structure, and if collisions become sufficiently large and the table is large enough, the bin can be treeified into a Red-Black Tree.

### If two keys have the same hash code, are they considered duplicates?

No. A hash collision only means they map to the same bucket. HashMap still uses equality to determine whether they represent the same key.

### Why shouldn't you use a mutable object as a HashMap key?

If fields used by `equals()` or `hashCode()` change after insertion, the key's calculated bucket can change while the entry remains in its original location, making lookup or removal unreliable.

### Why is the default load factor 0.75?

It is a practical balance between memory usage and collision frequency. Lower values use more memory but generally reduce collisions; higher values save memory but can increase collisions.

### Why does HashMap use power-of-two capacities?

Because bucket selection can efficiently use `(n - 1) & hash`, and resizing by doubling gives an efficient redistribution rule where entries generally stay at the same index or move by the old capacity.

### Why doesn't HashMap immediately treeify a bucket when collisions begin?

Because small collision chains are cheap, and when the overall table is small, resizing can distribute entries more effectively. HashMap therefore uses a minimum capacity threshold before treeification.

### Can multiple threads safely modify a HashMap?

Not without external synchronization or another concurrency mechanism. HashMap itself is not thread-safe. For concurrent access, `ConcurrentHashMap` is usually the appropriate implementation.

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

The second `put()` replaces the value for the same logical key.

### Collision with different keys

```java
class Key {

    int id;

    @Override
    public int hashCode() {
        return 1;
    }

    @Override
    public boolean equals(Object obj) {
        Key other = (Key) obj;
        return id == other.id;
    }
}
```

```java
map.put(new Key(1), "A");
map.put(new Key(2), "B");
```

**Can both entries exist? Yes.** Both have `hashCode = 1`, but `Key(1).equals(Key(2)) == false`, so they are different keys.

### Mutable key

```java
Employee e = new Employee(101);

map.put(e, "John");

e.setId(999);

System.out.println(map.get(e));
```

Don't assume this will return `"John"`. If `id` determines `hashCode()`, changing it after insertion can make the lookup fail.

### Null key

```java
Map<String, String> map = new HashMap<>();

map.put(null, "A");
map.put(null, "B");

System.out.println(map.size());
System.out.println(map.get(null));
```

```output
1
B
```

One null key; the second insertion replaces its value.

## HashMap Interview Cheat Sheet

Memorize this:

| Topic | Answer |
| --- | --- |
| Structure | Hash table |
| Key → | hash |
| Hash spreading | `h ^ (h >>> 16)` |
| Bucket | `(n - 1) & hash` |
| Collision | Linked structure; tree bin when appropriate |
| Default load factor | 0.75 |
| Treeify threshold | 8 |
| Minimum treeify capacity | 64 |
| Untreeify threshold | 6 |
| Resize | Roughly doubles capacity |
| Average lookup | O(1) |
| Thread-safe | No |

### The Most Important HashMap Formula

If the interviewer asks *"How does HashMap find the bucket?"*:

```java
int hash = key.hashCode();
hash = hash ^ (hash >>> 16);

int index = (n - 1) & hash;
```

Conceptually, that's the important flow. Don't overstate it as literally the complete implementation for every Java version.

### HashMap vs LinkedHashMap vs TreeMap (implementation view)

| Map | Structure | Complexity | Ordering |
| --- | --- | --- | --- |
| HashMap | Hash table | O(1) average | No guarantee |
| LinkedHashMap | Hash table + linked ordering structure | O(1) average | Predictable iteration order |
| TreeMap | Red-Black Tree | O(log n) | Sorted keys |

### Final Decision Framework

| Need | Choose |
| --- | --- |
| Fast lookup | `HashMap` |
| Insertion order | `LinkedHashMap` |
| Sorted keys | `TreeMap` |
| Concurrent key-value access | `ConcurrentHashMap` |
| Enum keys | `EnumMap` |
| Identity comparison | `IdentityHashMap` |
| Weak key references | `WeakHashMap` |

### Final Mental Model

```flow That sequence is the heart of HashMap
Key
hashCode()
spread hash
bucket in table[]
? Collision? | No: single Node | Yes: Node → Node → Node (tree if enough collisions)
: lookup
hash comparison → equals() → value
```

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| Internal structure | Hash table |
| Storage | Array of buckets |
| Entry | `Node<K,V>` |
| Hash spreading | `h ^ (h >>> 16)` |
| Bucket index | `(n - 1) & hash` |
| Default capacity | 16 |
| Default load factor | 0.75 |
| Threshold | capacity × load factor |
| Collision | Multiple keys in same bucket |
| Collision structure | Linked nodes / tree bins |
| Treeify threshold | 8 |
| Minimum treeify capacity | 64 |
| Untreeify threshold | 6 |
| Resize | Capacity generally doubles |
| Average get() / put() | O(1) |
| Tree-bin lookup | O(log n) |
| Null key | One allowed |
| Null values | Allowed |
| Ordering | No guarantee |
| Thread-safe | No |
| Iterator | Generally fail-fast |

### Senior-Level Interview Checklist

- HashMap internal architecture
- What `Node<K,V>` contains
- `hashCode()` → hash spreading → bucket index
- Why `(n - 1) & hash` is used
- Why capacity is a power of two
- What a hash collision is
- Why same hash doesn't mean same key
- Role of `equals()` and the `equals()`/`hashCode()` contract
- HashMap `put()` and `get()` flows
- Load factor, threshold and resizing
- Why capacity doubles and what happens to entries during resize
- Treeification: `TREEIFY_THRESHOLD`, `MIN_TREEIFY_CAPACITY`, `UNTREEIFY_THRESHOLD`
- Why HashMap isn't thread-safe
- Fail-fast iterators
- Mutable-key problem
- Java 7 vs Java 8+ collision handling
- HashMap vs LinkedHashMap / TreeMap / ConcurrentHashMap
