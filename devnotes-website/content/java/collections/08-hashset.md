---
title: HashSet
subtitle: HashSet's complete internal working — the backing HashMap, buckets, collisions, load factor, resizing and treeification.
order: 8
---

## Introduction

`HashSet` is one of the most commonly asked Collection classes in Java interviews. If you understand `HashSet` properly, you will already understand a large part of:

- Hashing
- `hashCode()` and `equals()`
- Hash collisions and buckets
- Load factor and resizing
- Treeification
- `HashMap` internals

And that's why interviewers love it.

## What is HashSet?

`HashSet` is a `Set` implementation that stores **unique elements using hashing**.

Package:

```java
java.util.HashSet
```

Declaration:

```java
public class HashSet<E>
        extends AbstractSet<E>
        implements Set<E>,
                   Cloneable,
                   Serializable
```

Characteristics:

- No duplicate elements
- Allows one null
- No guaranteed ordering
- Average O(1) insertion, deletion and lookup
- Not synchronized
- Backed internally by a `HashMap`

## HashSet Internally Uses HashMap

> [!IMPORTANT]
> **HashSet internally uses HashMap.** This is the first thing you should remember.

```flow-h
HashSet
HashMap
Hash Table
Buckets
```

You don't need to understand `HashSet` separately from `HashMap`. Once you understand `HashMap` internals, `HashSet` becomes very easy.

### How Does HashSet Store an Element?

```java
Set<String> set = new HashSet<>();
set.add("Java");
```

Internally, `HashSet` effectively does something similar to:

```java
map.put("Java", PRESENT);
```

where:

```java
private static final Object PRESENT = new Object();
```

| Internal HashMap key | Value |
| --- | --- |
| `"Java"` | `PRESENT` |

The actual element becomes the **key** of the internal `HashMap`. The value is simply a **dummy object**.

### Why Does HashSet Use HashMap?

Because `HashMap` already provides hashing, buckets, collision handling, resizing, `hashCode()`/`equals()` usage and treeification. There is no need to implement all of this again. `HashSet` simply uses the `HashMap` infrastructure to enforce uniqueness.

### Simplified HashSet Source Code

```java
public class HashSet<E> {

    private transient HashMap<E, Object> map;

    private static final Object PRESENT = new Object();

    public boolean add(E e) {
        return map.put(e, PRESENT) == null;
    }
}
```

> [!TIP]
> This is an extremely important piece of code for interviews.

## What Happens When We Call add()?

```java
Set<String> set = new HashSet<>();
set.add("Java");
```

```flow
set.add("Java")
map.put("Java", PRESENT)
hash("Java")
calculate bucket
check bucket
insert Java
```

### Hashing Process

Java obtains `"Java".hashCode()`, then `HashMap` applies its internal **hash-spreading** function.

```flow-h The exact HashMap implementation details vary by JDK, but the core idea remains the same
Object
hashCode()
hash spreading
bucket index
store element
```

## Buckets and Index Calculation

### What is a Bucket?

A bucket is a location in the internal hash table where entries can be stored. An element's hash determines which bucket it belongs to.

```buckets "Java" → hash → bucket 3
0:
1:
2:
3: Java
4:
5:
6:
7:
```

### Bucket Index Calculation

A common simplified explanation is:

```java
index = hash & (n - 1);
```

where `n` = table length. For example, with table length `16`: `index = hash & 15`. This works efficiently because `HashMap` capacities are maintained as **powers of two**.

### Why Power of 2?

**Interview favourite.** `HashMap` uses table capacities that are powers of two — `16, 32, 64, 128, 256, …`. This allows bucket calculation using `hash & (n - 1)` instead of the more expensive `hash % n`. It also works particularly well with the resize algorithm.

## Hash Collisions

### What If Two Objects Go to the Same Bucket?

This is called a **hash collision**.

```buckets Both objects ended up in the same bucket. This is completely normal
4:
5: Object A, Object B
6:
```

A good hash function reduces collisions, but cannot eliminate them.

### Collision Handling

Modern `HashMap` handles collisions using a **linked list** or a **Red-Black tree**, depending on the number of entries in a bucket.

```flow-h Bucket 5 as a linked chain
A
B
C
```

```tree If the bucket becomes sufficiently crowded, it can be transformed into a tree
A
  B
  C
```

This process is called **treeification**. We'll study the exact thresholds below and in the HashMap chapter.

