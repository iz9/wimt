# Error Handling Across Layers

## What is Cross-Layer Error Handling?

**Error handling** in a layered architecture requires a strategy for how errors flow from the **domain layer** through the **application layer** to the **presentation layer**, with each layer translating errors appropriately.

### Key Principle

> "Errors should be handled at the layer that can best decide what to do about them."

**The Challenge:**

```typescript
// Domain throws error
class Category {
  constructor(params: { name: string }) {
    if (!params.name) {
      throw new Error("name required"); // Generic Error
    }
  }
}

// How should UI handle this?
try {
  const category = new Category({ name: "" });
} catch (error) {
  // What type of error is this?
  // What should I show the user?
  // How do I translate it?
}
```

**The Solution:** Structured error types that flow cleanly through layers.

---

## Error Types by Layer

### 1. Domain Errors - Business Rule Violations

**Purpose:** Indicate violation of business rules or invariants.

**Characteristics:**

- Extend from `DomainError` base class
- Specific to domain concepts
- Should **not** depend on infrastructure
- Thrown by entities, value objects, domain services

**Examples:**

```typescript
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Invariant violations
export class EntityInvariantError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

// Business rule violations
export class SessionAlreadyStoppedError extends DomainError {
  constructor() {
    super("Cannot pause a session that is already stopped");
  }
}

export class NoActiveSegmentError extends DomainError {
  constructor() {
    super("Cannot pause session without an active segment");
  }
}

export class SegmentOverlapError extends DomainError {
  constructor(
    public readonly segmentId1: ULID,
    public readonly segmentId2: ULID,
  ) {
    super(`Segments ${segmentId1} and ${segmentId2} overlap`);
  }
}
```

### 2. Application Errors - Operation Failures

**Purpose:** Indicate application-level problems (not found, unauthorized, etc.).

**Characteristics:**

- Extend from `ApplicationError` base class
- Include error codes for API responses
- Include HTTP status codes
- Translatable messages

**Examples:**

```typescript
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

// Not found errors
export class NotFoundError extends ApplicationError {
  constructor(entityName: string, id: string) {
    super(`${entityName} with ID ${id} not found`, "NOT_FOUND", 404);
  }
}

export class CategoryNotFoundError extends NotFoundError {
  constructor(categoryId: ULID) {
    super("Category", categoryId);
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: ULID) {
    super("Session", sessionId);
  }
}

// Validation errors
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    public readonly errors: ValidationErrorDetail[],
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

// Conflict errors
export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class DuplicateCategoryError extends ConflictError {
  constructor(categoryName: string) {
    super(`Category "${categoryName}" already exists`);
  }
}

// Authorization errors
export class UnauthorizedError extends ApplicationError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}
```

### 3. Infrastructure Errors - Technical Failures

**Purpose:** Indicate technical/infrastructure problems.

**Examples:**

```typescript
export class InfrastructureError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "InfrastructureError";
  }
}

export class DatabaseError extends InfrastructureError {
  constructor(message: string, cause?: Error) {
    super(`Database error: ${message}`, cause);
  }
}

export class NetworkError extends InfrastructureError {
  constructor(message: string, cause?: Error) {
    super(`Network error: ${message}`, cause);
  }
}
```

---

## Error Flow Through Layers

### Domain → Application

**Domain throws business errors:**

```typescript
// Domain
class Session {
  pause(timeProvider: TimeProvider): void {
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError(); // Domain error
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError(); // Domain error
    }

    activeSegment.stop(timeProvider);
  }
}
```

**Application catches and translates:**

```typescript
// Application
@injectable()
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);

    if (!session) {
      // Application error
      throw new SessionNotFoundError(command.sessionId);
    }

    try {
      // Call domain method
      session.pause(this.timeProvider);
    } catch (error) {
      // Translate domain errors to application errors
      if (error instanceof SessionAlreadyStoppedError) {
        throw new ApplicationError(
          "Cannot pause session: session is already stopped",
          "SESSION_ALREADY_STOPPED",
          400,
        );
      }

      if (error instanceof NoActiveSegmentError) {
        throw new ApplicationError(
          "Cannot pause session: no active segment",
          "NO_ACTIVE_SEGMENT",
          400,
        );
      }

      // Unknown error, rethrow
      throw error;
    }

    await this.sessionRepo.save(session);
  }
}
```

### Application → Presentation

**Application throws structured errors:**

