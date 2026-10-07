---
title: == vs equals()
subtitle: Reference comparison vs logical equality, with String pool, wrapper caching, enum and null-check cases.
order: 5
---

## Introduction

One of the most frequently asked Java interview questions is:

> What is the difference between `==` and `equals()`?

Although both are used for comparison, they serve completely different purposes. Using the wrong one can introduce subtle bugs into your application.

## What is ==?

`==` is a Java **operator**. It compares:

- Primitive values
- Object references (memory addresses)

The behaviour depends on the type being compared.

## == with Primitive Types

For primitive data types, `==` compares **actual values**.

```java
int a = 10;
int b = 10;
System.out.println(a == b);
```

```output
true
```

Another example:

```java
double x = 10.5;
double y = 20.5;
System.out.println(x == y);
```

```output
false
```

For primitives, `==` compares the stored values.

## == with Objects

For objects, `==` compares **references, not object contents**.

```java
Employee e1 = new Employee();
Employee e2 = new Employee();
System.out.println(e1 == e2);
```

```output
false
```

```refs Different addresses → different references → == returns false
e1 -> Object A
e2 -> Object B
```

### Same Reference Example

```java
Employee e1 = new Employee();
Employee e2 = e1;
System.out.println(e1 == e2);
```

```output
true
```

```refs Both references point to the same object
e1, e2 -> Object A
```

## What is equals()?

`equals()` is a **method** defined in the `Object` class. Its purpose is to compare **logical equality**.

Default implementation:

```java
public boolean equals(Object obj) {
    return this == obj;
}
```

By default, `equals()` behaves exactly like `==`. Only after overriding it does logical comparison become possible.

### Example Without Overriding

```java
Employee e1 = new Employee();
Employee e2 = new Employee();
System.out.println(e1.equals(e2));
```

```output
false
```

**Reason:** the default implementation compares references.

### Example With Overriding

```java
import java.util.Objects;

class Employee {
    int id;

    Employee(int id) {
        this.id = id;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (!(obj instanceof Employee))
            return false;
        Employee other = (Employee) obj;
        return id == other.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

Usage:

```java
Employee e1 = new Employee(101);
Employee e2 = new Employee(101);
System.out.println(e1.equals(e2));
```

```output
true
```

Although they are different objects, they represent the same employee.

## == vs equals()

| == | equals() |
| --- | --- |
| Operator | Method |
| Compares references (objects) | Compares logical equality |
| Compares values (primitives) | Can be overridden |
| Faster | Slightly slower due to method call |
| Cannot be customized | Fully customizable |

## Memory Example

```java
Employee e1 = new Employee(101);
Employee e2 = new Employee(101);
```

```refs
e1 -> Object A | id = 101
e2 -> Object B | id = 101
```

| Expression | Output | Why |
| --- | --- | --- |
| `e1 == e2` | `false` | References differ |
| `e1.equals(e2)` | `true` | IDs are equal |

## String Comparison

This is where most beginners get confused.

```java
String s1 = "Java";
String s2 = "Java";
System.out.println(s1 == s2);
```

```output
true
```

**Why?** Because both strings are stored in the **String Constant Pool**.

```refs Both variables point to the same pooled object
s1, s2 -> String Pool | "Java"
```

### Using new

```java
String s1 = new String("Java");
String s2 = new String("Java");
```

```refs Two separate heap objects
s1 -> Heap · Object A | "Java"
s2 -> Heap · Object B | "Java"
```

```java
System.out.println(s1 == s2);
```

```output
false
```

Because two separate objects were created. But:

```java
System.out.println(s1.equals(s2));
```

```output
true
```

Because `String` overrides `equals()` to compare characters.

### String Pool Example

```java
String s1 = "Hello";
String s2 = "Hello";
String s3 = new String("Hello");
System.out.println(s1 == s2);
System.out.println(s1 == s3);
System.out.println(s1.equals(s3));
```

```output
true
false
true
```

## Wrapper Class Example

```java
Integer a = 100;
Integer b = 100;
System.out.println(a == b);
```

```output
true
```

**Why?** Because Java caches wrapper objects from **-128 to 127**.

Now:

```java
Integer a = 200;
Integer b = 200;
System.out.println(a == b);
```

```output
false
```

Different objects are created. But:

```java
System.out.println(a.equals(b));
```

```output
true
```

## Null Comparison

**Wrong:**

```java
String s = null;
s.equals("Java");
```

```output
NullPointerException
```

**Correct:**

```java
Objects.equals(s, "Java");
```

```output
false
```

> [!TIP]
> Always prefer `Objects.equals()` when values can be `null`.

## Real Project Examples

### Entity Comparison

```java
employee1.equals(employee2)
```

Compare business identity.

### Enum Comparison

```java
status == Status.ACTIVE
```

Enums are singletons. Using `==` is recommended.

### Null Checks

```java
if (obj == null)
```

Always use `==`. Never use `obj.equals(null)`.

### Comparing Strings

**Correct:**

```java
username.equals(input)
// or
Objects.equals(username, input)
```

**Wrong:**

```java
username == input
```

## Interview Questions

### Q1. What does == compare?

- Primitive values
- Object references

### Q2. What does equals() compare?

Logical equality.

### Q3. Can equals() be overridden?

Yes. It is designed for customization.

### Q4. Can == be overridden?

No. It is an operator.

### Q5. Why does "Java" == "Java" return true?

Because both references point to the same object in the String Constant Pool.

### Q6. Why does new String("Java") == new String("Java") return false?

Because two separate heap objects are created.

### Q7. Should enums be compared using == or equals()?

Use `==`. It is faster and safe because each enum constant exists only once.

### Q8. Why shouldn't we compare strings using ==?

Because `==` compares references instead of character content.

## Common Mistakes

- Comparing strings with `==`.
- Using `equals()` without checking for `null`.
- Assuming `==` compares object contents.
- Forgetting that wrapper classes cache values between -128 and 127.

## Best Practices

- Use `==` for primitive values.
- Use `==` for enum comparisons.
- Use `==` for null checks.
- Use `equals()` for comparing object contents.
- Use `Objects.equals()` when either value may be `null`.

## Quick Revision

```flow
Primitive
==
Compare Values
---
Objects
==
Compare References
---
Objects
equals()
Compare Contents
```

## Interview Cheat Sheet

| Scenario | Use |
| --- | --- |
| Primitive comparison | `==` |
| String comparison | `equals()` |
| Enum comparison | `==` |
| Null check | `==` |
| Business object comparison | `equals()` |
| Nullable object comparison | `Objects.equals()` |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain the difference between `==` and `equals()`.
- Understand reference comparison versus logical equality.
- Explain why `String` behaves differently from most classes.
- Understand wrapper object caching and its effect on `==`.
- Know when to use `==`, `equals()`, and `Objects.equals()` in real-world Java applications.
- Confidently answer one of the most common Java interview questions.
