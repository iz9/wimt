# Testing Patterns Deep Dive

## Why Testing Matters in DDD

**Testing** in Domain-Driven Design is not just about code coverage - it's about validating that your domain model correctly expresses business rules and behaves as expected.

### Key Principle

> "Tests are living documentation of how your domain works."

**The Goal:**

- ✅ Domain logic is correct
- ✅ Business rules enforced
- ✅ Regressions prevented
- ✅ Refactoring safe
- ✅ Documentation up-to-date

---

## Testing Pyramid

```
        ┌─────────────┐
        │     E2E     │  ← Few, slow, expensive
        ├─────────────┤
        │ Integration │  ← Some, medium speed
        ├─────────────┤
        │    Unit     │  ← Many, fast, cheap
        └─────────────┘
```

**Our Focus:**

- **70%** Unit tests (domain, value objects)
- **20%** Integration tests (use cases, repositories)
- **10%** E2E tests (critical user flows)

---

## Unit Testing Domain Models

### Testing Entities

```typescript
describe("Category", () => {
  describe("creation", () => {
    it("should create category with valid name", () => {
      const category = new Category({ name: "Work" });

      expect(category.id).toBeDefined();
      expect(category.name).toBe("Work");
      expect(category.createdAt).toBeDefined();
    });

    it("should generate unique IDs", () => {
      const cat1 = new Category({ name: "Work" });
      const cat2 = new Category({ name: "Personal" });

      expect(cat1.id).not.toBe(cat2.id);
    });

    it("should throw on null name", () => {
      expect(() => new Category({ name: null as any })).toThrow(
        ValidationDomainError,
      );
    });

    it("should throw on empty name", () => {
      expect(() => new Category({ name: "" })).toThrow(ValidationDomainError);
    });

    it("should throw on whitespace-only name", () => {
      expect(() => new Category({ name: "   " })).toThrow(
        ValidationDomainError,
      );
    });
  });

  describe("changeName", () => {
    it("should change name", () => {
      const category = new Category({ name: "Work" });

      category.changeName({ name: "Office" });

      expect(category.name).toBe("Office");
    });

    it("should throw on invalid new name", () => {
      const category = new Category({ name: "Work" });

      expect(() => category.changeName({ name: "" })).toThrow(
        ValidationDomainError,
      );
    });

    it("should emit CategoryRenamed event", () => {
      const category = new Category({ name: "Work" });

      category.changeName({ name: "Office" });

      const events = category.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryRenamed);
      expect((events[0] as CategoryRenamed).newName).toBe("Office");
    });
  });

  describe("color and icon", () => {
    it("should set color", () => {
      const category = new Category({ name: "Work" });

      category.setColor("#FF0000");

      expect(category.color).toBe("#FF0000");
    });

    it("should set icon", () => {
      const category = new Category({ name: "Work" });

      category.setIcon("💼");

      expect(category.icon).toBe("💼");
    });

    it("should accept null color", () => {
      const category = new Category({ name: "Work", color: "#FF0000" });

      category.setColor(null);

      expect(category.color).toBeNull();
    });
  });
});
```