```typescript
// Application
async execute(command: CreateCategoryCommand): Promise<{ id: ULID }> {
  // Validation error
  const validation = this.validator.validate(command);
  if (!validation.isValid) {
    throw new ValidationError('Invalid create category command', validation.errors);
  }

  // Conflict error
  const existing = await this.categoryRepo.findByName(command.name);
  if (existing) {
    throw new DuplicateCategoryError(command.name);
  }

  // Create category
  const category = new Category({ name: command.name });
  await this.categoryRepo.save(category);

  return { id: category.id };
}
```

**Presentation catches and displays:**

```typescript
// React Native
export function CreateCategoryScreen() {
  const [error, setError] = useState<string | null>(null);
  const createCategory = useCreateCategory();

  const handleSubmit = async (data: { name: string }) => {
    try {
      await createCategory.execute({ name: data.name });
      navigation.goBack();
    } catch (error) {
      // Handle different error types
      if (error instanceof ValidationError) {
        // Show validation errors
        const messages = error.errors.map(e => e.message).join('\n');
        setError(messages);
      } else if (error instanceof DuplicateCategoryError) {
        // Show conflict error
        setError('A category with this name already exists');
      } else if (error instanceof ApplicationError) {
        // Generic application error
        setError(error.message);
      } else {
        // Unknown error
        setError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <View>
      <Form onSubmit={handleSubmit} />
      {error && <ErrorMessage message={error} />}
    </View>
  );
}
```

---

## Error Translation Patterns

### Pattern 1: Catch and Rethrow

```typescript
@injectable()
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);
    if (!session) {
      throw new SessionNotFoundError(command.sessionId);
    }

    try {
      session.pause(this.timeProvider);
    } catch (error) {
      // Translate domain errors
      if (error instanceof SessionAlreadyStoppedError) {
        throw new ApplicationError(
          "Cannot pause stopped session",
          "SESSION_STOPPED",
        );
      }

      if (error instanceof NoActiveSegmentError) {
        throw new ApplicationError(
          "No active segment to pause",
          "NO_ACTIVE_SEGMENT",
        );
      }

      // Rethrow if unknown
      throw error;
    }

    await this.sessionRepo.save(session);
  }
}
```

### Pattern 2: Error Mapper

```typescript
export class DomainErrorMapper {
  static toApplicationError(error: Error): ApplicationError {
    if (error instanceof EntityInvariantError) {
      return new ValidationError("Invalid entity", [
        { field: "entity", message: error.message },
      ]);
    }

    if (error instanceof SessionAlreadyStoppedError) {
      return new ApplicationError(
        "Session is already stopped",
        "SESSION_STOPPED",
        400,
      );
    }

    if (error instanceof NoActiveSegmentError) {
      return new ApplicationError(
        "No active segment",
        "NO_ACTIVE_SEGMENT",
        400,
      );
    }

    // Default
    return new ApplicationError("An error occurred", "UNKNOWN_ERROR", 500);
  }
}

// Usage
try {
  session.pause(timeProvider);
} catch (error) {
  throw DomainErrorMapper.toApplicationError(error);
}
```

### Pattern 3: Result Object (Alternative to Exceptions)

```typescript
// Instead of throwing, return Result
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export class PauseSessionUseCase {
  async execute(
    command: PauseSessionCommand,
  ): Promise<Result<void, ApplicationError>> {
    const session = await this.sessionRepo.findById(command.sessionId);

    if (!session) {
      return {
        success: false,
        error: new SessionNotFoundError(command.sessionId),
      };
    }

    const result = session.pause(this.timeProvider);

    if (!result.success) {
      return {
        success: false,
        error: DomainErrorMapper.toApplicationError(result.error),
      };
    }

    await this.sessionRepo.save(session);

    return { success: true, value: undefined };
  }
}

// Usage
const result = await pauseSessionUseCase.execute({ sessionId });

if (!result.success) {
  setError(result.error.message);
} else {
  showSuccess("Session paused");
}
```

---

## Error Codes and HTTP Status

### Error Code System

```typescript
export const ErrorCodes = {
  // Client errors (400-499)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DUPLICATE_CATEGORY: "DUPLICATE_CATEGORY",
  SESSION_ALREADY_STOPPED: "SESSION_ALREADY_STOPPED",
  NO_ACTIVE_SEGMENT: "NO_ACTIVE_SEGMENT",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Server errors (500-599)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
```

### HTTP Status Mapping

```typescript
export function getHttpStatus(error: Error): number {
  if (error instanceof ApplicationError) {
    return error.statusCode;
  }

  if (error instanceof EntityInvariantError) {
    return 400; // Bad Request
  }

  if (error instanceof NotFoundError) {
    return 404; // Not Found
  }

  if (error instanceof ConflictError) {
    return 409; // Conflict
  }

  if (error instanceof UnauthorizedError) {
    return 401; // Unauthorized
  }

  if (error instanceof ForbiddenError) {
    return 403; // Forbidden
  }

  // Default to 500
  return 500; // Internal Server Error
}
```

