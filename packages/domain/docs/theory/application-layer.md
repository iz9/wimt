# Application Layer (Use Cases)

## What is the Application Layer?

The **Application Layer** sits between the **Domain Layer** (business logic) and **Presentation Layer** (UI). It orchestrates the flow of data and coordinates domain objects to accomplish user tasks.

Think of it as a **conductor** - it doesn't contain business logic itself, but it coordinates the domain objects that do.

### Key Principle

> "The application layer is thin. It does not contain business rules or knowledge, but only coordinates tasks and delegates work to domain objects."

---

## Application Layer vs Domain Layer

| Aspect         | Domain Layer            | Application Layer       |
| -------------- | ----------------------- | ----------------------- |
| **Purpose**    | Business logic          | Workflow orchestration  |
| **Contains**   | Rules, invariants       | Use cases, commands     |
| **Example**    | `Category.changeName()` | `RenameCategoryUseCase` |
| **State**      | Domain state            | No state (stateless)    |
| **Depends on** | Nothing                 | Domain + Infrastructure |
| **Called by**  | Application layer       | Presentation layer      |

**Simple Rule:** If it's a **business rule**, it's domain. If it's **coordination**, it's application.

---

## Use Cases (Application Services)

A **Use Case** represents a **single user task** or **system operation**. Each use case is a class that orchestrates domain objects.

### Anatomy of a Use Case

```typescript
export class CreateCategoryUseCase {
  constructor(
    private categoryRepo: ICategoryRepository, // Infrastructure
    private eventPublisher: IEventPublisher, // Infrastructure
  ) {}

  async execute(command: CreateCategoryCommand): Promise<CreateCategoryResult> {
    // 1. Validate command (application-level validation)
    this.validateCommand(command);

    // 2. Create domain object (business logic in domain)
    const category = new Category({ name: command.name });

    // 3. Persist
    await this.categoryRepo.save(category);

    // 4. Publish domain events
    const events = category.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    // 5. Return result (DTO)
    return {
      categoryId: category.id,
      name: category.name,
    };
  }

  private validateCommand(command: CreateCategoryCommand): void {
    if (!command.name) {
      throw new ApplicationError("Name is required");
    }
  }
}
```

### Use Case Pattern

**Every use case follows this pattern:**

1. **Receive command** - Input data from presentation
2. **Validate** - Application-level validation
3. **Load domain objects** - From repositories
4. **Execute business logic** - Call domain methods
5. **Persist changes** - Save to repositories
6. **Publish events** - Dispatch domain events
7. **Return result** - DTO back to presentation

---

## Commands

**Commands** are **immutable data structures** that represent **user intent**.

### Command Structure

```typescript
// Command - What the user wants to do
export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}

export interface RenameCategoryCommand {
  readonly categoryId: ULID;
  readonly newName: string;
}

export interface PauseSessionCommand {
  readonly sessionId: ULID;
}
```

### Command Naming

**Good Names ✅**

- `CreateCategoryCommand` - Verb + Noun
- `StartSessionCommand`
- `PauseSessionCommand`
- `ExportSessionCommand`

**Bad Names ❌**

- `CategoryCommand` - Too vague
- `Category` - Not a command
- `CreateCommand` - What are we creating?

### Command Validation

```typescript
export class CreateCategoryCommandValidator {
  validate(command: CreateCategoryCommand): ValidationResult {
    const errors: string[] = [];

    // Application-level validation
    if (!command.name) {
      errors.push("Name is required");
    }

    if (command.name && command.name.length > 100) {
      errors.push("Name too long");
    }

    if (command.color && !this.isValidColor(command.color)) {
      errors.push("Invalid color format");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
  }
}
```

---

## Use Cases in Our Project

### Example 1: Create Category Use Case

