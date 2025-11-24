# Factories

## What is a Factory?

A **Factory** is a pattern for creating complex objects when a simple constructor isn't sufficient. Factories encapsulate the logic of object creation, handling complex initialization, validation, and ensuring objects are created in a valid state.

### Key Principle

> "Use a factory when creating an object involves more than just calling a constructor."

**Simple Example:**

```typescript
// Simple - Constructor is fine
const category = new Category({ name: "Work" });

// Complex - Use a factory
const session = Session.create(categoryId, timeProvider); // Factory method
```

---

## When to Use Factories

### ✅ Use Factory When:

**1. Construction is complex**

```typescript
// Too complex for constructor
const session = Session.create(categoryId, timeProvider);
// Creates session + first segment + emits event
```

**2. Multiple creation methods needed**

```typescript
// Different ways to create
Duration.fromMilliseconds(5000);
Duration.fromSeconds(5);
Duration.fromMinutes(1);
Duration.fromHours(0.5);
Duration.zero();
```

**3. Need to reconstitute from persistence**

```typescript
// Creating new vs loading from DB
Category.create({ name: 'Work' })           // New, emits events
Category.reconstitute({ id, name, ... })    // From DB, no events
```

**4. Validation before creation**

```typescript
// Validate before creating
Email.create("user@example.com"); // Validates format
// vs
new Email("invalid"); // Could create invalid email
```

**5. Creating related objects together**

```typescript
// Creates session + first segment atomically
Session.create(categoryId, timeProvider);
```

### ❌ Don't Use Factory When:

**1. Simple construction**

```typescript
// ❌ Overkill - just use constructor
CategoryFactory.create(name, color, icon);

// ✅ Constructor is fine
new Category({ name });
```

**2. No validation needed**

```typescript
// ❌ Unnecessary
class Point {
  static create(x: number, y: number): Point {
    return new Point(x, y);
  }
}

// ✅ Constructor is enough
new Point(10, 20);
```

---

## Factory Patterns

### Pattern 1: Static Factory Method

**Most common and simple pattern.**

```typescript
export class Duration {
  private constructor(private readonly milliseconds: number) {}

  // Factory methods with descriptive names
  static fromMilliseconds(ms: number): Duration {
    if (ms < 0) {
      throw new Error("Duration cannot be negative");
    }
    return new Duration(ms);
  }

  static fromSeconds(seconds: number): Duration {
    return Duration.fromMilliseconds(seconds * 1000);
  }

  static fromMinutes(minutes: number): Duration {
    return Duration.fromMilliseconds(minutes * 60 * 1000);
  }

  static fromHours(hours: number): Duration {
    return Duration.fromMilliseconds(hours * 60 * 60 * 1000);
  }

  // Convenience factories
  static zero(): Duration {
    return new Duration(0);
  }

  static between(start: DateTime, end: DateTime): Duration {
    const diff = end.toMilliseconds() - start.toMilliseconds();
    return Duration.fromMilliseconds(diff);
  }
}

// Usage
const d1 = Duration.fromSeconds(5);
const d2 = Duration.fromMinutes(30);
const d3 = Duration.zero();
```

**Benefits:**

- Clear intent (fromSeconds vs fromMinutes)
- Validation in one place
- Private constructor prevents invalid creation
- Self-documenting code

### Pattern 2: Factory for Aggregates

**Creates aggregate with all required child entities.**

```typescript
export class Session extends AggregateRoot {
  private constructor(
    public readonly id: ULID,
    private categoryId: ULID,
    private segments: SessionSegment[],
    private isStopped: boolean,
  ) {
    super();
  }

  // Factory method for new sessions
  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    const id = makeId();

    // Create first segment automatically
    const firstSegment = new SessionSegment({
      id: makeId(),
      startedAt: timeProvider.now(),
      stoppedAt: null,
    });

    const session = new Session(id, categoryId, [firstSegment], false);

    // Emit creation event
    session.addEvent(new SessionStarted(id, categoryId, timeProvider.now()));

    return session;
  }

  // Factory for reconstitution (from database)
  static reconstitute(params: {
    id: ULID;
    categoryId: ULID;
    segments: SessionSegment[];
    isStopped: boolean;
  }): Session {
    // No validation, no events - just rebuild from data
    return new Session(
      params.id,
      params.categoryId,
      params.segments,
      params.isStopped,
    );
  }
}

// Usage
const session = Session.create(categoryId, timeProvider);
// session has ID, first segment, and emitted event!
```

