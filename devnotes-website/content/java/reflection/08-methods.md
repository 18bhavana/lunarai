---
title: Methods in Reflection
subtitle: The Method API — getMethods vs getDeclaredMethods, invoking public, private, static and parameterized methods, return values, overloads, InvocationTargetException and framework usage.
order: 8
---

## Introduction

> [!NOTE]
> **Interview importance:** very high.

So far Reflection can inspect classes, create objects, and read and modify fields. Now we'll learn how Reflection can **inspect and invoke methods dynamically** at runtime.

This is one of the most used Reflection features in Spring, JUnit, Hibernate, Jackson, Mockito and Apache CXF. **Whenever a framework automatically executes a method without you explicitly calling it, Reflection is usually involved.**

## What is a Method?

A method is a behaviour of an object.

```java
class Employee {
    public void work() {
        System.out.println("Working...");
    }

    public int salary() {
        return 50000;
    }
}
```

Normally:

```java
Employee emp = new Employee();
emp.work();
```

The compiler knows which class, which object and which method. **Reflection removes this dependency.**

## The Method Reflection API

Reflection represents every method using **`java.lang.reflect.Method`**.

```flow-h
Class
Method
Inspect metadata
Invoke method
Return result
```

## Getting Methods

```java
public class Employee {
    public void work() {}
    public void display() {}
    private void secret() {}
}
```

### getMethods() — Public, Including Inherited

```java
Class<?> cls = Employee.class;

Method[] methods = cls.getMethods();

for (Method method : methods) {
    System.out.println(method.getName());
}
```

```output Output (partial)
work
display
wait
equals
hashCode
toString
notify
```

Notice: methods inherited from `Object` are also returned.

### getDeclaredMethods() — Declared in This Class Only

```java
Method[] methods = Employee.class.getDeclaredMethods();

for (Method method : methods) {
    System.out.println(method.getName());
}
```

```output
work
display
secret
```

