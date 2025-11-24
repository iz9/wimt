# Testing Domain Models

## Why Test the Domain Layer?

The **domain layer is the heart of your application** - it contains your business logic, rules, and invariants. Testing the domain thoroughly gives you:

1. **Confidence in business rules** - Know your logic works correctly
2. **Fast feedback** - Domain tests are fast (no database, no UI)
3. **Living documentation** - Tests show how domain objects should behave
4. **Refactoring safety** - Change implementation with confidence
5. **Design feedback** - Hard to test? Maybe design needs improvement

### The Testing Pyramid

```
        ┌─────────────┐
        │  E2E Tests  │  Few, slow, expensive
        └─────────────┘
       ┌───────────────┐
       │ Integration   │  Some, moderate speed
       └───────────────┘
      ┌─────────────────┐
      │  Domain Tests   │  Many, fast, cheap ← FOCUS HERE!
      └─────────────────┘
```

**Domain tests should be the majority** - they're fast, reliable, and test business logic.

---

## Testing Entities

### Basic Entity Testing

**What to Test:**

- ✅ Entity creation
- ✅ Invariant validation
- ✅ State changes
- ✅ Business rules
- ✅ Domain events emission

**Example: Category Entity**

```typescript
describe("Category", () => {
  describe("creation", () => {
    it("should create a category with valid name", () => {
      const category = new Category({ name: "Work" });

      expect(category.name).toBe("Work");
      expect(category.id).toBeDefined();
      expect(category.createdAt).toBeDefined();
      expect(category instanceof Category).toBe(true);
    });

    it("should generate unique ID for each category", () => {
      const cat1 = new Category({ name: "Work" });
      const cat2 = new Category({ name: "Hobby" });

      expect(cat1.id).not.toBe(cat2.id);
    });

    it("should set default values", () => {
      const category = new Category({ name: "Work" });

      expect(category.color).toBeNull();
      expect(category.icon).toBeNull();
    });
  });
});
```

### Testing Invariants

**Invariants are critical** - test that they're enforced!

```typescript
describe("Category invariants", () => {
  it("should throw when name is empty", () => {
    expect(() => new Category({ name: "" })).toThrow(EntityInvariantError);
  });

  it("should throw when name is null", () => {
    expect(() => new Category({ name: null as any })).toThrow(
      EntityInvariantError,
    );
  });

  it("should throw when name is undefined", () => {
    expect(() => new Category({ name: undefined as any })).toThrow(
      EntityInvariantError,
    );
  });

  it("should throw when name is only whitespace", () => {
    expect(() => new Category({ name: "   " })).toThrow(EntityInvariantError);
  });

  it("should accept name with valid characters", () => {
    expect(() => new Category({ name: "Work & Study" })).not.toThrow();
  });
});
```

### Testing State Changes

**Test mutations maintain invariants:**

```typescript
describe("Category.changeName", () => {
  it("should change name when valid", () => {
    const category = new Category({ name: "Work" });

    category.changeName({ name: "Professional" });

    expect(category.name).toBe("Professional");
  });

  it("should maintain same ID after name change", () => {
    const category = new Category({ name: "Work" });
    const originalId = category.id;

    category.changeName({ name: "Professional" });

    expect(category.id).toBe(originalId);
  });

  it("should throw when changing to empty name", () => {
    const category = new Category({ name: "Work" });

    expect(() => category.changeName({ name: "" })).toThrow(
      EntityInvariantError,
    );
  });

  it("should throw when changing to null", () => {
    const category = new Category({ name: "Work" });

    expect(() => category.changeName({ name: null as any })).toThrow(
      EntityInvariantError,
    );
  });
});
```

### Testing Multiple Properties

