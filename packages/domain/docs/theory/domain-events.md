# Domain Events

## What is a Domain Event?

A **Domain Event** is a record of something significant that happened in the domain. It represents a fact about the past - something that already occurred and cannot be changed.

Domain events capture **business-significant state changes** and allow different parts of the system to react to them in a decoupled way.

### Key Characteristics:

1. **Past Tense** - Named in past tense (e.g., `SessionStarted`, not `StartSession`)
2. **Immutable** - Once created, cannot be modified
3. **Business-Relevant** - Represents something important to the domain
4. **Timestamp** - Records when the event occurred
5. **Self-Contained** - Contains all necessary data about what happened

---

## Why Use Domain Events?

### 1. **Decoupling**

Events allow different parts of the system to react without tight coupling.

**Without Events:**

```typescript
// Tight coupling - Session knows about analytics, notifications, etc.
class Session {
  stop() {
    // Business logic
    this.isStopped = true;

    // Side effects - BAD!
    analyticsService.trackSessionStop(this);
    notificationService.notifyUser(this);
    emailService.sendReport(this);
  }
}
```

**With Events:**

```typescript
// Decoupled - Session only emits event
class Session extends AggregateRoot {
  stop(timeProvider: TimeProvider) {
    // Business logic
    this.isStopped = true;

    // Emit event
    this.addEvent(new SessionStopped(this.id, timeProvider.now()));
  }
}

// Elsewhere, subscribers react
eventPublisher.subscribe("SessionStopped", async (event) => {
  await analyticsService.track(event);
  await notificationService.notify(event);
  await emailService.send(event);
});
```

### 2. **Audit Trail**

Events provide a complete history of what happened in the system.

### 3. **Integration**

External systems can subscribe to events without modifying domain code.

### 4. **Eventual Consistency**

Events enable asynchronous processing and cross-aggregate coordination.

### 5. **Business Insight**

Events capture business-meaningful actions for analytics and reporting.

---

## Domain Events vs Other Events

| Type                  | Purpose                    | Example                  | Layer          |
| --------------------- | -------------------------- | ------------------------ | -------------- |
| **Domain Event**      | Business state change      | `CategoryCreated`        | Domain         |
| **Integration Event** | Cross-system communication | `UserRegisteredEvent`    | Infrastructure |
| **UI Event**          | User interaction           | `ButtonClicked`          | Presentation   |
| **System Event**      | Technical occurrence       | `DatabaseConnectionLost` | Infrastructure |

**Focus:** Domain events are about **business**, not technical implementation.

---

## Anatomy of a Domain Event

### Essential Components:

```typescript
export class SessionStarted extends AbstractDomainEvent {
  readonly type = "SessionStarted"; // Event type identifier

  constructor(
    public readonly sessionId: ULID, // What entity
    public readonly categoryId: ULID, // Related data
    occurredAt: DateTime, // When (from base class)
  ) {
    super(occurredAt);
  }
}
```

### What to Include:

- **Event Type** - Unique identifier for the event
- **Entity ID** - ID of the aggregate that generated the event
- **Relevant Data** - Information needed by subscribers (but not too much!)
- **Timestamp** - When the event occurred (inherited from base class)

### What NOT to Include:

- ❌ Entire aggregate state (too much data)
- ❌ Calculated values that can be derived
- ❌ Infrastructure details (database IDs, connection strings)
- ❌ Mutable objects

---

## Domain Events in Our Project

### Event Hierarchy

```
AbstractDomainEvent (base class)
├─ CategoryCreated
├─ SessionStarted
├─ SessionPaused
├─ SessionResumed
├─ SessionStopped
├─ SegmentTooShort
└─ SessionExported
```

### Event Flow

```
1. User Action
   ↓
2. Command / Use Case
   ↓
3. Aggregate Method (business logic)
   ↓
4. Event Created & Added to Aggregate
   ↓
5. Use Case Pulls Events from Aggregate
   ↓
6. Event Publisher Publishes Events
   ↓
7. Subscribers React (async)
```

