---
title: The Class API
subtitle: Inspecting class metadata — getName vs getSimpleName vs getCanonicalName, packages, superclass, interfaces, modifiers, isXxx() checks, isAssignableFrom and class loaders.
order: 5
---

## Introduction

> [!NOTE]
> **Interview importance:** very high.

So far we've learned what Reflection is, what the `Class` class is, how to obtain a `Class` object, and how class loading works. Now we'll actually start **using** Reflection. Everything begins with one object:

```java
Class<?> cls = Employee.class;
```

Once we have it, we can ask the JVM questions like: What is the class name? Which package does it belong to? Is it an interface or an enum? Which superclass does it extend? Which interfaces does it implement? Is it abstract, final, public? All this is called **class metadata**.

## Sample Class

Throughout this chapter we'll use:

```java
package com.demo;

public class Employee extends Person implements Serializable {
    private String name;

    public void work() {
    }
}
```

```java
Class<?> cls = Employee.class;
```

## Names

### getName()

Returns the **fully qualified class name** (FQCN):

```java
System.out.println(cls.getName());
```

```output
com.demo.Employee
```

A fully qualified class name is **package name + class name** — `com.demo.Employee` instead of `Employee`. Spring, Hibernate, JDBC and `Class.forName("com.demo.Employee")` all use fully qualified names.

### getSimpleName()

Returns only the class name:

```java
System.out.println(cls.getSimpleName());
```

```output
Employee
```

| Call | Result |
| --- | --- |
| `cls.getName()` | `com.demo.Employee` |
| `cls.getSimpleName()` | `Employee` |

> [!QUESTION] Difference between getName() and getSimpleName()?
> `getName()` returns the fully qualified class name; `getSimpleName()` returns only the simple class name.

### getCanonicalName()

```java
System.out.println(Employee.class.getCanonicalName());
```

```output
com.demo.Employee
```

| Method | Output |
| --- | --- |
| `getName()` | JVM (binary) name |
| `getCanonicalName()` | Java source name |

For normal top-level classes both are identical. **Arrays and nested classes differ:**

| Type | `getName()` | `getCanonicalName()` |
| --- | --- | --- |
| `String[]` | `[Ljava.lang.String;` | `java.lang.String[]` |
| Nested `Employee.Address` | `com.demo.Employee$Address` | `com.demo.Employee.Address` |

Canonical names are easier for humans to read.

## getPackageName()

```java
System.out.println(cls.getPackageName());
```

```output
com.demo
```

Older Java versions used `cls.getPackage()` (which returns a `Package` object); Java 9 introduced `getPackageName()`, which returns a `String`.

## getSuperclass()

```java
class Person {
}

class Employee extends Person {
}

System.out.println(cls.getSuperclass());
```

```output
class com.demo.Person
```

```java
String.class.getSuperclass();   // class java.lang.Object
Object.class.getSuperclass();   // null
```

`Object.class.getSuperclass()` returns **`null`** because `Object` has no parent. (Interfaces and primitive types also return `null`.)

> [!QUESTION] Which class has no superclass?
> `java.lang.Object`.

## getInterfaces()

Returns all **directly** implemented interfaces.

```java
class Employee implements Serializable, Cloneable {
}

Class<?>[] interfaces = cls.getInterfaces();

for (Class<?> c : interfaces) {
    System.out.println(c.getName());
}
```

```output
java.io.Serializable
java.lang.Cloneable
```

```tree Reflection returns both interfaces
Employee
  Serializable
  Cloneable
```

## getModifiers()

Returns modifiers as an **integer** bit mask.

```java
public final class Employee {
}

int mod = cls.getModifiers();
System.out.println(mod);
```

```output
17
```

`17` = `PUBLIC (1)` + `FINAL (16)`. Since that isn't meaningful directly, Java provides the **`Modifier`** utility class:

```java
import java.lang.reflect.Modifier;

System.out.println(Modifier.isPublic(mod));
System.out.println(Modifier.isFinal(mod));
System.out.println(Modifier.isAbstract(mod));
```

```output
true
true
false
```

### Common Modifier Methods

```java
Modifier.isPublic()
Modifier.isPrivate()
Modifier.isProtected()
Modifier.isFinal()
Modifier.isStatic()
Modifier.isAbstract()
Modifier.isInterface()
```

These are commonly asked in interviews. (`Modifier.toString(mod)` gives `"public final"`.)

## Type Checks

