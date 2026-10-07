---
title: ArrayList
subtitle: Internal working of the resizable array — size vs capacity, 1.5x growth, amortized O(1) and performance trade-offs.
order: 4
---

## Introduction

If there is one Collection class you must master for Java interviews, it is **ArrayList**.

Interviewers don't just ask how to use `ArrayList`; they expect you to understand **how it works internally**, how it grows, why operations have different time complexities, and when it should or should not be used.

## What is ArrayList?

`ArrayList` is a **resizable array implementation** of the `List` interface.

Package:

```java
java.util.ArrayList
```

Declaration:

```java
public class ArrayList<E>
        extends AbstractList<E>
        implements List<E>,
                   RandomAccess,
                   Cloneable,
                   Serializable
```

```flow Where ArrayList fits
Iterable
Collection
List
ArrayList
```

## Characteristics of ArrayList

- ✅ Maintains insertion order
- ✅ Allows duplicate elements
- ✅ Allows multiple null values
- ✅ Index-based access
- ✅ Dynamically grows
- ❌ Not synchronized
- ❌ Not thread-safe

## Internal Structure

Many beginners think `ArrayList` is some magical data structure. It is not. Internally it is simply **an array of objects**.

```array Index → element
0: A
1: B
2: C
3: D
4: E
```

Internally Java stores elements in:

```java
transient Object[] elementData;
```

This single array is the heart of `ArrayList`.

## Creating an ArrayList

```java
ArrayList<String> list = new ArrayList<>();
```

What actually happens? Java creates an empty `ArrayList`.

> [!IMPORTANT]
> No large array is allocated immediately.

### Default Constructor

Internally:

```java
elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
```

Initially **Size = 0** and **Capacity = 0**. The internal array is shared and empty.

### What Happens on the First add()?

```java
list.add("Java");
```

Now Java creates the first internal array. The default capacity becomes **10**.

```array Capacity = 10, Size = 1
0: Java
1:
2:
3:
4:
5:
6:
7:
8:
9:
```

## Size vs Capacity

This is one of the favourite interview questions.

### Size

The number of **actual elements**.

```java
ArrayList<Integer> list = new ArrayList<>();
list.add(10);
list.add(20);
```

Size = **2**.

### Capacity

The total number of elements that can be stored **before resizing**. Current capacity = **10**.

> [!TIP]
> **Interview answer:** Size → actual elements. Capacity → available storage.

### Capacity Example

| Step | Capacity | Size |
| --- | --- | --- |
| `new ArrayList<>()` | 0 | 0 |
| After first insertion | 10 | 1 |
| After adding 10 elements | 10 | 10 |
| After adding the 11th element | grows (15) | 11 |

## Growth Algorithm

**Interview favourite.** Suppose the current capacity is **10** and we need one more element. Java creates a new capacity of **15**.

```text
newCapacity = oldCapacity + (oldCapacity >> 1)
```

Meaning: **old + 50%**.

```flow-h Growth is approximately 1.5×, not double
10
15
22
33
49
73
109
```

### Why Not Double the Size?

Imagine storing 10 million objects. Doubling on every resize would waste large amounts of memory. Using 1.5× growth balances:

- Memory usage
- Performance
- Fewer reallocations

## What Happens During Resize?

Suppose capacity = 10 and you insert the 11th element.

```flow
Old array full | capacity 10: [1 … 10]
Create a new larger array | capacity 15
Copy all existing elements
Insert the new element
Old array | eligible for Garbage Collection
```

### Resize Cost

This copy operation is **expensive**, because all elements are copied again. Complexity: **O(n)**.

## Why is add() O(1)?

**Interview favourite.** Most insertions occur at the end:

```java
list.add(100);
```

Java simply places the element in the next free slot → **O(1)**. Only during resizing does it cost **O(n)**. Therefore the average complexity is **amortized O(1)**.

## Amortized Time Complexity

> [!QUESTION] What is amortized O(1)?
> Most operations are O(1). Occasionally a resize costs O(n). When averaged across many insertions, each `add()` is effectively O(1).

## ensureCapacity()

Sometimes we already know how many elements we need.

```java
ArrayList<Employee> list = new ArrayList<>();
list.ensureCapacity(10000);
```

Benefits:

- Reduces resizing
- Improves performance
- Fewer array copies

Useful when loading large datasets from files or databases.

## trimToSize()

Suppose capacity = **1000** but size = **50**. Extra memory is wasted. Use:

```java
list.trimToSize();
```

Now capacity = 50. Memory optimized.

## Accessing Elements

```java
list.get(5);
```

How? Arrays support **direct indexing**:

```text
Address + (Index × Element Size)
```

Therefore **O(1)**. Random access is extremely fast.

## Why Does ArrayList Implement RandomAccess?

Notice `implements RandomAccess`. `RandomAccess` is a **marker interface** — it contains no methods. It tells Java:

