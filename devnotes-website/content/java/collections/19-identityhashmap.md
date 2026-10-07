---
title: IdentityHashMap
subtitle: A Map that compares keys with == instead of equals() — identity hashing, open addressing, object-graph use cases and String-pool traps.
order: 19
---

## Introduction

`IdentityHashMap` is a specialized Map implementation that **intentionally breaks away** from normal Java Map equality semantics. The key idea:

> `HashMap` compares keys using `equals()`, while `IdentityHashMap` compares keys using **reference identity (`==`)**.

This makes `IdentityHashMap` useful when you care about *"Are these the **exact same object**?"* rather than *"Are these two objects logically equal?"*

## What Is IdentityHashMap?

Package:

```java
java.util.IdentityHashMap
```

```java
Map<String, Integer> map = new IdentityHashMap<>();
```

| Map | Key comparison |
| --- | --- |
| `IdentityHashMap` | `==` |
| `HashMap` | `equals()` |

## == vs equals()

This is the foundation of the entire chapter.

```java
String a = new String("Java");
String b = new String("Java");

System.out.println(a.equals(b));
System.out.println(a == b);
```

```output
true
false
```

`equals()` is `true` because both contain the same characters; `==` is `false` because they are **different objects**.

### HashMap Behaviour

```java
Map<String, Integer> map = new HashMap<>();

map.put(a, 100);
map.put(b, 200);
```

Because `a.equals(b) == true`, the second insertion replaces the first mapping. Final: **one logical key → 200**.

### IdentityHashMap Behaviour

```java
Map<String, Integer> map = new IdentityHashMap<>();

map.put(a, 100);
map.put(b, 200);
```

Here `a == b` is `false`, so **both keys coexist**: `a → 100`, `b → 200`. This is the defining difference.

### Side-by-Side

```flow
HashMap
equals()
logical equality
a and b → same key
---
IdentityHashMap
==
object identity
a and b → different keys
```

## Why Would Anyone Want This?

Most business applications care about **logical equality** — two `Employee` objects representing ID 101 might logically be the same employee, so `HashMap` is appropriate.

But some algorithms care about **object identity**: *"Have I already encountered this exact object instance?"* That's where `IdentityHashMap` becomes useful.

### Object Graph Traversal

One important use case is processing object graphs. Suppose **Object A → Object B → Object A** — there is a cycle. If you're traversing the graph and want to detect whether you've already visited the **same object instance**, identity semantics are useful:

```java
Map<Object, Boolean> visited = new IdentityHashMap<>();

if (visited.put(object, Boolean.TRUE) == null) {
    // first time seeing this exact object
}
```

The identity of the object matters, not its `equals()` implementation.

### Why HashMap Can Be Wrong for Identity-Based Algorithms

Suppose two different objects implement `equals()` such that `objectA.equals(objectB) == true`. A `HashMap` would treat them as the same key. But your algorithm might need `objectA != objectB` to mean *different objects*. `IdentityHashMap` gives you that behaviour.

## Identity Comparison and Hashing

### IdentityHashMap Uses ==

The rule to remember: IdentityHashMap key comparison uses **reference equality (`==`)**, not `equals()`.

### What About hashCode()?

`IdentityHashMap` also uses **identity-based hashing**. Conceptually, it uses:

```java
System.identityHashCode(object)
```

rather than relying on the object's overridden `object.hashCode()`. **Why?** Because the Map wants hashing to correspond to **object identity** rather than logical equality.

### System.identityHashCode()

Java provides `System.identityHashCode(object)`, which returns the identity-based hash associated with the object. Even if the class overrides `hashCode()`, `System.identityHashCode()` provides identity-based hash semantics.

### Example

```java
class Employee {

    int id;

    @Override
    public int hashCode() {
        return id;
    }

    @Override
    public boolean equals(Object o) {
        // ...
    }
}
```

Two Employees may have the same `id`, and therefore the same `equals()` and same `hashCode()`. But `IdentityHashMap` still distinguishes them if they are **different object instances**.

## Internal Structure

`IdentityHashMap` does **not** simply behave like *"HashMap + replace equals() with =="*. Its internal representation is specialized. Conceptually, it uses an **array-based table** containing alternating keys and values:

```array IdentityHashMap table: key and value in adjacent slots
0: key 1
1: value 1
2: key 2
3: value 2
4: key 3
5: value 3
```

This avoids creating separate `Node` objects for each mapping, rather than using the normal HashMap bucket-node structure.

### Open Addressing

Unlike HashMap's **bucket → Node → Node → Node**, `IdentityHashMap` uses an array and **searches for a suitable slot** when collisions occur. The implementation uses open-addressing-style probing.

