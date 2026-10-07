---
title: TreeSet
subtitle: Sorted, navigable sets on a Red-Black Tree — Comparable vs Comparator, compare() == 0 duplicates, and floor/ceiling/range views.
order: 10
---

## Introduction

`TreeSet` is the Set implementation to know when the requirement is:

> **Unique elements + sorted order + range/navigation operations**

Unlike `HashSet` and `LinkedHashSet`, `TreeSet` does **not** use hashing. Its core is a **balanced Red-Black Tree**.

## What is TreeSet?

`TreeSet` is a **sorted** implementation of the `Set` interface.

Package:

```java
java.util.TreeSet
```

Declaration:

```java
public class TreeSet<E>
        extends AbstractSet<E>
        implements NavigableSet<E>,
                   Cloneable,
                   Serializable
```

```flow The important interfaces are SortedSet and NavigableSet — they add functionality beyond a normal Set
Iterable
Collection
Set
SortedSet
NavigableSet
TreeSet
```

## Key Characteristics

| Property | TreeSet |
| --- | --- |
| Duplicates | ❌ Not allowed |
| Ordering | Sorted |
| Index-based access | ❌ No |
| Typical operations | O(log n) |
| Internal structure | Red-Black Tree |
| Null | Generally not supported |
| Thread-safe | ❌ No |
| Range operations | ✅ Yes |
| Navigation | ✅ Yes |

## The Main Difference from HashSet

| Set | Gives you |
| --- | --- |
| `HashSet` | Uniqueness + fast lookup |
| `LinkedHashSet` | Uniqueness + insertion order |
| `TreeSet` | Uniqueness + **sorted order** |

```java
Set<Integer> set = new TreeSet<>();

set.add(50);
set.add(10);
set.add(40);
set.add(20);
```

```output
10
20
40
50
```

The elements are automatically ordered.

## How Does TreeSet Maintain Order?

This is the key internal concept. `TreeSet` uses a tree-based structure backed by **`TreeMap`**.

```flow-h TreeSet stores its elements as keys in the underlying sorted map
TreeSet
TreeMap
Red-Black Tree
```

### Why a Red-Black Tree?

A normal Binary Search Tree can become **unbalanced**. Inserting `10, 20, 30, 40` in order makes it effectively a linked list, and search becomes **O(n)**:

```flow-h Unbalanced BST
10
20
30
40
```

A Red-Black Tree automatically maintains approximate balance, so the height remains **O(log n)**:

```tree Balanced
20
  10
  30
    40
```

Therefore search, insert and delete are all **O(log n)**.

### What is a Red-Black Tree?

A Red-Black Tree is a **self-balancing Binary Search Tree** with additional colour information. Each node conceptually holds:

```flow-h One node
Key
Left
Right
Parent
Color | RED or BLACK
```

The colouring rules ensure the tree doesn't become excessively unbalanced. You don't need to memorize the complete balancing algorithm unless specifically asked, but you should understand **why it exists**.

## TreeSet Ordering

There are two ways to define ordering.

### 1. Natural ordering — Comparable

```java
TreeSet<Integer> set = new TreeSet<>();
```

`Integer` already implements `Comparable`.

### 2. Custom ordering — Comparator

```java
TreeSet<Integer> set = new TreeSet<>(Comparator.reverseOrder());
```

```output
50
40
30
20
10
```

### Comparable vs Comparator

This is a major interview topic.

**Comparable** — the class defines its own natural ordering:

```java
class Employee implements Comparable<Employee> {

    @Override
    public int compareTo(Employee other) {
        return Integer.compare(this.id, other.id);
    }
}
```

```java
TreeSet<Employee> employees = new TreeSet<>();
```

**Comparator** — ordering is supplied externally:

```java
Comparator<Employee> byName = Comparator.comparing(Employee::getName);

TreeSet<Employee> employees = new TreeSet<>(byName);
```

### Natural Ordering Example

```java
TreeSet<String> set = new TreeSet<>();

set.add("Zebra");
set.add("Apple");
set.add("Mango");
set.add("Banana");
```

```output
Apple
Banana
Mango
Zebra
```

Strings use their natural ordering.

## How TreeSet Detects Duplicates

### TreeSet Doesn't Use equals() to Determine Uniqueness

This is one of the **most important** TreeSet interview questions. For ordering and duplicate determination, `TreeSet` uses `compareTo()` or `Comparator.compare()`.

