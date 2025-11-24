# Repositories

## What is a Repository?

A **Repository** is a pattern that mediates between the domain layer and data persistence. It provides a **collection-like interface** for accessing aggregates, abstracting away the details of how data is stored and retrieved.

Think of a repository as an **in-memory collection** of aggregates, even though the actual data might be in a database, file system, or external API.

### Key Principle

> "Repositories give the illusion that all objects are in memory, hiding all the complexity of persistence."

---

## Core Concepts

### 1. **Collection Metaphor**

```typescript
// Repository feels like an in-memory collection
const category = await categoryRepo.findById("some-id");
category.changeName({ name: "New Name" });
await categoryRepo.save(category);

// Feels like:
// const categories = new Map<string, Category>();
// const category = categories.get('some-id');
// category.changeName({ name: 'New Name' });
// categories.set(category.id, category);
```

### 2. **One Repository Per Aggregate Root**

```typescript
// ✅ Good - One repository per aggregate
interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
}

interface ISessionRepository {
  save(session: Session): Promise<void>;
  findById(id: ULID): Promise<Session | null>;
}

// ❌ Bad - Repository for child entity
interface ISessionSegmentRepository {
  // ❌ NO!
  // SessionSegment is not an aggregate root!
}
```

**Why?** Segments are part of Session aggregate - accessed through Session, not directly.

### 3. **Repository in Domain, Implementation in Infrastructure**

```typescript
// Domain layer - Interface
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
  findAll(): Promise<Category[]>;
}

// Infrastructure layer - Implementation
export class SqliteCategoryRepository implements ICategoryRepository {
  async save(category: Category): Promise<void> {
    // Database logic here
  }
}
```

**Why?** Dependency inversion - domain doesn't depend on infrastructure.

---

## Repository Interface Design

### Basic Operations

```typescript
export interface ICategoryRepository {
  // Save (create or update)
  save(category: Category): Promise<void>;

  // Find by ID
  findById(id: ULID): Promise<Category | null>;

  // Find all
  findAll(): Promise<Category[]>;

  // Delete
  delete(id: ULID): Promise<void>;
}
```

### Query Methods

```typescript
export interface ISessionRepository {
  // Basic operations
  save(session: Session): Promise<void>;
  findById(id: ULID): Promise<Session | null>;

  // Domain-specific queries
  findByCategory(categoryId: ULID): Promise<Session[]>;
  findActive(): Promise<Session[]>;
  findBetweenDates(start: DateTime, end: DateTime): Promise<Session[]>;
  findRecent(limit: number): Promise<Session[]>;
}
```

### Naming Conventions

**Good Names ✅**

- `findById(id)` - Single item
- `findByCategory(categoryId)` - Multiple items
- `findAll()` - All items
- `findActive()` - Filtered items
- `save(entity)` - Persist
- `delete(id)` - Remove

**Bad Names ❌**

- `get(id)` - Use `findById`
- `fetch(id)` - Use `findById`
- `loadCategory(id)` - Use `findById`
- `insert(entity)` - Use `save`
- `update(entity)` - Use `save`
- `saveOrUpdate(entity)` - Use `save`

---

## Repositories in Our Project

### Example 1: Category Repository

**Interface (Domain Layer):**

```typescript
// src/domain/repositories/ICategoryRepository.ts
export interface ICategoryRepository {
  /**
   * Save a category (create or update)
   */
  save(category: Category): Promise<void>;

  /**
   * Find category by ID
   * @returns Category if found, null otherwise
   */
  findById(id: ULID): Promise<Category | null>;

  /**
   * Find all categories
   */
  findAll(): Promise<Category[]>;

  /**
   * Delete a category
   */
  delete(id: ULID): Promise<void>;
}
```

**In-Memory Implementation (Infrastructure Layer):**

