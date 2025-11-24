# Working with Time in Domain

## Why Abstract Time?

**Time** is one of the most challenging aspects of domain modeling. Using `new Date()` or `Date.now()` directly in domain code makes testing difficult and creates hidden dependencies.

### Key Principle

> "Time is an external dependency. Abstract it with a provider and inject it where needed."

**The Problem:**

```typescript
// ❌ Bad - Hard-coded time dependency
class Session {
  start(): void {
    this.startTime = Date.now(); // ❌ Can't control in tests!
    this.addEvent(new SessionStarted(this.id, Date.now())); // ❌ Can't control!
  }
}

// ❌ Tests are flaky
it("should start session at specific time", () => {
  const session = new Session();
  session.start();

  expect(session.startTime).toBe(1234567890); // ❌ Will fail - time keeps changing!
});
```

**The Solution:**

```typescript
// ✅ Good - Injected time provider
class Session {
  start(timeProvider: TimeProvider): void {
    this.startTime = timeProvider.now(); // ✅ Controllable!
    this.addEvent(new SessionStarted(this.id, timeProvider.now()));
  }
}

// ✅ Tests are deterministic
it("should start session at specific time", () => {
  const mockTime = new MockTimeProvider(1234567890);
  const session = new Session();
  session.start(mockTime);

  expect(session.startTime).toBe(1234567890); // ✅ Always passes!
});
```

---

## TimeProvider Interface

### Simple Interface

```typescript
export interface TimeProvider {
  /**
   * Get current time as timestamp (milliseconds since epoch)
   */
  now(): DateTime;
}

// DateTime is just a number (timestamp)
export type DateTime = number;
```

**Why this interface:**

- ✅ Simple - one method
- ✅ Testable - easy to mock
- ✅ Flexible - can return system time or fixed time
- ✅ Framework-agnostic - no dependencies

---

## Implementations

### 1. Real Time Provider (Production)

```typescript
@injectable()
export class RealTimeProvider implements TimeProvider {
  now(): DateTime {
    return Date.now();
  }
}
```

**Usage:**

```typescript
// In DI container
container
  .bind<TimeProvider>(TYPES.TimeProvider)
  .to(RealTimeProvider)
  .inSingletonScope();

// In domain
const session = Session.create(categoryId, timeProvider);
// Uses real system time
```

### 2. Mock Time Provider (Testing)

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
```

**Usage:**

```typescript
describe("Session", () => {
  let mockTime: MockTimeProvider;

  beforeEach(() => {
    mockTime = new MockTimeProvider(1000000);
  });

  it("should track session duration correctly", () => {
    const session = Session.create(categoryId, mockTime);

    // Advance time by 5 minutes
    mockTime.advanceMinutes(5);

    session.pause(mockTime);

    const duration = session.getTotalDuration();
    expect(duration.toMinutes()).toBe(5);
  });
});
```

### 3. Fixed Time Provider (Debugging)

```typescript
export class FixedTimeProvider implements TimeProvider {
  constructor(private readonly fixedTime: DateTime) {}

  now(): DateTime {
    return this.fixedTime;
  }
}

// Usage - always returns same time
const fixedTime = new FixedTimeProvider(1234567890);
console.log(fixedTime.now()); // 1234567890
console.log(fixedTime.now()); // 1234567890
```

---

## DateTime Value Object

### Basic DateTime

```typescript
export class DateTime {
  private constructor(private readonly timestamp: number) {}

  // Factory methods
  static now(timeProvider: TimeProvider): DateTime {
    return new DateTime(timeProvider.now());
  }

