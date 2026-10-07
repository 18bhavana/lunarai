---
title: Wrapper Classes & Autoboxing
subtitle: Object versions of primitives, autoboxing and unboxing, Integer caching and the null-unboxing trap.
order: 8
---

## Introduction

Java provides **Wrapper Classes** to represent primitive data types as objects. They are heavily used in:

- Collections (`ArrayList`, `HashMap`, `HashSet`)
- Generics
- Streams API
- Reflection
- Frameworks like Spring Boot and Hibernate

Without wrapper classes, many Java APIs would not work with primitive values.

## What are Wrapper Classes?

A Wrapper Class is an object representation of a primitive data type.

| Primitive | Wrapper Class |
| --- | --- |
| `byte` | `Byte` |
| `short` | `Short` |
| `int` | `Integer` |
| `long` | `Long` |
| `float` | `Float` |
| `double` | `Double` |
| `char` | `Character` |
| `boolean` | `Boolean` |

```java
int age = 25;
Integer wrapperAge = Integer.valueOf(age);
```

Now `wrapperAge` is an object.

## Why Do We Need Wrapper Classes?

Collections store **objects, not primitives**.

**Wrong:**

```java
ArrayList<int> list = new ArrayList<>();   // Compilation Error
```

**Correct:**

```java
ArrayList<Integer> list = new ArrayList<>();
```

Collections require object references.

## Wrapper Class Hierarchy

```tree
Object
  Number
    Byte
    Short
    Integer
    Long
    Float
    Double
  Character
  Boolean
```

> [!NOTE]
> `Character` and `Boolean` do **not** extend `Number`.

## Creating Wrapper Objects

### Method 1 — valueOf() (Recommended)

```java
Integer number = Integer.valueOf(100);
```

### Method 2 — Autoboxing

```java
Integer number = 100;
```

The compiler converts it internally to:

```java
Integer number = Integer.valueOf(100);
```

### Deprecated Constructor

```java
Integer number = new Integer(100);
```

> [!WARNING]
> Avoid this. The constructor is deprecated.

## Unboxing

Converting **Wrapper → Primitive**.

```java
Integer number = 100;
int value = number;
```

The compiler automatically converts this to:

```java
int value = number.intValue();
```

## Autoboxing

Introduced in **Java 5**. **Primitive → Wrapper**.

```java
Integer num = 50;
```

Internally:

```java
Integer num = Integer.valueOf(50);
```

No explicit conversion required.

## Auto-Unboxing

**Wrapper → Primitive**.

```java
Integer number = 10;
int value = number;
```

Internally:

```java
int value = number.intValue();
```

## Complete Example

```java
Integer age = 25;
int x = age;
Integer y = x;
```

```flow-h
Primitive
: Autoboxing
Wrapper
: Auto-Unboxing
Primitive
```

## Integer Caching

This is one of the most common interview questions.

```java
Integer a = 100;
Integer b = 100;
System.out.println(a == b);
```

```output
true
```

**Why?** Java caches `Integer` objects from **-128 to 127**. Both variables refer to the same cached object.

```java
Integer a = 200;
Integer b = 200;
System.out.println(a == b);
```

```output
false
```

Because 200 is outside the cache range, two separate objects are created.

### Integer Cache Memory

```flow-h Objects within this range are reused
-128
…
0
…
100
…
127
```

## equals() vs ==

```java
Integer a = 200;
Integer b = 200;
System.out.println(a == b);
```

```output
false
```

```java
System.out.println(a.equals(b));
```

```output
true
```

> [!TIP]
> Always use `equals()` when comparing wrapper object values.

## NullPointerException During Unboxing

```java
Integer number = null;
int value = number;
```

```output
NullPointerException
```

Because Java tries to execute `number.intValue()` on `null`.

> [!WARNING]
> Always check for `null` before unboxing.

## Useful Wrapper Methods