```typescript
// src/infrastructure/persistence/inMemory/InMemoryCategoryRepository.ts
import { injectable } from "inversify";
import { ICategoryRepository } from "@wimt/domain/repositories/ICategoryRepository";
import { Category } from "@wimt/domain/entities/Category";
import { ULID } from "@wimt/domain/valueObjects/ulid";

@injectable()
export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<string, Category>();

  async save(category: Category): Promise<void> {
    // Clone to prevent external modifications
    this.categories.set(category.id, category);
  }

  async findById(id: ULID): Promise<Category | null> {
    const category = this.categories.get(id);
    return category || null;
  }

  async findAll(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async delete(id: ULID): Promise<void> {
    this.categories.delete(id);
  }
}
```

### Example 2: Session Repository

**Interface (Domain Layer):**

```typescript
// src/domain/repositories/ISessionRepository.ts
export interface ISessionRepository {
  save(session: Session): Promise<void>;
  findById(id: ULID): Promise<Session | null>;
  findAll(): Promise<Session[]>;

  // Domain-specific queries
  findByCategory(categoryId: ULID): Promise<Session[]>;
  findActive(): Promise<Session[]>;
  findStopped(): Promise<Session[]>;
  findBetween(start: DateTime, end: DateTime): Promise<Session[]>;

  delete(id: ULID): Promise<void>;
}
```

**In-Memory Implementation:**

```typescript
@injectable()
export class InMemorySessionRepository implements ISessionRepository {
  private sessions = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findById(id: ULID): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async findAll(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async findByCategory(categoryId: ULID): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.getCategoryId() === categoryId,
    );
  }

  async findActive(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => !session.isStopped(),
    );
  }

  async findStopped(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((session) =>
      session.isStopped(),
    );
  }

  async findBetween(start: DateTime, end: DateTime): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((session) => {
      const sessionStart = session.getStartTime();
      return sessionStart >= start && sessionStart <= end;
    });
  }

  async delete(id: ULID): Promise<void> {
    this.sessions.delete(id);
  }
}
```

---

## Repository Responsibilities

### ✅ Repository Should:

**1. Persist and Retrieve Aggregates**

```typescript
// Save entire aggregate
await sessionRepo.save(session);

// Retrieve entire aggregate (with all child entities)
const session = await sessionRepo.findById(sessionId);
```

**2. Provide Query Methods**

```typescript
// Domain-meaningful queries
const activeSessions = await sessionRepo.findActive();
const categorySessions = await sessionRepo.findByCategory(categoryId);
```

**3. Hide Persistence Details**

```typescript
// Application doesn't care if it's SQL, NoSQL, or in-memory
await repo.save(category); // Could be Postgres, SQLite, or Map
```

**4. Maintain Aggregate Boundaries**

```typescript
// ✅ Good - Get entire aggregate
const session = await sessionRepo.findById(sessionId);
const segments = session.getSegments(); // Through aggregate

// ❌ Bad - Direct access to child entities
const segment = await segmentRepo.findById(segmentId); // NO!
```

### ❌ Repository Should NOT:

**1. Contain Business Logic**

```typescript
// ❌ Bad - Business logic in repository
class SessionRepository {
  async pauseSession(sessionId: ULID): Promise<void> {
    const session = await this.findById(sessionId);
    session.pause(); // Business logic!
    await this.save(session);
  }
}

// ✅ Good - Repository just persists
class SessionRepository {
  async save(session: Session): Promise<void> {
    // Just persistence
  }
}

// Business logic in use case
class PauseSessionUseCase {
  async execute(command: PauseSessionCommand): Promise<void> {
    const session = await this.sessionRepo.findById(command.sessionId);
    session.pause(this.timeProvider); // Business logic in domain!
    await this.sessionRepo.save(session);
  }
}
```

**2. Return DTOs**

```typescript
// ❌ Bad - Repository returns DTO
interface ISessionRepository {
  findById(id: ULID): Promise<SessionDTO>; // ❌ DTO!
}

// ✅ Good - Repository returns domain object
interface ISessionRepository {
  findById(id: ULID): Promise<Session>; // ✅ Domain entity!
}
```

