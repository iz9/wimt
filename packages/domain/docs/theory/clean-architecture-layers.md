# Clean Architecture Layers

## What is Clean Architecture?

**Clean Architecture** is a software design approach that separates concerns into **concentric layers**, with strict rules about dependencies. The goal is to make your system **independent of frameworks, UI, databases, and external agencies**.

### The Core Principle

> **"Dependencies point inward. Inner layers know nothing about outer layers."**

```
┌─────────────────────────────────────────────┐
│         Presentation Layer (UI)             │  ← Frameworks, UI
├─────────────────────────────────────────────┤
│         Application Layer                   │  ← Use Cases
├─────────────────────────────────────────────┤
│         Domain Layer (Business Logic)       │  ← Entities, Rules
├─────────────────────────────────────────────┤
│         Infrastructure Layer                │  ← Database, APIs
└─────────────────────────────────────────────┘

Dependencies flow: Presentation → Application → Domain
Infrastructure implements interfaces defined in Domain
```

---

## The Four Layers

### 1. Domain Layer (Core) 🎯

**The heart of your application** - pure business logic with zero dependencies.

**Contains:**

- Entities (Category, Session)
- Value Objects (Duration, DateTime)
- Domain Services (SessionExportService)
- Aggregate Roots
- Domain Events
- Repository Interfaces (not implementations!)
- Domain Errors

**Rules:**

- ✅ No dependencies on other layers
- ✅ No dependencies on frameworks
- ✅ Pure TypeScript/JavaScript
- ✅ Can be used anywhere (backend, frontend, mobile)
- ❌ No infrastructure code
- ❌ No UI code
- ❌ No persistence code

**Example:**

```typescript
// packages/domain/src/entities/Category.ts
export class Category extends AggregateRoot {
  public readonly id: ULID;
  public name: string;

  constructor(params: { name: string }) {
    super();
    this.ensureValidName(params.name); // Business rule
    this.name = params.name;
    this.id = makeId();
  }

  changeName(params: { name: string }): void {
    this.ensureValidName(params.name); // Business rule
    this.name = params.name;
  }

  private ensureValidName(name: string): void {
    invariant(isNotNil(name), new EntityInvariantError("name is required"));
  }
}
```

**Why pure?**

- Testable in isolation (no mocks needed)
- Reusable across platforms
- Business logic in one place
- Easy to understand

### 2. Application Layer (Use Cases) 🔄

**Orchestrates the workflow** - coordinates domain objects and infrastructure.

**Contains:**

- Use Cases (CreateCategoryUseCase)
- Commands (CreateCategoryCommand)
- Queries (GetCategoryQuery)
- DTOs (CategoryDTO)
- Application Services
- Event Handlers
- Application Errors

**Dependencies:**

- ✅ Depends on Domain Layer (uses entities, repositories)
- ✅ Depends on Infrastructure (through interfaces)
- ❌ No dependencies on Presentation

**Example:**

```typescript
// packages/application/src/useCases/CreateCategoryUseCase.ts
@injectable()
export class CreateCategoryUseCase {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository, // Domain interface

    @inject(TYPES.IEventPublisher)
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<CategoryDTO> {
    // 1. Create domain object (business logic in domain)
    const category = new Category({ name: command.name });

    // 2. Persist (infrastructure implementation)
    await this.categoryRepo.save(category);

    // 3. Publish events
    const events = category.pullDomainEvents();
    await this.publishEvents(events);

    // 4. Return DTO (not domain object!)
    return this.toDTO(category);
  }
}
```

**Why separate?**

- Transaction boundaries
- Workflow coordination
- Decouples UI from domain
- One place for orchestration

### 3. Infrastructure Layer (Technical Details) 🔧

**Implements technical details** - databases, APIs, file systems, etc.

**Contains:**

- Repository Implementations (InMemoryCategoryRepository, SqliteCategoryRepository)
- Event Publisher Implementations
- Time Provider Implementations
- External API Clients
- Database Connections
- File System Access
- Third-party Service Clients

