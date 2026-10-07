---
title: LinkedList
subtitle: The doubly linked list behind LinkedList — nodes, head/tail, traversal cost, Deque operations and when it actually wins.
order: 5
---

## Introduction

`LinkedList` is one of the most misunderstood classes in the Java Collections Framework. Many developers believe:

> "LinkedList is always faster than ArrayList."

**This is not true.** A 5+ years Java developer is expected to know when `LinkedList` is better, when `ArrayList` is better, and how `LinkedList` works internally.

## What is LinkedList?

`LinkedList` is a **doubly linked list** implementation of the `List` interface.

Package:

```java
java.util.LinkedList
```

Declaration:

```java
public class LinkedList<E>
        extends AbstractSequentialList<E>
        implements List<E>,
                   Deque<E>,
                   Cloneable,
                   Serializable
```

Notice: unlike `ArrayList`, `LinkedList` implements **List**, **Queue** and **Deque**. That makes it much more versatile.

## Position in Collection Hierarchy

```tree LinkedList can behave as a List, Queue, Deque and Stack
Iterable
  Collection
    List
      LinkedList
    Queue
      Deque
        LinkedList
```

## Characteristics

- ✅ Maintains insertion order
- ✅ Allows duplicates
- ✅ Allows multiple null values
- ✅ Dynamic size
- ✅ Fast insertion/deletion after locating the position
- ❌ Slow random access
- ❌ Higher memory consumption
- ❌ Not thread-safe

## Internal Structure

Unlike `ArrayList`, `LinkedList` does **NOT** use an array. It uses **Nodes**. Each node stores:

- Data
- Previous node reference
- Next node reference

```flow-h One node
Prev
Data
Next
```

### Node Class (Simplified)

Internally Java has something similar to:

```java
private static class Node<E> {
    E item;
    Node<E> next;
    Node<E> prev;

    Node(Node<E> prev, E element, Node<E> next) {
        this.item = element;
        this.prev = prev;
        this.next = next;
    }
}
```

Every element becomes a `Node`.

## Memory Representation

```java
list.add("A");
list.add("B");
list.add("C");
```

```flow-h Each node knows its previous and next node — hence "doubly linked list"
head
A | prev = null · next → B
<->
B | prev → A · next → C
<->
C | prev → B · next = null
tail
```

## Why a Doubly Linked List?

Suppose Java used a **singly** linked list. Backward traversal would not be possible, and removing a node would require finding its previous node. A doubly linked list allows:

- Forward traversal
- Backward traversal
- Easier deletion

## Head and Tail References

`LinkedList` stores:

```java
Node<E> first;
Node<E> last;
```

These references allow efficient insertion/removal at **both ends**.

## Adding Elements

```java
LinkedList<Integer> list = new LinkedList<>();
list.add(10);
list.add(20);
list.add(30);
```

```flow-h Adding 40: only the tail reference updates — O(1)
10
20
30
40 {new}
```

## Accessing Elements

```java
list.get(5);
```

Can `LinkedList` jump directly to index 5? **No.** It must traverse.

```flow-h Reaching index 5 means walking every node: O(n)
A
B
C
D
E
F
```

### Optimization Inside LinkedList

Java is smarter. If you need `list.get(98)` and the total size is 100, Java starts from the **tail** instead of the head. For `list.get(2)` it starts from the **head**.

```text
if (index < size / 2)
    start from head
else
    start from tail
```

## Insertion

### Adding at the beginning

```java
list.addFirst(100);
```

```flow-h Only pointers change: O(1)
10 → 20 → 30
: addFirst(100)
100 → 10 → 20 → 30
```

### Adding at the end

```java
list.addLast(40);   // O(1)
```

### Adding in the middle

Traversal is needed first.

```java
list.add(5, 100);
```

| Step | Cost |
| --- | --- |
| Traversal | O(n) |
| Insertion | O(1) |
| **Total** | **O(n)** |

## Deletion

| Operation | Complexity | Why |
| --- | --- | --- |
| `list.removeFirst();` | O(1) | Pointers change |
| `list.removeLast();` | O(1) | Pointers change |
| Remove from middle | O(n) | Traversal needed |

## Why is Insertion Faster?

**ArrayList** — inserting at the beginning of `A B C D` needs shifting to get `100 A B C D`. **All elements move.**

**LinkedList** — `100 → A → B → C → D`. **Only references change.**

## Queue Operations

`LinkedList` implements `Deque`. Therefore these are available:

`offer()`, `offerFirst()`, `offerLast()`, `poll()`, `pollFirst()`, `pollLast()`, `peek()`, `peekFirst()`, `peekLast()`

## Stack Operations

