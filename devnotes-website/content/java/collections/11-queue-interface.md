---
title: Queue Interface
subtitle: FIFO processing, the three method pairs (add/offer, remove/poll, element/peek), implementations and BlockingQueue.
order: 11
---

## Introduction

`Queue` is one of the core Collection interfaces and is heavily used in multithreading, messaging, task processing, BFS, scheduling and producer-consumer systems.

The most important thing to understand is:

> Queue normally follows **FIFO — First In, First Out** — but not every Queue implementation guarantees FIFO ordering.

That exception becomes important when we study `PriorityQueue`.

## What is Queue?

`Queue` represents a collection designed primarily for **holding elements before they are processed**.

Package:

```java
java.util.Queue
```

```tree Hierarchy
Iterable
  Collection
    Queue
      LinkedList
      PriorityQueue
      ArrayDeque
```

Some concurrent implementations (covered later) include `BlockingQueue`, `ArrayBlockingQueue`, `LinkedBlockingQueue` and `PriorityBlockingQueue`.

## FIFO Principle

The typical Queue behaviour is **First In, First Out**.

```flow-h head ← … ← tail
10 | head
20
30
40 | tail
```

Remove → `10` comes out. Then the queue is `20 → 30 → 40`. This is similar to a real-world queue at a counter.

### Queue Does NOT Always Mean FIFO

This is an important interview nuance. A normal FIFO Queue processes elements in insertion order, but implementations can use different ordering policies. For example, `PriorityQueue` orders elements according to their **priority/natural ordering** rather than insertion order.

> [!TIP]
> A stronger interview answer: *"Queue is designed for processing elements in some ordering policy; FIFO is the standard Queue behaviour, but implementations such as PriorityQueue can use priority ordering."*

## Core Queue Methods

`Queue` has three important method pairs. This is extremely important for interviews.

| Operation | Throws exception | Returns special value |
| --- | --- | --- |
| **Insert** | `add(e)` | `offer(e)` |
| **Remove** | `remove()` | `poll()` |
| **Inspect** | `element()` | `peek()` |

Easy memory trick: **add ↔ offer, remove ↔ poll, element ↔ peek**. The right-hand methods are generally safer when you want to handle failure without exceptions.

### add() vs offer()

Both attempt to insert an element:

```java
queue.add(10);
queue.offer(10);
```

The difference appears when insertion **cannot** be performed:

| Method | Failure behaviour |
| --- | --- |
| `add()` | Throws exception |
| `offer()` | Returns `false` |

For an unbounded Queue such as `LinkedList` or `ArrayDeque`, capacity failure normally isn't an issue. The distinction becomes especially useful with **bounded** queues.

### remove() vs poll()

Both remove the head. If the Queue is empty:

| Method | Empty queue |
| --- | --- |
| `remove()` | `NoSuchElementException` |
| `poll()` | `null` |

### element() vs peek()

Both inspect the head **without removing** it. If empty:

| Method | Empty queue |
| --- | --- |
| `element()` | `NoSuchElementException` |
| `peek()` | `null` |

### Basic Example

```java
Queue<String> queue = new LinkedList<>();

queue.offer("A");
queue.offer("B");
queue.offer("C");

System.out.println(queue.poll());
System.out.println(queue.peek());
```

```output
A
B
```

After `poll()` the queue is `B → C`.

### Queue Does Not Provide Index-Based Access

Unlike `List`, `Queue` doesn't provide `get(index)`. **Why?** Because Queue focuses on inserting, removing the head and inspecting the head — rather than positional access.

## Queue Implementations

The important implementations for interviews are `LinkedList`, `PriorityQueue` and `ArrayDeque` (and later, `BlockingQueue` implementations).

### LinkedList as Queue

Since `LinkedList` implements `Queue`:

```java
Queue<Integer> queue = new LinkedList<>();
```

You can use `offer()`, `poll()` and `peek()`. Internally, `LinkedList` can efficiently add/remove at its ends.

### ArrayDeque as Queue

`ArrayDeque` is usually a **better general-purpose Queue** than `LinkedList`.

```java
Queue<Integer> queue = new ArrayDeque<>();
```

Advantages:

- Array-based
- Efficient
- No node allocation per element
- Good cache locality
- No synchronization overhead

For ordinary single-threaded FIFO queues, `ArrayDeque` is often the preferred choice.

### ArrayDeque vs LinkedList

| Feature | ArrayDeque | LinkedList |
| --- | --- | --- |
| Internal structure | Resizable array/deque | Doubly linked list |
| Queue operations | Efficient | Efficient |
| Memory overhead | Lower | Higher |
| Cache locality | Better | Worse |
| Null elements | ❌ Not allowed | ✅ Allowed |
| Typical choice | Preferred | Useful when List behaviour is also needed |

