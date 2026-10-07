---
title: Annotations and Reflection
subtitle: Annotations as metadata, custom annotations, SOURCE/CLASS/RUNTIME retention, @Target, reading annotations on classes, methods, fields and constructors, and how Spring, JUnit and Hibernate use them.
order: 9
---

## Introduction

> [!NOTE]
> **Interview importance:** extremely important.

In previous chapters we learned how Reflection inspects classes, constructors, fields and methods. But modern frameworks like Spring, Hibernate, JUnit, Jackson and Mockito mainly depend on **annotations**.

- How does Spring know that a class is a service? → `@Service public class UserService {}`
- How does JUnit know which method is a test? → `@Test public void loginTest() {}`
- How does Hibernate know which class is an entity? → `@Entity public class Employee {}`

**Answer:** frameworks read annotations at runtime, through Reflection. Without it, annotation-based programming as we know it wouldn't exist.

## What is an Annotation?

An **annotation** is metadata attached to Java program elements. It provides additional information to the compiler, the JVM, frameworks and tools. Annotations don't change program logic directly — they **provide information**.

```java
@Override
public String toString() {
    return "Employee";
}
```

Here `@Override` is an annotation. Another example — Spring reads `@Service` using Reflection:

```java
@Service
public class UserService {
}
```

### Real-Life Analogy

An office file contains employee details, salary and department. Someone attaches an **URGENT** sticker. The sticker doesn't change the file; it only provides extra information. Annotations work exactly like that.

## Built-in and Framework Annotations

| Built-in | Framework |
| --- | --- |
| `@Override` | `@Component`, `@Service`, `@Repository`, `@Controller` |
| `@Deprecated` | `@Entity` |
| `@SuppressWarnings` | `@Test` |
| `@FunctionalInterface` | `@Autowired` |
| `@SafeVarargs` | `@GetMapping` |

## Custom Annotation

```java
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

@Retention(RetentionPolicy.RUNTIME)
@interface Author {
    String name();
}
```

Usage:

```java
@Author(name = "Durga")
class Employee {
}
```

Reflection can read this annotation.

## Retention Policy

One of the most important interview topics. Every annotation has a **lifetime**, and Java provides three retention policies:

```flow-h
SOURCE
CLASS
RUNTIME
```

| Policy | Where it exists | Visible to Reflection? | Example |
| --- | --- | --- | --- |
| `SOURCE` | Only in source code — removed during compilation | ✗ | `@Override` |
| `CLASS` | Stored in the `.class` file, but not loaded at runtime | ✗ | **The default** when no `@Retention` is given |
| `RUNTIME` | Stored in the `.class` file **and** available at runtime | ✓ | `@Service`, `@Entity`, `@Test` |

`@Retention(RetentionPolicy.RUNTIME)` is mandatory for annotations that frameworks need to inspect.

> [!QUESTION] Why do Spring's annotations use @Retention(RetentionPolicy.RUNTIME)?
> Because Spring reads them using Reflection while the application is running. Without `RUNTIME`, `getAnnotation()` would return `null`.

## Target

`@Target` specifies **where** an annotation can be applied.

```java
@Target(ElementType.TYPE)
```

means only on types — classes, interfaces, enums, records and annotation types.

Other common targets: `TYPE`, `FIELD`, `METHOD`, `CONSTRUCTOR`, `PARAMETER`, `LOCAL_VARIABLE`, `PACKAGE` and `ANNOTATION_TYPE`.

```java
@Target(ElementType.FIELD)   // only fields, e.g. private String name;
```

## Reading a Class Annotation

```java
@Retention(RetentionPolicy.RUNTIME)
@interface Author {
    String name();
}

@Author(name = "Durga")
class Employee {
}
```

```java
Class<Employee> cls = Employee.class;

Author author = cls.getAnnotation(Author.class);

System.out.println(author.name());
```

```output
Durga
```

Reflection successfully reads annotation values.

### isAnnotationPresent()

Instead of getting the annotation directly, we can check whether it exists:

```java
if (cls.isAnnotationPresent(Author.class)) {
    System.out.println("Present");
}
```

```output
Present
```

A very common interview question.

### getAnnotation()

Returns **one** annotation (or `null` if absent):

```java
Author author = cls.getAnnotation(Author.class);
author.name();   // "Durga"
```

### getAnnotations()

Returns **all** annotations. For a class marked `@Author(name = "Durga")` and `@Deprecated`:

```java
Annotation[] annotations = cls.getAnnotations();

for (Annotation annotation : annotations) {
    System.out.println(annotation);
}
```

```output
@com.demo.Author(name="Durga")
@java.lang.Deprecated(forRemoval=false, since="")
```

(The exact text format of `toString()` differs slightly between Java versions.)

> [!TIP]
> `getAnnotations()` also includes annotations **inherited** from a superclass (if the annotation type is marked `@Inherited`); `getDeclaredAnnotations()` returns only those placed directly on this element.

