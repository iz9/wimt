# Aggregate Root Pattern

## What is an Aggregate?

An **Aggregate** is a cluster of domain objects (entities and value objects) that are treated as a single unit for data changes. An aggregate ensures consistency and enforces business rules within its boundary.

Think of it as a **consistency boundary** - everything inside the aggregate must remain consistent, and changes happen atomically.

### Example

A `Session` aggregate contains:

- Session entity (the root)
- Multiple `SessionSegment` entities
- Various value objects (DateTime, Duration)

All these objects together form one aggregate, and they must be consistent with each other.

---

## What is an Aggregate Root?

The **Aggregate Root** is the **single entry point** into the aggregate. It's the only object that external code can hold a reference to and interact with.

### Key Characteristics:

1. **Unique Identity** - Has its own globally unique ID (e.g., ULID)
2. **Entry Point** - Only object in aggregate accessible from outside
3. **Consistency Guardian** - Enforces all business rules within the aggregate
4. **Lifecycle Owner** - Controls creation, modification, and deletion of all objects in the aggregate
5. **Event Emitter** - Generates domain events for significant state changes
6. **Repository Subject** - Only object that can be loaded/saved via repository

---

## Why Use Aggregate Roots?

### 1. **Consistency Enforcement**

Without aggregate roots, external code could modify internal entities directly, potentially violating business rules.

**Bad (without aggregate root):**

```typescript
// External code directly modifying a segment - BAD!
const segment = sessionSegmentRepo.findById("segment-123");
segment.stoppedAt = Date.now(); // Bypasses business rules!
sessionSegmentRepo.save(segment);
```

**Good (with aggregate root):**

```typescript
// External code uses aggregate root - GOOD!
const session = sessionRepo.findById("session-123");
session.pause(timeProvider); // Business rules enforced!
sessionRepo.save(session);
```

### 2. **Clear Boundaries**

Aggregates define clear transaction boundaries. If you modify an aggregate, the entire aggregate is saved atomically.

### 3. **Simplified Understanding**

You only need to understand the aggregate root's public interface, not the internal complexity.

### 4. **Easier Testing**

Test the aggregate root's behavior, and internal consistency is guaranteed.

---

## Rules for Aggregate Roots

### ✅ DO:

1. **Keep aggregates small** - Large aggregates cause performance issues
2. **Reference other aggregates by ID** - Don't hold direct object references
3. **Modify through the root** - All changes go through aggregate root methods
4. **Enforce invariants in the root** - Business rules live in the aggregate root
5. **Emit domain events** - Use events to communicate changes to other aggregates
6. **Make one aggregate per transaction** - Modify one aggregate at a time

### ❌ DON'T:

1. **Don't bypass the root** - Never modify internal entities directly
2. **Don't reference internals** - External code shouldn't access child entities
3. **Don't create giant aggregates** - Keep the aggregate focused
4. **Don't modify multiple aggregates in one transaction** - Use eventual consistency instead
5. **Don't hold references to other aggregates** - Use IDs for cross-aggregate relationships

---

## Aggregate Root in Our Project

### Our Aggregate Roots:

#### 1. **Category Aggregate**

- **Root:** `Category` entity
- **Internal Objects:** None (simple aggregate)
- **Responsibility:** Manage category identity and name
- **Business Rules:** Name validation

#### 2. **Session Aggregate**

- **Root:** `Session` entity
- **Internal Objects:** `SessionSegment[]` entities
- **Responsibility:** Manage time tracking session lifecycle
- **Business Rules:**
  - Only one active segment at a time
  - No overlapping segments
  - Minimum segment duration (300ms)
  - Cannot modify after stopped

---

## How to Implement an Aggregate Root

### Step 1: Extend Base Class

```typescript
export class Session extends AggregateRoot {
  // Your aggregate root implementation
}
```

### Step 2: Define Private State

```typescript
export class Session extends AggregateRoot {
  private readonly _segments: SessionSegment[] = [];
  private _isStopped: boolean = false;

  // Only expose what's necessary
  public get segments(): readonly SessionSegment[] {
    return this._segments;
  }
}
```

### Step 3: Enforce Business Rules

```typescript
export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): void {
    // Business rule: can't pause if already stopped
    if (this._isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    // Business rule: must have active segment to pause
    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    // Business logic
    activeSegment.stop(timeProvider);

    // Emit domain event
    this.addEvent(new SessionPaused(...));
  }
}
```

### Step 4: Control Child Entity Access

```typescript
export class Session extends AggregateRoot {
  // ❌ DON'T expose mutable internals
  // public segments: SessionSegment[] = [];

  // ✅ DO expose readonly views
  public get segments(): readonly SessionSegment[] {
    return this._segments;
  }

  // ✅ DO provide methods to modify internals
  public pause(timeProvider: TimeProvider): void {
    // Controlled modification
  }
}
```

---

## Aggregate Root vs Entity

| Aspect         | Aggregate Root               | Regular Entity                         |
| -------------- | ---------------------------- | -------------------------------------- |
| **Identity**   | Global unique ID             | Can have local ID within aggregate     |
| **Access**     | Can be accessed from outside | Only accessible through aggregate root |
| **Repository** | Has its own repository       | No repository (loaded with aggregate)  |
| **Lifecycle**  | Independent lifecycle        | Lifecycle tied to aggregate root       |
| **Events**     | Can emit domain events       | Events emitted through aggregate root  |
| **Example**    | `Session`, `Category`        | `SessionSegment`                       |

---

## Common Aggregate Design Patterns

### Pattern 1: Simple Aggregate (Single Entity)

