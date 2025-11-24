# Specifications Pattern

## What is a Specification?

A **Specification** is a pattern that encapsulates a **business rule** that can be used to check if an object satisfies certain criteria. It's a reusable, composable way to express domain logic for querying, filtering, and validation.

### Key Principle

> "A specification is a predicate that determines if an object satisfies certain criteria."

**Simple Example:**

```typescript
// Without specification - logic scattered
const activeSessions = sessions.filter((s) => !s.isStopped());

// With specification - reusable business rule
const activeSessionSpec = new ActiveSessionSpecification();
const activeSessions = sessions.filter((s) =>
  activeSessionSpec.isSatisfiedBy(s),
);
```

---

## When to Use Specifications

### ✅ Use Specification When:

**1. Business rule is reused in multiple places**

```typescript
// Used in multiple queries
const activeSpec = new ActiveSessionSpecification();

// In UI
const activeSessions = allSessions.filter((s) => activeSpec.isSatisfiedBy(s));

// In domain service
if (activeSpec.isSatisfiedBy(session)) {
  // ...
}

// In repository
const active = await sessionRepo.find(activeSpec);
```

**2. Complex criteria that should be named**

```typescript
// ❌ Hard to understand
const valid = session.segments.every(
  (s) => !s.stoppedAt || s.stoppedAt > s.startedAt,
);

// ✅ Clear business rule
const hasValidSegments = new ValidSegmentsSpecification();
const valid = hasValidSegments.isSatisfiedBy(session);
```

**3. Need to combine multiple rules**

```typescript
// Combine specifications
const activeSpec = new ActiveSessionSpecification();
const todaySpec = new StartedTodaySpecification();
const workSpec = new CategorySpecification("Work");

// Composite: Active AND Started Today AND in Work category
const spec = activeSpec.and(todaySpec).and(workSpec);

const sessions = allSessions.filter((s) => spec.isSatisfiedBy(s));
```

**4. Want to test business rules independently**

```typescript
describe("ActiveSessionSpecification", () => {
  it("should be satisfied by active session", () => {
    const session = createActiveSession();
    const spec = new ActiveSessionSpecification();

    expect(spec.isSatisfiedBy(session)).toBe(true);
  });
});
```

### ❌ Don't Use Specification When:

**1. Simple one-time check**

```typescript
// ❌ Overkill for one-time check
const hasNameSpec = new HasNameSpecification();
if (!hasNameSpec.isSatisfiedBy(category)) {
}

// ✅ Just check directly
if (!category.name) {
}
```

**2. Logic belongs in entity**

```typescript
// ❌ Should be in entity
const stoppedSpec = new SessionIsStoppedSpecification();
if (stoppedSpec.isSatisfiedBy(session)) {
}

// ✅ Entity method
if (session.isStopped()) {
}
```

---

## Basic Specification Interface

```typescript
export interface Specification<T> {
  /**
   * Check if object satisfies the specification
   */
  isSatisfiedBy(candidate: T): boolean;

  /**
   * Combine specifications with AND
   */
  and(other: Specification<T>): Specification<T>;

  /**
   * Combine specifications with OR
   */
  or(other: Specification<T>): Specification<T>;

  /**
   * Negate specification
   */
  not(): Specification<T>;
}
```

---

## Simple Specifications

### Example 1: Active Session Specification

```typescript
export class ActiveSessionSpecification implements Specification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return !session.isStopped();
  }

  and(other: Specification<Session>): Specification<Session> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<Session>): Specification<Session> {
    return new OrSpecification(this, other);
  }

  not(): Specification<Session> {
    return new NotSpecification(this);
  }
}

// Usage
const activeSpec = new ActiveSessionSpecification();
const activeSessions = sessions.filter((s) => activeSpec.isSatisfiedBy(s));
```

### Example 2: Date Range Specification

```typescript
export class StartedInRangeSpecification implements Specification<Session> {
  constructor(
    private readonly startDate: DateTime,
    private readonly endDate: DateTime,
  ) {}

  isSatisfiedBy(session: Session): boolean {
    const startTime = session.getStartTime();
    return startTime >= this.startDate && startTime <= this.endDate;
  }

  and(other: Specification<Session>): Specification<Session> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<Session>): Specification<Session> {
    return new OrSpecification(this, other);
  }

  not(): Specification<Session> {
    return new NotSpecification(this);
  }
}

// Usage
const today = new Date();
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
const todaySpec = new StartedInRangeSpecification(
  today.getTime(),
  tomorrow.getTime(),
);

const todaySessions = sessions.filter((s) => todaySpec.isSatisfiedBy(s));
```