> This collection supports fast random access.

Algorithms can optimize based on this information.

## Insertion

**Adding at the end** — `list.add(100);` → **O(1)**.

**Adding at the beginning** — `list.add(0, 100);`

```flow-h Every element shifts one position: O(n)
A B C D
: add(0, 100)
100 A B C D
```

## Removal

**Removing the last element** — `list.remove(list.size() - 1);` → **O(1)**.

**Removing the first element** — `list.remove(0);` — the remaining elements shift left.

```flow-h O(n)
A B C D
: remove A
B C D
```

## contains()

```java
list.contains("Java");
```

Java searches **sequentially**: element 1 → element 2 → element 3 … Complexity: **O(n)**.

## Iteration

```java
for (String s : list)
```

Complexity **O(n)**, but fast because memory is contiguous. This makes `ArrayList` more **CPU cache-friendly** than `LinkedList`.

## Null Values and Duplicates

`ArrayList` allows multiple null values:

```java
list.add(null);
list.add(null);
```

Duplicates are allowed:

```java
list.add("Java");
list.add("Java");
```

```output
[Java, Java]
```

## Thread Safety

> [!QUESTION] Is ArrayList thread-safe?
> **No.** Multiple threads modifying the same `ArrayList` may lead to data corruption, lost updates and unexpected exceptions.

### How to Make It Thread-Safe?

**Option 1:**

```java
List<String> list = Collections.synchronizedList(new ArrayList<>());
```

**Option 2:** `CopyOnWriteArrayList` (covered later).

## ArrayList vs Array

| Array | ArrayList |
| --- | --- |
| Fixed size | Dynamic |
| Stores primitives & objects | Stores objects (generics use wrapper types for primitives) |
| Faster | Slightly slower due to abstraction |
| No rich API | Rich Collection API |

## ArrayList vs LinkedList

| Feature | ArrayList | LinkedList |
| --- | --- | --- |
| Internal Structure | Dynamic Array | Doubly Linked List |
| Random Access | O(1) | O(n) |
| Insert at End | O(1)* | O(1) |
| Insert at Beginning | O(n) | O(1) (after locating node) |
| Remove by Index | O(n) | O(n) |
| Memory Usage | Lower | Higher (node references) |
| Cache Locality | Excellent | Poor |

\*Amortized O(1)

## Common Mistakes

- Using raw types: `ArrayList list = new ArrayList();` — prefer generics: `ArrayList<String> list = new ArrayList<>();`
- Creating a huge `ArrayList` without pre-sizing — better: `new ArrayList<>(100000);` or `list.ensureCapacity(100000);`
- Using `ArrayList` for frequent insertions at the beginning — a better choice is `LinkedList` (or `ArrayDeque`).

## Internal Source Code (Simplified)

```java
public boolean add(E e) {
    ensureCapacityInternal(size + 1);
    elementData[size++] = e;
    return true;
}
```

A resize happens only if required. Otherwise, the element is simply placed into the next free slot.

## Time Complexity

| Operation | Complexity |
| --- | --- |
| get(index) | O(1) |
| set(index) | O(1) |
| add(end) | O(1) amortized |
| add(index) | O(n) |
| remove(last) | O(1) |
| remove(index) | O(n) |
| contains() | O(n) |
| indexOf() | O(n) |
| iteration | O(n) |
| clear() | O(n) |

## Frequently Asked Interview Questions

### Q1. How does ArrayList work internally?

It stores elements in a dynamically resizable `Object[]` array.

### Q2. Difference between size and capacity?

- Size = number of actual elements.
- Capacity = size of the internal array.

### Q3. What is the default capacity?

With the default constructor, the internal array is initially empty. On the first insertion, the capacity grows to **10**.

### Q4. What is the growth formula?

Approximately `newCapacity = oldCapacity + (oldCapacity >> 1)` — roughly **1.5×** the old capacity.

### Q5. Why is add() O(1)?

Most insertions simply place the element into the next available slot. Only occasional resizing requires copying elements, making the average cost amortized O(1).

### Q6. Is ArrayList synchronized?

No.

### Q7. Why does ArrayList implement RandomAccess?

To indicate that it supports efficient random (index-based) access, allowing algorithms to optimize accordingly.

### Q8. When should you use ensureCapacity()?

When you know approximately how many elements you'll store, to reduce resizing and improve performance.

### Q9. What does trimToSize() do?

It shrinks the internal capacity to match the current size, reducing unused memory.

## Chapter Summary

- `ArrayList` is backed by a dynamically resizable `Object[]`.
- It provides O(1) random access through array indexing.
- Capacity and size are different concepts.
- Capacity grows by approximately 1.5× when required.
- `add()` is amortized O(1) because resizing happens infrequently.
- `ensureCapacity()` improves bulk insertion performance.
- `trimToSize()` helps reclaim unused memory.
- `ArrayList` is not thread-safe.
