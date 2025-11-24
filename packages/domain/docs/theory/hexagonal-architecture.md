# Hexagonal Architecture (Ports & Adapters)

## What is Hexagonal Architecture?

**Hexagonal Architecture**, also known as **Ports and Adapters**, is an architectural pattern that isolates the core business logic from external concerns (UI, database, APIs) by defining clear boundaries through ports and adapters.

### Key Principle

> "Your business logic doesn't care whether it talks to a UI, REST API, database, or file system. Make it pluggable."

**The Core Idea:**

```
┌─────────────────────────────────────────────┐
│                                             │
│         External World (Adapters)           │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   UI    │  │   API   │  │  Queue  │    │
│  └────┬────┘  └────┬────┘  └────┬────┘    │
│       │            │            │          │
│       ▼            ▼            ▼          │
│  ┌─────────────────────────────────────┐  │
│  │         Ports (Interfaces)          │  │
│  └─────────────────┬───────────────────┘  │
│                    │                       │
│       ┌────────────▼──────────────┐        │
│       │                           │        │
│       │   Domain / Application    │        │
│       │    (Business Logic)       │        │
│       │                           │        │
│       └────────────┬──────────────┘        │
│                    │                       │
│  ┌─────────────────▼───────────────────┐  │
│  │         Ports (Interfaces)          │  │
│  └─────────────────┬───────────────────┘  │
│       │            │            │          │
│       ▼            ▼            ▼          │
│  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐   │
│  │Database │  │  Redis  │  │External │   │
│  └─────────┘  └─────────┘  │   API   │   │
│                             └─────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Ports vs Adapters

### Ports (Interfaces)

**Ports** are interfaces defined by the application that describe what it needs from the outside world.

```typescript
// Port - Interface defined by application
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
  findAll(): Promise<Category[]>;
}

// Port - Interface for time
export interface TimeProvider {
  now(): DateTime;
}

// Port - Interface for events
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: IEventHandler): void;
}
```

**Two Types of Ports:**

1. **Primary (Driving) Ports** - How external world calls in (e.g., use cases)
2. **Secondary (Driven) Ports** - How application calls out (e.g., repositories)

### Adapters (Implementations)

**Adapters** are concrete implementations of ports that connect to specific technologies.

```typescript
// Adapter - AsyncStorage implementation
export class AsyncStorageCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    const json = JSON.stringify(this.serialize(category));
    await AsyncStorage.setItem(`category:${category.id}`, json);
  }

  async findById(id: ULID): Promise<Category | null> {
    const json = await AsyncStorage.getItem(`category:${id}`);
    return json ? this.deserialize(JSON.parse(json)) : null;
  }

  // ... other methods
}

// Adapter - SQLite implementation (same port!)
export class SqliteCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    await this.db.run(
      "INSERT INTO categories (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE ...",
      [category.id, category.name],
    );
  }

  async findById(id: ULID): Promise<Category | null> {
    const row = await this.db.get("SELECT * FROM categories WHERE id = ?", [
      id,
    ]);
    return row ? this.mapToDomain(row) : null;
  }

  // ... other methods
}
```

**Key:** Both adapters implement the same port interface!

---

## Primary (Driving) Adapters

**Primary adapters** drive the application - they call into it.

### Examples:

**1. REST API Adapter**

```typescript
// Primary adapter - REST endpoint
@Controller("/categories")
export class CategoryController {
  constructor(private createCategoryUseCase: CreateCategoryUseCase) {}

  @Post()
  async create(@Body() dto: CreateCategoryDTO) {
    // Adapter translates HTTP request into domain command
    const result = await this.createCategoryUseCase.execute({
      name: dto.name,
      color: dto.color,
    });

    // Adapter translates result into HTTP response
    return { id: result.id };
  }
}
```

**2. React Native UI Adapter**

```typescript
// Primary adapter - React component
export function CreateCategoryScreen() {
  const createCategory = useCreateCategory(); // Use case

  const handleSubmit = async () => {
    // Adapter translates UI event into command
    await createCategory.mutateAsync({ name });
    navigation.goBack();
  };

  return <Form onSubmit={handleSubmit} />;
}
```

**3. CLI Adapter**

```typescript
// Primary adapter - Command line
program.command("create-category <name>").action(async (name: string) => {
  // Adapter translates CLI args into command
  const result = await container
    .get<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase)
    .execute({ name });

  console.log(`Created category: ${result.id}`);
});
```

**4. GraphQL Adapter**

```typescript
// Primary adapter - GraphQL resolver
@Resolver()
export class CategoryResolver {
  constructor(private createCategoryUseCase: CreateCategoryUseCase) {}