```typescript
describe("Category.setColor", () => {
  it("should set color when valid", () => {
    const category = new Category({ name: "Work" });

    category.setColor({ color: "#FF0000" });

    expect(category.color).toBe("#FF0000");
  });

  it("should allow null color", () => {
    const category = new Category({ name: "Work" });
    category.setColor({ color: "#FF0000" });

    category.setColor({ color: null });

    expect(category.color).toBeNull();
  });

  it("should throw when color is invalid type", () => {
    const category = new Category({ name: "Work" });

    expect(() => category.setColor({ color: 123 as any })).toThrow(
      EntityInvariantError,
    );
  });
});

describe("Category.setIcon", () => {
  it("should set icon when valid", () => {
    const category = new Category({ name: "Work" });

    category.setIcon({ icon: "work-icon" });

    expect(category.icon).toBe("work-icon");
  });

  it("should allow null icon", () => {
    const category = new Category({ name: "Work" });

    category.setIcon({ icon: null });

    expect(category.icon).toBeNull();
  });
});
```

---

## Testing Aggregates

Aggregates are more complex - test aggregate boundaries and business rules.

### Testing Session Aggregate

```typescript
describe("Session", () => {
  let timeProvider: MockTimeProvider;

  beforeEach(() => {
    timeProvider = new MockTimeProvider();
  });

  describe("creation", () => {
    it("should create session with first segment", () => {
      const session = Session.create("category-123", timeProvider);

      expect(session.id).toBeDefined();
      expect(session.getCategoryId()).toBe("category-123");
      expect(session.getSegments()).toHaveLength(1);
      expect(session.isStopped()).toBe(false);
    });

    it("should create active segment on creation", () => {
      const session = Session.create("category-123", timeProvider);

      const activeSegment = session.getActiveSegment();

      expect(activeSegment).toBeDefined();
      expect(activeSegment!.getStoppedAt()).toBeNull();
    });
  });
});
```

### Testing Business Rules

```typescript
describe("Session.pause", () => {
  let session: Session;
  let timeProvider: MockTimeProvider;

  beforeEach(() => {
    timeProvider = new MockTimeProvider();
    session = Session.create("category-123", timeProvider);
  });

  it("should stop active segment when paused", () => {
    timeProvider.advance(5000);

    session.pause(timeProvider);

    const segments = session.getSegments();
    expect(segments[0].getStoppedAt()).toBeDefined();
  });

  it("should throw when pausing stopped session", () => {
    session.stop(timeProvider);

    expect(() => session.pause(timeProvider)).toThrow(
      SessionAlreadyStoppedError,
    );
  });

  it("should throw when pausing without active segment", () => {
    session.pause(timeProvider); // First pause

    expect(() => session.pause(timeProvider)) // Try to pause again
      .toThrow(NoActiveSegmentError);
  });
});

describe("Session.resume", () => {
  let session: Session;
  let timeProvider: MockTimeProvider;

  beforeEach(() => {
    timeProvider = new MockTimeProvider();
    session = Session.create("category-123", timeProvider);
  });

  it("should create new segment when resumed", () => {
    session.pause(timeProvider);
    timeProvider.advance(1000);

    session.resume(timeProvider);

    expect(session.getSegments()).toHaveLength(2);
  });

  it("should throw when resuming active session", () => {
    expect(() => session.resume(timeProvider)).toThrow(
      "Cannot resume active session",
    );
  });

  it("should throw when resuming stopped session", () => {
    session.stop(timeProvider);

    expect(() => session.resume(timeProvider)).toThrow(
      SessionAlreadyStoppedError,
    );
  });
});
```

### Testing Aggregate Invariants

```typescript
describe("Session invariants", () => {
  it("should not allow overlapping segments", () => {
    const timeProvider = new MockTimeProvider();
    const session = Session.create("category-123", timeProvider);

    timeProvider.advance(5000);
    session.pause(timeProvider);

    // Manually create overlapping segment (if API allowed it)
    expect(() => {
      session.addSegment(
        new SessionSegment({
          startedAt: timeProvider.now() - 3000, // Overlaps!
          stoppedAt: timeProvider.now(),
        }),
      );
    }).toThrow(OverlappingSegmentError);
  });

  it("should discard segments shorter than minimum duration", () => {
    const timeProvider = new MockTimeProvider();
    const session = Session.create("category-123", timeProvider);

    timeProvider.advance(100); // Only 100ms - too short!

    session.pause(timeProvider);

    // Segment should be discarded
    expect(session.getSegments()).toHaveLength(0);
  });
});
```

