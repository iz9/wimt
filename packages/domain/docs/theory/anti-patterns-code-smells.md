# Anti-Patterns & Code Smells

## What Are Anti-Patterns?

**Anti-patterns** are common solutions that initially seem reasonable but lead to problems. **Code smells** are symptoms that indicate deeper issues in your codebase.

### Key Principle

> "Recognizing bad patterns is as important as learning good ones."

This guide covers common anti-patterns in DDD and Clean Architecture, how to recognize them, and how to fix them.

---

## Domain Layer Anti-Patterns

### 1. Anemic Domain Model

**The Problem:** Entities are just data containers with no behavior. All logic is in services.

```typescript
// ❌ Anemic - No behavior, just getters/setters
class Session {
  private categoryId: ULID;
  private segments: SessionSegment[];
  private isStopped: boolean;

  getCategoryId(): ULID {
    return this.categoryId;
  }
  setCategoryId(id: ULID): void {
    this.categoryId = id;
  }

  getSegments(): SessionSegment[] {
    return this.segments;
  }
  setSegments(segments: SessionSegment[]): void {
    this.segments = segments;
  }

  getIsStopped(): boolean {
    return this.isStopped;
  }
  setIsStopped(stopped: boolean): void {
    this.isStopped = stopped;
  }
}

// All logic in service (not domain!)
class SessionService {
  pause(session: Session, timeProvider: TimeProvider): void {
    if (session.getIsStopped()) {
      throw new Error("Already stopped");
    }

    const activeSegment = session
      .getSegments()
      .find((s) => s.getStoppedAt() === null);

    if (!activeSegment) {
      throw new Error("No active segment");
    }

    activeSegment.setStoppedAt(timeProvider.now());
  }
}
```

**Why It's Bad:**

- Business logic scattered in services
- Domain model doesn't express business rules
- Hard to maintain consistency
- Not object-oriented

**✅ Solution: Rich Domain Model**

```typescript
// ✅ Rich - Behavior encapsulated in entity
class Session extends AggregateRoot {
  private categoryId: ULID;
  private segments: SessionSegment[];
  private isStopped: boolean;

  pause(timeProvider: TimeProvider): void {
    // Business rules enforced in domain
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    activeSegment.stop(timeProvider);
    this.addEvent(new SessionPaused(this.id, timeProvider.now()));
  }

  private getActiveSegment(): SessionSegment | null {
    return this.segments.find((s) => !s.isStopped()) || null;
  }
}

// Service just orchestrates
class PauseSessionUseCase {
  async execute(sessionId: ULID): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    session.pause(this.timeProvider); // Domain does the work!
    await this.sessionRepo.save(session);
  }
}
```

**How to Detect:**

- ⚠️ Entities have only getters/setters
- ⚠️ Services have methods like `calculateX()`, `validateY()`
- ⚠️ Business logic in application layer

---

### 2. God Object

**The Problem:** One class does too many things, knows too much, or has too many responsibilities.

```typescript
// ❌ God Object - Does EVERYTHING
class Session {
  // Session data
  private categoryId: ULID;
  private segments: SessionSegment[];

  // Analytics data (doesn't belong here!)
  private totalDuration: Duration;
  private averageSegmentDuration: Duration;
  private longestSegment: Duration;

  // Reporting data (doesn't belong here!)
  private exportFormat: string;
  private reportTemplate: string;

  // Sync data (doesn't belong here!)
  private lastSyncedAt: DateTime;
  private syncStatus: string;

  // Session methods
  pause(timeProvider: TimeProvider): void {}
  resume(timeProvider: TimeProvider): void {}

  // Analytics methods (doesn't belong here!)
  calculateStatistics(): Statistics {}
  generateReport(): Report {}

  // Sync methods (doesn't belong here!)
  sync(): Promise<void> {}
  checkSyncStatus(): boolean {}

  // Notification methods (doesn't belong here!)
  sendNotification(): void {}

  // ... 30 more methods
}
```

**Why It's Bad:**