If `compare(a, b) == 0`, `TreeSet` treats them as **equivalent** for Set purposes, so the element is not added as a separate entry.

```java
TreeSet<Integer> set = new TreeSet<>();

set.add(10);
set.add(10);
```

The second `10` isn't added because `compare(10, 10) == 0`.

### The Big Difference: HashSet vs TreeSet

```flow
HashSet
hashCode() + equals()
Uniqueness
---
TreeSet
compareTo() / Comparator.compare()
Ordering + uniqueness
```

This distinction explains most TreeSet interview questions.

### Dangerous Comparator Example

```java
class Employee {
    int id;
    String name;
}
```

```java
Comparator<Employee> comparator = Comparator.comparing(Employee::getName);
```

Now `Employee 101 → John` and `Employee 102 → John`: the comparator returns `0`, so `TreeSet` considers them equivalent. **Only one may be stored — even though their IDs differ.**

> [!IMPORTANT]
> Your ordering should normally be **consistent with equality**: `compare(a, b) == 0` should correspond to `a.equals(b) == true`. If they are inconsistent, TreeSet still operates according to the comparator, but its Set behaviour may surprise you.

## NavigableSet Methods

`TreeSet` implements `NavigableSet`, which gives us powerful navigation methods. These are frequently asked in interviews.

```java
TreeSet<Integer> set = new TreeSet<>(Arrays.asList(10, 20, 30, 40));
```

### lower()

Returns the greatest element **strictly less** than the given element.

```java
set.lower(30);   // 20
```

### floor()

Returns the greatest element **less than or equal** to the given element.

```java
set.floor(30);   // 30
set.floor(35);   // 30
```

### higher()

Returns the smallest element **strictly greater** than the given element.

```java
set.higher(30);   // 40
```

### ceiling()

Returns the smallest element **greater than or equal** to the given element.

```java
set.ceiling(30);   // 30
set.ceiling(35);   // 40
```

### Easy Way to Remember

For `10 20 30 40`, around `30`:

| Method | Rule | Result |
| --- | --- | --- |
| `lower(30)` | < target | 20 |
| `floor(30)` | <= target | 30 |
| `ceiling(30)` | >= target | 30 |
| `higher(30)` | > target | 40 |

### first() and last()

Return the smallest and largest elements. For `10, 20, 30, 40`: `first()` → `10`, `last()` → `40`. Complexity: O(log n).

### pollFirst() and pollLast()

Unlike `first()` and `last()`, these **remove** the element. `set.pollFirst()` removes the smallest; `set.pollLast()` removes the largest.

## Range Views

One of `TreeSet`'s biggest advantages over `HashSet`: `subSet()`, `headSet()`, `tailSet()`.

```java
TreeSet<Integer> set = new TreeSet<>(Arrays.asList(10, 20, 30, 40, 50));
```

### subSet()

```java
set.subSet(20, 50);   // 20, 30, 40
```

By default: **from → inclusive**, **to → exclusive**. You can control the boundaries explicitly:

```java
set.subSet(20, true, 50, true);   // 20, 30, 40, 50
```

### headSet()

Returns elements **before** a specified point. By default the point is excluded:

```java
set.headSet(30);         // 10, 20
set.headSet(30, true);   // 10, 20, 30
```

### tailSet()

Returns elements **from** a specified point onward. By default the point is included:

```java
set.tailSet(30);   // 30, 40, 50
```

### Range Methods Return Views

This is an excellent interview question.

```java
NavigableSet<Integer> subset = set.subSet(20, 50);
```

The subset is generally a **view backed by the original TreeSet**, not an independent copy. Changes to the view can affect the original Set, subject to the range restrictions.

## Null Handling

Generally, `TreeSet` does **not** allow `null` when using natural ordering.

```java
TreeSet<Integer> set = new TreeSet<>();

set.add(null);
```

```output
NullPointerException
```

**Why?** The tree needs to compare elements to determine their position. There is no natural ordering between `null` and an `Integer`.

### Can TreeSet Store Null with a Comparator?

Potentially yes, if the supplied comparator explicitly defines how `null` should be ordered:

```java
TreeSet<String> set = new TreeSet<>(
        Comparator.nullsFirst(Comparator.naturalOrder())
);
```

Now `null` can be ordered before non-null values.

> [!NOTE]
> "TreeSet does not allow null" is a good default statement for natural ordering, but a suitable `Comparator` can define null ordering.

## Custom Objects

