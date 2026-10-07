---
title: Deque Interface
subtitle: The double-ended queue that is both a Queue and a Stack — method families, ArrayDeque's circular array and why it replaced Stack.
order: 12
---

## Introduction

`Deque` is one of the most useful interfaces in the Collections Framework because it can act as **both a Queue and a Stack**.

The name comes from **Double Ended Queue**. It allows insertion and removal from **both ends**.

## What is Deque?

Package:

```java
java.util.Deque
```

```tree For most normal single-threaded use cases, ArrayDeque is the preferred implementation
Iterable
  Collection
    Queue
      Deque
        ArrayDeque
        LinkedList
```

## Core Idea

A normal Queue: **insert at rear**, **remove from front**.

A Deque: insert/remove from **either end**.

```flow-h Front ⇄ … ⇄ Rear
Front
<->
A
B
C
D
<->
Rear
```

Therefore **Deque = Queue behaviour + Stack behaviour**.

## Deque as a Queue

```java
Deque<Integer> deque = new ArrayDeque<>();

deque.offerLast(10);
deque.offerLast(20);
deque.offerLast(30);

deque.pollFirst();   // returns 10
```

- `offerLast()` → insertion at rear
- `pollFirst()` → removal from front

This gives normal **FIFO** behaviour.

## Deque as a Stack

```java
Deque<Integer> stack = new ArrayDeque<>();

stack.push(10);
stack.push(20);
stack.push(30);
```

```flow-up stack.pop() returns 30 — LIFO behaviour
30 | top
20
10
```

## Why Deque is Better Than Stack

```java
// Legacy
Stack<Integer> stack = new Stack<>();

// Modern
Deque<Integer> stack = new ArrayDeque<>();
```

Why prefer `Deque`?

- `Stack` inherits from legacy `Vector`
- `Vector` synchronizes operations
- `ArrayDeque` avoids unnecessary synchronization overhead
- `Deque` provides a cleaner abstraction for stack operations

> [!TIP]
> Use `Deque` when you need stack semantics in modern Java.

## Deque Method Families

This is the most important part to memorize.

| Operation | First end — throws exception | First end — special value | Last end — throws exception | Last end — special value |
| --- | --- | --- | --- | --- |
| **Insert** | `addFirst(e)` | `offerFirst(e)` | `addLast(e)` | `offerLast(e)` |
| **Remove** | `removeFirst()` | `pollFirst()` | `removeLast()` | `pollLast()` |
| **Inspect** | `getFirst()` | `peekFirst()` | `getLast()` | `peekLast()` |

Just like `Queue`:

- `add…` → exception on failure; `offer…` → special-value (`false`) failure
- `remove…` → exception if empty; `poll…` → `null` if empty
- `get…` → exception if empty; `peek…` → `null` if empty

### Easy Mental Model

```array FRONT → REAR
0: 10
1: 20
2: 30
3: 40
```

| Operation | Result |
| --- | --- |
| `addFirst(5)` | `5 10 20 30 40` |
| `addLast(50)` | `10 20 30 40 50` |
| `pollFirst()` | removes `10` |
| `pollLast()` | removes `40` |

## ArrayDeque

`ArrayDeque` is the most important `Deque` implementation.

Package:

```java
java.util.ArrayDeque
```

Declaration:

```java
public class ArrayDeque<E>
        extends AbstractCollection<E>
        implements Deque<E>,
                   Cloneable,
                   Serializable
```

It is:

- Resizable
- Array-backed
- Not synchronized
- Does not permit null
- Efficient at both ends

### Internal Structure

Unlike `LinkedList`, `ArrayDeque` does **not** create a `Node` object for every element. It uses an internal array and maintains positions indicating where elements should be inserted/removed.

```array head points at A, tail at the next free slot after D
0:
1: A (head)
2: B
3: C
4: D
5:
6:
```

### Why ArrayDeque Is Efficient

Adding/removing from either end generally requires **only adjusting internal positions**. There is no need to shift all elements, as would happen when inserting/removing at the beginning of an `ArrayList`.

| Operation | Complexity |
| --- | --- |
| addFirst() / addLast() | O(1) amortized |
| pollFirst() / pollLast() | O(1) |
| peekFirst() / peekLast() | O(1) |

### Circular Buffer Concept

A useful mental model for `ArrayDeque` is a **circular array**. Suppose the array reaches its end — `[A][B][C][D][ ][ ]`. The next insertion doesn't necessarily need to move everything; the logical positions can **wrap around**: `[ ][ ][C][D][A][B]`.

The implementation uses modular/wraparound indexing to treat the array as circular. When the array becomes full, it grows.

### Why a Circular Structure?