### Example 3: Category Specification

```typescript
export class BelongsToCategorySpecification implements Specification<Session> {
  constructor(private readonly categoryId: ULID) {}

  isSatisfiedBy(session: Session): boolean {
    return session.getCategoryId() === this.categoryId;
  }

  and(other: Specification<Session>): Specification<Session> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<Session>): Specification<Session> {
    return new OrSpecification(this, other);
  }

  not(): Specification<Session> {
    return new NotSpecification(this);
  }
}

// Usage
const workSpec = new BelongsToCategorySpecification("cat-work");
const workSessions = sessions.filter((s) => workSpec.isSatisfiedBy(s));
```

---

## Composite Specifications

### AND Specification

```typescript
export class AndSpecification<T> implements Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {}

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate)
    );
  }

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

// Usage
const activeSpec = new ActiveSessionSpecification();
const todaySpec = new StartedInRangeSpecification(startOfDay, endOfDay);

// Active AND Started Today
const spec = activeSpec.and(todaySpec);
const sessions = allSessions.filter((s) => spec.isSatisfiedBy(s));
```

### OR Specification

```typescript
export class OrSpecification<T> implements Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {}

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate)
    );
  }

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

// Usage
const workSpec = new BelongsToCategorySpecification("cat-work");
const studySpec = new BelongsToCategorySpecification("cat-study");

// Work OR Study
const spec = workSpec.or(studySpec);
const sessions = allSessions.filter((s) => spec.isSatisfiedBy(s));
```

### NOT Specification

```typescript
export class NotSpecification<T> implements Specification<T> {
  constructor(private readonly spec: Specification<T>) {}

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    // Double negative
    return this.spec;
  }
}

// Usage
const stoppedSpec = new ActiveSessionSpecification().not();
const stoppedSessions = sessions.filter((s) => stoppedSpec.isSatisfiedBy(s));
```

---

## Base Specification Class

**Avoid duplicating and/or/not logic:**

```typescript
export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

// Now just extend base class
export class ActiveSessionSpecification extends BaseSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return !session.isStopped();
  }
}
```

---

## Specifications in Our Project

### Session Specifications

```typescript
// Active sessions
export class ActiveSessionSpecification extends BaseSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return !session.isStopped();
  }
}

// Stopped sessions
export class StoppedSessionSpecification extends BaseSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return session.isStopped();
  }
}

// Sessions in date range
export class SessionInDateRangeSpecification extends BaseSpecification<Session> {
  constructor(
    private readonly startDate: DateTime,
    private readonly endDate: DateTime,
  ) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    const startTime = session.getStartTime();
    return startTime >= this.startDate && startTime <= this.endDate;
  }
}

// Session by category
export class SessionByCategorySpecification extends BaseSpecification<Session> {
  constructor(private readonly categoryId: ULID) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    return session.getCategoryId() === this.categoryId;
  }
}

// Session duration longer than minimum
export class MinimumDurationSpecification extends BaseSpecification<Session> {
  constructor(private readonly minimumDuration: Duration) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    return session.getTotalDuration().isGreaterThan(this.minimumDuration);
  }
}

// Session has segments
export class HasSegmentsSpecification extends BaseSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return session.getSegments().length > 0;
  }
}
```

### Segment Specifications

```typescript
// Active segment
export class ActiveSegmentSpecification extends BaseSpecification<SessionSegment> {
  isSatisfiedBy(segment: SessionSegment): boolean {
    return segment.getStoppedAt() === null;
  }
}

// Segment duration
export class SegmentDurationSpecification extends BaseSpecification<SessionSegment> {
  constructor(private readonly duration: Duration) {
    super();
  }

  isSatisfiedBy(segment: SessionSegment): boolean {
    const segmentDuration = segment.getDuration();
    return segmentDuration !== null && segmentDuration.equals(this.duration);
  }
}

// Segment too short
export class SegmentTooShortSpecification extends BaseSpecification<SessionSegment> {
  private static readonly MIN_DURATION = Duration.fromMilliseconds(300);

  isSatisfiedBy(segment: SessionSegment): boolean {
    const duration = segment.getDuration();
    if (!duration) return false;

    return duration.isLessThan(SegmentTooShortSpecification.MIN_DURATION);
  }
}
```

