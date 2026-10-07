---
title: Collection Interface (Deep Dive)
subtitle: The root of List, Set and Queue — every core method, equality rules, and the Arrays.asList trap.
order: 2
---

## Introduction

This is one of the most fundamental chapters in Java Collections. Every collection class (except `Map`) is built upon the `Collection` interface. Understanding this interface means understanding the foundation of the entire Collections Framework.

## What is the Collection Interface?

`Collection` is the **root interface** of the Java Collections Framework. It represents a group of objects known as **elements**.

Package:

```java
java.util.Collection
```

Declaration:

```java
public interface Collection<E> extends Iterable<E>
```

Notice:

- `Collection` extends `Iterable`.
- Therefore every `Collection` object can be traversed using an `Iterator`, the enhanced for-loop, and the Stream API.

## Position in Hierarchy

```tree Map is NOT part of this hierarchy
Iterable
  Collection
    List
      ArrayList
      LinkedList
      Vector
    Set
    Queue
```

## Why is Collection an Interface?

> [!QUESTION] Why didn't Java make Collection a class?
> Then every implementation would inherit the same behaviour. But different collections behave differently.

| Implementation | Behaviour |
| --- | --- |
| `ArrayList` | Allows duplicates, maintains insertion order |
| `HashSet` | No duplicates, no ordering |
| `PriorityQueue` | Priority-based ordering |

Hence Java defined the **rules (interface)**, and each implementation provides its own behaviour.

## Collection Interface Methods

There are around 15 core methods every Java developer should know. We'll cover each one in detail.

## 1. add()

```java
boolean add(E e)
```

Adds an element. Returns `true` if the collection changes.

```java
Collection<String> names = new ArrayList<>();
names.add("Rahul");
names.add("John");
```

```output
[Rahul, John]
```

> [!QUESTION] Why does add() return boolean?
> Because some collections may **reject** insertion.

```java
Set<Integer> set = new HashSet<>();
set.add(10);
set.add(10);   // returns false — duplicate wasn't added
```

## 2. addAll()

```java
boolean addAll(Collection<? extends E> c)
```

Adds all elements of another collection.

```java
List<Integer> list1 = new ArrayList<>();
list1.add(10);
list1.add(20);

List<Integer> list2 = new ArrayList<>();
list2.add(30);
list2.add(40);

list1.addAll(list2);
System.out.println(list1);
```

```output
[10, 20, 30, 40]
```

**Time complexity:** depends on the implementation — generally `O(n)`.

## 3. remove()

```java
boolean remove(Object o)
```

Removes the **first** matching object.

```java
List<String> list = new ArrayList<>();
list.add("A");
list.add("B");
list.add("A");
list.remove("A");
System.out.println(list);
```

```output
[B, A]
```

Only the first occurrence is removed.

> [!WARNING]
> **Interview favourite:** `list.remove(1)` removes by **index**; `list.remove("ABC")` removes by **object**. The confusion comes from method overloading.

### remove() Integer Confusion

```java
List<Integer> list = new ArrayList<>();
list.add(10);
list.add(20);
list.add(30);
list.remove(1);
```

```output
[10, 30]
```

It removes **index 1**, not value 1. To remove a value:

```java
list.remove(Integer.valueOf(20));
```

## 4. removeAll()

```java
boolean removeAll(Collection<?> c)
```

Removes all matching elements.

```java
List<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5));
List<Integer> remove = Arrays.asList(2, 4);
list.removeAll(remove);
```

```output
[1, 3, 5]
```

> [!NOTE]
> The list is wrapped in `new ArrayList<>(...)` on purpose. Calling `removeAll()` directly on an `Arrays.asList(...)` list throws `UnsupportedOperationException` (see below).

## 5. retainAll()

**Interview favourite.** Keeps only the common elements.

```java
boolean retainAll(Collection<?> c)
```

```java
List<Integer> list1 = new ArrayList<>(Arrays.asList(1, 2, 3, 4));
List<Integer> list2 = Arrays.asList(2, 4, 6);
list1.retainAll(list2);
System.out.println(list1);
```

```output
[2, 4]
```

Think of it as **intersection**.

### removeAll() vs retainAll()

| removeAll() | retainAll() |
| --- | --- |
| Difference | Intersection |
| A − B | A ∩ B |

## 6. contains()

```java
boolean contains(Object o)
```

```java
List<String> list = Arrays.asList("A", "B", "C");
System.out.println(list.contains("B"));
```

```output
true
```

> [!QUESTION] How does contains() work?
> Internally it uses `equals()`, **not** `==`. Hence overriding `equals()` is important.

## 7. containsAll()

Checks whether **all** elements exist.

```java
List<Integer> l1 = Arrays.asList(1, 2, 3, 4);
List<Integer> l2 = Arrays.asList(2, 3);
System.out.println(l1.containsAll(l2));
```

```output
true
```

## 8. clear()

Removes everything.

```java
list.clear();
```

```output
[]
```

The size becomes `0`.

## 9. isEmpty()

Checks whether the collection is empty. Returns `true` or `false`.