---

## Implementing Domain Events

### Step 1: Define the Event Class

```typescript
import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../shared/TimeProvider";
import { ULID } from "../valueObjects/ulid";

export class CategoryCreated extends AbstractDomainEvent {
  readonly type = "CategoryCreated";

  constructor(
    public readonly categoryId: ULID,
    public readonly categoryName: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
```

**Naming Convention:** Past tense, describes what happened

### Step 2: Emit from Aggregate

```typescript
export class Category extends AggregateRoot {
  constructor(params: { name: string }) {
    super();
    this.name = params.name;
    this.id = makeId();
    this.createdAt = Date.now();

    // Emit event
    this.addEvent(new CategoryCreated(this.id, this.name, this.createdAt));
  }
}
```

**When to Emit:**

- After state change (past tense!)
- Only for business-significant changes
- Not on every property change

### Step 3: Pull Events in Use Case

```typescript
export class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand) {
    // Create aggregate
    const category = new Category({ name: command.name });

    // Persist
    await this.categoryRepo.save(category);

    // Pull and publish events
    const events = category.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    return { categoryId: category.id };
  }
}
```

**Pattern:** Pull-based events (not push)

### Step 4: Subscribe to Events

```typescript
// In application setup
eventPublisher.subscribe("CategoryCreated", async (event) => {
  console.log(`Category created: ${event.categoryName}`);
  await updateReadModel(event);
});

eventPublisher.subscribe("SessionStopped", async (event) => {
  console.log(`Session stopped: ${event.sessionId}`);
  await calculateStatistics(event);
});
```

---

## Event Naming Patterns

### Good Names ✅

- `CategoryCreated` - Category was created
- `SessionStarted` - Session started
- `SessionPaused` - Session was paused
- `SessionStopped` - Session stopped
- `SegmentTooShort` - Segment was too short to save

### Bad Names ❌

- `CreateCategory` - Command, not event
- `StartingSession` - Present tense (events are past)
- `Session` - Not descriptive enough
- `UserClickedButton` - Technical, not business event

**Rule:** If it sounds like a command, it's not an event.

---

## Event Data Guidelines

### Minimal but Sufficient

**Too Little:**

```typescript
export class SessionStarted extends AbstractDomainEvent {
  constructor(occurredAt: DateTime) {
    // Missing session ID!
    super(occurredAt);
  }
}
```

**Too Much:**

```typescript
export class SessionStarted extends AbstractDomainEvent {
  constructor(
    public readonly session: Session, // Entire aggregate - too much!
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
```

**Just Right:**

```typescript
export class SessionStarted extends AbstractDomainEvent {
  constructor(
    public readonly sessionId: ULID,
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
```

### Guidelines:

- Include IDs (not entire objects)
- Include data needed by most subscribers
- Subscribers can query for more if needed
- Keep events lightweight

---

## Event Patterns

### Pattern 1: State Change Events

Emitted when aggregate state changes.

```typescript
// In Session aggregate
pause(timeProvider: TimeProvider): void {
  // Business logic
  const activeSegment = this.getActiveSegment();
  activeSegment.stop(timeProvider);

  // Emit event
  this.addEvent(new SessionPaused(this.id, timeProvider.now()));
}
```

### Pattern 2: Business Rule Violation Events

Emitted when a rule is violated (but not an error).

```typescript
// In Session aggregate
pause(timeProvider: TimeProvider): void {
  const activeSegment = this.getActiveSegment();
  const duration = activeSegment.getDuration();

  if (duration.isLessThan(Duration.fromMilliseconds(300))) {
    // Not saved, but emit event for awareness
    this.addEvent(new SegmentTooShort(
      this.id,
      duration.toMilliseconds(),
      timeProvider.now()
    ));
    return; // Don't save segment
  }

  // Normal pause logic...
}
```

### Pattern 3: Process Completion Events

Emitted when a multi-step process completes.

