---
title: LinkedHashSet
subtitle: HashSet plus predictable insertion-order iteration — the LinkedHashMap underneath, before/after links and memory trade-offs.
order: 9
---

## Introduction

`LinkedHashSet` is essentially a **HashSet + predictable insertion-order iteration**. Since the HashSet chapter already covered hashing, collisions, `equals()`, `hashCode()`, load factor and resizing, we'll focus here on what is new.

## What is LinkedHashSet?

`LinkedHashSet` is a `Set` implementation that:

- Does not allow duplicates
- Maintains insertion order
- Allows one null
- Provides average O(1) `add()`, `remove()` and `contains()`
- Is not thread-safe

Package:

```java
java.util.LinkedHashSet
```

Declaration:

```java
public class LinkedHashSet<E>
        extends HashSet<E>
        implements Set<E>, Cloneable, Serializable
```

## The Key Difference

The easiest way to remember it:

| Set | Gives you |
| --- | --- |
| `HashSet` | Uniqueness + Hashing |
| `LinkedHashSet` | Uniqueness + Hashing + **Insertion Order** |

```java
Set<String> set = new LinkedHashSet<>();

set.add("Java");
set.add("Python");
set.add("Spring");
set.add("Java");
```

```output
Java
Python
Spring
```

The duplicate `"Java"` is ignored, but its **original position is retained**.

## How Does LinkedHashSet Preserve Order?

This is the main interview question. `LinkedHashSet` uses a **`LinkedHashMap`** internally.

```flow
LinkedHashSet
LinkedHashMap
HashMap + Doubly linked list
```

- The **hash table** provides efficient lookup.
- The **linked list** maintains insertion order.

### Internal Architecture

```flow
HashSet
HashMap
Buckets
---
LinkedHashSet
LinkedHashMap
Hash table + linked list
```

So each entry participates in **two structures**: the hash table structure **and** a doubly linked list.

### Simplified Internal Representation

```java
set.add("A");
set.add("B");
set.add("C");
```

```buckets Hash table: "Where is this element?"
1: B
3: A
6: C
```

```flow-h Linked list: "What is the iteration order?"
A
<->
B
<->
C
```

### before and after References

This is an important internal detail. `LinkedHashMap` entries maintain links conceptually like:

```flow-h One entry
before
key
after
```

```flow-h Iteration follows the chain from head to tail instead of scanning the hash table
null
A | head
<->
B
<->
C | tail
null
```

### Why Can't HashSet Simply Preserve Order?

`HashSet`'s iteration order is determined by its hash-table structure. If elements are placed into different buckets (`A → Bucket 5`, `B → Bucket 1`, `C → Bucket 7`), there is no separate structure remembering `A → B → C`. `LinkedHashSet` adds that structure.

## What Happens During add()?

```java
set.add("Java");
```

```flow
add("Java")
Hashing
Find bucket
? Duplicate? | Yes: Reject | No: Insert + link into list
```

So a successful insertion:

1. Places the entry in the hash table.
2. Links the entry into the insertion-order chain.

### What Happens with a Duplicate?

```java
set.add("Java");
set.add("Java");
```

First: `Java` → inserted. Second: `Java` → already exists → rejected. **No second linked-list node is created.** Therefore the order is `Java → Python → Spring`, not `Java → Python → Spring → Java`.

### Does remove() Preserve the Remaining Order?

**Yes.** Suppose `A → B → C → D` and you remove `B`. The links are adjusted to `A → C → D`, so iteration produces `A, C, D`. The relative order of the remaining elements is preserved.

### Re-Adding an Existing Element

Important interview trap:

```java
Set<String> set = new LinkedHashSet<>();

set.add("A");
set.add("B");
set.add("C");
set.add("A");
```

```output
[A, B, C]
```

It does **not** move `A` to the end. **Why?** Because the second `add("A")` is a duplicate and does not create a new insertion.

## LinkedHashSet vs HashSet

