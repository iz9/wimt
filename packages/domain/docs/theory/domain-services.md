# Domain Services

## What is a Domain Service?

A **Domain Service** is a stateless operation that contains domain logic that doesn't naturally fit within an entity or value object. It's a place for business logic that:

- **Involves multiple aggregates**
- **Doesn't belong to a single entity**
- **Performs calculations across entities**
- **Coordinates between domain objects**

### Key Principle

> "Not all domain logic belongs in entities. Some operations are naturally stateless and don't fit the entity or value object model."

---

## When to Use Domain Services

### ✅ Use Domain Service When:

**1. Operation involves multiple aggregates**

```typescript
// Calculating statistics across multiple sessions and categories
class CategoryStatisticsService {
  calculateTotalTimeByCategory(
    sessions: Session[],
    categories: Category[],
  ): Map<ULID, Duration> {
    // Logic spans multiple aggregates
  }
}
```

**2. Operation doesn't naturally belong to any entity**

```typescript
// Where should this method live?
// Session? Category? Neither feels right!
class SessionExportService {
  exportToMarkdown(session: Session, category: Category): string {
    // Involves both Session and Category
    // Doesn't belong to either
  }
}
```

**3. Logic is about policy/process, not entity state**

```typescript
class SegmentValidationService {
  validateNoOverlaps(segments: SessionSegment[]): void {
    // Pure validation logic
    // No state needed
  }
}
```

**4. Would make entity/value object too complex**

```typescript
// Instead of bloating Session with export logic
class SessionExportService {
  exportSessions(sessions: Session[]): ExportedData {
    // Complex export logic kept separate
  }
}
```

### ❌ Don't Use Domain Service When:

**1. Logic naturally belongs in entity**

```typescript
// ❌ Don't extract to service
class SessionService {
  pauseSession(session: Session): void {
    session.pause(); // Just call the method!
  }
}

// ✅ Keep in entity
class Session {
  pause(timeProvider: TimeProvider): void {
    // Belongs here!
  }
}
```

**2. Could be a value object method**

```typescript
// ❌ Don't use service
class DurationService {
  add(d1: Duration, d2: Duration): Duration {
    return Duration.fromMilliseconds(d1.toMilliseconds() + d2.toMilliseconds());
  }
}

// ✅ Method on value object
class Duration {
  add(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds);
  }
}
```

**3. It's application layer logic**

```typescript
// ❌ Not domain service - this is application layer!
class CreateCategoryService {
  async create(name: string): Promise<Category> {
    const category = new Category({ name });
    await this.repository.save(category); // Infrastructure!
    await this.eventPublisher.publish(...); // Infrastructure!
    return category;
  }
}

// ✅ Use case in application layer
class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.repository.save(category);
  }
}
```

---

## Characteristics of Domain Services

### 1. **Stateless**

Domain services should have **no instance state**. They're pure functions.

```typescript
// ✅ Good - Stateless
class SessionExportService {
  exportToMarkdown(session: Session, category: Category): string {
    // No instance fields
    // Pure transformation
    return this.formatMarkdown(session, category);
  }
}

// ❌ Bad - Stateful
class SessionExportService {
  private exportCount: number = 0; // ❌ State!

  exportToMarkdown(session: Session): string {
    this.exportCount++; // ❌ Mutation!
    return "...";
  }
}
```

### 2. **Named After Domain Concepts**

Service names should use **ubiquitous language** from the domain.

```typescript
// ✅ Good - Domain language
class CategoryStatisticsCalculator { ... }
class SessionExporter { ... }
class SegmentOverlapValidator { ... }

// ❌ Bad - Generic/technical names
class DataProcessor { ... }
class Helper { ... }
class Utils { ... }
```

### 3. **Focus on Domain Logic**

Domain services contain **business rules**, not infrastructure.