Only methods declared inside `Employee` are returned — including the private one. (The order of returned methods isn't guaranteed.)

### getMethods() vs getDeclaredMethods()

| Method | Public | Private | Inherited |
| --- | --- | --- | --- |
| `getMethods()` | ✓ | ✗ | ✓ |
| `getDeclaredMethods()` | ✓ | ✓ | ✗ |

## Getting a Specific Method

```java
class Employee {
    public void work() {
    }
}

Method method = Employee.class.getMethod("work");
```

### A Private Method

```java
class Employee {
    private void secret() {
    }
}

Method method = Employee.class.getDeclaredMethod("secret");
method.setAccessible(true);
```

Now Reflection can invoke it.

### A Parameterized Method

```java
class Employee {
    public void save(String name, int age) {
    }
}

Method method = Employee.class.getMethod("save", String.class, int.class);
```

Notice: we pass **parameter types, not values**.

## Invoking Methods

### A Simple Method

```java
class Employee {
    public void work() {
        System.out.println("Working");
    }
}

Employee emp = new Employee();

Method method = Employee.class.getMethod("work");
method.invoke(emp);
```

```output
Working
```

Reflection executed the method dynamically.

### With Parameters

```java
class Employee {
    public void greet(String name) {
        System.out.println("Hello " + name);
    }
}

Employee emp = new Employee();

Method method = Employee.class.getMethod("greet", String.class);
method.invoke(emp, "Rahul");
```

```output
Hello Rahul
```

Arguments are supplied at runtime.

### Returning a Value

```java
class Employee {
    public int salary() {
        return 50000;
    }
}

Employee emp = new Employee();

Method method = Employee.class.getMethod("salary");
Object result = method.invoke(emp);

System.out.println(result);
```

```output
50000
```

Notice: `invoke()` always returns **`Object`**. Primitive return values are automatically boxed (here an `Integer`), and `void` methods return `null`.

### A Private Method

```java
class Employee {
    private void secret() {
        System.out.println("Hidden");
    }
}

Employee emp = new Employee();

Method method = Employee.class.getDeclaredMethod("secret");
method.setAccessible(true);
method.invoke(emp);
```

```output
Hidden
```

Reflection bypasses access checks (subject to module/security restrictions in modern Java).

### A Static Method

```java
class Employee {
    static void company() {
        System.out.println("OpenAI");
    }
}

Method method = Employee.class.getDeclaredMethod("company");
method.invoke(null);
```

```output
OpenAI
```

Static methods belong to the class, hence `null` is passed as the target.

## Method Metadata

For `public int salary()`:

```java
Method method = Employee.class.getMethod("salary");

System.out.println(method.getName());         // salary
System.out.println(method.getReturnType());   // int
```

For `public void save(String name, int age)`:

```java
Method method = Employee.class.getMethod("save", String.class, int.class);

System.out.println(method.getParameterCount());   // 2

for (Class<?> c : method.getParameterTypes()) {
    System.out.println(c);
}
```

```output
class java.lang.String
int
```

**Modifiers:**

```java
int modifier = method.getModifiers();

Modifier.isPublic(modifier);
Modifier.isStatic(modifier);
Modifier.isPrivate(modifier);
```

## Overloaded Methods

```java
class Employee {
    void save() {
    }

    void save(String name) {
    }
}
```

```java
Employee.class.getDeclaredMethod("save");                 // returns save()
Employee.class.getDeclaredMethod("save", String.class);   // returns save(String)
```

Reflection differentiates overloaded methods using **parameter types**.

## Exceptions

| Exception | Reason |
| --- | --- |
| `NoSuchMethodException` | Method not found |
| `IllegalAccessException` | Access denied |
| `IllegalArgumentException` | Wrong target object or argument types |
| `InvocationTargetException` | The invoked method itself threw an exception |

```java
try {
    Method method = Employee.class.getMethod("work");
    method.invoke(emp);
} catch (InvocationTargetException e) {
    Throwable real = e.getCause();   // the exception thrown inside work()
} catch (ReflectiveOperationException e) {
    e.printStackTrace();
}
```

> [!TIP]
> `InvocationTargetException` is only a wrapper — always look at `getCause()` to see what the method really threw.

## Internal Working of invoke()

```flow-h
Method object
Access check
Parameter validation
Invoke JVM method
Return result
```

## Real-World Examples

### JUnit

```java
@Test
public void loginTest() {
}
```

JUnit internally performs operations similar to:

```java
Method method = cls.getDeclaredMethod("loginTest");
method.invoke(testObject);
```

This is how test methods execute automatically.

### Spring Lifecycle Callbacks

```java
@PostConstruct
public void initialize() {
}
```

Spring does:

```java
Method method = cls.getDeclaredMethod("initialize");
method.invoke(bean);
```

The framework calls your method without you writing `bean.initialize()`.

### Spring MVC

```java
@GetMapping("/users")
public List<User> getUsers() {
}
```

When an HTTP request arrives, Spring finds `getUsers()` using Reflection and executes `method.invoke(controller)`.

### Mockito

Mockito creates proxy objects. Whenever you call `service.save()`, Mockito intercepts the call and handles it dynamically using Reflection and proxy (bytecode-generation) mechanisms.

## Interview Questions

### Q1. Which class represents methods?

`java.lang.reflect.Method`.

### Q2. Difference between getMethod() and getDeclaredMethod()?

| Method | Public | Private |
| --- | --- | --- |
| `getMethod()` | ✓ (including inherited) | ✗ |
| `getDeclaredMethod()` | ✓ (this class only) | ✓ |

### Q3. Difference between getMethods() and getDeclaredMethods()?

| Method | Public | Private | Inherited |
| --- | --- | --- | --- |
| `getMethods()` | ✓ | ✗ | ✓ |
| `getDeclaredMethods()` | ✓ | ✓ | ✗ |

### Q4. Which method executes another method?

`method.invoke()`.

### Q5. Can Reflection invoke private methods?

Yes — by calling `setAccessible(true)` before invoking the method.

### Q6. Why does invoke() return Object?

Because Reflection supports invoking methods with any return type. Primitive return values are automatically boxed into wrapper objects.

### Q7. How do you invoke a static method?

`method.invoke(null)`.

### Q8. How does Reflection identify overloaded methods?

By the combination of **method name** and **parameter types**.

## Key Points to Remember

- ✅ Methods are represented by `java.lang.reflect.Method`.
- ✅ `getMethod()` returns only public methods; `getDeclaredMethod()` returns any declared method.
- ✅ `invoke()` executes methods dynamically.
- ✅ Static methods use `null` as the target object.
- ✅ Private methods need `setAccessible(true)` (subject to modern Java restrictions).
- ✅ Overloaded methods are distinguished by parameter types.
- ✅ JUnit, Spring, Hibernate and Mockito rely heavily on the Method API.

## Chapter Summary

The `Method` API lets Reflection inspect method metadata and invoke methods dynamically at runtime. It supports public, private, static, overloaded and parameterized methods. This capability is central to frameworks like Spring, JUnit and Mockito, enabling them to execute application logic without compile-time knowledge of the target methods.
