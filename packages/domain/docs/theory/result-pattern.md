# Result Pattern

## What is the Result Pattern?

The **Result Pattern** is a functional programming approach to error handling that uses a return value to represent either success or failure, instead of throwing exceptions. It makes error handling **explicit** and **type-safe**.

Instead of:

```typescript
function divide(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}
```

You return a Result:

```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return failure("Division by zero");
  return success(a / b);
}
```

### Key Characteristics:

1. **Explicit** - Forces caller to handle both success and failure cases
2. **Type-Safe** - TypeScript knows what can go wrong
3. **No Exceptions** - Errors are values, not thrown
4. **Composable** - Results can be chained and transformed
5. **Functional** - Aligns with functional programming principles

---

## Result Type Definition

### Basic Structure

```typescript
type Result<T, E = Error> = Success<T> | Failure<E>;

class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(public readonly value: T) {}
}

class Failure<E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(public readonly error: E) {}
}
```

### Helper Functions

```typescript
function success<T>(value: T): Success<T> {
  return new Success(value);
}

function failure<E>(error: E): Failure<E> {
  return new Failure(error);
}
```

### Usage

```typescript
const result = divide(10, 2);

if (result.isSuccess) {
  console.log(result.value); // 5
} else {
  console.log(result.error); // string
}
```

---

## Why Use the Result Pattern?

### 1. **Explicit Error Handling**

**With Exceptions:**

```typescript
// Caller doesn't know this can fail
const value = divide(10, 0); // Throws at runtime
```

**With Result:**

```typescript
// Type system forces you to check
const result = divide(10, 0);
// Cannot access .value without checking .isSuccess
```

### 2. **Type Safety**

TypeScript knows exactly what errors can occur:

```typescript
type DivisionError = "DIVISION_BY_ZERO" | "INVALID_INPUT";

function divide(a: number, b: number): Result<number, DivisionError> {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return failure("INVALID_INPUT");
  }
  if (b === 0) {
    return failure("DIVISION_BY_ZERO");
  }
  return success(a / b);
}

const result = divide(10, 2);
if (result.isFailure) {
  // TypeScript knows error is DivisionError
  switch (result.error) {
    case "DIVISION_BY_ZERO": // ...
    case "INVALID_INPUT": // ...
  }
}
```

### 3. **No Hidden Control Flow**

Exceptions create hidden control flow - code can jump unexpectedly. Results make flow explicit.

### 4. **Easier to Test**

```typescript
it("should return failure for division by zero", () => {
  const result = divide(10, 0);

  expect(result.isFailure).toBe(true);
  expect(result.error).toBe("DIVISION_BY_ZERO");
});
```

No need for try-catch in tests!

### 5. **Composability**

Results can be chained with `.map()`, `.flatMap()`, etc.

---

## Result Pattern vs Throwing Exceptions

| Aspect              | Result Pattern              | Throwing Exceptions         |
| ------------------- | --------------------------- | --------------------------- |
| **Visibility**      | Explicit in return type     | Hidden (not in signature)   |
| **Type Safety**     | Fully type-safe             | Requires try-catch          |
| **Control Flow**    | Explicit                    | Jumps (non-local)           |
| **Forced Handling** | Yes (type system)           | No (can be ignored)         |
| **Performance**     | Faster (no stack unwinding) | Slower (exception overhead) |
| **Familiarity**     | Less common in JS/TS        | Very common                 |
| **Verbosity**       | More verbose                | More concise                |
| **Debugging**       | No stack traces             | Stack traces included       |

---

## When to Use Each Approach

### Use Result Pattern When:

✅ **Error is expected part of normal flow**

- User input validation
- Business rule checks
- Optional operations

✅ **Caller should always handle the error**

- Domain operations with business rules
- Operations with multiple failure modes

✅ **You want maximum type safety**

- API boundaries
- Critical business logic

✅ **Performance matters**

- Hot paths in code
- High-throughput operations

### Use Exceptions When:

✅ **Error is truly exceptional**

- System failures
- Programming errors
- Unrecoverable errors

✅ **You want stack traces**

- Debugging
- Logging
- Error reporting

✅ **Existing codebase uses exceptions**

- Consistency matters
- Team is familiar with try-catch

✅ **Simpler code**

- Prototyping
- Simple applications

---

