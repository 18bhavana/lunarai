---
title: String, StringBuilder & StringBuffer
subtitle: Immutability, the String Constant Pool, mutable builders, capacity growth and choosing the right class.
order: 6
---

## Introduction

One of the most important Java interview topics is the difference between:

- `String`
- `StringBuilder`
- `StringBuffer`

Every Java developer must know:

- Why `String` is immutable
- Why `StringBuilder` is faster
- Why `StringBuffer` is thread-safe
- When to use each one

This topic is asked in almost every Java interview for 2–10 years of experience.

## What is a String?

A `String` is a sequence of characters.

```java
String name = "Java";
```

Internally: `J A V A`

But unlike arrays, a `String` object **cannot be modified after it is created**. This property is called **Immutability**.

## Creating Strings

There are two ways.

### Method 1 — Using a String Literal

```java
String s1 = "Java";
```

Stored in the **String Constant Pool (SCP)**.

### Method 2 — Using new

```java
String s2 = new String("Java");
```

Stored in **Heap Memory**.

## String Constant Pool (SCP)

Java maintains a special memory area called the String Constant Pool. **Purpose:** avoid duplicate `String` objects.

```java
String s1 = "Java";
String s2 = "Java";
```

```refs Only one object exists, so memory is saved
s1, s2 -> String Pool | "Java"
```

### Using new

```java
String s1 = new String("Java");
String s2 = new String("Java");
```

```refs Now two objects exist
s1 -> Heap · Object A
s2 -> Heap · Object B
```

## Why is String Immutable?

```java
String s = "Java";
s.concat("8");
```

```output
Java
```

The original object is unchanged. **Correct:**

```java
s = s.concat("8");
```

```output
Java8
```

A new `String` object is created.

### Internal Working

```java
String s = "Java";
s = s.concat("17");
```

```flow-h The old object remains unchanged until garbage collected
Before | s → "Java"
After concat | s → "Java17" | "Java" still exists
```

### Advantages of Immutability

- Thread-safe
- Secure
- Enables String Pool
- Safe as `HashMap` keys
- Easy caching
- Better performance in many scenarios

## Common String Methods

```java
String s = "Java Programming";
```

| Operation | Code | Output |
| --- | --- | --- |
| Length | `s.length()` | `16` |
| Character | `s.charAt(2)` | `v` |
| Substring | `s.substring(5)` | `Programming` |
| Contains | `s.contains("Prog")` | `true` |
| Replace | `s.replace("Java", "Python")` | `Python Programming` |
| Uppercase | `s.toUpperCase()` | `JAVA PROGRAMMING` |
| Lowercase | `s.toLowerCase()` | `java programming` |
| Trim | `" Java ".trim()` | `Java` |
| Split | `s.split(" ")` | `["Java", "Programming"]` |

## StringBuilder

`StringBuilder` is a **mutable** sequence of characters.

```java
StringBuilder sb = new StringBuilder("Java");
sb.append("17");
```

```output
Java17
```

No new object is created. The existing object is modified.

### Internal Working

```flow Same object throughout
StringBuilder | "Java"
: append()
"Java17"
: append()
"Java17 Spring"
: append()
"Java17 Spring Boot"
```

## StringBuffer

`StringBuffer` is also mutable.

```java
StringBuffer sb = new StringBuffer("Java");
sb.append("17");
```

```output
Java17
```

Works almost like `StringBuilder`.

## Difference Between StringBuilder and StringBuffer

The major difference is **thread safety**.

- **`StringBuffer`** — uses `synchronized` methods. Safe for multiple threads.
- **`StringBuilder`** — does not use synchronization. Much faster.

## Performance Comparison

```java
String s = "";

for (int i = 0; i < 10000; i++) {
    s = s + i;
}
```

Every iteration creates a new `String` object. **Very slow.**

Using `StringBuilder`:

```java
StringBuilder sb = new StringBuilder();

for (int i = 0; i < 10000; i++) {
    sb.append(i);
}
```

Only one object. **Much faster.**

## String vs StringBuilder vs StringBuffer

