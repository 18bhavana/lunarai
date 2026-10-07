---
title: PriorityQueue
subtitle: Priority-ordered processing on a binary min-heap — sift-up, sift-down, max-heaps, custom priorities and Top-K patterns.
order: 13
---

## Introduction

`PriorityQueue` is one of the most important Queue implementations for interviews because it introduces a completely different concept:

> The head is determined by **priority**, not insertion order.

Internally, `PriorityQueue` uses a **binary heap**, specifically a **min-heap** by default.

## What is PriorityQueue?

Package:

```java
java.util.PriorityQueue
```

Declaration:

```java
public class PriorityQueue<E>
        extends AbstractQueue<E>
        implements Serializable
```

Key characteristics:

- Allows duplicate elements
- Does not allow null
- Not thread-safe
- Default ordering is natural ordering
- Custom ordering can be supplied using a `Comparator`
- The head contains the highest-priority element
- Default priority = smallest element
- Internally uses a binary heap

## PriorityQueue Is Not FIFO

This is the first thing to remember. A normal Queue with `10 → 20 → 30` returns `10` from `poll()` because it was inserted first. A `PriorityQueue`:

```java
Queue<Integer> queue = new PriorityQueue<>();

queue.offer(30);
queue.offer(10);
queue.offer(20);
```

The head is `10` because 10 has the highest priority under natural ordering. So **insertion order ≠ processing order**.

### Default Priority

For numbers, the **smallest number has the highest priority**.

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();

pq.offer(50);
pq.offer(10);
pq.offer(30);
pq.offer(20);
```

Repeated `poll()`:

```output
10
20
30
50
```

This behaves like a **min-priority queue**.

## Internal Structure — Binary Heap

`PriorityQueue` is backed by an **array representing a complete binary tree**.

```tree Min-heap property: Parent <= Children, so the smallest element is always at the root
10
  20
    50
    40
  30
```

### Array Representation

The tree above is represented in an array as:

```array
0: 10
1: 20
2: 30
3: 50
4: 40
```

This is why `PriorityQueue` doesn't need separate `Node` objects like `LinkedList`.

### Why a Complete Binary Tree?

A heap must be a **complete binary tree**:

- Every level is completely filled except possibly the last.
- The last level is filled from left to right.

This makes the tree compact and efficiently representable using an array.

### Parent/Child Index Formula

For an element at index `i`:

| Relation | Formula |
| --- | --- |
| Parent | `(i - 1) / 2` |
| Left child | `2 * i + 1` |
| Right child | `2 * i + 2` |

Example: index `0` → left = 1, right = 2. Index `1` → parent = 0, left = 3, right = 4. These formulas are frequently asked in coding interviews.

## offer() and Sift-Up

```java
pq.offer(5);
```

```flow This is called Sift Up (or Bubble Up)
New element
Place at end of heap
Compare with parent
? Parent larger? | Yes: Swap and continue upward | No: Done
```

### Sift-Up Example

Heap is `10 → (20, 30)`. Insert `5`:

```flow
Initially
10 | children: 20, 30
20 | child: 5
: 5 < 20 → swap
After first swap
10 | children: 5, 30
5 | child: 20
: 5 < 10 → swap
Heap restored
5 | children: 10, 30
10 | child: 20
```

### Complexity of offer()

The new element may move from the bottom to the root. Heap height is **O(log n)**, therefore `offer()` → **O(log n)**.

## peek()

```java
pq.peek();
```

The smallest element is always at the root (array index `0`). Therefore `peek()` → **O(1)**. No restructuring is necessary.

## poll() and Sift-Down

This is one of the most important PriorityQueue questions.

```tree Heap before poll()
10
  20
    40
    50
  30
```

`poll()` removes `10`. The **last element** (`50`) is moved to the root:

```tree Heap property is now violated
50
  20
    40
  30
