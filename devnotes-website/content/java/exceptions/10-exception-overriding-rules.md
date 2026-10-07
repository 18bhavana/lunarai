---
title: Exception Overriding Rules
subtitle: Same, narrower or none — never broader. Checked vs unchecked rules for overriding, interfaces, abstract classes and constructors.
order: 10
---

## Why Do We Need Exception Overriding Rules?

```java
class Parent {
    void process() throws IOException {
    }
}
```

Now suppose a child class overrides it:

```java
class Child extends Parent {
    @Override
    void process() throws Exception {
    }
}
```

Should Java allow this? **No.**

**Why?** Because a caller expecting only an `IOException` would suddenly have to handle **every** checked exception. Java prevents this to **preserve the method contract**.

## Method Overriding Refresher

A child method with the **same signature** as the parent method **overrides** it. When overriding, Java checks:

- Return type
- Access modifier
- **Checked exceptions**

## Rules for Checked Exceptions

### Rule 1 — Same checked exception ✅

```java
class Parent {
    void read() throws IOException {
    }
}

class Child extends Parent {
    @Override
    void read() throws IOException {
    }
}
```

**Valid.** The contract remains unchanged.

### Rule 2 — A subclass of the parent exception ✅

```java
// Parent
void read() throws IOException {
}

// Child
void read() throws FileNotFoundException {
}
```

```tree The child is narrowing the contract
IOException
  FileNotFoundException
```

**Valid.**

### Rule 3 — A broader checked exception ❌

```java
// Parent
void read() throws IOException {
}

// Child
void read() throws Exception {   // Compilation error
}
```

```tree Exception is above IOException
Exception
  IOException
```

The child would **expand** the method contract, breaking callers that only expect `IOException`.

### Rule 4 — No exception at all ✅

```java
// Parent
void save() throws IOException {
}

// Child
void save() {
}
```

**Valid.** The child is making the method safer by not throwing a checked exception.

### Summary for Checked Exceptions

| Parent method | Child method | Valid? |
| --- | --- | --- |
| `throws IOException` | `throws IOException` | ✅ |
| `throws IOException` | `throws FileNotFoundException` | ✅ |
| `throws IOException` | No exception | ✅ |
| `throws IOException` | `throws Exception` | ❌ |
| `throws IOException` | `throws SQLException` | ❌ |

## Rule 5 — Runtime Exceptions Are Different

```java
// Parent
void calculate() {
}

// Child
void calculate() throws ArithmeticException {
}
```

**Valid.** Runtime exceptions are **not part of the checked exception contract**.

More examples — all valid:

```java
// Parent
void test() {
}

// Child
void test() throws RuntimeException {
}

void test() throws IllegalArgumentException {
}
```

> [!IMPORTANT]
> **Rule:** a child may introduce **any unchecked exception**.

### Why This Difference?

Checked exceptions affect the caller:

```java
parent.read();
```

The compiler knows this call can throw `IOException`. If the child could throw `Exception`, the caller would unexpectedly need to handle more exception types. Unchecked exceptions are considered programming errors, so Java does not enforce this restriction.

## Exception Hierarchy Example

```tree
Exception
  IOException
    FileNotFoundException
  SQLException
```

If the parent declares `throws IOException`, the child may throw `IOException` or `FileNotFoundException` — but **not** `SQLException`, because it is unrelated.

## Interfaces and Abstract Classes

### Interface Methods

```java
interface Reader {
    void read() throws IOException;
}
```

```java
class FileReaderImpl implements Reader {

    @Override
    public void read() throws IOException {               // ✅ Valid
    }
}
```

| Implementation | Valid? |
| --- | --- |
| `public void read() throws IOException` | ✅ |
| `public void read()` | ✅ |
| `public void read() throws FileNotFoundException` | ✅ |
| `public void read() throws Exception` | ❌ |

### Abstract Classes

```java
abstract class Vehicle {
    abstract void start() throws IOException;
}

class Car extends Vehicle {
    @Override
    void start() throws IOException {
    }
}
```

The rules remain the same.

## Constructors and Exceptions

Constructors are **not inherited**, so the overriding rules don't apply to them.

