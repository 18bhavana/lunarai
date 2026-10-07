---
title: EnumMap
subtitle: The array-backed Map for enum keys — ordinal positions, declaration-order iteration, null rules, EnumSet vs EnumMap and state machines.
order: 20
---

## Introduction

`EnumMap` is a specialized Map implementation designed specifically for **enum keys**. The core idea:

> When your keys are enum constants, EnumMap uses the enum's fixed set of constants to implement a compact, fast map — internally backed by an **array**.

```flow-h
EnumMap
Enum keys
Array-based storage
Fast + memory efficient
```

This is one of the best examples of choosing a collection based on the **nature of your key type**, rather than simply defaulting to `HashMap`.

## What Is EnumMap?

Package:

```java
java.util.EnumMap
```

It implements `Map<K,V>`, where **K must be an enum type**.

```java
enum Day {
    MONDAY, TUESDAY, WEDNESDAY
}

EnumMap<Day, String> map = new EnumMap<>(Day.class);
```

### Why Does EnumMap Exist?

```java
enum Status {
    NEW,
    PROCESSING,
    COMPLETED,
    FAILED
}
```

You want `Status → description`. You could use `HashMap<Status, String>`, but Java provides a more specialized option, `EnumMap<Status, String>`, because the **key space is known and finite**.

### Why Is an Enum Special?

An enum has a **fixed set of constants**:

```java
enum Priority {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
```

There are exactly four possible enum constants: `LOW → ordinal 0`, `MEDIUM → 1`, `HIGH → 2`, `CRITICAL → 3`. EnumMap can exploit this fixed structure.

## Internal Structure

The most important implementation concept:

> **EnumMap is internally array-based.**

```flow-h
Enum constant
ordinal()
array index
value
```

```array For MONDAY, TUESDAY, WEDNESDAY
0: MONDAY value
1: TUESDAY value
2: WEDNESDAY value
```

This avoids the normal hashing machinery of `HashMap`.

### Why Array-Based?

Because the possible keys are **already known**. For `enum Status { NEW, PROCESSING, COMPLETED }`, Java knows the universe of possible keys (`0 → NEW`, `1 → PROCESSING`, `2 → COMPLETED`). So instead of **hash → bucket → node**, EnumMap can conceptually do **enum → ordinal → array[index]**.

## Construction

### Most Common Constructor

```java
EnumMap<Status, String> map = new EnumMap<>(Status.class);
```

The class literal tells EnumMap: *"This is the enum type used as the key."*

### Why Is Status.class Required?

EnumMap needs to know the key enum type so it can determine **all enum constants** and build the appropriate internal structure. Generics are erased at runtime, so `new EnumMap<>(Status.class)` gives the implementation the actual enum class.

### Copy Constructor

```java
EnumMap<Status, String> map2 = new EnumMap<>(map1);
```

This preserves the enum-key type and mappings.

### Map Constructor

```java
Map<Status, String> source = new HashMap<>();

EnumMap<Status, String> map = new EnumMap<>(source);
```

The source must contain enough information for EnumMap to determine the enum key type, such as **at least one mapping**. An empty generic `Map` doesn't provide runtime generic type information because of type erasure.

### Type Safety

EnumMap is strongly type-safe. For `enum Status { NEW, DONE }`, an `EnumMap<Status, String>` only accepts `Status` as keys — you cannot insert `"NEW"` as a key.

## Basic Example

```java
enum Status {
    NEW,
    PROCESSING,
    COMPLETED
}

EnumMap<Status, String> map = new EnumMap<>(Status.class);

map.put(Status.NEW, "Created");
map.put(Status.PROCESSING, "Running");
map.put(Status.COMPLETED, "Finished");

System.out.println(map.get(Status.PROCESSING));
```

```output
Running
```

## Ordering

EnumMap maintains entries in the **natural order of the enum constants** — the order in which constants are declared.

```java
enum Priority {
    LOW, MEDIUM, HIGH, CRITICAL
}
```