```typescript
// ✅ Good - Pure domain logic
class PriorityCalculator {
  calculatePriority(category: Category, sessions: Session[]): number {
    // Business rules about priority
    const recentSessions = sessions.filter(...);
    const totalDuration = this.sumDurations(recentSessions);
    return this.computePriorityScore(totalDuration, recentSessions.length);
  }
}

// ❌ Bad - Infrastructure concerns
class CategoryService {
  async saveCategory(category: Category): Promise<void> {
    await this.database.save(category); // ❌ Persistence!
    await this.cache.invalidate(category.id); // ❌ Caching!
  }
}
```

### 4. **Domain Services vs Application Services**

| Domain Service           | Application Service (Use Case) |
| ------------------------ | ------------------------------ |
| Pure domain logic        | Orchestrates workflow          |
| No infrastructure        | Uses repositories, publishers  |
| Stateless                | May maintain transaction state |
| In domain layer          | In application layer           |
| No dependencies on infra | Depends on infrastructure      |

---

## Domain Services in Our Project

### Example 1: Session Export Service

**Problem:** Exporting a session to Markdown involves both Session and Category data.

```typescript
// src/domain/services/SessionExportService.ts
export class SessionExportService {
  exportToMarkdown(session: Session, category: Category): string {
    const segments = session.getSegments();
    const totalDuration = session.getTotalDuration();

    const segmentList = segments
      .map(
        (segment) =>
          `- ${this.formatDateTime(segment.startedAt)} to ${this.formatDateTime(segment.stoppedAt || "ongoing")}`,
      )
      .join("\n");

    return `
# Session Report

**Category:** ${category.name}
**Started:** ${this.formatDateTime(session.getStartTime())}
**Total Duration:** ${this.formatDuration(totalDuration)}

## Segments
${segmentList}

## Summary
Tracked ${segments.length} segment${segments.length === 1 ? "" : "s"} for **${category.name}** category.
    `.trim();
  }

  private formatDateTime(dateTime: DateTime): string {
    return new Date(dateTime).toISOString();
  }

  private formatDuration(duration: Duration): string {
    const hours = Math.floor(duration.toHours());
    const minutes = Math.floor(duration.toMinutes() % 60);
    return `${hours}h ${minutes}m`;
  }
}
```

**Why Domain Service?**

- ✅ Involves both Session and Category
- ✅ Doesn't belong in Session (Category data needed)
- ✅ Doesn't belong in Category (Session data needed)
- ✅ Pure formatting logic
- ✅ Stateless

**Usage:**

```typescript
// In application layer
class ExportSessionUseCase {
  constructor(
    private sessionRepo: ISessionRepository,
    private categoryRepo: ICategoryRepository,
    private exportService: SessionExportService, // Domain service!
  ) {}

  async execute(command: ExportSessionCommand): Promise<string> {
    const session = await this.sessionRepo.findById(command.sessionId);
    const category = await this.categoryRepo.findById(session.categoryId);

    // Use domain service
    return this.exportService.exportToMarkdown(session, category);
  }
}
```

### Example 2: Category Statistics Calculator

**Problem:** Calculate aggregate statistics across multiple sessions.

```typescript
// src/domain/services/CategoryStatisticsCalculator.ts
export interface CategoryStatistics {
  categoryId: ULID;
  totalDuration: Duration;
  sessionCount: number;
  averageDuration: Duration;
  lastSessionDate: DateTime | null;
}

export class CategoryStatisticsCalculator {
  calculate(categoryId: ULID, sessions: Session[]): CategoryStatistics {
    const categorySessions = sessions.filter(
      (s) => s.getCategoryId() === categoryId,
    );

    const totalDuration = categorySessions.reduce(
      (sum, session) => sum.add(session.getTotalDuration()),
      Duration.zero(),
    );

    const sessionCount = categorySessions.length;

    const averageDuration =
      sessionCount > 0
        ? Duration.fromMilliseconds(
            totalDuration.toMilliseconds() / sessionCount,
          )
        : Duration.zero();

    const lastSessionDate =
      categorySessions.length > 0
        ? categorySessions[categorySessions.length - 1].getStartTime()
        : null;

    return {
      categoryId,
      totalDuration,
      sessionCount,
      averageDuration,
      lastSessionDate,
    };
  }

  calculateAll(
    categories: Category[],
    sessions: Session[],
  ): CategoryStatistics[] {
    return categories.map((category) => this.calculate(category.id, sessions));
  }
}
```