**Benefits:**

- Ensures aggregate is always in valid state
- Encapsulates complex initialization
- Clear separation: create vs reconstitute

### Pattern 3: Reconstitution Factory

**For loading from persistence without triggering business logic.**

```typescript
export class Category extends AggregateRoot {
  // Constructor for new categories
  constructor(params: { name: string }) {
    super();
    this.ensureValidName(params.name);
    this.id = makeId();
    this.name = params.name;
    this.createdAt = Date.now();
    this.color = null;
    this.icon = null;

    // Emit event for NEW category
    this.addEvent(new CategoryCreated(this.id, this.name, this.createdAt));
  }

  // Factory for reconstitution (from DB)
  static reconstitute(params: {
    id: ULID;
    name: string;
    createdAt: DateTime;
    color: string | null;
    icon: string | null;
  }): Category {
    // Use Object.create to bypass constructor
    const category = Object.create(Category.prototype);

    // Set properties directly (no validation, no events)
    category.id = params.id;
    category.name = params.name;
    category.createdAt = params.createdAt;
    category.color = params.color;
    category.icon = params.icon;
    category._domainEvents = []; // Initialize empty events array

    return category;
  }
}

// Usage in repository
export class SqliteCategoryRepository implements ICategoryRepository {
  async findById(id: ULID): Promise<Category | null> {
    const row = await this.db.get("SELECT * FROM categories WHERE id = ?", [
      id,
    ]);
    if (!row) return null;

    // Use reconstitute, not constructor!
    return Category.reconstitute({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      color: row.color,
      icon: row.icon,
    });
  }
}
```

**Why separate creation and reconstitution?**

- **New object:** Validate, emit events, generate ID
- **Loaded object:** No validation (already valid), no events (already happened), use existing ID

### Pattern 4: Separate Factory Class

**When factory logic is very complex.**

```typescript
// Separate factory class
export class SessionFactory {
  constructor(
    private timeProvider: TimeProvider,
    private idGenerator: IdGenerator,
  ) {}

  createSession(categoryId: ULID): Session {
    const id = this.idGenerator.generate();
    const startTime = this.timeProvider.now();

    const firstSegment = this.createFirstSegment(startTime);

    const session = Session.reconstitute({
      id,
      categoryId,
      segments: [firstSegment],
      isStopped: false,
    });

    session.addEvent(new SessionStarted(id, categoryId, startTime));

    return session;
  }

  private createFirstSegment(startTime: DateTime): SessionSegment {
    return new SessionSegment({
      id: this.idGenerator.generate(),
      startedAt: startTime,
      stoppedAt: null,
    });
  }

  reconstitute(data: SessionData): Session {
    // Complex reconstitution logic
    const segments = data.segments.map((s) => this.reconstitutSegment(s));
    // ...
  }
}

// Usage with DI
@injectable()
export class StartSessionUseCase {
  constructor(
    @inject(TYPES.SessionFactory)
    private sessionFactory: SessionFactory,
  ) {}

  async execute(command: StartSessionCommand): Promise<void> {
    const session = this.sessionFactory.createSession(command.categoryId);
    await this.sessionRepo.save(session);
  }
}
```

**When to use separate factory class:**

- Factory has dependencies (TimeProvider, IdGenerator)
- Very complex creation logic
- Need to test factory in isolation
- Multiple related factory methods

### Pattern 5: Builder Pattern (Alternative)

**For objects with many optional parameters.**