```flow This is called open addressing
hash
initial slot
? Occupied? | No: use it | Yes: probe another slot
```

### IdentityHashMap vs HashMap Internals

| HashMap | IdentityHashMap |
| --- | --- |
| Array of buckets → Node → Node → Node | Single array of key/value pairs |
| Potentially tree bins for heavy collisions | Open addressing |
| Collision → same bucket → linked nodes / tree bin | Collision → probe another array slot |

This is a major implementation difference — `IdentityHashMap` doesn't use HashMap-style linked bucket chains.

### Why Open Addressing?

In an open-addressed table (`slot 0, slot 1, slot 2, slot 3, …`), if the preferred slot is occupied, try another slot. This continues until the appropriate key is found or an empty slot is found.

### Conceptual Lookup

For `map.get(key)`, think:

```flow
identityHashCode(key)
initial slot
? Same reference? | Yes: return value | No: probe next slot and repeat
```

The key comparison is `storedKey == key`, **not** `storedKey.equals(key)`.

## The Map Contract

### Why IdentityHashMap Doesn't Use equals()

```java
Object a = new Object();
Object b = new Object();
```

Even if a custom class says `a.equals(b) == true`, `IdentityHashMap` wants `a == b`. The semantic contract is different, which makes it appropriate for identity-sensitive operations.

### An Intentional Departure from the Map Contract

The Java `Map` contract is normally based on **logical equality**. `IdentityHashMap` intentionally uses **reference equality** instead. The JDK documentation explicitly describes this as a **deliberate departure** from the general `Map` contract. This is why `IdentityHashMap` is a specialized collection rather than a normal replacement for `HashMap`.

### containsKey()

`containsKey(key)` checks **identity**. So if `a != b` — even when `a.equals(b) == true` — then `map.containsKey(a)` and `map.containsKey(b)` can produce different results depending on which exact object was inserted.

### remove()

```java
map.remove(a);
```

removes the mapping associated with the **exact object reference** `a`. A distinct but equal object `b` won't remove it.

### containsValue()

The identity semantics aren't limited only to keys. The documentation specifies identity-based comparisons for keys **and values** where applicable.

> [!IMPORTANT]
> IdentityHashMap is designed around **reference identity** rather than ordinary logical equality. Don't assume it behaves exactly like HashMap with only one tiny method changed.

## Keys, Values and Null

### Null Keys and Values

`IdentityHashMap` allows a null key (`map.put(null, "Hello");`) — there can be one null key mapping — and null values (`map.put(object, null);`).

### Duplicate Keys?

`IdentityHashMap` doesn't allow duplicate **identical references**. But it can contain multiple **distinct** objects that are equal according to `equals()` (`a.equals(b) → true`, `a == b → false` → both can exist as keys).

### Duplicate Values

Values can be duplicated: `map.put(a, "Java"); map.put(b, "Java");` is valid.

### IdentityHashMap and Mutable Objects

`IdentityHashMap` behaves differently from `HashMap` regarding mutation of an object's overridden `hashCode()`:

```java
class Employee {

    int id;

    @Override
    public int hashCode() {
        return id;
    }
}
```

Changing `employee.id` doesn't change the **identity hash** used by `IdentityHashMap`. So the classic HashMap problem involving a mutable logical hash is not the same here.

> [!NOTE]
> You still shouldn't casually mutate objects involved in complex identity-based algorithms, because object state can affect the algorithm's logic even if it doesn't affect identity hashing.

### Identity Is Stable

An object's identity remains associated with that object instance during its lifetime — **same instance → same identity**, even if fields change. This is exactly what identity-based structures need.

### equals() vs Identity

```java
class Person {

    String name;

    @Override
    public boolean equals(Object o) {
        Person p = (Person) o;
        return name.equals(p.name);
    }

    @Override
    public int hashCode() {
        return name.hashCode();
    }
}
```

```java
Person p1 = new Person("John");
Person p2 = new Person("John");
```

`p1.equals(p2) → true`, `p1 == p2 → false`. **HashMap:** p1 and p2 are the same logical key. **IdentityHashMap:** p1 and p2 are different keys.

## Graph Copying and Serialization

One legitimate use case is supporting algorithms where **object identity must be preserved**. Suppose an object graph contains `A → B` and another reference to `B`, where both references point to the **same B object**. An identity map can record `original B → copied B`, so that both references can point to the same copied object. This prevents accidentally creating two separate copies of the same original object.

```flow This preserves object identity relationships
Original graph: A → B, and another reference → same B
IdentityMap: Original A → Copy A, Original B → Copy B
B encountered again
? Already mapped? | Yes: reuse Copy B | No: create copy
```

## When Not to Use IdentityHashMap