```typescript
// packages/application/src/useCases/category/CreateCategoryUseCase.ts

export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}

export interface CreateCategoryResult {
  readonly categoryId: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
}

@injectable()
export class CreateCategoryUseCase {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,

    @inject(TYPES.IEventPublisher)
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<CreateCategoryResult> {
    // 1. Create domain object
    const category = new Category({ name: command.name });

    // 2. Set optional properties
    if (command.color) {
      category.setColor({ color: command.color });
    }

    if (command.icon) {
      category.setIcon({ icon: command.icon });
    }

    // 3. Persist
    await this.categoryRepo.save(category);

    // 4. Publish events
    const events = category.pullDomainEvents();
    await this.publishEvents(events);

    // 5. Return result
    return {
      categoryId: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
    };
  }

  private async publishEvents(events: AbstractDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
```

### Example 2: Rename Category Use Case

```typescript
export interface RenameCategoryCommand {
  readonly categoryId: ULID;
  readonly newName: string;
}

@injectable()
export class RenameCategoryUseCase {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,
  ) {}

  async execute(command: RenameCategoryCommand): Promise<void> {
    // 1. Load aggregate
    const category = await this.categoryRepo.findById(command.categoryId);

    if (!category) {
      throw new CategoryNotFoundError(command.categoryId);
    }

    // 2. Execute domain logic
    category.changeName({ name: command.newName });

    // 3. Persist
    await this.categoryRepo.save(category);
  }
}
```

### Example 3: Pause Session Use Case

```typescript
export interface PauseSessionCommand {
  readonly sessionId: ULID;
}

@injectable()
export class PauseSessionUseCase {
  constructor(
    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,

    @inject(TYPES.ITimeProvider)
    private timeProvider: TimeProvider,

    @inject(TYPES.IEventPublisher)
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: PauseSessionCommand): Promise<void> {
    // 1. Load aggregate
    const session = await this.sessionRepo.findById(command.sessionId);

    if (!session) {
      throw new SessionNotFoundError(command.sessionId);
    }

    // 2. Execute domain logic (may throw domain errors)
    try {
      session.pause(this.timeProvider);
    } catch (error) {
      if (error instanceof NoActiveSegmentError) {
        throw new ApplicationError(
          "Cannot pause session without active segment",
        );
      }
      if (error instanceof SessionAlreadyStoppedError) {
        throw new ApplicationError("Cannot pause stopped session");
      }
      throw error;
    }

    // 3. Persist
    await this.sessionRepo.save(session);

    // 4. Publish events
    const events = session.pullDomainEvents();
    await this.publishEvents(events);
  }

  private async publishEvents(events: AbstractDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
```

### Example 4: Start Session Use Case

```typescript
export interface StartSessionCommand {
  readonly categoryId: ULID;
}

export interface StartSessionResult {
  readonly sessionId: ULID;
  readonly categoryId: ULID;
  readonly startTime: DateTime;
}

@injectable()
export class StartSessionUseCase {
  constructor(
    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,

    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,

    @inject(TYPES.ITimeProvider)
    private timeProvider: TimeProvider,

    @inject(TYPES.IEventPublisher)
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: StartSessionCommand): Promise<StartSessionResult> {
    // 1. Verify category exists (application-level check)
    const category = await this.categoryRepo.findById(command.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(command.categoryId);
    }

    // 2. Create session (domain logic)
    const session = Session.create(command.categoryId, this.timeProvider);

    // 3. Persist
    await this.sessionRepo.save(session);

    // 4. Publish events
    const events = session.pullDomainEvents();
    await this.publishEvents(events);

    // 5. Return result
    return {
      sessionId: session.id,
      categoryId: session.getCategoryId(),
      startTime: session.getStartTime(),
    };
  }

  private async publishEvents(events: AbstractDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
```

---

## Queries

**Queries** read data without changing state. They return **DTOs** (Data Transfer Objects).

### Query Structure

```typescript
export interface GetCategoryQuery {
  readonly categoryId: ULID;
}

export interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
  readonly createdAt: DateTime;
}

@injectable()
export class GetCategoryQueryHandler {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,
  ) {}

  async execute(query: GetCategoryQuery): Promise<CategoryDTO | null> {
    const category = await this.categoryRepo.findById(query.categoryId);

    if (!category) {
      return null;
    }

    return this.toDTO(category);
  }

  private toDTO(category: Category): CategoryDTO {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt,
    };
  }
}
```

### List Query Example