### Category Specifications

```typescript
// Category has color
export class HasColorSpecification extends BaseSpecification<Category> {
  isSatisfiedBy(category: Category): boolean {
    return category.color !== null && category.color !== undefined;
  }
}

// Category has icon
export class HasIconSpecification extends BaseSpecification<Category> {
  isSatisfiedBy(category: Category): boolean {
    return category.icon !== null && category.icon !== undefined;
  }
}

// Category created after date
export class CreatedAfterSpecification extends BaseSpecification<Category> {
  constructor(private readonly date: DateTime) {
    super();
  }

  isSatisfiedBy(category: Category): boolean {
    return category.createdAt >= this.date;
  }
}
```

---

## Using Specifications

### In Domain Services

```typescript
export class SessionExportService {
  exportActiveSessions(sessions: Session[]): string {
    const activeSpec = new ActiveSessionSpecification();

    // Filter using specification
    const activeSessions = sessions.filter((s) => activeSpec.isSatisfiedBy(s));

    return this.formatSessions(activeSessions);
  }

  exportRecentWorkSessions(
    sessions: Session[],
    workCategoryId: ULID,
    days: number,
  ): string {
    // Compose specifications
    const workSpec = new SessionByCategorySpecification(workCategoryId);
    const recentSpec = new SessionInDateRangeSpecification(
      Date.now() - days * 24 * 60 * 60 * 1000,
      Date.now(),
    );

    // Combine: Work AND Recent
    const spec = workSpec.and(recentSpec);

    const matchingSessions = sessions.filter((s) => spec.isSatisfiedBy(s));
    return this.formatSessions(matchingSessions);
  }
}
```

### In Repositories (In-Memory)

```typescript
export class InMemorySessionRepository implements ISessionRepository {
  private sessions = new Map<ULID, Session>();

  // Traditional query method
  async findActive(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((s) => !s.isStopped());
  }

  // Specification-based query method
  async find(spec: Specification<Session>): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((s) =>
      spec.isSatisfiedBy(s),
    );
  }
}

// Usage
const repo = new InMemorySessionRepository();

// Using specification
const activeSpec = new ActiveSessionSpecification();
const activeWorkSpec = activeSpec.and(
  new SessionByCategorySpecification(workCategoryId),
);

const sessions = await repo.find(activeWorkSpec);
```

### In Query Handlers

```typescript
export class FindSessionsQueryHandler {
  constructor(private sessionRepo: ISessionRepository) {}

  async handle(query: FindSessionsQuery): Promise<SessionDTO[]> {
    // Build specification based on query
    let spec: Specification<Session> | null = null;

    if (query.onlyActive) {
      spec = new ActiveSessionSpecification();
    }

    if (query.categoryId) {
      const categorySpec = new SessionByCategorySpecification(query.categoryId);
      spec = spec ? spec.and(categorySpec) : categorySpec;
    }

    if (query.startDate && query.endDate) {
      const dateSpec = new SessionInDateRangeSpecification(
        query.startDate,
        query.endDate,
      );
      spec = spec ? spec.and(dateSpec) : dateSpec;
    }

    // Use specification to filter
    let sessions = await this.sessionRepo.findAll();
    if (spec) {
      sessions = sessions.filter((s) => spec.isSatisfiedBy(s));
    }

    return sessions.map((s) => this.toDTO(s));
  }
}
```

### In Domain Validation

```typescript
export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): void {
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    activeSegment.stop(timeProvider);

    // Check if segment is too short (specification!)
    const tooShortSpec = new SegmentTooShortSpecification();
    if (tooShortSpec.isSatisfiedBy(activeSegment)) {
      // Remove short segment
      this.segments = this.segments.filter((s) => s !== activeSegment);

      // Emit event
      this.addEvent(
        new SegmentTooShort({
          sessionId: this.id,
          segmentId: activeSegment.id,
          duration: activeSegment.getDuration()!.toMilliseconds(),
        }),
      );
    }
  }
}
```

---

## Complex Specification Examples

### Find Sessions Meeting Multiple Criteria