---

## User-Friendly Error Messages

### Technical vs User-Friendly

```typescript
// ❌ Technical (bad for users)
throw new Error("Null pointer exception in session.segments[0]");

// ✅ User-friendly
throw new ApplicationError(
  "Unable to pause session. Please try again.",
  "SESSION_PAUSE_FAILED",
);

// ❌ Technical
throw new Error("Foreign key constraint violation");

// ✅ User-friendly
throw new ApplicationError(
  "This category is being used by sessions and cannot be deleted",
  "CATEGORY_IN_USE",
);
```

### Error Message Guidelines

1. **Be specific but not technical**
   - ❌ "NullPointerException"
   - ✅ "Category not found"

2. **Suggest action**
   - ❌ "Invalid input"
   - ✅ "Please enter a category name between 1 and 100 characters"

3. **Be polite**
   - ❌ "You can't do that"
   - ✅ "Unable to perform this action"

4. **Avoid jargon**
   - ❌ "Session entity invariant violated"
   - ✅ "Session name is required"

### Internationalization

```typescript
export const ErrorMessages = {
  CATEGORY_NOT_FOUND: 'error.category.not_found',
  CATEGORY_ALREADY_EXISTS: 'error.category.already_exists',
  SESSION_STOPPED: 'error.session.stopped',
  VALIDATION_NAME_REQUIRED: 'error.validation.name.required'
};

// In error
throw new CategoryNotFoundError(
  i18n.t(ErrorMessages.CATEGORY_NOT_FOUND, { id: categoryId })
);

// In en.json
{
  "error": {
    "category": {
      "not_found": "Category not found",
      "already_exists": "A category with this name already exists"
    },
    "session": {
      "stopped": "Cannot pause a stopped session"
    },
    "validation": {
      "name": {
        "required": "Name is required"
      }
    }
  }
}
```

---

## Logging Errors

### What to Log

```typescript
export class CreateCategoryUseCase {
  constructor(
    private categoryRepo: ICategoryRepository,
    private logger: ILogger,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<{ id: ULID }> {
    try {
      // Log entry
      this.logger.info("Creating category", {
        categoryName: command.name,
      });

      const category = new Category({ name: command.name });
      await this.categoryRepo.save(category);

      // Log success
      this.logger.info("Category created", {
        categoryId: category.id,
        categoryName: category.name,
      });

      return { id: category.id };
    } catch (error) {
      // Log error with context
      this.logger.error("Failed to create category", {
        categoryName: command.name,
        error: error.message,
        stack: error.stack,
      });

      // Rethrow
      throw error;
    }
  }
}
```

### Log Levels

```typescript
export interface ILogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
}

// Usage
logger.debug("Validating command", { command }); // Development
logger.info("Category created", { categoryId }); // Production
logger.warn("Category name too long", { length }); // Warnings
logger.error("Failed to save category", { error }); // Errors
```

### Structured Logging

```typescript
this.logger.error("Operation failed", {
  operation: "CreateCategory",
  userId: user.id,
  categoryName: command.name,
  error: {
    name: error.name,
    message: error.message,
    code: error instanceof ApplicationError ? error.code : undefined,
    stack: error.stack,
  },
  timestamp: Date.now(),
});
```

---

## Global Error Handler