```

Java performs **sift down**: swap with the smaller child until the heap property is restored.

```flow
50 at root | children 20, 30
: smallest child is 20 → swap
20 at root | 50 now has child 40
: 50 > 40 → swap
Heap restored | 20 → (40, 30), 40 → (50)
```

Therefore `poll()` → **O(log n)**.

## Complexity Table

| Operation | Complexity |
| --- | --- |
| peek() | O(1) |
| offer() / add() | O(log n) |
| poll() / remove() | O(log n) — head removal |
| contains() | O(n) |
| remove(Object) | O(n) |
| size() | O(1) |

The key operations: **peek → O(1)**, **offer → O(log n)**, **poll → O(log n)**.

## Iteration Is Not Sorted

### Important Trap

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();

pq.offer(30);
pq.offer(10);
pq.offer(20);
pq.offer(5);
```

Don't assume this prints `5, 10, 20, 30`:

```java
for (Integer x : pq) {
    System.out.println(x);
}
```

It is **not guaranteed** to iterate in sorted order. The heap guarantees the correct **head**, not sorted iteration.

### How to Get Elements in Priority Order

Use repeated `poll()`:

```java
while (!pq.isEmpty()) {
    System.out.println(pq.poll());
}
```

```output
5
10
20
30
```

> [!IMPORTANT]
> `peek` / `poll` → priority order. The iterator → no sorted-order guarantee.

### PriorityQueue vs Sorted Collection

Don't confuse `PriorityQueue` with `TreeSet`. `PriorityQueue` guarantees the highest-priority element at the head; it does **not** maintain all elements in globally sorted iteration order. `TreeSet` maintains sorted ordering of its elements.

## PriorityQueue vs TreeSet

| Feature | PriorityQueue | TreeSet |
| --- | --- | --- |
| Duplicates | Allowed | Not allowed |
| Ordering | Head priority | Entire set sorted |
| Internal structure | Binary heap | Red-Black Tree |
| peek() / first() | O(1) | O(log n) typically |
| Insert | O(log n) | O(log n) |
| Remove head/min | O(log n) | O(log n) |
| Random access | No | No |
| Null | No | Generally no |

Use `PriorityQueue` when you mainly care about **repeatedly processing the next highest-priority item**.

## Custom Priority

### Reverse Order — Max-Heap

By default the smallest element has the highest priority, but you can reverse it:

```java
PriorityQueue<Integer> pq = new PriorityQueue<>(Comparator.reverseOrder());
```

Now repeated `poll()` returns `50, 40, 30, 20, 10` — the largest number has the highest priority. This effectively creates a **max-priority queue**.

```java
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());

maxHeap.offer(10);
maxHeap.offer(50);
maxHeap.offer(20);

System.out.println(maxHeap.poll());
```

```output
50
```

### Custom Objects

```java
class Task {
    int priority;
    String name;

    Task(int priority, String name) {
        this.priority = priority;
        this.name = name;
    }
}
```

```java
PriorityQueue<Task> tasks = new PriorityQueue<>(Comparator.comparingInt(t -> t.priority));

tasks.offer(new Task(3, "Email"));
tasks.offer(new Task(1, "Payment"));
tasks.offer(new Task(2, "Report"));
```

Processing order (assuming a smaller priority number means higher priority):

```output
Payment
Report
Email
```

### Multiple Sorting Conditions

A very common interview requirement: order by **priority**, and if the priority is the same, by **timestamp**.

```java
PriorityQueue<Task> queue = new PriorityQueue<>(
        Comparator
                .comparingInt((Task t) -> t.priority)
                .thenComparing(t -> t.timestamp)
);
```

This allows sophisticated scheduling policies.

## Duplicates, Null and Capacity

### Duplicates

Unlike `Set`, **PriorityQueue allows duplicates**:

```java
pq.offer(10);
pq.offer(10);
pq.offer(10);
```

All three elements remain. This is an important difference from `TreeSet`.

### Null Elements

`PriorityQueue` does **not** permit `null`:

```java
pq.offer(null);
```

```output
NullPointerException
```

**Why?** The queue needs to compare elements according to natural ordering or the supplied `Comparator`, and `null` does not have a natural ordering by itself.

### Initial Capacity