### Testing Value Objects

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
      const duration = Duration.fromMinutes(5);

      expect(duration.toMilliseconds()).toBe(5 * 60 * 1000);
    });

    it("should throw on negative duration", () => {
      expect(() => Duration.fromMilliseconds(-100)).toThrow(
        "Duration cannot be negative",
      );
    });

    it("should create zero duration", () => {
      const duration = Duration.zero();

      expect(duration.isZero()).toBe(true);
      expect(duration.toMilliseconds()).toBe(0);
    });
  });

  describe("conversions", () => {
    it("should convert to seconds", () => {
      const duration = Duration.fromMilliseconds(5000);

      expect(duration.toSeconds()).toBe(5);
    });

    it("should convert to minutes", () => {
      const duration = Duration.fromMilliseconds(5 * 60 * 1000);

      expect(duration.toMinutes()).toBe(5);
    });

    it("should convert to hours", () => {
      const duration = Duration.fromMilliseconds(2 * 60 * 60 * 1000);

      expect(duration.toHours()).toBe(2);
    });
  });

  describe("arithmetic", () => {
    it("should add durations", () => {
      const d1 = Duration.fromMinutes(10);
      const d2 = Duration.fromMinutes(5);

      const sum = d1.plus(d2);

      expect(sum.toMinutes()).toBe(15);
    });

    it("should subtract durations", () => {
      const d1 = Duration.fromMinutes(10);
      const d2 = Duration.fromMinutes(3);

      const diff = d1.minus(d2);

      expect(diff.toMinutes()).toBe(7);
    });

    it("should throw when subtracting larger from smaller", () => {
      const d1 = Duration.fromMinutes(5);
      const d2 = Duration.fromMinutes(10);

      expect(() => d1.minus(d2)).toThrow("Cannot subtract larger duration");
    });

    it("should multiply duration", () => {
      const duration = Duration.fromMinutes(5);

      const doubled = duration.multiply(2);

      expect(doubled.toMinutes()).toBe(10);
    });
  });

  describe("comparisons", () => {
    it("should compare equality", () => {
      const d1 = Duration.fromMinutes(5);
      const d2 = Duration.fromMinutes(5);

      expect(d1.equals(d2)).toBe(true);
    });

    it("should compare less than", () => {
      const d1 = Duration.fromMinutes(5);
      const d2 = Duration.fromMinutes(10);

      expect(d1.isLessThan(d2)).toBe(true);
      expect(d2.isLessThan(d1)).toBe(false);
    });

    it("should compare greater than", () => {
      const d1 = Duration.fromMinutes(10);
      const d2 = Duration.fromMinutes(5);

      expect(d1.isGreaterThan(d2)).toBe(true);
      expect(d2.isGreaterThan(d1)).toBe(false);
    });
  });

  describe("formatting", () => {
    it("should format as string", () => {
      const duration = Duration.fromMilliseconds(
        2 * 60 * 60 * 1000 + 30 * 60 * 1000 + 15 * 1000,
      ); // 2h 30m 15s

      expect(duration.toString()).toBe("2h 30m 15s");
    });

    it("should format short duration", () => {
      const duration = Duration.fromSeconds(45);

      expect(duration.toString()).toBe("45s");
    });
  });
});
```

### Testing Aggregates

```typescript
describe("Session aggregate", () => {
  let mockTime: MockTimeProvider;
  let categoryId: ULID;

  beforeEach(() => {
    mockTime = new MockTimeProvider(1000000);
    categoryId = makeId();
  });

  describe("creation", () => {
    it("should create session with first segment", () => {
      const session = Session.create(categoryId, mockTime);

      expect(session.id).toBeDefined();
      expect(session.getCategoryId()).toBe(categoryId);
      expect(session.getSegments()).toHaveLength(1);
      expect(session.getActiveSegment()).toBeDefined();
    });

    it("should emit SessionStarted event", () => {
      const session = Session.create(categoryId, mockTime);

      const events = session.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SessionStarted);
    });
  });

  describe("pause", () => {
    it("should pause active session", () => {
      const session = Session.create(categoryId, mockTime);
      mockTime.advanceMinutes(5);

      session.pause(mockTime);

      expect(session.hasActiveSegment()).toBe(false);
      expect(session.isStopped()).toBe(false);
    });

    it("should stop current segment", () => {
      const session = Session.create(categoryId, mockTime);
      mockTime.advanceMinutes(5);

      session.pause(mockTime);

      const segments = session.getSegments();
      expect(segments[0].getStoppedAt()).toBeDefined();
    });

    it("should emit SessionPaused event", () => {
      const session = Session.create(categoryId, mockTime);
      mockTime.advanceMinutes(5);

      session.pause(mockTime);

      const events = session.pullDomainEvents();
      const pausedEvent = events.find((e) => e instanceof SessionPaused);
      expect(pausedEvent).toBeDefined();
    });

    it("should throw when pausing stopped session", () => {
      const session = Session.create(categoryId, mockTime);
      session.stop(mockTime);

      expect(() => session.pause(mockTime)).toThrow(SessionAlreadyStoppedError);
    });

    it("should throw when no active segment", () => {
      const session = Session.create(categoryId, mockTime);
      session.pause(mockTime);

      expect(() => session.pause(mockTime)).toThrow(NoActiveSegmentError);
    });
  });

  describe("resume", () => {
    it("should create new segment", () => {
      const session = Session.create(categoryId, mockTime);
      session.pause(mockTime);
      mockTime.advanceMinutes(5);

      session.resume(mockTime);

      expect(session.getSegments()).toHaveLength(2);
      expect(session.hasActiveSegment()).toBe(true);
    });

    it("should throw when resuming stopped session", () => {
      const session = Session.create(categoryId, mockTime);
      session.stop(mockTime);

      expect(() => session.resume(mockTime)).toThrow(
        SessionAlreadyStoppedError,
      );
    });

    it("should throw when already active", () => {
      const session = Session.create(categoryId, mockTime);

      expect(() => session.resume(mockTime)).toThrow(SessionAlreadyActiveError);
    });
  });

  describe("getTotalDuration", () => {
    it("should calculate single segment duration", () => {
      const session = Session.create(categoryId, mockTime);
      mockTime.advanceMinutes(10);
      session.pause(mockTime);

      const duration = session.getTotalDuration();

      expect(duration.toMinutes()).toBe(10);
    });

    it("should calculate multiple segments duration", () => {
      const session = Session.create(categoryId, mockTime);

      // First segment: 10 minutes
      mockTime.advanceMinutes(10);
      session.pause(mockTime);

      // Break: 5 minutes
      mockTime.advanceMinutes(5);

      // Second segment: 15 minutes
      session.resume(mockTime);
      mockTime.advanceMinutes(15);
      session.pause(mockTime);

      const duration = session.getTotalDuration();

      expect(duration.toMinutes()).toBe(25); // 10 + 15, break excluded
    });

    it("should include active segment in duration", () => {
      const session = Session.create(categoryId, mockTime);
      mockTime.advanceMinutes(5);

      const duration = session.getTotalDuration(mockTime);

      expect(duration.toMinutes()).toBe(5);
    });
  });
});
```

---

## Test Data Builders

### Pattern: Builder for Complex Objects

```typescript
// test/builders/SessionBuilder.ts
export class SessionBuilder {
  private id: ULID = makeId();
  private categoryId: ULID = makeId();
  private segments: SessionSegment[] = [];
  private isStopped: boolean = false;
  private startTime: DateTime = Date.now();

