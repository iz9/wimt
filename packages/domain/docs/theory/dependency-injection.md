# Dependency Injection & IoC Container

## What is Dependency Injection?

**Dependency Injection (DI)** is a design pattern where an object receives its dependencies from external sources rather than creating them itself. An **IoC (Inversion of Control) Container** is a framework that automates this process.

### Key Principle

> "Don't create dependencies inside classes. Inject them from outside."

**Simple Example:**

```typescript
// ❌ Without DI - Hard-coded dependency
class CreateCategoryUseCase {
  private repo = new InMemoryCategoryRepository(); // ❌ Hard-coded!

  async execute(command: CreateCategoryCommand) {
    const category = new Category({ name: command.name });
    await this.repo.save(category);
  }
}

// ✅ With DI - Injected dependency
class CreateCategoryUseCase {
  constructor(
    private repo: ICategoryRepository, // ✅ Injected!
  ) {}

  async execute(command: CreateCategoryCommand) {
    const category = new Category({ name: command.name });
    await this.repo.save(category);
  }
}

// Container wires it up
const repo = new InMemoryCategoryRepository();
const useCase = new CreateCategoryUseCase(repo);
```

---

## Why Use Dependency Injection?

### 1. **Testability**

**Without DI:**

```typescript
class CreateCategoryUseCase {
  private repo = new SqliteCategoryRepository(); // ❌ Can't swap for testing

  async execute(command: CreateCategoryCommand) {
    await this.repo.save(category); // ❌ Hits real database in tests!
  }
}
```

**With DI:**

```typescript
class CreateCategoryUseCase {
  constructor(private repo: ICategoryRepository) {}

  async execute(command: CreateCategoryCommand) {
    await this.repo.save(category);
  }
}

// In tests - inject mock
const mockRepo = new InMemoryCategoryRepository();
const useCase = new CreateCategoryUseCase(mockRepo); // ✅ Easy to test!
```

### 2. **Flexibility**

```typescript
// Development - use in-memory
const repo = new InMemoryCategoryRepository();

// Production - use real database
const repo = new SqliteCategoryRepository(db);

// Same use case code works with both!
const useCase = new CreateCategoryUseCase(repo);
```

### 3. **Clean Architecture**

```typescript
// Domain defines interface
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
}

// Application depends on interface (domain)
class CreateCategoryUseCase {
  constructor(private repo: ICategoryRepository) {} // Domain interface!
}

// Infrastructure implements interface
class SqliteCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    // Database logic
  }
}

// Dependency inversion principle!
```

### 4. **Single Responsibility**

```typescript
// ✅ Each class has one job
class CreateCategoryUseCase {
  // Job: Coordinate category creation
  constructor(
    private categoryRepo: ICategoryRepository,
    private eventPublisher: IEventPublisher,
  ) {}
}

class InMemoryCategoryRepository {
  // Job: Store categories in memory
}

class EventPublisher {
  // Job: Publish events
}
```

---

## Constructor Injection vs Property Injection

### Constructor Injection (Recommended)

```typescript
export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepo: ICategoryRepository, // ✅ Constructor
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);

    const events = category.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
```

**Benefits:**