EnumMap iteration follows `LOW, MEDIUM, HIGH, CRITICAL` — even if you insert them in another order.

### Insertion Order Does NOT Matter

```java
map.put(Priority.HIGH, "H");
map.put(Priority.LOW, "L");
map.put(Priority.CRITICAL, "C");
map.put(Priority.MEDIUM, "M");
```

Iteration is still `LOW, MEDIUM, HIGH, CRITICAL`, because EnumMap follows enum declaration order.

### EnumMap vs LinkedHashMap

- **LinkedHashMap** → insertion/access order
- **EnumMap** → enum declaration order

So **EnumMap ≠ insertion-order Map**.

### EnumMap vs TreeMap

TreeMap sorts using `Comparable` / `Comparator`; EnumMap follows **enum declaration order**. EnumMap is specialized specifically for enum keys and is generally much more compact.

## ordinal() and Enum Identity

Every enum constant has an ordinal:

```java
Status.NEW.ordinal();
```

For `enum Status { NEW, PROCESSING, COMPLETED }`: `NEW → 0`, `PROCESSING → 1`, `COMPLETED → 2`. EnumMap can exploit this fixed ordinal positioning internally.

### Don't Persist Ordinals

> [!WARNING]
> Don't use `ordinal()` as a persistent business identifier. For example, don't store `0 → NEW`, `1 → PROCESSING` in a database and assume the values will never change.

If the enum constants are reordered:

```java
enum Status {
    PROCESSING, NEW, COMPLETED
}
```

the ordinals change. Use an explicit field if you need a stable business code.

### EnumMap Uses Enum Identity

Enum constants have special identity semantics — `Status.NEW == Status.NEW` is `true`. Each enum constant is a **singleton instance** within its enum type, which makes enum keys particularly suitable for specialized collection implementations.

## Null, Duplicates and Complexity

### Null Keys

An important difference from `HashMap`: EnumMap does **not** permit null keys.

```java
map.put(null, "Something");
```

```output
NullPointerException
```

**Why?** Because every valid key must be one of the enum constants, and there is no `null` enum constant.

### Null Values

Null values **are** allowed:

```java
map.put(Status.NEW, null);
```

So: **null key ❌, null value ✅**.

### Duplicate Keys and Values

Like every Map, one key → one mapping:

```java
map.put(Status.NEW, "A");
map.put(Status.NEW, "B");
```

Final mapping: `NEW → B`. Duplicate values are allowed:

```java
map.put(Status.NEW, "Pending");
map.put(Status.PROCESSING, "Pending");
```

### Complexity

| Operation | Complexity |
| --- | --- |
| get() | O(1) |
| put() | O(1) |
| remove() | O(1) |
| containsKey() | O(1) |

Because the key maps directly to an array position. This is one of EnumMap's major advantages.

### Why Is EnumMap Faster Than HashMap?

```flow
HashMap
key
hashCode()
bucket calculation
bucket lookup
possibly compare keys
---
EnumMap
enum key
ordinal / enum position
array access
```

Fewer moving parts make EnumMap efficient. Actual performance depends on workload and JVM details, but the structural advantage is clear.

### Memory Efficiency

`HashMap` requires a table, nodes, hash information and references. `EnumMap` can use an array indexed according to the enum's constants — a **compact representation**, especially when the enum type is relatively small.

### Sparse vs Dense Enum Usage

```java
enum State {
    A, B, C, D, E, F, G, H, I, J
}
```

Even if you only store `A` and `J`, EnumMap's internal representation is still based on the **enum universe**.

> [!NOTE]
> EnumMap is optimized around a fixed finite enum key space, not around minimizing storage for only the currently present keys.

## EnumMap vs HashMap

| Feature | EnumMap | HashMap |
| --- | --- | --- |
| Key type | Enum only | Any object |
| Internal structure | Array-based | Hash table |
| Average get() | O(1) | O(1) |
| Ordering | Enum declaration order | No guaranteed order |
| Null key | ❌ Not allowed | ✅ One allowed |
| Null values | ✅ Allowed | ✅ Allowed |
| Memory efficiency | High for enum keys | General-purpose |
| Thread-safe | ❌ No | ❌ No |
| Specialized | ✅ Yes | ❌ No |

