# Saga Pattern

## Managing Distributed Transactions

In a monolithic application with a single database, you have **ACID transactions**. You can update `Order`, `Inventory`, and `Payment` tables in one transaction. If anything fails, everything rolls back.

In a distributed system (Microservices) or when using multiple aggregates that shouldn't be updated together, you lose ACID transactions. **Sagas** are the solution.

### Key Principle

> "A Saga is a sequence of local transactions. Each local transaction updates the database and publishes a message or event to trigger the next local transaction in the saga."

---

## How Sagas Work

A Saga breaks a long-running transaction into small steps.

**Example: Booking a Trip**

1. **Book Flight** (Success)
2. **Book Hotel** (Success)
3. **Book Car** (Failure!) -> **Compensate!**

### Compensating Transactions

If a step fails, you must execute **compensating transactions** to undo the changes made by previous steps.

1. **Cancel Hotel** (Compensation for step 2)
2. **Cancel Flight** (Compensation for step 1)

**Result:** System returns to a consistent state (Trip Cancelled).

---

## Two Types of Sagas

### 1. Choreography (Event-Based)

Each service listens to events and decides what to do. There is no central coordinator.

**Flow:**

1. `OrderService`: Creates Order -> Publishes `OrderCreated`
2. `PaymentService`: Listens `OrderCreated` -> Charges Card -> Publishes `PaymentProcessed`
3. `InventoryService`: Listens `PaymentProcessed` -> Reserves Stock -> Publishes `StockReserved`
4. `OrderService`: Listens `StockReserved` -> Updates Order to `CONFIRMED`

**Pros:**

- Simple to start
- Loose coupling

**Cons:**

- Hard to understand the full flow (scattered logic)
- Cyclic dependencies risk

### 2. Orchestration (Command-Based)

A central **Saga Orchestrator** tells participants what to do.

**Flow:**

1. `OrderSagaOrchestrator`:
   - Sends `CreateOrder` command to `OrderService`
   - Sends `ProcessPayment` command to `PaymentService`
   - Sends `ReserveStock` command to `InventoryService`
   - If failure, sends `RefundPayment` command

**Pros:**

- Central logic (easy to understand)
- Separation of concerns

**Cons:**

- Single point of failure (if orchestrator dies)
- Orchestrator can become too complex

---

## Implementing a Saga

### Example: Orchestration with State Machine

```typescript
class CreateOrderSaga {
  state: "PENDING" | "PAID" | "CONFIRMED" | "CANCELLED";

  async onOrderCreated(event: OrderCreated) {
    this.state = "PENDING";
    await commandBus.send(new ProcessPayment(event.orderId, event.amount));
  }

  async onPaymentProcessed(event: PaymentProcessed) {
    this.state = "PAID";
    await commandBus.send(new ReserveStock(event.orderId, event.items));
  }

  async onStockReserved(event: StockReserved) {
    this.state = "CONFIRMED";
    await commandBus.send(new ConfirmOrder(event.orderId));
  }

  // Failure Handling
  async onStockReservationFailed(event: StockReservationFailed) {
    // Compensate!
    await commandBus.send(new RefundPayment(event.orderId));
    this.state = "CANCELLED";
  }
}
```

---

## When to Use Sagas

✅ **Microservices:** Essential for consistency across services.
✅ **Long-Running Processes:** Processes that take minutes or days (e.g., approval workflows).
✅ **Distributed Data:** When data lives in different databases.

## When NOT to Use Sagas

❌ **Single Database:** Use ACID transactions! They are simpler and safer.
❌ **Tight Coupling:** If two aggregates are always updated together, maybe they should be one aggregate.

---

## Summary

**Sagas** manage consistency in distributed systems without distributed transactions (2PC).
**Choreography** uses events (decentralized).
**Orchestration** uses a coordinator (centralized).
**Compensating Transactions** are the "undo" button for distributed actions.

**Rule of Thumb:** Prefer ACID transactions within a Bounded Context. Use Sagas _between_ Bounded Contexts.

---

## Related Documents

- [Event Handlers & Event Bus](./event-handlers.md)
- [Bounded Contexts](./bounded-contexts.md)
- [Domain Events](./domain-events.md)

---

## References

- **Microservices Patterns** by Chris Richardson
- **Building Microservices** by Sam Newman
- **Sagas** by Hector Garcia-Molina and Kenneth Salem