- ✅ Dependencies are required (can't forget to set them)
- ✅ Immutable (readonly)
- ✅ Clear what dependencies are needed
- ✅ Easier to test

### Property Injection (Avoid)

```typescript
export class CreateCategoryUseCase {
  public categoryRepo!: ICategoryRepository; // ❌ Property
  public eventPublisher!: IEventPublisher;

  async execute(command: CreateCategoryCommand): Promise<void> {
    // What if someone forgot to set categoryRepo?
    await this.categoryRepo.save(category); // ❌ Might be undefined!
  }
}
```

**Problems:**

- ❌ Dependencies might not be set
- ❌ Can be changed after creation
- ❌ Less clear what's required

**Recommendation:** Use constructor injection.

---

## InversifyJS Introduction

**InversifyJS** is a powerful IoC container for TypeScript with excellent type safety.

### Installation

```bash
npm install inversify reflect-metadata
```

### Basic Setup

```typescript
// types.ts - Define injection tokens
export const TYPES = {
  // Repositories
  ICategoryRepository: Symbol.for("ICategoryRepository"),
  ISessionRepository: Symbol.for("ISessionRepository"),

  // Services
  IEventPublisher: Symbol.for("IEventPublisher"),
  ITimeProvider: Symbol.for("ITimeProvider"),

  // Use Cases
  CreateCategoryUseCase: Symbol.for("CreateCategoryUseCase"),
  StartSessionUseCase: Symbol.for("StartSessionUseCase"),
};

// container.ts - Configure container
import { Container } from "inversify";
import "reflect-metadata";

const container = new Container();

// Bind repositories
container
  .bind<ICategoryRepository>(TYPES.ICategoryRepository)
  .to(InMemoryCategoryRepository)
  .inSingletonScope();

container
  .bind<ISessionRepository>(TYPES.ISessionRepository)
  .to(InMemorySessionRepository)
  .inSingletonScope();

// Bind services
container
  .bind<IEventPublisher>(TYPES.IEventPublisher)
  .to(InMemoryEventPublisher)
  .inSingletonScope();

container
  .bind<ITimeProvider>(TYPES.ITimeProvider)
  .to(RealTimeProvider)
  .inSingletonScope();

// Bind use cases
container
  .bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase)
  .to(CreateCategoryUseCase);

export { container };
```

---

## Using @injectable and @inject

### Marking Classes as Injectable

```typescript
import { injectable, inject } from "inversify";
import { TYPES } from "./types";

@injectable()
export class CreateCategoryUseCase {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository,

    @inject(TYPES.IEventPublisher)
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);

    const events = category.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
```

### Resolving from Container

```typescript
import { container } from "./container";
import { TYPES } from "./types";

// Get use case from container
const createCategoryUseCase = container.get<CreateCategoryUseCase>(
  TYPES.CreateCategoryUseCase,
);

// Use it
await createCategoryUseCase.execute({ name: "Work" });
```

---

## Binding Scopes

### Singleton Scope

**One instance shared across the app.**

```typescript
container
  .bind<ICategoryRepository>(TYPES.ICategoryRepository)
  .to(InMemoryCategoryRepository)
  .inSingletonScope(); // ✅ Singleton

// Always returns the same instance
const repo1 = container.get<ICategoryRepository>(TYPES.ICategoryRepository);
const repo2 = container.get<ICategoryRepository>(TYPES.ICategoryRepository);
console.log(repo1 === repo2); // true
```

**When to use:**

- Repositories (shared state)
- Event publishers (shared event bus)
- Time providers (no state, can be singleton)
- Services without state

### Transient Scope (Default)

**New instance every time.**

```typescript
container
  .bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase)
  .to(CreateCategoryUseCase); // Transient (default)

// New instance each time
const useCase1 = container.get<CreateCategoryUseCase>(
  TYPES.CreateCategoryUseCase,
);
const useCase2 = container.get<CreateCategoryUseCase>(
  TYPES.CreateCategoryUseCase,
);
console.log(useCase1 === useCase2); // false
```

**When to use:**

- Use cases (no state between executions)
- Command handlers
- Query handlers
- Any stateless service

### Request Scope

**One instance per request (web apps).**

```typescript
container.bind<IUnitOfWork>(TYPES.IUnitOfWork).to(UnitOfWork).inRequestScope(); // Per request
```

**When to use:**

- Transaction management (UnitOfWork)
- Request-specific context
- Web API scenarios

---

## Our Project Container Setup

### File Structure

```
packages/infrastructure/
├── src/
│   ├── di/
│   │   ├── types.ts              # Injection tokens
│   │   ├── container.ts          # Container configuration
│   │   ├── repositories.module.ts
│   │   ├── services.module.ts
│   │   └── useCases.module.ts
│   ├── persistence/
│   │   └── inMemory/
│   │       ├── InMemoryCategoryRepository.ts
│   │       └── InMemorySessionRepository.ts
│   └── events/
│       └── InMemoryEventPublisher.ts
```

### types.ts

```typescript
export const TYPES = {
  // Repositories
  ICategoryRepository: Symbol.for("ICategoryRepository"),
  ISessionRepository: Symbol.for("ISessionRepository"),

  // Domain Services
  SessionExportService: Symbol.for("SessionExportService"),
  CategoryStatisticsCalculator: Symbol.for("CategoryStatisticsCalculator"),

  // Infrastructure Services
  IEventPublisher: Symbol.for("IEventPublisher"),
  ITimeProvider: Symbol.for("ITimeProvider"),

  // Use Cases - Commands
  CreateCategoryUseCase: Symbol.for("CreateCategoryUseCase"),
  RenameCategoryUseCase: Symbol.for("RenameCategoryUseCase"),
  DeleteCategoryUseCase: Symbol.for("DeleteCategoryUseCase"),
  StartSessionUseCase: Symbol.for("StartSessionUseCase"),
  PauseSessionUseCase: Symbol.for("PauseSessionUseCase"),
  ResumeSessionUseCase: Symbol.for("ResumeSessionUseCase"),
  StopSessionUseCase: Symbol.for("StopSessionUseCase"),

  // Use Cases - Queries
  GetCategoryQuery: Symbol.for("GetCategoryQuery"),
  ListCategoriesQuery: Symbol.for("ListCategoriesQuery"),
  GetCategoryStatisticsQuery: Symbol.for("GetCategoryStatisticsQuery"),
  GetSessionQuery: Symbol.for("GetSessionQuery"),
  ListSessionsQuery: Symbol.for("ListSessionsQuery"),
};
```

### repositories.module.ts

```typescript
import { ContainerModule, interfaces } from "inversify";
import { TYPES } from "./types";
import { ICategoryRepository } from "@wimt/domain/repositories/ICategoryRepository";
import { ISessionRepository } from "@wimt/domain/repositories/ISessionRepository";
import { InMemoryCategoryRepository } from "../persistence/inMemory/InMemoryCategoryRepository";
import { InMemorySessionRepository } from "../persistence/inMemory/InMemorySessionRepository";

export const repositoriesModule = new ContainerModule(
  (bind: interfaces.Bind) => {
    bind<ICategoryRepository>(TYPES.ICategoryRepository)
      .to(InMemoryCategoryRepository)
      .inSingletonScope();

    bind<ISessionRepository>(TYPES.ISessionRepository)
      .to(InMemorySessionRepository)
      .inSingletonScope();
  },
);
```

### services.module.ts

```typescript
import { ContainerModule, interfaces } from "inversify";
import { TYPES } from "./types";
import { IEventPublisher } from "@wimt/domain/events/IEventPublisher";
import { ITimeProvider } from "@wimt/domain/shared/TimeProvider";
import { InMemoryEventPublisher } from "../events/InMemoryEventPublisher";
import { RealTimeProvider } from "../time/RealTimeProvider";
import { SessionExportService } from "@wimt/domain/services/SessionExportService";
import { CategoryStatisticsCalculator } from "@wimt/domain/services/CategoryStatisticsCalculator";

export const servicesModule = new ContainerModule((bind: interfaces.Bind) => {
  // Infrastructure services
  bind<IEventPublisher>(TYPES.IEventPublisher)
    .to(InMemoryEventPublisher)
    .inSingletonScope();

  bind<ITimeProvider>(TYPES.ITimeProvider)
    .to(RealTimeProvider)
    .inSingletonScope();

  // Domain services
  bind<SessionExportService>(TYPES.SessionExportService).to(
    SessionExportService,
  );

  bind<CategoryStatisticsCalculator>(TYPES.CategoryStatisticsCalculator).to(
    CategoryStatisticsCalculator,
  );
});
```

### useCases.module.ts

```typescript
import { ContainerModule, interfaces } from "inversify";
import { TYPES } from "./types";
import { CreateCategoryUseCase } from "@wimt/application/useCases/category/CreateCategoryUseCase";
import { StartSessionUseCase } from "@wimt/application/useCases/session/StartSessionUseCase";
// ... more imports

export const useCasesModule = new ContainerModule((bind: interfaces.Bind) => {
  // Category commands
  bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase).to(
    CreateCategoryUseCase,
  );

  bind<RenameCategoryUseCase>(TYPES.RenameCategoryUseCase).to(
    RenameCategoryUseCase,
  );

  // Session commands
  bind<StartSessionUseCase>(TYPES.StartSessionUseCase).to(StartSessionUseCase);

  bind<PauseSessionUseCase>(TYPES.PauseSessionUseCase).to(PauseSessionUseCase);

  // Queries
  bind<GetCategoryQuery>(TYPES.GetCategoryQuery).to(GetCategoryQuery);

  bind<ListCategoriesQuery>(TYPES.ListCategoriesQuery).to(ListCategoriesQuery);
});
```

### container.ts

```typescript
import { Container } from "inversify";
import "reflect-metadata";
import { repositoriesModule } from "./repositories.module";
import { servicesModule } from "./services.module";
import { useCasesModule } from "./useCases.module";

// Create container
const container = new Container();

// Load modules
container.load(repositoriesModule, servicesModule, useCasesModule);

export { container };
```

---

## Using Container in React Native

### Create Container Hook

```typescript
// hooks/useContainer.ts
import { container } from '@wimt/infrastructure/di/container';
import { createContext, useContext } from 'react';
import { Container } from 'inversify';

const ContainerContext = createContext<Container>(container);

export function ContainerProvider({ children }: { children: React.ReactNode }) {
  return (
    <ContainerContext.Provider value={container}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useContainer(): Container {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error('useContainer must be used within ContainerProvider');
  }
  return context;
}
```

### Use in App

```typescript
// App.tsx
import { ContainerProvider } from './hooks/useContainer';

export default function App() {
  return (
    <ContainerProvider>
      <NavigationContainer>
        {/* Your app */}
      </NavigationContainer>
    </ContainerProvider>
  );
}
```

### Create Use Case Hooks

```typescript
// hooks/useCreateCategory.ts
import { useContainer } from './useContainer';
import { TYPES } from '@wimt/infrastructure/di/types';
import { CreateCategoryUseCase } from '@wimt/application/useCases/category/CreateCategoryUseCase';
import { CreateCategoryCommand } from '@wimt/application/commands/CreateCategoryCommand';

export function useCreateCategory() {
  const container = useContainer();

  return {
    execute: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase
      );
      return await useCase.execute(command);
    }
  };
}

// In component
export function CreateCategoryScreen() {
  const createCategory = useCreateCategory();

  const handleSubmit = async (data: { name: string }) => {
    await createCategory.execute({ name: data.name });
  };

  return <Form onSubmit={handleSubmit}>...</Form>;
}
```

### With React Query

```typescript
// hooks/useCreateCategory.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContainer } from './useContainer';
import { TYPES } from '@wimt/infrastructure/di/types';

export function useCreateCategory() {
  const container = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase
      );
      return await useCase.execute(command);
    },
    onSuccess: () => {
      // Invalidate categories query
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });
}

// In component
export function CreateCategoryScreen() {
  const createCategory = useCreateCategory();

  const handleSubmit = async (data: { name: string }) => {
    await createCategory.mutateAsync({ name: data.name });
  };

  return <Form onSubmit={handleSubmit}>...</Form>;
}
```

---

## Testing with DI

### Test Setup

```typescript
describe("CreateCategoryUseCase", () => {
  let useCase: CreateCategoryUseCase;
  let categoryRepo: InMemoryCategoryRepository;
  let eventPublisher: MockEventPublisher;

  beforeEach(() => {
    // Create test doubles
    categoryRepo = new InMemoryCategoryRepository();
    eventPublisher = new MockEventPublisher();

    // Inject manually (no container needed!)
    useCase = new CreateCategoryUseCase(categoryRepo, eventPublisher);
  });

  it("should create category", async () => {
    await useCase.execute({ name: "Work" });

    const categories = await categoryRepo.findAll();
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe("Work");
  });
});
```

### Test Container

```typescript
// Create separate test container
export function createTestContainer(): Container {
  const container = new Container();

  // Bind test implementations
  container
    .bind<ICategoryRepository>(TYPES.ICategoryRepository)
    .to(InMemoryCategoryRepository)
    .inSingletonScope();

  container
    .bind<IEventPublisher>(TYPES.IEventPublisher)
    .to(MockEventPublisher)
    .inSingletonScope();

  container
    .bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase)
    .to(CreateCategoryUseCase);

  return container;
}

// In tests
describe("CreateCategoryUseCase integration", () => {
  let container: Container;

  beforeEach(() => {
    container = createTestContainer();
  });

  it("should create category through container", async () => {
    const useCase = container.get<CreateCategoryUseCase>(
      TYPES.CreateCategoryUseCase,
    );

    await useCase.execute({ name: "Work" });

    const repo = container.get<ICategoryRepository>(TYPES.ICategoryRepository);
    const categories = await repo.findAll();
    expect(categories).toHaveLength(1);
  });
});
```

---

## Swapping Implementations

### Development vs Production

```typescript
// Development - use in-memory
if (process.env.NODE_ENV === "development") {
  container
    .bind<ICategoryRepository>(TYPES.ICategoryRepository)
    .to(InMemoryCategoryRepository)
    .inSingletonScope();
}

// Production - use AsyncStorage
if (process.env.NODE_ENV === "production") {
  container
    .bind<ICategoryRepository>(TYPES.ICategoryRepository)
    .to(AsyncStorageCategoryRepository)
    .inSingletonScope();
}
```

### Feature Flags

```typescript
// Use SQLite if feature enabled
if (featureFlags.useSQLite) {
  container
    .bind<ICategoryRepository>(TYPES.ICategoryRepository)
    .to(SqliteCategoryRepository)
    .inSingletonScope();
} else {
  container
    .bind<ICategoryRepository>(TYPES.ICategoryRepository)
    .to(InMemoryCategoryRepository)
    .inSingletonScope();
}
```

---

## Common Patterns

### Pattern: Factory

```typescript
// When construction is complex
container
  .bind(TYPES.ISessionRepository)
  .toDynamicValue((context) => {
    const db = context.container.get(TYPES.IDatabase);
    return new SqliteSessionRepository(db, {
      tableName: "sessions",
      autoMigrate: true,
    });
  })
  .inSingletonScope();
```

### Pattern: Conditional Binding

```typescript
const container = new Container({ defaultScope: "Singleton" });

container.bind(TYPES.ICategoryRepository).toDynamicValue(() => {
  return Platform.OS === "web"
    ? new LocalStorageCategoryRepository()
    : new AsyncStorageCategoryRepository();
});
```

### Pattern: Named Bindings

```typescript
// Multiple implementations of same interface
container
  .bind<IEventPublisher>(TYPES.IEventPublisher)
  .to(InMemoryEventPublisher)
  .whenTargetNamed("in-memory");

container
  .bind<IEventPublisher>(TYPES.IEventPublisher)
  .to(KafkaEventPublisher)
  .whenTargetNamed("kafka");

// Inject specific one
@injectable()
class MyService {
  constructor(
    @inject(TYPES.IEventPublisher)
    @named("in-memory")
    private eventPublisher: IEventPublisher,
  ) {}
}
```

---

## Best Practices

### ✅ DO:

**1. Use constructor injection**

```typescript
// ✅ Good
@injectable()
class CreateCategoryUseCase {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private readonly repo: ICategoryRepository,
  ) {}
}
```

**2. Depend on interfaces, not implementations**

```typescript
// ✅ Good
constructor(private repo: ICategoryRepository) {}

// ❌ Bad
constructor(private repo: InMemoryCategoryRepository) {}
```

**3. Use symbols for injection tokens**

```typescript
// ✅ Good
const TYPES = {
  ICategoryRepository: Symbol.for("ICategoryRepository"),
};

// ❌ Bad
const TYPES = {
  ICategoryRepository: "ICategoryRepository", // String collision risk!
};
```

**4. Organize with modules**

```typescript
// ✅ Good - Modular
container.load(repositoriesModule, servicesModule, useCasesModule);
```

### ❌ DON'T:

**1. Don't use container in domain layer**

```typescript
// ❌ Bad - Domain importing container!
import { container } from "@wimt/infrastructure/di/container";

class Category {
  save() {
    const repo = container.get(TYPES.ICategoryRepository); // ❌ NO!
  }
}
```

**2. Don't create dependencies manually when using container**

```typescript
// ❌ Bad - Bypassing DI
const repo = new InMemoryCategoryRepository();
const useCase = new CreateCategoryUseCase(repo);

// ✅ Good - Let container handle it
const useCase = container.get<CreateCategoryUseCase>(
  TYPES.CreateCategoryUseCase,
);
```

**3. Don't use singleton for stateful use cases**

```typescript
// ❌ Bad - Use case with state shouldn't be singleton!
container
  .bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase)
  .to(CreateCategoryUseCase)
  .inSingletonScope(); // ❌ Multiple calls share state!

// ✅ Good - Transient (new instance each time)
container
  .bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase)
  .to(CreateCategoryUseCase); // Default is transient
```

---

## Summary

**Dependency Injection:**

- Inject dependencies instead of creating them
- Enables testability, flexibility, clean architecture

**IoC Container (InversifyJS):**

- Automates dependency resolution
- Type-safe with TypeScript
- Decorators: `@injectable()`, `@inject()`

**Scopes:**

- **Singleton:** Shared instance (repositories, services)
- **Transient:** New instance (use cases, command handlers)
- **Request:** Per request (web apps)

**In Our Project:**

- `types.ts` - Injection tokens
- `*.module.ts` - Modular configuration
- `container.ts` - Main container
- React hooks wrap container

**Key Benefits:**

- Easy to swap implementations
- Testable with mocks
- Clean architecture (dependency inversion)
- Single responsibility

---

## Related Documents

- [Clean Architecture Layers](./clean-architecture-layers.md)
- [Application Layer](./application-layer.md)
- [Repositories](./repositories.md)

---

## References

- **InversifyJS Documentation** - https://inversify.io
- **Dependency Injection Principles, Practices, and Patterns** by Steven van Deursen & Mark Seemann
- **Clean Architecture** by Robert C. Martin
