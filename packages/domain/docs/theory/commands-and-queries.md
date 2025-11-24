# Commands and Queries (CQRS)

## What is CQRS?

**CQRS** stands for **Command Query Responsibility Segregation**. It's a pattern that separates **read operations** (queries) from **write operations** (commands) by using different models for each.

### The Core Principle

> "A method should either change state (command) or return data (query), but never both."

This is known as **Command-Query Separation (CQS)**, coined by Bertrand Meyer.

**Simple Example:**

```typescript
// ❌ Violates CQS - both changes state AND returns data
function incrementAndGet(counter: number): number {
  counter++; // Changes state
  return counter; // Returns data
}

// ✅ Follows CQS - Separate operations
function increment(counter: number): void {
  counter++; // Command - changes state, returns nothing
}

function getCounter(): number {
  return counter; // Query - returns data, changes nothing
}
```

---

## Commands vs Queries

| Aspect           | Command                          | Query                 |
| ---------------- | -------------------------------- | --------------------- |
| **Purpose**      | Change state                     | Read state            |
| **Returns**      | void or acknowledgment           | Data (DTO)            |
| **Side Effects** | Yes (that's the point!)          | No (read-only)        |
| **Can Fail**     | Yes (validation, business rules) | Should always succeed |
| **Cached**       | No                               | Yes (safe to cache)   |
| **Idempotent**   | Maybe                            | Yes                   |
| **Example**      | `CreateCategory`                 | `GetCategory`         |

---

## Commands

### What is a Command?

A **Command** represents an **intention to change the system state**. It's a request to do something.

**Characteristics:**

- Named with **imperative verbs** (CreateCategory, StartSession, PauseSession)
- Contains **all data needed** for the operation
- **Immutable** - cannot be changed after creation
- **Returns void** or simple acknowledgment (not domain data)
- **Can be rejected** (validation failures, business rule violations)

### Command Structure

```typescript
// Command is a simple DTO
export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}

export interface StartSessionCommand {
  readonly categoryId: ULID;
}

export interface PauseSessionCommand {
  readonly sessionId: ULID;
}

export interface RenameCategoryCommand {
  readonly categoryId: ULID;
  readonly newName: string;
}
```

### Command Naming Conventions

**Good Names ✅**

- `CreateCategoryCommand` - Verb + Noun + "Command"
- `StartSessionCommand`
- `PauseSessionCommand`
- `UpdateCategoryColorCommand`
- `DeleteCategoryCommand`

**Bad Names ❌**

- `Category` - Not a command
- `CategoryCommand` - What about category?
- `CreateCommand` - Create what?
- `SessionPause` - Not imperative

### Command Handler (Use Case)

```typescript
@injectable()
export class CreateCategoryCommandHandler {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,

    @inject(TYPES.IEventPublisher)
    private eventPublisher: IEventPublisher,
  ) {}

  async handle(command: CreateCategoryCommand): Promise<void> {
    // 1. Create domain object
    const category = new Category({ name: command.name });

    if (command.color) {
      category.setColor({ color: command.color });
    }

    if (command.icon) {
      category.setIcon({ icon: command.icon });
    }

    // 2. Persist
    await this.categoryRepo.save(category);

    // 3. Publish events
    const events = category.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    // 4. Return void (or simple ack)
    // Command doesn't return domain data!
  }
}
```

### Command Return Values

**Option 1: Return Void (Pure CQRS)**

```typescript
async handle(command: CreateCategoryCommand): Promise<void> {
  const category = new Category({ name: command.name });
  await this.categoryRepo.save(category);
  // Return nothing
}
```

**Option 2: Return ID (Practical)**

```typescript
async handle(command: CreateCategoryCommand): Promise<{ categoryId: ULID }> {
  const category = new Category({ name: command.name });
  await this.categoryRepo.save(category);

  // Return just the ID so client can query for it
  return { categoryId: category.id };
}
```

**Option 3: Return Success/Failure (Event Sourcing)**

```typescript
type CommandResult =
  | { success: true; id: ULID }
  | { success: false; error: string };

async handle(command: CreateCategoryCommand): Promise<CommandResult> {
  try {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);
    return { success: true, id: category.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Recommendation:** Option 2 for most cases - return ID so UI can query for fresh data.

---

## Queries

### What is a Query?

A **Query** represents a **request for data** without changing system state.

**Characteristics:**

- Named with **question words** (Get, Find, List, Count)
- **Returns data** (DTOs)
- **No side effects** - doesn't change state
- **Should always succeed** (return null/empty if not found)
- **Cacheable** - safe to cache results
- **Idempotent** - calling multiple times gives same result

### Query Structure

```typescript
// Query input
export interface GetCategoryQuery {
  readonly categoryId: ULID;
}

export interface ListCategoriesQuery {
  // Optional: filters, pagination
  readonly searchTerm?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface GetCategoryStatisticsQuery {
  readonly categoryId: ULID;
  readonly startDate?: DateTime;
  readonly endDate?: DateTime;
}

// Query output (DTO)
export interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
  readonly createdAt: DateTime;
}

export interface CategoryStatisticsDTO {
  readonly categoryId: ULID;
  readonly totalDuration: number;
  readonly sessionCount: number;
  readonly averageDuration: number;
  readonly lastSessionDate: DateTime | null;
}
```

### Query Naming Conventions

**Good Names ✅**

- `GetCategoryQuery` - Get single item
- `ListCategoriesQuery` - Get multiple items
- `FindActiveSessions` - Find with condition
- `CountSessionsByCategory` - Aggregate
- `GetCategoryStatistics` - Calculated data

**Bad Names ❌**

- `Category` - Not a query
- `CategoryQuery` - Too vague
- `FetchCategory` - Use "Get"
- `CategoryData` - Use "Query" suffix

### Query Handler

```typescript
@injectable()
export class GetCategoryQueryHandler {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,
  ) {}

  async handle(query: GetCategoryQuery): Promise<CategoryDTO | null> {
    // 1. Load from repository
    const category = await this.categoryRepo.findById(query.categoryId);

    // 2. Return null if not found
    if (!category) {
      return null;
    }

    // 3. Convert to DTO
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

### List Query Handler

```typescript
@injectable()
export class ListCategoriesQueryHandler {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,
  ) {}

  async handle(query: ListCategoriesQuery): Promise<CategoryDTO[]> {
    // 1. Load all categories
    let categories = await this.categoryRepo.findAll();

    // 2. Apply filters
    if (query.searchTerm) {
      categories = categories.filter((c) =>
        c.name.toLowerCase().includes(query.searchTerm!.toLowerCase()),
      );
    }

    // 3. Apply pagination
    if (query.page && query.pageSize) {
      const start = (query.page - 1) * query.pageSize;
      const end = start + query.pageSize;
      categories = categories.slice(start, end);
    }

    // 4. Convert to DTOs
    return categories.map((c) => this.toDTO(c));
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

### Statistics Query Handler

```typescript
@injectable()
export class GetCategoryStatisticsQueryHandler {
  constructor(
    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,

    @inject(TYPES.CategoryStatisticsCalculator)
    private calculator: CategoryStatisticsCalculator,
  ) {}

  async handle(
    query: GetCategoryStatisticsQuery,
  ): Promise<CategoryStatisticsDTO> {
    // 1. Load sessions
    let sessions = await this.sessionRepo.findByCategory(query.categoryId);

    // 2. Apply date filters
    if (query.startDate && query.endDate) {
      sessions = sessions.filter((s) => {
        const startTime = s.getStartTime();
        return startTime >= query.startDate! && startTime <= query.endDate!;
      });
    }

    // 3. Calculate statistics (domain service)
    const stats = this.calculator.calculate(query.categoryId, sessions);

    // 4. Convert to DTO
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

## Commands and Queries in Our Project

### Category Commands

```typescript
// Create
export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}

// Rename
export interface RenameCategoryCommand {
  readonly categoryId: ULID;
  readonly newName: string;
}

// Update color
export interface UpdateCategoryColorCommand {
  readonly categoryId: ULID;
  readonly color: string | null;
}

// Update icon
export interface UpdateCategoryIconCommand {
  readonly categoryId: ULID;
  readonly icon: string | null;
}

// Delete
export interface DeleteCategoryCommand {
  readonly categoryId: ULID;
}
```

### Category Queries

```typescript
// Get single
export interface GetCategoryQuery {
  readonly categoryId: ULID;
}

// List all
export interface ListCategoriesQuery {
  readonly searchTerm?: string;
  readonly includeArchived?: boolean;
}

// Get statistics
export interface GetCategoryStatisticsQuery {
  readonly categoryId: ULID;
  readonly startDate?: DateTime;
  readonly endDate?: DateTime;
}
```

### Session Commands

```typescript
// Start
export interface StartSessionCommand {
  readonly categoryId: ULID;
}

// Pause
export interface PauseSessionCommand {
  readonly sessionId: ULID;
}

// Resume
export interface ResumeSessionCommand {
  readonly sessionId: ULID;
}

// Stop
export interface StopSessionCommand {
  readonly sessionId: ULID;
}

// Export
export interface ExportSessionCommand {
  readonly sessionId: ULID;
  readonly format: "markdown" | "json" | "csv";
}
```

### Session Queries

```typescript
// Get single
export interface GetSessionQuery {
  readonly sessionId: ULID;
}

// List by category
export interface ListSessionsByCategoryQuery {
  readonly categoryId: ULID;
  readonly limit?: number;
}

// List active
export interface ListActiveSessionsQuery {
  // No parameters - get all active
}

// List in date range
export interface ListSessionsInRangeQuery {
  readonly startDate: DateTime;
  readonly endDate: DateTime;
  readonly categoryId?: ULID;
}

// Get current active session
export interface GetCurrentSessionQuery {
  // Returns the currently running session, if any
}
```

---

## CQRS Benefits

### 1. **Clear Intent**

```typescript
// ✅ Clear - This will change state
await createCategoryHandler.handle({ name: "Work" });

// ✅ Clear - This just reads
const category = await getCategoryHandler.handle({ categoryId: "cat-123" });
```

### 2. **Separate Optimization**

**Commands:**

- Focus on write performance
- Complex validation
- Transaction handling
- Event publishing

**Queries:**

- Focus on read performance
- Caching
- Denormalization
- Read replicas

```typescript
// Query can read from optimized read model
export class ListCategoriesQueryHandler {
  constructor(
    private readModel: ICategoryReadModel, // Denormalized, cached
  ) {}

  async handle(query: ListCategoriesQuery): Promise<CategoryDTO[]> {
    // Fast read from optimized structure
    return await this.readModel.findAll();
  }
}
```

### 3. **Easier Testing**

**Test Commands:**

```typescript
it("should create category", async () => {
  await handler.handle({ name: "Work" });

  const saved = await repo.findByName("Work");
  expect(saved).toBeDefined();
});
```

**Test Queries:**

```typescript
it("should return category by id", async () => {
  await repo.save(new Category({ name: "Work" }));

  const result = await handler.handle({ categoryId: category.id });

  expect(result.name).toBe("Work");
});
```

### 4. **Better Caching**

```typescript
// Queries can be cached safely
export class GetCategoryQueryHandler {
  constructor(
    private repo: ICategoryRepository,
    private cache: ICache,
  ) {}

  async handle(query: GetCategoryQuery): Promise<CategoryDTO | null> {
    // Check cache first
    const cached = await this.cache.get(`category:${query.categoryId}`);
    if (cached) {
      return cached;
    }

    // Load and cache
    const category = await this.repo.findById(query.categoryId);
    if (category) {
      const dto = this.toDTO(category);
      await this.cache.set(`category:${query.categoryId}`, dto);
      return dto;
    }

    return null;
  }
}
```

### 5. **Eventual Consistency**

```typescript
// Command changes write model
await createCategoryHandler.handle({ name: "Work" });

// Event updates read model (async)
eventBus.subscribe("CategoryCreated", async (event) => {
  await readModel.insert({
    id: event.categoryId,
    name: event.categoryName,
    sessionCount: 0,
    lastUsed: null,
  });
});

// Query reads from read model
const categories = await listCategoriesHandler.handle({});
// Might not include new category immediately (eventual consistency)
```

---

## CQRS Levels

### Level 0: Same Model (What You Have Now)

```typescript
// Same repository for reads and writes
export class CategoryService {
  constructor(private repo: ICategoryRepository) {}

  // Command
  async create(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.repo.save(category); // Write
  }

  // Query
  async getById(id: ULID): Promise<CategoryDTO> {
    const category = await this.repo.findById(id); // Read
    return this.toDTO(category);
  }
}
```

### Level 1: Separate Handlers (Start Here)

```typescript
// Separate command and query handlers
export class CreateCategoryCommandHandler {
  async handle(command: CreateCategoryCommand): Promise<void> {
    // Write logic
  }
}

export class GetCategoryQueryHandler {
  async handle(query: GetCategoryQuery): Promise<CategoryDTO> {
    // Read logic
  }
}
```

**Benefits:**

- Clear separation of concerns
- Different validation for commands vs queries
- Easier to test

### Level 2: Separate Models (Advanced)

```typescript
// Write model (domain entities)
export class CreateCategoryCommandHandler {
  constructor(
    private categoryRepo: ICategoryRepository, // Write model
  ) {}

  async handle(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);
  }
}

// Read model (denormalized DTOs)
export class ListCategoriesQueryHandler {
  constructor(
    private readModel: ICategoryReadModel, // Read model
  ) {}

  async handle(query: ListCategoriesQuery): Promise<CategoryDTO[]> {
    return await this.readModel.findAll(); // Optimized for reads
  }
}

// Event handler syncs read model
export class CategoryCreatedHandler {
  async handle(event: CategoryCreated): Promise<void> {
    await readModel.insert({
      id: event.categoryId,
      name: event.categoryName,
      sessionCount: 0, // Pre-calculated!
      lastUsed: null,
    });
  }
}
```

**Benefits:**

- Optimize writes and reads independently
- Denormalize read model for performance
- Scale reads and writes separately

**Complexity:**

- Eventual consistency
- Sync logic between models
- More infrastructure

**Recommendation:** Start with Level 1, move to Level 2 only if needed.

---

## Validation in Commands vs Queries

### Command Validation

Commands need **multiple levels of validation**:

**1. DTO Validation (Shape)**

```typescript
// Using class-validator or zod
export class CreateCategoryCommand {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsHexColor()
  color?: string | null;
}
```

**2. Business Rule Validation (Domain)**

```typescript
// In entity constructor
export class Category {
  constructor(params: { name: string }) {
    invariant(
      isNotNil(params.name),
      new EntityInvariantError("name is required"),
    );
    invariant(
      trim(params.name).length > 0,
      new EntityInvariantError("name cannot be empty"),
    );
    // ...
  }
}
```

**3. Application Validation (Context)**

```typescript
// In command handler
export class CreateCategoryCommandHandler {
  async handle(command: CreateCategoryCommand): Promise<void> {
    // Check if name is unique (application-level check)
    const existing = await this.categoryRepo.findByName(command.name);
    if (existing) {
      throw new ApplicationError("Category with this name already exists");
    }

    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);
  }
}
```

### Query Validation

Queries usually need **minimal validation**:

```typescript
export class GetCategoryQueryHandler {
  async handle(query: GetCategoryQuery): Promise<CategoryDTO | null> {
    // Just validate ID format
    if (!query.categoryId) {
      throw new ApplicationError("Category ID is required");
    }

    // Return null if not found (don't throw)
    const category = await this.categoryRepo.findById(query.categoryId);
    return category ? this.toDTO(category) : null;
  }
}
```

**Key Difference:**

- Commands: Validate heavily, throw on invalid
- Queries: Validate minimally, return null if not found

---

## File Organization

### Recommended Structure

```
packages/application/
├── commands/                   # Command DTOs
│   ├── category/
│   │   ├── CreateCategoryCommand.ts
│   │   ├── RenameCategoryCommand.ts
│   │   └── DeleteCategoryCommand.ts
│   └── session/
│       ├── StartSessionCommand.ts
│       ├── PauseSessionCommand.ts
│       └── StopSessionCommand.ts
│
├── commandHandlers/            # Command handlers
│   ├── category/
│   │   ├── CreateCategoryCommandHandler.ts
│   │   ├── RenameCategoryCommandHandler.ts
│   │   └── DeleteCategoryCommandHandler.ts
│   └── session/
│       ├── StartSessionCommandHandler.ts
│       ├── PauseSessionCommandHandler.ts
│       └── StopSessionCommandHandler.ts
│
├── queries/                    # Query DTOs
│   ├── category/
│   │   ├── GetCategoryQuery.ts
│   │   ├── ListCategoriesQuery.ts
│   │   └── GetCategoryStatisticsQuery.ts
│   └── session/
│       ├── GetSessionQuery.ts
│       └── ListSessionsByCategoryQuery.ts
│
├── queryHandlers/              # Query handlers
│   ├── category/
│   │   ├── GetCategoryQueryHandler.ts
│   │   ├── ListCategoriesQueryHandler.ts
│   │   └── GetCategoryStatisticsQueryHandler.ts
│   └── session/
│       ├── GetSessionQueryHandler.ts
│       └── ListSessionsByCategoryQueryHandler.ts
│
└── dtos/                       # Response DTOs
    ├── CategoryDTO.ts
    ├── SessionDTO.ts
    └── StatisticsDTO.ts
```

---

## Using from Presentation Layer

### React Hook Pattern

```typescript
// hooks/useCreateCategory.ts
export function useCreateCategory() {
  const container = useContainer();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const handler = container.get<CreateCategoryCommandHandler>(
        TYPES.CreateCategoryCommandHandler
      );
      return await handler.handle(command);
    }
  });
}

// hooks/useCategory.ts
export function useCategory(categoryId: ULID) {
  const container = useContainer();

  return useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const handler = container.get<GetCategoryQueryHandler>(
        TYPES.GetCategoryQueryHandler
      );
      return await handler.handle({ categoryId });
    }
  });
}

// In component
export function CreateCategoryScreen() {
  const createCategory = useCreateCategory();
  const categories = useCategories(); // List query

  const handleSubmit = async (data: { name: string }) => {
    await createCategory.mutateAsync({ name: data.name });
    categories.refetch(); // Refresh list
  };

  return <Form onSubmit={handleSubmit}>...</Form>;
}
```

---

## Testing Commands and Queries

### Testing Commands

```typescript
describe("CreateCategoryCommandHandler", () => {
  let handler: CreateCategoryCommandHandler;
  let repo: InMemoryCategoryRepository;
  let eventPublisher: MockEventPublisher;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    eventPublisher = new MockEventPublisher();
    handler = new CreateCategoryCommandHandler(repo, eventPublisher);
  });

  it("should create category with valid command", async () => {
    const command: CreateCategoryCommand = {
      name: "Work",
      color: "#FF0000",
    };

    await handler.handle(command);

    const categories = await repo.findAll();
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe("Work");
    expect(categories[0].color).toBe("#FF0000");
  });

  it("should publish CategoryCreated event", async () => {
    const command: CreateCategoryCommand = { name: "Work" };

    await handler.handle(command);

    expect(eventPublisher.publishedEvents).toHaveLength(1);
    expect(eventPublisher.publishedEvents[0].type).toBe("CategoryCreated");
  });

  it("should throw on invalid command", async () => {
    const command: CreateCategoryCommand = { name: "" };

    await expect(handler.handle(command)).rejects.toThrow(EntityInvariantError);
  });
});
```

### Testing Queries

```typescript
describe("GetCategoryQueryHandler", () => {
  let handler: GetCategoryQueryHandler;
  let repo: InMemoryCategoryRepository;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    handler = new GetCategoryQueryHandler(repo);
  });

  it("should return category when found", async () => {
    const category = new Category({ name: "Work" });
    await repo.save(category);

    const result = await handler.handle({ categoryId: category.id });

    expect(result).toBeDefined();
    expect(result!.name).toBe("Work");
  });

  it("should return null when not found", async () => {
    const result = await handler.handle({ categoryId: "non-existent" });

    expect(result).toBeNull();
  });

  it("should return DTO not domain object", async () => {
    const category = new Category({ name: "Work" });
    await repo.save(category);

    const result = await handler.handle({ categoryId: category.id });

    // Should be plain object, not Category instance
    expect(result).toBeDefined();
    expect(result instanceof Category).toBe(false);
    expect(typeof result).toBe("object");
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Keep commands and queries separate**

```typescript
// ✅ Good - Separate
CreateCategoryCommandHandler;
GetCategoryQueryHandler;

// ❌ Bad - Mixed
CategoryService; // Does both
```

**2. Return DTOs from queries**

```typescript
// ✅ Good
async handle(query: GetCategoryQuery): Promise<CategoryDTO> {
  const category = await this.repo.findById(query.categoryId);
  return this.toDTO(category);
}

// ❌ Bad
async handle(query: GetCategoryQuery): Promise<Category> {
  return await this.repo.findById(query.categoryId);
}
```

**3. Make commands imperative**

```typescript
// ✅ Good
CreateCategoryCommand;
StartSessionCommand;
PauseSessionCommand;

// ❌ Bad
CategoryCreation;
SessionStart;
```

**4. Make queries descriptive**

```typescript
// ✅ Good
GetCategoryQuery;
ListCategoriesQuery;
GetCategoryStatisticsQuery;

// ❌ Bad
CategoryQuery;
Categories;
```

### ❌ DON'T:

**1. Don't return data from commands**

```typescript
// ❌ Bad - Returning full DTO
async handle(command: CreateCategoryCommand): Promise<CategoryDTO> {
  const category = new Category({ name: command.name });
  await this.repo.save(category);
  return this.toDTO(category); // ❌
}

// ✅ Good - Return ID only
async handle(command: CreateCategoryCommand): Promise<{ id: ULID }> {
  const category = new Category({ name: command.name });
  await this.repo.save(category);
  return { id: category.id }; // ✅
}
```

**2. Don't modify state in queries**

```typescript
// ❌ Bad - Query modifying state
async handle(query: GetCategoryQuery): Promise<CategoryDTO> {
  const category = await this.repo.findById(query.categoryId);
  category.incrementViewCount(); // ❌ Side effect!
  return this.toDTO(category);
}
```

**3. Don't use same handler for commands and queries**

```typescript
// ❌ Bad
export class CategoryHandler {
  async create(command: CreateCategoryCommand): Promise<void> {}
  async get(query: GetCategoryQuery): Promise<CategoryDTO> {}
}

// ✅ Good
export class CreateCategoryCommandHandler {}
export class GetCategoryQueryHandler {}
```

---

## Summary

**CQRS:**

- **Command** - Changes state, returns void/ID
- **Query** - Reads state, returns DTO

**Benefits:**

- Clear intent
- Separate optimization
- Easier testing
- Better caching
- Eventual consistency support

**Levels:**

- Level 1: Separate handlers (start here)
- Level 2: Separate models (if needed)

**In Our Project:**

- Commands: Create/Update/Delete categories and sessions
- Queries: Get/List categories, sessions, statistics

**Pattern:**

```typescript
// Command
const result = await createCategoryHandler.handle({ name: "Work" });
// Returns: { categoryId: '...' }

// Query
const category = await getCategoryHandler.handle({
  categoryId: result.categoryId,
});
// Returns: CategoryDTO
```

**Key Principle:** Methods should either change state OR return data, never both.

---

## Related Documents

- [Application Layer](./application-layer.md)
- [Clean Architecture Layers](./clean-architecture-layers.md)
- [Domain Services](./domain-services.md)

---

## References

- **CQRS** by Greg Young
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 4: Architecture)
- **Clean Architecture** by Robert C. Martin
