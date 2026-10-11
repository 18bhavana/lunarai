---
title: Observer Pattern
subtitle: One-to-many notification — the YouTube channel example, Subject and Observer roles, push vs pull, thread safety, Spring application events, and how Observer relates to pub/sub messaging.
order: 6
---

## Introduction

**Purpose:** notify **multiple objects** automatically when one object's state changes.

The **subject** keeps a list of **observers** and calls each of them when something happens. The subject doesn't know what observers do — it just tells them — so new reactions can be added without changing the subject.

## Example: YouTube Subscribers

### Observer

```java
interface Observer {
    void update(String video);
}

class Subscriber implements Observer {
    private final String name;

    public Subscriber(String name) {
        this.name = name;
    }

    @Override
    public void update(String video) {
        System.out.println(name + " notified about: " + video);
    }
}
```

### Subject

```java
interface Subject {
    void subscribe(Observer observer);
    void unsubscribe(Observer observer);
    void notifyObservers(String video);
}

class YouTubeChannel implements Subject {
    private final List<Observer> observers = new ArrayList<>();

    @Override
    public void subscribe(Observer observer) {
        observers.add(observer);
    }

    @Override
    public void unsubscribe(Observer observer) {
        observers.remove(observer);
    }

    @Override
    public void notifyObservers(String video) {
        for (Observer observer : observers) {
            observer.update(video);
        }
    }

    public void uploadVideo(String video) {
        System.out.println("Uploaded: " + video);
        notifyObservers(video);
    }
}
```

### Client

```java
public class Main {
    public static void main(String[] args) {
        YouTubeChannel channel = new YouTubeChannel();

        Observer user1 = new Subscriber("Raju");
        Observer user2 = new Subscriber("John");

        channel.subscribe(user1);
        channel.subscribe(user2);

        channel.uploadVideo("Java Design Patterns");
    }
}
```

```output
Uploaded: Java Design Patterns
Raju notified about: Java Design Patterns
John notified about: Java Design Patterns
```

## Structure

```tree
Subject — YouTubeChannel
  Observer A — Raju
  Observer B — John
  Observer C — any future subscriber
```

| Role | In the example | Responsibility |
| --- | --- | --- |
| **Subject** | `YouTubeChannel` | Maintains observers; notifies them on change |
| **Observer** | `Observer` interface | The callback every observer implements |
| **Concrete observer** | `Subscriber` | Reacts to the notification |

> [!IMPORTANT]
> **Key point:** a **one-to-many** notification relationship with **loose coupling** — the subject depends only on the `Observer` interface.

## Push vs Pull

| Push model | Pull model |
| --- | --- |
| The subject sends the data: `update(String video)` | The subject sends itself (or nothing); observers query what they need: `update(Subject s)` |
| Simple; observers get exactly what's sent | Flexible; observers choose what to read |
| Changing the data means changing the interface | Observers depend on the subject's API |

The example uses the push model.

## Practical Concerns

### Thread Safety

If observers can subscribe while notifications are being sent from another thread, an `ArrayList` throws `ConcurrentModificationException`. A **`CopyOnWriteArrayList`** is the standard fix — subscriptions are rare and iteration is frequent:

```java
private final List<Observer> observers = new CopyOnWriteArrayList<>();
```

### One Failing Observer

An exception in one observer's `update()` stops the loop, so later observers never get notified. Catch and log per observer if notifications must be independent.

### Slow Observers

Notification is **synchronous** — the subject waits for every observer. Slow observers (sending emails, calling APIs) should hand work off to an executor or a message queue.

### Memory Leaks

The subject holds strong references to its observers. Observers that are never unsubscribed can't be garbage-collected — the *lapsed listener* problem. Always unsubscribe when an observer's lifecycle ends.

## Observer in Java and Spring

| Example | Notes |
| --- | --- |
| `java.util.Observer` / `Observable` | **Deprecated since Java 9** — not serializable, not thread-safe, `Observable` is a class you must extend |
| `PropertyChangeListener` (`java.beans`) | Classic JavaBeans observer |
| GUI listeners (`ActionListener`) | Event listeners are observers |
| `java.util.concurrent.Flow` | Reactive Streams interfaces (Java 9) |
| **Spring `ApplicationEvent`** | Built-in observer mechanism in the container |

### Spring Application Events

```java
public record OrderPlacedEvent(long orderId, String email) { }

@Service
public class OrderService {
    private final ApplicationEventPublisher publisher;

    public OrderService(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void placeOrder(Order order) {
        // ... save the order
        publisher.publishEvent(new OrderPlacedEvent(order.getId(), order.getEmail()));   // subject
    }
}

@Component
class ConfirmationEmailListener {
    @EventListener                                     // observer
    public void on(OrderPlacedEvent event) { ... }
}

@Component
class LoyaltyPointsListener {
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)   // only after the order commits
    public void on(OrderPlacedEvent event) { ... }
}
```

`OrderService` doesn't know who listens — adding an analytics listener requires no change to it. `@EventListener` runs synchronously in the publisher's thread by default; add `@Async` for background handling.

## Observer vs Publish–Subscribe

| Observer | Publish–subscribe |
| --- | --- |
| Subject calls observers **directly** | Publishers and subscribers communicate through a **broker** (Kafka, RabbitMQ) |
| Same process, usually synchronous | Across processes and services, asynchronous |
| Subject knows its observers (as interfaces) | Neither side knows the other |
| No persistence | Messages can be persisted and replayed |

Pub/sub is the distributed evolution of Observer — and the basis of choreographed Sagas (see the Saga chapter).

## When to Use

- A change in one object must trigger reactions in an open-ended set of others.
- You want to add new reactions (emails, audit, analytics, cache eviction) without editing the source.
- Event-driven designs inside one application.

## Interview Questions

### Q1. What is the Observer pattern?

A behavioral pattern defining a one-to-many relationship in which observers are notified automatically when the subject's state changes.

### Q2. What are the participants?

The subject (maintains observers and notifies them), the observer interface (the callback) and concrete observers (the reactions).

### Q3. How does Spring implement Observer?

Through application events: beans publish events with `ApplicationEventPublisher`, and listeners annotated with `@EventListener` or `@TransactionalEventListener` (or implementing `ApplicationListener`) receive them.

### Q4. Why was java.util.Observable deprecated?

It's a class rather than an interface (forcing inheritance), isn't thread-safe or serializable, and its event model is too limited. Listeners, `PropertyChangeSupport`, Spring events and the `Flow` API are recommended instead.

### Q5. What's the difference between Observer and pub/sub?

In Observer the subject notifies observers directly, usually in-process. In pub/sub, publishers and subscribers are decoupled by a message broker and often run in different services.

### Q6. How do you make an observer list thread-safe?

Use `CopyOnWriteArrayList`, which allows safe iteration while other threads subscribe or unsubscribe.

## Common Mistakes

- ❌ **Never unsubscribing** — memory leaks (lapsed listeners).
- ❌ **Slow work inside `update()`**, blocking the subject.
- ❌ **One observer's exception** stopping the rest.
- ❌ **Non-thread-safe observer lists** with concurrent subscription.
- ❌ **Observers that modify the subject during notification**, causing cascades or infinite loops.

## Key Takeaways

- ✅ Observer defines a one-to-many notification relationship.
- ✅ The subject depends only on the observer interface — loose coupling.
- ✅ Use `CopyOnWriteArrayList`, isolate failures and offload slow observers.
- ✅ Spring application events are the idiomatic Observer in Spring applications.
- ✅ Pub/sub with a message broker is Observer across services.