- Hard to understand
- Hard to test
- High coupling
- Changes for different reasons (violates Single Responsibility)

**✅ Solution: Split Responsibilities**

```typescript
// ✅ Core Session - Just session logic
class Session extends AggregateRoot {
  private categoryId: ULID;
  private segments: SessionSegment[];
  private isStopped: boolean;

  pause(timeProvider: TimeProvider): void {}
  resume(timeProvider: TimeProvider): void {}
  stop(timeProvider: TimeProvider): void {}

  getTotalDuration(timeProvider?: TimeProvider): Duration {
    // Core logic only
  }
}

// ✅ Separate read model for analytics
class SessionAnalytics {
  sessionId: ULID;
  totalDuration: number;
  averageSegmentDuration: number;
  longestSegment: number;
}

// ✅ Separate service for reporting
class SessionReportGenerator {
  generate(session: Session, format: ReportFormat): Report {
    // Reporting logic
  }
}

// ✅ Separate service for sync
class SessionSyncService {
  async sync(session: Session): Promise<void> {
    // Sync logic
  }
}
```

**How to Detect:**

- ⚠️ Class has 500+ lines
- ⚠️ Class has 20+ methods
- ⚠️ Class has 10+ dependencies
- ⚠️ Hard to name the class (it does too much)

---

### 3. Primitive Obsession

**The Problem:** Using primitive types (string, number) instead of domain-specific types.

```typescript
// ❌ Primitives everywhere
class Category {
  id: string; // ❌ Just a string
  name: string; // ❌ Just a string
  color: string; // ❌ Just a string
  createdAt: number; // ❌ Just a number
}

class Session {
  startTime: number; // ❌ Milliseconds? Seconds?
  duration: number; // ❌ What unit?
}

// Validation scattered everywhere
function createCategory(name: string, color: string) {
  // ❌ Duplicate validation
  if (!name || name.length > 100) throw new Error("Invalid name");
  if (!/^#[0-9A-F]{6}$/i.test(color)) throw new Error("Invalid color");
}

function updateCategory(id: string, name: string, color: string) {
  // ❌ Same validation again!
  if (!name || name.length > 100) throw new Error("Invalid name");
  if (!/^#[0-9A-F]{6}$/i.test(color)) throw new Error("Invalid color");
}
```

**Why It's Bad:**

- No type safety
- Validation duplicated
- No domain semantics
- Easy to mix up parameters

**✅ Solution: Value Objects**

```typescript
// ✅ Specific types with validation
class ULID {
  private constructor(private readonly value: string) {}

  static create(value: string): ULID {
    if (!ULID.isValid(value)) {
      throw new InvalidULIDError(value);
    }
    return new ULID(value);
  }

  toString(): string {
    return this.value;
  }
}

class CategoryName {
  private constructor(private readonly value: string) {}

  static create(value: string): CategoryName {
    if (!value || value.trim().length === 0) {
      throw new Error("Name required");
    }
    if (value.length > 100) {
      throw new Error("Name too long");
    }
    return new CategoryName(value.trim());
  }
}

class Color {
  private constructor(private readonly value: string) {}

  static create(value: string): Color {
    if (!/^#[0-9A-F]{6}$/i.test(value)) {
      throw new Error("Invalid hex color");
    }
    return new Color(value.toUpperCase());
  }
}

class Duration {
  private constructor(private readonly ms: number) {}

  static fromMinutes(minutes: number): Duration {
    return new Duration(minutes * 60 * 1000);
  }

  toMinutes(): number {
    return Math.floor(this.ms / (60 * 1000));
  }
}

// ✅ Use value objects
class Category {
  id: ULID; // ✅ Type-safe ID
  name: CategoryName; // ✅ Self-validating
  color: Color; // ✅ Always valid
  createdAt: DateTime; // ✅ Clear type
}
```

**How to Detect:**

- ⚠️ Parameters are all strings/numbers
- ⚠️ Same validation in multiple places
- ⚠️ Comments explaining what primitive means
- ⚠️ Easy to swap parameters by mistake

