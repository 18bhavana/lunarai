---
title: OOP Principles
subtitle: Classes, objects and the four pillars: encapsulation, inheritance, polymorphism and abstraction.
order: 1
---

## What is OOP?

OOP stands for **Object Oriented Programming**. Everything revolves around:

- Objects
- Classes
- Relationships

Instead of writing functions separately, we bundle **data** and **methods** inside one object.

For example, instead of keeping `deposit()`, `withdraw()` and `balance` as separate pieces, we create an `Account` that contains everything:

```flow-h An Account object owns its state and behaviour
deposit() · withdraw() · balance | separate pieces
: bundle into
Account | balance | deposit() | withdraw() | transfer()
```

This is called an **Object**.

## What is a Class?

A class is a **blueprint**. A house blueprint is *not* a real house, but using the blueprint we build `House1`, `House2`, `House3`.

Similarly, `class Employee` is only a blueprint. The objects are `Employee e1`, `Employee e2`, `Employee e3`.

```tree One class, many objects
Employee (class)
  e1
  e2
  e3
```

```java
class Employee {

    int id;
    String name;

}
```

Creating objects:

```java
Employee e1 = new Employee();
Employee e2 = new Employee();
```

Memory — each object has its own state:

```refs
e1 -> Employee object | id = 101 | name = John
e2 -> Employee object | id = 102 | name = David
```

## What is an Object?

**Object = Instance of a Class.**

```java
Car c = new Car();
```

Here `Car` is the class and `c` is the object.

## Four Pillars of OOP

There are only four:

1. Encapsulation
2. Inheritance
3. Polymorphism
4. Abstraction

> [!TIP]
> Almost every Java interview starts here.

## 1. Encapsulation

### Definition

Binding **data + methods** into one unit.

```java
class Employee {

    private int salary;

    public void setSalary(int salary) {
        this.salary = salary;
    }

    public int getSalary() {
        return salary;
    }

}
```

`salary` is hidden. It can be accessed only through methods.

### Why private?

Imagine anyone could write `salary = -50000`. Anyone can modify it — that is wrong.

Instead, `setSalary()` can **validate**:

```java
public void setSalary(int salary) {

    if (salary > 0)
        this.salary = salary;

}
```

Now the object is protected.

### Real-life example: ATM

You cannot access `balance` directly. You can only **Withdraw**, **Deposit** and **Check Balance**. That is exactly encapsulation.

### Advantages

- ✔ Data Hiding
- ✔ Security
- ✔ Easy Maintenance
- ✔ Loose Coupling

> [!QUESTION] Difference between Data Hiding and Encapsulation?
> **Data Hiding** → hiding variables.
> **Encapsulation** → wrapping variables and methods together.

## 2. Inheritance

### Definition

Acquiring properties from another class.

```flow
Parent
Child
```

```java
class Animal {

    void eat() {}

}
```

```java
class Dog extends Animal {

}
```

`Dog` automatically gets `eat()`.

Memory:

```flow Dog inherits eat() and sleep(), and adds bark()
Animal | eat() | sleep()
Dog | eat() | sleep() | bark()
```

### Advantages

- Code Reuse
- Easy Maintenance
- Less Duplicate Code

### Types of Inheritance

Java supports **Single**, **Multilevel** and **Hierarchical** inheritance.

Java does **not** support **Multiple Inheritance (with classes)** because of the **Diamond Problem**.

```flow-up Multilevel: C extends B, B extends A
A
B
C
```

```tree Hierarchical
Animal
  Dog
  Cat
```

```tree Multiple inheritance: not allowed with classes, allowed with interfaces
C
  A
  B
```

> [!NOTE]
> In the multiple-inheritance diagram above, `C` would have two parents (`A` and `B`). Not allowed using classes. Allowed using interfaces.

> [!QUESTION] Why doesn't Java support Multiple Inheritance?
> Because of the **Diamond Problem**.

```java
class A {

    void show() {}

}

class B extends A {

    void show() {}

}

class C extends A {

    void show() {}

}

class D extends B, C {   // not allowed in Java

}
```