```java
class Employee {
    int id;
    String name;
}
```

This will not work automatically:

```java
TreeSet<Employee> set = new TreeSet<>();

set.add(new Employee());
```

unless `Employee` provides natural ordering or the `TreeSet` has a `Comparator`. Otherwise Java cannot compare Employee A vs Employee B, and a comparison-related exception (`ClassCastException`) can occur.

### Using Comparable

```java
class Employee implements Comparable<Employee> {

    int id;

    Employee(int id) {
        this.id = id;
    }

    @Override
    public int compareTo(Employee other) {
        return Integer.compare(this.id, other.id);
    }
}
```

```java
TreeSet<Employee> employees = new TreeSet<>();

employees.add(new Employee(103));
employees.add(new Employee(101));
employees.add(new Employee(102));
```

```output
101
102
103
```

### Using Comparator

You don't need to modify `Employee`:

```java
TreeSet<Employee> employees = new TreeSet<>(Comparator.comparingInt(e -> e.id));
```

This is often preferable when you need different sorting strategies — by ID, by name, by salary, by joining date — each with a different `Comparator`.

### TreeSet and Mutable Objects

Another advanced interview trap. Suppose the ordering depends on `employee.salary`. You insert the Employee, then later:

```java
employee.salary = 900000;
```

The object's ordering key changed, but the tree structure wasn't automatically rebuilt. Now operations may behave unexpectedly.

> [!WARNING]
> Don't mutate fields that determine ordering while the object is stored in a TreeSet.

## Thread Safety and Performance

### Thread Safety

`TreeSet` is **not** thread-safe. For synchronized access:

```java
SortedSet<Integer> set = Collections.synchronizedSortedSet(new TreeSet<>());
```

For concurrent sorted collections, Java provides specialized options such as **`ConcurrentSkipListSet`**.

### Performance

| Operation | Complexity |
| --- | --- |
| add() | O(log n) |
| remove() | O(log n) |
| contains() | O(log n) |
| first() / last() | O(log n) |
| lower() / floor() | O(log n) |
| ceiling() / higher() | O(log n) |
| iteration | O(n) |

`TreeSet` sacrifices `HashSet`'s average O(1) lookup in exchange for sorted order and navigation.

### HashSet vs LinkedHashSet vs TreeSet

| Feature | HashSet | LinkedHashSet | TreeSet |
| --- | --- | --- | --- |
| Duplicates | No | No | No |
| Ordering | None guaranteed | Insertion | Sorted |
| Internal structure | Hash table | Hash table + links | Red-Black Tree |
| Typical add | O(1) | O(1) | O(log n) |
| contains | O(1) avg | O(1) avg | O(log n) |
| Range operations | No | No | Yes |
| Navigation | No | No | Yes |
| Null | One | One | Generally no |
| Memory | Lower | Higher | Tree-node overhead |

## When to Use TreeSet

Use `TreeSet` when you need **unique elements + sorted order + navigation/range queries**.

| Example | Type / method |
| --- | --- |
| Sorted scores | `TreeSet<Integer> scores;` |
| Sorted timestamps | `TreeSet<Instant> timestamps;` |
| Range queries | All values between 100 and 500 → `subSet()` |
| Nearest-value lookup | Smallest value >= X → `ceiling()` |

### When NOT to Use TreeSet

| You need | Use instead |
| --- | --- |
| Only uniqueness + fast lookup | `HashSet` |
| Insertion order | `LinkedHashSet` |
| Duplicates | `List` |
| Queue / stack behaviour | `ArrayDeque` |

## Interview Scenarios

### Employee salaries

You need no duplicates, sorted salaries, and the next salary greater than 500,000.

**Best choice:** `TreeSet<Integer> salaries;` then `salaries.higher(500000);`

### Millions of IDs

Unique IDs, fast membership check, no ordering → **`HashSet<Long>`**, not `TreeSet`.

### Transaction IDs

Remove duplicates and preserve first-seen order → **`LinkedHashSet<Long>`**, not `TreeSet`.

### Quick coding question: what is the output?

```java
TreeSet<Integer> set = new TreeSet<>();

set.add(10);
set.add(20);
set.add(30);
set.add(40);

System.out.println(set.lower(25));
System.out.println(set.floor(20));
System.out.println(set.ceiling(25));
System.out.println(set.higher(30));
```

```output
20
20
30
40
```

### Tricky coding question: what happens?