## How Does HashSet Prevent Duplicates?

This is the **most important** HashSet interview question.

```java
Set<String> set = new HashSet<>();

set.add("Java");
set.add("Java");
```

```flow
First add("Java")
hashCode()
bucket
No matching key
Insert | returns true
---
Second add("Java")
hashCode()
same bucket
equals() → equal
Duplicate — do not insert | returns false
```

### hashCode() and equals()

**Interview favourite.** Hash-based collections use **`hashCode()` + `equals()`**. Both are important.

```flow
New element
hashCode()
Find bucket
Compare candidates with equals()
? Duplicate? | Yes: Reject | No: Insert
```

### Why Do We Need Both?

Suppose we only used `equals()`. We would potentially have to compare the new object with **every** object in the Set — **O(n)** for every insertion.

Hashing first **narrows the search to a particular bucket**. Then `equals()` performs the final equality check among candidates. This gives `HashSet` its excellent average performance.

### The hashCode() Contract

If two objects are equal (`a.equals(b) == true`), then they must have the same hash code (`a.hashCode() == b.hashCode()`).

But the **reverse is NOT required**. Two different objects can have the same hash code — that is a collision.

### Same Hash Code Does NOT Mean Equal

```flow-h
Same hashCode()
Collision
equals()
Could be false
```

Object A with `hashCode = 100` and Object B with `hashCode = 100` can still be different objects. Therefore:

- Same hashCode **⇏** same object
- `equals() == true` **⇒** same hashCode

## Custom Objects in HashSet

```java
class Employee {
    int id;
    String name;

    Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }
}
```

Now:

```java
Set<Employee> employees = new HashSet<>();

employees.add(new Employee(101, "John"));
employees.add(new Employee(101, "John"));
```

Many beginners expect **1 employee**. But without overriding `equals()` and `hashCode()`, **2 employees** can be stored. Why? Because `Object`'s default equality is based on **object identity**.

### Correct Implementation

If `Employee` identity is based on `id`:

```java
class Employee {

    int id;
    String name;

    Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (!(obj instanceof Employee))
            return false;
        Employee other = (Employee) obj;
        return id == other.id;
    }

    @Override
    public int hashCode() {
        return Integer.hashCode(id);
    }
}
```

Now only **one logical Employee** is stored.

### Why Must hashCode() Be Overridden Too?

Suppose you override only `equals()` but not `hashCode()`. Two logically equal objects may produce different hash codes, so they may go into different buckets. `HashSet` may never compare them with `equals()`. **Result: a duplicate can be stored.**

> [!IMPORTANT]
> Whenever you override `equals()`, you should normally override `hashCode()` consistently.

## Mutable Keys — Dangerous!

This is an advanced interview question.

```java
class Employee {

    int id;

    @Override
    public int hashCode() {
        return Integer.hashCode(id);
    }

    @Override
    public boolean equals(Object obj) {
        // ...
    }
}
```

```java
Employee e = new Employee(101);
Set<Employee> set = new HashSet<>();
set.add(e);

e.id = 200;   // mutate a field used by hashCode()
```

Now the object's hash code changes, but the object is still physically located in the bucket determined by the **old** hash. Therefore `set.contains(e)` may return **`false`** even though the object is physically inside the Set.

### Why?

```flow
Before mutation
id = 101
hash = H1
Bucket 5 | object stored here
---
After mutation
id = 200
hash = H2
Bucket 11 | HashSet searches here, finds nothing
```

This is why objects used in hash-based collections should ideally have **stable equality/hash-code fields while stored**.

## Null and Ordering

### Null in HashSet

`HashSet` allows **one** `null`.

```java
Set<String> set = new HashSet<>();

set.add(null);
set.add(null);
```

```output
[null]
```

**Why only one?** Because `Set` does not allow duplicates — the second `null` is considered a duplicate.

### Ordering

`HashSet` does **not** guarantee insertion order.

```java
Set<Integer> set = new HashSet<>();

set.add(50);
set.add(10);
set.add(30);
set.add(20);
```

Do not assume the output will be `[50, 10, 30, 20]` — it may appear in a different order.

> [!WARNING]
> Do not rely on the current observed order even if it happens to look predictable.

## HashSet vs LinkedHashSet vs TreeSet

### HashSet vs LinkedHashSet

