---
title: "@Service"
subtitle: The business logic layer — why @Service exists when @Component works, layer responsibilities, service-to-service calls, transaction boundaries and common mistakes.
order: 3
---

## Introduction

In the previous chapter we learned that `@Component` is the foundation of Spring's component model. A natural interview question arises:

> [!QUESTION] If @Component can create a bean, why do we need @Service?
> One of the most common Spring interview questions — this chapter answers it.

## What is @Service?

`@Service` marks a class as the **business logic layer** of your application. It tells developers (and Spring): *"This class contains business rules and application logic."*

```java
@Service
public class UserService {

    public User getUser(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }
}
```

Spring creates this class as a bean **exactly like `@Component`**. The difference is its **semantic meaning**, not its bean-creation behaviour.

> [!NOTE]
> Spring Data's `findById()` returns `Optional<User>`, so a method returning `User` must unwrap it (e.g. with `orElseThrow()`).

## What is Business Logic?

Business logic is the set of rules that solve a business problem. Imagine an e-commerce application where a customer places an order. The system must:

- Validate the customer
- Check product availability
- Calculate discount
- Calculate tax
- Reserve inventory
- Save the order
- Send a confirmation email

These are business rules. They belong inside a **service**.

## Application Layers

```flow Each layer has a different responsibility
HTTP request
Controller
Service
Repository
Database
```

| Layer | Annotation | Responsibilities |
| --- | --- | --- |
| Controller | `@RestController` | Receive the request, validate request format, convert JSON, call the service, return the response. **No business logic.** |
| Service | `@Service` | Business logic, calculations, validation, transactions, calling repositories, calling external APIs |
| Repository | `@Repository` | Database operations — SQL, JPA, CRUD |

## Example Without a Service Layer

❌ Bad design:

```java
@RestController
public class UserController {

    @Autowired
    UserRepository repository;

    @PostMapping("/users")
    public User create(@RequestBody User user) {

        if (user.getAge() < 18) {
            throw new RuntimeException();
        }

        repository.save(user);
        emailService.send();

        return user;
    }
}
```

**Problems:** the controller becomes huge, is difficult to test and reuse, and mixes HTTP with business logic.

## Proper Design

**Controller:**

```java
@RestController
public class UserController {

    @Autowired
    UserService service;

    @PostMapping("/users")
    public User create(@RequestBody User user) {
        return service.createUser(user);
    }
}
```

**Service:**

```java
@Service
public class UserService {

    @Autowired
    UserRepository repository;

    @Autowired
    EmailService emailService;

    public User createUser(User user) {

        if (user.getAge() < 18) {
            throw new IllegalArgumentException("Invalid age");
        }

        User saved = repository.save(user);
        emailService.sendEmail();

        return saved;
    }
}
```

Now each class has a **single responsibility**.

## Internal Working

```flow
Component scan
Found @Service
@Service is meta-annotated with @Component
Create BeanDefinition
Instantiate bean
Store in ApplicationContext
```

## Is @Service Different from @Component?

Conceptually, `@Service` is:

```java
@Component
public @interface Service {
}
```

So bean creation is **identical**. The difference is **meaning**:

| Annotation | Meaning |
| --- | --- |
| `@Component` | Generic bean |
| `@Service` | Business logic |
| `@Repository` | Data access |
| `@Controller` | MVC controller |

## Why Not Use @Component Everywhere?

Technically you can — Spring will create the bean. But imagine a project with 300 classes all marked `@Component`. Can you immediately identify the business classes, controllers and database layer? **No.**

Now compare a codebase using `@Service`, `@Repository`, `@Controller` and `@RestController`: **the architecture becomes self-documenting.**

## Real Enterprise Example

An online banking application:

```flow-h
TransferController
TransferService
AccountRepository
Oracle database
```

```java
@Service
public class TransferService {

    public void transfer() {
        validateSender();
        validateReceiver();
        checkBalance();
        debit();
        credit();
        sendNotification();
    }
}
```

Everything here is business logic.

## A Service Can Call Multiple Repositories

A common misconception is *one service = one repository*. Not true:

```java
@Service
public class OrderService {

    @Autowired
    OrderRepository orderRepository;

    @Autowired
    ProductRepository productRepository;

    @Autowired
    CustomerRepository customerRepository;
}
```

One business operation may require multiple repositories.

## A Service Can Call Other Services

```java
@Service
public class PaymentService {
}

@Service
public class OrderService {

    @Autowired
    PaymentService paymentService;
}
```

```flow-h This is common in enterprise applications
Controller
OrderService
PaymentService
Repository
```

## Transactions Usually Start Here

```java
@Transactional
@Service
public class OrderService {
}
```

**Reason:** a business operation often updates multiple tables — e.g. *update account + insert transaction + update balance*. These operations should **either all succeed or all fail together**. The service layer is the appropriate place to define that transaction boundary.

## Dependency Injection

```java
@Service
public class UserService {

    @Autowired
    UserRepository repository;
}
```

Spring injects the `UserRepository` bean into the `UserService` bean. No manual object creation is needed.

## Singleton Nature

Like `@Component`, services are **singleton by default** — `UserController` and `AdminController` both receive the same `UserService` instance. Because of this, services should generally remain **stateless**.

```java
// ✅ Good
@Service
public class DiscountService {

    public double calculate(double price) {
        return price * 0.9;
    }
}

// ❌ Bad — mutable shared state can cause thread-safety issues
@Service
public class DiscountService {

    private double currentPrice;
}
```

## Package Structure

A common project layout:

```tree Business classes belong in the service package
com.company.project
  controller
  service
  repository
  entity
  dto
  config
  security
  exception
  util
```

## Common Mistakes

### Putting Business Logic in the Controller

```java
@RestController
public class OrderController {

    public void placeOrder() {
        // calculate tax
        // calculate discount
        // inventory
        // payment
    }
}
```

Move this logic into a service.

### Putting Business Logic in the Repository

```java
@Repository
public class UserRepository {

    public void calculateSalary() {
    }
}
```

Repositories should focus on data access, not business rules.

### Using Static Methods

```java
@Service
public class UserService {

    public static void process() {
    }
}
```

Static methods bypass dependency injection (and proxies such as `@Transactional`) and make testing harder. Prefer instance methods managed by Spring.

## Interview Questions

### Q1. What is @Service?

A stereotype annotation used to mark business logic classes. It is detected during component scanning and registered as a Spring bean.

### Q2. Is @Service different from @Component?

Functionally, bean creation is the same. `@Service` provides semantic meaning, making the application's architecture clearer.

### Q3. Can we replace @Service with @Component?

Yes, Spring will still create the bean. However, using `@Service` is best practice because it clearly identifies the business layer.

### Q4. Why is business logic placed in the service layer?

To separate HTTP handling from business rules, improve maintainability, enable reuse, and keep the codebase aligned with the Single Responsibility Principle.

### Q5. Can one service call another service?

Yes. Complex workflows often require collaboration between multiple services.

### Q6. Can one service use multiple repositories?

Yes. A business operation may involve multiple entities and therefore multiple repositories.

### Q7. Why is @Transactional commonly placed on service methods?

Because a single business operation may span multiple database operations, and the service layer defines the transaction boundary.

## Key Takeaways

- ✅ `@Service` represents the business layer.
- ✅ It is a stereotype annotation built on top of `@Component`.
- ✅ Controllers should delegate business work to services.
- ✅ Services coordinate repositories, external APIs, validations and transactions.
- ✅ Services are singleton beans by default and should generally be stateless.
- ✅ The service layer is the heart of enterprise Spring Boot applications.