Without circular indexing, repeatedly removing from the front could create unused space:

```flow-h Instead of shifting C and D, ArrayDeque moves its logical front position
[A][B][C][D][ ][ ]
: remove A, B
[ ][ ][C][D][ ][ ]
```

This keeps end operations efficient.

### ArrayDeque Growth

`ArrayDeque` is dynamically resizable. When there is insufficient space:

```flow-h
Current array
Create larger array
Copy elements
Continue operation
```

Occasional resizing costs **O(n)**, while ordinary insertion remains **amortized O(1)**.

> [!NOTE]
> The exact growth policy is implementation-specific and should not be confused with `ArrayList`'s approximately 1.5× rule.

### Why Doesn't ArrayDeque Allow null?

```java
Deque<String> deque = new ArrayDeque<>();

deque.offer(null);
```

```output
NullPointerException
```

**Why?** Because Deque methods such as `peek()` and `poll()` use `null` to represent **"no element available"**. Allowing `null` would make the result ambiguous.

## ArrayDeque vs LinkedList

Both implement `Deque`, but their internal structures differ: `ArrayDeque` → resizable array; `LinkedList` → doubly linked nodes.

| Feature | ArrayDeque | LinkedList |
| --- | --- | --- |
| Structure | Array-based | Doubly linked |
| End operations | O(1) amortized | O(1) |
| Memory overhead | Lower | Higher |
| Cache locality | Better | Worse |
| Null | ❌ Not allowed | ✅ Allowed |
| Thread-safe | ❌ No | ❌ No |
| Typical Deque choice | ✅ Usually | Usually not |

For a pure Queue/Deque workload, prefer `ArrayDeque` unless you have a specific reason to use `LinkedList`.

## Deque vs Stack

| Feature | Deque | Stack |
| --- | --- | --- |
| API | Modern | Legacy |
| Queue behaviour | ✅ Yes | ❌ No |
| Stack behaviour | ✅ Yes | ✅ Yes |
| Double-ended operations | ✅ Yes | ❌ No |
| Synchronization | Depends on implementation | Vector-based synchronization |
| Preferred for new code | ✅ Yes | ❌ No |

## Stack and Queue Operations Using Deque

### Stack (LIFO)

```java
Deque<Integer> stack = new ArrayDeque<>();
```

| Stack method | Equivalent Deque method |
| --- | --- |
| `push()` | `addFirst()` |
| `pop()` | `removeFirst()` |
| `peek()` | `peekFirst()` |

### Queue (FIFO)

Use `offerLast()`, `pollFirst()` and `peekFirst()`:

```java
Deque<Integer> queue = new ArrayDeque<>();

queue.offerLast(10);
queue.offerLast(20);
queue.offerLast(30);

System.out.println(queue.pollFirst());
```

```output
10
```

### Deque as Both

```tree One Deque can support either behaviour — one of its biggest advantages
Deque
  Queue — FIFO | offerLast() · pollFirst()
  Stack — LIFO | push() · pop()
```

## More Deque Operations

### descendingIterator()

```java
Deque<Integer> deque = new ArrayDeque<>();

deque.addLast(10);
deque.addLast(20);
deque.addLast(30);

Iterator<Integer> it = deque.descendingIterator();
```

```output
30
20
10
```

Useful when you need reverse traversal.

### removeFirstOccurrence() and removeLastOccurrence()

```java
deque.removeFirstOccurrence(20);   // removes the first matching occurrence
deque.removeLastOccurrence(20);    // removes the last matching occurrence
```

These operations require searching and are therefore generally **O(n)**.

### Deque Does Not Provide Random Access

You cannot do `deque.get(3);` like an `ArrayList`. `Deque` is designed around the **front + rear**, not arbitrary indexes.

## Time Complexity

For `ArrayDeque`:

| Operation | Complexity |
| --- | --- |
| addFirst() / addLast() | O(1) amortized |
| offerFirst() / offerLast() | O(1) amortized |
| removeFirst() / removeLast() | O(1) |
| pollFirst() / pollLast() | O(1) |
| peekFirst() / peekLast() | O(1) |
| contains() | O(n) |
| remove(Object) | O(n) |
| Iteration | O(n) |

## Real-World Use Cases

### Stack

- **Expression evaluation** — infix → postfix
- **Balanced parentheses** — `( [ { } ] )`
- **Undo operations** — Action 1, Action 2, Action 3 pushed onto a stack

### Queue

Task processing: **Request → Deque → Worker**.

### Sliding Window Algorithms

Deque is extremely useful for problems such as *"find the maximum value in every window of size K"*. A **monotonic deque** can solve this efficiently — a common coding-interview application.

### Palindrome Checking