**Why Domain Service?**

- ✅ Aggregates data from multiple sessions
- ✅ Calculates domain-meaningful statistics
- ✅ Pure calculation logic
- ✅ Stateless

### Example 3: Segment Overlap Validator

**Problem:** Validate that segments don't overlap (could be in Session, but extracting makes it testable).

```typescript
// src/domain/services/SegmentOverlapValidator.ts
export class SegmentOverlapValidator {
  validate(segments: SessionSegment[]): void {
    const sorted = this.sortByStartTime(segments);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (this.overlaps(current, next)) {
        throw new OverlappingSegmentError();
      }
    }
  }

  hasOverlap(segments: SessionSegment[]): boolean {
    try {
      this.validate(segments);
      return false;
    } catch (error) {
      if (error instanceof OverlappingSegmentError) {
        return true;
      }
      throw error;
    }
  }

  private overlaps(seg1: SessionSegment, seg2: SessionSegment): boolean {
    if (!seg1.getStoppedAt() || !seg2.getStartedAt()) {
      return false; // One is still active
    }

    return seg1.getStoppedAt()! > seg2.getStartedAt();
  }

  private sortByStartTime(segments: SessionSegment[]): SessionSegment[] {
    return [...segments].sort((a, b) => a.getStartedAt() - b.getStartedAt());
  }
}
```

**Why Domain Service?**

- ✅ Complex validation logic
- ✅ Can be reused in different contexts
- ✅ Easier to test in isolation
- ✅ Pure function (no state)

---

## Implementation Patterns

### Pattern 1: Constructor Injection

```typescript
export class SessionExportService {
  constructor(
    private readonly dateFormatter: DateFormatter,
    private readonly durationFormatter: DurationFormatter,
  ) {}

  exportToMarkdown(session: Session, category: Category): string {
    // Use injected dependencies
    const formatted = this.dateFormatter.format(session.getStartTime());
    // ...
  }
}
```

**When to use:**

- Service needs other domain services
- Service needs configuration
- Service has dependencies

### Pattern 2: Static Methods (Simpler)

```typescript
export class SegmentOverlapValidator {
  static validate(segments: SessionSegment[]): void {
    // Static method - no instance needed
    for (let i = 0; i < segments.length - 1; i++) {
      // validation logic
    }
  }
}

// Usage
SegmentOverlapValidator.validate(segments);
```

**When to use:**

- Simple, pure functions
- No dependencies
- No configuration needed

### Pattern 3: Namespace (TypeScript)

```typescript
export namespace CategoryAnalytics {
  export function calculateAverageSessionDuration(
    sessions: Session[],
  ): Duration {
    // Pure calculation
  }

  export function findMostActiveCategory(
    categories: Category[],
    sessions: Session[],
  ): Category | null {
    // Pure logic
  }
}

// Usage
const avgDuration = CategoryAnalytics.calculateAverageSessionDuration(sessions);
```

**When to use:**

- Related utility functions
- No state needed
- Grouping related operations

---

## Testing Domain Services

### Test Pure Logic

