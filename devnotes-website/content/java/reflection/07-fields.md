---
title: Fields in Reflection
subtitle: The Field API — getFields vs getDeclaredFields, field metadata, reading and modifying public, private, primitive, static and final fields, and how Jackson and Hibernate populate objects.
order: 7
---

## Introduction

> [!NOTE]
> **Interview importance:** very high.

In the previous chapter we learned how Reflection creates objects using constructors. Now we'll learn how Reflection can **inspect, read and modify fields** (instance variables) at runtime.

This is heavily used by Spring, Hibernate, Jackson, Gson and JPA providers. Without the Field API, these frameworks couldn't automatically populate Java objects.

## What is a Field?

A field is simply a variable declared inside a class.

```java
class Employee {
    private int id;
    public String name;
    protected double salary;
    static String company = "OpenAI";
}
```

`id`, `name`, `salary` and `company` are all fields. Reflection represents every field using **`java.lang.reflect.Field`**.

## Field Reflection Workflow

```flow-h Everything begins with the Class object
Class
Field
Read metadata
Read value
Modify value
```

## Getting Fields

```java
public class Employee {
    public String name;
    private int age;
    protected double salary;
}
```

### getFields() — Public Only

```java
Class<?> cls = Employee.class;

Field[] fields = cls.getFields();

for (Field field : fields) {
    System.out.println(field.getName());
}
```

```output
name
```

Only public fields are returned.

### getDeclaredFields() — All Declared

```java
Field[] fields = Employee.class.getDeclaredFields();

for (Field field : fields) {
    System.out.println(field.getName());
}
```

```output
name
age
salary
```

Now private and protected fields are also returned.

### getFields() vs getDeclaredFields()

| Method | Public fields | Private fields | Inherited public fields |
| --- | --- | --- | --- |
| `getFields()` | Yes | No | Yes |
| `getDeclaredFields()` | Yes | Yes | No |

> [!TIP]
> To get **all** fields including private ones from parent classes (what frameworks do), loop up the hierarchy with `getSuperclass()` and call `getDeclaredFields()` at each level. The order of returned fields isn't guaranteed.

## Getting a Specific Field

```java
class Employee {
    private String name;
}

Field field = Employee.class.getDeclaredField("name");
```

Now Reflection has access to the metadata of the `name` field.

## Field Metadata

```java
System.out.println(field.getName());   // name
System.out.println(field.getType());   // class java.lang.String
```

For `private int age;`, `getType()` prints `int`.

**Modifiers:**

```java
int modifier = field.getModifiers();

Modifier.isPrivate(modifier);
Modifier.isPublic(modifier);
Modifier.isStatic(modifier);
Modifier.isFinal(modifier);
```

## Reading Field Values

### Public Field

```java
class Employee {
    public String name = "Rahul";
}

Employee emp = new Employee();

Field field = Employee.class.getField("name");
Object value = field.get(emp);

System.out.println(value);
```

```output
Rahul
```

### Private Field

```java
class Employee {
    private String name = "Rahul";
}

Employee emp = new Employee();

Field field = Employee.class.getDeclaredField("name");
field.setAccessible(true);

System.out.println(field.get(emp));
```

```output
Rahul
```

Without `setAccessible(true)`, reading the private field from another class throws **`IllegalAccessException`**.

## Modifying Field Values

### Public Field

```java
class Employee {
    public String name = "Rahul";
}

Employee emp = new Employee();

Field field = Employee.class.getField("name");
field.set(emp, "Durga");

System.out.println(emp.name);
```

```output
Durga
```

Reflection successfully changed the value.

### Private Field

```java
class Employee {
    private String name = "Rahul";
}

Employee emp = new Employee();

Field field = Employee.class.getDeclaredField("name");
field.setAccessible(true);
field.set(emp, "Durga");

System.out.println(field.get(emp));
```

```output
Durga
```

Reflection bypasses Java access checks (subject to module/security restrictions in modern Java).

## Primitive Fields

```java
class Employee {
    private int age = 25;
}

Employee emp = new Employee();

Field field = Employee.class.getDeclaredField("age");
field.setAccessible(true);

System.out.println(field.get(emp));
```

```output
25
```

The value is returned as an `Object` (an `Integer`).

### Primitive-Specific Methods

Instead of `field.get(emp)` you can write:

