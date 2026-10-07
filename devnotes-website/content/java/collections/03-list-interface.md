---
title: List Interface
subtitle: Ordered, index-based collections — List methods, ListIterator, Arrays.asList vs List.of and implementation choices.
order: 3
---

## Introduction

The `List` interface is one of the most frequently used collection types in Java. Almost every Java application uses `ArrayList` or `LinkedList`, so interviewers expect you to know the `List` interface thoroughly.

## What is List?

A `List` is an **ordered collection** that:

- Allows duplicate elements
- Allows null elements (implementation dependent)
- Supports positional (index-based) access
- Preserves insertion order

Package:

```java
java.util.List
```

Declaration:

```java
public interface List<E> extends Collection<E>
```

```tree Hierarchy
Iterable
  Collection
    List
      ArrayList
      LinkedList
      Vector
        Stack
```

## Characteristics of List

### 1. Ordered Collection

Elements are stored in insertion order.

```java
List<String> list = new ArrayList<>();
list.add("Java");
list.add("Python");
list.add("C++");
System.out.println(list);
```

```output
[Java, Python, C++]
```

The order remains exactly the same.

### 2. Allows Duplicates

Unlike `Set`, `List` allows duplicate values.

```java
List<Integer> list = new ArrayList<>();
list.add(10);
list.add(10);
list.add(20);
System.out.println(list);
```

```output
[10, 10, 20]
```

### 3. Allows Null Values

Most `List` implementations allow multiple null values.

```java
List<String> list = new ArrayList<>();
list.add(null);
list.add(null);
System.out.println(list);
```

```output
[null, null]
```

### 4. Index-Based Access

Every element has an index.

| Index | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Value | A | B | C |

```java
list.get(1);
```

```output
B
```

## Why List?

Suppose you're developing an online shopping application. Cart items: 1. Laptop, 2. Mouse, 3. Keyboard.

- Order matters.
- Duplicates are allowed.
- You need index-based access.

A perfect use case for `List`.

## List Interface Methods

Apart from the `Collection` methods, `List` introduces many new methods.

### add(int index, E element)

Adds an element at a specific position.

```java
List<String> list = new ArrayList<>();
list.add("A");
list.add("C");
list.add(1, "B");
System.out.println(list);
```

```output
[A, B, C]
```

### get()

Returns the element at an index.

```java
String value = list.get(2);
```

```output
C
```

**Time complexity (interview favourite):** `ArrayList` → `O(1)`, `LinkedList` → `O(n)`.

### set()

Replaces an element and **returns the old value**.

```java
list.set(1, "Java");
System.out.println(list);
```

```output
[A, Java, C]
```

### remove(int index)

Removes the element at an index.

```java
list.remove(1);
```

```output
[A, C]
```

### indexOf()

Returns the first occurrence.

```java
List<Integer> list = Arrays.asList(10, 20, 30, 20);
System.out.println(list.indexOf(20));
```

```output
1
```

### lastIndexOf()

Returns the last occurrence.

```java
System.out.println(list.lastIndexOf(20));
```

```output
3
```

### subList()

Returns a **view** of the original list.

```java
List<Integer> list = Arrays.asList(10, 20, 30, 40, 50);
System.out.println(list.subList(1, 4));
```

```output
[20, 30, 40]
```

> [!IMPORTANT]
> **Interview favourite:** the start index is **inclusive**, the end index is **exclusive**.

### listIterator()

Returns a `ListIterator<E>`. Unlike `Iterator`, a `ListIterator` can:

- Move forward
- Move backward
- Update elements
- Add elements
- Remove elements

```java
ListIterator<String> itr = list.listIterator();

while (itr.hasNext()) {
    System.out.println(itr.next());
}
```

## Iterator vs ListIterator

| Feature | Iterator | ListIterator |
| --- | --- | --- |
| Forward | Yes | Yes |
| Backward | No | Yes |
| Add | No | Yes |
| Set | No | Yes |
| Remove | Yes | Yes |
| Only for List | No | Yes |

## Array vs List

| Array | List |
| --- | --- |
| Fixed Size | Dynamic |
| Primitive Support | Objects Only |
| Faster | Flexible |
| No Built-in Methods | Rich API |
| Cannot Resize | Automatically Resizes |

## List Implementations

Java provides four major implementations, each with different characteristics. We'll study each in separate chapters.