```typescript
export class CategoryBuilder {
  private id?: ULID;
  private name?: string;
  private color: string | null = null;
  private icon: string | null = null;
  private createdAt?: DateTime;

  withId(id: ULID): this {
    this.id = id;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withColor(color: string): this {
    this.color = color;
    return this;
  }

  withIcon(icon: string): this {
    this.icon = icon;
    return this;
  }

  withCreatedAt(createdAt: DateTime): this {
    this.createdAt = createdAt;
    return this;
  }

  build(): Category {
    if (!this.name) {
      throw new Error("Name is required");
    }

    return Category.reconstitute({
      id: this.id ?? makeId(),
      name: this.name,
      color: this.color,
      icon: this.icon,
      createdAt: this.createdAt ?? Date.now(),
    });
  }
}

// Usage
const category = new CategoryBuilder()
  .withName("Work")
  .withColor("#FF0000")
  .withIcon("work-icon")
  .build();
```

**When to use builder:**

- Many optional parameters
- Complex object assembly
- Primarily in tests (test data builders)

---

## Factories in Our Project

### Example 1: Duration Factory Methods

```typescript
export class Duration {
  private constructor(private readonly milliseconds: number) {}

  // Factory methods for different units
  static fromMilliseconds(ms: number): Duration {
    if (ms < 0) {
      throw new Error("Duration cannot be negative");
    }
    if (!Number.isFinite(ms)) {
      throw new Error("Duration must be finite");
    }
    return new Duration(ms);
  }

  static fromSeconds(seconds: number): Duration {
    return Duration.fromMilliseconds(seconds * 1000);
  }

  static fromMinutes(minutes: number): Duration {
    return Duration.fromMilliseconds(minutes * 60 * 1000);
  }

  static fromHours(hours: number): Duration {
    return Duration.fromMilliseconds(hours * 60 * 60 * 1000);
  }

  // Convenience factories
  static zero(): Duration {
    return new Duration(0);
  }

  static between(start: DateTime, end: DateTime): Duration {
    const diff = end - start;
    return Duration.fromMilliseconds(diff);
  }
}

// Usage examples
const d1 = Duration.fromSeconds(30);
const d2 = Duration.fromMinutes(5);
const d3 = Duration.fromHours(2);
const d4 = Duration.zero();
const d5 = Duration.between(startTime, endTime);
```

### Example 2: Session Factory

```typescript
export class Session extends AggregateRoot {
  private constructor(
    public readonly id: ULID,
    private categoryId: ULID,
    private segments: SessionSegment[],
    private isStopped: boolean,
    private startTime: DateTime,
  ) {
    super();
  }

  // Factory for new sessions
  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    const id = makeId();
    const startTime = timeProvider.now();

    // Create first active segment
    const firstSegment = new SessionSegment({
      id: makeId(),
      startedAt: startTime,
      stoppedAt: null,
    });

    const session = new Session(
      id,
      categoryId,
      [firstSegment],
      false,
      startTime,
    );

    // Emit domain event
    session.addEvent(
      new SessionStarted({
        sessionId: id,
        categoryId,
        startTime,
        occurredAt: startTime,
      }),
    );

    return session;
  }

  // Factory for reconstitution
  static reconstitute(params: {
    id: ULID;
    categoryId: ULID;
    segments: SessionSegmentData[];
    isStopped: boolean;
    startTime: DateTime;
  }): Session {
    // Reconstitute segments
    const segments = params.segments.map(
      (s) =>
        new SessionSegment({
          id: s.id,
          startedAt: s.startedAt,
          stoppedAt: s.stoppedAt,
        }),
    );

    // No validation, no events
    return new Session(
      params.id,
      params.categoryId,
      segments,
      params.isStopped,
      params.startTime,
    );
  }
}

// Usage
const newSession = Session.create(categoryId, timeProvider);
// vs
const loadedSession = Session.reconstitute(dbData);
```

### Example 3: Email Value Object Factory

```typescript
export class Email {
  private constructor(private readonly value: string) {}

  // Factory with validation
  static create(email: string): Email {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      throw new Error("Email cannot be empty");
    }

    if (!this.isValidFormat(trimmed)) {
      throw new Error("Invalid email format");
    }

    return new Email(trimmed);
  }

  private static isValidFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  toString(): string {
    return this.value;
  }
}

// Usage
const email = Email.create("user@example.com"); // ✅ Valid
Email.create("invalid"); // ❌ Throws error
```

---

## Private Constructor Pattern

**Why private constructor + factory method?**

