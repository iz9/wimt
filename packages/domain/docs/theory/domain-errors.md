# Domain Errors

## What are Domain Errors?

**Domain Errors** are exceptions that represent violations of business rules or invalid states within the domain model. They are distinct from technical errors (like network failures or database errors) because they communicate **business-level problems** that have meaning to domain experts and users.

Domain errors enforce the **integrity of your domain** by preventing invalid operations and maintaining business invariants.

### Key Characteristics:

1. **Business-Meaningful** - Errors that domain experts would understand
2. **Explicit** - Specific error types for different business rule violations
3. **Self-Explanatory** - Error names and messages clearly describe the problem
4. **Domain Layer Only** - Defined and thrown from domain entities/aggregates
5. **Catchable** - Can be handled appropriately by application layer

---

## Why Use Domain Errors?

### 1. **Express Business Rules Clearly**

Instead of returning `null` or boolean flags, domain errors explicitly communicate what went wrong.

**Without Domain Errors:**

```typescript
// Unclear what went wrong
stop(): boolean {
  if (this.isStopped) {
    return false; // Why did it fail?
  }
  // ...
  return true;
}
```

**With Domain Errors:**

```typescript
// Crystal clear
stop(timeProvider: TimeProvider): void {
  if (this.isStopped) {
    throw new SessionAlreadyStoppedError();
  }
  // ...
}
```

### 2. **Type Safety**

TypeScript allows you to catch specific error types, making error handling safer and more explicit.

```typescript
try {
  session.pause(timeProvider);
} catch (error) {
  if (error instanceof NoActiveSegmentError) {
    // Handle specifically
    console.warn("Cannot pause - no active segment");
  } else if (error instanceof SessionAlreadyStoppedError) {
    // Handle differently
    console.warn("Cannot pause - session already stopped");
  } else {
    throw error; // Unknown error, rethrow
  }
}
```

### 3. **Better Error Messages**

Domain errors provide context-specific messages that help developers and users understand what happened.

### 4. **Fail Fast**

Throwing errors immediately when rules are violated prevents the system from entering an invalid state.

### 5. **Testing Business Rules**

Domain errors make it easy to test that business rules are enforced correctly.

```typescript
it("should throw when pausing without active segment", () => {
  const session = Session.create("category-123", timeProvider);
  session.stop(timeProvider);

  expect(() => session.pause(timeProvider)).toThrow(NoActiveSegmentError);
});
```

---

## Domain Errors vs Technical Errors

| Aspect       | Domain Error                 | Technical Error           |
| ------------ | ---------------------------- | ------------------------- |
| **Origin**   | Business rules               | Infrastructure/system     |
| **Meaning**  | Business violation           | Technical failure         |
| **Examples** | `SessionAlreadyStoppedError` | `DatabaseConnectionError` |
| **Layer**    | Domain                       | Infrastructure            |
| **Recovery** | User action needed           | Retry or failover         |
| **Message**  | Business-friendly            | Technical details         |
| **Expected** | Yes (normal flow)            | No (exceptional)          |

**Domain Error Example:**

- User tries to pause a session that's already stopped
- This is a **business rule violation** - the user did something invalid
- Can be prevented with UI validation

**Technical Error Example:**

- Database connection times out
- This is a **system failure** - nothing the user did wrong
- Should be logged and possibly retried

---

## Domain Errors in Our Project

### Error Hierarchy

```
Error (JavaScript base)
  └─ DomainError (our base class)
      ├─ NoActiveSegmentError
      ├─ SessionAlreadyStoppedError
      ├─ OverlappingSegmentError
      └─ TooShortSegmentError
```

### Existing Domain Errors

#### 1. **NoActiveSegmentError**

- **When:** User tries to pause/stop a segment when none is active
- **Business Rule:** Cannot pause/stop a session without an active segment
- **Recovery:** Start a new session or resume an existing one
- **File:** `src/errors/NoActiveSegmentError.ts`

#### 2. **SessionAlreadyStoppedError**

- **When:** User tries to modify a session that has been permanently stopped
- **Business Rule:** Once a session is stopped with `stop()`, it cannot be modified
- **Recovery:** Start a new session
- **File:** `src/errors/SessionAlreadyStoppedError.ts`

#### 3. **OverlappingSegmentError**

- **When:** Attempting to create segments with overlapping time ranges
- **Business Rule:** Session segments cannot overlap in time
- **Recovery:** Fix segment timestamps or remove overlapping segment
- **File:** `src/errors/OverlapingSegmentError.ts`