  withId(id: ULID): this {
    this.id = id;
    return this;
  }

  withCategory(categoryId: ULID): this {
    this.categoryId = categoryId;
    return this;
  }

  withSegments(segments: SessionSegment[]): this {
    this.segments = segments;
    return this;
  }

  withSingleSegment(startedAt: DateTime, stoppedAt: DateTime | null): this {
    this.segments = [
      new SessionSegment({
        id: makeId(),
        startedAt,
        stoppedAt,
      }),
    ];
    return this;
  }

  asStopped(): this {
    this.isStopped = true;
    return this;
  }

  withStartTime(startTime: DateTime): this {
    this.startTime = startTime;
    return this;
  }

  build(): Session {
    return Session.reconstitute({
      id: this.id,
      categoryId: this.categoryId,
      segments: this.segments,
      isStopped: this.isStopped,
      startTime: this.startTime,
    });
  }
}

// Usage in tests
describe("Session", () => {
  it("should calculate duration correctly", () => {
    const session = new SessionBuilder()
      .withSingleSegment(1000, 6000) // 5 seconds
      .build();

    const duration = session.getTotalDuration();

    expect(duration.toSeconds()).toBe(5);
  });

  it("should not pause stopped session", () => {
    const session = new SessionBuilder().asStopped().build();

    expect(() => session.pause(mockTime)).toThrow(SessionAlreadyStoppedError);
  });
});
```

### Pattern: Factory Functions

```typescript
// test/factories/categoryFactory.ts
export function createCategory(
  overrides?: Partial<{ name: string; color: string; icon: string }>,
): Category {
  return new Category({
    name: overrides?.name ?? "Test Category",
    color: overrides?.color ?? null,
    icon: overrides?.icon ?? null,
  });
}

export function createCategoryWithColor(color: string): Category {
  return createCategory({ color });
}

export function createCategoryWithIcon(icon: string): Category {
  return createCategory({ icon });
}

// Usage
describe("Category", () => {
  it("should have default name", () => {
    const category = createCategory();

    expect(category.name).toBe("Test Category");
  });

  it("should accept custom name", () => {
    const category = createCategory({ name: "Work" });

    expect(category.name).toBe("Work");
  });
});
```

---

## Testing with Mocks

### Mock TimeProvider

```typescript
export class MockTimeProvider implements TimeProvider {
  private currentTime: DateTime;