| Feature | HashSet | LinkedHashSet |
| --- | --- | --- |
| Duplicates | No | No |
| Ordering | No guarantee | Insertion order |
| Average add() | O(1) | O(1) |
| Average contains() | O(1) | O(1) |
| Average remove() | O(1) | O(1) |
| Memory | Lower | Higher |
| Internal backing | HashMap | LinkedHashMap |

The key trade-off: **more memory + slightly more bookkeeping → predictable iteration order**.

## LinkedHashSet vs TreeSet

Don't confuse these: `LinkedHashSet` keeps **insertion** order, `TreeSet` keeps **sorted** order.

Example input `40, 10, 30, 20`:

- `LinkedHashSet` → `40, 10, 30, 20`
- `TreeSet` → `10, 20, 30, 40`

| Feature | LinkedHashSet | TreeSet |
| --- | --- | --- |
| Ordering | Insertion order | Sorted order |
| Typical complexity | O(1) average | O(log n) |
| Internal structure | Hash table + linked list | Red-Black Tree |
| Duplicates | No | No |
| Null | One null allowed | Generally no null |
| Range operations | No | Yes |

Choose based on the required ordering semantics.

## Null Handling

`LinkedHashSet` allows **one** `null`.

```java
Set<String> set = new LinkedHashSet<>();

set.add(null);
set.add(null);
set.add("Java");
```

```output
null
Java
```

Only one `null` exists because duplicates aren't allowed.

## Performance and Memory

| Operation | Complexity |
| --- | --- |
| add() | O(1) average |
| contains() | O(1) average |
| remove() | O(1) average |
| Iteration | O(n) |

> [!NOTE]
> `LinkedHashSet` iteration is based on the linked insertion-order chain, whereas `HashSet` iteration traverses the hash-table structure.

### Why Can LinkedHashSet Iteration Be Better Than HashSet?

Suppose **Size = 100** but **Capacity = 1,000,000**. `HashSet` iteration can involve scanning the underlying table structure. `LinkedHashSet` maintains a linked chain containing only actual entries.

So `LinkedHashSet` iteration is proportional to the **number of elements** rather than the hash-table capacity. This is an important performance detail.

### Memory Overhead

`LinkedHashSet` requires additional links to maintain order. Conceptually, each entry needs:

- Hash information
- Key
- Value / dummy value
- Next link
- Previous link

Therefore `LinkedHashSet` > `HashSet` in memory usage. The exact footprint depends on the JVM implementation and object layout.

## When to Use LinkedHashSet

Use it when you need **unique elements + original insertion order**.

### Remove duplicates while preserving order

```java
List<String> names = Arrays.asList("A", "B", "A", "C", "B");

Set<String> unique = new LinkedHashSet<>(names);
```

```output
[A, B, C]
```

### API response

Suppose an API must return unique values while preserving the order in which they were encountered:

```java
Set<String> result = new LinkedHashSet<>();
```

### Ordered permissions

```java
Set<String> permissions = new LinkedHashSet<>();
```

Useful when permissions must be unique but displayed in configuration order.

### When NOT to use LinkedHashSet

| You need | Use instead |
| --- | --- |
| No ordering | `HashSet` |
| Sorted order | `TreeSet` |
| Duplicates | `List` |
| Index-based access | `ArrayList` |

## Thread Safety and Fail-Fast Behaviour

### Is LinkedHashSet Thread-Safe?

**No.** Just like `HashSet`, `LinkedHashSet` is not synchronized. For synchronized access:

```java
Set<String> set = Collections.synchronizedSet(new LinkedHashSet<>());
```

For concurrent workloads, choose a collection designed for the required concurrency semantics rather than automatically wrapping everything.

### Fail-Fast Behaviour

Its iterator is generally fail-fast:

```java
for (String value : set) {
    if (value.equals("B")) {
        set.remove(value);
    }
}
```

```output
ConcurrentModificationException
```

Use the iterator's own `remove()` when removing during iteration:

