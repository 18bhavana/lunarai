---
title: try-with-resources
subtitle: Automatic resource management since Java 7 — AutoCloseable vs Closeable, multiple resources, LIFO closing and the Java 9 form.
order: 3
---

## What is try-with-resources?

`try-with-resources` is a feature introduced in **Java 7** to **automatically close resources** after use.

Before Java 7, developers had to manually close resources inside the `finally` block. With try-with-resources, the JVM closes resources automatically, making code cleaner, safer and less error-prone.

## Why Was It Introduced?

Consider reading a file:

```java
FileReader reader = new FileReader("data.txt");
BufferedReader br = new BufferedReader(reader);
String line = br.readLine();
System.out.println(line);
```

After using the file, both resources must be closed. If we forget:

- File descriptors remain open.
- Memory leaks may occur.
- Database connections may not return to the connection pool.
- Socket connections remain open.

This is known as a **resource leak**.

### Resource Leak Example

```java
public void readFile() throws IOException {
    FileReader reader = new FileReader("data.txt");
    BufferedReader br = new BufferedReader(reader);
    System.out.println(br.readLine());
}
```

```flow-h After many executions: too many open files, rising memory, degraded performance
File opened
Never closed
Resource Leak
```

## Before Java 7

Before try-with-resources, we used `finally`:

```java
FileReader reader = null;
try {
    reader = new FileReader("data.txt");
} finally {
    if (reader != null) {
        reader.close();
    }
}
```

Problems:

- Verbose
- Easy to forget
- Nested try-catch
- Difficult with multiple resources

### Multiple Resources Before Java 7

```java
Connection con = null;
PreparedStatement ps = null;
ResultSet rs = null;
try {
    con = getConnection();
    ps = con.prepareStatement(sql);
    rs = ps.executeQuery();
} finally {
    if (rs != null)
        rs.close();
    if (ps != null)
        ps.close();
    if (con != null)
        con.close();
}
```

Imagine maintaining hundreds of such methods.

## try-with-resources Syntax

```java
try (Resource resource = ...) {
    // Use resource
}
```

The resource is **automatically closed**.

### Example

```java
try (FileReader reader = new FileReader("data.txt")) {
    // Read file
}
```

Equivalent to:

```java
FileReader reader = null;
try {
    reader = new FileReader("data.txt");
} finally {
    if (reader != null) {
        reader.close();
    }
}
```

### Real Example

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
    String line;
    while ((line = br.readLine()) != null) {
        System.out.println(line);
    }
}
```

No manual `close()` required.

## Multiple Resources

```java
try (
    FileReader reader = new FileReader("data.txt");
    BufferedReader br = new BufferedReader(reader)
) {
    System.out.println(br.readLine());
}
```

Multiple resources are separated using **semicolons**.

### Resource Closing Order

Resources are closed in the **reverse order** in which they are declared.

```java
try (
    ResourceA a = new ResourceA();
    ResourceB b = new ResourceB();
    ResourceC c = new ResourceC()
) {
}
```

```flow This is called Last In, First Out (LIFO)
ResourceC.close()
ResourceB.close()
ResourceA.close()
```

## AutoCloseable Interface

The resource must implement **`AutoCloseable`**:

```java
public interface AutoCloseable {
    void close() throws Exception;
}
```

When the try block completes, Java automatically invokes `resource.close()`.

### Closeable vs AutoCloseable

| AutoCloseable | Closeable |
| --- | --- |
| Introduced in Java 7 | Older interface (Java 5) |
| Parent interface | Child interface |
| `close() throws Exception` | `close() throws IOException` |
| Used by all try-with-resources | Mainly I/O classes |

```tree
AutoCloseable
  Closeable
    FileReader
    BufferedReader
    InputStream
    OutputStream
```

### Which Classes Support try-with-resources?

Any class implementing `AutoCloseable`, for example `FileReader`, `BufferedReader`, `Scanner`, `Connection`, `PreparedStatement`, `ResultSet`, `FileInputStream`, `FileOutputStream`, `ZipFile`, `Socket` and `ServerSocket`.

## Custom Resource

You can create your own resource:

```java
class MyResource implements AutoCloseable {

    @Override
    public void close() {
        System.out.println("Closing resource");
    }

