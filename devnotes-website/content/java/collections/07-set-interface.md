---
title: Set Interface
subtitle: Uniqueness without positions — how Sets detect duplicates, and choosing between HashSet, LinkedHashSet and TreeSet.
order: 7
---

## Introduction

The `Set` interface is one of the most frequently asked topics in Java interviews. Interviewers often ask questions like:

- Why doesn't Set allow duplicates?
- How does HashSet detect duplicates?
- Difference between Set and List?
- Why must we override `equals()` and `hashCode()`?
- Which Set implementation should you choose?

Mastering the `Set` interface is essential before learning `HashSet`, `LinkedHashSet` and `TreeSet`.

## What is Set?

A `Set` is a collection that **does not allow duplicate elements**.

Package:

```java
java.util.Set
```

Declaration:

```java
public interface Set<E> extends Collection<E>
```

```tree Unlike List, Set focuses on uniqueness, not position
Iterable
  Collection
    Set
      HashSet
      LinkedHashSet
      TreeSet
```

## Characteristics of Set

- ✅ No duplicate elements
- ✅ Stores unique objects
- ✅ Supports fast searching (implementation-dependent)
- ✅ Allows at most one null in most hash-based implementations
- ❌ No index-based access
- ❌ No positional methods like `get()`

## Real-World Analogy

Imagine a company's Employee ID system: `EMP101`, `EMP102`, `EMP103`, `EMP101`.

Can the same employee ID exist twice? **No.** Employee IDs must be unique. A `Set` works exactly like this.

## Mathematical Set Concept

Java's `Set` follows mathematics:

```text
A = {1, 2, 3, 4}
B = {3, 4, 5}
```

Duplicate values don't exist — `{1, 2, 2, 3}` becomes `{1, 2, 3}`.

## Why Doesn't Set Allow Duplicates?

**Interview favourite.**

```java
Set<Integer> set = new HashSet<>();
set.add(10);
set.add(20);
set.add(10);
System.out.println(set);
```

```output
[10, 20]
```

The second `10` is ignored. The exact order depends on the implementation.

## How Does Set Know an Object is a Duplicate?

This is one of the most important interview questions. Java uses two methods: `hashCode()` and `equals()`.

```flow We'll study this deeply in the HashSet chapter
New Object
hashCode()
Same hash?
equals()
? Duplicate? | Yes: Reject | No: Insert
```

### Duplicate Detection Example

```java
String s1 = new String("Java");
String s2 = new String("Java");
```

Although `s1 != s2`, their `equals()` returns `true`. Therefore `HashSet` stores only one element.

## Set vs List

**Interview favourite.**

| Feature | List | Set |
| --- | --- | --- |
| Duplicates | Allowed | Not allowed |
| Order | Maintains insertion order | Depends on implementation |
| Index | Yes | No |
| get(index) | Yes | No |
| add(index) | Yes | No |
| Unique Elements | No | Yes |

### Why No Index?

```java
HashSet<String> set = new HashSet<>();
```

Internally the elements (`Java`, `Spring`, `AWS`) have **no guaranteed ordering**. If there is no guaranteed order, there cannot be an index. Hence `set.get(0)` doesn't exist.

## Major Set Implementations

There are three major implementations. Each solves a different problem.

### HashSet

- Uses `HashMap` internally
- Fastest implementation
- No ordering guarantee
- Allows one null element

**Best for:** fast lookup, fast insertion, fast deletion.

### LinkedHashSet

- Preserves insertion order
- Uses `LinkedHashMap` internally
- Slightly slower than `HashSet`

Input `10, 30, 20` → output `10, 30, 20`. Order preserved.

### TreeSet

- Stores elements in sorted order
- Uses a Red-Black Tree internally
- Does not allow null elements (natural ordering)

Input `40, 10, 30, 20` → output `10, 20, 30, 40`. Automatically sorted.

## Ordering in Different Sets

**Interview favourite.** Inserting `30, 10, 50, 20`:

```flow
HashSet
30 · 10 · 50 · 20 | random-looking, not guaranteed
---
LinkedHashSet
30 · 10 · 50 · 20 | insertion order maintained
---
TreeSet
10 · 20 · 30 · 50 | sorted order
```

## Common Methods

Since `Set` extends `Collection`, it inherits all `Collection` methods.