**3. Depend on UI/Application Concerns**

```typescript
// ❌ Bad - Repository knows about pagination/sorting from UI
interface ICategoryRepository {
  findAll(page: number, pageSize: number, sortBy: string): Promise<Category[]>;
}

// ✅ Good - Simple domain methods
interface ICategoryRepository {
  findAll(): Promise<Category[]>;
}

// Application layer handles pagination
class ListCategoriesQuery {
  async execute(page: number, pageSize: number): Promise<CategoryDTO[]> {
    const allCategories = await this.categoryRepo.findAll();
    // Handle pagination in application layer
    return this.paginate(allCategories, page, pageSize);
  }
}
```

---

## Persistence Strategies

### Strategy 1: In-Memory (Development/Testing)

**Use When:**

- Rapid prototyping
- Testing
- Simple applications
- Learning DDD

**Pros:**

- Fast to implement
- No database setup
- Perfect for tests
- Easy to swap later

**Cons:**

- Data lost on restart
- Not scalable
- No querying power

**Implementation:**

```typescript
export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<string, Category>();

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, category);
  }
}
```

### Strategy 2: File System (Simple Persistence)

**Use When:**

- Small data volumes
- Simple requirements
- No concurrent access needed
- Desktop/mobile apps

**Implementation:**

```typescript
export class FileSystemCategoryRepository implements ICategoryRepository {
  constructor(private filePath: string) {}

  async save(category: Category): Promise<void> {
    const data = JSON.stringify(category.toJSON());
    await fs.writeFile(`${this.filePath}/${category.id}.json`, data);
  }

  async findById(id: ULID): Promise<Category | null> {
    try {
      const data = await fs.readFile(`${this.filePath}/${id}.json`, "utf8");
      return Category.fromJSON(JSON.parse(data));
    } catch {
      return null;
    }
  }
}
```

### Strategy 3: SQL Database (Relational)

**Use When:**

- Complex queries needed
- Relationships between data
- ACID transactions required
- Traditional web apps

**Implementation:**

```typescript
export class SqliteCategoryRepository implements ICategoryRepository {
  constructor(private db: Database) {}

  async save(category: Category): Promise<void> {
    await this.db.run(
      `
      INSERT OR REPLACE INTO categories (id, name, color, icon, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        category.id,
        category.name,
        category.color,
        category.icon,
        category.createdAt,
      ],
    );
  }

  async findById(id: ULID): Promise<Category | null> {
    const row = await this.db.get("SELECT * FROM categories WHERE id = ?", [
      id,
    ]);

    if (!row) return null;

    return new Category({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      color: row.color,
      icon: row.icon,
    });
  }
}
```

### Strategy 4: NoSQL/Document Store (React Native)

**Use When:**

- Mobile apps
- Offline-first
- Document-oriented data
- React Native with AsyncStorage

**Implementation:**

```typescript
export class AsyncStorageCategoryRepository implements ICategoryRepository {
  private readonly STORAGE_KEY = "@categories";

  async save(category: Category): Promise<void> {
    const all = await this.findAll();
    const index = all.findIndex((c) => c.id === category.id);

    if (index >= 0) {
      all[index] = category;
    } else {
      all.push(category);
    }

    await AsyncStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(all.map((c) => c.toJSON())),
    );
  }

  async findById(id: ULID): Promise<Category | null> {
    const all = await this.findAll();
    return all.find((c) => c.id === id) || null;
  }

  async findAll(): Promise<Category[]> {
    const json = await AsyncStorage.getItem(this.STORAGE_KEY);
    if (!json) return [];

    const data = JSON.parse(json);
    return data.map((item: any) => Category.fromJSON(item));
  }
}
```

---

## Reconstitution (Rebuilding Aggregates)

When loading from persistence, you need to **reconstitute** the aggregate without triggering business logic or events.

### Pattern: Factory Method

```typescript
class Category extends AggregateRoot {
  // Normal constructor - validates and emits events
  constructor(params: { name: string }) {
    super();
    this.ensureValidName(params.name);
    this.name = params.name;
    this.id = makeId();
    this.createdAt = Date.now();

    // Emit event for NEW category
    this.addEvent(new CategoryCreated(this.id, this.name, this.createdAt));
  }