---

## Testing Value Objects

Value objects should be **immutable** and **self-validating**.

### Testing Duration Value Object

```typescript
describe("Duration", () => {
  describe("creation", () => {
    it("should create from milliseconds", () => {
      const duration = Duration.fromMilliseconds(5000);

      expect(duration.toMilliseconds()).toBe(5000);
    });

    it("should create from seconds", () => {
      const duration = Duration.fromSeconds(5);

      expect(duration.toMilliseconds()).toBe(5000);
    });

    it("should create from minutes", () => {
      const duration = Duration.fromMinutes(1);

      expect(duration.toMilliseconds()).toBe(60000);
    });
  });

  describe("validation", () => {
    it("should throw when negative", () => {
      expect(() => Duration.fromMilliseconds(-100)).toThrow(
        "Duration cannot be negative",
      );
    });

    it("should throw when infinite", () => {
      expect(() => Duration.fromMilliseconds(Infinity)).toThrow(
        "Duration must be finite",
      );
    });

    it("should throw when NaN", () => {
      expect(() => Duration.fromMilliseconds(NaN)).toThrow(
        "Duration must be finite",
      );
    });
  });
});
```

### Testing Immutability

```typescript
describe("Duration immutability", () => {
  it("should not modify original on add", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    const sum = d1.add(d2);

    // Originals unchanged
    expect(d1.toSeconds()).toBe(5);
    expect(d2.toSeconds()).toBe(10);

    // New object created
    expect(sum.toSeconds()).toBe(15);
    expect(sum).not.toBe(d1);
    expect(sum).not.toBe(d2);
  });

  it("should not modify original on subtract", () => {
    const d1 = Duration.fromSeconds(10);
    const d2 = Duration.fromSeconds(3);

    const diff = d1.subtract(d2);

    expect(d1.toSeconds()).toBe(10);
    expect(diff.toSeconds()).toBe(7);
  });
});
```

### Testing Equality

```typescript
describe("Duration equality", () => {
  it("should be equal if same value", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromMilliseconds(5000);

    expect(d1.equals(d2)).toBe(true);
  });

  it("should not be equal if different value", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    expect(d1.equals(d2)).toBe(false);
  });

  it("should not use reference equality", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(5);

    expect(d1 === d2).toBe(false); // Different objects
    expect(d1.equals(d2)).toBe(true); // Same value!
  });
});
```

### Testing Operations

```typescript
describe("Duration operations", () => {
  it("should add durations", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    const sum = d1.add(d2);

    expect(sum.toSeconds()).toBe(15);
  });

  it("should compare durations", () => {
    const short = Duration.fromSeconds(5);
    const long = Duration.fromSeconds(10);

    expect(short.isLessThan(long)).toBe(true);
    expect(long.isGreaterThan(short)).toBe(true);
    expect(short.isGreaterThan(long)).toBe(false);
  });

  it("should convert between units", () => {
    const duration = Duration.fromMinutes(1);

    expect(duration.toSeconds()).toBe(60);
    expect(duration.toMilliseconds()).toBe(60000);
    expect(duration.toMinutes()).toBe(1);
  });
});
```

---

## Testing Domain Services

Domain services should be **stateless** and **pure**.

### Testing SessionExportService

```typescript
describe("SessionExportService", () => {
  let exportService: SessionExportService;
  let timeProvider: MockTimeProvider;

  beforeEach(() => {
    exportService = new SessionExportService();
    timeProvider = new MockTimeProvider();
  });

  it("should export session to markdown", () => {
    const category = new Category({ name: "Work" });
    const session = Session.create(category.id, timeProvider);

    timeProvider.advance(30 * 60 * 1000); // 30 minutes
    session.stop(timeProvider);

    const markdown = exportService.exportToMarkdown(session, category);

    expect(markdown).toContain("# Session Report");
    expect(markdown).toContain("**Category:** Work");
    expect(markdown).toContain("30m");
  });

  it("should include all segments in export", () => {
    const category = new Category({ name: "Work" });
    const session = Session.create(category.id, timeProvider);

    timeProvider.advance(5000);
    session.pause(timeProvider);

    timeProvider.advance(1000);
    session.resume(timeProvider);

    timeProvider.advance(5000);
    session.stop(timeProvider);

    const markdown = exportService.exportToMarkdown(session, category);

    expect(markdown).toContain("## Segments");
    expect(markdown.match(/- /g)).toHaveLength(2); // 2 segments
  });
});
```