```java
Iterator<String> iterator = set.iterator();

while (iterator.hasNext()) {
    String value = iterator.next();
    if (value.equals("B")) {
        iterator.remove();
    }
}
```

As discussed earlier, fail-fast behaviour is best effort, not a synchronization mechanism.

## LinkedHashSet Does NOT Mean Sorted

This is one of the easiest interview traps. Input `50, 10, 30, 20` → `LinkedHashSet` gives `50, 10, 30, 20`. It preserves insertion order; it does **not** sort. If you need `10, 20, 30, 50`, use `TreeSet`.

## Interview Scenarios

### Millions of product IDs from a stream

You need to remove duplicates, preserve the first-seen order, and iterate over the result later. Which collection?

**Answer:** `LinkedHashSet<Long>` — uniqueness + insertion-order iteration.

### A, B, C, A, D, B → A, B, C, D

```java
Set<String> unique = new LinkedHashSet<>(values);
```

**Why not HashSet?** Because `HashSet` does not guarantee the original order.

### Why choose LinkedHashSet if HashSet also has O(1) lookup?

Because the requirement is not just lookup. You also need **predictable insertion-order iteration**. The additional linked-list bookkeeping provides that guarantee.

## Frequently Asked Interview Questions

### Q1. How does LinkedHashSet maintain insertion order?

Through its underlying `LinkedHashMap`, which maintains a doubly linked list connecting entries in insertion order.

### Q2. Does LinkedHashSet use HashMap internally?

More precisely, `LinkedHashSet` is implemented using `LinkedHashMap`-based infrastructure.

### Q3. Does LinkedHashSet allow duplicates?

No.

### Q4. Does LinkedHashSet allow null?

Yes, one `null`.

### Q5. Does LinkedHashSet sort elements?

No. It maintains insertion order.

### Q6. What is the difference between HashSet and LinkedHashSet?

The primary difference is ordering: `HashSet` has no ordering guarantee; `LinkedHashSet` iterates in insertion order. `LinkedHashSet` also has additional memory/bookkeeping overhead.

### Q7. What happens if an existing element is added again?

The insertion is rejected and the element retains its original position.

### Q8. Is LinkedHashSet thread-safe?

No.

### Q9. What is the average complexity of contains()?

O(1).

### Q10. Why does LinkedHashSet consume more memory than HashSet?

Because entries maintain additional links needed to preserve insertion order.

## Decision Table

| Requirement | Choose |
| --- | --- |
| Unique + fast lookup | `HashSet` |
| Unique + insertion order | `LinkedHashSet` |
| Unique + sorted order | `TreeSet` |
| Duplicates + index access | `ArrayList` |
| Queue / Deque | `ArrayDeque` |

### Final Mental Model

```tree That's the key idea
LinkedHashSet
  LinkedHashMap
    Hash Table | fast lookup
    Linked List | insertion order
```

`HashSet` answers *"Is this element present?"* `LinkedHashSet` answers *"Is this element present, and in what insertion order should I iterate?"*

## Chapter Summary

| Concept | LinkedHashSet |
| --- | --- |
| Interface | Set |
| Duplicates | Not allowed |
| Null | One allowed |
| Ordering | Insertion order |
| Sorting | No |
| Average add() | O(1) |
| Average contains() | O(1) |
| Average remove() | O(1) |
| Iteration | O(n) |
| Thread-safe | No |
| Internal infrastructure | LinkedHashMap |
| Extra structure | Doubly linked ordering chain |
| Memory | Higher than HashSet |
| Best use | Unique + insertion-order iteration |

### Interview Readiness Checklist

- How does LinkedHashSet preserve insertion order?
- HashSet vs LinkedHashSet?
- LinkedHashSet vs TreeSet?
- Why does LinkedHashSet use more memory?
- What happens when an existing element is added again?
- Does LinkedHashSet sort elements?
- Can LinkedHashSet contain null?
- Is LinkedHashSet thread-safe?
- Why is lookup still O(1) average?
- How would you remove duplicates while preserving order?