  constructor(initialTime: DateTime = Date.now()) {
    this.currentTime = initialTime;
  }

  now(): DateTime {
    return this.currentTime;
  }

  // Test helpers
  setTime(time: DateTime): void {
    this.currentTime = time;
  }

  advance(milliseconds: number): void {
    this.currentTime += milliseconds;
  }

  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }

  reset(time?: DateTime): void {
    this.currentTime = time ?? Date.now();
  }
}

// Usage
describe("Session duration tracking", () => {
  let mockTime: MockTimeProvider;

  beforeEach(() => {
    mockTime = new MockTimeProvider(1000000);
  });

  it("should track 30 minutes", () => {
    const session = Session.create(categoryId, mockTime);

    mockTime.advanceMinutes(30);

    session.pause(mockTime);

    expect(session.getTotalDuration().toMinutes()).toBe(30);
  });
});
```

### Mock Repository

```typescript
export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<ULID, Category>();

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, category);
  }

  async findById(id: ULID): Promise<Category | null> {
    return this.categories.get(id) || null;
  }

  async findAll(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async findByName(name: string): Promise<Category | null> {
    return (
      Array.from(this.categories.values()).find((c) => c.name === name) || null
    );
  }

  async delete(id: ULID): Promise<void> {
    this.categories.delete(id);
  }

  // Test helpers
  clear(): void {
    this.categories.clear();
  }

  size(): number {
    return this.categories.size;
  }
}