**Example:** Category

```
Category (Aggregate Root)
  ├─ id: ULID
  ├─ name: string
  └─ createdAt: DateTime
```

No child entities - the aggregate root is the only entity.

### Pattern 2: Parent-Child Aggregate

**Example:** Session with Segments

```
Session (Aggregate Root)
  ├─ id: ULID
  ├─ categoryId: ULID
  ├─ isStopped: boolean
  └─ segments: SessionSegment[]
      ├─ SessionSegment
      │   ├─ id: ULID
      │   ├─ startedAt: DateTime
      │   └─ stoppedAt?: DateTime
      └─ SessionSegment
          └─ ...
```

Parent contains collection of child entities.

### Pattern 3: Reference by ID

**Example:** Session references Category

```
Session Aggregate         Category Aggregate
┌─────────────────┐      ┌──────────────┐
│ Session         │      │ Category     │
│ - categoryId ───┼─────▶│ - id         │
│ - segments[]    │      │ - name       │
└─────────────────┘      └──────────────┘
```

Session holds `categoryId` (string), not Category object.

---

## Cross-Aggregate Consistency

### Problem: What if you need to modify two aggregates together?

**Example:** When creating a session, verify the category exists.

### ❌ Wrong Approach: Modify both in one transaction

```typescript
// DON'T DO THIS
const category = categoryRepo.findById(categoryId);
const session = Session.create(category); // Holding category reference
categoryRepo.save(category);
sessionRepo.save(session);
```

### ✅ Right Approach: Use eventual consistency

```typescript
// Application Layer (Use Case)
const category = await categoryRepo.findById(categoryId);
if (!category) {
  throw new Error("Category not found");
}

// Session only needs the ID, not the object
const session = Session.create(categoryId, timeProvider);
await sessionRepo.save(session);

// Publish event for other systems to react
const events = session.pullDomainEvents();
await eventPublisher.publish(events);
```

**Key Points:**

- Validate category exists first
- Session references category by ID only
- Use domain events for cross-aggregate coordination
- Use eventual consistency when needed

---

## Aggregate Root in Clean Architecture

```
┌─────────────────────────────────────┐
│      Application Layer              │
│  (Use Cases orchestrate)            │
│  - Get aggregate from repository    │
│  - Call aggregate methods           │
│  - Save aggregate back              │
│  - Publish domain events            │
└───────────┬─────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Domain Layer                   │
│  (Aggregate Roots enforce rules)    │
│  - Category Aggregate               │
│  - Session Aggregate                │
│  - Business logic & invariants      │
└─────────────────────────────────────┘
            ▲
┌───────────┴─────────────────────────┐
│   Infrastructure Layer              │
│  (Repositories implement storage)   │
│  - ICategoryRepository              │
│  - ISessionRepository               │
└─────────────────────────────────────┘
```

**Flow:**

1. Use case gets aggregate from repository
2. Use case calls methods on aggregate root
3. Aggregate root enforces business rules
4. Aggregate root emits domain events
5. Use case saves aggregate via repository
6. Use case publishes domain events

---

## Benefits in Testing

### Easy to Test Business Logic

```typescript
describe("Session", () => {
  it("should not allow pause when already stopped", () => {
    const session = Session.create("category-123", timeProvider);
    session.stop(timeProvider);

    expect(() => session.pause(timeProvider)).toThrow(
      SessionAlreadyStoppedError,
    );
  });
});
```

**No mocking needed!** Test the aggregate directly without infrastructure.

---

## Anti-Patterns to Avoid

### ❌ Anemic Domain Model

```typescript
// BAD: No business logic in aggregate
class Session {
  public segments: SessionSegment[] = [];
  public isStopped: boolean = false;
}

// Business logic in service layer
class SessionService {
  pause(session: Session) {
    if (session.isStopped) throw new Error();
    // Logic here...
  }
}
```

### ✅ Rich Domain Model

```typescript
// GOOD: Business logic in aggregate
class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): void {
    if (this._isStopped) {
      throw new SessionAlreadyStoppedError();
    }
    // Business logic here
  }
}
```

### ❌ God Aggregate

```typescript
// BAD: Too many responsibilities
class User extends AggregateRoot {
  sessions: Session[] = []; // Don't do this!
  categories: Category[] = []; // Don't do this!
  settings: UserSettings;
  notifications: Notification[] = [];
  // Too big, too complex!
}
```

### ✅ Focused Aggregates

```typescript
// GOOD: Separate aggregates
class User extends AggregateRoot {
  // Just user identity and authentication
}

class Session extends AggregateRoot {
  // Just session tracking
  private userId: string; // Reference by ID
}
```

---

## Summary Checklist

When designing an aggregate root, ask:

- [ ] Is this entity the natural entry point for a group of objects?
- [ ] Does it have a unique global identity?
- [ ] Can it enforce all relevant business rules?
- [ ] Is the aggregate small enough (can be loaded efficiently)?
- [ ] Are all internal objects accessible only through the root?
- [ ] Does it emit domain events for state changes?
- [ ] Can it be persisted and loaded as a complete unit?

If you answer "yes" to all, you have a good aggregate root! ✅

---

## References

- **Domain-Driven Design** by Eric Evans (Blue Book)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Red Book)
- **Effective Aggregate Design** by Vaughn Vernon (series of articles)

---

**Related:**

- [AggregateRoot Base Class Implementation](../../src/aggregate/AggregateRoot.md)
- [Domain Events](../events/DomainEvent.md)
- [Category Entity Requirements](../entities/Category-requirements.md)