**Dependencies:**

- ✅ Depends on Domain (implements interfaces)
- ✅ Can depend on Application
- ✅ Can use frameworks/libraries
- ❌ Domain depends on Infrastructure interfaces, not implementations

**Example:**

```typescript
// packages/infrastructure/src/persistence/InMemoryCategoryRepository.ts
@injectable()
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
}
```

**Why separate?**

- Swap implementations easily
- Test with in-memory versions
- Database-agnostic domain
- Framework independence

### 4. Presentation Layer (UI) 🎨

**User interface** - React Native, web, CLI, API endpoints, etc.

**Contains:**

- React Components
- Screens/Pages
- Controllers (if API)
- View Models
- UI State Management
- Routing
- User Input Handling

**Dependencies:**

- ✅ Depends on Application (calls use cases)
- ✅ Can use UI frameworks (React, React Native)
- ❌ Should not depend on Domain directly (use DTOs)
- ❌ Should not depend on Infrastructure

**Example:**

```typescript
// apps/mobile/src/screens/CreateCategoryScreen.tsx
export function CreateCategoryScreen() {
  const createCategory = useCreateCategory(); // Hook wraps use case

  const handleSubmit = async (data: { name: string }) => {
    try {
      // Call application layer
      await createCategory.execute({
        name: data.name,
        color: selectedColor,
        icon: selectedIcon
      });

      navigation.goBack();
    } catch (error) {
      showError(error.message);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Input name="name" placeholder="Category name" />
      <ColorPicker value={selectedColor} onChange={setSelectedColor} />
      <Button type="submit">Create Category</Button>
    </Form>
  );
}

// Custom hook wraps use case
function useCreateCategory() {
  const container = useContainer(); // DI container

  return {
    execute: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase
      );
      return await useCase.execute(command);
    }
  };
}
```

**Why separate?**

- Change UI without changing business logic
- Multiple UIs (mobile, web) share same application layer
- UI framework independence

---

## Dependency Rules

### The Golden Rule

**Dependencies can only point inward, never outward.**

```
Presentation ────┐
                 ├──→ Application ──→ Domain
Infrastructure ──┘

✅ Presentation can use Application
✅ Application can use Domain
✅ Infrastructure implements Domain interfaces

❌ Domain cannot use Application
❌ Domain cannot use Infrastructure
❌ Domain cannot use Presentation
```

### Dependency Inversion Principle

**Problem:** Domain needs persistence, but can't depend on infrastructure.

**Solution:** Domain defines interface, Infrastructure implements it.

```typescript
// Domain Layer - Interface
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
}

// Infrastructure Layer - Implementation
export class InMemoryCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    // Implementation details
  }
}

// Application Layer - Uses interface
export class CreateCategoryUseCase {
  constructor(
    private categoryRepo: ICategoryRepository, // Depends on interface!
  ) {}
}
```

**Flow:**

1. Domain defines `ICategoryRepository` interface
2. Infrastructure implements `InMemoryCategoryRepository`
3. Application depends on `ICategoryRepository` (domain)
4. DI container injects `InMemoryCategoryRepository` at runtime

**Benefits:**

- Domain has no dependencies
- Can swap implementations
- Easy to test

---

## Data Flow Through Layers

### Example: Creating a Category

**1. User Input (Presentation Layer)**

```typescript
// User fills form and clicks "Create"
const formData = { name: "Work", color: "#FF0000" };
```

**2. Call Use Case (Application Layer)**

```typescript
const command: CreateCategoryCommand = {
  name: formData.name,
  color: formData.color,
};

const result = await createCategoryUseCase.execute(command);
```

**3. Create Domain Object (Domain Layer)**

```typescript
// Inside use case
const category = new Category({ name: command.name });
category.setColor({ color: command.color });
// Domain events emitted
```

**4. Persist (Infrastructure Layer)**

