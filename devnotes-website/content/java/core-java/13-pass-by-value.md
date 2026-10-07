---
title: Pass by Value in Java
subtitle: Why Java is always pass-by-value, and what really happens when you pass primitives, objects, Strings and arrays.
order: 13
---

## Introduction

One of the most confusing and frequently asked Java interview questions is:

> Is Java Pass by Value or Pass by Reference?

Many developers answer: *"Primitive types are Pass by Value and Objects are Pass by Reference."*

❌ **This is incorrect.** The correct answer is:

> **Java is 100% Pass by Value.**

Whether you pass a primitive variable or an object, Java always passes a **copy of the value**. The confusion arises because, for objects, the value being copied is the **reference (memory address)**, not the object itself.

## What is Pass by Value?

Pass by Value means a **copy of the variable's value** is passed to the method.

Any modification inside the method affects only the copied value. The original variable remains unchanged.

## Pass by Value with Primitive Types

```java
public class Demo {

    static void change(int x) {
        x = 100;
    }

    public static void main(String[] args) {
        int number = 10;
        change(number);
        System.out.println(number);
    }
}
```

```output
10
```

### Memory Representation

```flow-h Only the copied variable changes; the original stays 10
Before call | number = 10
: change(number) copies
Inside method | x = 10 → x = 100
After call | number = 10
```

## Pass by Value with Objects

```java
class Employee {
    String name;
}
```

```java
Employee emp = new Employee();
emp.name = "John";
```

Method:

```java
static void update(Employee e) {
    e.name = "David";
}
```

Calling:

```java
update(emp);
```

```output
David
```

Many people think Java passed the object by reference. **It did not.** Java passed a **copy of the reference**.

### Memory Diagram

```refs Both references hold 0x100, so they point to the same object
emp = 0x100, e = 0x100 (copy) -> Employee @0x100 | name = John → David
```

Changing object state with `e.name = "David";` updates the shared object.

## Reassigning the Reference

```java
static void change(Employee e) {
    e = new Employee();
    e.name = "Alice";
}
```

Main:

```java
Employee emp = new Employee();
emp.name = "John";
change(emp);
System.out.println(emp.name);
```

```output
John
```

**Why?** Because only the copied reference changed. The original reference still points to the original object.

### Memory Representation

```refs Before
emp = 0x100 -> Employee @0x100 | name = John
```

```refs Inside the method: the copy is re-pointed
emp = 0x100 -> Employee @0x100 | name = John
e = 0x200 -> Employee @0x200 | name = Alice
```

```refs After the method returns: the object at 0x200 is eligible for garbage collection
emp = 0x100 -> Employee @0x100 | name = John
```

## Primitive vs Object

| Primitive | Object |
| --- | --- |
| Value copied | Reference value copied |
| Independent values | Shared object |
| Original unchanged | Object state may change |

Java is Pass by Value in **both** cases.

## String Example

```java
static void change(String s) {
    s = "Spring";
}
```

```java
String str = "Java";
change(str);
System.out.println(str);
```

```output
Java
```

**Reason:** Strings are immutable. A new `String` object is created, and the original reference is unaffected.

## Array Example

```java
static void modify(int[] arr) {
    arr[0] = 99;
}
```

```java
int[] numbers = {10, 20, 30};
modify(numbers);
System.out.println(numbers[0]);
```

```output
99
```

Array contents changed because both references point to the same array.

### Reassigning Array

```java
static void reset(int[] arr) {
    arr = new int[]{1, 2, 3};
}
```

The original array remains unchanged. Only the copied reference changed.

## Wrapper Class Example

```java
static void increment(Integer x) {
    x++;
}
```

Main:

```java
Integer value = 10;
increment(value);
System.out.println(value);
```

```output
10
```

**Reason:** wrapper classes are immutable. `x++` creates a new `Integer`, and the original reference is unchanged.

## Mutable Object Example

```java
static void append(StringBuilder sb) {
    sb.append(" Boot");
}
```

```java
StringBuilder builder = new StringBuilder("Spring");
append(builder);
System.out.println(builder);
```

```output
Spring Boot
```

**Reason:** `StringBuilder` is mutable. Both references point to the same object.

## Why the Confusion?

People observe:

```java
employee.name = "David";
```

and think Java passed the object itself. Actually, Java **copied the reference value**. Both references point to the same object. The **object** changes, not the reference.

## Real Project Examples

### Service Layer

```java
updateEmployee(employee);
```

The service modifies the employee object. The caller sees updated values because both references point to the same object.

### DTO

```java
request.setUsername("John");
```

The method changes object state. The original object reflects the changes.

### Collections

```java
addEmployee(list);
```

The method adds elements. The caller sees the updated list.

## Interview Trick Question

> [!QUESTION] Can a method change the caller's object reference?
> **No.** It can only change the object's **state**. It cannot change the caller's reference variable.

## Pass by Value vs Pass by Reference

| Pass by Value | Pass by Reference |
| --- | --- |
| Copy of value is passed | Original variable is passed |
| Original variable cannot be reassigned | Original reference can change |
| Java | Languages like C++ (reference parameters) |

Java supports **only** Pass by Value.

## Common Interview Questions

### Q1. Is Java Pass by Value or Pass by Reference?

Java is **always Pass by Value**.

### Q2. Why do object changes reflect outside the method?

Because the copied reference and original reference point to the same object.

### Q3. Can a method change the caller's object reference?

No. Only the copied reference can be reassigned.

### Q4. Why does changing a String inside a method not affect the caller?

Because `String` is immutable.

### Q5. Can arrays be modified inside methods?

Yes. Arrays are mutable.

### Q6. Can wrapper objects be modified?

No. Wrapper classes are immutable.

### Q7. Why is StringBuilder modified successfully?

Because it is mutable.

### Q8. What exactly is passed for objects?

A copy of the object reference.

### Q9. Can Java simulate Pass by Reference?

Not directly. You can modify the state of mutable objects, but you cannot change the caller's reference variable.

### Q10. What is the correct interview answer?

> **Java is always Pass by Value. For objects, the value being passed is a copy of the reference.**

## Common Mistakes

- Saying Java supports Pass by Reference.
- Confusing object modification with reference modification.
- Assuming reassigning a parameter changes the caller's variable.
- Forgetting that immutable objects behave differently.

## Best Practices

- Remember that Java is always Pass by Value.
- Use mutable objects only when modification is intended.
- Prefer immutable objects where possible.
- Clearly document methods that modify object state.
- Be careful when passing collections or mutable DTOs.

## Quick Revision

```flow
Primitive
Copy Value
No Change
---
Object
Copy Reference
Same Object
State Can Change
Reference Cannot Change
```

## Interview Cheat Sheet

| Scenario | Result |
| --- | --- |
| Primitive passed | Copy of value |
| Object passed | Copy of reference |
| Modify object state | Visible outside |
| Reassign parameter | Not visible outside |
| String modification | No change |
| StringBuilder modification | Visible outside |

## Chapter Summary

After completing this chapter, you should be able to:

- Explain why Java is always Pass by Value.
- Differentiate between copying a primitive value and copying an object reference.
- Understand why object state changes are visible while reference reassignments are not.
- Explain the behaviour of Strings, Arrays, Wrapper Classes, and `StringBuilder` when passed to methods.
- Confidently answer one of the most common Java interview questions with diagrams and examples.