  static fromTimestamp(timestamp: number): DateTime {
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      throw new Error("Invalid timestamp");
    }
    return new DateTime(timestamp);
  }

  static fromDate(date: Date): DateTime {
    return new DateTime(date.getTime());
  }

  static fromISOString(iso: string): DateTime {
    return new DateTime(new Date(iso).getTime());
  }

  // Getters
  toTimestamp(): number {
    return this.timestamp;
  }

  toDate(): Date {
    return new Date(this.timestamp);
  }

  toISOString(): string {
    return this.toDate().toISOString();
  }

  // Comparisons
  equals(other: DateTime): boolean {
    return this.timestamp === other.timestamp;
  }

  isBefore(other: DateTime): boolean {
    return this.timestamp < other.timestamp;
  }

  isAfter(other: DateTime): boolean {
    return this.timestamp > other.timestamp;
  }

  isBetween(start: DateTime, end: DateTime): boolean {
    return this.timestamp >= start.timestamp && this.timestamp <= end.timestamp;
  }

  // Arithmetic
  plus(milliseconds: number): DateTime {
    return new DateTime(this.timestamp + milliseconds);
  }

  minus(milliseconds: number): DateTime {
    return new DateTime(this.timestamp - milliseconds);
  }

  diff(other: DateTime): Duration {
    return Duration.fromMilliseconds(
      Math.abs(this.timestamp - other.timestamp),
    );
  }
}
```

**Why value object:**

- ✅ Type safety (not just `number`)
- ✅ Encapsulates time operations
- ✅ Immutable
- ✅ Domain language (`.isBefore()` vs `< other`)

---

## Duration Value Object

### Complete Duration Implementation

```typescript
export class Duration {
  private constructor(private readonly milliseconds: number) {}

  // Factory methods
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

  static zero(): Duration {
    return new Duration(0);
  }

  static between(start: DateTime, end: DateTime): Duration {
    const diff = end.toTimestamp() - start.toTimestamp();
    return Duration.fromMilliseconds(Math.abs(diff));
  }

  // Conversions
  toMilliseconds(): number {
    return this.milliseconds;
  }

  toSeconds(): number {
    return this.milliseconds / 1000;
  }

  toMinutes(): number {
    return this.milliseconds / (60 * 1000);
  }

  toHours(): number {
    return this.milliseconds / (60 * 60 * 1000);
  }