```typescript
// Inside use case, calls repository
await categoryRepository.save(category);
// InMemoryCategoryRepository stores in Map
```

**5. Return Result (Application → Presentation)**

```typescript
// Use case returns DTO
return {
  categoryId: category.id,
  name: category.name,
  color: category.color,
};

// UI receives DTO and updates
showSuccess("Category created!");
navigation.goBack();
```

**Complete Flow:**

```
User Input
    ↓
Presentation (React Component)
    ↓
Application (Use Case)
    ↓
Domain (Entity) ←→ Infrastructure (Repository)
    ↓
Application (DTO)
    ↓
Presentation (Update UI)
```

---

## Your Project Structure

### Current Monorepo Layout

```
where-is-my-time/
├── apps/                           # Presentation Layer
│   ├── mobile/                     # React Native app
│   │   ├── src/
│   │   │   ├── screens/           # UI Screens
│   │   │   ├── components/        # UI Components
│   │   │   ├── hooks/             # Custom hooks (wrap use cases)
│   │   │   └── navigation/
│   │   └── package.json
│   ├── web/                        # Web app (future)
│   └── docs/                       # Documentation site
│
├── packages/
│   ├── domain/                     # Domain Layer ⭐
│   │   ├── src/
│   │   │   ├── entities/          # Entities (Category, Session)
│   │   │   ├── valueObjects/      # Value Objects (Duration, DateTime)
│   │   │   ├── services/          # Domain Services
│   │   │   ├── repositories/      # Repository Interfaces
│   │   │   ├── events/            # Domain Events
│   │   │   └── errors/            # Domain Errors
│   │   └── docs/
│   │       ├── entities/          # Entity requirements
│   │       └── theory/            # Theory documents
│   │
│   ├── application/                # Application Layer (create this)
│   │   ├── src/
│   │   │   ├── useCases/          # Use Cases
│   │   │   ├── queries/           # Query Handlers
│   │   │   ├── commands/          # Command DTOs
│   │   │   ├── dtos/              # Data Transfer Objects
│   │   │   └── errors/            # Application Errors
│   │   └── package.json
│   │
│   ├── infrastructure/             # Infrastructure Layer (create this)
│   │   ├── src/
│   │   │   ├── persistence/
│   │   │   │   ├── inMemory/      # In-memory repositories
│   │   │   │   ├── sqlite/        # SQLite repositories (future)
│   │   │   │   └── asyncStorage/  # React Native persistence (future)
│   │   │   ├── events/            # Event publisher implementations
│   │   │   └── time/              # Time provider implementations
│   │   └── package.json
│   │
│   ├── shared/                     # Shared utilities (cross-layer)
│   │   └── src/
│   │       ├── types/
│   │       └── utils/
│   │
│   └── ui/                         # Shared UI components
│       └── src/
│
├── turbo.json                      # Turborepo config
└── package.json
```

### Package Dependencies

```json
// packages/domain/package.json
{
  "name": "@wimt/domain",
  "dependencies": {
    "es-toolkit": "^1.0.0",
    "ulid": "^2.0.0",
    "dayjs": "^1.11.0"
    // NO dependencies on other packages!
  }
}

// packages/application/package.json
{
  "name": "@wimt/application",
  "dependencies": {
    "@wimt/domain": "workspace:*",  // ✅ Depends on domain
    "inversify": "^6.0.0"
  }
}

// packages/infrastructure/package.json
{
  "name": "@wimt/infrastructure",
  "dependencies": {
    "@wimt/domain": "workspace:*",      // ✅ Implements domain interfaces
    "@wimt/application": "workspace:*",  // ✅ Can depend on application
    "better-sqlite3": "^9.0.0"
  }
}

// apps/mobile/package.json
{
  "name": "@wimt/mobile",
  "dependencies": {
    "@wimt/application": "workspace:*",  // ✅ Uses use cases
    "@wimt/infrastructure": "workspace:*", // ✅ Needs implementations
    "react-native": "^0.73.0"
    // NO direct dependency on @wimt/domain!
  }
}
```