## EnumMap vs EnumSet

These two are often confused.

| Collection | Stores | Think |
| --- | --- | --- |
| `EnumSet` | Only enum constants | *"Which enum values are selected?"* |
| `EnumMap` | enum → value | *"What value is associated with this enum?"* |

### EnumSet Example

```java
EnumSet<Day> workingDays = EnumSet.of(Day.MONDAY, Day.TUESDAY);
```

`MONDAY → present`, `TUESDAY → present`. No associated values.

### EnumMap Example

```java
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);

schedule.put(Day.MONDAY, "Development");
schedule.put(Day.TUESDAY, "Testing");
```

`MONDAY → Development`, `TUESDAY → Testing`.

## Real-World Use Cases

### State Machines

A very good real-world use case:

```java
enum State {
    NEW,
    PROCESSING,
    COMPLETED,
    FAILED
}

EnumMap<State, Set<State>> transitions = new EnumMap<>(State.class);
```

```flow This creates a clean state-machine representation
NEW
PROCESSING
? Outcome | success: COMPLETED | error: FAILED
```

### Configuration

```java
enum Environment {
    DEV,
    TEST,
    PROD
}

EnumMap<Environment, String> urls = new EnumMap<>(Environment.class);
```

`DEV → development URL`, `TEST → testing URL`, `PROD → production URL`.

### Strategy Selection

```java
enum PaymentType {
    CARD, UPI, NET_BANKING
}

EnumMap<PaymentType, PaymentProcessor> processors = new EnumMap<>(PaymentType.class);
```

```refs This avoids large if-else or switch blocks in some designs
CARD -> CardProcessor
UPI -> UpiProcessor
NET_BANKING -> NetBankingProcessor
```

### HTTP / Business Status

```java
enum HttpStatusType {
    SUCCESS,
    CLIENT_ERROR,
    SERVER_ERROR
}

EnumMap<HttpStatusType, Integer> codes = new EnumMap<>(HttpStatusType.class);
```

Could associate `SUCCESS → 200`, `CLIENT_ERROR → 400`, `SERVER_ERROR → 500`.

## Iteration and Lookups

### Iteration

EnumMap iteration follows enum declaration order:

```java
for (Map.Entry<Status, String> entry : map.entrySet()) {
    System.out.println(entry);
}
```

For `NEW, PROCESSING, COMPLETED`, iteration follows `NEW, PROCESSING, COMPLETED` — for entries that are present.

### Missing Entries

```java
enum Status {
    NEW,
    PROCESSING,
    COMPLETED
}

map.put(Status.COMPLETED, "Done");
```

Iteration does **not** produce empty entries for `NEW` and `PROCESSING` — only actual mappings are returned (`NEW → absent`, `PROCESSING → absent`, `COMPLETED → Done`).

### containsKey()

```java
map.containsKey(Status.NEW);
```

determines whether the enum constant has an associated mapping. This is different from `map.get(Status.NEW) == null`, because a null value is allowed.

### Null Value Trap

```java
map.put(Status.NEW, null);

map.get(Status.NEW);   // null
```

That doesn't tell you whether the key is **absent** or **present with a null value**. Use `containsKey()` to distinguish them.

## Thread Safety

### EnumMap Is Not Thread-Safe

Like most standard Map implementations, EnumMap is not inherently thread-safe. If multiple threads mutate it concurrently, use appropriate synchronization/concurrency mechanisms.

### Synchronized Wrapper

```java
Map<Status, String> map = Collections.synchronizedMap(new EnumMap<>(Status.class));
```

> [!NOTE]
> A synchronized wrapper is not the same as a purpose-built concurrent collection.

## Implementation Details

### Does EnumMap Use Hashing?