```typescript
export interface ListCategoriesQuery {
  // Optional filters/pagination
}

export interface ListCategoriesResult {
  readonly categories: CategoryDTO[];
  readonly total: number;
}

@injectable()
export class ListCategoriesQueryHandler {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,
  ) {}

  async execute(query: ListCategoriesQuery): Promise<ListCategoriesResult> {
    const categories = await this.categoryRepo.findAll();

    return {
      categories: categories.map((c) => this.toDTO(c)),
      total: categories.length,
    };
  }

  private toDTO(category: Category): CategoryDTO {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt,
    };
  }
}
```

### Statistics Query Example

```typescript
export interface GetCategoryStatisticsQuery {
  readonly categoryId: ULID;
}

export interface CategoryStatisticsDTO {
  readonly categoryId: ULID;
  readonly totalDuration: number; // milliseconds
  readonly sessionCount: number;
  readonly averageDuration: number;
  readonly lastSessionDate: DateTime | null;
}

@injectable()
export class GetCategoryStatisticsQueryHandler {
  constructor(
    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,

    @inject(TYPES.CategoryStatisticsCalculator)
    private statsCalculator: CategoryStatisticsCalculator,
  ) {}

  async execute(
    query: GetCategoryStatisticsQuery,
  ): Promise<CategoryStatisticsDTO> {
    // 1. Load data
    const sessions = await this.sessionRepo.findByCategory(query.categoryId);

    // 2. Use domain service to calculate
    const stats = this.statsCalculator.calculate(query.categoryId, sessions);

    // 3. Convert to DTO
    return {
      categoryId: stats.categoryId,
      totalDuration: stats.totalDuration.toMilliseconds(),
      sessionCount: stats.sessionCount,
      averageDuration: stats.averageDuration.toMilliseconds(),
      lastSessionDate: stats.lastSessionDate,
    };
  }
}
```

---

## Commands vs Queries (CQRS Light)

### Command-Query Separation

| Command                          | Query                     |
| -------------------------------- | ------------------------- |
| **Changes state**                | **Reads state**           |
| **Returns void** (or simple ack) | **Returns data**          |
| **Can fail**                     | **Should always succeed** |
| **May emit events**              | **No events**             |
| Example: `CreateCategory`        | Example: `GetCategory`    |

### Why Separate?

**Benefits:**

- Clear intent (reading vs writing)
- Different optimization strategies
- Easier to test
- Better caching for queries
- Eventual consistency possible

**Example:**

```typescript
// Command - Changes state
await createCategoryUseCase.execute({ name: "Work" });

// Query - Reads state
const category = await getCategoryQuery.execute({ categoryId: "cat-123" });
```

---

## Application Errors

Application layer has its own errors, distinct from domain errors.

### Application Error Types

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

export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}
```

### Error Handling Pattern

```typescript
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    // Load aggregate
    const session = await this.sessionRepo.findById(command.sessionId);
    if (!session) {
      throw new SessionNotFoundError(command.sessionId); // Application error
    }

    // Execute domain logic
    try {
      session.pause(this.timeProvider);
    } catch (error) {
      // Translate domain errors to application errors
      if (error instanceof NoActiveSegmentError) {
        throw new ApplicationError(
          "Cannot pause session without active segment",
          "NO_ACTIVE_SEGMENT",
        );
      }
      throw error; // Unknown error, rethrow
    }

    await this.sessionRepo.save(session);
  }
}
```

---

## Transaction Boundaries

Use cases define **transaction boundaries** - each use case is one transaction.

### Pattern: Transaction per Use Case

```typescript
export class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand): Promise<CreateCategoryResult> {
    // START TRANSACTION (implicit or explicit)