> [!NOTE]
> `ArrayDeque` does not permit `null`, because `null` is used to represent an empty result for methods such as `poll()` / `peek()`.

### PriorityQueue

`PriorityQueue` is where many candidates make a mistake. **It is a Queue, but it is not FIFO.**

```java
Queue<Integer> queue = new PriorityQueue<>();

queue.offer(30);
queue.offer(10);
queue.offer(20);
```

The head is `10`, because the smallest element has the highest priority under natural ordering.

`PriorityQueue` uses a **binary heap** — by default a **min-heap**:

```tree The smallest element is at the head
10
  30
  20
```

We'll cover `PriorityQueue` in detail in its own chapter.

### Queue Ordering Comparison

| Implementation | Ordering |
| --- | --- |
| `LinkedList` | FIFO |
| `ArrayDeque` | FIFO |
| `PriorityQueue` | Priority |
| `BlockingQueue` variants | Depends on implementation |

### Queue with Custom Objects

```java
class Task {
    int priority;
    String name;
}
```

A priority-based Queue can use:

```java
Queue<Task> tasks = new PriorityQueue<>(Comparator.comparingInt(t -> t.priority));
```

Now tasks are processed according to the comparator. This is a common real-world pattern.

## Queue Use Cases

Queue is ideal when work must be **processed progressively**.

```flow
Task processing
Request 1 · Request 2 · Request 3
Queue
Worker
---
Messaging
Producer
Queue
Consumer
---
BFS
Start
Queue
Process level by level
---
Request buffering
Incoming Requests
Queue
Workers
```

### Producer-Consumer Pattern

A classic interview scenario: **Producer → Queue → Consumer**.

```java
// Producer
queue.offer(task);

// Consumer
Task task = queue.poll();
```

> [!WARNING]
> For multithreaded production systems, a regular `ArrayDeque` is not enough because it isn't thread-safe. Use a concurrent queue such as a `BlockingQueue`.

## BlockingQueue

`BlockingQueue` is part of `java.util.concurrent`. It extends `Queue` and adds **blocking** behaviour.

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);
```

```java
// Producer
queue.put(task);

// Consumer
Task task = queue.take();
```

| Situation | Behaviour |
| --- | --- |
| Queue is full | `put()` waits |
| Queue is empty | `take()` waits |

This makes `BlockingQueue` particularly useful for producer-consumer architectures.

### Method Families in Concurrent Queues

With bounded queues, the method choice becomes especially meaningful:

| Insert | Behaviour | Remove | Behaviour |
| --- | --- | --- | --- |
| `add()` | Exception on failure | `remove()` | Exception |
| `offer()` | `false` on failure | `poll()` | `null` |
| `put()` | Waits | `take()` | Waits |
| `offer(e, timeout)` | Waits up to timeout | `poll(timeout)` | Waits up to timeout |

This distinction is very useful in concurrency interviews.

## Queue vs Stack vs Deque vs List

### Queue vs Stack

**Interview favourite.**

```flow
Queue — FIFO
10 → 20 → 30
remove() → 10
---
Stack — LIFO
30 | top
20
10
pop() → 30
```

Modern Java generally uses `Deque` for stack behaviour rather than the legacy `Stack` class.

### Queue vs Deque

`Queue` normally focuses on **inserting at the tail** and **removing from the head**. `Deque` supports **both ends** (front and rear), so it can behave as a **Queue + Stack**.

```java
Deque<Integer> deque = new ArrayDeque<>();

// Queue
deque.offerLast(10);
deque.pollFirst();

// Stack
deque.push(10);
deque.pop();
```

### Queue vs List

| Feature | Queue | List |
| --- | --- | --- |
| Primary purpose | Processing order | Ordered collection |
| Index access | ❌ No | ✅ `get(index)` |
| Head operations | Core functionality | Not the focus |
| FIFO semantics | Common | No |

## Null Elements and Programming to the Interface

### Null Elements

This depends on the implementation:

| Implementation | Null allowed? |
| --- | --- |
| `LinkedList` | ✅ Yes |
| `ArrayDeque` | ❌ No |
| `PriorityQueue` | ❌ No |

```java
Queue<String> q = new LinkedList<>();
q.offer(null);   // allowed
```

**Important reason:** for methods such as `poll()` and `peek()`, `null` is used to indicate that the queue is empty.

### Queue is an Interface

Prefer programming to the interface:

```java
Queue<Task> queue = new ArrayDeque<>();
```

rather than:

```java
ArrayDeque<Task> queue = new ArrayDeque<>();
```

unless you specifically need `ArrayDeque`-only operations. This makes the implementation easier to replace.

## Time Complexity

| Operation | ArrayDeque | LinkedList | PriorityQueue |
| --- | --- | --- | --- |
| offer | O(1) amortized | O(1) | O(log n) |
| poll | O(1) | O(1) | O(log n) |
| peek | O(1) | O(1) | O(1) |
| contains | O(n) | O(n) | O(n) |

`PriorityQueue` has O(log n) insertion/removal because the heap may need reordering.

## Common Mistakes

- **"Queue always means FIFO."** Not universally — `PriorityQueue` uses priority ordering.
- **Using `remove()` without considering an empty Queue.** Safer alternative: `queue.poll()` when `null` is an acceptable empty indication.
- **Using `LinkedList` as the default Queue.** For a normal single-threaded Queue, `ArrayDeque` is generally a better choice.
- **Using `ArrayDeque` for a multi-threaded producer-consumer system.** It is not thread-safe — use an appropriate concurrent Queue, commonly a `BlockingQueue`.
- **Using `PriorityQueue` when you need insertion order.** `PriorityQueue` does not preserve FIFO ordering.

## Interview Scenarios

### Single-threaded FIFO task processing

**Best choice:**

```java
Queue<Task> queue = new ArrayDeque<>();
```

FIFO + efficient + low memory overhead + no synchronization needed.

### Multiple producers and consumers

The queue should wait when it is full (producer waits) or empty (consumer waits). Use a **`BlockingQueue<Task>`**, for example:

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);
```