#### 4. **TooShortSegmentError**

- **When:** Segment duration is below the minimum threshold (300ms)
- **Business Rule:** Segments shorter than 300ms are not meaningful
- **Recovery:** None - segment is automatically discarded
- **File:** `src/errors/TooShortSegmentError.ts`

---

## Implementing Domain Errors

### Step 1: Create Base DomainError Class

```typescript
// src/errors/DomainError.ts
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
```

**Why extend Error?**

- Integrates with JavaScript error handling
- Stack traces work correctly
- Can be caught with instanceof

### Step 2: Create Specific Error Classes

```typescript
// src/errors/NoActiveSegmentError.ts
import { DomainError } from "./DomainError";

export class NoActiveSegmentError extends DomainError {
  constructor() {
    super("no active segment to stop/pause");
    this.name = "NoActiveSegmentError";
  }
}
```

**Pattern:**

- Extend `DomainError`
- Provide a clear, business-friendly message
- Set the `name` property for better debugging
- Constructor can accept parameters if needed

### Step 3: Throw from Domain Logic

```typescript
// In Session aggregate
export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): void {
    // Guard clause - check business rules
    if (this._isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    // Valid - proceed with business logic
    activeSegment.stop(timeProvider);
    this.addEvent(new SessionPaused(this.id, timeProvider.now()));
  }
}
```

**When to Throw:**

- At the **start** of a method (guard clauses)
- When a business rule is violated
- When an operation is not allowed in the current state

### Step 4: Handle in Application Layer

```typescript
// In use case
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);

    if (!session) {
      throw new Error("Session not found"); // Application error
    }

    try {
      session.pause(this.timeProvider); // May throw domain error
      await this.sessionRepo.save(session);

      const events = session.pullDomainEvents();
      await this.eventPublisher.publish(events);
    } catch (error) {
      if (error instanceof NoActiveSegmentError) {
        // Handle gracefully - this is expected
        throw new ApplicationError(
          "Cannot pause: no active segment",
          "NO_ACTIVE_SEGMENT",
        );
      } else if (error instanceof SessionAlreadyStoppedError) {
        throw new ApplicationError(
          "Cannot pause: session is stopped",
          "SESSION_STOPPED",
        );
      }
      throw error; // Unknown error, rethrow
    }
  }
}
```

**Application Layer Responsibilities:**

- Catch domain errors
- Translate to application-specific errors if needed
- Provide user-friendly error codes
- Log for debugging

---

## Error Naming Conventions

### Good Names ✅

- `NoActiveSegmentError` - Clear what's missing
- `SessionAlreadyStoppedError` - Clear state violation
- `OverlappingSegmentError` - Clear business rule
- `CategoryNotFoundError` - Clear what wasn't found
- `InvalidDurationError` - Clear what's invalid

### Bad Names ❌

- `Error` - Too generic
- `PauseError` - What about the pause?
- `CannotDoThat` - Do what?
- `IllegalState` - Too technical
- `Exception` - Not descriptive

**Rule:** The error name should clearly communicate the business problem.

---

## When to Use Domain Errors

### ✅ Use Domain Errors For:

1. **Business Rule Violations**
   - Category name is empty
   - Session already stopped
   - Segment too short

2. **Invalid State Transitions**
   - Cannot pause when not started
   - Cannot resume when already active
   - Cannot stop twice

3. **Invariant Violations**
   - Overlapping segments
   - Negative duration
   - Missing required fields

4. **Precondition Failures**
   - No active segment to pause
   - Category doesn't exist (domain layer check)

### ❌ Don't Use Domain Errors For:

1. **Technical Failures**
   - Database connection failed
   - Network timeout
   - File system error

2. **Not Found Cases (Usually)**
   - Repository returns null - this is normal, not an error
   - Handle in application layer instead

3. **Validation (Sometimes)**
   - Use `invariant()` for constructor validation
   - Use domain errors for method preconditions

4. **Expected Variations**
   - Optional values - use `| null` instead
   - Multiple outcomes - use return values or result objects

---

## Error vs Event

Sometimes a situation can be handled as either an error or an event. Here's how to decide:

### Use Error When:

- Operation **cannot proceed**
- State would become **invalid**
- Requires **user intervention**

### Use Event When:

- Operation **can proceed** but with different outcome
- State remains **valid**
- Other systems should be **notified**

**Example: Segment Too Short**

**As Error (if we want to fail):**

