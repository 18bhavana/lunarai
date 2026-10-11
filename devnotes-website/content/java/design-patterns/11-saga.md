---
title: Saga Pattern
subtitle: Business consistency across microservices — local transactions and compensating transactions, an order–payment–inventory saga, choreography vs orchestration, idempotency, and why compensation is not rollback.
order: 11
---

## Introduction

**Purpose:** maintain **business consistency across multiple services** using **local transactions** and **compensating transactions**.

In a monolith, creating an order, charging payment and reserving stock can share one database transaction — if any step fails, everything rolls back. In microservices, each service owns its **own database**, so there's no single transaction spanning them, and distributed two-phase commit (2PC) is slow, fragile and unsupported by most message brokers and cloud databases.

A **saga** is a sequence of local transactions, one per service. If a step fails, the saga runs **compensating transactions** that undo the work of the steps that already succeeded.

## Example: Placing an Order

```flow
T1 Create Order
T2 Process Payment
T3 Reserve Inventory
```

If inventory fails:

```flow
T3 Reserve Inventory fails
C2 Refund Payment
C1 Cancel Order
```

Compensations run in **reverse order**.

### The Services

```java
class OrderService {
    public void createOrder()  { System.out.println("Order Created"); }
    public void cancelOrder()  { System.out.println("Order Cancelled"); }
}

class PaymentService {
    public void processPayment() { System.out.println("Payment Completed"); }
    public void refundPayment()  { System.out.println("Payment Refunded"); }
}

class InventoryService {
    public void reserveInventory() {
        System.out.println("Reserving Inventory...");
        throw new RuntimeException("Inventory unavailable");
    }

    public void releaseInventory() {
        System.out.println("Inventory Released");
    }
}
```

### The Saga

```java
class OrderSaga {
    private final OrderService orderService = new OrderService();
    private final PaymentService paymentService = new PaymentService();
    private final InventoryService inventoryService = new InventoryService();

    public void execute() {
        boolean orderCreated = false;
        boolean paymentCompleted = false;
        boolean inventoryReserved = false;

        try {
            orderService.createOrder();            // T1
            orderCreated = true;

            paymentService.processPayment();       // T2
            paymentCompleted = true;

            inventoryService.reserveInventory();   // T3
            inventoryReserved = true;

            System.out.println("Saga Completed Successfully");

        } catch (Exception e) {
            System.out.println("Saga Failed: " + e.getMessage());

            // Compensations are performed in reverse order
            if (inventoryReserved) {
                inventoryService.releaseInventory();
            }
            if (paymentCompleted) {
                paymentService.refundPayment();
            }
            if (orderCreated) {
                orderService.cancelOrder();
            }

            System.out.println("Saga Compensation Completed");
        }
    }
}

public class Main {
    public static void main(String[] args) {
        new OrderSaga().execute();
    }
}
```

```output
Order Created
Payment Completed
Reserving Inventory...
Saga Failed: Inventory unavailable
Payment Refunded
Order Cancelled
Saga Compensation Completed
```

Inventory was never reserved (T3 failed), so only C2 and C1 run.

> [!IMPORTANT]
> **Saga compensation is NOT a database rollback.** It's a **new business transaction** that logically reverses earlier work. The payment really happened and the customer may have seen it; the refund is a separate, visible transaction. That's why sagas give **eventual consistency**, not ACID atomicity across services.

## Choreography

There's **no central coordinator**. Each service listens for events and reacts by doing its local transaction and publishing the next event:

```flow
Order Service — publishes OrderCreated
Payment Service — publishes PaymentCompleted
Inventory Service — publishes InventoryReserved
Shipping Service — ships the order
```

**Memory trick:** event → reaction → event → reaction.

On failure, the failing service publishes a failure event (`InventoryReservationFailed`), and upstream services listen for it and run their compensations (Payment refunds, Order cancels).

## Orchestration

A **central orchestrator** tells each service what to do and decides what happens next:

```tree
OrderSaga orchestrator
  Payment service
  Inventory service
  Shipping service
```

```java
class SagaOrchestrator {
    public void execute() {
        createOrder();
        processPayment();
        reserveInventory();
        createShipment();
    }
}
```

The orchestrator decides: *what happens next? what succeeded? what failed? which compensation should run?* In real systems it sends **commands** (often as messages) and stores the saga's state in a database, so it can resume after a crash.

