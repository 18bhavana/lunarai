---
title: Introduction to Java Collections Framework
subtitle: Why collections exist, the problems with arrays, Collection vs Collections, and the overall hierarchy.
order: 1
---

## What is a Collection?

Imagine your company has millions of users: `User1`, `User2`, `User3` … `User1000000`.

Can we create variables like these?

```java
User u1;
User u2;
User u3;
// ...
```

**Impossible.** Instead, Java introduced **Collections**. A Collection is simply:

> An object that can store a **group of objects as a single unit**.

```java
List<String> names = new ArrayList<>();
names.add("Rahul");
names.add("Ankit");
names.add("John");
```

Instead of creating hundreds of variables, you create **one collection**.

## Why Collections?

Suppose you are writing an Employee Management System. Employees keep changing:

```flow-h
Today | 50 employees
Tomorrow | 100 employees
Next Month | 500 employees
```

Arrays become difficult to manage because their **size is fixed**. Collections automatically **grow and shrink**. That is why Java introduced the Collections Framework.

## Problems with Arrays

> [!QUESTION] Why Collections when Arrays already exist?
> Arrays have several limitations.

### 1. Fixed Size

```java
int[] arr = new int[5];
```

Maximum size = 5. You cannot store a 6th element — you need to create another array. Collections solve this problem:

```java
ArrayList<Integer> list = new ArrayList<>();
list.add(10);
list.add(20);
list.add(30);
```

The list grows automatically.

### 2. Homogeneous

Arrays can store only one type: `int[]`, `String[]`, `Employee[]`. You cannot do:

```java
int[] arr = {10, "ABC"};   // Compilation Error
```

Collections (without Generics) can store heterogeneous objects:

```java
ArrayList list = new ArrayList();
list.add(10);
list.add("ABC");
list.add(true);
```

### 3. No Built-in Methods

Arrays provide very few utility methods, so you need manual coding. Collections provide methods like:

`add()`, `remove()`, `contains()`, `clear()`, `sort()`, `replaceAll()`, `retainAll()`, `removeIf()`, `stream()`

Huge advantage.

### 4. Memory Wastage

Suppose you create `new int[1000];` but only 10 elements are used — **990 spaces are wasted**. Collections allocate memory dynamically.

### 5. Difficult Searching

With arrays you need loops (`for(...)`). Collections provide `contains()` and `indexOf()`.

## What is the Collection Framework?

The Collection Framework is:

> A set of **interfaces and classes** used to store and manipulate groups of objects.

```tree Framework means Java already provides ready-made implementations
Collection Framework
  Interfaces | List · Set · Queue
  Classes | ArrayList · LinkedList · HashSet · TreeSet · PriorityQueue
```

No need to reinvent everything.

## What is a Framework?

> [!QUESTION] What is a framework?
> A set of **pre-written classes and interfaces** providing a ready-made architecture.

Examples:

- Java Collections
- Spring Framework
- Hibernate Framework
- JUnit

## Collection vs Collections

This is an extremely important interview question.

### Collection

- Interface
- Package: `java.util`
- Stores a group of objects

```java
Collection<String> c;
```

### Collections

- Utility class
- Contains static helper methods

```java
Collections.sort(list);
Collections.reverse(list);
Collections.shuffle(list);
Collections.max(list);
Collections.min(list);
```

> [!TIP]
> **Interview answer:** `Collection` → an interface that stores objects. `Collections` → a utility class that provides static helper methods.

### Collection vs Collections vs Arrays

| Collection | Collections | Arrays |
| --- | --- | --- |
| Interface | Utility Class | Utility Class |
| Stores Objects | Static Methods | Static Methods |
| `add()` | `sort()` | `sort()` |
| `remove()` | `reverse()` | `binarySearch()` |

## Java Collections Hierarchy

```tree
Iterable
  Collection
    List
      ArrayList
      LinkedList
      Vector
        Stack
    Set
      HashSet
        LinkedHashSet
      TreeSet
    Queue
      PriorityQueue
      LinkedList
```

```tree Map has a separate hierarchy
Map
  HashMap
    LinkedHashMap
  TreeMap
  Hashtable
  WeakHashMap
  IdentityHashMap
  EnumMap
  ConcurrentHashMap
```

> [!IMPORTANT]
> **Map does NOT extend Collection.** A favourite interview question.

## Why Doesn't Map Extend Collection?

- `Collection` stores **objects**.
- `Map` stores **key → value** pairs.

Completely different architecture. Hence, `Map` has its own hierarchy.

## Root Interfaces

There are four major interfaces: `Collection`, `Map`, `Iterator`, `Iterable`. Everything else extends these.

### Iterable

Java 5 introduced the enhanced for loop:

```java
for (Object obj : collection)
```

This works because `Collection` extends `Iterable`. `Iterable` provides `iterator()`.

```java
Iterable<String> itr;
```

### Iterator

`Iterator` allows traversal.

```java
Iterator<Integer> itr = list.iterator();
while (itr.hasNext()) {
    System.out.println(itr.next());
}
```

## Benefits of Collections Framework

- Dynamic Size
- Reusable Classes
- High Performance
- Standard API
- Sorting
- Searching
- Thread-safe Alternatives
- Generics Support
- Stream API Support
- Easy Maintenance

## Generics + Collections

### Before Java 5

```java
ArrayList list = new ArrayList();
list.add(10);
list.add("ABC");
```

You need casting:

```java
Integer i = (Integer) list.get(0);
```

### After Generics

```java
ArrayList<Integer> list = new ArrayList<>();
list.add(10);
```

**Compile-time type safety.**

### Diamond Operator

Java 7 introduced the Diamond Operator. Instead of:

```java
ArrayList<Integer> list = new ArrayList<Integer>();
```

use:

```java
ArrayList<Integer> list = new ArrayList<>();
```

Cleaner and shorter.

## Iterable Example

```java
List<String> names = new ArrayList<>();

names.add("Rahul");
names.add("Ankit");
names.add("John");

for (String name : names) {
    System.out.println(name);
}
```

Internally, Java converts this into an `Iterator`.

## Real-life Analogy

Imagine a **Library**:

| Library | Java |
| --- | --- |
| Books | Collection (the objects) |
| Library Rules | Framework |
| Shelf Types | `List`, `Set`, `Queue` |
| Shelf Implementations | `ArrayList`, `LinkedList`, `HashSet`, `TreeSet`, `PriorityQueue` |

## Common Interview Questions

### Q1. What is the Java Collection Framework?

A set of interfaces and classes that provides an architecture to store and manipulate groups of objects dynamically.

### Q2. Why not Arrays?

- Fixed Size
- No Built-in Methods
- Difficult Insertion & Deletion
- No Dynamic Resizing
- Less Flexible

### Q3. Difference between Collection and Collections?

- `Collection` → Interface
- `Collections` → Utility Class

### Q4. Does Map extend Collection?

No. `Map` is a separate hierarchy because it stores key-value pairs instead of individual elements.

### Q5. Which is the root interface?

- `Collection` is the root interface for most collection types.
- `Iterable` sits above `Collection` and enables iteration.
- `Map` has its own hierarchy.

### Q6. Why was Iterable introduced?

To support the enhanced for-each loop (`for (T item : collection)`) through the `iterator()` method.

## Chapter Summary

- A Collection stores a group of objects as a single unit.
- Arrays have fixed size; Collections are dynamic.
- The Java Collections Framework provides reusable interfaces and implementations.
- `Collection` is an interface.
- `Collections` is a utility class.
- `Map` is not part of the Collection hierarchy.
- `Iterable` enables the enhanced for-each loop.
- Generics provide compile-time type safety.