### Testing CategoryStatisticsCalculator

```typescript
describe("CategoryStatisticsCalculator", () => {
  let calculator: CategoryStatisticsCalculator;

  beforeEach(() => {
    calculator = new CategoryStatisticsCalculator();
  });

  it("should calculate total duration across sessions", () => {
    const categoryId = makeId();
    const sessions = [
      createSessionWithDuration(categoryId, Duration.fromSeconds(5)),
      createSessionWithDuration(categoryId, Duration.fromSeconds(10)),
    ];

    const stats = calculator.calculate(categoryId, sessions);

    expect(stats.totalDuration.toSeconds()).toBe(15);
  });

  it("should calculate average duration", () => {
    const categoryId = makeId();
    const sessions = [
      createSessionWithDuration(categoryId, Duration.fromSeconds(10)),
      createSessionWithDuration(categoryId, Duration.fromSeconds(20)),
    ];

    const stats = calculator.calculate(categoryId, sessions);

    expect(stats.averageDuration.toSeconds()).toBe(15);
  });

  it("should return zero for category with no sessions", () => {
    const categoryId = makeId();

    const stats = calculator.calculate(categoryId, []);

    expect(stats.totalDuration.toMilliseconds()).toBe(0);
    expect(stats.sessionCount).toBe(0);
    expect(stats.averageDuration.toMilliseconds()).toBe(0);
  });

  it("should filter sessions by category", () => {
    const categoryId = makeId();
    const otherCategoryId = makeId();
    const sessions = [
      createSessionWithDuration(categoryId, Duration.fromSeconds(10)),
      createSessionWithDuration(otherCategoryId, Duration.fromSeconds(20)),
      createSessionWithDuration(categoryId, Duration.fromSeconds(10)),
    ];

    const stats = calculator.calculate(categoryId, sessions);

    expect(stats.sessionCount).toBe(2); // Only 2 for this category
  });
});
```

---

## Testing Domain Events

Test that events are emitted at the right time with correct data.

### Testing Event Emission

```typescript
describe("Category domain events", () => {
  it("should emit CategoryCreated event on creation", () => {
    const category = new Category({ name: "Work" });

    const events = category.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CategoryCreated);
    expect(events[0].type).toBe("CategoryCreated");
  });

  it("should include category data in event", () => {
    const category = new Category({ name: "Work" });

    const events = category.pullDomainEvents();
    const event = events[0] as CategoryCreated;

    expect(event.categoryId).toBe(category.id);
    expect(event.categoryName).toBe("Work");
    expect(event.occurredAt).toBeDefined();
  });

  it("should clear events after pulling", () => {
    const category = new Category({ name: "Work" });

    category.pullDomainEvents(); // First pull
    const events = category.pullDomainEvents(); // Second pull

    expect(events).toHaveLength(0);
  });
});

describe("Session domain events", () => {
  let session: Session;
  let timeProvider: MockTimeProvider;

  beforeEach(() => {
    timeProvider = new MockTimeProvider();
    session = Session.create("category-123", timeProvider);
    session.pullDomainEvents(); // Clear creation events
  });

  it("should emit SessionPaused event when paused", () => {
    session.pause(timeProvider);

    const events = session.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SessionPaused);
  });

  it("should emit SessionResumed event when resumed", () => {
    session.pause(timeProvider);
    session.pullDomainEvents(); // Clear pause event

    session.resume(timeProvider);

    const events = session.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(SessionResumed);
  });

  it("should emit SegmentTooShort event for short segments", () => {
    timeProvider.advance(100); // Only 100ms

    session.pause(timeProvider);

    const events = session.pullDomainEvents();
    const tooShortEvent = events.find((e) => e instanceof SegmentTooShort);

    expect(tooShortEvent).toBeDefined();
  });
});
```