| Check | Example | Result |
| --- | --- | --- |
| `isInterface()` | `Vehicle.class.isInterface()` (for `interface Vehicle {}`) | `true` |
| | `Employee.class.isInterface()` | `false` |
| `isEnum()` | `Status.class.isEnum()` (for `enum Status { ACTIVE, INACTIVE }`) | `true` |
| | `Employee.class.isEnum()` | `false` |
| `isAnnotation()` | `Test.class.isAnnotation()` (for `@interface Test {}`) | `true` |
| `isArray()` | `String[].class.isArray()` | `true` |
| | `Employee.class.isArray()` | `false` |
| `isPrimitive()` | `int.class.isPrimitive()` | `true` |
| | `double.class.isPrimitive()` | `true` |
| | `Integer.class.isPrimitive()` | `false` |

Spring internally checks annotations like `@Component`, `@Service` and `@Repository` using Reflection.

> [!QUESTION] Is Integer primitive?
> No. It is a wrapper **class**.

## isAssignableFrom()

One of the most frequently asked Reflection methods.

```java
class Animal {
}

class Dog extends Animal {
}

System.out.println(Animal.class.isAssignableFrom(Dog.class));
```

```output
true
```

Meaning: a `Dog` object can be assigned to an `Animal` reference — `Animal a = new Dog();` is valid.

```java
Dog.class.isAssignableFrom(Animal.class);   // false
```

…because `Dog d = new Animal();` is invalid.

> [!TIP]
> **Easy rule:** read `A.isAssignableFrom(B)` as *"can a `B` be stored in an `A` variable?"* — `Animal.isAssignableFrom(Dog)` → can a Dog become an Animal? **Yes.**

## getClassLoader()

Returns the class loader that loaded the class.

```java
System.out.println(Employee.class.getClassLoader());
```

```output
jdk.internal.loader.ClassLoaders$AppClassLoader@4e0e2f2a
```

(The hash after `@` varies; on Java 8 it prints `sun.misc.Launcher$AppClassLoader@…`.)

```java
System.out.println(String.class.getClassLoader());
```

```output
null
```

**Why?** Because `String` is loaded by the **Bootstrap ClassLoader**, which is implemented natively and isn't represented by a regular Java object.

## getDeclaredClasses()

Returns nested classes.

```java
class Employee {
    class Address {
    }
}

Class<?>[] classes = Employee.class.getDeclaredClasses();
System.out.println(Arrays.toString(classes));
```

```output
[class com.demo.Employee$Address]
```

## Complete Example

```java
Class<?> cls = Employee.class;

System.out.println(cls.getName());
System.out.println(cls.getSimpleName());
System.out.println(cls.getPackageName());
System.out.println(cls.getSuperclass());
System.out.println(cls.isInterface());
System.out.println(cls.isEnum());
System.out.println(cls.isAnnotation());
System.out.println(cls.isArray());
System.out.println(cls.isPrimitive());
System.out.println(cls.getClassLoader());
```

```output
com.demo.Employee
Employee
com.demo
class com.demo.Person
false
false
false
false
false
jdk.internal.loader.ClassLoaders$AppClassLoader@4e0e2f2a
```

## Methods Covered in This Chapter

```java
getName()
getSimpleName()
getCanonicalName()
getPackageName()
getSuperclass()
getInterfaces()
getModifiers()
isInterface()
isEnum()
isAnnotation()
isArray()
isPrimitive()
isAssignableFrom()
getClassLoader()
getDeclaredClasses()
```

## Interview Questions

### Q1. Which method returns the fully qualified class name?

`getName()`.

### Q2. Which method returns only the class name?

`getSimpleName()`.

### Q3. Which method returns the parent class?

`getSuperclass()`.

### Q4. Which method checks whether a class is an interface?

`isInterface()`.

### Q5. Which method returns implemented interfaces?

`getInterfaces()`.

### Q6. Which method returns the class loader?

`getClassLoader()`.

### Q7. Why does String.class.getClassLoader() return null?

Because `String` is loaded by the Bootstrap ClassLoader, which isn't exposed as a normal Java object.

### Q8. What is the difference between isPrimitive() for primitives and wrapper classes?

Primitive types (`int`, `double`, `boolean`, …) return `true`. Wrapper classes (`Integer`, `Double`, `Boolean`, …) return `false`.

## Key Points to Remember

- ✅ `Class` provides metadata about a loaded class.
- ✅ `getName()` returns the fully qualified class name; `getSimpleName()` only the class name.
- ✅ `getSuperclass()` returns the parent class (`null` for `Object`).
- ✅ `getInterfaces()` lists implemented interfaces.
- ✅ `Modifier` decodes modifier flags.
- ✅ `isAssignableFrom()` checks type compatibility.
- ✅ `getClassLoader()` identifies which class loader loaded the class.

## Chapter Summary

The `Class` API is the entry point for exploring a class's metadata. It lets us inspect names, packages, inheritance, interfaces, modifiers, type characteristics and class loaders. These methods are widely used by frameworks such as Spring, Hibernate, Jackson and JUnit before creating objects, injecting dependencies or invoking methods.