```typescript
describe("CategoryStatisticsCalculator", () => {
  const calculator = new CategoryStatisticsCalculator();

  it("should calculate total duration across sessions", () => {
    const categoryId = makeId();
    const sessions = [
      createSessionWithDuration(categoryId, 5000),
      createSessionWithDuration(categoryId, 10000),
    ];

    const stats = calculator.calculate(categoryId, sessions);

    expect(stats.totalDuration.toMilliseconds()).toBe(15000);
  });

  it("should calculate average duration", () => {
    const categoryId = makeId();
    const sessions = [
      createSessionWithDuration(categoryId, 5000),
      createSessionWithDuration(categoryId, 10000),
    ];

    const stats = calculator.calculate(categoryId, sessions);

    expect(stats.averageDuration.toMilliseconds()).toBe(7500);
  });

  it("should return zero for empty sessions", () => {
    const categoryId = makeId();

    const stats = calculator.calculate(categoryId, []);

    expect(stats.totalDuration.toMilliseconds()).toBe(0);
    expect(stats.sessionCount).toBe(0);
  });
});
```

### Test with Test Data Builders

```typescript
// Test data builder
class SessionBuilder {
  private categoryId: ULID = makeId();
  private duration: Duration = Duration.fromSeconds(60);

  withCategory(id: ULID): this {
    this.categoryId = id;
    return this;
  }

  withDuration(duration: Duration): this {
    this.duration = duration;
    return this;
  }

  build(): Session {
    // Build session with test data
    return Session.create(this.categoryId, mockTimeProvider);
  }
}

describe("SessionExportService", () => {
  const exportService = new SessionExportService();

  it("should export session to markdown", () => {
    const category = new Category({ name: "Work" });
    const session = new SessionBuilder()
      .withCategory(category.id)
      .withDuration(Duration.fromMinutes(30))
      .build();

    const markdown = exportService.exportToMarkdown(session, category);

    expect(markdown).toContain("# Session Report");
    expect(markdown).toContain("**Category:** Work");
    expect(markdown).toContain("30m");
  });
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Anemic Domain Model

```typescript
// ❌ BAD - All logic in services, entities are just data bags
class Session {
  public segments: SessionSegment[] = [];
  public isStopped: boolean = false;
}

class SessionService {
  pause(session: Session): void {
    // Logic should be in Session!
    if (session.isStopped) {
      throw new Error("Already stopped");
    }
    const activeSegment = session.segments.find((s) => !s.stoppedAt);
    if (activeSegment) {
      activeSegment.stoppedAt = Date.now();
    }
  }
}
```

**Fix:** Move logic to entity!

```typescript
// ✅ GOOD - Rich domain model
class Session extends AggregateRoot {
  private segments: SessionSegment[] = [];
  private isStopped: boolean = false;

  pause(timeProvider: TimeProvider): void {
    // Logic in entity where it belongs!
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }
    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }
    activeSegment.stop(timeProvider);
  }
}
```

### ❌ Pitfall 2: Stateful Service

```typescript
// ❌ BAD - Service has state
class SessionExportService {
  private lastExport: string = ""; // ❌ State!

  export(session: Session): string {
    this.lastExport = this.format(session); // ❌ Mutation!
    return this.lastExport;
  }
}
```

**Fix:** Make stateless!

```typescript
// ✅ GOOD - Stateless
class SessionExportService {
  export(session: Session, category: Category): string {
    return this.format(session, category); // Pure function
  }
}
```

### ❌ Pitfall 3: Infrastructure in Domain Service

```typescript
// ❌ BAD - Infrastructure concerns
class CategoryService {
  constructor(private repository: ICategoryRepository) {} // ❌ Repository!

  async calculateStats(categoryId: ULID): Promise<Stats> {
    const sessions = await this.repository.findSessions(categoryId); // ❌ DB call!
    // Calculate...
  }
}
```

**Fix:** Move to application layer!

```typescript
// ✅ GOOD - Domain service is pure
class CategoryStatisticsCalculator {
  calculate(sessions: Session[]): Stats {
    // Pure calculation, no repository
  }
}

// ✅ Application layer handles infrastructure
class GetCategoryStatisticsQuery {
  constructor(
    private repository: ISessionRepository,
    private calculator: CategoryStatisticsCalculator,
  ) {}