`LinkedList` can also behave as a Stack with `push()`, `pop()` and `peek()`.

```java
LinkedList<Integer> stack = new LinkedList<>();
stack.push(10);
stack.push(20);
System.out.println(stack.pop());
```

```output
20
```

## Null Values and Duplicates

Nulls are allowed:

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

> [!QUESTION] Is LinkedList synchronized?
> **No.** It is not thread-safe.

## Internal Source Code (Simplified)

Adding last:

```java
void linkLast(E e) {
    Node<E> l = last;
    Node<E> newNode = new Node<>(l, e, null);
    last = newNode;
    if (l == null)
        first = newNode;
    else
        l.next = newNode;
}
```

Only references change.

## Memory Usage

**Interview favourite.** Each node stores data plus a previous and next reference. Compared to `ArrayList`, memory usage is **higher**.

| ArrayList | LinkedList |
| --- | --- |
| `A B C D` | `Prev A Next` · `Prev B Next` · `Prev C Next` · `Prev D Next` |

Extra references consume additional memory.

## Cache Locality

- **ArrayList** — `A B C D E` stored contiguously. CPU cache-friendly.
- **LinkedList** — nodes are scattered in memory. Poor cache locality.

Hence iteration is generally **slower** than `ArrayList`. *(Interview favourite.)*

## ArrayList vs LinkedList

| Feature | ArrayList | LinkedList |
| --- | --- | --- |
| Internal Structure | Dynamic Array | Doubly Linked List |
| Random Access | O(1) | O(n) |
| Insert at End | O(1)* | O(1) |
| Insert at Beginning | O(n) | O(1) |
| Remove at Beginning | O(n) | O(1) |
| Memory Usage | Lower | Higher |
| Cache Friendly | Yes | No |
| Implements Deque | No | Yes |

\*Amortized O(1)

## When Should You Use LinkedList?

**Use LinkedList when:**

- Frequent insertions/removals at the beginning or end
- Queue implementation
- Deque implementation
- Stack implementation (though `ArrayDeque` is generally preferred)
- Sequential traversal

**Avoid LinkedList when:**

- Frequent random access
- Read-heavy applications
- Memory optimization is important

## Common Mistakes

- Using `LinkedList` for random access — `list.get(90000);` is slow.
- Assuming insertion is always O(1). Wrong — finding the insertion position requires traversal, so the total complexity is O(n).
- Using `LinkedList` instead of `ArrayList` for every List. `ArrayList` is generally the better default choice for most applications.

## Time Complexity

| Operation | Complexity |
| --- | --- |
| get(index) | O(n) |
| set(index) | O(n) |
| addLast() | O(1) |
| addFirst() | O(1) |
| add(index) | O(n) |
| removeFirst() | O(1) |
| removeLast() | O(1) |
| remove(index) | O(n) |
| contains() | O(n) |
| iteration | O(n) |

## Frequently Asked Interview Questions

### Q1. Why is LinkedList slower than ArrayList for reading?

Because it cannot directly access an index. It must traverse nodes one by one.

### Q2. Why is LinkedList faster for insertion?

Once the target position is reached, only node references (`prev` and `next`) need to be updated. No element shifting is required.

### Q3. Does LinkedList use a singly or doubly linked list?

Doubly linked list.

### Q4. Why does LinkedList implement Deque?

Because it supports efficient insertion and removal from both the front and the rear.

### Q5. Can LinkedList be used as a Queue?

Yes — methods include `offer()`, `poll()` and `peek()`.

### Q6. Can LinkedList be used as a Stack?

Yes — methods include `push()`, `pop()` and `peek()`. However, `ArrayDeque` is generally recommended for stack implementations.

### Q7. Why does LinkedList consume more memory?

Each node stores the element plus two additional references (`prev` and `next`).

### Q8. How does get(index) work internally?

Java chooses the shorter traversal path:

- Starts from `first` if the index is in the first half.
- Starts from `last` if the index is in the second half.

### Q9. Is LinkedList thread-safe?

No.

### Q10. Which is better: ArrayList or LinkedList?

There is no universal winner.

- `ArrayList` is better for random access and read-heavy workloads.
- `LinkedList` is useful for frequent insertions/removals at the ends and for queue/deque operations.

## Chapter Summary

- `LinkedList` is implemented as a doubly linked list.
- Every element is stored in a separate `Node`.
- Nodes maintain references to both the previous and next nodes.
- Random access is O(n), while insertion/removal at the ends is O(1).
- `LinkedList` uses more memory than `ArrayList` because of additional node references.
- Poor cache locality makes iteration slower than `ArrayList` in many real-world scenarios.
- `LinkedList` also implements the `Deque` interface, enabling queue and stack operations.