    public void work() {
        System.out.println("Working");
    }
}
```

Usage:

```java
try (MyResource resource = new MyResource()) {
    resource.work();
}
```

```output
Working
Closing resource
```

## Java 9 Enhancement

Before Java 9, the resource had to be declared inside the parentheses:

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
}
```

Java 9 allows an existing variable:

```java
BufferedReader br = new BufferedReader(new FileReader("data.txt"));

try (br) {
    System.out.println(br.readLine());
}
```

> [!NOTE]
> The variable must be **effectively final**.

## Execution Flow

```flow
Create resource
Enter try block
Execute business logic
? Exception? | Yes or No: close() is called automatically either way
Continue execution / exception propagates
```

### What If an Exception Occurs?

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
    throw new RuntimeException("Error");
}
```

```flow-h Even when an exception occurs, the resource is still closed
Exception thrown
close()
Exception propagates
```

### try-with-resources with catch

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
    System.out.println(br.readLine());
} catch (IOException e) {
    System.out.println(e.getMessage());
}
```

Perfectly valid.

### try-with-resources with finally

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
    System.out.println(br.readLine());
} catch (IOException e) {
    e.printStackTrace();
} finally {
    System.out.println("Finished");
}
```

```flow-h Order — resources are closed before catch and finally run
try
close()
catch (if required)
finally
```

## Common Mistakes

### Forgetting to implement AutoCloseable

```java
class Employee {
}
```

Cannot be used in try-with-resources. **Correct:**

```java
class Employee implements AutoCloseable {
    @Override
    public void close() {
    }
}
```

### Calling close() manually

```java
try (BufferedReader br = new BufferedReader(new FileReader("data.txt"))) {
    br.close();   // redundant
}
```

The JVM will close it automatically. For standard I/O classes a second `close()` is harmless, but the manual call is redundant noise — and for a custom resource whose `close()` isn't idempotent it can cause problems.

### Swallowing Exceptions

**Wrong:** `catch (Exception e) { }` — always log or handle exceptions appropriately.

## Enterprise Examples

Reading a configuration file:

```java
try (InputStream input = Files.newInputStream(path)) {
    // Read configuration
}
```

Reading Excel files using Apache POI:

```java
try (Workbook workbook = WorkbookFactory.create(file)) {
    // Process workbook
}
```

JDBC:

```java
try (
    Connection con = dataSource.getConnection();
    PreparedStatement ps = con.prepareStatement(sql);
    ResultSet rs = ps.executeQuery()
) {
    while (rs.next()) {
        System.out.println(rs.getString(1));
    }
}
```

This is the recommended approach in enterprise applications.

## Advantages

- Automatic resource management
- Prevents resource leaks
- Cleaner code
- Less boilerplate
- Exception-safe
- Easier maintenance

## Interview Questions

### Q1. What is try-with-resources?

A Java 7 feature that automatically closes resources implementing `AutoCloseable`.

### Q2. Which interface must a resource implement?

`AutoCloseable`.

### Q3. Does try-with-resources replace finally?

Not completely. It replaces `finally` only for resource cleanup. You may still use `finally` for other cleanup logic.

### Q4. Can we have multiple resources?

Yes. Separate them with semicolons.

### Q5. In what order are resources closed?

Reverse order of declaration (LIFO).

### Q6. What happens if an exception occurs inside the try block?

The resource is still closed automatically before the exception propagates.

### Q7. What is the difference between Closeable and AutoCloseable?

`Closeable` extends `AutoCloseable` and is specialized for I/O operations. `AutoCloseable` is more general and is used by the try-with-resources mechanism.

### Q8. Can custom classes be used?

Yes. Implement the `AutoCloseable` interface.

## Best Practices

- Always use try-with-resources for files, streams, sockets and JDBC resources.
- Avoid manually calling `close()` inside a try-with-resources block.
- Keep resources scoped as narrowly as possible.
- Use multiple resources in a single try block when appropriate.
- Handle exceptions meaningfully and avoid empty catch blocks.

## Chapter Summary

- ✅ What try-with-resources is and why it was introduced
- ✅ Resource leaks
- ✅ Automatic resource management
- ✅ `AutoCloseable` and `Closeable`
- ✅ Multiple resources and LIFO closing order
- ✅ Java 9 enhancement
- ✅ Enterprise JDBC usage
- ✅ Common mistakes, interview questions and best practices