| Feature | HashSet | LinkedHashSet |
| --- | --- | --- |
| Duplicates | No | No |
| Insertion Order | No guarantee | Yes |
| Internal backing | HashMap | LinkedHashMap |
| Average add | O(1) | O(1) |
| Average contains | O(1) | O(1) |
| Memory | Lower | Higher |

Use `HashSet` when order doesn't matter; use `LinkedHashSet` when insertion order matters.

### HashSet vs TreeSet

| Feature | HashSet | TreeSet |
| --- | --- | --- |
| Ordering | No guarantee | Sorted |
| Internal Structure | HashMap | Red-Black Tree |
| Average add | O(1) | O(log n) |
| contains | O(1) average | O(log n) |
| Null | One null allowed | Generally not allowed |
| Range operations | No | Yes |

Use `HashSet` for **uniqueness + speed**; use `TreeSet` for **uniqueness + sorted order**.

## Capacity, Load Factor and Resizing

### Initial Capacity

```java
Set<Integer> set = new HashSet<>(100);
```

This creates a `HashSet` configured with an initial capacity of 100.

> [!NOTE]
> Initial capacity is related to the underlying `HashMap`'s table sizing behaviour; it does not necessarily mean a 100-element internal array is immediately allocated.

### Load Factor

**Interview favourite.** The default load factor of `HashMap` — and therefore of `HashSet` — is **0.75**. The load factor determines when the hash table should resize.

```text
Threshold = Capacity × Load Factor
```

Example: Capacity = 16, Load Factor = 0.75 → **Threshold = 12**. When the number of entries reaches the resizing threshold, the table is resized.

### Why 0.75?

It's a practical balance between **memory usage** and **hash collision rate**.

| Load factor | Effect |
| --- | --- |
| Higher | Less memory, more collisions |
| Lower | More memory, fewer collisions |

0.75 is a commonly effective trade-off.

### Resizing

As the table grows and the threshold is exceeded, `HashMap` expands the table:

```flow-h Entries are redistributed across the larger table
16
32
64
128
```

This operation is called **rehashing / resizing**. More precisely, modern `HashMap` implementations resize and redistribute entries; "rehashing" is commonly used in interview terminology.

### Why Does Resizing Cost More?

Existing entries may need to be redistributed, so resizing is more expensive than a normal insertion.

| Operation | Cost |
| --- | --- |
| Normal insertion | O(1) average |
| Resize | O(n) |

But resizing happens infrequently, so average insertion remains **O(1)**.

## Time Complexity and Treeification

### Time Complexity

| Operation | Average | Worst Case |
| --- | --- | --- |
| add() | O(1) | O(log n)* |
| remove() | O(1) | O(log n)* |
| contains() | O(1) | O(log n)* |
| size() | O(1) | O(1) |
| iteration | O(n) | O(n) |

\*For modern Java `HashMap` buckets that have been treeified. Under certain conditions and pathological/custom scenarios, exact behaviour can differ.

### Why O(log n) After Treeification?

Suppose a bucket contains many entries. As a linked list (`A → B → C → D → E → F`), search is **O(n)**. As a tree, search is **O(log n)**:

```tree Balanced tree inside one bucket
D
  B
    A
    C
  F
```

This protects `HashMap`/`HashSet` from pathological collision chains.

### Treeification

**Interview favourite.** When a bucket becomes sufficiently crowded, Java can convert the linked structure into a Red-Black Tree. Important thresholds in current `HashMap` implementations:

```java
TREEIFY_THRESHOLD = 8
UNTREEIFY_THRESHOLD = 6
MIN_TREEIFY_CAPACITY = 64
```

> [!IMPORTANT]
> Reaching 8 entries in a bucket does **not** automatically mean treeification. If the table is still smaller than 64, `HashMap` may **resize instead** of treeifying.

```flow
Bucket becomes highly crowded
Check table capacity
? Capacity < 64? | Yes: Resize | No: Treeify
```

### Why Doesn't Java Treeify Immediately?

Tree nodes consume more memory than ordinary linked-list nodes. If the entire table is still small, increasing the table size can reduce collisions more cheaply. Therefore Java uses resizing first in smaller tables.

## Thread Safety and Iteration

### HashSet is Not Thread-Safe

**Interview favourite.**

```java
Set<Integer> set = new HashSet<>();
```

