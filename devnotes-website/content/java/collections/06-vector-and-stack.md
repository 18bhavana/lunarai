---
title: Vector & Stack
subtitle: The legacy synchronized list and LIFO stack — capacity increment, Enumeration, and why ArrayDeque replaced Stack.
order: 6
---

## Introduction

`Vector` and `Stack` are considered **legacy** collection classes, but they are still frequently asked in interviews because they help interviewers evaluate your understanding of the evolution of the Java Collections Framework, thread safety, and legacy vs modern APIs.

Although you may rarely use them in new applications, you must know how they work and why modern alternatives are preferred.

## History of Vector

Before the Java Collections Framework (JDK 1.2), Java provided a few collection-like classes. One of them was `Vector`.

After JDK 1.2, `Vector` was modified to implement the `List` interface. That means today it behaves like a normal `List` while retaining its original **synchronized** behaviour.

## What is Vector?

`Vector` is a **synchronized, resizable array** implementation of the `List` interface.

Package:

```java
java.util.Vector
```

Declaration:

```java
public class Vector<E>
        extends AbstractList<E>
        implements List<E>,
                   RandomAccess,
                   Cloneable,
                   Serializable
```

Like `ArrayList`, `Vector` implements `RandomAccess` because internally it also uses an array.

```flow Position in hierarchy
Iterable
Collection
List
Vector
Stack
```

## Characteristics of Vector

- ✅ Maintains insertion order
- ✅ Allows duplicates
- ✅ Allows null values
- ✅ Dynamic resizing
- ✅ Thread-safe
- ❌ Slower than `ArrayList`
- ❌ Legacy class

## Internal Structure

Exactly like `ArrayList`, `Vector` stores elements inside:

```java
Object[] elementData;
```

```array Internally it is still an array
0: A
1: B
2: C
3: D
4: E
```

## Why is Vector Thread-Safe?

**Interview favourite.** Every public method is `synchronized`:

```java
public synchronized boolean add(E e)
```

Meaning: only one thread can modify the `Vector` at a time.

```flow-h This prevents concurrent modification issues
Thread A | lock Vector
Insert
Unlock
Thread B | can now enter
```

## Synchronization Cost

> [!QUESTION] Why is Vector slower?
> Because every operation requires acquiring a lock and releasing the lock — even if only one thread is using it.

```java
vector.add("Java");
```

```flow-h This additional locking introduces overhead
Acquire Lock
Insert
Release Lock
```

## Creating a Vector

### Default Constructor

```java
Vector<Integer> vector = new Vector<>();
```

Default capacity: **10**.

### Initial Capacity

```java
Vector<Integer> vector = new Vector<>(100);
```

Capacity: **100**.

### Capacity Increment

A **unique feature** of `Vector`.

```java
Vector<Integer> vector = new Vector<>(10, 5);
```

Initial capacity **10**, capacity increment **5**.

```flow-h Growth with capacityIncrement = 5
10
15
20
25
```

## Growth Algorithm

**Interview favourite.** If no capacity increment is specified, `Vector` **doubles** its capacity.

```flow
Vector (doubles)
10
20
40
80
---
ArrayList (~1.5×)
10
15
22
33
```

## Size vs Capacity

```java
Vector<Integer> vector = new Vector<>();
```

After adding 5 elements: **Size = 5**, **Capacity = 10** — exactly like `ArrayList`.

## Important Methods

| Method | Description |
| --- | --- |
| `vector.add("Java")` | Adds at end |
| `vector.addElement("Java")` | Legacy method — same purpose |
| `vector.remove(2)` | Removes element |
| `removeElement()` | Legacy version of remove |
| `vector.elementAt(2)` | Legacy API instead of `vector.get(2)` |
| `vector.firstElement()` | Returns first element |
| `vector.lastElement()` | Returns last element |
| `vector.capacity()` | Returns current capacity |

> [!NOTE]
> **Interview favourite:** `ArrayList` does **not** expose its capacity publicly; `Vector` does via `capacity()`.

### Vector Example

```java
Vector<String> vector = new Vector<>();
vector.add("Java");
vector.add("Spring");
vector.add("Docker");
System.out.println(vector);
```

```output
[Java, Spring, Docker]
```

## Enumeration

Before `Iterator`, Java used `Enumeration`.

```java
Enumeration<String> e = vector.elements();

while (e.hasMoreElements()) {
    System.out.println(e.nextElement());
}
```

`Enumeration` is still supported for backward compatibility.

### Enumeration vs Iterator

| Feature | Enumeration | Iterator |
| --- | --- | --- |
| Legacy | Yes | No |
| Remove Elements | No | Yes |
| Forward Traversal | Yes | Yes |
| Fail-Fast | No | Yes |