| Method | Code | Output |
| --- | --- | --- |
| Parse | `Integer.parseInt("100")` | `100` (int) |
| valueOf() | `Integer.valueOf("200")` | `200` (Integer object) |
| toString() | `Integer.toString(10)` | `"10"` |
| compare() | `Integer.compare(20, 30)` | `-1` |
| max() | `Integer.max(10, 20)` | `20` |
| min() | `Integer.min(10, 20)` | `10` |
| sum() | `Integer.sum(20, 30)` | `50` |

## Parsing Numbers

```java
Double.parseDouble("10.25");
Long.parseLong("500");
Float.parseFloat("20.5");
Boolean.parseBoolean("true");
```

Used frequently while reading configuration files, JSON, CSV and properties files.

## Wrapper Classes in Collections

```java
List<Integer> numbers = List.of(10, 20, 30);
```

```flow-h Autoboxing happens automatically
10
Integer
Stored in List
```

## Wrapper Classes in Streams

```java
List<Integer> list = List.of(1, 2, 3);

list.stream()
    .map(i -> i * 2)
    .forEach(System.out::println);
```

Wrappers are required because collections cannot store primitives.

### Primitive Streams

Instead of `Stream<Integer>`, Java provides:

- `IntStream`
- `LongStream`
- `DoubleStream`

These avoid boxing overhead and improve performance.

## Real Project Examples

### Database

```java
Integer employeeId;
```

Allows `null` values from databases. A primitive `int` cannot represent SQL `NULL`.

### DTO

```java
private Integer age;
```

A missing JSON field becomes `null`.

### Collections

```java
List<Integer>
Set<Long>
Map<Integer, String>
```

Collections require wrapper classes.

## Wrapper Classes are Immutable

```java
Integer x = 100;
x++;
```

```flow-h A new object is created: wrapper classes are immutable
Old Integer | 100
New Integer | 101
```

## Interview Questions

### Q1. Why do wrapper classes exist?

To represent primitive values as objects so they can be used with collections, generics, and frameworks.

### Q2. What is Autoboxing?

Automatic conversion from primitive to wrapper object.

### Q3. What is Auto-Unboxing?

Automatic conversion from wrapper object to primitive.

### Q4. What is Integer caching?

Java caches `Integer` objects from -128 to 127.

### Q5. Why does Integer a = 100; Integer b = 100; return true with ==?

Because both references point to the same cached object.

### Q6. Why does Integer a = 200; Integer b = 200; return false with ==?

Because separate objects are created outside the cache range.

### Q7. Can Auto-Unboxing throw NullPointerException?

Yes — when attempting to unbox a `null` wrapper object.

### Q8. Which wrapper classes extend Number?

`Byte`, `Short`, `Integer`, `Long`, `Float`, and `Double`.

### Q9. Are wrapper classes mutable?

No. All wrapper classes are immutable.

### Q10. When should we use primitive types instead of wrappers?

Use primitives for better performance when `null` values are not required. Use wrappers when working with collections, generics, databases, serialization, or nullable fields.

## Common Mistakes

- Using `==` for wrapper value comparison.
- Forgetting `Integer` cache behaviour.
- Unboxing `null` values.
- Using deprecated wrapper constructors.

## Best Practices

- Use wrapper classes with collections and generics.
- Prefer primitives in performance-critical code when `null` is unnecessary.
- Use `equals()` to compare wrapper values.
- Always check for `null` before unboxing.
- Use `parseXxx()` methods for converting strings to primitives.

## Quick Revision

```flow
Primitive
: Autoboxing
Wrapper
Collections
: Auto-Unboxing
Primitive
---
Integer Cache
-128 to 127
Shared Objects
```

## Interview Cheat Sheet

| Requirement | Use |
| --- | --- |
| High performance | Primitive |
| Collections | Wrapper |
| Nullable value | Wrapper |
| Generic type | Wrapper |
| Compare wrapper values | `equals()` |
| Parse String | `parseXxx()` |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain the purpose of wrapper classes.
- Understand autoboxing and auto-unboxing.
- Describe `Integer` caching and its effect on `==`.
- Avoid common pitfalls such as `NullPointerException` during unboxing.
- Choose between primitives and wrapper classes based on performance and application requirements.
- Confidently answer wrapper class interview questions for Java developers.