  // Factory for reconstitution - no validation, no events
  static reconstitute(params: {
    id: ULID;
    name: string;
    createdAt: DateTime;
    color?: string | null;
    icon?: string | null;
  }): Category {
    const category = Object.create(Category.prototype);
    category.id = params.id;
    category.name = params.name;
    category.createdAt = params.createdAt;
    category.color = params.color ?? null;
    category.icon = params.icon ?? null;
    // No validation, no events - just rebuild from storage
    return category;
  }
}
```

**Usage in Repository:**

```typescript
async findById(id: ULID): Promise<Category | null> {
  const row = await this.db.get('SELECT * FROM categories WHERE id = ?', [id]);
  if (!row) return null;

  // Use reconstitute, not constructor!
  return Category.reconstitute({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    color: row.color,
    icon: row.icon
  });
}
```

---

## Unit of Work Pattern

**Problem:** Multiple aggregates need to be saved together atomically.

```typescript
// Without Unit of Work
async transferCategory(sessionId: ULID, newCategoryId: ULID): Promise<void> {
  const session = await sessionRepo.findById(sessionId);
  session.changeCategory(newCategoryId);
  await sessionRepo.save(session);

  const category = await categoryRepo.findById(newCategoryId);
  category.incrementUsageCount();
  await categoryRepo.save(category);

  // What if second save fails? First is already saved!
}
```

**With Unit of Work:**

```typescript
class UnitOfWork {
  private aggregates: AggregateRoot[] = [];

  register(aggregate: AggregateRoot): void {
    this.aggregates.push(aggregate);
  }

  async commit(): Promise<void> {
    // Start transaction
    await this.db.beginTransaction();

    try {
      for (const aggregate of this.aggregates) {
        await this.saveAggregate(aggregate);
      }
      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    } finally {
      this.aggregates = [];
    }
  }
}

// Usage
const uow = new UnitOfWork();

const session = await sessionRepo.findById(sessionId);
session.changeCategory(newCategoryId);
uow.register(session);

const category = await categoryRepo.findById(newCategoryId);
category.incrementUsageCount();
uow.register(category);

await uow.commit(); // Atomic!
```

---

## Testing Repositories

### Test In-Memory Implementation

```typescript
describe("InMemoryCategoryRepository", () => {
  let repository: InMemoryCategoryRepository;

  beforeEach(() => {
    repository = new InMemoryCategoryRepository();
  });

  it("should save and retrieve category", async () => {
    const category = new Category({ name: "Work" });

    await repository.save(category);
    const found = await repository.findById(category.id);

    expect(found).toBeDefined();
    expect(found!.name).toBe("Work");
  });

  it("should return null for non-existent ID", async () => {
    const found = await repository.findById("non-existent");

    expect(found).toBeNull();
  });

  it("should update existing category", async () => {
    const category = new Category({ name: "Work" });
    await repository.save(category);

    category.changeName({ name: "Professional" });
    await repository.save(category);

    const found = await repository.findById(category.id);
    expect(found!.name).toBe("Professional");
  });

  it("should find all categories", async () => {
    const cat1 = new Category({ name: "Work" });
    const cat2 = new Category({ name: "Hobby" });

    await repository.save(cat1);
    await repository.save(cat2);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
  });

  it("should delete category", async () => {
    const category = new Category({ name: "Work" });
    await repository.save(category);

    await repository.delete(category.id);

    const found = await repository.findById(category.id);
    expect(found).toBeNull();
  });
});
```

### Test Domain Logic, Not Persistence

```typescript
describe("Category persistence", () => {
  // ✅ Good - Test repository behavior
  it("should persist category with all properties", async () => {
    const category = new Category({ name: "Work" });
    category.setColor({ color: "#FF0000" });

    await repository.save(category);
    const found = await repository.findById(category.id);

    expect(found!.color).toBe("#FF0000");
  });

  // ❌ Bad - Testing database details
  it("should create correct SQL query", () => {
    // Don't test SQL queries - that's implementation detail
  });
});
```

---

## Common Patterns

### Pattern 1: Lazy Loading (Avoid in DDD)

```typescript
// ❌ Avoid - Lazy loading breaks aggregate boundaries
class Session {
  private _category?: Category;