```java
TreeSet<String> set = new TreeSet<>(Comparator.comparingInt(String::length));

set.add("Java");
set.add("Code");
set.add("Spring");
```

`"Java"` and `"Code"` have the same length, so the comparator returns `0` for them. `TreeSet` considers them equivalent for Set purposes. The result contains only one of those equal-length strings (the first one added, `"Java"`) plus `"Spring"`. A classic interview trap.

## Common Interview Traps

| Claim | Verdict |
| --- | --- |
| "TreeSet uses `hashCode()` to detect duplicates." | ❌ Wrong — it uses `compareTo()` or `Comparator.compare()`. |
| "TreeSet always allows null." | ❌ Wrong — natural ordering generally doesn't support null; a Comparator can define null ordering. |
| "TreeSet preserves insertion order." | ❌ Wrong — it preserves **sorted** order. |
| "TreeSet is faster than HashSet." | ❌ Generally wrong — HashSet is O(1) average; TreeSet is O(log n) but offers sorting and navigation. |
| "`compareTo() == 0` always means `equals() == true`." | ❌ Not necessarily — but if the comparator returns zero, TreeSet treats the elements as equivalent. |

## Frequently Asked Interview Questions

### Q1. How does TreeSet work internally?

It uses a balanced tree-based structure, specifically a Red-Black Tree through `TreeMap` infrastructure.

### Q2. Why is TreeSet O(log n)?

Because the Red-Black Tree maintains logarithmic height.

### Q3. How does TreeSet determine duplicates?

If comparison returns zero (`compareTo() == 0` or `Comparator.compare() == 0`), TreeSet treats the elements as equivalent for Set purposes.

### Q4. Does TreeSet use equals()?

`equals()` is not the primary mechanism for ordering/duplicate determination. The comparator or natural ordering determines equivalence.

### Q5. What happens if objects don't implement Comparable?

If no `Comparator` is supplied, TreeSet cannot establish natural ordering and insertion can fail with a comparison-related exception.

### Q6. What is the difference between lower() and floor()?

- `lower(x)` → greatest element < x
- `floor(x)` → greatest element <= x

### Q7. Difference between higher() and ceiling()?

- `higher(x)` → smallest element > x
- `ceiling(x)` → smallest element >= x

### Q8. What is the difference between first() and pollFirst()?

- `first()` returns the smallest element and does not remove it.
- `pollFirst()` returns the smallest element and removes it.

### Q9. What is the difference between TreeSet and HashSet?

`HashSet` optimizes for fast average lookup without ordering. `TreeSet` provides sorted ordering and navigation at O(log n).

### Q10. Can TreeSet store custom objects?

Yes, if they implement `Comparable`, or a compatible `Comparator` is provided.

## Decision Framework

```flow When choosing a Set
Need uniqueness?
: yes
? Need sorted order? | Yes: TreeSet | No: Need insertion order? | → Yes: LinkedHashSet | → No: HashSet
```

### Final Mental Model

```tree
Set
  HashSet | hashing · no ordering
  LinkedHashSet | hashing · insertion order
  TreeSet | ordering · sorted order
    Red-Black Tree | O(log n) operations
      NavigableSet | lower / floor / ceiling / higher
```

## Chapter Summary

| Concept | TreeSet |
| --- | --- |
| Interface | NavigableSet |
| Duplicates | Not allowed |
| Ordering | Sorted |
| Internal structure | Red-Black Tree |
| Backing infrastructure | TreeMap |
| add() | O(log n) |
| contains() | O(log n) |
| remove() | O(log n) |
| Navigation | Yes |
| Range queries | Yes |
| Natural ordering | Comparable |
| Custom ordering | Comparator |
| Null | Generally unsupported with natural ordering |
| Thread-safe | No |

### Interview Readiness Checklist

- Why does TreeSet use a Red-Black Tree?
- How does TreeSet determine duplicates?
- TreeSet vs HashSet?
- TreeSet vs LinkedHashSet?
- Comparable vs Comparator?
- What happens when `compareTo()` returns 0?
- Why can TreeSet reject null?
- What are `lower()`, `floor()`, `ceiling()` and `higher()`?
- Difference between `first()` and `pollFirst()`?
- What are `subSet()`, `headSet()` and `tailSet()`?
- Why are TreeSet operations O(log n)?
- What happens if a TreeSet's ordering field is mutated?
- Why can two objects that are not `equals()` be treated as duplicates by TreeSet?