---

## Testing Repositories

Test repository **behavior**, not implementation details.

### Testing In-Memory Repository

```typescript
describe("InMemoryCategoryRepository", () => {
  let repository: InMemoryCategoryRepository;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository();
  });

  describe("save and findById", () => {
    it("should save and retrieve category", async () => {
      const category = new Category({ name: "Work" });

      await repository.save(category);
      const found = await repository.findById(category.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(category.id);
      expect(found!.name).toBe("Work");
    });

    it("should return null for non-existent ID", async () => {
      const found = await repository.findById("non-existent");

      expect(found).toBeNull();
    });

    it("should update existing category", async () => {
      const category = new Category({ name: "Work" });
      await repository.save(category);

      category.changeName({ name: "Professional" });
      await repository.save(category);

      const found = await repository.findById(category.id);
      expect(found!.name).toBe("Professional");
    });
  });

  describe("findAll", () => {
    it("should return all categories", async () => {
      const cat1 = new Category({ name: "Work" });
      const cat2 = new Category({ name: "Hobby" });

      await repository.save(cat1);
      await repository.save(cat2);

      const all = await repository.findAll();

      expect(all).toHaveLength(2);
      expect(all.map((c) => c.name)).toContain("Work");
      expect(all.map((c) => c.name)).toContain("Hobby");
    });

    it("should return empty array when no categories", async () => {
      const all = await repository.findAll();

      expect(all).toEqual([]);
    });
  });

  describe("delete", () => {
    it("should delete category", async () => {
      const category = new Category({ name: "Work" });
      await repository.save(category);

      await repository.delete(category.id);

      const found = await repository.findById(category.id);
      expect(found).toBeNull();
    });
  });
});
```

### Testing Query Methods

```typescript
describe("InMemorySessionRepository", () => {
  let repository: InMemorySessionRepository;
  let timeProvider: MockTimeProvider;

  beforeEach(() => {
    repository = new InMemorySessionRepository();
    timeProvider = new MockTimeProvider();
  });

  describe("findByCategory", () => {
    it("should return sessions for specific category", async () => {
      const categoryId = makeId();
      const otherCategoryId = makeId();

      const session1 = Session.create(categoryId, timeProvider);
      const session2 = Session.create(otherCategoryId, timeProvider);
      const session3 = Session.create(categoryId, timeProvider);

      await repository.save(session1);
      await repository.save(session2);
      await repository.save(session3);

      const found = await repository.findByCategory(categoryId);

      expect(found).toHaveLength(2);
      expect(found.every((s) => s.getCategoryId() === categoryId)).toBe(true);
    });
  });

  describe("findActive", () => {
    it("should return only active sessions", async () => {
      const session1 = Session.create(makeId(), timeProvider);
      const session2 = Session.create(makeId(), timeProvider);
      session2.stop(timeProvider); // Stop this one

      await repository.save(session1);
      await repository.save(session2);

      const active = await repository.findActive();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(session1.id);
    });
  });
});
```

---

## Test Helpers and Utilities

### Mock Time Provider

```typescript
export class MockTimeProvider implements TimeProvider {
  private currentTime: number = Date.now();

  now(): DateTime {
    return this.currentTime;
  }

  advance(milliseconds: number): void {
    this.currentTime += milliseconds;
  }

  setTime(timestamp: DateTime): void {
    this.currentTime = timestamp;
  }

  reset(): void {
    this.currentTime = Date.now();
  }
}
```

**Usage:**

```typescript
const timeProvider = new MockTimeProvider();
const session = Session.create("category-123", timeProvider);

timeProvider.advance(5000); // Move time forward 5 seconds
session.pause(timeProvider);
```

### Test Data Builders