This is **not** thread-safe. Multiple threads modifying it concurrently can lead to incorrect behaviour.

### Making HashSet Synchronized

```java
Set<Integer> set = Collections.synchronizedSet(new HashSet<>());
```

This wraps the `HashSet` with synchronized access.

### Concurrent Alternative

If you need a highly concurrent Set:

```java
Set<Integer> set = ConcurrentHashMap.newKeySet();
```

This is generally preferable to synchronizing an entire `HashSet` when you need scalable concurrent access. We'll study this in the ConcurrentHashMap chapter.

### Fail-Fast Iterator

`HashSet` iterators are generally **fail-fast**.

```java
Set<Integer> set = new HashSet<>();

set.add(10);
set.add(20);
set.add(30);

for (Integer i : set) {
    if (i == 20) {
        set.remove(i);
    }
}
```

```output
ConcurrentModificationException
```

because the Set was structurally modified outside the iterator.

### Correct Removal During Iteration

Use the `Iterator`:

```java
Iterator<Integer> itr = set.iterator();

while (itr.hasNext()) {
    Integer value = itr.next();
    if (value == 20) {
        itr.remove();
    }
}
```

### Is Fail-Fast Guaranteed?

Important interview nuance: **No.** Fail-fast behaviour is a **best-effort** mechanism. You should not build application logic that depends on `ConcurrentModificationException`.

## HashSet in Practice

### HashSet and Streams

```java
Set<Integer> numbers = new HashSet<>();

numbers.add(10);
numbers.add(20);
numbers.add(30);

numbers.stream()
       .filter(n -> n > 10)
       .forEach(System.out::println);
```

### Removing Duplicates from a List

One of the most common real-world uses of `HashSet`.

```java
List<Integer> numbers = Arrays.asList(10, 20, 10, 30, 20);

Set<Integer> unique = new HashSet<>(numbers);
```

```output
[10, 20, 30]
```

The resulting `HashSet` does not guarantee the original List's order. If order must be preserved:

```java
Set<Integer> unique = new LinkedHashSet<>(numbers);
```

### Real-World Use Cases

| Use case | Type | Notes |
| --- | --- | --- |
| Unique user IDs | `Set<Long> userIds;` | Prevents duplicate IDs |
| Unique permissions | `Set<String> permissions;` | `READ`, `WRITE`, `DELETE` |
| Unique tags | `Set<String> tags;` | |

### Duplicate Detection Pattern

```java
Set<Integer> seen = new HashSet<>();

for (Integer number : numbers) {
    if (!seen.add(number)) {
        System.out.println("Duplicate: " + number);
    }
}
```

This works because `add()` returns `true` for a new element and `false` for a duplicate. It gives **average O(n)** duplicate detection across the entire collection — much better than comparing every pair, which can become **O(n²)**.

### HashSet vs ArrayList for contains()

For `contains(500000)`:

| Collection | Complexity |
| --- | --- |
| `ArrayList` | O(n) |
| `HashSet` | O(1) average |

If you frequently need membership checks and ordering/indexing isn't required, `HashSet` is often the better choice.

### When Should You Use HashSet?

**Need uniqueness + fast lookup + order doesn't matter.** Examples: unique IDs, unique usernames, unique permissions, visited nodes, already processed records, duplicate detection.

### When Should You NOT Use HashSet?

| You need | Use instead |
| --- | --- |
| Duplicates | `List` |
| Insertion order | `LinkedHashSet` |
| Sorted order | `TreeSet` |
| Index-based access | `ArrayList` |

## The Most Important HashSet Flow

Memorize this — it is the foundation for understanding `HashMap`.

```flow
set.add(object)
hashCode()
Hash spreading
Bucket index
? Is bucket empty? | Yes: Insert | No: Compare candidates (hash + equals)
---
Compare candidates
hash + equals
? Duplicate? | Yes: Reject | No: Insert
```

### Interview Trap 1

> [!QUESTION] If two objects have the same hashCode(), will HashSet consider them duplicates?
> **No.** The same hash code only means a **possible collision**. HashSet still needs an equality comparison: same hashCode → same bucket → `equals()` → `true` means duplicate, `false` means different.

### Interview Trap 2

> [!QUESTION] If two objects have different hashCodes, can equals() return true?
> According to the `equals()` / `hashCode()` contract: **No.** If `a.equals(b) == true`, then `a.hashCode() == b.hashCode()` must also be true.