// Usage
describe("CategoryRepository", () => {
  let repo: InMemoryCategoryRepository;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
  });

  it("should save and retrieve category", async () => {
    const category = createCategory({ name: "Work" });

    await repo.save(category);

    const retrieved = await repo.findById(category.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Work");
  });
});
```

---

## Integration Testing

### Testing Use Cases

```typescript
describe("CreateCategoryUseCase", () => {
  let repo: InMemoryCategoryRepository;
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    useCase = new CreateCategoryUseCase(repo);
  });

  it("should create category", async () => {
    const result = await useCase.execute({
      name: "Work",
    });

    expect(result.id).toBeDefined();

    const category = await repo.findById(result.id);
    expect(category).toBeDefined();
    expect(category!.name).toBe("Work");
  });

  it("should throw on duplicate name", async () => {
    await useCase.execute({ name: "Work" });

    await expect(useCase.execute({ name: "Work" })).rejects.toThrow(
      DuplicateCategoryError,
    );
  });

  it("should validate name length", async () => {
    await expect(useCase.execute({ name: "a".repeat(101) })).rejects.toThrow(
      ValidationError,
    );
  });
});
```

### Testing Event Handlers

```typescript
describe("CategoryCreatedHandler", () => {
  let readModel: InMemoryCategoryReadModel;
  let handler: CategoryCreatedReadModelHandler;

  beforeEach(() => {
    readModel = new InMemoryCategoryReadModel();
    handler = new CategoryCreatedReadModelHandler(readModel);
  });

  it("should insert into read model", async () => {
    const event = new CategoryCreated({
      categoryId: makeId(),
      categoryName: "Work",
      occurredAt: Date.now(),
    });

    await handler.handle(event);

    const category = await readModel.findById(event.categoryId);
    expect(category).toBeDefined();
    expect(category!.name).toBe("Work");
  });
});
```

### Testing Repositories with Real Database

```typescript
describe("SqliteCategoryRepository", () => {
  let db: Database;
  let repo: SqliteCategoryRepository;

  beforeEach(async () => {
    // Use in-memory SQLite for tests
    db = await openDatabase(":memory:");

    // Run migrations
    await new DatabaseMigrations().migrate(db);

    repo = new SqliteCategoryRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("should persist category across instances", async () => {
    const category = createCategory({ name: "Work" });
    await repo.save(category);

    // Create new repository instance (simulates app restart)
    const newRepo = new SqliteCategoryRepository(db);

    const retrieved = await newRepo.findById(category.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Work");
  });

  it("should update existing category", async () => {
    const category = createCategory({ name: "Work" });
    await repo.save(category);

    category.changeName({ name: "Office" });
    await repo.save(category);

    const retrieved = await repo.findById(category.id);
    expect(retrieved!.name).toBe("Office");
  });
});
```

---

## Parameterized Tests

### Testing Multiple Scenarios

```typescript
describe("Duration validation", () => {
  it.each([
    [-1, "negative duration"],
    [-100, "large negative duration"],
    [NaN, "NaN"],
    [Infinity, "Infinity"],
    [-Infinity, "negative Infinity"],
  ])("should throw on invalid duration: %s (%s)", (invalidMs, description) => {
    expect(() => Duration.fromMilliseconds(invalidMs)).toThrow();
  });
});

describe("Color validation", () => {
  it.each([
    ["#FF0000", true, "valid hex"],
    ["#00FF00", true, "valid hex"],
    ["#FFF", true, "valid short hex"],
    ["#GGGGGG", false, "invalid characters"],
    ["FF0000", false, "missing #"],
    ["#FF00", false, "wrong length"],
    ["#FFFFFFF", false, "too long"],
  ])("should validate %s as %s (%s)", (color, expected, description) => {
    expect(Color.isValidHexColor(color)).toBe(expected);
  });
});
```

---

## Snapshot Testing

### Testing DTOs

```typescript
describe("SessionDTO", () => {
  it("should match snapshot", () => {
    const session = new SessionBuilder()
      .withId("01ARZ3NDEKTSV4RRFFQ69G5FAV" as ULID)
      .withCategory("01ARZ3NDEKTSV4RRFFQ69G5FAW" as ULID)
      .withStartTime(1000000)
      .build();

    const dto = SessionMapper.toDTO(session);

    expect(dto).toMatchSnapshot();
  });
});

// Snapshot:
// {
//   id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
//   categoryId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
//   startTime: 1000000,
//   totalDurationMs: 0,
//   isActive: false,
//   isStopped: false
// }
```

---

## Testing Error Handling

### Testing Domain Errors

```typescript
describe("Session error handling", () => {
  it("should throw SessionAlreadyStoppedError", () => {
    const session = createStoppedSession();

    expect(() => session.pause(mockTime)).toThrow(SessionAlreadyStoppedError);
  });

  it("should have correct error message", () => {
    const session = createStoppedSession();

    try {
      session.pause(mockTime);
      fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionAlreadyStoppedError);
      expect(error.message).toBe(
        "Cannot pause a session that is already stopped",
      );
    }
  });
});
```

### Testing Application Errors

```typescript
describe("CreateCategoryUseCase error handling", () => {
  it("should throw DuplicateCategoryError", async () => {
    await useCase.execute({ name: "Work" });

    await expect(useCase.execute({ name: "Work" })).rejects.toThrow(
      DuplicateCategoryError,
    );
  });

  it("should include category name in error", async () => {
    await useCase.execute({ name: "Work" });

    try {
      await useCase.execute({ name: "Work" });
      fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateCategoryError);
      expect(error.message).toContain("Work");
    }
  });
});
```

---

## Async Testing

### Testing Promises

```typescript
describe("Async operations", () => {
  it("should save category asynchronously", async () => {
    const category = createCategory();

    await repo.save(category);

    const retrieved = await repo.findById(category.id);
    expect(retrieved).toBeDefined();
  });

  it("should handle rejection", async () => {
    const failingRepo = new FailingRepository();

    await expect(failingRepo.save(category)).rejects.toThrow("Database error");
  });
});
```

### Testing with Timeouts

```typescript
describe("Long-running operations", () => {
  it("should complete within timeout", async () => {
    jest.setTimeout(5000); // 5 seconds

    const result = await longRunningOperation();

    expect(result).toBeDefined();
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Use descriptive test names**

```typescript
// ✅ Good - Describes behavior
it("should throw SessionAlreadyStoppedError when pausing stopped session", () => {});

// ❌ Bad - Vague
it("should fail", () => {});
it("test1", () => {});
```

**2. Arrange-Act-Assert pattern**

```typescript
it("should calculate total duration", () => {
  // Arrange - Setup
  const session = createSession();
  mockTime.advanceMinutes(10);

  // Act - Execute
  const duration = session.getTotalDuration(mockTime);

  // Assert - Verify
  expect(duration.toMinutes()).toBe(10);
});
```

**3. Test one thing per test**

```typescript
// ✅ Good - One assertion
it("should have correct name", () => {
  const category = createCategory({ name: "Work" });
  expect(category.name).toBe("Work");
});

it("should have correct color", () => {
  const category = createCategory({ color: "#FF0000" });
  expect(category.color).toBe("#FF0000");
});

// ❌ Bad - Multiple unrelated assertions
it("should create category correctly", () => {
  const category = createCategory({ name: "Work", color: "#FF0000" });
  expect(category.name).toBe("Work");
  expect(category.color).toBe("#FF0000");
  expect(category.icon).toBeNull();
  expect(category.id).toBeDefined();
});
```

**4. Use test data builders**

```typescript
// ✅ Good - Builder pattern
const session = new SessionBuilder()
  .withCategory(categoryId)
  .asStopped()
  .build();

// ❌ Bad - Manual construction
const session = new Session(
  makeId(),
  categoryId,
  [new SessionSegment(...)],
  true,
  Date.now()
);
```

### ❌ DON'T:

**1. Don't test implementation details**

```typescript
// ❌ Bad - Testing private method
it("should call private method", () => {
  const spy = jest.spyOn(session as any, "privateMethod");
  session.pause(mockTime);
  expect(spy).toHaveBeenCalled();
});

// ✅ Good - Testing public behavior
it("should pause session", () => {
  session.pause(mockTime);
  expect(session.hasActiveSegment()).toBe(false);
});
```

**2. Don't share state between tests**

```typescript
// ❌ Bad - Shared mutable state
let category; // Shared!

beforeEach(() => {
  category = createCategory();
});

it("test 1", () => {
  category.changeName({ name: "Test" });
  // Affects next test!
});

// ✅ Good - Isolated state
let repo;

beforeEach(() => {
  repo = new InMemoryRepository(); // Fresh instance
});
```

**3. Don't use real time**

```typescript
// ❌ Bad - Uses real time
it("should track duration", async () => {
  session.start();
  await sleep(1000); // Wait 1 second!
  session.pause();
  expect(session.getDuration()).toBe(1000);
});

// ✅ Good - Mock time
it("should track duration", () => {
  session.start(mockTime);
  mockTime.advance(1000);
  session.pause(mockTime);
  expect(session.getDuration()).toBe(1000);
});
```

---

## Test Organization

### Structure

```
src/
├── entities/
│   ├── Category.ts
│   └── Category.test.ts        # Unit tests next to code
├── valueObjects/
│   ├── Duration.ts
│   └── Duration.test.ts
└── test/
    ├── builders/               # Test data builders
    │   ├── SessionBuilder.ts
    │   └── CategoryBuilder.ts
    ├── factories/              # Factory functions
    │   ├── sessionFactory.ts
    │   └── categoryFactory.ts
    └── mocks/                  # Mock implementations
        ├── MockTimeProvider.ts
        └── InMemoryRepositories.ts
```

---

## Coverage Goals

**Target:**

- **90%+** Domain layer (critical business logic)
- **80%+** Application layer (use cases)
- **70%+** Infrastructure layer (adapters)
- **60%+** Presentation layer (UI)

**Run coverage:**

```bash
pnpm test --coverage
```

---

## Summary

**Testing Patterns:**

- **Unit Tests:** Domain models, value objects
- **Integration Tests:** Use cases, repositories
- **E2E Tests:** Critical user flows

**Test Data:**

- **Builders:** Complex object construction
- **Factories:** Simple object creation
- **Mocks:** TimeProvider, repositories

**Best Practices:**

- Descriptive names
- Arrange-Act-Assert
- One thing per test
- Test behavior, not implementation
- Isolate tests
- Use mock time

**In Our Project:**

- Unit tests for entities, value objects
- Builders for sessions
- MockTimeProvider for deterministic tests
- InMemory repositories for integration tests
- 90%+ domain coverage goal

**Key Benefit:** Confidence to refactor, extend, and maintain the codebase!

---

## Related Documents

- [Testing Domain Models](./testing-domain-models.md)
- [Factories](./factories.md)
- [Working with Time](./working-with-time.md)

---

## References

- **Test Driven Development** by Kent Beck
- **Growing Object-Oriented Software, Guided by Tests** by Steve Freeman
- **Refactoring: Improving the Design of Existing Code** by Martin Fowler
- **Jest Documentation** - https://jestjs.io