## Implementing Result in TypeScript

### Basic Implementation

```typescript
// result.ts
export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly kind = "success" as const;

  constructor(public readonly value: T) {}

  isSuccess(): this is Success<T> {
    return true;
  }

  isFailure(): this is Failure<never> {
    return false;
  }
}

export class Failure<E> {
  readonly kind = "failure" as const;

  constructor(public readonly error: E) {}

  isSuccess(): this is Success<never> {
    return false;
  }

  isFailure(): this is Failure<E> {
    return true;
  }
}

// Helper constructors
export const success = <T>(value: T): Success<T> => new Success(value);
export const failure = <E>(error: E): Failure<E> => new Failure(error);
```

### With Utility Methods

```typescript
export class Success<T> {
  readonly kind = "success" as const;

  constructor(public readonly value: T) {}

  isSuccess(): this is Success<T> {
    return true;
  }
  isFailure(): this is Failure<never> {
    return false;
  }

  // Transform the value if success
  map<U>(fn: (value: T) => U): Result<U, never> {
    return success(fn(this.value));
  }

  // Chain operations that return Results
  flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  // Provide default value on failure
  unwrapOr(defaultValue: T): T {
    return this.value;
  }

  // Get value or throw
  unwrap(): T {
    return this.value;
  }
}

export class Failure<E> {
  readonly kind = "failure" as const;

  constructor(public readonly error: E) {}

  isSuccess(): this is Success<never> {
    return false;
  }
  isFailure(): this is Failure<E> {
    return true;
  }

  map<U>(fn: (value: never) => U): Result<U, E> {
    return this as any; // Stay as failure
  }

  flatMap<U, E2>(fn: (value: never) => Result<U, E2>): Result<U, E> {
    return this as any; // Stay as failure
  }

  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  unwrap(): never {
    throw new Error(`Called unwrap on Failure: ${this.error}`);
  }
}
```

---

## Result Pattern in Domain Layer

### Example: Session Aggregate

**With Exceptions (Current Approach):**

```typescript
export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): void {
    if (this._isStopped) {
      throw new SessionAlreadyStoppedError();
    }
    if (!this.hasActiveSegment()) {
      throw new NoActiveSegmentError();
    }

    // Business logic...
  }
}
```

**With Result Pattern:**

```typescript
type PauseError = { type: "SESSION_STOPPED" } | { type: "NO_ACTIVE_SEGMENT" };

export class Session extends AggregateRoot {
  pause(timeProvider: TimeProvider): Result<void, PauseError> {
    if (this._isStopped) {
      return failure({ type: "SESSION_STOPPED" });
    }
    if (!this.hasActiveSegment()) {
      return failure({ type: "NO_ACTIVE_SEGMENT" });
    }

    // Business logic...
    const activeSegment = this.getActiveSegment()!;
    activeSegment.stop(timeProvider);
    this.addEvent(new SessionPaused(this.id, timeProvider.now()));

    return success(undefined);
  }
}
```

### Usage in Application Layer

**With Result:**

```typescript
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<Result<void, string>> {
    const session = await this.sessionRepo.findById(command.sessionId);

    if (!session) {
      return failure("Session not found");
    }

    const result = session.pause(this.timeProvider);

    if (result.isFailure) {
      // Map domain error to application error
      switch (result.error.type) {
        case "SESSION_STOPPED":
          return failure("Cannot pause: session is stopped");
        case "NO_ACTIVE_SEGMENT":
          return failure("Cannot pause: no active segment");
      }
    }

    // Success path
    await this.sessionRepo.save(session);
    const events = session.pullDomainEvents();
    await this.eventPublisher.publish(events);

    return success(undefined);
  }
}
```

---

## Pattern: Railway Oriented Programming

Result pattern enables "Railway Oriented Programming" - operations can be chained, and the first failure short-circuits the chain.

### Example: Multi-Step Operation

```typescript
// Each step returns a Result
function validateInput(data: string): Result<ParsedData, "INVALID_FORMAT"> {
  // ...
}

function checkBusinessRules(
  data: ParsedData,
): Result<ValidData, "RULE_VIOLATION"> {
  // ...
}

function persist(data: ValidData): Result<SavedData, "DATABASE_ERROR"> {
  // ...
}

// Chain them together
function processData(input: string): Result<SavedData, Error> {
  return validateInput(input)
    .flatMap((parsed) => checkBusinessRules(parsed))
    .flatMap((valid) => persist(valid));
}

// If any step fails, the rest are skipped
const result = processData(userInput);
```

