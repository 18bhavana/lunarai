---
title: Object Class
subtitle: The root of every Java class: toString, equals, hashCode, clone, getClass, wait/notify and finalize.
order: 3
---

## Introduction

In Java, every class directly or indirectly inherits from the `Object` class. It is the **root (superclass) of the Java class hierarchy**.

```java
class Employee {
}
```

The compiler internally treats it as:

```java
class Employee extends Object {
}
```

Even if you don't explicitly extend `Object`, Java does it automatically.

## Why Object Class?

The `Object` class provides common functionality that every Java object should have, such as:

- Comparing objects
- Generating hash codes
- Converting objects to strings
- Cloning objects
- Thread synchronization
- Runtime class information

Without `Object`, every class would need to implement these features separately.

## Object Class Hierarchy

```tree Every custom class eventually inherits from Object
Object
  Employee
  Student
  Animal
```

## Methods of Object Class

The most commonly used methods are:

| Method | Purpose |
| --- | --- |
| `toString()` | String representation of an object |
| `equals()` | Compare object equality |
| `hashCode()` | Generate hash value |
| `clone()` | Create object copy |
| `getClass()` | Return runtime class |
| `wait()` | Put thread into waiting state |
| `notify()` | Wake one waiting thread |
| `notifyAll()` | Wake all waiting threads |
| `finalize()` *(Deprecated)* | Cleanup before GC |

## 1. toString()

### Definition

Returns the string representation of an object. Default behaviour:

```java
Object obj = new Object();
System.out.println(obj);
```

```output
java.lang.Object@5e2de80c
```

Internally, `System.out.println(obj);` becomes `System.out.println(obj.toString());`

### Default Implementation

```java
getClass().getName() + '@' + Integer.toHexString(hashCode())
```

Example output: `Employee@4a54c0de`, where:

- `Employee` → Class Name
- `4a54c0de` → Hash code (hexadecimal)

### Overriding toString()

```java
class Employee {
    int id;
    String name;

    @Override
    public String toString() {
        return id + " " + name;
    }
}

Employee e = new Employee();
e.id = 101;
e.name = "John";
System.out.println(e);
```

```output
101 John
```

### Real-world Usage

Useful for logging, debugging, API responses and console output.

> [!TIP]
> Always override `toString()` for domain objects.

## 2. equals()

### Purpose

Compares two objects. The **default implementation compares memory addresses**.

```java
Employee e1 = new Employee();
Employee e2 = new Employee();
System.out.println(e1.equals(e2));
```

```output
false
```

Because both objects are stored at different memory locations.

### Overriding equals()

```java
class Employee {
    int id;

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (obj == null || getClass() != obj.getClass())
            return false;
        Employee other = (Employee) obj;
        return id == other.id;
    }
}
```

Now two employees having the same id are considered equal.

> [!IMPORTANT]
> Always override `equals()` together with `hashCode()`. Interviewers ask this very frequently.

## 3. hashCode()

### Purpose

Returns an integer hash value. Used heavily by `HashMap`, `HashSet`, `Hashtable` and `ConcurrentHashMap`.

### Why Needed?

Imagine a `HashMap`. Instead of searching every object, Java computes `hashCode()` and **directly jumps to the correct bucket**. Search becomes much faster.

### Contract

If `a.equals(b)` is `true`, then `a.hashCode() == b.hashCode()` must also be `true`.

The reverse is not guaranteed. Different objects can have the same hash code (**hash collision**).

### Example

```java
@Override
public int hashCode() {
    return Objects.hash(id);
}
```

### equals() vs hashCode()

| equals() | hashCode() |
| --- | --- |
| Compares equality | Generates hash value |
| Returns `boolean` | Returns `int` |
| Used after bucket lookup | Used before bucket lookup |
| Logical comparison | Fast indexing |

### HashMap Internal Flow

```flow
put(key, value)
hashCode()
Bucket Selection
equals()
Store / Retrieve Object
```

> [!WARNING]
> Without overriding both methods correctly, collections like `HashSet` and `HashMap` may behave unexpectedly.

## 4. clone()

### Purpose

Creates a copy of an object.

```java
class Employee implements Cloneable {
    @Override
    protected Object clone()
            throws CloneNotSupportedException {
        return super.clone();
    }
}
```