---

### 4. Feature Envy

**The Problem:** Method uses more features of another class than its own.

```typescript
// ❌ Feature Envy - SessionService envies Session
class SessionService {
  calculateTotalDuration(session: Session): Duration {
    // Using all Session's internals!
    return session
      .getSegments()
      .filter((s) => s.getStoppedAt() !== null)
      .map((s) => s.getStoppedAt()! - s.getStartedAt())
      .reduce((sum, d) => sum + d, 0);
  }
}
```

**Why It's Bad:**

- Logic in wrong place
- Breaks encapsulation
- High coupling

**✅ Solution: Move to Right Class**

```typescript
// ✅ Move logic to Session
class Session {
  getTotalDuration(): Duration {
    // Session knows its own structure
    return this.segments
      .filter((s) => s.isStopped())
      .map((s) => s.getDuration())
      .reduce((sum, d) => sum.plus(d), Duration.zero());
  }
}

// Service just calls domain
class SessionService {
  calculateTotalDuration(session: Session): Duration {
    return session.getTotalDuration(); // Simple!
  }
}
```

**How to Detect:**

- ⚠️ Method calls many getters on another object
- ⚠️ Method knows internal structure of another class

---

## Application Layer Anti-Patterns

### 5. Domain Logic in Application Layer

**The Problem:** Business rules in use cases instead of domain.

```typescript
// ❌ Business logic in use case
class PauseSessionUseCase {
  async execute(sessionId: ULID): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);

    // ❌ Domain logic in application layer!
    if (session.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = session.segments.find((s) => s.stoppedAt === null);

    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    activeSegment.stoppedAt = this.timeProvider.now();

    await this.sessionRepo.save(session);
  }
}
```

**Why It's Bad:**

- Business logic not in domain
- Can't reuse logic
- Domain model anemic

**✅ Solution: Move to Domain**

```typescript
// ✅ Business logic in domain
class Session {
  pause(timeProvider: TimeProvider): void {
    // ✅ All business rules here
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

// ✅ Use case just orchestrates
class PauseSessionUseCase {
  async execute(sessionId: ULID): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    session.pause(this.timeProvider); // Domain does the work
    await this.sessionRepo.save(session);
  }
}
```

**How to Detect:**

- ⚠️ Use case has if/else for business rules
- ⚠️ Use case calculates business values
- ⚠️ Use case validates domain rules

---

### 6. Transaction Script

**The Problem:** Procedural code instead of object-oriented.

```typescript
// ❌ Transaction script style
class CreateAndStartSessionUseCase {
  async execute(categoryId: ULID): Promise<void> {
    // Step 1: Validate
    const category = await this.categoryRepo.findById(categoryId);
    if (!category) throw new Error("Not found");

    // Step 2: Check
    const activeSessions = await this.sessionRepo.findActive();
    if (activeSessions.length > 0) throw new Error("Active exists");

    // Step 3: Create
    const sessionId = makeId();
    const startTime = Date.now();
    const segmentId = makeId();

    // Step 4: Insert
    await this.db.run(
      "INSERT INTO sessions (id, category_id, start_time) VALUES (?, ?, ?)",
      [sessionId, categoryId, startTime],
    );

    await this.db.run(
      "INSERT INTO segments (id, session_id, started_at) VALUES (?, ?, ?)",
      [segmentId, sessionId, startTime],
    );

    // Step 5: Update
    await this.db.run("UPDATE categories SET last_used = ? WHERE id = ?", [
      startTime,
      categoryId,
    ]);

    // ❌ All procedural, no domain model!
  }
}
```

**Why It's Bad:**

- No domain model
- Hard to test
- Logic not reusable
- Database-centric

**✅ Solution: Use Domain Model**