Compare front ↔ rear using `pollFirst()` and `pollLast()`.

## Interview Scenarios

### Implement a stack without using Stack

```java
Deque<Integer> stack = new ArrayDeque<>();

stack.push(10);
stack.push(20);
stack.push(30);
stack.pop();   // 30
```

### Implement a FIFO Queue using Deque

```java
Deque<Integer> queue = new ArrayDeque<>();

queue.offerLast(10);
queue.offerLast(20);
queue.pollFirst();   // 10
```

### Insert/remove from both ends efficiently

```java
Deque<Integer> deque = new ArrayDeque<>();
```

### Coding pattern: reverse a sequence using Deque

```java
Deque<Integer> deque = new ArrayDeque<>();

deque.addLast(10);
deque.addLast(20);
deque.addLast(30);

while (!deque.isEmpty()) {
    System.out.println(deque.pollLast());
}
```

```output
30
20
10
```

The key operation is `pollLast()`.

## Common Interview Traps

| Claim | Verdict |
| --- | --- |
| "Deque is only a Queue." | ❌ Wrong — it supports both Queue and Stack semantics. |
| "ArrayDeque allows null." | ❌ Wrong — it rejects null. |
| "ArrayDeque is thread-safe." | ❌ Wrong — it is not synchronized. |
| "LinkedList is always better for Deque because insertion/removal is O(1)." | ⚠️ Incomplete — ArrayDeque also has efficient end operations and usually better memory locality and lower per-element overhead. |
| "ArrayDeque grows exactly like ArrayList." | ❌ Wrong — don't assume ArrayList's ~1.5× growth formula applies. |

## Frequently Asked Interview Questions

### Q1. What is Deque?

A double-ended queue that allows insertion and removal from both ends.

### Q2. Can Deque act as a Stack?

Yes — use `push()`, `pop()` and `peek()`.

### Q3. Can Deque act as a Queue?

Yes — for example `offerLast()`, `pollFirst()` and `peekFirst()`.

### Q4. Why is ArrayDeque preferred over Stack?

Because `Stack` is a legacy `Vector`-based class with synchronization overhead, while `ArrayDeque` is designed for efficient deque/stack operations.

### Q5. Why doesn't ArrayDeque allow null?

Because `null` is used as the special return value by methods such as `poll()` and `peek()` when the deque is empty.

### Q6. Is ArrayDeque thread-safe?

No.

### Q7. ArrayDeque vs LinkedList?

`ArrayDeque` is generally preferred for pure Queue/Deque workloads because it is array-backed, has lower per-element overhead, and typically has better cache locality.

### Q8. What is the complexity of addFirst/addLast?

O(1) amortized.

### Q9. Can ArrayDeque perform random access?

No.

### Q10. What is descendingIterator()?

It returns an iterator that traverses the Deque from rear to front.

## Decision Framework

| Need | Use | Methods |
| --- | --- | --- |
| Double-ended operations | `Deque` → `ArrayDeque` | `addFirst/Last`, `pollFirst/Last` |
| Stack | `Deque` → `ArrayDeque` | `push` / `pop` / `peek` |
| FIFO Queue | `Deque` → `ArrayDeque` | `offerLast` / `pollFirst` |
| Concurrent producer-consumer | **Don't use ArrayDeque** → `BlockingQueue` | `put` / `take` |

### Final Mental Model

```tree
Deque | add/remove at front and rear
  ArrayDeque
    Queue — FIFO | offerLast() · pollFirst() · peekFirst()
    Stack — LIFO | push() · pop() · peek()
```

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| Deque | Double-ended Queue |
| Insert | Both ends |
| Remove | Both ends |
| Queue behaviour | FIFO |
| Stack behaviour | LIFO |
| Preferred implementation | ArrayDeque |
| ArrayDeque structure | Resizable array |
| End operations | O(1) amortized |
| Random access | No |
| Null | Not allowed |
| Thread-safe | No |
| Reverse traversal | `descendingIterator()` |
| Main advantage | Efficient operations at both ends |

### Interview Readiness Checklist

- What is Deque?
- Why is it called a double-ended Queue?
- How can Deque implement a Stack?
- How can Deque implement a Queue?
- `addFirst()` vs `offerFirst()`?
- `removeFirst()` vs `pollFirst()`?
- `getFirst()` vs `peekFirst()`?
- Why is ArrayDeque preferred over Stack?
- ArrayDeque vs LinkedList?
- Why doesn't ArrayDeque allow null?
- Is ArrayDeque thread-safe?
- What is the circular-array concept?
- What is `descendingIterator()`?
- What are `removeFirstOccurrence()` and `removeLastOccurrence()`?
- What is the complexity of operations at both ends?