```typescript
export class Duration {
  // Private - cannot call directly
  private constructor(private readonly milliseconds: number) {}

  // Public factory - enforces validation
  static fromMilliseconds(ms: number): Duration {
    if (ms < 0) throw new Error("Negative duration");
    return new Duration(ms);
  }
}

// ✅ Must use factory
const duration = Duration.fromMilliseconds(5000);

// ❌ Cannot bypass validation
const invalid = new Duration(-100); // Compilation error - constructor is private!
```

**Benefits:**

1. **Forces validation** - No way to create invalid object
2. **Clear intent** - Factory name explains how object is created
3. **Flexibility** - Can change implementation without affecting callers

---

## Factory vs Constructor

### Use Constructor When:

```typescript
// ✅ Simple value object
class Point {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

const point = new Point(10, 20);
```

- Simple initialization
- No validation needed
- Single way to create
- No related objects

### Use Factory When:

```typescript
// ✅ Complex creation with validation
class Session {
  private constructor(...) {}

  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    // Complex initialization
    // Creates session + segment
    // Emits events
  }
}

const session = Session.create(categoryId, timeProvider);
```

- Complex initialization
- Validation needed
- Multiple creation methods
- Creates related objects
- Different creation contexts (new vs load)

---

## Testing with Factories

### Test Data Builders

```typescript
// Test helper factory
export class CategoryTestBuilder {
  private id?: ULID;
  private name: string = "Test Category";
  private color: string | null = null;
  private icon: string | null = null;

  withId(id: ULID): this {
    this.id = id;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withColor(color: string): this {
    this.color = color;
    return this;
  }

  build(): Category {
    return Category.reconstitute({
      id: this.id ?? makeId(),
      name: this.name,
      color: this.color,
      icon: this.icon,
      createdAt: Date.now(),
    });
  }
}

// In tests
describe("Session", () => {
  it("should start session for category", () => {
    const category = new CategoryTestBuilder().withName("Work").build();

    const session = Session.create(category.id, mockTimeProvider);

    expect(session.getCategoryId()).toBe(category.id);
  });
});
```

### Factory in Test Setup

```typescript
describe("SessionService", () => {
  let timeProvider: MockTimeProvider;
  let categoryId: ULID;

  beforeEach(() => {
    timeProvider = new MockTimeProvider();

    // Use factory to set up test data
    const category = new CategoryTestBuilder().withName("Work").build();
    categoryId = category.id;
  });

  it("should create session", () => {
    const session = Session.create(categoryId, timeProvider);

    expect(session).toBeDefined();
  });
});
```

---

## Common Patterns

### Pattern: Multiple Named Constructors

```typescript
export class DateTime {
  private constructor(private readonly timestamp: number) {}

  static now(): DateTime {
    return new DateTime(Date.now());
  }

  static fromTimestamp(ms: number): DateTime {
    return new DateTime(ms);
  }

  static fromDate(date: Date): DateTime {
    return new DateTime(date.getTime());
  }

  static fromISOString(iso: string): DateTime {
    return new DateTime(new Date(iso).getTime());
  }
}

// Usage
const now = DateTime.now();
const from Timestamp = DateTime.fromTimestamp(1234567890);
const fromDate = DateTime.fromDate(new Date());
const fromISO = DateTime.fromISOString('2024-01-01T00:00:00Z');
```

### Pattern: Null Object Factory

```typescript
export class Duration {
  static zero(): Duration {
    return new Duration(0);
  }

  isZero(): boolean {
    return this.milliseconds === 0;
  }
}

// Usage - avoid null checks
const duration = session.getDuration() ?? Duration.zero();

if (duration.isZero()) {
  console.log("No time tracked");
}
```

### Pattern: Copy Factory

```typescript
export class Category {
  copy(): Category {
    return Category.reconstitute({
      id: makeId(), // New ID!
      name: `${this.name} (Copy)`,
      color: this.color,
      icon: this.icon,
      createdAt: Date.now(),
    });
  }
}

// Usage
const original = new Category({ name: "Work" });
const duplicate = original.copy();
```

---

## Advanced: Aggregate Factory

**Creating aggregate with complex child entities.**