```typescript
export class FindRelevantSessionsSpecification extends BaseSpecification<Session> {
  constructor(
    private categoryIds: ULID[],
    private minDuration: Duration,
    private startDate: DateTime,
  ) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    // Must be in one of the categories
    const inCategory = this.categoryIds.includes(session.getCategoryId());

    // Must meet minimum duration
    const meetsMinDuration = session
      .getTotalDuration()
      .isGreaterThan(this.minDuration);

    // Must be after start date
    const afterDate = session.getStartTime() >= this.startDate;

    return inCategory && meetsMinDuration && afterDate;
  }
}

// Or built from smaller specs
const spec = new SessionByCategorySpecification(categoryId)
  .and(new MinimumDurationSpecification(Duration.fromMinutes(5)))
  .and(new SessionInDateRangeSpecification(startDate, endDate));
```

### Multiple Overlapping Segments

```typescript
export class HasOverlappingSegmentsSpecification extends BaseSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    const segments = session.getSegments();

    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      if (this.overlaps(current, next)) {
        return true;
      }
    }

    return false;
  }

  private overlaps(seg1: SessionSegment, seg2: SessionSegment): boolean {
    const end1 = seg1.getStoppedAt();
    const start2 = seg2.getStartedAt();

    if (!end1) return false;
    return end1 > start2;
  }
}

// Usage in domain
export class Session {
  addSegment(segment: SessionSegment): void {
    // Check if adding would create overlap
    const tempSession = this.withAddedSegment(segment);

    const overlapSpec = new HasOverlappingSegmentsSpecification();
    if (overlapSpec.isSatisfiedBy(tempSession)) {
      throw new OverlappingSegmentError();
    }

    this.segments.push(segment);
  }
}
```

---

## Specifications vs Repository Methods

### Repository Methods (Traditional)

```typescript
interface ISessionRepository {
  findAll(): Promise<Session[]>;
  findActive(): Promise<Session[]>;
  findByCategory(categoryId: ULID): Promise<Session[]>;
  findInDateRange(start: DateTime, end: DateTime): Promise<Session[]>;
  findActiveByCategoryInRange(
    categoryId: ULID,
    start: DateTime,
    end: DateTime,
  ): Promise<Session[]>;
  // Combinatorial explosion! 😱
}
```

**Problems:**

- Too many methods
- Can't combine criteria easily
- Hard to maintain

### Specification-Based (Flexible)

```typescript
interface ISessionRepository {
  findAll(): Promise<Session[]>;
  find(spec: Specification<Session>): Promise<Session[]>;
  // That's it!
}

// Usage
const spec = new ActiveSessionSpecification()
  .and(new SessionByCategorySpecification(categoryId))
  .and(new SessionInDateRangeSpecification(start, end));

const sessions = await repo.find(spec);
```

**Benefits:**

- Fewer methods
- Combine any way you want
- Reusable specifications
- Testable rules

---

## Testing Specifications

### Test Individual Specifications

```typescript
describe("ActiveSessionSpecification", () => {
  let spec: ActiveSessionSpecification;

  beforeEach(() => {
    spec = new ActiveSessionSpecification();
  });

  it("should be satisfied by active session", () => {
    const session = createActiveSession();

    expect(spec.isSatisfiedBy(session)).toBe(true);
  });

  it("should not be satisfied by stopped session", () => {
    const session = createStoppedSession();

    expect(spec.isSatisfiedBy(session)).toBe(false);
  });
});
```

### Test Composite Specifications

```typescript
describe("Composite specifications", () => {
  it("should combine with AND", () => {
    const activeSpec = new ActiveSessionSpecification();
    const todaySpec = new StartedTodaySpecification();

    const spec = activeSpec.and(todaySpec);

    const activeToday = createActiveSessionStartedToday();
    const activeYesterday = createActiveSessionStartedYesterday();
    const stoppedToday = createStoppedSessionStartedToday();

    expect(spec.isSatisfiedBy(activeToday)).toBe(true);
    expect(spec.isSatisfiedBy(activeYesterday)).toBe(false);
    expect(spec.isSatisfiedBy(stoppedToday)).toBe(false);
  });

  it("should combine with OR", () => {
    const workSpec = new SessionByCategorySpecification("cat-work");
    const studySpec = new SessionByCategorySpecification("cat-study");

    const spec = workSpec.or(studySpec);

    const workSession = createSession("cat-work");
    const studySession = createSession("cat-study");
    const hobbySession = createSession("cat-hobby");

    expect(spec.isSatisfiedBy(workSession)).toBe(true);
    expect(spec.isSatisfiedBy(studySession)).toBe(true);
    expect(spec.isSatisfiedBy(hobbySession)).toBe(false);
  });

  it("should negate with NOT", () => {
    const activeSpec = new ActiveSessionSpecification();
    const stoppedSpec = activeSpec.not();

    const active = createActiveSession();
    const stopped = createStoppedSession();

    expect(stoppedSpec.isSatisfiedBy(active)).toBe(false);
    expect(stoppedSpec.isSatisfiedBy(stopped)).toBe(true);
  });
});
```