```typescript
class CategoryBuilder {
  private name: string = "Default Category";
  private color: string | null = null;
  private icon: string | null = null;

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

  build(): Category {
    const category = new Category({ name: this.name });
    if (this.color) category.setColor({ color: this.color });
    if (this.icon) category.setIcon({ icon: this.icon });
    return category;
  }
}

// Usage
const category = new CategoryBuilder()
  .withName("Work")
  .withColor("#FF0000")
  .build();
```

### Factory Functions

```typescript
function createCategory(
  overrides: Partial<{
    name: string;
    color: string | null;
    icon: string | null;
  }> = {},
): Category {
  const category = new Category({
    name: overrides.name ?? "Test Category",
  });

  if (overrides.color !== undefined) {
    category.setColor({ color: overrides.color });
  }

  if (overrides.icon !== undefined) {
    category.setIcon({ icon: overrides.icon });
  }

  return category;
}

// Usage
const category = createCategory({ name: "Work", color: "#FF0000" });
```

### Session Builder

```typescript
function createSessionWithDuration(
  categoryId: ULID,
  duration: Duration,
): Session {
  const timeProvider = new MockTimeProvider();
  const session = Session.create(categoryId, timeProvider);

  timeProvider.advance(duration.toMilliseconds());
  session.stop(timeProvider);

  return session;
}

// Usage
const session = createSessionWithDuration(categoryId, Duration.fromMinutes(30));
```

---

## Testing Patterns

### Pattern 1: Arrange-Act-Assert (AAA)

```typescript
it("should pause session when active", () => {
  // Arrange - Set up test data
  const timeProvider = new MockTimeProvider();
  const session = Session.create("category-123", timeProvider);
  timeProvider.advance(5000);

  // Act - Perform the action
  session.pause(timeProvider);

  // Assert - Verify the result
  expect(session.hasActiveSegment()).toBe(false);
});
```

### Pattern 2: Given-When-Then (BDD)

```typescript
describe("Session pausing", () => {
  describe("given an active session", () => {
    let session: Session;
    let timeProvider: MockTimeProvider;

    beforeEach(() => {
      // Given
      timeProvider = new MockTimeProvider();
      session = Session.create("category-123", timeProvider);
    });

    describe("when pausing the session", () => {
      beforeEach(() => {
        // When
        timeProvider.advance(5000);
        session.pause(timeProvider);
      });

      it("then should stop active segment", () => {
        // Then
        const segments = session.getSegments();
        expect(segments[0].getStoppedAt()).toBeDefined();
      });

      it("then should not have active segment", () => {
        expect(session.hasActiveSegment()).toBe(false);
      });
    });
  });
});
```

### Pattern 3: Table-Driven Tests

```typescript
describe("Duration validation", () => {
  const invalidValues = [
    { value: -100, reason: "negative" },
    { value: Infinity, reason: "infinite" },
    { value: -Infinity, reason: "negative infinite" },
    { value: NaN, reason: "NaN" },
  ];

  invalidValues.forEach(({ value, reason }) => {
    it(`should reject ${reason} duration`, () => {
      expect(() => Duration.fromMilliseconds(value)).toThrow();
    });
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Test behavior, not implementation**

```typescript
// ✅ Good - Test behavior
it("should not have active segment after pause", () => {
  session.pause(timeProvider);
  expect(session.hasActiveSegment()).toBe(false);
});

// ❌ Bad - Test implementation
it("should set _hasActiveSegment to false", () => {
  session.pause(timeProvider);
  expect(session["_hasActiveSegment"]).toBe(false); // Private field!
});
```

**2. Test one thing per test**

```typescript
// ✅ Good - Focused test
it("should change category name", () => {
  category.changeName({ name: "New Name" });
  expect(category.name).toBe("New Name");
});

// ❌ Bad - Testing multiple things
it("should update category", () => {
  category.changeName({ name: "New Name" });
  expect(category.name).toBe("New Name");
  category.setColor({ color: "#FF0000" });
  expect(category.color).toBe("#FF0000");
  category.setIcon({ icon: "icon" });
  expect(category.icon).toBe("icon");
});
```

**3. Use descriptive test names**

```typescript
// ✅ Good - Clear what it tests
it("should throw EntityInvariantError when name is empty");