### React Native Error Boundary

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service
    logger.error('React error boundary caught error', {
      error: error.message,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Button
            title="Try Again"
            onPress={() => this.setState({ hasError: false, error: null })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

// Usage
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
```

### Global Async Error Handler

```typescript
// Setup global promise rejection handler
const setupGlobalErrorHandlers = () => {
  // Catch unhandled promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    logger.error("Unhandled promise rejection", {
      reason: event.reason,
      promise: event.promise,
    });

    // Show user-friendly message
    Alert.alert("Error", "An unexpected error occurred. Please try again.", [
      { text: "OK" },
    ]);
  };

  window.addEventListener("unhandledrejection", handleUnhandledRejection);
};
```

---

## Testing Error Handling

### Test Domain Errors

```typescript
describe("Session pause", () => {
  it("should throw SessionAlreadyStoppedError when session is stopped", () => {
    const session = createStoppedSession();

    expect(() => session.pause(mockTimeProvider)).toThrow(
      SessionAlreadyStoppedError,
    );
  });

  it("should throw NoActiveSegmentError when no active segment", () => {
    const session = createSessionWithoutActiveSegment();

    expect(() => session.pause(mockTimeProvider)).toThrow(NoActiveSegmentError);
  });
});
```

### Test Application Error Translation

```typescript
describe("PauseSessionUseCase", () => {
  it("should throw SessionNotFoundError if session does not exist", async () => {
    const useCase = new PauseSessionUseCase(emptyRepo, timeProvider);

    await expect(
      useCase.execute({ sessionId: "non-existent" }),
    ).rejects.toThrow(SessionNotFoundError);
  });

  it("should translate SessionAlreadyStoppedError to ApplicationError", async () => {
    const stoppedSession = createStoppedSession();
    await sessionRepo.save(stoppedSession);

    const useCase = new PauseSessionUseCase(sessionRepo, timeProvider);

    await expect(
      useCase.execute({ sessionId: stoppedSession.id }),
    ).rejects.toThrow(ApplicationError);
  });
});
```

### Test Error Response

```typescript
describe('CreateCategoryScreen', () => {
  it('should display error when category creation fails', async () => {
    const mockCreateCategory = jest.fn().mockRejectedValue(
      new DuplicateCategoryError('Work')
    );

    const { getByText, getByPlaceholderText } = render(
      <CreateCategoryScreen createCategory={mockCreateCategory} />
    );

    fireEvent.changeText(getByPlaceholderText('Category name'), 'Work');
    fireEvent.press(getByText('Create'));

    await waitFor(() => {
      expect(getByText('A category with this name already exists')).toBeTruthy();
    });
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Use specific error types**

```typescript
// ✅ Good - Specific
throw new SessionAlreadyStoppedError();
throw new CategoryNotFoundError(id);

// ❌ Bad - Generic
throw new Error("Session stopped");
throw new Error("Not found");
```

**2. Include context in errors**

```typescript
// ✅ Good - Context
throw new SegmentOverlapError(segment1.id, segment2.id);

// ❌ Bad - No context
throw new Error("Segments overlap");
```

**3. Log before rethrowing**

```typescript
// ✅ Good
try {
  await this.repo.save(category);
} catch (error) {
  this.logger.error("Failed to save category", {
    categoryId: category.id,
    error,
  });
  throw error;
}
```

**4. Translate errors between layers**

```typescript
// ✅ Good - Translate
catch (error) {
  if (error instanceof EntityInvariantError) {
    throw new ValidationError(...);
  }
}

// ❌ Bad - Leak domain errors to UI
catch (error) {
  throw error; // UI gets EntityInvariantError!
}
```

### ❌ DON'T:

**1. Don't swallow errors**

```typescript
// ❌ Bad - Error disappeared!
try {
  await doSomething();
} catch (error) {
  // Nothing here
}

// ✅ Good - At least log it
try {
  await doSomething();
} catch (error) {
  logger.error("Operation failed", { error });
  throw error;
}
```

**2. Don't expose technical details**

```typescript
// ❌ Bad - Technical
throw new Error("SQLite error: FOREIGN_KEY_CONSTRAINT");

// ✅ Good - User-friendly
throw new ApplicationError(
  "This category is being used and cannot be deleted",
  "CATEGORY_IN_USE",
);
```

**3. Don't use error codes as strings everywhere**

```typescript
// ❌ Bad - Magic strings
throw new ApplicationError("...", "CATEGORY_NOT_FOUND");
throw new ApplicationError("...", "category_not_found"); // Inconsistent!

// ✅ Good - Constants
throw new ApplicationError("...", ErrorCodes.CATEGORY_NOT_FOUND);
```

---

## Summary

**Error Types:**

- **Domain Errors:** Business rule violations (EntityInvariantError)
- **Application Errors:** Operation failures (NotFoundError, ValidationError)
- **Infrastructure Errors:** Technical failures (DatabaseError)

**Error Flow:**

```
Domain → Application → Presentation
  ↓          ↓              ↓
Throw    Translate      Display
```

**Translation:**

- Catch domain errors in application layer
- Translate to application errors
- Include error codes and HTTP status
- Log with context

**User Experience:**

- User-friendly messages
- Specific and actionable
- Internationalized
- Consistent formatting

**In Our Project:**

- `EntityInvariantError` - Domain invariants
- `SessionAlreadyStoppedError` - Business rules
- `CategoryNotFoundError` - Application errors
- Error boundaries in React Native

**Key Principle:** Each layer handles what it knows about. Domain protects business rules, application coordinates, presentation shows user-friendly messages.

---

## Related Documents

- [Domain Errors](./domain-errors.md)
- [Invariants](./invariants.md)
- [Validation Strategies](./validation-strategies.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Clean Architecture** by Robert C. Martin
- **Release It!** by Michael T. Nygard (Chapter 5: Stability Patterns)