Don't use `IdentityHashMap` just because it is another Map. For ordinary business logic, `HashMap` is almost always the more natural choice. Use `IdentityHashMap` only when **object identity is genuinely part of the requirement**.

### Why equals() Can Matter Here

Suppose a class has `equals()` based on business identity (`employeeId`). Two different object instances may represent the same employee:

- **HashMap** → same employee → same key
- **IdentityHashMap** → different object instances → different keys

That can be exactly what an object-graph algorithm needs.

## Comparisons

### IdentityHashMap vs HashMap

| Feature | HashMap | IdentityHashMap |
| --- | --- | --- |
| Key equality | `equals()` | `==` |
| Hashing | `hashCode()` | Identity-based |
| Equal distinct objects | Same key | Separate keys |
| Null key | One | One |
| Null values | Yes | Yes |
| Internal structure | Buckets/nodes | Array + probing |
| Treeification | Yes, for eligible bins | ❌ No |
| Thread-safe | ❌ No | ❌ No |
| General-purpose | ✅ Yes | ❌ No |
| Identity-sensitive | ❌ No | ✅ Yes |

### IdentityHashMap vs WeakHashMap

These solve completely different problems:

| Map | Question it answers | Mechanism |
| --- | --- | --- |
| IdentityHashMap | How are keys **compared**? | `==` — identity semantics |
| WeakHashMap | How are keys **retained**? | Weak references — lifecycle semantics |

### IdentityHashMap vs TreeMap

- **TreeMap** asks *"How do keys compare?"* using `Comparator` / `Comparable`.
- **IdentityHashMap** asks *"Are these the same object?"* using `==`.

Completely different semantics.

### entrySet() and Iteration Order

You can still use `map.entrySet()` like other Maps, but key equality remains identity-based — `entry.getKey()` is the exact object reference used as the key.

`IdentityHashMap` does **not** provide insertion-order or sorted-order guarantees. For insertion order use `LinkedHashMap`; for sorted keys use `TreeMap`.

### Capacity

```java
new IdentityHashMap<>(100);
```

The parameter represents an **expected maximum number of entries** rather than behaving exactly like HashMap's initial bucket capacity — another subtle API distinction.

### Performance

Average basic operations are generally **O(1)** because it uses hashing and open addressing. However, performance depends on hash distribution, table occupancy and probing. It should not be selected solely because it uses an array — the primary reason to select it is **identity semantics**.

## Interview Questions

### What is the difference between HashMap and IdentityHashMap?

HashMap uses `equals()` and the corresponding `hashCode()` contract for key equality, whereas IdentityHashMap uses reference identity (`==`) and identity-based hashing. Therefore, two distinct objects that are logically equal can coexist as separate keys in IdentityHashMap.

### Why would you use IdentityHashMap?

When object identity matters more than logical equality — for example, tracking visited object instances during object-graph traversal, preserving object identity during graph copying, or associating metadata with exact object instances.

### What is System.identityHashCode()?

It returns an identity-based hash value for an object, independent of the object's overridden `hashCode()` implementation.

### Can two equal objects exist as separate IdentityHashMap keys?

Yes. If `a.equals(b) == true` but `a != b`, IdentityHashMap treats them as different keys.

### Does IdentityHashMap use hashCode()?

Not in the normal logical-equality sense. It uses identity-based hashing, conceptually associated with `System.identityHashCode(key)` rather than the key's overridden `hashCode()`.

### Does IdentityHashMap violate the Map contract?

The JDK documentation describes IdentityHashMap as **intentionally** violating the general Map contract's use of `equals()` for key equality, because it deliberately uses reference equality. This is not an accidental bug — it is the defining purpose of the class.

### If a.hashCode() == b.hashCode(), can IdentityHashMap still treat them as different keys?

Yes. Hash equality does not imply identity. IdentityHashMap ultimately distinguishes references using `==`.

### If a == b, can IdentityHashMap contain two separate entries for them?

No. They are the exact same object reference, so they represent the same identity key.

## Interview Scenarios

| Requirement | Use |
| --- | --- |
| Detect whether the exact same object instance was already visited during graph traversal | `IdentityHashMap<Object, Boolean>` |
| Customer ID → Customer, where two objects with the same ID are the same logical entity | `HashMap`, not IdentityHashMap |
| Preserve insertion order | `LinkedHashMap`, not IdentityHashMap |
| Keys sorted numerically | `TreeMap`, not IdentityHashMap |
| Entries disappear when keys are no longer strongly reachable | `WeakHashMap`, not IdentityHashMap |

## Coding Questions

### new String keys in IdentityHashMap