```java
PriorityQueue<Integer> pq = new PriorityQueue<>(100);
```

This controls the **initial backing-array capacity**. It does not mean 100 elements are inserted — it's simply storage capacity.

### Does PriorityQueue Grow?

Yes. It uses a dynamically growing array. When the backing array becomes full: **current array → grow → copy elements → continue**. The exact growth strategy is implementation-specific — don't apply `ArrayList`'s growth formula here.

## Thread Safety

### PriorityQueue Is Not Thread-Safe

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
```

is **not** thread-safe. If multiple threads need concurrent priority-queue behaviour, Java provides **`PriorityBlockingQueue`** from `java.util.concurrent`.

### PriorityBlockingQueue

```java
BlockingQueue<Task> queue = new PriorityBlockingQueue<>();
```

It combines **priority ordering + BlockingQueue semantics**.

> [!NOTE]
> `PriorityBlockingQueue` is **unbounded** by design.

## Real-World Use Cases

| Use case | How PriorityQueue helps |
| --- | --- |
| Task scheduling | Critical tasks → high priority → normal tasks |
| Hospital / support tickets | Emergency → High → Medium → Low: process the most important item first |
| Dijkstra's algorithm | Repeatedly select the node with the smallest tentative distance |
| A* search | Select the node with the smallest estimated total cost |
| Top-K problems | K largest, K smallest, top K frequent, K closest points |

## Top-K Problems

Extremely important for coding interviews.

### Top-K Largest Example

Input `10, 40, 20, 50, 30`; need the **top 3 largest**. A common strategy is to maintain a **min-heap of size K**:

- Process elements one by one.
- If the new element is larger than the smallest heap element: remove the smallest, insert the new element.
- At the end, the heap contains the top 3 candidates.

Complexity: **O(n log k)** — much better than sorting all n elements when k is small.

### Why a Min-Heap for Top-K Largest?

Suppose K = 3 and we currently keep `50, 40, 30`. The smallest among our current top 3 is `30`. If `45` arrives: `45 > 30`, so remove `30` and insert `45` → now `50, 45, 40`.

The root always represents the **weakest member** of the current Top-K set, which makes replacement efficient.

### Coding Pattern — K Largest Elements

```java
PriorityQueue<Integer> minHeap = new PriorityQueue<>();

for (int n : numbers) {
    minHeap.offer(n);
    if (minHeap.size() > k) {
        minHeap.poll();
    }
}

