---
title: finally Block
subtitle: Cleanup that always runs — execution order, when finally doesn't run, return and exceptions inside finally, and output-based traps.
order: 6
---

## What is the finally Block?

The `finally` block executes code **after** the `try` and `catch` blocks, **regardless of whether an exception occurs**. It is mainly used for:

- Resource cleanup
- Closing files
- Closing database connections
- Releasing locks
- Cleaning temporary resources

```java
try {
    // Risky code
} catch (Exception e) {
    // Exception handling
} finally {
    // Cleanup code
}
```

## Why Do We Need finally?

```java
Connection connection = getConnection();
try {
    // Database operations
} catch (SQLException e) {
    e.printStackTrace();
}
```

What happens if an exception occurs? The database connection remains open, leading to connection leaks, memory leaks, pool exhaustion and performance issues.

Using `finally`:

```java
Connection connection = getConnection();
try {
    // Database operations
} finally {
    connection.close();
}
```

The cleanup code **always executes**.

## Execution Flow

### Case 1: No Exception

```java
try {
    System.out.println("Try");
} finally {
    System.out.println("Finally");
}
```

```output
Try
Finally
```

```flow-h
try completes
finally
rest of program
```

### Case 2: Exception Handled

```java
try {
    int x = 10 / 0;
} catch (ArithmeticException e) {
    System.out.println("Catch");
} finally {
    System.out.println("Finally");
}
```

```output
Catch
Finally
```

```flow-h
try
Exception
catch
finally
```

### Case 3: Exception Not Handled

```java
try {
    int x = 10 / 0;
} finally {
    System.out.println("Finally");
}
```

```output
Finally
Exception in thread "main" java.lang.ArithmeticException: / by zero
```

```flow-h The exception is still propagated after the finally block executes
try
Exception
finally
JVM
```

## Is finally Always Executed?

Usually, yes. However, `finally` may **not** execute when:

- The JVM is terminated using `System.exit()`
- The JVM crashes
- The operating system terminates the process
- Power failure
- Hardware failure

```java
try {
    System.out.println("Try");
    System.exit(0);
} finally {
    System.out.println("Finally");
}
```

```output
Try
```

`finally` never executes because the JVM terminates.

## return with finally

One of the most popular interview questions.

```java
public static int test() {
    try {
        return 10;
    } finally {
        System.out.println("Finally");
    }
}

System.out.println(test());
```

```output
Finally
10
```

```flow-h The value to return is computed first, but the method does not return until finally completes
return 10 evaluated
finally runs
method returns 10
```

### return Inside finally

```java
public static int test() {
    try {
        return 10;
    } finally {
        return 20;
    }
}
```

```output
20
```

```flow-h The return in finally overrides the earlier return
return 10
finally
return 20
10 lost
```

### Why is Returning from finally Bad?

```java
public static int calculate() {
    try {
        return 100;
    } finally {
        return 200;
    }
}
```

The caller receives **200** — the original return value is lost. This behaviour is confusing and makes debugging difficult.

> [!WARNING]
> **Best practice:** never return from a `finally` block.

## Exceptions and finally

### Exception Inside finally

```java
try {
    throw new RuntimeException("Try");
} finally {
    throw new RuntimeException("Finally");
}
```

```output
RuntimeException: Finally
```

The exception from the `finally` block **overrides** the exception from the `try` block. The original exception is effectively lost unless it is preserved separately.

### Exception + Return

```java
public static int test() {
    try {
        throw new RuntimeException();
    } finally {
        return 100;
    }
}
```

```output
100
```

The exception **disappears** because the `return` in `finally` overrides it — another reason to avoid returning from `finally`.

## Variable Modification in finally

### Primitive Example

```java
public static int test() {
    int x = 10;
    try {
        return x;
    } finally {
        x = 20;
    }
}
```

```output
10
```

**Reason:** the return value is evaluated **before** the `finally` block executes.

### Mutable Object Example

```java
public static List<String> test() {
    List<String> list = new ArrayList<>();
    try {
        return list;
    } finally {
        list.add("Java");
    }
}
```

```output
[Java]
```

**Reason:** the returned reference points to the **same mutable object**, which is modified in the `finally` block before control returns to the caller.

## Nested try-finally

```java
try {
    System.out.println("Outer Try");
    try {
        System.out.println("Inner Try");
    } finally {
        System.out.println("Inner Finally");
    }
} finally {
    System.out.println("Outer Finally");
}
```

```output
Outer Try
Inner Try
Inner Finally
Outer Finally
```

Execution proceeds from the **innermost** `finally` outward.

## finally with try-with-resources

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
    System.out.println(br.readLine());
} finally {
    System.out.println("Finished");
}
```

```flow-h The resource is closed automatically before the finally block executes
try
resource close()
finally
```

## Common Mistakes

- **Returning from `finally`** — `finally { return 100; }` hides return values and exceptions. Avoid this pattern.
- **Throwing exceptions from `finally`** — `finally { throw new RuntimeException(); }` can hide the original exception.
- **Placing business logic in `finally`** — `finally { saveEmployee(); }`. `finally` should be reserved for cleanup, not business operations.

## Enterprise Perspective

Before Java 7, `finally` was heavily used for closing resources:

```java
Connection con = null;
try {
    con = dataSource.getConnection();
} finally {
    if (con != null) {
        con.close();
    }
}
```

Modern Java prefers:

```java
try (Connection con = dataSource.getConnection()) {
    // Database operations
}
```

However, `finally` is still useful for:

- Releasing locks
- Clearing thread-local variables
- Restoring application state
- Performance monitoring
- Logging execution completion

## Interview Questions

### Q1. What is the purpose of the finally block?

To execute cleanup code regardless of whether an exception occurs.

### Q2. Is finally always executed?

Almost always. It may not execute if `System.exit()` is called, the JVM crashes, the operating system terminates the process, or there is a hardware or power failure.

### Q3. Can we use try without catch?

Yes — `try { } finally { }` is valid.

### Q4. Can we use finally without try?

No. `finally` must always be associated with a `try` block.

### Q5. Does finally execute after return?

Yes. The return value is computed first, but the method does not actually return until the `finally` block finishes.

### Q6. What happens if finally also contains a return statement?

The return from `finally` overrides any earlier return and even suppresses pending exceptions.

### Q7. Should we return from finally?

No. It leads to confusing code and can hide return values or exceptions.

### Q8. Does try-with-resources replace finally?

Only for resource cleanup. `finally` is still useful for other cleanup activities unrelated to closing resources.

## Best Practices

- Use `finally` only for cleanup activities.
- Never return from a `finally` block.
- Avoid throwing exceptions from `finally`.
- Prefer try-with-resources for `AutoCloseable` resources.
- Keep the `finally` block short and predictable.

## Chapter Summary

- ✅ Purpose of the `finally` block
- ✅ Execution order of `try`, `catch` and `finally`
- ✅ Cases where `finally` does not execute
- ✅ `return` with `finally` and why returning from `finally` is dangerous
- ✅ Exception overriding in `finally`
- ✅ Mutable object behaviour with `finally`
- ✅ Nested try-finally
- ✅ Relationship with try-with-resources