  async execute(categoryId: ULID): Promise<Stats> {
    const sessions = await this.repository.findByCategory(categoryId);
    return this.calculator.calculate(sessions); // Use domain service
  }
}
```

### ❌ Pitfall 4: Service for Everything

```typescript
// ❌ BAD - Unnecessary service
class DurationService {
  add(d1: Duration, d2: Duration): Duration {
    // Just call d1.add(d2)!
  }
}

// ❌ BAD - Wrapper around entity
class CategoryService {
  create(name: string): Category {
    return new Category({ name }); // Just call constructor!
  }
}
```

**Fix:** Use entity/value object methods directly!

---

## Service Granularity

### Too Coarse

```typescript
// ❌ Too many responsibilities
class SessionManagementService {
  pauseSession(session: Session): void { ... }
  resumeSession(session: Session): void { ... }
  exportSession(session: Session): string { ... }
  validateSession(session: Session): boolean { ... }
  calculateStatistics(sessions: Session[]): Stats { ... }
  // Too much!
}
```

### Too Fine

```typescript
// ❌ Too granular, not adding value
class SegmentStartTimeGetter {
  getStartTime(segment: SessionSegment): DateTime {
    return segment.getStartedAt(); // Trivial!
  }
}
```

### Just Right

```typescript
// ✅ Focused, cohesive
class SessionExportService {
  exportToMarkdown(session: Session, category: Category): string { ... }
  exportToJSON(session: Session, category: Category): object { ... }
  exportToCSV(sessions: Session[]): string { ... }
  // Related export operations
}

class CategoryStatisticsCalculator {
  calculate(categoryId: ULID, sessions: Session[]): Stats { ... }
  calculateAll(categories: Category[], sessions: Session[]): Stats[] { ... }
  // Related calculation operations
}
```

---

## Domain Services in Clean Architecture

```
┌─────────────────────────────────────┐
│      Application Layer              │
│  - Use Cases                        │
│  - Gets data from repositories      │
│  - Calls domain services            │
│  - Publishes events                 │
└───────────┬─────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Domain Layer                   │
│  - Entities                         │
│  - Value Objects                    │
│  - Domain Services  ← HERE!         │
│  - Domain Events                    │
└─────────────────────────────────────┘
            ▲
┌───────────┴─────────────────────────┐
│   Infrastructure Layer              │
│  - Repositories                     │
│  - External APIs                    │
└─────────────────────────────────────┘
```

**Key Points:**

- Domain services are **in the domain layer**
- They're **called by application layer** (use cases)
- They **don't depend on infrastructure**
- They're **pure domain logic**

---

## Summary

**Domain Services are for:**

- ✅ Logic involving multiple aggregates
- ✅ Operations that don't fit in entities/value objects
- ✅ Calculations across domain objects
- ✅ Complex validation spanning entities

**Domain Services are NOT for:**

- ❌ Simple entity operations (keep in entity)
- ❌ Value object calculations (keep in value object)
- ❌ Infrastructure concerns (move to infrastructure layer)
- ❌ Workflow orchestration (move to application layer)

**Characteristics:**

- **Stateless** - no instance state
- **Named with domain language** - not generic names
- **Pure domain logic** - no infrastructure
- **Testable** - easy to test in isolation

**In Our Project:**

- `SessionExportService` - Export sessions to markdown
- `CategoryStatisticsCalculator` - Calculate category statistics
- `SegmentOverlapValidator` - Validate segment overlaps

**Decision Tree:**

1. Does logic naturally belong in an entity? → **Keep in entity**
2. Could it be a value object method? → **Value object**
3. Is it orchestration/workflow? → **Application service**
4. Does it involve infrastructure? → **Infrastructure layer**
5. Is it domain logic across aggregates? → **Domain service** ✅

---

## Related Documents

- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Value Objects](./value-objects.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 5: Services)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 7: Services)
- **Patterns, Principles, and Practices of Domain-Driven Design** by Millett & Tune