```java
field.getInt(emp);
field.getDouble(emp);
field.getLong(emp);
field.getBoolean(emp);
field.getFloat(emp);

field.setInt(emp, 30);
field.setDouble(emp, 50000);
field.setBoolean(emp, true);
```

These avoid boxing and unboxing.

## Static Fields

```java
class Employee {
    static String company = "OpenAI";
}

Field field = Employee.class.getDeclaredField("company");
field.setAccessible(true);

System.out.println(field.get(null));
```

```output
OpenAI
```

For static fields the object reference is **`null`**, because static members belong to the class, not an object.

## Final Fields

```java
class Employee {
    final String company = "OpenAI";
}
```

Reflection can sometimes modify final fields depending on the Java version and JVM configuration, but this is **strongly discouraged** and increasingly restricted in modern Java. In production, assume final fields stay immutable.

> [!WARNING]
> Even when a change "works", it may not be visible: `final String company = "OpenAI"` is a **compile-time constant**, so the compiler inlines `"OpenAI"` wherever `company` is read. `static final` fields and fields of records can't be changed via `Field.set()` at all — it throws `IllegalAccessException`.

## Real-World Examples

### Jackson

Suppose JSON:

```json
{
  "name": "Rahul",
  "age": 25
}
```

When Jackson is set up to use fields, it performs operations conceptually similar to:

```java
Employee emp = new Employee();

Field field = Employee.class.getDeclaredField("name");
field.setAccessible(true);
field.set(emp, "Rahul");

Field age = Employee.class.getDeclaredField("age");
age.setAccessible(true);
age.set(emp, 25);
```

The object is populated dynamically.

> [!NOTE]
> By default Jackson prefers **setters** (and public fields); it writes private fields directly only when they're annotated (e.g. `@JsonProperty`) or field visibility is enabled. Either way it's Reflection.

### Hibernate

| ID | NAME |
| --- | --- |
| 1 | Rahul |

```java
Employee emp = new Employee();

Field id = Employee.class.getDeclaredField("id");
id.setAccessible(true);
id.set(emp, 1);

Field name = Employee.class.getDeclaredField("name");
name.setAccessible(true);
name.set(emp, "Rahul");
```

Without Reflection, ORM frameworks would require manual setter calls for every field. (Hibernate uses field access when `@Id` is on a field and property/setter access when it's on a getter.)

## Exceptions

| Exception | Reason |
| --- | --- |
| `NoSuchFieldException` | Field not found |
| `IllegalAccessException` | Access denied |
| `SecurityException` | Access restricted by a security policy |

```java
try {
    Field field = Employee.class.getDeclaredField("name");
} catch (Exception e) {
    e.printStackTrace();
}
```

## Interview Questions

### Q1. Which class represents fields in Reflection?

`java.lang.reflect.Field`.

### Q2. Difference between getField() and getDeclaredField()?

| Method | Public | Private |
| --- | --- | --- |
| `getField()` | ✓ (including inherited) | ✗ |
| `getDeclaredField()` | ✓ (this class only) | ✓ |

### Q3. Difference between getFields() and getDeclaredFields()?

- `getFields()` — public fields only, **including** inherited public fields.
- `getDeclaredFields()` — all fields declared in the class, **excluding** inherited fields.

### Q4. Which method reads a field value?

`field.get(object)`.

### Q5. Which method modifies a field value?

`field.set(object, value)`.

### Q6. Why is setAccessible(true) required?

It allows Reflection to access non-public fields. Without it, private field access normally results in an `IllegalAccessException`.

### Q7. How do you access a static field?

Pass `null` to `field.get()` or `field.set()` — e.g. `field.get(null)`.

## Key Points to Remember

- ✅ Fields are represented by `java.lang.reflect.Field`.
- ✅ Reflection can inspect both public and private fields.
- ✅ `getField()` returns only public fields; `getDeclaredField()` returns any declared field.
- ✅ `field.get()` reads values; `field.set()` modifies them.
- ✅ `setAccessible(true)` enables access to private fields (subject to modern Java restrictions).
- ✅ Primitive-specific methods such as `getInt()` and `setInt()` avoid boxing.
- ✅ Static fields use `null` as the target object.

## Chapter Summary

The `Field` API enables Reflection to inspect class variables, retrieve metadata, and read and modify values dynamically at runtime. This is fundamental to serialization frameworks, dependency injection containers and ORM technologies like Hibernate, and explains how frameworks populate objects without directly invoking setters.