```typescript
// ✅ Object-oriented with domain model
class StartSessionUseCase {
  async execute(categoryId: ULID): Promise<{ sessionId: ULID }> {
    // Validate
    const category = await this.categoryRepo.findById(categoryId);
    if (!category) {
      throw new CategoryNotFoundError(categoryId);
    }

    // Business rule check
    const activeSession = await this.sessionRepo.findActive();
    if (activeSession) {
      throw new ActiveSessionExistsError();
    }

    // Use domain model
    const session = Session.create(categoryId, this.timeProvider);
    category.markAsUsed(this.timeProvider);

    // Persist
    await this.sessionRepo.save(session);
    await this.categoryRepo.save(category);

    return { sessionId: session.id };
  }
}
```

**How to Detect:**

- ⚠️ Direct SQL in use cases
- ⚠️ No domain entities
- ⚠️ Long procedural methods
- ⚠️ Variables like `data`, `row`, `record`

---

## Infrastructure Layer Anti-Patterns

### 7. Repository Leakage

**The Problem:** Repository details leak into application/domain.

```typescript
// ❌ ORM entities in domain
import { Entity, Column } from "typeorm";

@Entity("categories") // ❌ Infrastructure in domain!
class Category {
  @Column()
  id: string;

  @Column()
  name: string;
}

// ❌ Exposing ORM query builder
interface ICategoryRepository {
  getQueryBuilder(): SelectQueryBuilder<Category>; // ❌ Leaking QueryBuilder!
}

// ❌ Use case knows about ORM
class ListCategoriesUseCase {
  async execute(): Promise<Category[]> {
    return await this.categoryRepo
      .getQueryBuilder()
      .where("deleted_at IS NULL")
      .orderBy("name", "ASC")
      .getMany();
  }
}
```

**Why It's Bad:**

- Domain coupled to infrastructure
- Can't swap implementations
- Hard to test

**✅ Solution: Clean Interfaces**

```typescript
// ✅ Pure domain model
class Category {
  // No ORM annotations!
  constructor(
    public readonly id: ULID,
    public name: string,
  ) {}
}

// ✅ Domain-focused interface
interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  findActive(): Promise<Category[]>; // Domain concept, not SQL
}

// ✅ Infrastructure implements
@injectable()
class TypeORMCategoryRepository implements ICategoryRepository {
  async findActive(): Promise<Category[]> {
    // SQL/ORM details hidden in infrastructure
    const rows = await this.ormRepo
      .createQueryBuilder()
      .where("deleted_at IS NULL")
      .orderBy("name", "ASC")
      .getMany();

    return rows.map((r) => this.toDomain(r));
  }
}
```

**How to Detect:**

- ⚠️ ORM annotations in domain
- ⚠️ Repository returns query builders
- ⚠️ SQL in application layer

---

### 8. Smart UI

**The Problem:** Business logic in UI components.

```typescript
// ❌ Business logic in component
export function SessionCard({ session }: { session: SessionDTO }) {
  const handlePause = async () => {
    // ❌ Business rules in UI!
    if (session.isStopped) {
      Alert.alert('Error', 'Session already stopped');
      return;
    }

    const activeSegment = session.segments
      .find(s => s.stoppedAt === null);

    if (!activeSegment) {
      Alert.alert('Error', 'No active segment');
      return;
    }

    // ❌ Direct repository access from UI!
    await sessionRepository.update(session.id, {
      segments: session.segments.map(s =>
        s.id === activeSegment.id
          ? { ...s, stoppedAt: Date.now() }
          : s
      )
    });
  };

  return <Button onPress={handlePause} title="Pause" />;
}
```

**Why It's Bad:**

- Business logic duplicated across components
- Can't test business logic
- Violates separation of concerns

**✅ Solution: Use Application Layer**