```java
if (list.isEmpty())
```

> [!QUESTION] list.size() == 0 vs list.isEmpty()?
> Both work. Some implementations optimize `isEmpty()`, and it reads better. **Prefer `isEmpty()`.**

## 10. size()

Returns the number of elements.

```java
list.size();
```

> [!QUESTION] What is the maximum size?
> Theoretically `Integer.MAX_VALUE`. It is implementation dependent.

## 11. iterator()

Inherited from `Iterable`. Returns an `Iterator<E>`.

```java
Iterator<String> itr = list.iterator();
while (itr.hasNext()) {
    System.out.println(itr.next());
}
```

## 12. toArray()

Converts a Collection to an Array.

```java
Object[] arr = list.toArray();
```

Preferred (typed array):

```java
String[] arr = list.toArray(new String[0]);
```

Java 11+:

```java
String[] arr = list.toArray(String[]::new);
```

## 13. stream()

**Java 8.** Converts a Collection into a Stream.

```java
list.stream()
    .filter(x -> x > 10)
    .forEach(System.out::println);
```

## 14. parallelStream()

Creates a parallel stream.

```java
list.parallelStream()
```

Useful for CPU-intensive operations on large datasets.

## 15. removeIf()

**Java 8 feature.**

```java
boolean removeIf(Predicate<? super E> filter)
```

```java
list.removeIf(x -> x % 2 == 0);
```

Removes all even numbers.

```output
[1, 3, 5]
```

## 16. forEach()

**Java 8.**

```java
list.forEach(System.out::println);
```

Internally uses a `Consumer`.

## 17. spliterator()

**Java 8.** Returns a `Spliterator<E>`, used by the Stream API. Supports:

- Parallel processing
- Efficient traversal
- Divide and conquer

## equals() in Collections

**Interview favourite.**

```java
List<String> l1 = Arrays.asList("A", "B");
List<String> l2 = Arrays.asList("A", "B");
System.out.println(l1.equals(l2));
```

```output
true
```

Collections compare:

- Size
- Order (for Lists)
- Elements using `equals()`

## hashCode()

Every Collection has `hashCode()`. Contract: **equal collections → equal hash codes**. Mandatory for `HashSet` and `HashMap`.

## UnsupportedOperationException

**Interview favourite.**

```java
List<Integer> list = Arrays.asList(1, 2, 3);
list.add(4);
```

```output
UnsupportedOperationException
```

**Why?** `Arrays.asList()` returns a **fixed-size list backed by the original array**. Adding or removing elements changes the size, so it is not allowed. To create a modifiable list:

```java
List<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3));
list.add(4);
```

## Null Handling

Depends on the implementation:

| Implementation | Nulls |
| --- | --- |
| `ArrayList` | Allows multiple nulls |
| `HashSet` | Allows one null |
| `TreeSet` | Generally does not allow null, because comparisons are required |

## Time Complexity (General)

| Method | Typical Complexity |
| --- | --- |
| `add()` | O(1) average |
| `remove()` | O(n) |
| `contains()` | O(n) |
| `size()` | O(1) |
| `clear()` | O(n) |
| `iterator()` | O(1) |
| `addAll()` | O(n) |
| `removeAll()` | O(n × m) (implementation-dependent) |
| `retainAll()` | O(n × m) (implementation-dependent) |
| `isEmpty()` | O(1) |

> [!NOTE]
> These are general complexities. The exact complexity depends on the underlying implementation (`ArrayList`, `HashSet`, `LinkedList`, etc.).

## Frequently Asked Interview Questions

### Q1. What is the root interface of the Java Collections Framework?

`Collection`.

### Q2. Does Map extend Collection?

No. `Map` is a separate hierarchy because it stores key-value pairs instead of individual elements.

### Q3. Which method checks object equality?

`equals()`. Methods like `contains()`, `remove(Object)` and `containsAll()` rely on `equals()`.

### Q4. Why does add() return boolean?

Because some implementations (like `HashSet`) may reject duplicate elements, in which case `add()` returns `false`.

### Q5. Difference between remove() and removeAll()?

- `remove(Object)` removes the first matching element.
- `removeAll(Collection)` removes all elements that are present in the specified collection.

### Q6. Difference between removeAll() and retainAll()?

- `removeAll()` performs a set difference (A − B).
- `retainAll()` performs a set intersection (A ∩ B).

### Q7. Why is Arrays.asList() not fully modifiable?

Because it returns a fixed-size list backed by the original array. You can replace elements using `set()`, but you cannot change the list's size with `add()` or `remove()`.

## Chapter Summary

- `Collection` is the root interface for `List`, `Set` and `Queue`.
- It extends `Iterable`, enabling iteration and enhanced for-loops.
- Learn every method of the `Collection` interface thoroughly — interviewers frequently ask about their behaviour.
- `contains()` and `remove(Object)` rely on `equals()`, not `==`.
- `retainAll()` performs intersection, while `removeAll()` performs difference.
- `Arrays.asList()` returns a fixed-size list, not a fully mutable `ArrayList`.
- Time complexity depends on the concrete implementation.