### Repeatedly process the smallest value

Use **`PriorityQueue<Integer>`**, because it provides priority ordering.

### Quick interview test

```java
Queue<Integer> q = new ArrayDeque<>();

q.offer(10);
q.offer(20);
q.offer(30);

System.out.println(q.peek());
System.out.println(q.poll());
System.out.println(q.peek());
```

```output
10
10
20
```

Because `offer` adds at the tail, `peek` inspects the head, and `poll` removes the head.

## Frequently Asked Interview Questions

### Q1. What is Queue?

A Collection designed primarily for holding elements before processing, usually with FIFO semantics.

### Q2. What is FIFO?

First In, First Out.

### Q3. Difference between add() and offer()?

- `add()` → exception if insertion fails
- `offer()` → `false` if insertion fails

### Q4. Difference between remove() and poll()?

- `remove()` → exception if empty
- `poll()` → `null` if empty

### Q5. Difference between element() and peek()?

- `element()` → exception if empty
- `peek()` → `null` if empty

### Q6. Is PriorityQueue FIFO?

No. It orders elements according to priority.

### Q7. Which Queue implementation is generally preferred for ordinary FIFO behaviour?

`ArrayDeque`.

### Q8. Is LinkedList a Queue?

Yes. It implements `Deque`, which extends `Queue`.

### Q9. Is ArrayDeque thread-safe?

No.

### Q10. Which Queue should you use for producer-consumer communication?

Usually an appropriate `BlockingQueue`, depending on the requirements.

### Q11. Can Queue contain null?

Depends on the implementation. `LinkedList` allows it; `ArrayDeque` and `PriorityQueue` do not.

### Q12. What is the difference between Queue and Deque?

`Queue` primarily models one-ended insertion/removal behaviour, while `Deque` supports insertion and removal at both ends.

## Decision Framework

```flow
Need a Queue?
? Concurrent producer/consumer with blocking? | Yes: BlockingQueue | No: continue
: single-threaded
? Normal FIFO? | Yes: ArrayDeque | No (priority): PriorityQueue
```

### Final Mental Model

```tree
Queue
  ArrayDeque | FIFO · fast
  LinkedList | FIFO · flexible
  PriorityQueue | Priority · heap
```

For modern Java:

| Need | Use |
| --- | --- |
| Normal queue | `ArrayDeque` |
| Concurrent producer/consumer | `BlockingQueue` |
| Priority processing | `PriorityQueue` |

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| Queue | Holds elements for processing |
| Typical behaviour | FIFO |
| `add()` | Insert, exception on failure |
| `offer()` | Insert, special-value failure |
| `remove()` | Remove head, exception if empty |
| `poll()` | Remove head, null if empty |
| `element()` | Inspect head, exception if empty |
| `peek()` | Inspect head, null if empty |
| ArrayDeque | Preferred general-purpose FIFO Queue |
| LinkedList | Queue + Deque + List |
| PriorityQueue | Priority ordering |
| BlockingQueue | Concurrent producer-consumer use |
| Thread-safe? | Depends on implementation |

### Interview Readiness Checklist

- What is Queue?
- What does FIFO mean?
- Why doesn't PriorityQueue follow FIFO?
- `add()` vs `offer()`?
- `remove()` vs `poll()`?
- `element()` vs `peek()`?
- ArrayDeque vs LinkedList?
- Queue vs Deque?
- Queue vs Stack?
- Why is ArrayDeque preferred over LinkedList for ordinary queues?
- Why can't ArrayDeque contain null?
- What is BlockingQueue?
- Which collection would you use for producer-consumer architecture?
- Which collection would you use for priority-based processing?