```typescript
// ✅ Component calls use case
export function SessionCard({ session }: { session: SessionDTO }) {
  const pauseSession = usePauseSession();

  const handlePause = async () => {
    try {
      await pauseSession.mutateAsync(session.id);
    } catch (error) {
      if (error instanceof SessionAlreadyStoppedError) {
        Alert.alert('Error', 'Session already stopped');
      } else if (error instanceof NoActiveSegmentError) {
        Alert.alert('Error', 'No active segment');
      }
    }
  };

  return <Button onPress={handlePause} title="Pause" />;
}

// ✅ Hook wraps use case
function usePauseSession() {
  const container = useContainer();

  return useMutation({
    mutationFn: async (sessionId: ULID) => {
      const useCase = container.get<PauseSessionUseCase>(
        TYPES.PauseSessionUseCase
      );
      return await useCase.execute(sessionId);
    }
  });
}
```

**How to Detect:**

- ⚠️ Components with if/else for business rules
- ⚠️ Components calling repositories directly
- ⚠️ Business calculations in components

---

## Testing Anti-Patterns

### 9. Testing Implementation Details

**The Problem:** Tests coupled to internal implementation.

```typescript
// ❌ Testing private methods
describe("Session", () => {
  it("should call private method", () => {
    const session = createSession();
    const spy = jest.spyOn(session as any, "getActiveSegment");

    session.pause(mockTime);

    expect(spy).toHaveBeenCalled(); // ❌ Testing implementation!
  });
});
```

**✅ Solution: Test Public Behavior**

```typescript
// ✅ Test observable behavior
describe("Session", () => {
  it("should pause session", () => {
    const session = createSession();

    session.pause(mockTime);

    expect(session.hasActiveSegment()).toBe(false); // ✅ Public API
  });
});
```

---

### 10. Flaky Tests

**The Problem:** Tests that sometimes pass, sometimes fail.

```typescript
// ❌ Flaky - depends on real time
it("should track 5 seconds", async () => {
  session.start();
  await sleep(5000); // ❌ Real time!
  session.pause();

  // Might be 4999ms or 5001ms
  expect(session.getDuration()).toBe(5000); // ❌ Flaky!
});

// ❌ Flaky - depends on order
let sharedSession; // ❌ Shared state!

it("test 1", () => {
  sharedSession.pause();
});

it("test 2", () => {
  sharedSession.resume(); // ❌ Depends on test 1!
});
```

**✅ Solution: Deterministic Tests**

```typescript
// ✅ Mock time
it("should track 5 seconds", () => {
  const mockTime = new MockTimeProvider(1000);
  session.start(mockTime);

  mockTime.advance(5000); // ✅ Instant, deterministic

  session.pause(mockTime);
  expect(session.getDuration()).toBe(5000); // ✅ Always passes
});

// ✅ Isolated tests
let session;

beforeEach(() => {
  session = createSession(); // ✅ Fresh state each test
});

it("test 1", () => {
  session.pause();
  // Independent
});

it("test 2", () => {
  session.resume();
  // Independent
});
```

---

## Summary

**Domain Anti-Patterns:**

1. **Anemic Domain Model** - No behavior in entities
2. **God Object** - One class does everything
3. **Primitive Obsession** - Using primitives instead of value objects
4. **Feature Envy** - Method in wrong class

**Application Anti-Patterns:** 5. **Domain Logic in Application** - Business rules in use cases 6. **Transaction Script** - Procedural instead of OO

**Infrastructure Anti-Patterns:** 7. **Repository Leakage** - ORM details in domain 8. **Smart UI** - Business logic in components

**Testing Anti-Patterns:** 9. **Testing Implementation** - Testing private details 10. **Flaky Tests** - Non-deterministic tests

**How to Avoid:**

- ✅ Keep business logic in domain
- ✅ Use value objects
- ✅ Test behavior, not implementation
- ✅ Mock time and external dependencies
- ✅ Follow Single Responsibility Principle
- ✅ Program to interfaces

**Key Takeaway:** Recognizing anti-patterns early prevents technical debt!

---

## Related Documents

- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Domain Services](./domain-services.md)
- [Testing Patterns](./testing-patterns-deep-dive.md)

---

## References

- **Refactoring** by Martin Fowler
- **Code Smells** by Martin Fowler
- **Domain-Driven Design** by Eric Evans
- **Clean Code** by Robert C. Martin
