---
title: Builder Pattern
subtitle: Constructing complex objects step by step — the telescoping-constructor problem, a fluent immutable User builder, validation in build(), Lombok @Builder, records, and builders in the JDK and Spring.
order: 4
---

## Introduction

**Purpose:** construct **complex objects step by step**, separating construction from the final object.

The Builder pattern shines when an object has **many fields**, several of them optional, and you want the result to be **immutable**.

## The Problem: Telescoping Constructors

```java
new User("Raju", 30, "raju@example.com", "9999999999");
new User("Raju", 30, null, "9999999999");     // which argument is which?
new User("Raju", 0, "raju@example.com", null);
```

With many parameters you end up with either a long list of overloaded constructors ("telescoping constructors"), unreadable calls full of `null`s, or a mutable object with setters that can be observed half-built.

## Example: User Builder

```java
class User {
    private final String name;
    private final int age;
    private final String email;
    private final String phone;

    private User(Builder builder) {          // only the builder can create a User
        this.name = builder.name;
        this.age = builder.age;
        this.email = builder.email;
        this.phone = builder.phone;
    }

    public static class Builder {
        private String name;
        private int age;
        private String email;
        private String phone;

        public Builder name(String name) {
            this.name = name;
            return this;                     // return this → fluent chaining
        }

        public Builder age(int age) {
            this.age = age;
            return this;
        }

        public Builder email(String email) {
            this.email = email;
            return this;
        }

        public Builder phone(String phone) {
            this.phone = phone;
            return this;
        }

        public User build() {
            return new User(this);
        }
    }

    @Override
    public String toString() {
        return name + " " + age + " " + email + " " + phone;
    }
}
```

```java
public class Main {
    public static void main(String[] args) {
        User user = new User.Builder()
                .name("Raju")
                .age(30)
                .email("raju@example.com")
                .phone("9999999999")
                .build();

        System.out.println(user);
    }
}
```

```output
Raju 30 raju@example.com 9999999999
```

**Key point:** object creation becomes a readable sequence:

```flow-h
new Builder()
set property
set property
set property
build()
```

## Why This Design Works

| Element | Purpose |
| --- | --- |
| `private` constructor taking the builder | `User` can only be created through the builder |
| `final` fields in `User` | The built object is **immutable** — and therefore thread-safe |
| Static nested `Builder` | Holds the mutable, in-progress state |
| Methods returning `this` | Fluent, self-documenting chaining |
| `build()` | Single place to validate and create the object |

## Adding Validation

`build()` is the natural place to enforce invariants and required fields:

```java
public User build() {
    if (name == null || name.isBlank()) {
        throw new IllegalStateException("name is required");
    }
    if (age < 0) {
        throw new IllegalStateException("age must be non-negative");
    }
    return new User(this);
}
```

Required fields can also be passed to the builder's constructor — `new User.Builder("Raju")` — so it's impossible to forget them.

> [!TIP]
> A `User` is never visible in an invalid or half-initialized state: it doesn't exist until `build()` succeeds. That's the big advantage over a no-arg constructor plus setters.

## Lombok @Builder

Lombok generates all of the above:

```java
@Builder
@Getter
@ToString
public class User {
    private final String name;
    private final int age;
    private final String email;
    private final String phone;
}

User user = User.builder().name("Raju").age(30).build();
```

`@Builder.Default` sets default values; `toBuilder = true` adds `user.toBuilder().age(31).build()` for copying with changes.

## Builders vs Records

```java
record User(String name, int age, String email, String phone) { }

new User("Raju", 30, "raju@example.com", "9999999999");
```

Records are perfect for small immutable data, but with many fields (especially optional ones) the positional constructor becomes as unreadable as a telescoping constructor. A builder on top of a record (hand-written or via Lombok's `@Builder` on the record) gives the best of both.

## Builders in the JDK and Spring

| Example | What it builds |
| --- | --- |
| `StringBuilder` | Strings, piece by piece |
| `HttpRequest.newBuilder()` | `java.net.http` requests |
| `Stream.builder()` | Streams |
| `Thread.ofPlatform().name(...).start(...)` | Threads (Java 21) |
| `UriComponentsBuilder` | URIs in Spring |
| `ResponseEntity.ok().header(...).body(...)` | HTTP responses in Spring |
| `WebClient.builder()`, `RestClient.builder()` | HTTP clients |
| `MockMvcRequestBuilders.get(...)` | Test requests |

## When to Use

- More than about four constructor parameters, or several optional ones.
- You want **immutable** objects.
- Construction needs validation across several fields.
- You want readable test-data creation (`anOrder().withStatus(PAID).build()`).

Don't use it for simple objects with two or three required fields — a constructor is clearer.

## Interview Questions

### Q1. What is the Builder pattern?

A creational pattern that constructs a complex object step by step through a separate builder object, then creates the final — usually immutable — object in a `build()` method.

### Q2. What problem does Builder solve?

The telescoping-constructor problem and unreadable calls with many parameters, while avoiding mutable objects built with setters that can be seen half-initialized.

### Q3. Why is the builder a static nested class?

So it can be created without an instance of the outer class (`new User.Builder()`) and can access the outer class's private constructor.

### Q4. Builder vs Factory?

A factory decides **which** object to create, usually in one call. A builder controls **how** one complex object is assembled, step by step.

### Q5. How do you make a builder enforce required fields?

Validate in `build()` and throw if missing, or require those values in the builder's constructor.

### Q6. Is the builder itself thread-safe?

Usually not — a builder is mutable and meant to be used by one thread. The object it builds is immutable and therefore thread-safe.

## Common Mistakes

- ❌ **Non-final fields or setters on the built class** — losing immutability.
- ❌ **No validation in `build()`**, so invalid objects can be created.
- ❌ **Sharing one builder between threads.**
- ❌ **Using a builder for trivial objects.**
- ❌ **Exposing mutable collections** from the built object — copy them (`List.copyOf`).

## Key Takeaways

- ✅ Builder constructs complex objects step by step with a fluent API.
- ✅ A private constructor plus `final` fields make the result immutable.
- ✅ `build()` is the single place to validate.
- ✅ Lombok `@Builder` removes the boilerplate.
- ✅ Builders are everywhere: `StringBuilder`, `HttpRequest`, `ResponseEntity`, `WebClient`.