Usage:

```java
Employee e2 = (Employee) e1.clone();
```

### Shallow Copy

Both copied objects refer to the **same nested object**.

```refs Shallow copy
original, copy -> Address (shared)
```

### Deep Copy

Every referenced object is also copied. **Preferred in enterprise applications.**

```refs Deep copy
original -> Address
copy -> New Address
```

## 5. getClass()

Returns runtime class information.

```java
Employee e = new Employee();
System.out.println(e.getClass().getName());
```

```output
Employee
```

Used in reflection, frameworks, Spring and Hibernate.

## 6. wait()

Makes the current thread wait until another thread notifies it. **Must be called inside a synchronized block.**

```java
synchronized (obj) {
    obj.wait();
}
```

## 7. notify()

Wakes one waiting thread.

```java
synchronized (obj) {
    obj.notify();
}
```

## 8. notifyAll()

Wakes every waiting thread.

```java
synchronized (obj) {
    obj.notifyAll();
}
```

### wait() vs sleep()

| wait() | sleep() |
| --- | --- |
| `Object` class | `Thread` class |
| Releases lock | Doesn't release lock |
| Needs `synchronized` | Doesn't need `synchronized` |
| Used for inter-thread communication | Used for delaying execution |

## 9. finalize()

Called before garbage collection.

```java
protected void finalize() {
}
```

### Current Status

> [!WARNING]
> `finalize()` is **deprecated** because of unpredictable execution, performance issues and security concerns.

Use these instead:

- try-with-resources
- `AutoCloseable`
- `Cleaner` API

## Native Methods

Some `Object` class methods are `native` — implemented using platform-specific code. Examples:

- `hashCode()`
- `wait()`
- `notify()`
- `notifyAll()`

## Interview Questions

### Q1. Can we create an object of Object class?

Yes.

```java
Object obj = new Object();
```

### Q2. Can Object class be inherited?

Yes. Every class inherits it automatically.

### Q3. Why override toString()?

For meaningful output instead of `Employee@4a54c0de`.

### Q4. Why override hashCode() with equals()?

Because hash-based collections rely on both methods.

### Q5. Can two unequal objects have the same hashCode?

Yes. This is called a **hash collision**.

### Q6. Can two equal objects have different hashCodes?

No. That violates the `hashCode` contract.

### Q7. Why is wait() inside Object instead of Thread?

Because the **monitor (lock) belongs to the object**, not the thread.

### Q8. Can clone() copy private variables?

Yes. It copies the object's state, including private fields.

### Q9. Is finalize() guaranteed to execute?

No. The JVM does not guarantee when or even if it will run.

### Q10. Which Object methods are used most in enterprise applications?

`toString()`, `equals()`, `hashCode()` and `getClass()`.

The thread-related methods (`wait()`, `notify()`, `notifyAll()`) are less common in modern applications because higher-level concurrency utilities are often preferred.

## Common Mistakes

- Overriding `equals()` without `hashCode()`.
- Using `==` instead of `equals()` for object comparison.
- Relying on `finalize()` for resource cleanup.
- Using `clone()` for deep copying without handling nested objects.

## Best Practices

- Override `toString()` for readable logging.
- Always override `equals()` and `hashCode()` together.
- Prefer copy constructors or factory methods over `clone()` for complex objects.
- Use `getClass()` or `instanceof` appropriately depending on equality semantics.
- Prefer modern concurrency utilities (such as executors and locks) over low-level `wait()` / `notify()` where appropriate.

## Quick Revision

```tree
Object Class
  toString()
  equals()
  hashCode()
  clone()
  getClass()
  wait()
  notify()
  notifyAll()
  finalize() {deprecated}
```

## Chapter Summary

After completing this chapter, you should be able to:

- Explain why every Java class inherits from `Object`.
- Understand the purpose and implementation of all major `Object` class methods.
- Correctly implement `equals()` and `hashCode()`.
- Explain how `HashMap` uses hashing internally.
- Differentiate shallow copy from deep copy.
- Explain `wait()`, `notify()`, and `notifyAll()` for inter-thread communication.
- Answer common interview questions related to the `Object` class with confidence.