## Stack

### What is Stack?

`Stack` extends `Vector`.

```java
public class Stack<E> extends Vector<E>
```

Meaning: every `Vector` method is available inside `Stack`.

### LIFO Principle

Stack follows **LIFO — Last In, First Out**.

```flow-up Push 10, 20, 30 — pop() returns 30 first
30 | top
20
10
```

## Stack Operations

| Operation | Code | Description |
| --- | --- | --- |
| push() | `stack.push(10);` | Adds to top |
| pop() | `stack.pop();` | Removes top element |
| peek() | `stack.peek();` | Returns top element without removing it |
| empty() | `stack.empty();` | Checks whether the stack is empty |
| search() | `stack.search(20);` | Returns distance from top (1-based) |

### search() Example

```java
Stack<Integer> stack = new Stack<>();
stack.push(10);
stack.push(20);
stack.push(30);
System.out.println(stack.search(20));
```

```output
2
```

### Stack Example

```java
Stack<String> stack = new Stack<>();
stack.push("Java");
stack.push("Spring");
stack.push("AWS");
System.out.println(stack.pop());
System.out.println(stack.peek());
```

```output
AWS
Spring
```

## Why is Stack Legacy?

**Interview favourite.** Because it extends `Vector`, every operation is synchronized — extra overhead. Modern Java recommends **`ArrayDeque`** instead.

### ArrayDeque vs Stack

| Feature | Stack | ArrayDeque |
| --- | --- | --- |
| Thread-Safe | Yes (via Vector synchronization) | No |
| Legacy | Yes | No |
| Performance | Slower | Faster |
| Recommended | No | Yes |

### Why is ArrayDeque Preferred?

- Faster
- No synchronization overhead
- Better memory usage
- Designed specifically for Queue and Stack operations

```java
Deque<Integer> stack = new ArrayDeque<>();

stack.push(10);
stack.push(20);

System.out.println(stack.pop());
```

```output
20
```

## Vector vs ArrayList

| Feature | Vector | ArrayList |
| --- | --- | --- |
| Thread-Safe | Yes | No |
| Internal Structure | Dynamic Array | Dynamic Array |
| Synchronization | Yes | No |
| Performance | Slower | Faster |
| Growth | 2× (default) | ~1.5× |
| Legacy | Yes | No |
| Capacity API | Yes | No |

## Time Complexity

| Operation | Complexity |
| --- | --- |
| get() | O(1) |
| set() | O(1) |
| add() | O(1) amortized |
| remove(index) | O(n) |
| contains() | O(n) |
| iteration | O(n) |
| push() | O(1) |
| pop() | O(1) |
| peek() | O(1) |

## Common Mistakes

- Using `Stack` in new projects. Better: `Deque<Integer> stack = new ArrayDeque<>();`
- Using `Vector` assuming it is always the correct thread-safe list. Modern alternatives include `Collections.synchronizedList()` and `CopyOnWriteArrayList`, depending on the use case.
- Thinking synchronization means "better". Synchronization improves thread safety but also adds performance overhead.

## Frequently Asked Interview Questions

### Q1. Difference between Vector and ArrayList?

- `Vector` is synchronized; `ArrayList` is not.
- `Vector` is slower because of locking.
- `Vector` doubles capacity by default; `ArrayList` grows by approximately 1.5×.

### Q2. Why is Vector slower?

Because every public method is synchronized, requiring lock acquisition and release.

### Q3. What is the default capacity of Vector?

10.

### Q4. What is Capacity Increment?

A `Vector`-specific feature that allows you to specify how much the internal array should grow when it becomes full.

### Q5. What is Enumeration?

A legacy traversal interface introduced before `Iterator`. It supports forward traversal but cannot remove elements.

### Q6. Why is Stack considered legacy?

Because it extends `Vector`, inherits synchronization overhead, and has been superseded by `Deque` implementations such as `ArrayDeque`.

### Q7. Which should be used instead of Stack?

`ArrayDeque`.

### Q8. Is Vector always the best choice for multi-threaded applications?

No. Modern concurrent collections such as `CopyOnWriteArrayList` or properly synchronized wrappers are often better choices, depending on the workload.

## Chapter Summary

- `Vector` is a synchronized, resizable array implementation of `List`.
- It uses an internal `Object[]` just like `ArrayList`.
- Every public method is synchronized, making it thread-safe but slower.
- `Vector` supports a unique `capacityIncrement` feature.
- `Stack` extends `Vector` and follows the LIFO principle.
- Modern Java recommends `ArrayDeque` instead of `Stack`.
- `Enumeration` is a legacy traversal mechanism; `Iterator` is the modern replacement.
