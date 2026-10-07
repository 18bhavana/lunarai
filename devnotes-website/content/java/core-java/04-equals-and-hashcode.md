---
title: equals() and hashCode()
subtitle: Logical equality, the hashCode contract and how HashMap and HashSet use both methods internally.
order: 4
---

## Introduction

Among all Java interview topics, `equals()` and `hashCode()` are some of the most frequently asked, especially for developers with 3–10 years of experience.

Almost every collection based on hashing depends on these two methods:

- `HashMap`
- `HashSet`
- `Hashtable`
- `LinkedHashMap`
- `ConcurrentHashMap`

Understanding them is essential for writing correct Java applications.

## Why Do We Need equals()?

Suppose we have two `Employee` objects:

```java
Employee e1 = new Employee(101, "John");
Employee e2 = new Employee(101, "John");
```

Logically, both employees represent the same person. But by default:

```java
System.out.println(e1.equals(e2));
```

```output
false
```

**Why?** Because the default implementation of `equals()` compares **memory addresses**, not object data.

## Default Implementation

Inside the `Object` class:

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

It simply checks whether both references point to the same object.

```refs Different objects, different addresses → equals() returns false
e1 -> Object A
e2 -> Object B
```

## Overriding equals()

Most business objects should compare their **state**, not their memory address.

```java
import java.util.Objects;

class Employee {

    private int id;
    private String name;

    Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (obj == null)
            return false;
        if (getClass() != obj.getClass())
            return false;
        Employee other = (Employee) obj;
        return id == other.id &&
               Objects.equals(name, other.name);
    }
}
```

Now:

```java
Employee e1 = new Employee(101, "John");
Employee e2 = new Employee(101, "John");
System.out.println(e1.equals(e2));
```

```output
true
```

## Steps for Writing equals()

Always follow this sequence:

1. `this == obj`
2. `obj == null`
3. `getClass()` or `instanceof`
4. Type casting
5. Compare fields

This pattern is widely accepted and easy to understand.

## Understanding hashCode()

`hashCode()` returns an integer. This integer is used to decide **where an object should be stored** inside hash-based collections.

```java
Employee e = new Employee(101, "John");
System.out.println(e.hashCode());
```

```output
16273829
```

The exact value is not important. What matters is that **equal objects must produce the same hash code**.

## Why Does Java Need Hash Codes?

Imagine a library with one million books. Without numbering, you must search every shelf. With numbering, you go directly to the correct section.

Similarly, `HashMap` uses:

```flow Hash codes make searching extremely fast
hashCode()
Bucket
equals()
Object Found
```

## Internal Working of HashMap

When inserting `map.put(key, value);` Java performs:

```flow
Step 1 | key.hashCode()
Step 2 | Calculate Bucket Index
Step 3 | Go to Bucket
Step 4 | Use equals()
Store or Update Entry
```

During retrieval, `map.get(key);` Java repeats the same process.

### Bucket Example

Suppose `Employee(101)` has `hashCode = 13`, and the table has 5 buckets: `13 % 5 = 3`. The object is stored in **Bucket 3**.

```buckets
0:
1:
2:
3: Employee(101)
4:
```

## Hash Collision

Different objects can end up in the same bucket. Example (10 buckets): `Employee A` has `hashCode = 25` and `Employee B` has `hashCode = 35`. Since `25 % 10 = 5` and `35 % 10 = 5`, both land in **Bucket 5**.

```buckets Both go into the same bucket: a hash collision
4:
5: Employee A (25), Employee B (35)
6:
```

This is called a **hash collision**. Java then uses `equals()` to identify the correct object.

## equals() and hashCode() Contract

Java defines a contract between these methods.

### Rule 1

If `a.equals(b)` returns `true`, then `a.hashCode() == b.hashCode()` must also be `true`.

### Rule 2

If `a.equals(b)` returns `false`, their hash codes **may be equal or different**.

### Rule 3

The same object should consistently return the same hash code while its state remains unchanged.

## Correct Implementation

```java
import java.util.Objects;

class Employee {

    private int id;
    private String name;

    Employee(int id, String name) {
        this.id = id;
        this.name = name;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (!(obj instanceof Employee))
            return false;
        Employee other = (Employee) obj;
        return id == other.id &&
               Objects.equals(name, other.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name);
    }
}
```

## What Happens If You Override Only equals()?

```java
HashSet<Employee> set = new HashSet<>();
set.add(new Employee(101, "John"));
set.add(new Employee(101, "John"));
System.out.println(set.size());
```

Expected `1`, but possible output:

```output
2
```

**Reason:** different hash codes place the objects in different buckets.

## What Happens If You Override Only hashCode()?

Objects may land in the same bucket, but `equals()` still compares references, so duplicates are not recognized correctly.

> [!IMPORTANT]
> Always override both methods together.

## Objects.equals() vs equals()

Instead of:

```java
name.equals(other.name);
```

use:

```java
Objects.equals(name, other.name);
```

**Why?** It safely handles `null`.

```java
Objects.equals(null, null)
```

```output
true
```

No `NullPointerException`.

## instanceof vs getClass()

**Using `instanceof`** — accepts subclasses:

```java
if (!(obj instanceof Employee))
```

**Using `getClass()`** — requires exactly the same runtime class:

```java
if (getClass() != obj.getClass())
```

Choose based on your equality requirements.

## How IDEs Help

Modern IDEs can generate both methods automatically. Generated code usually uses `Objects.equals()` and `Objects.hash()`, which are clean and reliable.

## Real Project Examples

### Entity Classes

`Employee`, `Customer`, `Order`, `Product` — typically compared using a unique identifier.

### DTO Classes

Useful when comparing request or response objects.

### Cache Keys

Objects used as cache keys must implement `equals()` and `hashCode()` correctly.

## Interview Questions

### Q1. Why should equals() and hashCode() be overridden together?

Because hash-based collections depend on both methods to locate and compare objects correctly.

### Q2. Can two unequal objects have the same hash code?

Yes. This is called a **hash collision**.

### Q3. Can two equal objects have different hash codes?

No. That violates the Java contract.

### Q4. Which method is called first in HashMap?

`hashCode()`. After finding the bucket, `equals()` is used if necessary.

### Q5. Can hashCode() return a negative number?

Yes. Java allows negative hash codes.

### Q6. Why isn't hashCode() guaranteed to be unique?

Because an `int` has a limited range, while the number of possible objects is effectively unlimited.

### Q7. Why does HashSet rely on hashCode()?

To quickly locate the correct bucket before checking equality.

### Q8. Can immutable objects safely cache their hash code?

Yes. Since their state never changes, the hash code remains valid.

## Common Mistakes

- Overriding `equals()` without `hashCode()`.
- Comparing strings using `==`.
- Ignoring `null` checks.
- Using mutable fields in `hashCode()` when objects are stored in a `HashMap` or `HashSet`.

## Best Practices

- Always override `equals()` and `hashCode()` together.
- Use `Objects.equals()` for object comparisons.
- Use `Objects.hash()` for generating hash codes.
- Prefer immutable fields in equality calculations.
- Keep implementations simple, consistent, and deterministic.

## Quick Revision

```flow
equals() | Logical Equality
hashCode() | Bucket Selection
HashMap
equals()
Correct Object
```

## Chapter Summary

After completing this chapter, you should be able to:

- Explain the purpose of `equals()` and `hashCode()`.
- Describe the contract between the two methods.
- Understand how `HashMap` and `HashSet` use hashing internally.
- Correctly implement `equals()` and `hashCode()` for domain objects.
- Answer common interview questions and identify incorrect implementations during code reviews.