**Benefits:**

- Clear data flow
- Early exit on failure
- Type-safe error handling
- Composable operations

---

## Combining Result with Domain Errors

You can use both patterns together:

### Option 1: Result with DomainError

```typescript
type SessionError = NoActiveSegmentError | SessionAlreadyStoppedError;

pause(timeProvider: TimeProvider): Result<void, SessionError> {
  if (this._isStopped) {
    return failure(new SessionAlreadyStoppedError());
  }
  // ...
  return success(undefined);
}
```

### Option 2: Result with Error Discriminated Union

```typescript
type SessionError =
  | { kind: 'NoActiveSegment'; message: string }
  | { kind: 'SessionStopped'; message: string };

pause(timeProvider: TimeProvider): Result<void, SessionError> {
  if (this._isStopped) {
    return failure({
      kind: 'SessionStopped',
      message: 'session already stopped'
    });
  }
  // ...
  return success(undefined);
}
```

### Option 3: Result with Error Code Strings

```typescript
type SessionErrorCode = 'NO_ACTIVE_SEGMENT' | 'SESSION_STOPPED';

pause(timeProvider: TimeProvider): Result<void, SessionErrorCode> {
  if (this._isStopped) {
    return failure('SESSION_STOPPED');
  }
  // ...
  return success(undefined);
}
```

**Recommendation:** Option 2 (discriminated union) is most type-safe and provides good error messages.

---

## Result in Use Cases

### Pattern: Convert to Result at Boundary

Keep domain using exceptions, convert to Result at application boundary:

```typescript
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<Result<void, string>> {
    try {
      const session = await this.sessionRepo.findById(command.sessionId);

      if (!session) {
        return failure("Session not found");
      }

      // Domain throws exceptions
      session.pause(this.timeProvider);

      await this.sessionRepo.save(session);

      return success(undefined);
    } catch (error) {
      // Convert exceptions to Result
      if (error instanceof NoActiveSegmentError) {
        return failure("No active segment to pause");
      }
      if (error instanceof SessionAlreadyStoppedError) {
        return failure("Session is already stopped");
      }

      // Unknown error - rethrow
      throw error;
    }
  }
}
```

**Benefits:**

- Domain stays simple (throws exceptions)
- Application layer provides type-safe Result API
- Best of both worlds

---

## Advanced Patterns

### Pattern: Result with Multiple Error Types

```typescript
type ValidationError = { type: "validation"; field: string; message: string };
type DatabaseError = { type: "database"; code: string };
type BusinessError = { type: "business"; rule: string };

type AppError = ValidationError | DatabaseError | BusinessError;

function createUser(data: UserData): Result<User, AppError> {
  // Can return different error types
  if (!data.email) {
    return failure({ type: "validation", field: "email", message: "Required" });
  }
  // ...
}
```

### Pattern: Async Result

```typescript
type AsyncResult<T, E> = Promise<Result<T, E>>;

async function fetchUser(
  id: string,
): AsyncResult<User, "NOT_FOUND" | "NETWORK_ERROR"> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (response.status === 404) {
      return failure("NOT_FOUND");
    }
    const user = await response.json();
    return success(user);
  } catch (error) {
    return failure("NETWORK_ERROR");
  }
}

// Usage
const result = await fetchUser("123");
if (result.isSuccess) {
  console.log(result.value.name);
}
```

### Pattern: Collecting Multiple Results

```typescript
function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (result.isFailure) {
      return result; // Return first failure
    }
    values.push(result.value);
  }

  return success(values);
}

// Usage
const results = [
  validateEmail(email),
  validatePassword(password),
  validateAge(age),
];

const combined = combineResults(results);
// Either all succeed or first failure
```

---

## Testing with Result Pattern

### Test Success Case

```typescript
describe("Session.pause", () => {
  it("should return success when valid", () => {
    const session = Session.create("cat-123", timeProvider);
    timeProvider.advance(5000);

    const result = session.pause(timeProvider);

    expect(result.isSuccess).toBe(true);
  });
});
```

### Test Failure Cases