```typescript
export class SessionFactory {
  constructor(private timeProvider: TimeProvider) {}

  create(categoryId: ULID): Session {
    const sessionId = makeId();
    const startTime = this.timeProvider.now();

    // Create first segment
    const firstSegment = this.createSegment(startTime);

    // Create session with segment
    const session = Session.reconstitute({
      id: sessionId,
      categoryId,
      segments: [firstSegment],
      isStopped: false,
      startTime,
    });

    // Add creation event
    session.addEvent(
      new SessionStarted({
        sessionId,
        categoryId,
        startTime,
        occurredAt: startTime,
      }),
    );

    return session;
  }

  private createSegment(startTime: DateTime): SessionSegmentData {
    return {
      id: makeId(),
      startedAt: startTime,
      stoppedAt: null,
    };
  }

  reconstitute(data: {
    id: ULID;
    categoryId: ULID;
    segments: SessionSegmentData[];
    isStopped: boolean;
    startTime: DateTime;
  }): Session {
    return Session.reconstitute(data);
  }
}
```

---

## Best Practices

### ✅ DO:

**1. Use descriptive factory names**

```typescript
// ✅ Good
Duration.fromSeconds(5);
Duration.fromMinutes(30);
Duration.zero();

// ❌ Bad
Duration.create(5);
Duration.make(30);
```

**2. Validate in factories**

```typescript
// ✅ Good
static fromMilliseconds(ms: number): Duration {
  if (ms < 0) throw new Error('Negative duration');
  return new Duration(ms);
}

// ❌ Bad
static fromMilliseconds(ms: number): Duration {
  return new Duration(ms); // No validation!
}
```

**3. Make constructor private when using factories**

```typescript
// ✅ Good
export class Duration {
  private constructor(ms: number) {}
  static fromMilliseconds(ms: number): Duration {}
}

// ❌ Bad
export class Duration {
  constructor(ms: number) {} // Public - can bypass factory!
  static fromMilliseconds(ms: number): Duration {}
}
```

**4. Separate create from reconstitute**

```typescript
// ✅ Good
static create(params): Session { /* validation, events */ }
static reconstitute(data): Session { /* no validation, no events */ }

// ❌ Bad
static create(params, isNew: boolean): Session {
  if (isNew) { /* validation, events */ }
  else { /* no validation */ }
}
```

### ❌ DON'T:

**1. Don't use factories for simple objects**

```typescript
// ❌ Overkill
class Point {
  private constructor(x: number, y: number) {}
  static create(x: number, y: number): Point {
    return new Point(x, y);
  }
}

// ✅ Constructor is fine
class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}
```

**2. Don't return different types from factory**

```typescript
// ❌ Bad - Type confusion
static create(data: unknown): Session | null {
  if (!data) return null; // Don't do this!
  return new Session(data);
}

// ✅ Good - Throw or return consistently
static create(data: SessionData): Session {
  if (!data) throw new Error('Data required');
  return new Session(data);
}
```

---

## Summary

**Factories are for:**

- Complex object creation
- Validation before creation
- Multiple creation methods
- Reconstitution from persistence
- Creating related objects together

**Factory patterns:**

- **Static factory method** - Most common
- **Aggregate factory** - Creates aggregate + children
- **Reconstitution factory** - Loads from DB
- **Separate factory class** - Complex logic
- **Builder pattern** - Many optional params

**In Our Project:**

- `Duration.fromSeconds()`, `fromMinutes()`, etc.
- `Session.create()` - Creates session + first segment
- `Session.reconstitute()` - Loads from DB
- `Email.create()` - Validates format

**Key Principle:**

- **Constructor:** Simple creation
- **Factory:** Complex creation, validation, multiple ways

**Private constructor + factory = Cannot create invalid objects!**

---

## Related Documents

- [Value Objects](./value-objects.md)
- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Aggregate Root Pattern](./aggregate-root-pattern.md)

---

## References

- **Design Patterns** by Gang of Four (Factory Method, Abstract Factory)
- **Effective Java** by Joshua Bloch (Item 1: Consider static factory methods)
- **Domain-Driven Design** by Eric Evans