```java
String a = new String("Java");
String b = new String("Java");

Map<String, Integer> map = new IdentityHashMap<>();

map.put(a, 10);
map.put(b, 20);

System.out.println(map.size());
```

```output
2
```

Because `a != b`.

### Same code with HashMap

```java
Map<String, Integer> map = new HashMap<>();

map.put(a, 10);
map.put(b, 20);

System.out.println(map.size());
```

```output
1
```

Since `a.equals(b)` is true, the second value replaces the first.

### containsKey with a different but equal object

```java
String a = new String("Java");
String b = new String("Java");

IdentityHashMap<String, Integer> map = new IdentityHashMap<>();

map.put(a, 10);

System.out.println(map.containsKey(b));
```

```output
false
```

Because `b` isn't the same object as `a`.

### containsKey with the same reference

```java
IdentityHashMap<String, Integer> map = new IdentityHashMap<>();

String a = new String("Java");
map.put(a, 10);

System.out.println(map.containsKey(a));
```

```output
true
```

Same exact reference.

### Tricky: the String Pool

```java
String a = "Java";
String b = "Java";

IdentityHashMap<String, Integer> map = new IdentityHashMap<>();

map.put(a, 10);
map.put(b, 20);
```

`a == b` can be **true**, because string literals are interned and can refer to the same String object. So this can result in **size = 1**. This is why you must understand `==`, not just `equals()`.

With `new String("Java")` for both, `a == b` is `false`, so IdentityHashMap stores **both** (size = 2).

### Equal Person objects

```java
class Person {

    int id;

    Person(int id) {
        this.id = id;
    }

    @Override
    public boolean equals(Object obj) {
        return obj instanceof Person && ((Person) obj).id == id;
    }

    @Override
    public int hashCode() {
        return id;
    }
}
```

```java
Person p1 = new Person(10);
Person p2 = new Person(10);

IdentityHashMap<Person, String> map = new IdentityHashMap<>();

map.put(p1, "A");
map.put(p2, "B");

map.size();
```

**Answer: 2**, because `p1.equals(p2) → true` but `p1 == p2 → false`. With a `HashMap`, the size would be **1**.

### Same reference twice

```java
Person p1 = new Person(10);
Person p2 = p1;

IdentityHashMap<Person, String> map = new IdentityHashMap<>();

map.put(p1, "A");
map.put(p2, "B");
```

Result: **size = 1**, because `p1 == p2`. The second `put()` replaces the value.

## Decision Framework

```flow
Need a Map
? How should keys be compared? | equals(): HashMap | identity (==): IdentityHashMap | ordering: TreeMap
```

| Other requirement | Choose |
| --- | --- |
| Insertion/access order | `LinkedHashMap` |
| Weak keys | `WeakHashMap` |

### Complete Map Selection

```tree
Map
  HashMap | fast lookup
  LinkedHashMap | predictable order · access order → LRU
  TreeMap | sorted keys
  WeakHashMap | weak keys
  IdentityHashMap | identity keys
  EnumMap | enum keys
  ConcurrentHashMap | concurrent access
```

### Final Mental Model

| Map | Equality | Internal structure |
| --- | --- | --- |
| HashMap | Logical equality — `equals()` | Buckets + nodes |
| IdentityHashMap | Object identity — `==` | Array + open addressing |

Given `a.equals(b) → true` and `a == b → false`: **HashMap** holds one logical key; **IdentityHashMap** holds two identity keys.

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| IdentityHashMap | Identity-based Map |
| Key comparison | `==` |
| Normal HashMap | `equals()` |
| Hashing | Identity-based |
| Identity hash | `System.identityHashCode()` concept |
| Internal structure | Array + open addressing |
| HashMap-style buckets | ❌ No |
| Treeification | ❌ No |
| Null key | ✅ Allowed |
| Null values | ✅ Allowed |
| Duplicate equal objects | Can coexist |
| Same object reference | One key |
| Ordering | None guaranteed |
| Thread-safe | ❌ No |
| Main use | Identity-sensitive algorithms |
| Object graph traversal | Common use case |
| Graph copying | Useful |
| General-purpose Map | ❌ No |

### Interview Readiness Checklist

- `==` vs `equals()`
- Why IdentityHashMap exists, and HashMap vs IdentityHashMap
- Identity-based key comparison and identity-based hashing
- `System.identityHashCode()`
- How equal-but-distinct objects behave vs identical references
- Internal array representation, open addressing and probing
- Why it doesn't use HashMap-style buckets
- Object graph traversal and graph-copying use cases
- Null behaviour
- Why it isn't a general replacement for HashMap
- IdentityHashMap vs WeakHashMap / TreeMap
- String-pool interview traps
- Mutable-object implications
- Why IdentityHashMap intentionally departs from normal Map equality semantics