**It doesn't use hashing in the same way HashMap does.** Its internal representation is array-based and exploits the known enum key universe: **enum → known position → array**, rather than **hash → bucket**.

### Does EnumMap Use ordinal() Directly?

For interview purposes, think: *EnumMap can exploit the enum's ordinal/declared position to provide array-based storage.* The exact implementation shouldn't be reduced to "it literally does `values[key.ordinal()]` for everything" — the JDK implementation has details such as masking null values and handling the enum universe. The important architectural point: **enum universe + array storage = efficient Map**.

### Enum Declaration Order Changes Iteration

Changing `enum Priority { LOW, MEDIUM, HIGH }` to `enum Priority { HIGH, LOW, MEDIUM }` changes EnumMap's iteration order accordingly. Enum declaration order is part of the natural ordering used by EnumMap.

### No Comparator Needed

TreeMap allows a `Comparator` to define ordering. EnumMap doesn't need a user-supplied Comparator — it follows the enum's natural/declaration order.

### EnumMap vs TreeMap for Enums

Both can represent `Priority → value`, but **EnumMap is the natural specialized choice**: enum-specific, array-based, compact, fast, declaration-order iteration. TreeMap is more general and uses a balanced tree.

### EnumMap vs HashMap for Enums

If your key is definitely an enum, EnumMap is generally preferable: better memory characteristics, fast operations, predictable enum ordering and type specialization. HashMap remains useful if your design requires a general-purpose Map abstraction or other semantics.

## Interview Questions

### Why is EnumMap faster than HashMap?

EnumMap knows the finite set of possible enum keys and uses an array-based representation, allowing efficient direct indexing rather than general-purpose hash-table lookup.

### What is the internal data structure of EnumMap?

It is internally array-based and uses the enum's known universe/order to associate enum constants with array positions.

### Can EnumMap have null keys?

No — a null key throws `NullPointerException`. But null values are allowed.

### Does EnumMap maintain insertion order?

No. It maintains **enum declaration order**. For `enum X { C, A, B }`, iteration follows `C, A, B` regardless of insertion sequence.

### What happens if you insert enum constants in reverse order?

```java
map.put(Status.COMPLETED, "C");
map.put(Status.NEW, "N");
map.put(Status.PROCESSING, "P");
```

Iteration still follows the declaration order: `NEW, PROCESSING, COMPLETED`.

### EnumMap vs EnumSet?

`EnumSet` is a Set specialized for enum constants and represents **membership**, while `EnumMap` is a Map specialized for **associating enum constants with values**. EnumSet → enum values only; EnumMap → enum → value.

### Can EnumMap store null values?

Yes — `map.put(Status.NEW, null);` is allowed.

### Is EnumMap thread-safe?

No. You need appropriate synchronization when using it concurrently.

### Why is EnumMap memory efficient?

Because it can use a compact array-oriented representation based on the finite enum key space instead of general-purpose hash-table nodes and buckets.

## Coding Questions

### Iteration order

```java
enum Day {
    MONDAY, TUESDAY, WEDNESDAY
}

EnumMap<Day, String> map = new EnumMap<>(Day.class);

map.put(Day.WEDNESDAY, "C");
map.put(Day.MONDAY, "A");
map.put(Day.TUESDAY, "B");

for (Day day : map.keySet()) {
    System.out.println(day);
}
```

```output
MONDAY
TUESDAY
WEDNESDAY
```

Insertion order is irrelevant.

### Duplicate key

```java
EnumMap<Day, String> map = new EnumMap<>(Day.class);

map.put(Day.MONDAY, "A");
map.put(Day.MONDAY, "B");

System.out.println(map.size());
System.out.println(map.get(Day.MONDAY));
```

```output
1
B
```

Map semantics still apply.

### Null key

```java
EnumMap<Day, String> map = new EnumMap<>(Day.class);

map.put(null, "X");
```

```output
NullPointerException
```

### Null value

```java
EnumMap<Day, String> map = new EnumMap<>(Day.class);

map.put(Day.MONDAY, null);

System.out.println(map.containsKey(Day.MONDAY));
System.out.println(map.get(Day.MONDAY));
```