  // Comparisons
  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds;
  }

  isZero(): boolean {
    return this.milliseconds === 0;
  }

  isLessThan(other: Duration): boolean {
    return this.milliseconds < other.milliseconds;
  }

  isGreaterThan(other: Duration): boolean {
    return this.milliseconds > other.milliseconds;
  }

  // Arithmetic
  plus(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds);
  }

  minus(other: Duration): Duration {
    const result = this.milliseconds - other.milliseconds;
    if (result < 0) {
      throw new Error("Cannot subtract larger duration from smaller");
    }
    return new Duration(result);
  }

  multiply(factor: number): Duration {
    if (factor < 0) {
      throw new Error("Cannot multiply duration by negative number");
    }
    return new Duration(this.milliseconds * factor);
  }

  divide(divisor: number): Duration {
    if (divisor <= 0) {
      throw new Error("Cannot divide duration by zero or negative number");
    }
    return new Duration(this.milliseconds / divisor);
  }

  // Formatting
  toString(): string {
    const hours = Math.floor(this.toHours());
    const minutes = Math.floor(this.toMinutes() % 60);
    const seconds = Math.floor(this.toSeconds() % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  toShortString(): string {
    const hours = Math.floor(this.toHours());
    const minutes = Math.floor(this.toMinutes() % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
```

---

## Using Time in Domain

### Example: Session Start

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

  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    const id = makeId();
    const startTime = timeProvider.now(); // ✅ Use provider

    // Create first segment
    const firstSegment = new SessionSegment({
      id: makeId(),
      startedAt: startTime, // ✅ Same time
      stoppedAt: null,
    });

    const session = new Session(
      id,
      categoryId,
      [firstSegment],
      false,
      startTime,
    );

    // Emit event with time
    session.addEvent(
      new SessionStarted({
        sessionId: id,
        categoryId,
        startTime,
        occurredAt: startTime, // ✅ Event knows when it happened
      }),
    );

    return session;
  }

  pause(timeProvider: TimeProvider): void {
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    const pauseTime = timeProvider.now(); // ✅ Use provider
    activeSegment.stop(pauseTime);

    this.addEvent(
      new SessionPaused({
        sessionId: this.id,
        pauseTime,
        occurredAt: pauseTime,
      }),
    );
  }

  getTotalDuration(): Duration {
    return this.segments.reduce((total, segment) => {
      const segmentDuration = segment.getDuration();
      return segmentDuration ? total.plus(segmentDuration) : total;
    }, Duration.zero());
  }
}
```

### Example: Segment

```typescript
export class SessionSegment {
  constructor(
    public readonly id: ULID,
    private startedAt: DateTime,
    private stoppedAt: DateTime | null,
  ) {}

  stop(stopTime: DateTime): void {
    if (this.stoppedAt !== null) {
      throw new SegmentAlreadyStoppedError();
    }

    if (stopTime <= this.startedAt) {
      throw new Error("Stop time must be after start time");
    }

    this.stoppedAt = stopTime;
  }

  getDuration(): Duration | null {
    if (!this.stoppedAt) {
      return null;
    }

    return Duration.between(
      DateTime.fromTimestamp(this.startedAt),
      DateTime.fromTimestamp(this.stoppedAt),
    );
  }

  isActive(): boolean {
    return this.stoppedAt === null;
  }

  getStartedAt(): DateTime {
    return this.startedAt;
  }

  getStoppedAt(): DateTime | null {
    return this.stoppedAt;
  }
}
```

---

## Testing with Time

### Test Setup

```typescript
describe("Session time tracking", () => {
  let mockTime: MockTimeProvider;
  let categoryId: ULID;

  beforeEach(() => {
    // Start at a known time
    mockTime = new MockTimeProvider(1000000);
    categoryId = makeId();
  });

  it("should track 5 minute session", () => {
    // Start session
    const session = Session.create(categoryId, mockTime);

    // Simulate 5 minutes passing
    mockTime.advanceMinutes(5);

    // Pause session
    session.pause(mockTime);

    // Check duration
    const duration = session.getTotalDuration();
    expect(duration.toMinutes()).toBe(5);
    expect(duration.toMilliseconds()).toBe(5 * 60 * 1000);
  });

  it("should track multiple segments", () => {
    const session = Session.create(categoryId, mockTime);

    // Work for 10 minutes
    mockTime.advanceMinutes(10);
    session.pause(mockTime);

    // Break for 5 minutes
    mockTime.advanceMinutes(5);

    // Resume and work for 15 minutes
    session.resume(mockTime);
    mockTime.advanceMinutes(15);
    session.pause(mockTime);

    // Total: 10 + 15 = 25 minutes (break doesn't count)
    const duration = session.getTotalDuration();
    expect(duration.toMinutes()).toBe(25);
  });
});
```

### Test Time Comparisons

```typescript
describe("DateTime comparisons", () => {
  it("should compare dates correctly", () => {
    const earlier = DateTime.fromTimestamp(1000);
    const later = DateTime.fromTimestamp(2000);

    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isAfter(earlier)).toBe(true);
    expect(earlier.equals(later)).toBe(false);
  });

  it("should calculate duration between dates", () => {
    const start = DateTime.fromTimestamp(0);
    const end = DateTime.fromTimestamp(5 * 60 * 1000); // 5 minutes

    const duration = Duration.between(start, end);

    expect(duration.toMinutes()).toBe(5);
  });
});
```

### Test Duration Operations

```typescript
describe("Duration arithmetic", () => {
  it("should add durations", () => {
    const d1 = Duration.fromMinutes(10);
    const d2 = Duration.fromMinutes(5);

    const total = d1.plus(d2);

    expect(total.toMinutes()).toBe(15);
  });

  it("should subtract durations", () => {
    const d1 = Duration.fromMinutes(10);
    const d2 = Duration.fromMinutes(5);

    const diff = d1.minus(d2);

    expect(diff.toMinutes()).toBe(5);
  });

  it("should throw when subtracting larger from smaller", () => {
    const d1 = Duration.fromMinutes(5);
    const d2 = Duration.fromMinutes(10);

    expect(() => d1.minus(d2)).toThrow();
  });
});
```

---

## Date Ranges

### DateRange Value Object

```typescript
export class DateRange {
  private constructor(
    private readonly start: DateTime,
    private readonly end: DateTime,
  ) {
    if (end.isBefore(start)) {
      throw new Error("End date must be after start date");
    }
  }

  static create(start: DateTime, end: DateTime): DateRange {
    return new DateRange(start, end);
  }

  static today(timeProvider: TimeProvider): DateRange {
    const now = timeProvider.now();
    const startOfDay = this.startOfDay(now);
    const endOfDay = this.endOfDay(now);
    return new DateRange(startOfDay, endOfDay);
  }

  static thisWeek(timeProvider: TimeProvider): DateRange {
    const now = timeProvider.now();
    const startOfWeek = this.startOfWeek(now);
    const endOfWeek = this.endOfWeek(now);
    return new DateRange(startOfWeek, endOfWeek);
  }

  static thisMonth(timeProvider: TimeProvider): DateRange {
    const now = timeProvider.now();
    const startOfMonth = this.startOfMonth(now);
    const endOfMonth = this.endOfMonth(now);
    return new DateRange(startOfMonth, endOfMonth);
  }

  contains(dateTime: DateTime): boolean {
    return (
      (dateTime.isAfter(this.start) && dateTime.isBefore(this.end)) ||
      dateTime.equals(this.start) ||
      dateTime.equals(this.end)
    );
  }

  overlaps(other: DateRange): boolean {
    return (
      this.contains(other.start) ||
      this.contains(other.end) ||
      other.contains(this.start) ||
      other.contains(this.end)
    );
  }

  getDuration(): Duration {
    return Duration.between(this.start, this.end);
  }

  getStart(): DateTime {
    return this.start;
  }

  getEnd(): DateTime {
    return this.end;
  }

  // Helper methods
  private static startOfDay(timestamp: DateTime): DateTime {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return DateTime.fromDate(date);
  }

  private static endOfDay(timestamp: DateTime): DateTime {
    const date = new Date(timestamp);
    date.setHours(23, 59, 59, 999);
    return DateTime.fromDate(date);
  }

  private static startOfWeek(timestamp: DateTime): DateTime {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() - day;
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return DateTime.fromDate(date);
  }

  private static endOfWeek(timestamp: DateTime): DateTime {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() + (6 - day);
    date.setDate(diff);
    date.setHours(23, 59, 59, 999);
    return DateTime.fromDate(date);
  }

  private static startOfMonth(timestamp: DateTime): DateTime {
    const date = new Date(timestamp);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return DateTime.fromDate(date);
  }

  private static endOfMonth(timestamp: DateTime): DateTime {
    const date = new Date(timestamp);
    date.setMonth(date.getMonth() + 1, 0);
    date.setHours(23, 59, 59, 999);
    return DateTime.fromDate(date);
  }
}
```

### Using DateRange

```typescript
// Find sessions in date range
export class ListSessionsInRangeQuery {
  constructor(private sessionRepo: ISessionRepository) {}

  async execute(query: {
    startDate: DateTime;
    endDate: DateTime;
    categoryId?: ULID;
  }): Promise<SessionDTO[]> {
    const range = DateRange.create(query.startDate, query.endDate);

    const allSessions = await this.sessionRepo.findAll();

    // Filter sessions within range
    const sessionsInRange = allSessions.filter((session) =>
      range.contains(DateTime.fromTimestamp(session.getStartTime())),
    );

    // Filter by category if provided
    const filtered = query.categoryId
      ? sessionsInRange.filter((s) => s.getCategoryId() === query.categoryId)
      : sessionsInRange;

    return filtered.map((s) => this.toDTO(s));
  }
}
```

---

## Time Zones

### Simple Approach (UTC)

```typescript
// Store everything as UTC timestamps
class Session {
  private startTime: DateTime; // Always UTC timestamp

  start(timeProvider: TimeProvider): void {
    this.startTime = timeProvider.now(); // UTC timestamp
  }
}

// Display in user's local timezone
export class SessionDTO {
  readonly startTime: number; // UTC timestamp
  readonly startTimeLocal: string; // ISO string in local time

  constructor(session: Session) {
    this.startTime = session.getStartTime();

    // Convert to local time for display
    this.startTimeLocal = new Date(this.startTime).toLocaleString();
  }
}
```

**Recommendation:** Keep it simple - store UTC, display local.

---

## Best Practices

### ✅ DO:

**1. Always inject TimeProvider**

```typescript
// ✅ Good
static create(categoryId: ULID, timeProvider: TimeProvider): Session {
  const startTime = timeProvider.now();
}

// ❌ Bad
static create(categoryId: ULID): Session {
  const startTime = Date.now();
}
```

**2. Use Duration for time spans**

```typescript
// ✅ Good
getDuration(): Duration {
  return Duration.between(this.start, this.end);
}

// ❌ Bad
getDuration(): number {
  return this.end - this.start; // What unit?
}
```

**3. Use DateTime for points in time**

```typescript
// ✅ Good
readonly startTime: DateTime;

// ❌ Bad
readonly startTime: number; // Not clear it's a timestamp
```

**4. Make time operations explicit**

```typescript
// ✅ Good
const later = now.plus(Duration.fromMinutes(5).toMilliseconds());

// ❌ Bad
const later = now + 5 * 60 * 1000; // Magic numbers
```

### ❌ DON'T:

**1. Don't use Date.now() in domain**

```typescript
// ❌ Bad
class Session {
  start(): void {
    this.startTime = Date.now();
  }
}

// ✅ Good
class Session {
  start(timeProvider: TimeProvider): void {
    this.startTime = timeProvider.now();
  }
}
```

**2. Don't do date math with numbers**

```typescript
// ❌ Bad
const fiveMinutesLater = timestamp + 5 * 60 * 1000;

// ✅ Good
const fiveMinutesLater = dateTime.plus(
  Duration.fromMinutes(5).toMilliseconds(),
);
```

**3. Don't mix time units**

```typescript
// ❌ Bad
function wait(time: number) {
  // Is this milliseconds? Seconds?
}

// ✅ Good
function wait(duration: Duration) {
  setTimeout(() => {}, duration.toMilliseconds());
}
```

---

## Summary

**TimeProvider Pattern:**

- Abstract time as injectable dependency
- `RealTimeProvider` for production
- `MockTimeProvider` for testing
- Enables deterministic tests

**DateTime Value Object:**

- Wraps timestamp with type safety
- Comparison methods (isBefore, isAfter)
- Immutable operations

**Duration Value Object:**

- Type-safe time spans
- Factory methods (fromMinutes, fromHours)
- Arithmetic operations (plus, minus)
- Formatting (toString)

**In Our Project:**

- `TimeProvider` interface in domain
- `RealTimeProvider` in infrastructure
- `MockTimeProvider` in tests
- `DateTime` and `Duration` value objects
- `DateRange` for queries

**Key Benefit:** Testable, deterministic time-dependent logic without flaky tests!

---

## Related Documents

- [Value Objects](./value-objects.md)
- [Testing Domain Models](./testing-domain-models.md)
- [Factories](./factories.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Patterns of Enterprise Application Architecture** by Martin Fowler (Service Layer)