```typescript
if (duration.isLessThan(MIN_DURATION)) {
  throw new TooShortSegmentError(duration);
}
```

**As Event (if we want to proceed):**

```typescript
if (duration.isLessThan(MIN_DURATION)) {
  this.addEvent(new SegmentTooShort(this.id, duration, timeProvider.now()));
  return; // Don't save segment, but continue
}
```

**In our project:** We use **Event** for `SegmentTooShort` because:

- The session can still be paused successfully
- We just don't save the segment
- Other systems might want to track this (analytics)

---

## Error Context and Data

### Basic Error (No Context)

```typescript
export class SessionAlreadyStoppedError extends DomainError {
  constructor() {
    super("session already stopped");
    this.name = "SessionAlreadyStoppedError";
  }
}
```

**When:** Error cause is obvious from the name.

### Error with Context

```typescript
export class InvalidDurationError extends DomainError {
  constructor(
    public readonly attemptedDuration: number,
    public readonly minimumDuration: number,
  ) {
    super(
      `Duration ${attemptedDuration}ms is less than minimum ${minimumDuration}ms`,
    );
    this.name = "InvalidDurationError";
  }
}
```

**When:** Additional context helps debugging or error handling.

### Error with Rich Data

```typescript
export class OverlappingSegmentError extends DomainError {
  constructor(
    public readonly existingSegment: { start: DateTime; end: DateTime },
    public readonly newSegment: { start: DateTime; end: DateTime },
  ) {
    super(
      `Segment [${newSegment.start}-${newSegment.end}] overlaps with ` +
        `existing segment [${existingSegment.start}-${existingSegment.end}]`,
    );
    this.name = "OverlappingSegmentError";
  }
}
```

**When:** Error handler needs data to potentially fix the issue.

**Guidelines:**

- Include data that helps **diagnose** the problem
- Include data that helps **display** meaningful error to user
- Don't include sensitive information
- Keep it serializable (no complex objects)

---

## Testing Domain Errors

### Test That Errors Are Thrown

```typescript
describe("Session", () => {
  it("should throw NoActiveSegmentError when pausing without active segment", () => {
    const session = Session.create("cat-123", timeProvider);
    session.stop(timeProvider); // No active segment after stop

    expect(() => session.pause(timeProvider)).toThrow(NoActiveSegmentError);
  });

  it("should throw SessionAlreadyStoppedError when resuming stopped session", () => {
    const session = Session.create("cat-123", timeProvider);
    session.stop(timeProvider);

    expect(() => session.resume(timeProvider)).toThrow(
      SessionAlreadyStoppedError,
    );
  });
});
```

### Test Error Messages

```typescript
it("should have meaningful error message", () => {
  const session = Session.create("cat-123", timeProvider);
  session.stop(timeProvider);

  try {
    session.pause(timeProvider);
    fail("Should have thrown error");
  } catch (error) {
    expect(error).toBeInstanceOf(NoActiveSegmentError);
    expect(error.message).toBe("no active segment to stop/pause");
  }
});
```

### Test Error Context

```typescript
it("should include context in error", () => {
  try {
    Duration.fromMilliseconds(-100); // Invalid
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidDurationError);
    expect(error.attemptedDuration).toBe(-100);
  }
});
```

---

## Error Handling Patterns

### Pattern 1: Guard Clauses

```typescript
export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): void {
    // Check all preconditions first
    if (this._isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    if (!this.hasActiveSegment()) {
      throw new NoActiveSegmentError();
    }

    // All preconditions met - execute business logic
    const activeSegment = this.getActiveSegment()!;
    activeSegment.stop(timeProvider);
    this.addEvent(new SessionPaused(this.id, timeProvider.now()));
  }
}
```

**Benefits:**

- Fail fast
- Clear what conditions must be met
- Main logic is not nested in if/else

### Pattern 2: Try-Catch in Application Layer

```typescript
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<Result> {
    const session = await this.sessionRepo.findById(command.sessionId);

    try {
      session.pause(this.timeProvider);
      await this.sessionRepo.save(session);
      return Result.success();
    } catch (error) {
      if (error instanceof NoActiveSegmentError) {
        return Result.failure("NO_ACTIVE_SEGMENT");
      }
      if (error instanceof SessionAlreadyStoppedError) {
        return Result.failure("SESSION_STOPPED");
      }
      throw error; // Unexpected error, rethrow
    }
  }
}
```

**Benefits:**