  @Mutation(() => Category)
  async createCategory(@Args("input") input: CreateCategoryInput) {
    // Adapter translates GraphQL input into command
    const result = await this.createCategoryUseCase.execute({
      name: input.name,
    });

    return { id: result.id };
  }
}
```

---

## Secondary (Driven) Adapters

**Secondary adapters** are driven by the application - it calls them.

### Examples:

**1. Database Adapters**

```typescript
// Port defined by domain
interface ICategoryRepository {
  save(category: Category): Promise<void>;
}

// Adapter 1: In-memory (for testing)
class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<ULID, Category>();

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, category);
  }
}

// Adapter 2: AsyncStorage (for mobile)
class AsyncStorageCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    const json = JSON.stringify(category);
    await AsyncStorage.setItem(`cat:${category.id}`, json);
  }
}

// Adapter 3: SQLite (for production)
class SqliteCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    await this.db.run("INSERT INTO categories ...", [
      category.id,
      category.name,
    ]);
  }
}
```

**2. External API Adapters**

```typescript
// Port defined by application
interface IWeatherService {
  getCurrentTemperature(location: string): Promise<number>;
}

// Adapter: OpenWeather API
class OpenWeatherAdapter implements IWeatherService {
  async getCurrentTemperature(location: string): Promise<number> {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}`,
    );
    const data = await response.json();
    return data.main.temp;
  }
}

// Adapter: Mock (for testing)
class MockWeatherAdapter implements IWeatherService {
  async getCurrentTemperature(location: string): Promise<number> {
    return 72; // Always sunny!
  }
}
```

**3. Event Bus Adapters**

```typescript
// Port
interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
}

// Adapter 1: In-memory (synchronous)
class InMemoryEventBus implements IEventBus {
  async publish(event: DomainEvent): Promise<void> {
    this.handlers.forEach((h) => h.handle(event));
  }
}

// Adapter 2: Redis Pub/Sub (distributed)
class RedisEventBus implements IEventBus {
  async publish(event: DomainEvent): Promise<void> {
    await this.redis.publish("events", JSON.stringify(event));
  }
}

// Adapter 3: AWS SNS (cloud)
class SNSEventBus implements IEventBus {
  async publish(event: DomainEvent): Promise<void> {
    await this.sns.publish({
      TopicArn: this.topicArn,
      Message: JSON.stringify(event),
    });
  }
}
```

---

## Hexagonal Architecture in Our Project

### Current Structure

```
packages/
├── domain/                    # Core hexagon
│   ├── entities/             # Business objects
│   ├── valueObjects/         # Value objects
│   ├── services/             # Domain services
│   └── interfaces/           # Ports (defined by domain)
│       ├── ICategoryRepository.ts
│       ├── ISessionRepository.ts
│       └── TimeProvider.ts
│
├── application/              # Use cases (inside hexagon)
│   ├── useCases/
│   │   ├── CreateCategoryUseCase.ts
│   │   └── StartSessionUseCase.ts
│   └── queries/
│       └── ListCategoriesQuery.ts
│
├── infrastructure/           # Adapters (outside hexagon)
│   ├── persistence/          # Secondary adapters
│   │   ├── InMemoryCategoryRepository.ts
│   │   ├── AsyncStorageCategoryRepository.ts
│   │   └── SqliteCategoryRepository.ts
│   ├── time/
│   │   ├── RealTimeProvider.ts
│   │   └── MockTimeProvider.ts
│   └── events/
│       └── InMemoryEventBus.ts
│
└── apps/mobile/              # Primary adapter
    ├── screens/              # UI adapter
    ├── hooks/                # Bridge to use cases
    └── navigation/
```

### Dependency Flow

```
Primary Adapters → Ports → Application/Domain ← Ports ← Secondary Adapters

React Native → IUseCase → UseCases → Domain ← IRepository ← AsyncStorage
   (UI)                   (Core)                            (Database)
```

---

## Benefits of Hexagonal Architecture

### 1. **Technology Independence**

```typescript
// Domain doesn't care about storage technology
class CreateCategoryUseCase {
  constructor(
    private categoryRepo: ICategoryRepository, // Port!
  ) {}

  async execute(command: CreateCategoryCommand) {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category); // Don't care how!
  }
}

// Swap adapters without changing use case
// Development: InMemory
container
  .bind<ICategoryRepository>(TYPES.ICategoryRepository)
  .to(InMemoryCategoryRepository);

// Production: SQLite
container
  .bind<ICategoryRepository>(TYPES.ICategoryRepository)
  .to(SqliteCategoryRepository);
```

### 2. **Testability**

```typescript
describe("CreateCategoryUseCase", () => {
  it("should create category", async () => {
    // Use in-memory adapter for testing
    const repo = new InMemoryCategoryRepository();
    const useCase = new CreateCategoryUseCase(repo);

    await useCase.execute({ name: "Work" });

    const categories = await repo.findAll();
    expect(categories).toHaveLength(1);
  });
});
```

### 3. **Replaceability**

```typescript
// Start with simple implementation
class InMemoryCategoryRepository implements ICategoryRepository {
  // Quick to develop
}

// Later, swap to production implementation
class SqliteCategoryRepository implements ICategoryRepository {
  // Production-ready
}

// No changes to use cases needed!
```

### 4. **Multiple Adapters Simultaneously**

```typescript
// REST API adapter
@Controller("/categories")
class CategoryController {
  constructor(private createCategory: CreateCategoryUseCase) {}
}

// GraphQL adapter (same use case!)
@Resolver()
class CategoryResolver {
  constructor(private createCategory: CreateCategoryUseCase) {}
}

// CLI adapter (same use case!)
program.command("create-category").action(async (name) => {
  const useCase = container.get(CreateCategoryUseCase);
  await useCase.execute({ name });
});
```

---

## Hexagonal vs Clean Architecture

### Similarities

Both have:

- ✅ Core business logic at center
- ✅ Dependencies point inward
- ✅ Interfaces define boundaries
- ✅ Technology independence

### Differences

**Hexagonal:**

```
┌─────────────────────────┐
│   Primary Adapters      │ ← UI, API, CLI
├─────────────────────────┤
│   Ports (Interfaces)    │
├─────────────────────────┤
│   Application/Domain    │ ← Core
├─────────────────────────┤
│   Ports (Interfaces)    │
├─────────────────────────┤
│   Secondary Adapters    │ ← DB, APIs
└─────────────────────────┘

Focus: Ports and Adapters
```

**Clean Architecture:**

```
┌─────────────────────────┐
│   Frameworks & Drivers  │ ← UI, DB, External
├─────────────────────────┤
│   Interface Adapters    │ ← Controllers, Presenters
├─────────────────────────┤
│   Application Business  │ ← Use Cases
│        Rules            │
├─────────────────────────┤
│   Enterprise Business   │ ← Entities
│        Rules            │
└─────────────────────────┘

Focus: Layers with specific responsibilities
```

**In Practice:** They're complementary!

- **Clean Architecture** defines the layers
- **Hexagonal Architecture** defines how layers communicate (ports & adapters)

**Our Project:** Uses both!

- Clean Architecture layers (Domain, Application, Infrastructure, Presentation)
- Hexagonal ports & adapters (Interfaces and implementations)

---

## Implementing Hexagonal Architecture

### Step 1: Define Ports

```typescript
// packages/domain/interfaces/ICategoryRepository.ts
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  delete(id: ULID): Promise<void>;
}
```

### Step 2: Use Ports in Application

```typescript
// packages/application/useCases/CreateCategoryUseCase.ts
export class CreateCategoryUseCase {
  constructor(
    private categoryRepo: ICategoryRepository, // Port, not concrete class!
  ) {}

  async execute(command: CreateCategoryCommand) {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);
    return { id: category.id };
  }
}
```

### Step 3: Create Adapters

```typescript
// packages/infrastructure/persistence/InMemoryCategoryRepository.ts
export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<ULID, Category>();

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, category);
  }

  // ... implement other methods
}
```

### Step 4: Wire with DI

```typescript
// packages/infrastructure/di/container.ts
container
  .bind<ICategoryRepository>(TYPES.ICategoryRepository)
  .to(InMemoryCategoryRepository) // or SqliteCategoryRepository
  .inSingletonScope();

container.bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase).toSelf();
```

### Step 5: Use in Primary Adapter

```typescript
// apps/mobile/hooks/useCreateCategory.ts
export function useCreateCategory() {
  const container = useContainer();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase,
      );
      return await useCase.execute(command);
    },
  });
}
```

---

## Anti-Corruption Layer (ACL)

**Use ACL when integrating with external systems you don't control:**

```typescript
// External API has different model
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

// ACL translates external model to our domain
export class GoogleCalendarACL {
  toSession(event: GoogleCalendarEvent): Session {
    // Extract category from summary (our convention: "[Work] Meeting")
    const categoryName = this.extractCategory(event.summary);
    const category = await this.categoryRepo.findByName(categoryName);

    // Create session from event
    return Session.reconstitute({
      id: makeId(),
      categoryId: category.id,
      startTime: new Date(event.start.dateTime).getTime(),
      segments: [...]
    });
  }

  private extractCategory(summary: string): string {
    const match = summary.match(/\[([^\]]+)\]/);
    return match ? match[1] : 'General';
  }
}

// Use case uses ACL
class ImportFromGoogleCalendar {
  constructor(
    private googleClient: GoogleCalendarClient,
    private acl: GoogleCalendarACL
  ) {}

  async execute() {
    const events = await this.googleClient.getEvents();

    // ACL protects domain from external model
    const sessions = events.map(e => this.acl.toSession(e));

    // Work with domain model
    for (const session of sessions) {
      await this.sessionRepo.save(session);
    }
  }
}
```

---

## Best Practices

### ✅ DO:

**1. Define ports in domain/application**

```typescript
// ✅ Port in domain
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
}
```

**2. Implement adapters in infrastructure**

```typescript
// ✅ Adapter in infrastructure
export class SqliteCategoryRepository implements ICategoryRepository {
  // Implementation
}
```

**3. Use dependency injection**

```typescript
// ✅ Inject port, not adapter
constructor(private repo: ICategoryRepository) {}
```

**4. Keep adapters thin**

```typescript
// ✅ Adapter only translates
class AsyncStorageAdapter implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    // Just translate and store
    const json = JSON.stringify(this.toJSON(category));
    await AsyncStorage.setItem(`cat:${category.id}`, json);
  }
}
```

### ❌ DON'T:

**1. Don't leak adapter details into domain**

```typescript
// ❌ Domain knows about AsyncStorage
class Category {
  async save(): Promise<void> {
    await AsyncStorage.setItem(...); // ❌ NO!
  }
}
```

**2. Don't bypass ports**

```typescript
// ❌ Directly using adapter
class CreateCategoryUseCase {
  private repo = new SqliteCategoryRepository(); // ❌ NO!
}

// ✅ Use port
class CreateCategoryUseCase {
  constructor(private repo: ICategoryRepository) {} // ✅ YES!
}
```

**3. Don't put business logic in adapters**

```typescript
// ❌ Business logic in adapter
class CategoryRepository {
  async save(category: Category): Promise<void> {
    // ❌ Validation is business logic!
    if (category.name.length > 100) {
      throw new Error('Name too long');
    }

    await this.db.run(...);
  }
}

// ✅ Business logic in domain
class Category {
  constructor(params: { name: string }) {
    // ✅ Validation in domain
    if (params.name.length > 100) {
      throw new Error('Name too long');
    }
  }
}
```

---

## Summary

**Hexagonal Architecture:**

- Core business logic at center
- Isolated from external concerns
- Communicates through ports (interfaces)
- Connected by adapters (implementations)

**Ports:**

- **Primary (Driving):** How external world calls in
- **Secondary (Driven):** How application calls out
- Defined by application, not by adapters

**Adapters:**

- Concrete implementations of ports
- Translate between domain and external systems
- Swappable without changing core

**Benefits:**

- Technology independence
- Testability
- Flexibility
- Multiple adapters for same port

**In Our Project:**

- Ports: ICategoryRepository, TimeProvider, IEventBus
- Adapters: AsyncStorage, SQLite, RealTime, InMemory
- Primary: React Native UI, (future: REST API)
- Secondary: Repositories, Time, Events

**Key Pattern:** "Program to interfaces, not implementations"

---

## Related Documents

- [Clean Architecture Layers](./clean-architecture-layers.md)
- [Dependency Injection](./dependency-injection.md)
- [Repositories](./repositories.md)

---

## References

- **Hexagonal Architecture** by Alistair Cockburn
- **Growing Object-Oriented Software, Guided by Tests** by Steve Freeman
- **Clean Architecture** by Robert C. Martin
- **Implementing Domain-Driven Design** by Vaughn Vernon