```typescript
describe("Session.pause", () => {
  it("should return failure when no active segment", () => {
    const session = Session.create("cat-123", timeProvider);
    session.stop(timeProvider);

    const result = session.pause(timeProvider);

    expect(result.isFailure).toBe(true);
    expect(result.error.type).toBe("NO_ACTIVE_SEGMENT");
  });

  it("should return failure when already stopped", () => {
    const session = Session.create("cat-123", timeProvider);
    session.stop(timeProvider);

    const result = session.pause(timeProvider);

    expect(result.isFailure).toBe(true);
    expect(result.error.type).toBe("SESSION_STOPPED");
  });
});
```

**Benefits:**

- No try-catch in tests
- Explicit success/failure checks
- Type-safe error assertions

---

## Migration Strategy

### Step 1: Introduce Result Type

Add Result type to codebase but don't use it yet.

### Step 2: Use in New Code

Use Result for all new domain methods.

### Step 3: Wrap Existing Code

Create Result-returning wrappers around exception-throwing code:

```typescript
function pauseSession(
  session: Session,
  timeProvider: TimeProvider,
): Result<void, DomainError> {
  try {
    session.pause(timeProvider); // Throws
    return success(undefined);
  } catch (error) {
    if (error instanceof DomainError) {
      return failure(error);
    }
    throw error; // Re-throw unknown errors
  }
}
```

### Step 4: Gradually Refactor

Convert exception-based code to Result-based over time.

---

## Pros and Cons

### Pros ✅

- **Type Safety** - Compiler enforces error handling
- **Explicit** - Errors are visible in signatures
- **Composable** - Easy to chain operations
- **Testable** - No try-catch needed
- **Performance** - No exception overhead
- **Functional** - Aligns with FP principles

### Cons ❌

- **Verbose** - More code than try-catch
- **Unfamiliar** - Not standard in JavaScript/TypeScript
- **No Stack Traces** - Harder to debug
- **Manual Propagation** - Must manually return failures
- **Boilerplate** - Lots of if/else checks
- **Mixed Paradigm** - JS ecosystem uses exceptions

---

## Recommendations for This Project

### Current Approach (Exceptions)

**Pros:**

- Simple and familiar
- Stack traces for debugging
- Less code
- Matches JavaScript ecosystem

**Cons:**

- Errors not visible in signatures
- Can be ignored by caller
- Harder to test

### Hybrid Approach (Recommended)

**Use Exceptions in Domain Layer:**

```typescript
// Domain throws
pause(timeProvider: TimeProvider): void {
  if (this._isStopped) {
    throw new SessionAlreadyStoppedError();
  }
  // ...
}
```

**Use Results in Application Layer:**

```typescript
// Use case returns Result
async execute(cmd): Promise<Result<void, AppError>> {
  try {
    session.pause(timeProvider);
    return success(undefined);
  } catch (e) {
    return failure(mapToAppError(e));
  }
}
```

**Benefits:**

- Domain stays simple
- Application provides type-safe API
- Best of both worlds

---

## Libraries

If you want to use Result pattern, consider these libraries:

### 1. **neverthrow**

```typescript
import { Result, ok, err } from "neverthrow";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("Division by zero");
  return ok(a / b);
}
```

### 2. **ts-results**

```typescript
import { Result, Ok, Err } from "ts-results";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err("Division by zero");
  return Ok(a / b);
}
```

### 3. **Custom Implementation**

Roll your own (shown in this document) for full control.

---

## Summary

**Result Pattern:**

- Returns success or failure as a value
- Makes errors explicit and type-safe
- Aligns with functional programming
- More verbose but safer

**Use When:**

- Errors are expected (business rules)
- Type safety is critical
- You want explicit error handling

**Avoid When:**

- Errors are truly exceptional
- You need stack traces
- Team prefers exceptions
- Prototyping/simple code

**For This Project:**

- Domain can use exceptions (simple, familiar)
- Application layer can wrap in Results (type-safe API)
- Consider full Result adoption if team prefers FP style

---

## Related Documents

- [Domain Errors](./domain-errors.md)
- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Domain Events](./domain-events.md)

---

## References

- **Functional Programming in Scala** by Chiusano and Bjarnason
- **Domain Modeling Made Functional** by Scott Wlaschin
- **Railway Oriented Programming** by Scott Wlaschin