- Convert domain errors to application errors
- Provide error codes for API responses
- Log domain errors for analytics

### Pattern 3: Result Objects (Alternative)

Instead of throwing, you can return a Result object:

```typescript
type Result<T, E> = Success<T> | Failure<E>;

export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): Result<void, DomainError> {
    if (this._isStopped) {
      return Failure(new SessionAlreadyStoppedError());
    }

    // Business logic...
    return Success(undefined);
  }
}
```

**Pros:**

- More functional approach
- Forces caller to handle errors
- Type-safe error handling

**Cons:**

- More verbose
- Can't use with existing Error infrastructure
- Less familiar to many developers

**Our Choice:** We use **throw** for simplicity and familiarity.

---

## Error Messages

### Good Error Messages ✅

- **Clear:** "no active segment to stop/pause"
- **Specific:** "session already stopped"
- **Actionable:** "segments overlap - remove or adjust segment times"
- **Business-Friendly:** "category name is required"

### Bad Error Messages ❌

- **Vague:** "operation failed"
- **Technical:** "null pointer in \_segments[0]"
- **Code-Like:** "isStopped === true"
- **Unhelpful:** "error"

**Guidelines:**

- Write for domain experts, not just developers
- Explain **what** went wrong, not **how** it failed technically
- Include minimal context needed to understand the issue
- Keep it concise

---

## Custom Error Properties

You can add custom properties to errors for better handling:

```typescript
export class InvalidDurationError extends DomainError {
  readonly errorCode = "INVALID_DURATION";
  readonly recoverable = false;

  constructor(
    public readonly duration: number,
    public readonly min: number,
    public readonly max: number,
  ) {
    super(`Duration ${duration}ms must be between ${min}ms and ${max}ms`);
    this.name = "InvalidDurationError";
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      duration: this.duration,
      allowedRange: { min: this.min, max: this.max },
    };
  }
}
```

**Use Cases:**

- Error codes for API responses
- Determining if error is recoverable
- Serializing for logging
- Providing structured data for error reporting

---

## Best Practices

### ✅ DO:

1. **Create specific error types** - One class per business rule
2. **Extend DomainError** - Maintain error hierarchy
3. **Use clear names** - Error name should describe the problem
4. **Set the name property** - Helps with debugging and instanceof
5. **Include context when useful** - Data that helps handle the error
6. **Throw early** - Guard clauses at method start
7. **Test error cases** - Verify business rules are enforced
8. **Document errors** - JSDoc what errors a method can throw

### ❌ DON'T:

1. **Don't use generic errors** - Create specific types instead
2. **Don't include sensitive data** - Errors might be logged/displayed
3. **Don't use errors for control flow** - Use return values for normal paths
4. **Don't swallow errors** - Re-throw or handle explicitly
5. **Don't forget stack traces** - Call `super()` properly
6. **Don't make errors stateful** - Errors should be immutable
7. **Don't throw from constructors unnecessarily** - Use factory methods instead

---

## Domain Errors and Clean Architecture

```
┌─────────────────────────────────────┐
│      Presentation Layer             │
│  - Catch application errors         │
│  - Display user-friendly messages   │
└───────────┬─────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Application Layer              │
│  - Catch domain errors              │
│  - Translate to application errors  │
│  - Provide error codes              │
│  - Log errors                       │
└───────────┬─────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Domain Layer                   │
│  - Define domain errors             │
│  - Throw on business rule violation │
│  - Pure business logic              │
└─────────────────────────────────────┘
```

**Flow:**

1. Domain throws `SessionAlreadyStoppedError`
2. Application catches and translates to `ApplicationError('SESSION_STOPPED')`
3. Presentation catches and shows user: "This session has already ended. Please start a new one."

---

## Summary

**Domain Errors:**

- Represent **business rule violations**
- Are **explicit and type-safe**
- Live in the **domain layer**
- Are **thrown by aggregates**
- Are **caught by application layer**
- Have **clear, business-friendly names**
- Include **minimal necessary context**

**In our project:**

- `NoActiveSegmentError` - No segment to pause/stop
- `SessionAlreadyStoppedError` - Session permanently stopped
- `OverlappingSegmentError` - Segments cannot overlap
- `TooShortSegmentError` - Segment below threshold (or use event)

**Remember:** Errors are for **exceptional cases**. Normal variation in behavior should use return values or result objects.

---

## Related Documents

- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Domain Events](./domain-events.md)
- [Category Requirements](../entities/Category-requirements.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon
