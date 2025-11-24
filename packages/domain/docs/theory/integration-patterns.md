# Integration Patterns

## Connecting Systems

No application lives in isolation. Integration patterns define how your system communicates with the outside world (clients, other services, legacy systems).

### Key Principle

> "Decouple your internal domain from external interfaces."

---

## 1. API Gateway

**The Problem:** Clients (Mobile, Web) need to call 10 different microservices to render one screen.
**The Solution:** A single entry point that aggregates requests.

**Pattern:**

```
[Mobile App] ---> [API Gateway] ---> [Service A]
                                ---> [Service B]
                                ---> [Service C]
```

**Benefits:**

- **Aggregation:** One request from client = multiple internal requests.
- **Security:** Centralized auth/rate limiting.
- **Protocol Translation:** REST to gRPC/AMQP.

---

## 2. Backend for Frontend (BFF)

**The Problem:** Mobile needs small JSON, Web needs rich JSON. One "General Purpose API" fits no one.
**The Solution:** Create specific backends for each frontend.

**Pattern:**

```
[Mobile App] ---> [Mobile BFF] ---> [Domain Services]
[Web App]    ---> [Web BFF]    ---> [Domain Services]
```

**Implementation:**

- **Mobile BFF:** Returns minimal data to save battery/bandwidth.
- **Web BFF:** Returns rich data for desktop experience.

---

## 3. Webhooks (Push vs Pull)

**The Problem:** Polling "Is it done yet?" every 5 seconds wastes resources.
**The Solution:** Let the server call you when it's done.

**Pattern:**

1. Client registers a URL: `https://myapp.com/callback`
2. Server works...
3. Server POSTs to callback URL when finished.

**Best Practices:**

- **Verify Signatures:** Ensure the webhook is actually from the expected sender (HMAC).
- **Idempotency:** Handle receiving the same webhook twice.
- **Async Processing:** Don't do heavy work in the webhook handler; queue it.

---

## 4. Message Queues (Asynchronous Integration)

**The Problem:** Service A needs to tell Service B something, but B is down.
**The Solution:** Put a message in a queue.

**Pattern:**

```
[Service A] ---> [Queue] ---> [Service B]
```

**Benefits:**

- **Decoupling:** A doesn't know about B.
- **Buffering:** Handle traffic spikes.
- **Reliability:** Messages persist if B is down.

**Technologies:** RabbitMQ, Kafka, SQS, Redis Pub/Sub.

---

## 5. GraphQL Integration

**The Problem:** Over-fetching (getting too much data) and under-fetching (needing N+1 requests).
**The Solution:** Client specifies exactly what it needs.

**Pattern:**

```graphql
query {
  user(id: "1") {
    name
    posts {
      title
    }
  }
}
```

**DDD Integration:**

- **Resolvers** act as **Primary Adapters**.
- They call **Use Cases** or **Repositories**.
- **DTOs** map Domain Objects to GraphQL Types.

---

## 6. REST API Best Practices

**Resource-Oriented Design:**

- `GET /categories` (List)
- `POST /categories` (Create)
- `GET /categories/123` (Detail)
- `PATCH /categories/123` (Partial Update)
- `DELETE /categories/123` (Remove)

**HATEOAS (Hypermedia):**
Include links to related actions.

```json
{
  "id": "123",
  "status": "PENDING",
  "_links": {
    "self": "/orders/123",
    "cancel": "/orders/123/cancel",
    "pay": "/orders/123/pay"
  }
}
```

---

## Summary

**API Gateway:** Single entry point for all clients.
**BFF:** Tailored APIs for specific clients (Mobile vs Web).
**Webhooks:** Event-driven notification (Push).
**Queues:** Asynchronous, reliable communication.
**GraphQL:** Flexible data fetching.

**Choice:**

- **Public API?** REST or GraphQL.
- **Internal Microservices?** gRPC or Message Queues.
- **Mobile App?** BFF + GraphQL.

---

## Related Documents

- [Hexagonal Architecture](./hexagonal-architecture.md)
- [Event Handlers & Event Bus](./event-handlers.md)
- [DTOs and Mapping](./dtos-and-mapping.md)

---

## References

- **Enterprise Integration Patterns** by Gregor Hohpe
- **Building Microservices** by Sam Newman
- **Production-Ready Microservices** by Susan Fowler