```typescript
export(exportService: ExportService): void {
  const markdown = exportService.format(this);

  this.addEvent(new SessionExported(
    this.id,
    this.categoryId,
    markdown.length,
    timeProvider.now()
  ));
}
```

---

## Events and Aggregate Boundaries

### Rule: Events Don't Cross Aggregates Directly

**❌ Wrong:**

```typescript
// Session trying to modify Category directly
class Session {
  start() {
    this.category.incrementSessionCount(); // BAD!
    this.addEvent(new SessionStarted(...));
  }
}
```

**✅ Right:**

```typescript
// Session emits event, Category reacts via subscriber
class Session {
  start() {
    this.addEvent(new SessionStarted(this.id, this.categoryId, ...));
  }
}

// In application layer
eventPublisher.subscribe('SessionStarted', async (event) => {
  const category = await categoryRepo.findById(event.categoryId);
  category.incrementSessionCount(); // If this method existed
  await categoryRepo.save(category);
});
```

**Why:** Aggregates should not hold references to other aggregates.

---

## Event Timing

### When to Emit Events

```typescript
class Session extends AggregateRoot {
  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    const session = new Session();
    session.categoryId = categoryId;
    session.startSegment(timeProvider);

    // Emit AFTER state change
    session.addEvent(
      new SessionStarted(session.id, categoryId, timeProvider.now()),
    );

    return session;
  }
}
```

**Order:**

1. Validate business rules
2. Change state
3. Emit event (describes what just happened)

**Never emit before state change** - events are facts about the past!

---

## Events in Testing

### Testing Event Emission

```typescript
describe("Category", () => {
  it("should emit CategoryCreated event", () => {
    const category = new Category({ name: "Work" });

    const events = category.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CategoryCreated);
    expect(events[0].type).toBe("CategoryCreated");
    expect(events[0].categoryId).toBe(category.id);
    expect(events[0].categoryName).toBe("Work");
  });

  it("should clear events after pulling", () => {
    const category = new Category({ name: "Work" });

    category.pullDomainEvents(); // First pull
    const events = category.pullDomainEvents(); // Second pull

    expect(events).toHaveLength(0); // No events left
  });
});
```

### Testing Event Subscribers

```typescript
describe("CategoryCreated subscriber", () => {
  it("should update read model", async () => {
    const event = new CategoryCreated("cat-123", "Work", Date.now());

    await categoryCreatedHandler(event);

    const readModel = await readModelRepo.findById("cat-123");
    expect(readModel.name).toBe("Work");
  });
});
```

---

## Event vs Command

| Aspect         | Command                     | Event                        |
| -------------- | --------------------------- | ---------------------------- |
| **Tense**      | Imperative (do this)        | Past tense (this happened)   |
| **Example**    | `CreateCategory`            | `CategoryCreated`            |
| **Can Fail**   | Yes (validation)            | No (already happened)        |
| **Mutability** | Mutable (before processing) | Immutable (after occurrence) |
| **Purpose**    | Request action              | Record fact                  |
| **Handlers**   | One (aggregate)             | Many (subscribers)           |

**Example:**

- **Command:** `StartSession` → Can be rejected if category doesn't exist
- **Event:** `SessionStarted` → Cannot be rejected, it already happened

---

## Common Use Cases for Events

### 1. **Analytics & Metrics**

```typescript
eventPublisher.subscribe("SessionStopped", async (event) => {
  await analytics.track("session_completed", {
    sessionId: event.sessionId,
    duration: event.totalDuration,
  });
});
```

### 2. **Notifications**