// minHeap now contains the K largest elements
```

Complexity **O(n log k)**, space **O(k)**. This is an extremely useful pattern to remember.

### Coding Pattern — K Smallest Elements

Use a **max-heap of size K**. The largest among the current K smallest elements stays at the root. If a smaller value arrives, remove the largest and insert the smaller one. Complexity **O(n log k)** — the opposite of the Top-K Largest pattern.

## PriorityQueue vs ArrayDeque vs LinkedList

### PriorityQueue vs ArrayDeque

| Feature | PriorityQueue | ArrayDeque |
| --- | --- | --- |
| Ordering | Priority | FIFO / deque order |
| Internal structure | Binary heap | Resizable array/deque |
| peek() returns | Highest priority | Front |
| offer() | O(log n) | O(1) amortized |
| poll() | O(log n) | O(1) |
| Duplicates | Yes | Yes |
| Null | No | No |

### PriorityQueue vs LinkedList

| Feature | PriorityQueue | LinkedList |
| --- | --- | --- |
| Normal FIFO | ❌ No | ✅ Yes |
| Priority ordering | ✅ Yes | ❌ No |
| Structure | Heap | Doubly linked list |
| peek() | O(1) | O(1) |
| poll() | O(log n) | O(1) |
| Duplicates | Yes | Yes |
| Null | ❌ No | ✅ Yes |

Choose based on ordering requirements.

## Common Interview Traps

| Claim | Verdict |
| --- | --- |
| "PriorityQueue maintains all elements in sorted order." | ❌ No — only the head is guaranteed to have the highest priority. |
| "PriorityQueue follows FIFO." | ❌ No — it follows its priority ordering. |
| "peek() is O(log n)." | ❌ No — the root is directly available: O(1). |
| "poll() is O(1)." | ❌ No — after removing the root, heap restructuring may be necessary: O(log n). |
| "PriorityQueue doesn't allow duplicates." | ❌ Wrong — duplicates are allowed. |
| "PriorityQueue is thread-safe." | ❌ Wrong — use `PriorityBlockingQueue` for concurrent/blocking use cases. |

## Frequently Asked Interview Questions

### Q1. What is PriorityQueue?

A Queue implementation that processes elements according to priority rather than normal FIFO insertion order.

### Q2. What data structure does PriorityQueue use internally?

A binary heap stored in an array.

### Q3. What is the default heap?

Min-heap. The smallest element has the highest priority.

### Q4. What is the complexity of peek()?

O(1).

### Q5. What is the complexity of offer()?

O(log n).

### Q6. What is the complexity of poll()?

O(log n).

### Q7. Does PriorityQueue allow duplicates?

Yes.

### Q8. Does PriorityQueue allow null?

No.

### Q9. How do you create a max-heap?

```java
PriorityQueue<Integer> pq = new PriorityQueue<>(Comparator.reverseOrder());
```

### Q10. Does iterating over PriorityQueue produce sorted output?

No. Use repeated `poll()` if you need elements processed in priority order.

### Q11. What is a heap?

A complete binary tree satisfying a heap-order property.

### Q12. Why is PriorityQueue efficient?

The heap keeps the highest-priority element at the root while maintaining O(log n) insertion and removal.

### Q13. What is PriorityBlockingQueue?

A concurrent, blocking-capable priority queue implementation.

### Quick test: what is the output?

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();

pq.offer(40);
pq.offer(10);
pq.offer(30);
pq.offer(20);

System.out.println(pq.peek());
System.out.println(pq.poll());
System.out.println(pq.poll());
```

```output
10
10
20
```

### Tricky question: can you guarantee System.out.println(pq) prints [10, 20, 30]?

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();

pq.add(30);
pq.add(10);
pq.add(20);

System.out.println(pq);
```

**No.** The `toString()` / iterator view does not guarantee sorted order. If you need priority order:

```java
while (!pq.isEmpty()) {
    System.out.println(pq.poll());
}
```

## Decision Framework

```flow
Need a Queue?
? Need FIFO? | Yes: ArrayDeque | No — need priority: PriorityQueue
: concurrent?
Priority + concurrency | PriorityBlockingQueue
```

### Final Mental Model

```flow
PriorityQueue
Binary Heap
Array Storage
? Operation | peek(): O(1) — root element | poll(): O(log n) — remove root, sift down | offer(): O(log n) — add at end, sift up
```

The three operations to memorize: **peek() → O(1)**, **offer() → O(log n)**, **poll() → O(log n)**.

## Chapter Summary

| Concept | PriorityQueue |
| --- | --- |
| Type | Queue |
| Ordering | Priority |
| Default priority | Smallest element |
| Internal structure | Binary heap |
| Heap type | Min-heap by default |
| Storage | Resizable array |
| peek() | O(1) |
| offer() | O(log n) |
| poll() | O(log n) |
| Duplicates | Allowed |
| Null | Not allowed |
| Thread-safe | No |
| Max-heap | `Comparator.reverseOrder()` |
| Sorted iteration | No |
| Priority processing | Yes |
| Concurrent alternative | PriorityBlockingQueue |

### Interview Readiness Checklist

- Why PriorityQueue is not FIFO
- What a binary heap is
- Min-heap vs max-heap
- How `offer()` works
- What sift-up means
- How `poll()` works
- What sift-down means
- Why `peek()` is O(1)
- Why `poll()` is O(log n)
- Why iteration isn't sorted
- How to create a max-heap
- How duplicates behave
- Why null isn't allowed
- PriorityQueue vs TreeSet
- PriorityQueue vs ArrayDeque
- How PriorityQueue solves Top-K problems
- What PriorityBlockingQueue is
