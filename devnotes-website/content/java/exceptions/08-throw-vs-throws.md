---
title: throw vs throws
subtitle: Throwing vs declaring — JVM behaviour, checked/unchecked rules, re-throwing and wrapping, throw null, constructors and overriding.
order: 8
---

## Introduction

One of the first exception-handling questions in almost every Java interview is:

> "What is the difference between `throw` and `throws`?"

Many developers answer: *"`throw` throws an exception and `throws` declares it."* While correct, this answer is **incomplete**. To answer confidently in a senior interview, you should understand:

- JVM behaviour
- Exception propagation
- Checked vs unchecked interactions
- Inheritance rules
- Method overriding
- Spring Boot usage
- Enterprise best practices

## What is throw?

`throw` is a keyword used to **explicitly create and throw an exception object**.

```java
throw exceptionObject;
```

```java
throw new RuntimeException("Invalid User");
```

```flow
Create exception object
Throw exception
Current method stops
Search for catch block
? Found? | Yes: handle | No: propagate to caller
```

## What is throws?

`throws` is used in the **method declaration** to indicate that the method **may throw** one or more exceptions.

```java
returnType method() throws ExceptionType {
}
```

```java
public void readFile() throws IOException {
}
```

Meaning: *"I may throw `IOException`. The caller must handle it."*

> [!NOTE]
> `throws` does not throw anything. It simply informs the **compiler** and the **caller**.

## Simple Comparison

| throw | throws |
| --- | --- |
| Used inside a method | Used in a method declaration |
| Throws an exception object | Declares possible exceptions |
| Followed by an object | Followed by exception classes |
| One exception object at a time | Multiple exception types allowed |
| Transfers control immediately | No immediate control transfer |

## Examples

### throw

```java
public void validateAge(int age) {
    if (age < 18) {
        throw new IllegalArgumentException("Age must be at least 18");
    }
}
```

```flow-h
Method starts
Condition true
throw
Method terminates
Caller handles
```

### throws

```java
public void read() throws IOException {
    FileReader reader = new FileReader("test.txt");
}
```

```flow-h
Method starts
IOException may occur
Declared using throws
Caller decides
```

## throw with Checked and Unchecked Exceptions

### Checked exception, declared

```java
public void upload() throws IOException {
    throw new IOException("Upload Failed");
}
```

Compilation succeeds because the checked exception is declared.

### Missing throws

```java
public void upload() {
    throw new IOException();
}
```

```output Compilation error
Unhandled exception type IOException
```

**Reason:** checked exceptions must be **caught** or **declared** using `throws`.

### Unchecked exception

```java
public void calculate() {
    throw new ArithmeticException();
}
```

No `throws` needed, because `ArithmeticException` → `RuntimeException` → **unchecked**.

## Can throw Throw null?

```java
throw null;
```

Compilation: ✅ success. At runtime:

```output
NullPointerException
```

The JVM attempts to throw a `Throwable` reference, finds `null`, and throws a `NullPointerException` instead.

## Multiple Exceptions

### Multiple exceptions with throws

```java
public void process() throws IOException, SQLException, ParseException {
}
```

A method may declare multiple exception types.

### Can throw Throw Multiple Exceptions?

**No.** One `throw` statement throws only one exception object. If different exceptions are needed, use conditional logic:

```java
if (type.equals("FILE")) {
    throw new IOException();
} else {
    throw new SQLException();
}
```

## Re-throwing and Wrapping

### Re-throwing Exceptions

```java
try {
    readFile();
} catch (IOException e) {
    throw e;
}
```

The **same** exception is propagated.

### Wrapping Exceptions

Instead of re-throwing directly:

```java
catch (IOException e) {
    throw new RuntimeException(e);
}
```

**Better:**

```java
catch (IOException e) {
    throw new FileUploadException("Upload Failed", e);
}
```

This provides meaningful business context while preserving the original cause.

### throw vs throws Together

```java
public void save() throws IOException {
    throw new IOException("Disk Full");
}
```

```flow-h throws declares; throw executes
throws — compiler knows
throw executes
Exception created
Caller handles
```

## Constructors, Interfaces and Overriding

### Constructor with throws