## Choreography vs Orchestration

| Choreography | Orchestration |
| --- | --- |
| Events, **no central boss** | **Central orchestrator** sends commands |
| Loosely coupled — services only know events | Services are simple; the flow lives in one place |
| Easy for short flows (2–4 steps) | Better for long or complex flows |
| Hard to see the whole flow; risk of cyclic event dependencies | Flow is explicit, easy to monitor and change |
| No single point of failure | The orchestrator must be reliable and persistent |
| Typical tools: Kafka / RabbitMQ events | Typical tools: Temporal, Camunda, Axon, a custom state machine |

## Making Sagas Reliable in Production

The in-memory example shows the idea; real sagas must handle failures between steps:

| Concern | Solution |
| --- | --- |
| **Crashes mid-saga** | Persist saga state (orchestrator table or event log) and resume |
| **Duplicate messages** | Make every step and compensation **idempotent** (deduplicate by saga / request ID) |
| **Saving data and publishing an event atomically** | **Transactional outbox**: write the event to an outbox table in the same local transaction, then relay it to the broker |
| **Compensations that fail** | Retry them (they must be retryable); alert for manual handling as a last resort |
| **Isolation** — other requests see intermediate states | Semantic locks / status fields (`PENDING_PAYMENT`), commutative updates, re-reading values |
| **Steps that can't be undone** (sending an email, shipping) | Put them last (**pivot** and **retriable** transactions), or compensate with a follow-up action (a correction email) |

> [!TIP]
> Order steps so that the ones most likely to fail — and the easiest to undo — come first, and irreversible actions come last.

## Saga vs Two-Phase Commit

| Saga | Two-phase commit (2PC) |
| --- | --- |
| Sequence of local transactions + compensations | One global atomic transaction |
| Eventual consistency | Strong consistency (ACID) |
| No distributed locks — services stay available | Participants hold locks while waiting for the coordinator |
| Works with message brokers and NoSQL | Needs XA support from every resource |
| More application logic (compensations) | Blocking, coordinator is a single point of failure |

## When to Use

- A business operation spans several services, each with its own database.
- Eventual consistency is acceptable, and every step has a meaningful business compensation.
- Not needed when the operation fits in one service and one database — use a normal local transaction.

## Interview Questions

### Q1. What is the Saga pattern?

A pattern for maintaining business consistency across multiple services by executing a sequence of local transactions and, if a step fails, running compensating transactions that reverse the steps already completed.

### Q2. What is a compensating transaction?

A new business operation that semantically undoes an earlier step — for example a refund for a payment, or cancelling an order. It's not a database rollback.

### Q3. What's the difference between choreography and orchestration?

In choreography, services react to each other's events with no central coordinator. In orchestration, a central orchestrator sends commands to each service and decides the next step and the compensations.

### Q4. Why not use a distributed transaction (2PC)?

2PC holds locks across services, blocks when the coordinator fails, reduces availability, and isn't supported by many brokers and databases. Sagas trade strong consistency for availability and scalability.

### Q5. How do you make saga steps reliable?

Idempotent steps and compensations, persisted saga state, the transactional outbox pattern for publishing events, retries for compensations, and monitoring for sagas stuck mid-way.

### Q6. Does a saga provide ACID guarantees?

It provides atomicity in the business sense (all steps complete or are compensated) but not isolation — intermediate states are visible to other transactions — so it gives eventual consistency.

## Common Mistakes

- ❌ **Treating compensation as rollback** — the original effects were real and visible.
- ❌ **Non-idempotent steps** — duplicate messages charge customers twice.
- ❌ **Publishing events outside the local transaction** — lost or phantom events (use an outbox).
- ❌ **No persisted state** — a crash leaves the saga half-done forever.
- ❌ **Irreversible steps early in the saga.**
- ❌ **Choreography for long, complex flows** that nobody can follow.

## Key Takeaways

- ✅ A saga keeps data consistent across services with local transactions plus compensations.
- ✅ Compensations run in reverse order and are new business transactions, not rollbacks.
- ✅ Choreography = events and no central boss; orchestration = a central coordinator.
- ✅ Production sagas need idempotency, persisted state and the transactional outbox.
- ✅ Sagas give eventual consistency instead of 2PC's blocking strong consistency.