    try {
      // All operations in one transaction
      const category = new Category({ name: command.name });
      await this.categoryRepo.save(category);

      const events = category.pullDomainEvents();
      await this.publishEvents(events);

      // COMMIT
      return { categoryId: category.id, name: category.name };
    } catch (error) {
      // ROLLBACK
      throw error;
    }
  }
}
```

### Unit of Work (Advanced)

```typescript
@injectable()
export class TransferSessionToCategoryUseCase {
  constructor(
    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,

    @inject(TYPES.IUnitOfWork)
    private unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: TransferSessionCommand): Promise<void> {
    // Start unit of work
    await this.unitOfWork.begin();

    try {
      // Load and modify multiple aggregates
      const session = await this.sessionRepo.findById(command.sessionId);
      if (!session) throw new SessionNotFoundError(command.sessionId);

      session.changeCategory(command.newCategoryId);
      this.unitOfWork.registerDirty(session);

      // Commit everything atomically
      await this.unitOfWork.commit();
    } catch (error) {
      await this.unitOfWork.rollback();
      throw error;
    }
  }
}
```

---

## DTOs (Data Transfer Objects)

DTOs are **simple data structures** for transferring data between layers.

### Why DTOs?

**Without DTOs:**

```typescript
// ❌ Bad - Exposing domain object to presentation
export class GetCategoryQuery {
  async execute(): Promise<Category> {
    return await this.categoryRepo.findById(id); // Domain object!
  }
}

// UI can now call domain methods - dangerous!
const category = await getCategoryQuery.execute();
category.changeName({ name: "Hacked!" }); // Should not be possible!
```

**With DTOs:**

```typescript
// ✅ Good - Plain data
export interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
}

export class GetCategoryQuery {
  async execute(): Promise<CategoryDTO> {
    const category = await this.categoryRepo.findById(id);
    return this.toDTO(category); // Convert to DTO
  }
}

// UI gets plain data - no methods
const categoryData = await getCategoryQuery.execute();
// categoryData.changeName() - doesn't exist!
```

### DTO Patterns

**Simple DTO:**

```typescript
export interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
  readonly createdAt: DateTime;
}
```

**Nested DTO:**

```typescript
export interface SessionDTO {
  readonly id: ULID;
  readonly category: CategoryDTO; // Nested
  readonly segments: SegmentDTO[];
  readonly totalDuration: number;
  readonly isActive: boolean;
}

export interface SegmentDTO {
  readonly id: ULID;
  readonly startedAt: DateTime;
  readonly stoppedAt: DateTime | null;
  readonly duration: number | null;
}
```

**List DTO:**

```typescript
export interface CategoriesListDTO {
  readonly items: CategoryDTO[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
```

---

## File Structure

```
packages/
├── domain/               # Domain layer (no dependencies)
│   ├── entities/
│   ├── valueObjects/
│   ├── services/
│   └── repositories/     # Interfaces only
│
├── application/          # Application layer (depends on domain)
│   ├── useCases/
│   │   ├── category/
│   │   │   ├── CreateCategoryUseCase.ts
│   │   │   ├── RenameCategoryUseCase.ts
│   │   │   └── DeleteCategoryUseCase.ts
│   │   └── session/
│   │       ├── StartSessionUseCase.ts
│   │       ├── PauseSessionUseCase.ts
│   │       └── StopSessionUseCase.ts
│   ├── queries/
│   │   ├── GetCategoryQuery.ts
│   │   ├── ListCategoriesQuery.ts
│   │   └── GetCategoryStatisticsQuery.ts
│   ├── commands/
│   │   ├── CreateCategoryCommand.ts
│   │   └── StartSessionCommand.ts
│   ├── dtos/
│   │   ├── CategoryDTO.ts
│   │   └── SessionDTO.ts
│   └── errors/
│       └── ApplicationErrors.ts
│
└── infrastructure/       # Infrastructure (implements repositories)
    └── persistence/
```

---

## Testing Use Cases

### Test Structure

```typescript
describe("CreateCategoryUseCase", () => {
  let useCase: CreateCategoryUseCase;
  let categoryRepo: InMemoryCategoryRepository;
  let eventPublisher: MockEventPublisher;

  beforeEach(() => {
    categoryRepo = new InMemoryCategoryRepository();
    eventPublisher = new MockEventPublisher();
    useCase = new CreateCategoryUseCase(categoryRepo, eventPublisher);
  });

  it("should create category with valid data", async () => {
    const command: CreateCategoryCommand = {
      name: "Work",
      color: "#FF0000",
      icon: "work-icon",
    };

    const result = await useCase.execute(command);

    expect(result.categoryId).toBeDefined();
    expect(result.name).toBe("Work");
    expect(result.color).toBe("#FF0000");
  });

  it("should persist category to repository", async () => {
    const command: CreateCategoryCommand = { name: "Work" };

    const result = await useCase.execute(command);

    const saved = await categoryRepo.findById(result.categoryId);
    expect(saved).toBeDefined();
    expect(saved!.name).toBe("Work");
  });

  it("should publish domain events", async () => {
    const command: CreateCategoryCommand = { name: "Work" };

    await useCase.execute(command);

    expect(eventPublisher.publishedEvents).toHaveLength(1);
    expect(eventPublisher.publishedEvents[0].type).toBe("CategoryCreated");
  });
});
```

### Mock Event Publisher

```typescript
export class MockEventPublisher implements IEventPublisher {
  public publishedEvents: AbstractDomainEvent[] = [];

  async publish(event: AbstractDomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  reset(): void {
    this.publishedEvents = [];
  }
}
```

---

## Best Practices

### ✅ DO:

**1. Keep use cases thin**

```typescript
// ✅ Good - Orchestration only
export class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name }); // Domain
    await this.categoryRepo.save(category); // Infrastructure
  }
}
```

**2. One use case per user action**

```typescript
// ✅ Good - Focused
CreateCategoryUseCase;
RenameCategoryUseCase;
DeleteCategoryUseCase;