## HashSet Interview Questions

### Q1. How does HashSet work internally?

`HashSet` is backed by a `HashMap`. Elements are stored as keys, while a dummy object is used as the value.

### Q2. Why doesn't HashSet allow duplicates?

`HashSet` uses the underlying `HashMap`'s hashing and equality mechanism. If an equivalent key already exists, the new element is not inserted.

### Q3. What methods are used to detect duplicates?

`hashCode()` and `equals()`.

### Q4. Can two objects have the same hashCode?

Yes. That's called a hash collision.

### Q5. Can two equal objects have different hashCodes?

No. That violates the `equals()` / `hashCode()` contract.

### Q6. Can HashSet contain null?

Yes. It can contain one `null`.

### Q7. Is HashSet ordered?

No ordering guarantee.

### Q8. Is HashSet thread-safe?

No.

### Q9. Average complexity of HashSet.contains()?

O(1).

### Q10. What happens during a hash collision?

Multiple entries can occupy the same bucket. Modern `HashMap`-based implementations use linked structures and may treeify heavily populated buckets.

### Q11. What is load factor?

A threshold ratio that determines when the underlying hash table should resize. Default: **0.75**.

### Q12. What is the default initial capacity?

The underlying `HashMap` uses a default initial capacity of **16** when it first allocates its table, although a default-constructed `HashMap`/`HashSet` does not immediately allocate a 16-element table.

### Q13. What is treeification?

Converting a heavily populated collision bucket from a linked structure into a Red-Black Tree.

### Q14. Why doesn't HashSet guarantee order?

Because its iteration order depends on the underlying hash table structure, hash distribution, resizing, and implementation details.

### Q15. How do you preserve insertion order while maintaining uniqueness?

Use `LinkedHashSet`.

## Interview Scenarios

### Scenario 1 — 10 million customer IDs

You need to remove duplicates, frequently check whether an ID exists, and you don't care about ordering. Which collection?

**Answer:** `HashSet<Long>` — unique values + fast average lookup + no ordering requirement.

### Scenario 2 — Remove duplicates, keep order

You need to remove duplicates from a List but preserve the original insertion order.

```java
List<Integer> result = new ArrayList<>(new LinkedHashSet<>(numbers));
```

`LinkedHashSet` gives uniqueness + insertion order.

### Scenario 3 — The "lost" Employee

You added an `Employee` to a `HashSet`. Later you changed the Employee's ID. Now `contains(employee)` returns `false`. **Why?** Because the fields participating in `equals()` / `hashCode()` changed. The object's new hash code points to a different bucket from the one where it was originally stored.

## Golden Rules

1. `HashSet` → `HashMap` internally
2. Element → `HashMap` key
3. Duplicate detection → `hashCode()` + `equals()`
4. Average operations → O(1)
5. No ordering guarantee

### Final Mental Model

```flow Once this mental model is clear, HashMap internals become much easier
HashSet
HashMap
Hash Table
Buckets
hashCode() → Bucket Index
? Collision? | No: Insert | Yes: Compare with equals() — equal → reject, different → insert
```

## Chapter Summary

| Concept | HashSet |
| --- | --- |
| Interface | Set |
| Internal backing | HashMap |
| Duplicates | Not allowed |
| Null | One allowed |
| Ordering | No guarantee |
| add() | O(1) average |
| contains() | O(1) average |
| remove() | O(1) average |
| Thread-safe | No |
| Duplicate detection | `hashCode()` + `equals()` |
| Default load factor | 0.75 |
| Collision handling | Linked structure / Tree |
| Treeification | Yes, under appropriate conditions |
| Best use | Unique + fast lookup |

### Interview Readiness Checklist

Before moving ahead, you should be able to answer these without looking at notes:

- How does HashSet work internally?
- Why does HashSet use HashMap?
- How are duplicates detected?
- Why are both `hashCode()` and `equals()` required?
- What is a hash collision?
- Can different objects have the same hash code?
- Can equal objects have different hash codes?
- What is a bucket?
- What is load factor?
- What happens during resizing?
- What is treeification?
- Why is HashSet O(1) on average?
- Why isn't HashSet thread-safe?
- Why can a mutable object become "lost" inside HashSet?
- HashSet vs LinkedHashSet?
- HashSet vs TreeSet?
- How do you remove duplicates while preserving order?