| Method | Behaviour |
| --- | --- |
| `set.add("Java")` | Returns `true` if insertion succeeds; `false` for a duplicate *(interview favourite)* |
| `set.remove("Java")` | Returns boolean |
| `set.contains("Spring")` | Checks existence |
| `size()` | Number of unique elements |
| `isEmpty()` | `true` or `false` |
| `clear()` | Removes everything |
| `iterator()` | Traverses the Set |

```java
Iterator<String> itr = set.iterator();
while (itr.hasNext()) {
    System.out.println(itr.next());
}
```

## Null Handling

**Interview favourite.**

```java
set.add(null);
set.add(null);
```

| Implementation | Nulls |
| --- | --- |
| `HashSet` | Stores one null |
| `LinkedHashSet` | Stores one null |
| `TreeSet` | Generally not allowed, because comparisons are required for ordering |

## equals() and Set

```java
Set<Integer> s1 = Set.of(1, 2, 3);
Set<Integer> s2 = Set.of(3, 2, 1);
s1.equals(s2);
```

```output
true
```

**Why?** A Set compares **elements, not order** — unlike `List`. *(Interview favourite.)*

### hashCode() in Set

Contract: **equal sets → equal hash codes**. Order doesn't matter; only elements matter.

## Performance

| Implementation | add() | remove() | contains() |
| --- | --- | --- | --- |
| HashSet | O(1) average | O(1) average | O(1) average |
| LinkedHashSet | O(1) average | O(1) average | O(1) average |
| TreeSet | O(log n) | O(log n) | O(log n) |

## Choosing the Right Set

| Use | When |
| --- | --- |
| `HashSet` | Performance is most important; order doesn't matter |
| `LinkedHashSet` | Preserve insertion order + need uniqueness |
| `TreeSet` | Automatic sorting, range operations, ordered traversal |

## Common Mistakes

- Trying `set.get(0);` — not possible.
- Expecting `HashSet` to preserve insertion order. Wrong — use `LinkedHashSet`.
- Using mutable objects inside `HashSet` without properly overriding `equals()` and `hashCode()`. This can lead to incorrect behaviour, including objects becoming difficult to find after mutation.
- Expecting `TreeSet` to accept all objects. Elements must either implement `Comparable` or be inserted using a `Comparator`; otherwise a `ClassCastException` may occur.

## Real-World Use Cases

| Use case | Type |
| --- | --- |
| Unique email IDs | `Set<String> emails;` |
| Unique usernames | `Set<String> usernames;` |
| Unique roles | `Set<Role> roles;` |
| Distinct tags | `Set<String> tags;` |

Removing duplicate values:

```java
List<String> names = Arrays.asList("A", "B", "A", "C");

Set<String> unique = new HashSet<>(names);
```

## Frequently Asked Interview Questions

### Q1. Difference between List and Set?

- `List` allows duplicates.
- `Set` stores only unique elements.

### Q2. How does Set detect duplicates?

Using both `hashCode()` and `equals()`.

### Q3. Why doesn't Set have get(index)?

Because a Set has no concept of positional indexing.

### Q4. Which Set maintains insertion order?

`LinkedHashSet`.

### Q5. Which Set automatically sorts elements?

`TreeSet`.

### Q6. Which Set provides the best average performance?

`HashSet`.

### Q7. Can Set contain null?

- `HashSet` → Yes (one null)
- `LinkedHashSet` → Yes (one null)
- `TreeSet` → Generally no (natural ordering)

### Q8. Why is overriding equals() and hashCode() important?

Because hash-based collections rely on them to determine object equality and detect duplicates correctly.

### Q9. Are two Sets equal if their insertion order differs?

Yes. If they contain the same elements, they are equal regardless of order.

### Q10. Which Set should I choose?

| Requirement | Recommended Implementation |
| --- | --- |
| Fast operations | `HashSet` |
| Preserve insertion order | `LinkedHashSet` |
| Sorted elements | `TreeSet` |

## Chapter Summary

- `Set` stores unique elements only.
- It extends the `Collection` interface.
- It has no index-based operations.
- Duplicate detection depends on `hashCode()` and `equals()`.
- `HashSet` provides the best average performance.
- `LinkedHashSet` preserves insertion order.
- `TreeSet` maintains sorted order using a Red-Black Tree.
- Choosing the correct Set implementation depends on whether you need performance, ordering, or sorting.