---

## Advanced: SQL Specifications

**Problem:** In-memory filtering doesn't work for databases.

**Solution:** Specifications that can generate SQL.

```typescript
export interface SqlSpecification<T> extends Specification<T> {
  toSql(): { where: string; params: any[] };
}

export class ActiveSessionSqlSpecification
  implements SqlSpecification<Session>
{
  isSatisfiedBy(session: Session): boolean {
    return !session.isStopped();
  }

  toSql(): { where: string; params: any[] } {
    return {
      where: "is_stopped = ?",
      params: [false],
    };
  }

  // and, or, not methods...
}

// In SQL repository
export class SqliteSessionRepository {
  async find(spec: SqlSpecification<Session>): Promise<Session[]> {
    const { where, params } = spec.toSql();
    const query = `SELECT * FROM sessions WHERE ${where}`;

    const rows = await this.db.all(query, params);
    return rows.map((row) => this.mapToSession(row));
  }
}
```

**Challenge:** Composing SQL specifications is complex. Usually better to:

1. Use specifications for in-memory filtering
2. Use specific repository methods for database queries

---

## Best Practices

### ✅ DO:

**1. Name specifications after business concepts**

```typescript
// ✅ Good
ActiveSessionSpecification;
MinimumDurationSpecification;
StartedTodaySpecification;

// ❌ Bad
SessionFilterSpecification;
CheckerSpecification;
```

**2. Keep specifications pure (no side effects)**

```typescript
// ✅ Good - Pure function
class ActiveSessionSpecification {
  isSatisfiedBy(session: Session): boolean {
    return !session.isStopped(); // Just checking
  }
}

// ❌ Bad - Side effect!
class ActiveSessionSpecification {
  isSatisfiedBy(session: Session): boolean {
    session.markAsChecked(); // ❌ Modifying!
    return !session.isStopped();
  }
}
```

**3. Make specifications immutable**

```typescript
// ✅ Good
class SessionByCategorySpecification {
  constructor(private readonly categoryId: ULID) {}
}

// ❌ Bad
class SessionByCategorySpecification {
  categoryId: ULID; // Mutable!
}
```

**4. Use specifications for domain logic, not infrastructure**

```typescript
// ✅ Good - Domain concept
class MinimumDurationSpecification {}

// ❌ Bad - Infrastructure detail
class CachedInRedisSpecification {}
```

### ❌ DON'T:

**1. Don't overuse specifications**

```typescript
// ❌ Overkill
class IsNotNullSpecification {}

// ✅ Just check
if (value !== null) {
}
```

**2. Don't put all logic in specifications**

```typescript
// ❌ Should be in entity
class CanPauseSessionSpecification {}

// ✅ Entity method
session.canPause();
```

---

## Summary

**Specifications are:**

- Reusable business rules
- Composable (AND, OR, NOT)
- Testable in isolation
- Named domain concepts

**Use for:**

- Querying/filtering
- Validation
- Business rules used in multiple places
- Complex criteria combinations

**In Our Project:**

- `ActiveSessionSpecification` - Filter active sessions
- `SessionByCategorySpecification` - Filter by category
- `MinimumDurationSpecification` - Validate duration
- `SegmentTooShortSpecification` - Validate segment length

**Pattern:**

```typescript
const spec = new ActiveSessionSpecification()
  .and(new SessionByCategorySpecification(categoryId))
  .and(new SessionInDateRangeSpecification(start, end));

const sessions = allSessions.filter((s) => spec.isSatisfiedBy(s));
```

**Key Benefit:** Encapsulate and reuse business rules without duplication.

---

## Related Documents

- [Domain Services](./domain-services.md)
- [Repositories](./repositories.md)
- [Value Objects](./value-objects.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 9: Specifications)
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Specifications** by Martin Fowler & Eric Evans