## Annotations on Methods, Fields and Constructors

```java
class Employee {
    @Deprecated
    private String name;

    @Deprecated
    Employee() {
    }

    @Deprecated
    public void work() {
    }
}
```

```java
Method method = Employee.class.getDeclaredMethod("work");
System.out.println(method.isAnnotationPresent(Deprecated.class));             // true

Field field = Employee.class.getDeclaredField("name");
System.out.println(field.isAnnotationPresent(Deprecated.class));              // true

Constructor<?> constructor = Employee.class.getDeclaredConstructor();
System.out.println(constructor.isAnnotationPresent(Deprecated.class));        // true
```

## Annotation Values

```java
@Retention(RetentionPolicy.RUNTIME)
@interface EmployeeInfo {
    int id();
    String company();
}

@EmployeeInfo(id = 100, company = "OpenAI")
class Employee {
}
```

```java
EmployeeInfo info = Employee.class.getAnnotation(EmployeeInfo.class);

System.out.println(info.id());
System.out.println(info.company());
```

```output
100
OpenAI
```

## Real-World Examples

### Spring

```java
@Service
class UserService {
}
```

Spring performs operations conceptually similar to:

```java
Class<?> cls = UserService.class;

if (cls.isAnnotationPresent(Service.class)) {
    Object bean = cls.getDeclaredConstructor().newInstance();
}
```

Spring creates the bean.

> [!NOTE]
> In reality Spring's component scan first reads `.class` files with a bytecode reader (so it doesn't load every class), and it looks for `@Component` **meta-annotations** — `@Service`, `@Repository` and `@Controller` are themselves annotated with `@Component`.

### JUnit

```java
@Test
public void loginTest() {
}
```

JUnit performs operations similar to:

```java
Method method = LoginTest.class.getDeclaredMethod("loginTest");

if (method.isAnnotationPresent(Test.class)) {
    method.invoke(testObject);
}
```

### Hibernate

```java
@Entity
class Employee {
}
```

```java
Class<?> cls = Employee.class;

if (cls.isAnnotationPresent(Entity.class)) {
    // register entity
}
```

## Multiple Annotations

```java
@Service
@Deprecated
class Employee {
}

Annotation[] annotations = Employee.class.getAnnotations();
```

Returns both `@Service` and `@Deprecated`.

## Meta-Annotations

Annotations can themselves have annotations:

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@interface Service {
}
```

Here `@Retention` and `@Target` are **meta-annotations**. (`@Documented`, `@Inherited` and `@Repeatable` are the others.)

## Important Annotation Reflection Methods

| Element | Methods |
| --- | --- |
| `Class` | `isAnnotationPresent()`, `getAnnotation()`, `getAnnotations()`, `getDeclaredAnnotations()` |
| `Method` | `getAnnotation()`, `isAnnotationPresent()` |
| `Field` | `getAnnotation()`, `isAnnotationPresent()` |
| `Constructor` | `getAnnotation()`, `isAnnotationPresent()` |

## Interview Questions

### Q1. What is an annotation?

Metadata that provides additional information about Java program elements.

### Q2. Why are annotations called metadata?

Because they describe program elements without directly changing the program's execution logic.

### Q3. Which retention policy is required for Reflection?

`RetentionPolicy.RUNTIME`.

### Q4. Difference between SOURCE, CLASS and RUNTIME?

| Retention | In `.class` file | Visible to Reflection |
| --- | --- | --- |
| `SOURCE` | ✗ | ✗ |
| `CLASS` (default) | ✓ | ✗ |
| `RUNTIME` | ✓ | ✓ |

### Q5. Which method checks whether an annotation exists?

`isAnnotationPresent()`.

### Q6. Which method returns one annotation?

`getAnnotation()`.

### Q7. Which method returns all annotations?

`getAnnotations()`.

### Q8. Can Reflection read annotation values?

Yes — e.g. `annotation.name()`, `annotation.id()`.

### Q9. Why does Spring require runtime annotations?

Because Spring scans and processes annotations using Reflection after the application starts.

## Key Points to Remember

- ✅ Annotations are metadata.
- ✅ Reflection reads annotations only if they have `RetentionPolicy.RUNTIME`.
- ✅ `isAnnotationPresent()` checks existence; `getAnnotation()` retrieves one; `getAnnotations()` retrieves all.
- ✅ Reflection can inspect annotations on classes, methods, fields and constructors.
- ✅ Spring, Hibernate and JUnit are annotation-driven frameworks built on top of Reflection.

## Chapter Summary

Annotations let developers attach metadata to Java program elements. Reflection makes that metadata available at runtime, enabling frameworks to discover components, entities, test methods, REST endpoints and much more without hard-coding behaviour. This combination of annotations and Reflection is the foundation of modern Java enterprise development.
