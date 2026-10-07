---
title: Load Factor, Fail-Fast and Fail-Safe
subtitle: How load factor, HashMap's lack of thread safety and the three iterator styles — fail-fast, weakly consistent and snapshot — connect.
order: 23
---

## Introduction

These four concepts are **high-frequency HashMap interview topics**:

1. Load factor
2. Why HashMap isn't thread-safe
3. Fail-fast iterators
4. Fail-safe (and weakly consistent) iterators

The key is to understand **how they connect** rather than memorizing definitions.

## 1. Load Factor

Load factor tells HashMap **how full the table is allowed to become before resizing**.

Default:

```java
loadFactor = 0.75f;
```

The basic formula:

```text
threshold = capacity × load factor
```

For example:

```text
capacity    = 16
load factor = 0.75

threshold   = 16 × 0.75
            = 12
```

When the number of entries crosses the resize threshold, HashMap grows its internal table.

### Why 0.75?

It's a trade-off between memory and performance.

```flow
Lower load factor
More buckets
Fewer collisions
More memory
---
Higher load factor
Fewer buckets
More collisions
Less memory
```

0.75 is the default practical compromise.

### Interview Trap

> [!WARNING]
> Don't say *"Load factor is the percentage of buckets currently occupied."* More accurately: **load factor is a threshold ratio used to determine when HashMap should resize.**

## 2. Why HashMap Isn't Thread-Safe

`HashMap` is not designed for concurrent modification by multiple threads.

```java
Map<String, Integer> map = new HashMap<>();
```

Two threads execute:

```java
map.put("A", 10);
map.put("B", 20);
```

Without proper synchronization, concurrent operations can interfere with each other.

### Check-then-act race

Compound operations are clearly unsafe:

```java
if (!map.containsKey(key)) {
    map.put(key, value);
}
```

```flow-h A classic check-then-act race condition
Thread 1: containsKey → false
Thread 2: containsKey → false
Thread 1: put
Thread 2: put
```

### Read-modify-write: the counter

```java
map.put("count", map.get("count") + 1);
```

With an initial value of 10:

```flow-h Expected 12, actual 11 — a lost update
Thread A reads 10
Thread B reads 10
Thread A writes 11
Thread B writes 11
```

### The fix

For concurrent use:

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.merge("count", 1, Integer::sum);
```

## 3. Fail-Fast Iterator

A **fail-fast** iterator detects certain structural modifications to a collection while you're iterating and may throw `ConcurrentModificationException`.

```java
Map<Integer, String> map = new HashMap<>();

map.put(1, "A");
map.put(2, "B");

for (Integer key : map.keySet()) {
    map.put(3, "C");
}
```

```output
ConcurrentModificationException
```

### Why?

HashMap maintains an internal modification count, commonly referred to as **`modCount`**. The iterator maintains an **expected** modification count.

```flow
Iterator holds expectedModCount
HashMap holds modCount
Unexpected structural modification
? expectedModCount != modCount? | Yes: ConcurrentModificationException | No: continue
```

### Fail-Fast ≠ Thread-Safe

A very common interview trap. Fail-fast behaviour **does not** make HashMap thread-safe — it is primarily a mechanism for detecting problematic modification during iteration.

> [!IMPORTANT]
> Fail-fast behaviour is **best-effort**, so you must not depend on `ConcurrentModificationException` for program correctness.

## 4. Fail-Safe Iterator

**"Fail-safe iterator"** is a commonly used interview term, but it is **not** the precise JDK terminology. Interviewers typically use it to describe an iterator that can continue when the underlying collection is modified, often because iteration works against a **snapshot** or because the collection has special concurrent semantics.

### CopyOnWriteArrayList

```java
List<Integer> list = new CopyOnWriteArrayList<>();

list.add(1);
list.add(2);

for (Integer i : list) {
    list.add(3);
}
```

The iterator works against a **snapshot-like array state**. It doesn't throw `ConcurrentModificationException` merely because the list is modified.

## 5. ConcurrentHashMap Is Different

```java
ConcurrentHashMap<Integer, String> map = new ConcurrentHashMap<>();
```

The iterator is technically **weakly consistent** — not "fail-safe" in the JDK's terminology.

```java
for (Integer key : map.keySet()) {
    map.put(3, "C");
}
```

It doesn't behave like HashMap's fail-fast iterator, but it also doesn't provide a guaranteed snapshot. Depending on timing, it **may or may not see** some concurrent changes.

## 6. Fail-Fast vs Weakly Consistent vs Snapshot

This distinction is extremely useful in interviews.

| Iterator | Example | Concurrent modification | Snapshot? |
| --- | --- | --- | --- |
| Fail-fast | `HashMap` | May throw CME | ❌ No |
| Weakly consistent | `ConcurrentHashMap` | Doesn't fail merely because of modification | ❌ No |
| Snapshot-style | `CopyOnWriteArrayList` | Safe iteration over a snapshot | ✅ Yes |

```flow
HashMap
"Something changed!"
May throw CME
---
ConcurrentHashMap
"Map can change while I iterate."
Continue — weakly consistent
---
CopyOnWriteArrayList
"Iterate over snapshot."
Changes happen separately
```

## 7. One Very Important Correction

You may hear: *"HashMap has a fail-fast iterator and ConcurrentHashMap has a fail-safe iterator."* That's acceptable as basic interview terminology, but for a strong Java interview answer say:

> [!TIP]
> HashMap iterators are **fail-fast on a best-effort basis**, whereas ConcurrentHashMap iterators are **weakly consistent**. CopyOnWriteArrayList provides **snapshot-style** iteration.

That demonstrates deeper knowledge.

## 8. Interview-Ready Answers

### What is load factor?

Load factor determines how full a HashMap can become before resizing. The default is 0.75, and the resize threshold is approximately capacity multiplied by load factor.

### Why isn't HashMap thread-safe?

HashMap doesn't provide synchronization or the concurrent access guarantees required for multiple threads modifying the Map. Compound operations such as check-then-act and read-modify-write can suffer race conditions and lost updates.

### What is a fail-fast iterator?

A fail-fast iterator detects certain unexpected structural modifications during iteration and may throw `ConcurrentModificationException`. The behaviour is best-effort and should not be relied upon for thread safety.

### What is a fail-safe iterator?

"Fail-safe" is common interview terminology rather than the precise JDK term. It generally refers to an iterator that can continue despite concurrent modification, often through snapshot semantics or concurrent collection behaviour. ConcurrentHashMap specifically provides weakly consistent iterators.

### If HashMap isn't thread-safe, why does its iterator throw ConcurrentModificationException instead of allowing the modification?

The interviewer's favourite follow-up. Fail-fast detection is for detecting **incorrect iteration/modification patterns**; it is **not** a mechanism for making the collection thread-safe.

## Quick Revision

```flow
LOAD FACTOR
Controls RESIZE
---
HASHMAP
Not thread-safe
Concurrent modification is unsafe
---
HASHMAP ITERATOR
Fail-fast
May throw ConcurrentModificationException
---
CONCURRENTHASHMAP ITERATOR
Weakly consistent
No fail-fast CME merely due to concurrent modification
---
COPY-ON-WRITE ITERATOR
Snapshot-style
Iterates over an immutable snapshot
```