```output
true
null
```

This demonstrates why `containsKey()` matters.

### EnumMap vs HashMap

Given `enum State { START, RUNNING, STOPPED }`, prefer `EnumMap<State, String>` over `HashMap<State, String>` because the key type is known to be an enum.

### State machine

```java
enum State {
    NEW,
    PROCESSING,
    COMPLETED,
    FAILED
}

EnumMap<State, Set<State>> transitions = new EnumMap<>(State.class);
```

This can naturally represent `NEW → PROCESSING → COMPLETED / FAILED` — an excellent practical use of EnumMap.

## Important Traps

| Trap | Reality |
| --- | --- |
| "EnumMap is a Set." | ❌ Use EnumMap for enum → value; use EnumSet for selected enum constants. |
| "EnumMap is just HashMap but faster for enums." | ❌ Better: *EnumMap is a specialized Map implementation with a different, enum-aware internal representation.* Its purpose is specialization. |
| "EnumMap is sorted by name." | ❌ For `enum Status { ZEBRA, APPLE, MANGO }`, the order is `ZEBRA, APPLE, MANGO` — declaration order, not alphabetical. |
| "EnumMap orders by `name()`." | ❌ It uses the enum's natural/declaration order. |
| "Enum order can be changed freely." | ⚠️ Declaration order influences `ordinal()` and EnumMap iteration, so treat it carefully when it has semantic significance. |

## Decision Framework

```flow
Need a Map
? Are keys enums? | No: HashMap / LinkedHashMap / TreeMap | Yes: need enum → value mapping? → EnumMap
```

| Need | Choose |
| --- | --- |
| Only enum membership | `EnumSet` |
| Insertion/access order for arbitrary keys | `LinkedHashMap` |
| Sorted arbitrary keys | `TreeMap` |

### Map Selection — Updated

```tree
Map
  HashMap | fast lookup
  LinkedHashMap | insertion/access order
  TreeMap | sorted keys
  WeakHashMap | weak keys
  IdentityHashMap | identity keys
  EnumMap | enum keys
  ConcurrentHashMap | concurrent access
```

### Final Mental Model

```flow-h EnumMap: specialized · array-based · O(1)-style basic operations · enum declaration-order iteration
enum key
ordinal
array position
value
```

```array enum Priority { LOW, MEDIUM, HIGH }
0: value for LOW
1: value for MEDIUM
2: value for HIGH
```

## Chapter Summary

| Concept | Key Point |
| --- | --- |
| EnumMap | Map specialized for enum keys |
| Package | `java.util` |
| Key type | Enum only |
| Internal representation | Array-based |
| Hashing | Not HashMap-style hashing |
| Basic lookup / insertion / removal | O(1) |
| Iteration order | Enum declaration order |
| Insertion order | ❌ Not used |
| Sorted alphabetically | ❌ No |
| Null key | ❌ Not allowed |
| Null values | ✅ Allowed |
| Duplicate keys | ❌ No |
| Duplicate values | ✅ Yes |
| Thread-safe | ❌ No |
| Memory efficiency | High for enum-key mappings |
| Main use | Enum → value mapping |
| EnumSet difference | EnumSet stores membership; EnumMap stores values |

### Interview Readiness Checklist

- What EnumMap is and why it exists
- Why enum keys allow specialization
- Array-based internal representation and the ordinal/declaration position concept
- Why basic operations are O(1) and why EnumMap can be memory efficient
- Enum declaration-order iteration; why insertion order doesn't matter; why it doesn't sort alphabetically
- Why null keys aren't allowed but null values are
- EnumMap vs HashMap / LinkedHashMap / TreeMap / EnumSet
- State-machine, strategy-lookup and configuration-lookup use cases
- Why enum ordinal shouldn't be used as a persistent ID
- Why EnumMap isn't thread-safe
- How `containsKey()` differs from `get()` when null values are possible