```typescript
eventPublisher.subscribe("SegmentTooShort", async (event) => {
  await notificationService.warn(
    `Segment was too short (${event.durationMs}ms) and wasn't saved`,
  );
});
```

### 3. **Read Model Updates (CQRS)**

```typescript
eventPublisher.subscribe("CategoryCreated", async (event) => {
  await readModelDb.insert({
    id: event.categoryId,
    name: event.categoryName,
    sessionCount: 0,
    totalDuration: 0,
  });
});
```

### 4. **Integration with External Systems**

```typescript
eventPublisher.subscribe("SessionExported", async (event) => {
  await cloudStorage.upload(event.sessionId, event.markdown);
});
```

### 5. **Audit Logging**

```typescript
eventPublisher.subscribe("*", async (event) => {
  await auditLog.append({
    type: event.type,
    timestamp: event.occurredAt,
    data: event,
  });
});
```

---

## Event Sourcing (Future Consideration)

**Event Sourcing** is a pattern where you store events instead of current state.

### Traditional Approach:

```
CategoryRepository:
  id: "cat-123"
  name: "Work"
  createdAt: 1234567890
```

### Event Sourcing Approach:

```
EventStore:
  1. CategoryCreated(id: "cat-123", name: "Work", at: 1234567890)
  2. CategoryRenamed(id: "cat-123", newName: "Deep Work", at: 1234567900)
```

**Current state** = replay all events

**Benefits:**

- Complete audit trail
- Time travel (replay to any point)
- Easy debugging

**Complexity:**

- Harder to implement
- More storage
- Snapshot optimization needed

**Our Project:** Not using event sourcing currently, but events are designed to support it in the future.

---

## Best Practices

### ✅ DO:

1. **Name in past tense** - `CategoryCreated`, not `CreateCategory`
2. **Keep events small** - Only essential data
3. **Make immutable** - Use `readonly` properties
4. **Include timestamp** - Always record when it happened
5. **Emit after state change** - Events describe the past
6. **One event per business occurrence** - Don't emit duplicates
7. **Test event emission** - Verify events are created correctly

### ❌ DON'T:

1. **Don't include entire aggregates** - Use IDs instead
2. **Don't emit before state change** - Events are facts, not intentions
3. **Don't make events mutable** - They represent history
4. **Don't put logic in events** - Events are data, not behavior
5. **Don't use for everything** - Only business-significant changes
6. **Don't couple to subscribers** - Aggregates shouldn't know who's listening

---

## Anti-Patterns

### ❌ Chatty Events

Emitting too many fine-grained events.

```typescript
// BAD - Too granular
this.addEvent(new SegmentIdSet(segmentId));
this.addEvent(new SegmentStartTimeSet(startTime));
this.addEvent(new SegmentAddedToSession(segmentId));

// GOOD - One meaningful event
this.addEvent(new SessionStarted(sessionId, categoryId, occurredAt));
```

### ❌ Fat Events

Including unnecessary data.

```typescript
// BAD - Too much data
new SessionStopped(
  this.id,
  this.categoryId,
  this.segments, // Entire array!
  this.createdAt,
  this.stoppedAt,
  this.category, // Entire related aggregate!
  occurredAt,
);

// GOOD - Just essentials
new SessionStopped(this.id, this.totalDuration, occurredAt);
```

### ❌ Logic in Events

Events should be data only.

```typescript
// BAD - Logic in event
export class SessionStopped extends AbstractDomainEvent {
  calculateBonus(): number {
    // NO!
    return this.duration * 1.5;
  }
}

// GOOD - Pure data
export class SessionStopped extends AbstractDomainEvent {
  readonly type = "SessionStopped";
  constructor(
    public readonly sessionId: ULID,
    public readonly totalDuration: number,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
```

---

## Summary

**Domain Events are:**

- Records of business-significant occurrences
- Immutable facts about the past
- Named in past tense
- Emitted by aggregates
- Processed by subscribers
- Used for decoupling, audit, and integration

**In our time tracking app:**

- Categories emit `CategoryCreated`
- Sessions emit `SessionStarted`, `SessionPaused`, `SessionResumed`, `SessionStopped`
- Business rules emit `SegmentTooShort`
- Export emits `SessionExported`

**Remember:** Events describe **what happened**, not **what should happen**.

---

## Related Documents

- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [EventStorming Session](../eventStorming/eventStorming-19-11-25.md)
- [Category Requirements](../entities/Category-requirements.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Patterns, Principles, and Practices of Domain-Driven Design** by Scott Millett