  async getCategory(): Promise<Category> {
    if (!this._category) {
      this._category = await categoryRepo.findById(this.categoryId);
    }
    return this._category;
  }
}
```

**Why avoid?** Session aggregate shouldn't load Category aggregate. Load both in application layer.

### Pattern 2: Specifications

```typescript
// Encapsulate query logic
interface Specification<T> {
  isSatisfiedBy(item: T): boolean;
}

class ActiveSessionSpecification implements Specification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return !session.isStopped();
  }
}

// In repository
class InMemorySessionRepository {
  async find(spec: Specification<Session>): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((session) =>
      spec.isSatisfiedBy(session),
    );
  }
}
```

### Pattern 3: Query Object

```typescript
interface SessionQuery {
  categoryId?: ULID;
  startDate?: DateTime;
  endDate?: DateTime;
  isActive?: boolean;
}

interface ISessionRepository {
  query(query: SessionQuery): Promise<Session[]>;
}

// Usage
const sessions = await sessionRepo.query({
  categoryId: "cat-123",
  isActive: true,
  startDate: startOfWeek,
});
```

---

## Common Mistakes

### ❌ Mistake 1: Repository per Table

```typescript
// ❌ Bad - Database thinking
interface ISessionsTableRepository {}
interface ISegmentsTableRepository {}

// ✅ Good - Domain thinking
interface ISessionRepository {} // Session is aggregate root
// No segment repository - segments accessed through Session
```

### ❌ Mistake 2: Generic Repository

```typescript
// ❌ Bad - Too generic
interface IRepository<T> {
  save(entity: T): Promise<void>;
  findById(id: string): Promise<T>;
}

// ✅ Good - Specific to aggregate
interface ISessionRepository {
  save(session: Session): Promise<void>;
  findById(id: ULID): Promise<Session | null>;
  findByCategory(categoryId: ULID): Promise<Session[]>;
  // Domain-specific methods
}
```

### ❌ Mistake 3: Leaking Persistence Details

```typescript
// ❌ Bad - Exposing ORM entities
interface ICategoryRepository {
  findById(id: string): Promise<CategoryEntity>; // ❌ ORM entity!
}

// ✅ Good - Domain entities
interface ICategoryRepository {
  findById(id: ULID): Promise<Category>; // ✅ Domain entity!
}
```

---

## Summary

**Repositories:**

- **Mediate** between domain and persistence
- **One per aggregate root** - not per entity
- **Interface in domain** - implementation in infrastructure
- **Collection metaphor** - feels like in-memory collection
- **Hide persistence details** - swap implementations easily

**Responsibilities:**

- ✅ Load and save aggregates
- ✅ Provide domain queries
- ✅ Maintain aggregate boundaries
- ❌ No business logic
- ❌ No DTOs
- ❌ No UI concerns

**In Our Project:**

- `ICategoryRepository` - Interface in domain
- `ISessionRepository` - Interface in domain
- `InMemoryCategoryRepository` - Start with this
- `SqliteCategoryRepository` - Migrate later
- No `ISessionSegmentRepository` - Segments through Session!

**Key Principle:** Repositories make persistence feel like working with in-memory collections, while maintaining aggregate boundaries and hiding storage details.

---

## Related Documents

- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Domain Services](./domain-services.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 6: Repositories)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 12: Repositories)
- **Patterns of Enterprise Application Architecture** by Martin Fowler (Repository pattern)