Constructors may also declare exceptions:

```java
public Employee() throws IOException {
}
```

The caller must handle or declare the exception.

### Interface Methods

```java
interface Reader {
    void read() throws IOException;
}
```

Implementation:

```java
class FileReaderImpl implements Reader {
    @Override
    public void read() throws IOException {
    }
}
```

The implementing class must follow the exception contract.

### Method Overriding Rules

Parent:

```java
void read() throws IOException {
}
```

Child:

```java
void read() throws FileNotFoundException {   // ✅ Valid — narrower
}

void read() throws Exception {               // ❌ Invalid — broader
}
```

A child method cannot declare a **broader checked exception** than its parent.

## JVM Execution Flow

```java
throw new IllegalArgumentException();
```

```flow We'll study stack unwinding in detail in the next chapter
Exception object created
Current method stops
Stack unwinding
Search catch block
Caller
JVM (if never caught)
```

### throw Inside catch

```java
try {
    readFile();
} catch (IOException e) {
    throw new RuntimeException(e);
}
```

This is very common in enterprise applications.

## Spring Boot and Enterprise Usage

### Spring Boot Example

```java
public User findUser(Long id) {
    return repository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found"));
}
```

Internally this does `throw new UserNotFoundException("User not found");`. No `throws` required because it extends `RuntimeException`.

### Enterprise Example

Service layer:

```java
public void uploadFile() {
    try {
        storage.upload();
    } catch (IOException e) {
        throw new FileUploadException("Unable to upload file", e);
    }
}
```

Controller layer:

```java
@ExceptionHandler(FileUploadException.class)
```

This approach **translates low-level exceptions into business-specific exceptions**.

## Common Mistakes

### Using throws Exception

```java
public void save() throws Exception {   // Wrong
}

public void save() throws IOException { // Better
}
```

Declare the most specific exception possible.

### Throwing Generic Exceptions

```java
throw new Exception("Error");                                    // Wrong
throw new InvalidOrderException("Order is already shipped");     // Better
```

### Losing the Original Cause

```java
// Wrong
catch (IOException e) {
    throw new RuntimeException("Upload Failed");
}

// Correct
catch (IOException e) {
    throw new RuntimeException("Upload Failed", e);
}
```

Always preserve the original exception.

## Interview Questions

### Q1. What is the difference between throw and throws?

- `throw` actually throws an exception object.
- `throws` declares that a method may throw one or more exceptions.

### Q2. Can we use throw without throws?

Yes, for unchecked exceptions — e.g. `throw new IllegalArgumentException();`

### Q3. Can we use throws without throw?

Yes. A method can declare an exception even if it does not currently throw it. This is useful when implementations or subclasses may throw that exception.

### Q4. Can constructors use throws?

Yes. Constructors may declare checked exceptions.

### Q5. Can one method declare multiple exceptions?

Yes — e.g. `throws IOException, SQLException`.

### Q6. Can one throw statement throw multiple exceptions?

No. Each `throw` statement throws exactly one exception object.

### Q7. Is throw null valid?

Yes. It compiles, but the JVM throws a `NullPointerException` at runtime.

### Q8. Is throws RuntimeException required?

No. Unchecked exceptions do not need to be declared.

### Q9. Which keyword is used more often in Spring Boot?

- `throw` is used frequently for business exceptions.
- `throws` is mainly used for checked exceptions from I/O or external libraries.

### Q10. Why should we preserve the original exception?

To retain the root cause and complete stack trace, making debugging much easier.

## Best Practices

- Use `throw` for business validations and custom exceptions.
- Use `throws` only when callers can meaningfully handle checked exceptions.
- Declare the most specific checked exception possible.
- Preserve the original cause when wrapping exceptions.
- Prefer domain-specific exceptions over generic ones.
- Avoid `throws Exception` in public APIs unless absolutely necessary.

## Chapter Summary

- ✅ The `throw` and `throws` keywords and their differences
- ✅ Checked vs unchecked behaviour
- ✅ Multiple exceptions
- ✅ Re-throwing and wrapping exceptions
- ✅ Constructor and interface usage
- ✅ Method overriding rules
- ✅ Spring Boot usage and enterprise best practices