```java
class Parent {
    Parent() throws IOException {
    }
}

class Child extends Parent {
    Child() throws IOException {
        super();
    }
}
```

This is valid.

> [!WARNING]
> **Interview trap — the rule flips for constructors.** Because every child constructor calls `super()`, a child constructor must declare the parent constructor's checked exception **or a broader one** (e.g. `Child() throws Exception` is fine). It cannot declare *less*, and it cannot catch the exception either, since `super()` must be the first statement.

## Multiple Levels of Inheritance

```flow Each level narrows the checked exception contract — valid
GrandParent | throws Exception
Parent | throws IOException
Child | throws FileNotFoundException
```

## Polymorphism Example

```java
Parent parent = new Child();

parent.read();
```

The compiler checks the **`Parent`** method signature. If `Child` could declare broader checked exceptions, this code would become unsafe. This is the **primary reason** Java restricts checked exceptions in overriding.

### Overriding with Runtime Exceptions

```java
// Parent
void process() {
}

// Child
void process() throws NullPointerException {
}
```

**Valid.** Even if the parent declares no exceptions, the child may declare unchecked exceptions.

## Common Compilation Errors

### Broader Checked Exception

```java
class Parent {
    void test() throws IOException {
    }
}

class Child extends Parent {
    @Override
    void test() throws Exception {   // Compilation error
    }
}
```

### Unrelated Checked Exception

```java
class Parent {
    void test() throws IOException {
    }
}

class Child extends Parent {
    @Override
    void test() throws SQLException {   // Compilation error
    }
}
```

## Enterprise Example

Service interface:

```java
public interface UserService {
    User findById(Long id);
}
```

Implementation:

```java
public User findById(Long id) {
    throw new UserNotFoundException("User not found");
}
```

`UserNotFoundException extends RuntimeException`, so no `throws` declaration is required. This is a common pattern in Spring Boot applications.

## Interview Trick Questions

### Parent throws Exception, child throws IOException

```java
// Parent
void test() throws Exception {
}

// Child
void test() throws IOException {
}
```

✅ **Valid** — narrower.

### Parent throws IOException, child throws Exception

```java
// Parent
void test() throws IOException {
}

// Child
void test() throws Exception {
}
```

❌ **Invalid** — broader.

### Parent throws nothing, child throws RuntimeException

```java
// Parent
void test() {
}

// Child
void test() throws RuntimeException {
}
```

✅ **Valid** — unchecked.

### Parent throws nothing, child throws IOException

```java
// Parent
void test() {
}

// Child
void test() throws IOException {
}
```

❌ **Invalid.** A child cannot introduce a new checked exception if the parent method does not declare it.

## Memory Trick

```flow This simple rule answers most interview questions
Checked exceptions
Same or smaller
Never bigger
---
Runtime exceptions
Anything goes
```

## Best Practices

- Keep overridden method contracts compatible.
- Narrow checked exceptions whenever possible.
- Prefer unchecked exceptions for business validation in enterprise applications.
- Avoid declaring broad exceptions such as `Exception`.
- Design interfaces with specific checked exceptions only when callers can recover.

## Interview Questions

### Q1. Can an overridden method throw a broader checked exception?

No.

### Q2. Can it throw a subclass of the parent's checked exception?

Yes.

### Q3. Can it remove the checked exception completely?

Yes.

### Q4. Can an overridden method introduce unchecked exceptions?

Yes.

### Q5. Why does Java enforce these rules?

To preserve the method contract and ensure callers remain compatible with subclasses.

### Q6. Do these rules apply to constructors?

No. Constructors are not inherited or overridden — and a child constructor must declare the parent constructor's checked exceptions (or broader ones).

### Q7. Do these rules apply to interface implementations?

Yes. Implementing methods follow the same checked exception rules as overridden methods.

## Chapter Summary

- ✅ Exception rules in method overriding: same, narrower, none — never broader
- ✅ Runtime exception rules
- ✅ Interface and abstract class rules
- ✅ Constructor behaviour
- ✅ Polymorphism and exception contracts
- ✅ Common compilation errors and interview trick questions