| Implementation | Internally | Best for / Notes |
| --- | --- | --- |
| `ArrayList` | Resizable array | Random access, read-heavy operations |
| `LinkedList` | Doubly linked list | Frequent insertions and deletions |
| `Vector` | Resizable array | Synchronized methods: thread-safe but slower than `ArrayList` |
| `Stack` | Extends `Vector` | LIFO: `push()`, `pop()`, `peek()`. Legacy — prefer `Deque` today |

## Equality in List

```java
List<Integer> l1 = Arrays.asList(1, 2, 3);
List<Integer> l2 = Arrays.asList(1, 2, 3);
System.out.println(l1.equals(l2));
```

```output
true
```

Lists compare **order** and **elements**. If the order changes (`[1, 2, 3]` vs `[2, 1, 3]`), the result is `false`. *(Interview favourite.)*

### hashCode() in List

Contract: **equal lists → equal hash codes**. The hash code depends on order and elements.

## Immutable List

Java 9 introduced `List.of()`:

```java
List<String> list = List.of("A", "B", "C");
list.add("D");
```

```output
UnsupportedOperationException
```

## Arrays.asList() vs List.of()

**Interview favourite.**

### Arrays.asList()

```java
List<String> list = Arrays.asList("A", "B");
```

- Fixed-size
- Allows `set()`
- Backed by the original array
- Allows null values

### List.of()

```java
List<String> list = List.of("A", "B");
```

- Completely immutable
- Does not allow `add()`, `remove()` or `set()`
- Does not allow null values

### Arrays.asList() Example

```java
List<String> list = Arrays.asList("A", "B");
list.set(0, "Java");
System.out.println(list);
```

```output
[Java, B]
```

Works. But `list.add("C");` throws an exception.

### List.of() Example

```java
List<String> list = List.of("A", "B");
list.set(0, "Java");
```

```output
UnsupportedOperationException
```

## Time Complexity

| Operation | ArrayList | LinkedList |
| --- | --- | --- |
| add(end) | O(1)* | O(1) |
| add(index) | O(n) | O(n) |
| get(index) | O(1) | O(n) |
| remove(index) | O(n) | O(n) |
| contains() | O(n) | O(n) |
| iteration | O(n) | O(n) |

\*Amortized O(1)

## Common Mistakes

- `list.get(100);` on a smaller list → throws `IndexOutOfBoundsException`.
- `List.of("A").add("B");` → `UnsupportedOperationException`.
- `Arrays.asList(1, 2, 3).add(4);` → `UnsupportedOperationException`.

## Real-world Use Cases

| Use case | Type |
| --- | --- |
| Student list | `List<Student> students;` |
| Shopping cart | `List<Product> cart;` |
| Search results | `List<Employee> employees;` |
| API response | `List<UserDTO> users;` |
| Database records | `List<Order> orders;` |

## Frequently Asked Interview Questions

### Q1. Difference between List and Set?

| List | Set |
| --- | --- |
| Allows duplicates | No duplicates |
| Ordered | Generally unordered (except `LinkedHashSet` / `TreeSet`) |
| Index-based | No index |

### Q2. Which List implementation is fastest?

It depends:

- Reading → `ArrayList`
- Insertion/deletion (middle, frequent structural changes) → `LinkedList`
- Thread-safe → `Vector`

### Q3. Why does List allow duplicates?

Because `List` is designed to preserve insertion order and sequence. Duplicate values are considered valid elements.

### Q4. Difference between Arrays.asList() and List.of()?

| Arrays.asList() | List.of() |
| --- | --- |
| Fixed-size | Immutable |
| Allows `set()` | No `set()` |
| Allows null | No null |
| Backed by array | Independent immutable collection |

### Q5. Difference between Iterator and ListIterator?

`ListIterator` supports bidirectional traversal and modification (`add()`, `set()`), while `Iterator` supports only forward traversal and element removal.

### Q6. What happens if you access an invalid index?

An `IndexOutOfBoundsException` is thrown.

### Q7. Why is ArrayList generally preferred over LinkedList?

Because most applications perform far more reads than insertions/deletions in the middle. `ArrayList` provides O(1) random access, is cache-friendly due to contiguous memory, and usually offers better overall performance.

## Chapter Summary

- `List` extends the `Collection` interface.
- Lists preserve insertion order.
- Lists allow duplicate and (implementation-dependent) null elements.
- Lists provide index-based operations such as `get()`, `set()`, `add(index)` and `remove(index)`.
- `ListIterator` is more powerful than `Iterator`.
- `Arrays.asList()` returns a fixed-size list, while `List.of()` returns an immutable list.
- Choose `ArrayList` for fast random access and `LinkedList` when frequent insertions/deletions are required.