| Feature | String | StringBuilder | StringBuffer |
| --- | --- | --- | --- |
| Mutable | No | Yes | Yes |
| Thread Safe | Yes (immutable) | No | Yes |
| Performance | Slow for repeated modification | Fastest | Slightly slower |
| Synchronization | Not required | No | Yes |
| Memory | Creates new object on modification | Same object | Same object |

## Capacity

Default capacity:

```java
StringBuilder sb = new StringBuilder();
System.out.println(sb.capacity());
```

```output
16
```

### With Initial String

```java
StringBuilder sb = new StringBuilder("Java");
```

Capacity = length + 16 = 4 + 16 = **20**.

### Capacity Expansion

When capacity is exceeded, Java expands using:

```text
newCapacity = (oldCapacity * 2) + 2
```

```flow-h This minimizes reallocations and improves performance
16
34
70
142
```

## Common Methods

| Method | Code |
| --- | --- |
| Append | `sb.append("Java");` |
| Insert | `sb.insert(4, "8");` |
| Delete | `sb.delete(2, 5);` |
| Reverse | `sb.reverse();` |
| Replace | `sb.replace(0, 4, "Python");` |
| Length | `sb.length();` |
| Capacity | `sb.capacity();` |

## String Pool Examples

```java
String s1 = "Java";
String s2 = "Java";
System.out.println(s1 == s2);
```

```output
true
```

```java
String s1 = new String("Java");
String s2 = new String("Java");
System.out.println(s1 == s2);
```

```output
false
```

### intern() Method

```java
String s1 = new String("Java");
String s2 = s1.intern();
System.out.println(s2 == "Java");
```

```output
true
```

`intern()` returns the pooled `String` if it already exists; otherwise it adds the string to the pool.

## Real Project Usage

### String

- Configuration values
- JSON keys
- API URLs
- Database column names

### StringBuilder

- Building SQL queries
- Generating reports
- Creating JSON or XML
- Constructing log messages

### StringBuffer

- Legacy multi-threaded code
- Older APIs requiring synchronized mutable strings

> [!TIP]
> In modern applications, `StringBuilder` is usually preferred unless thread safety is required.

## Interview Questions

### Q1. Why is String immutable?

For security, thread safety, caching, and efficient use of the String Constant Pool.

### Q2. Where are String literals stored?

In the String Constant Pool.

### Q3. Where are Strings created using new stored?

In Heap Memory.

### Q4. Which is faster?

`StringBuilder`, because it is not synchronized.

### Q5. Which is thread-safe?

`StringBuffer`.

### Q6. Can StringBuilder be shared safely across multiple threads?

No. Use external synchronization or `StringBuffer` if required.

### Q7. Why does String concatenation inside loops perform poorly?

Because each concatenation creates a new immutable `String` object.

### Q8. What is the default capacity of StringBuilder?

16 characters.

### Q9. What does intern() do?

It returns the canonical representation of a string from the String Constant Pool.

### Q10. Should we always use StringBuilder instead of String?

No. Use `String` for immutable text and ordinary values. Use `StringBuilder` only when frequent modifications are required.

## Common Mistakes

- Using `String` concatenation inside loops.
- Using `==` for `String` content comparison.
- Using `StringBuffer` unnecessarily in single-threaded code.
- Assuming `concat()` modifies the original `String`.

## Best Practices

- Use `String` for constants and immutable values.
- Use `StringBuilder` for repeated string modifications.
- Use `StringBuffer` only when synchronized mutable strings are genuinely needed.
- Use `equals()` instead of `==` for comparing `String` contents.
- Prefer `StringBuilder` in loops and high-performance code.

## Quick Revision

```flow
String
Immutable
Thread Safe
String Pool
---
StringBuilder
Mutable
Fast
Not Thread Safe
---
StringBuffer
Mutable
Thread Safe
Synchronized
```

## Chapter Summary

After completing this chapter, you should be able to:

- Explain why `String` is immutable.
- Describe the String Constant Pool and how it saves memory.
- Understand the differences between `String`, `StringBuilder`, and `StringBuffer`.
- Explain capacity and internal expansion of `StringBuilder`.
- Choose the right class based on performance and thread-safety requirements.
- Confidently answer interview questions related to `String` handling in Java.