---

## Layer Communication Patterns

### Pattern 1: Presentation → Application → Domain

**Presentation calls application:**

```typescript
// In React component
const handleCreateCategory = async (name: string) => {
  const useCase = container.get<CreateCategoryUseCase>(
    TYPES.CreateCategoryUseCase,
  );
  const result = await useCase.execute({ name });
  // Use result to update UI
};
```

**Application coordinates domain:**

```typescript
// In use case
export class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand): Promise<CategoryDTO> {
    const category = new Category({ name: command.name }); // Domain
    await this.categoryRepo.save(category); // Infrastructure
    return this.toDTO(category); // DTO
  }
}
```

**Domain contains logic:**

```typescript
// In entity
export class Category {
  constructor(params: { name: string }) {
    this.ensureValidName(params.name); // Business rule
    // ...
  }
}
```

### Pattern 2: Infrastructure Implements Domain

**Domain defines interface:**

```typescript
// domain/repositories/ICategoryRepository.ts
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
}
```

**Infrastructure implements:**

```typescript
// infrastructure/persistence/InMemoryCategoryRepository.ts
export class InMemoryCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    // Implementation
  }
}
```

**Dependency injection wires them:**

```typescript
// infrastructure/di/container.ts
container
  .bind<ICategoryRepository>(TYPES.ICategoryRepository)
  .to(InMemoryCategoryRepository)
  .inSingletonScope();
```

### Pattern 3: Events Flow Across Layers

**Domain emits events:**

```typescript
// In entity
export class Category {
  constructor(params: { name: string }) {
    // ...
    this.addEvent(new CategoryCreated(this.id, this.name, this.createdAt));
  }
}
```

**Application publishes events:**

```typescript
// In use case
const events = category.pullDomainEvents();
for (const event of events) {
  await this.eventPublisher.publish(event);
}
```

**Infrastructure handles events:**

```typescript
// In event handler
@injectable()
export class UpdateCategoryStatisticsHandler {
  async handle(event: CategoryCreated): Promise<void> {
    // Update read model, cache, etc.
  }
}
```

**Presentation reacts:**

```typescript
// In React
eventBus.subscribe("CategoryCreated", (event) => {
  showNotification(`Category "${event.categoryName}" created!`);
  refetchCategories();
});
```

---

## Benefits of Clean Architecture

### 1. **Testability**

**Domain tests** - No mocks needed:

```typescript
it("should create category with valid name", () => {
  const category = new Category({ name: "Work" });
  expect(category.name).toBe("Work");
});
```

**Application tests** - Mock infrastructure:

```typescript
it("should create and save category", async () => {
  const mockRepo = new InMemoryCategoryRepository();
  const useCase = new CreateCategoryUseCase(mockRepo, mockEventPublisher);

  await useCase.execute({ name: "Work" });

  const saved = await mockRepo.findAll();
  expect(saved).toHaveLength(1);
});
```

### 2. **Framework Independence**

**Can swap UI frameworks:**

- React Native → React → Vue
- Same domain and application layers!

**Can swap databases:**

- In-memory → SQLite → PostgreSQL
- Same domain and application layers!

### 3. **Reusability**

**Share across platforms:**

```typescript
// Same code works in:
// - React Native mobile app
// - React web app
// - Node.js backend
// - Electron desktop app

const category = new Category({ name: "Work" }); // Anywhere!
```

### 4. **Maintainability**

**Clear boundaries:**

- Business logic → Domain
- Workflow → Application
- Technical details → Infrastructure
- UI → Presentation

**Easy to find things:**

- Need business rule? → Domain
- Need workflow? → Application
- Need database code? → Infrastructure

### 5. **Evolution**

**Can change independently:**

- Change UI without touching domain
- Change database without touching domain
- Add new use case without changing entities

---

## Common Violations (Anti-Patterns)