The compiler cannot decide **which `show()` should execute**. Hence Java avoids this.

## 3. Polymorphism

**Poly** = Many, **Morph** = Forms. One object, many behaviours.

There are two types:

- Compile Time
- Run Time

### Compile Time — Method Overloading

```text
add(int)
add(double)
add(String)
```

Same method, different parameters. The **compiler decides**.

### Run Time — Method Overriding

```java
Animal a = new Dog();

a.sound();
```

```output
Dog Barking
```

The decision happens **during runtime**.

### Example

```java
class Animal {

    void sound() {
        System.out.println("Animal");
    }

}
```

```java
class Dog extends Animal {

    void sound() {
        System.out.println("Bark");
    }

}
```

```java
Animal a = new Dog();

a.sound();
```

```output
Bark
```

> [!QUESTION] Can static methods be overridden?
> No. They are hidden. This is called **Method Hiding**.

> [!QUESTION] Can private methods be overridden?
> No. Private methods are not inherited.

> [!QUESTION] Can constructors be overridden?
> No. Constructors are never inherited.

## 4. Abstraction

Showing only essential details. Hiding implementation.

**Example — ATM:** you click **Withdraw**. You don't know about the SQL, the server or the cash counting. All of that is hidden.

### Using Abstract Class

```java
abstract class Animal {

    abstract void sound();

}
```

```java
class Dog extends Animal {

    void sound() {
        System.out.println("Bark");
    }

}
```

### Using Interface

```java
interface Vehicle {

    void start();

}
```

```java
class Car implements Vehicle {

    public void start() {

    }

}
```

### Abstract Class vs Interface

| Abstract class | Interface |
| --- | --- |
| Can have concrete methods | Mostly a contract |
| Can have constructors | Supports multiple inheritance |
| Can have variables | Default methods |
| | Static methods |
| | Private methods (Java 9) |

> [!QUESTION] When to choose an Interface?
> When **unrelated classes share behaviour**.
> Example: `Employee`, `Vendor` and `Customer` can all **pay** — they implement `Payable`. There is no common parent, so an interface is best.

```tree
Payable (interface)
  Employee
  Vendor
  Customer
```

## OOP Interview Questions

### Q1. What are the four pillars?

Encapsulation, Inheritance, Polymorphism, Abstraction.

### Q2. Which principle provides security?

**Encapsulation.**

### Q3. Which principle enables code reuse?

**Inheritance.**

### Q4. Compile-time polymorphism?

**Method Overloading.**

### Q5. Runtime polymorphism?

**Method Overriding.**

### Q6. Can we instantiate an abstract class?

**No.**

### Q7. Can an interface have methods?

Yes.

- **Java 8+** → abstract, default and static methods
- **Java 9+** → private methods

### Q8. Which keyword creates inheritance?

`extends`

### Q9. Which keyword implements an interface?

`implements`

### Q10. Why use abstraction?

To expose only required functionality while hiding implementation details, improving maintainability and reducing complexity.

## Interview Tips (5 Years Experience)

Interviewers rarely stop at definitions. Be prepared to explain **where you've used each concept in real projects**:

- **Encapsulation:** DTOs, entities with private fields and controlled access through getters/setters.
- **Inheritance:** Base exception classes, common service implementations, or abstract controllers.
- **Polymorphism:** Strategy pattern, payment processors, notification services, dependency injection with interfaces.
- **Abstraction:** Service interfaces (`UserService`), repositories, external API clients, and framework contracts.

> [!TIP]
> For experienced developers, giving a real-world example after the definition often makes a stronger impression than reciting textbook explanations.

## Chapter Summary

**Topics covered:**

- ✅ Class & Object
- ✅ OOP Fundamentals
- ✅ Encapsulation
- ✅ Inheritance
- ✅ Polymorphism
- ✅ Abstraction
- ✅ Common interview questions
- ✅ Real-world examples

**Next:** SOLID Principles — one of the most frequently asked topics in Java/Spring Boot interviews for 5+ years of experience.