// ❌ Bad - Vague
it("should validate");
it("test1");
```

**4. Test edge cases**

```typescript
describe("Duration edge cases", () => {
  it("should handle zero duration", () => {
    const duration = Duration.zero();
    expect(duration.toMilliseconds()).toBe(0);
  });

  it("should handle very large durations", () => {
    const duration = Duration.fromMilliseconds(Number.MAX_SAFE_INTEGER);
    expect(duration.toMilliseconds()).toBe(Number.MAX_SAFE_INTEGER);
  });
});
```

**5. Clean up after tests**

```typescript
describe("Session", () => {
  let timeProvider: MockTimeProvider;

  afterEach(() => {
    timeProvider.reset(); // Clean up
  });
});
```

### ❌ DON'T:

**1. Don't test private methods**

```typescript
// ❌ Bad - Testing private method
it("should validate name", () => {
  const category = new Category({ name: "Work" });
  expect(() => category["ensureValidName"]("")).toThrow();
});

// ✅ Good - Test through public API
it("should throw when setting empty name", () => {
  const category = new Category({ name: "Work" });
  expect(() => category.changeName({ name: "" })).toThrow();
});
```

**2. Don't share state between tests**

```typescript
// ❌ Bad - Shared state
describe("Category", () => {
  const category = new Category({ name: "Work" }); // Shared!

  it("test 1", () => {
    category.changeName({ name: "New" });
  });

  it("test 2", () => {
    // category is in unknown state!
  });
});

// ✅ Good - Fresh state
describe("Category", () => {
  let category: Category;

  beforeEach(() => {
    category = new Category({ name: "Work" }); // Fresh!
  });
});
```

**3. Don't test framework/library code**

```typescript
// ❌ Bad - Testing es-toolkit
it("should trim strings", () => {
  expect(trim("  hello  ")).toBe("hello");
});

// ✅ Good - Test your business logic
it("should accept name with leading whitespace", () => {
  const category = new Category({ name: "  Work  " });
  expect(category.name).toBe("Work"); // If you trim
});
```

---

## Test Organization

### File Structure

```
packages/domain/
├── src/
│   ├── entities/
│   │   ├── Category.ts
│   │   └── Category.test.ts           ← Test next to source
│   ├── valueObjects/
│   │   ├── Duration.ts
│   │   └── Duration.test.ts
│   ├── services/
│   │   ├── SessionExportService.ts
│   │   └── SessionExportService.test.ts
│   └── repositories/
│       ├── ICategoryRepository.ts     ← Interface (no test)
│       └── InMemoryCategoryRepository.test.ts
```

### Test Naming

```typescript
// Pattern: [Class/Method] should [expected behavior] when [condition]

describe("Category", () => {
  it("should create category with valid name");
  it("should throw EntityInvariantError when name is empty");
  it("should maintain ID when name changes");
});
```

---

## Summary

**Test Domain Layer Thoroughly:**

- Fast, isolated, no dependencies
- Tests business rules
- Living documentation

**What to Test:**

- ✅ Entity/aggregate creation
- ✅ Invariant enforcement
- ✅ State changes
- ✅ Business rules
- ✅ Domain events
- ✅ Value object immutability
- ✅ Domain service logic
- ✅ Repository behavior

**Testing Tools:**

- Mock time providers
- Test data builders
- Factory functions
- AAA/GWT patterns

**Best Practices:**

- Test behavior, not implementation
- One thing per test
- Descriptive names
- Test edge cases
- Fresh state per test
- Don't test privates
- Don't share state

**Your Project:**

- Category tests ✅ (already started!)
- Session tests (next)
- Duration tests (when implemented)
- Repository tests (in-memory first)

---

## Related Documents

- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Invariants](./invariants.md)
- [Domain Services](./domain-services.md)
- [Repositories](./repositories.md)

---

## References

- **Test-Driven Development** by Kent Beck
- **Growing Object-Oriented Software, Guided by Tests** by Freeman & Pryce
- **Unit Testing Principles, Practices, and Patterns** by Vladimir Khorikov