### ❌ Violation 1: Domain Depends on Infrastructure

```typescript
// ❌ BAD - Domain importing infrastructure
import { Database } from "better-sqlite3"; // Infrastructure!

export class Category {
  async save(db: Database): Promise<void> {
    // ❌ NO!
    await db.run("INSERT INTO categories...");
  }
}
```

**Fix:** Use repository pattern

```typescript
// ✅ GOOD - Domain defines interface
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
}

// Infrastructure implements
export class SqliteCategoryRepository implements ICategoryRepository {
  constructor(private db: Database) {}

  async save(category: Category): Promise<void> {
    // Database details here
  }
}
```

### ❌ Violation 2: Presentation Depends on Domain Directly

```typescript
// ❌ BAD - UI importing domain directly
import { Category } from "@wimt/domain/entities/Category";

export function CategoryForm() {
  const [category, setCategory] = useState<Category>(null); // ❌ NO!

  const handleSubmit = () => {
    category.changeName({ name: "New Name" }); // ❌ Mutating domain in UI!
  };
}
```

**Fix:** Use DTOs and use cases

```typescript
// ✅ GOOD - UI uses DTOs
import { CategoryDTO } from "@wimt/application/dtos/CategoryDTO";

export function CategoryForm() {
  const [category, setCategory] = useState<CategoryDTO>(null); // ✅ DTO!
  const renameCategory = useRenameCategory(); // ✅ Use case!

  const handleSubmit = async () => {
    await renameCategory.execute({
      categoryId: category.id,
      newName: "New Name",
    });
  };
}
```

### ❌ Violation 3: Application Contains Business Logic

```typescript
// ❌ BAD - Business logic in use case
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);

    // ❌ Business logic in use case!
    if (session.isStopped) {
      throw new Error("Cannot pause stopped session");
    }

    const segment = session.getActiveSegment();
    segment.stop(this.timeProvider);
  }
}
```

**Fix:** Move logic to domain

```typescript
// ✅ GOOD - Business logic in domain
export class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);
    session.pause(this.timeProvider); // ✅ Domain handles logic!
    await this.sessionRepo.save(session);
  }
}

// Domain entity
export class Session {
  pause(timeProvider: TimeProvider): void {
    // Business logic here!
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }
    // ...
  }
}
```

---

## Migration Path

### Phase 1: Domain Layer (Current)

✅ You have this!

- Entities
- Value Objects
- Repository Interfaces
- Domain Events

### Phase 2: Application Layer (Next)

Create `packages/application`:

- Use Cases
- Commands
- Queries
- DTOs

### Phase 3: Infrastructure Layer (Next)

Create `packages/infrastructure`:

- In-memory repositories
- Event publisher
- Time provider

### Phase 4: Wire with DI

Set up dependency injection:

- Container configuration
- Bind interfaces to implementations

### Phase 5: Presentation Layer

Update `apps/mobile`:

- Create hooks that wrap use cases
- Update components to use DTOs
- Remove direct domain dependencies

---

## Summary

**Four Layers:**

1. **Domain** - Business logic, zero dependencies
2. **Application** - Use cases, orchestration
3. **Infrastructure** - Technical implementation
4. **Presentation** - UI, user interaction

**Dependency Rule:**

```
Presentation → Application → Domain ← Infrastructure
```

**Key Benefits:**

- Testable
- Framework independent
- Reusable
- Maintainable
- Evolvable

**Your Next Steps:**

1. Create `packages/application` with use cases
2. Create `packages/infrastructure` with in-memory repos
3. Set up dependency injection
4. Update mobile app to use application layer

**Remember:** Dependencies point inward. Domain is pure. Application orchestrates. Infrastructure implements. Presentation consumes.

---

## Related Documents

- [Application Layer](./application-layer.md)
- [Domain Services](./domain-services.md)
- [Repositories](./repositories.md)

---

## References

- **Clean Architecture** by Robert C. Martin
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Domain-Driven Design** by Eric Evans