// ❌ Bad - Too broad
CategoryManagementUseCase; // Does everything
```

**3. Return DTOs from queries**

```typescript
// ✅ Good
async execute(): Promise<CategoryDTO> {
  const category = await this.repo.findById(id);
  return this.toDTO(category);
}
```

**4. Handle domain errors**

```typescript
// ✅ Good - Translate domain errors
try {
  session.pause(timeProvider);
} catch (error) {
  if (error instanceof NoActiveSegmentError) {
    throw new ApplicationError("Cannot pause");
  }
  throw error;
}
```

### ❌ DON'T:

**1. Don't put business logic in use cases**

```typescript
// ❌ Bad - Business logic in use case
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);

    // ❌ Business logic here!
    if (session.isStopped) {
      throw new Error("Already stopped");
    }

    const segment = session.getActiveSegment();
    segment.stop(this.timeProvider);
  }
}

// ✅ Good - Business logic in domain
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);
    session.pause(this.timeProvider); // Domain handles it!
    await this.sessionRepo.save(session);
  }
}
```

**2. Don't return domain objects**

```typescript
// ❌ Bad
async execute(): Promise<Category> {
  return await this.categoryRepo.findById(id);
}

// ✅ Good
async execute(): Promise<CategoryDTO> {
  const category = await this.categoryRepo.findById(id);
  return this.toDTO(category);
}
```

**3. Don't have stateful use cases**

```typescript
// ❌ Bad - Stateful
export class CreateCategoryUseCase {
  private lastCreated: Category; // ❌ State!
}

// ✅ Good - Stateless
export class CreateCategoryUseCase {
  // No instance state
}
```

---

## Summary

**Application Layer:**

- **Orchestrates** domain objects
- **Coordinates** workflow
- **No business logic** (that's domain)
- **Stateless** services

**Use Cases:**

- One per user action
- Commands change state
- Queries read state
- Return DTOs, not domain objects

**Pattern:**

1. Receive command
2. Validate (application level)
3. Load from repository
4. Call domain methods
5. Save to repository
6. Publish events
7. Return DTO

**In Our Project:**

- `CreateCategoryUseCase`
- `StartSessionUseCase`
- `PauseSessionUseCase`
- `GetCategoryStatisticsQuery`

**Key Principle:** Application layer is the **glue** that connects presentation, domain, and infrastructure while keeping them decoupled.

---

## Related Documents

- [Domain Services](./domain-services.md)
- [Repositories](./repositories.md)
- [Clean Architecture Layers](./clean-architecture-layers.md)

---

## References

- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 14: Application)
- **Clean Architecture** by Robert C. Martin
- **Domain-Driven Design** by Eric Evans
