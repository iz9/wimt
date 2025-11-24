# Read Models & Query Optimization

## What are Read Models?

**Read Models** are denormalized, optimized data structures specifically designed for querying and display. Unlike the domain model (optimized for business logic), read models are optimized for reads.

### Key Principle

> "Write models (domain) are optimized for consistency. Read models are optimized for performance."

**The Problem:**

```typescript
// ❌ Slow query - multiple joins, calculations on every read
async getCategoryWithStats(categoryId: ULID): Promise<CategoryWithStats> {
  const category = await this.categoryRepo.findById(categoryId);
  const sessions = await this.sessionRepo.findByCategory(categoryId);

  // Calculate on every read!
  const totalDuration = sessions.reduce(
    (sum, s) => sum + s.getTotalDuration().toMilliseconds(),
    0
  );

  const sessionCount = sessions.length;
  const lastUsed = sessions.length > 0
    ? Math.max(...sessions.map(s => s.getStartTime()))
    : null;

  return {
    ...category,
    totalDuration,
    sessionCount,
    lastUsed
  };
}
```

**The Solution:**

```typescript
// ✅ Fast query - pre-calculated, denormalized
async getCategoryWithStats(categoryId: ULID): Promise<CategoryWithStats> {
  // Just read from optimized read model
  return await this.categoryReadModel.findById(categoryId);
}

// Read model is updated when sessions change
class SessionStoppedHandler {
  async handle(event: SessionStopped) {
    await this.categoryReadModel.incrementTotalDuration(
      event.categoryId,
      event.duration
    );
    await this.categoryReadModel.incrementSessionCount(event.categoryId);
    await this.categoryReadModel.updateLastUsed(event.categoryId, event.stopTime);
  }
}
```

---

## CQRS Read Side

### Write Model vs Read Model

```
┌─────────────────────────────────────────────────────────┐
│                    WRITE SIDE                           │
│                                                         │
│  Commands → Use Cases → Domain Model → Events          │
│                                                         │
│  - Optimized for consistency                           │
│  - Business logic                                       │
│  - Normalized                                           │
│  - Complex aggregates                                   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Domain Events
                         ↓
┌─────────────────────────────────────────────────────────┐
│                     READ SIDE                           │
│                                                         │
│  Events → Handlers → Read Models → Queries             │
│                                                         │
│  - Optimized for performance                           │
│  - Denormalized                                         │
│  - Pre-calculated                                       │
│  - Fast queries                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Read Model Patterns

### Pattern 1: In-Memory Read Model

**Simple, for small datasets:**

```typescript
export interface CategoryReadModel {
  id: ULID;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: DateTime;

  // Denormalized fields
  sessionCount: number;
  totalDurationMs: number;
  lastUsedAt: DateTime | null;
  isActive: boolean; // Has active session
}

@injectable()
export class InMemoryCategoryReadModel {
  private categories = new Map<ULID, CategoryReadModel>();

  async insert(model: CategoryReadModel): Promise<void> {
    this.categories.set(model.id, { ...model });
  }

  async update(id: ULID, updates: Partial<CategoryReadModel>): Promise<void> {
    const existing = this.categories.get(id);
    if (!existing) return;

    this.categories.set(id, { ...existing, ...updates });
  }

  async findById(id: ULID): Promise<CategoryReadModel | null> {
    return this.categories.get(id) || null;
  }

  async findAll(): Promise<CategoryReadModel[]> {
    return Array.from(this.categories.values());
  }

  async incrementSessionCount(id: ULID): Promise<void> {
    const category = this.categories.get(id);
    if (!category) return;

    category.sessionCount++;
  }

  async incrementTotalDuration(id: ULID, durationMs: number): Promise<void> {
    const category = this.categories.get(id);
    if (!category) return;

    category.totalDurationMs += durationMs;
  }

  async updateLastUsed(id: ULID, time: DateTime): Promise<void> {
    const category = this.categories.get(id);
    if (!category) return;

    if (!category.lastUsedAt || time > category.lastUsedAt) {
      category.lastUsedAt = time;
    }
  }
}
```

### Pattern 2: Database Read Model (SQLite/PostgreSQL)

**For larger datasets:**

```typescript
export interface CategoryReadModelRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: number;
  session_count: number;
  total_duration_ms: number;
  last_used_at: number | null;
  is_active: number; // 0 or 1
}

@injectable()
export class SqliteCategoryReadModel {
  constructor(
    @inject(TYPES.IDatabase)
    private db: Database,
  ) {}

  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS category_read_model (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        created_at INTEGER NOT NULL,
        session_count INTEGER DEFAULT 0,
        total_duration_ms INTEGER DEFAULT 0,
        last_used_at INTEGER,
        is_active INTEGER DEFAULT 0,
        
        -- Indexes for common queries
        CREATE INDEX idx_category_name ON category_read_model(name);
        CREATE INDEX idx_category_last_used ON category_read_model(last_used_at);
      )
    `);
  }

  async insert(model: CategoryReadModel): Promise<void> {
    await this.db.run(
      `INSERT INTO category_read_model 
       (id, name, color, icon, created_at, session_count, total_duration_ms, last_used_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        model.id,
        model.name,
        model.color,
        model.icon,
        model.createdAt,
        model.sessionCount,
        model.totalDurationMs,
        model.lastUsedAt,
        model.isActive ? 1 : 0,
      ],
    );
  }

  async findById(id: ULID): Promise<CategoryReadModel | null> {
    const row = await this.db.get<CategoryReadModelRow>(
      "SELECT * FROM category_read_model WHERE id = ?",
      [id],
    );

    return row ? this.mapToModel(row) : null;
  }

  async findAll(): Promise<CategoryReadModel[]> {
    const rows = await this.db.all<CategoryReadModelRow>(
      "SELECT * FROM category_read_model ORDER BY name",
    );

    return rows.map((row) => this.mapToModel(row));
  }

  async findActive(): Promise<CategoryReadModel[]> {
    const rows = await this.db.all<CategoryReadModelRow>(
      "SELECT * FROM category_read_model WHERE is_active = 1 ORDER BY last_used_at DESC",
    );

    return rows.map((row) => this.mapToModel(row));
  }

  async incrementSessionCount(id: ULID): Promise<void> {
    await this.db.run(
      "UPDATE category_read_model SET session_count = session_count + 1 WHERE id = ?",
      [id],
    );
  }

  async incrementTotalDuration(id: ULID, durationMs: number): Promise<void> {
    await this.db.run(
      "UPDATE category_read_model SET total_duration_ms = total_duration_ms + ? WHERE id = ?",
      [durationMs, id],
    );
  }

  async updateLastUsed(id: ULID, time: DateTime): Promise<void> {
    await this.db.run(
      `UPDATE category_read_model 
       SET last_used_at = ? 
       WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)`,
      [time, id, time],
    );
  }

  private mapToModel(row: CategoryReadModelRow): CategoryReadModel {
    return {
      id: row.id as ULID,
      name: row.name,
      color: row.color,
      icon: row.icon,
      createdAt: row.created_at,
      sessionCount: row.session_count,
      totalDurationMs: row.total_duration_ms,
      lastUsedAt: row.last_used_at,
      isActive: row.is_active === 1,
    };
  }
}
```

---

## Updating Read Models

### Pattern: Event Handlers Update Read Models

```typescript
// When category is created, insert into read model
@injectable()
export class CategoryCreatedReadModelHandler
  implements IEventHandler<CategoryCreated>
{
  constructor(
    @inject(TYPES.ICategoryReadModel)
    private readModel: ICategoryReadModel,
  ) {}

  async handle(event: CategoryCreated): Promise<void> {
    await this.readModel.insert({
      id: event.categoryId,
      name: event.categoryName,
      color: null,
      icon: null,
      createdAt: event.occurredAt,
      sessionCount: 0,
      totalDurationMs: 0,
      lastUsedAt: null,
      isActive: false,
    });
  }
}

// When session starts, update read model
@injectable()
export class SessionStartedReadModelHandler
  implements IEventHandler<SessionStarted>
{
  constructor(
    @inject(TYPES.ICategoryReadModel)
    private readModel: ICategoryReadModel,
  ) {}

  async handle(event: SessionStarted): Promise<void> {
    // Increment session count
    await this.readModel.incrementSessionCount(event.categoryId);

    // Update last used
    await this.readModel.updateLastUsed(event.categoryId, event.startTime);

    // Mark as active
    await this.readModel.update(event.categoryId, { isActive: true });
  }
}

// When session stops, update statistics
@injectable()
export class SessionStoppedReadModelHandler
  implements IEventHandler<SessionStopped>
{
  constructor(
    @inject(TYPES.ICategoryReadModel)
    private categoryReadModel: ICategoryReadModel,

    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,
  ) {}

  async handle(event: SessionStopped): Promise<void> {
    // Load session to get duration
    const session = await this.sessionRepo.findById(event.sessionId);
    if (!session) return;

    const duration = session.getTotalDuration();

    // Update read model
    await this.categoryReadModel.incrementTotalDuration(
      event.categoryId,
      duration.toMilliseconds(),
    );

    // Mark as not active
    await this.categoryReadModel.update(event.categoryId, { isActive: false });
  }
}
```

---

## Query Optimization Techniques

### 1. Denormalization

**Problem: Multiple joins**

```typescript
// ❌ Slow - Join sessions with categories
async getSessionsWithCategoryNames(): Promise<SessionDTO[]> {
  const sessions = await this.sessionRepo.findAll();

  // N+1 query problem!
  const dtos = await Promise.all(
    sessions.map(async session => {
      const category = await this.categoryRepo.findById(session.getCategoryId());
      return {
        ...session,
        categoryName: category?.name || 'Unknown'
      };
    })
  );

  return dtos;
}
```

**Solution: Denormalize in read model**

```typescript
// ✅ Fast - Category name already in read model
export interface SessionReadModel {
  id: ULID;
  categoryId: ULID;
  categoryName: string; // ← Denormalized!
  startTime: DateTime;
  totalDurationMs: number;
  isActive: boolean;
}

async getSessionsWithCategoryNames(): Promise<SessionDTO[]> {
  // Single query, no joins
  return await this.sessionReadModel.findAll();
}
```

### 2. Pre-calculation

**Problem: Expensive calculations on every read**

```typescript
// ❌ Slow - Calculate on every query
async getCategoryStatistics(categoryId: ULID): Promise<CategoryStats> {
  const sessions = await this.sessionRepo.findByCategory(categoryId);

  // Expensive calculation
  const totalDuration = sessions.reduce(
    (sum, s) => sum + s.getTotalDuration().toMilliseconds(),
    0
  );

  const averageDuration = totalDuration / sessions.length;

  return { totalDuration, averageDuration, sessionCount: sessions.length };
}
```

**Solution: Pre-calculate and store**

```typescript
// ✅ Fast - Already calculated
async getCategoryStatistics(categoryId: ULID): Promise<CategoryStats> {
  const readModel = await this.categoryReadModel.findById(categoryId);

  return {
    totalDuration: readModel.totalDurationMs,
    averageDuration: readModel.totalDurationMs / readModel.sessionCount,
    sessionCount: readModel.sessionCount
  };
}
```

### 3. Indexing

```sql
-- Index frequently queried fields
CREATE INDEX idx_category_name ON category_read_model(name);
CREATE INDEX idx_category_last_used ON category_read_model(last_used_at);
CREATE INDEX idx_category_active ON category_read_model(is_active);

-- Compound index for common query
CREATE INDEX idx_category_active_last_used
  ON category_read_model(is_active, last_used_at);
```

### 4. Caching

```typescript
@injectable()
export class CachedCategoryReadModel implements ICategoryReadModel {
  private cache = new Map<ULID, CategoryReadModel>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(
    @inject(TYPES.ICategoryReadModel)
    private underlying: ICategoryReadModel,
  ) {}

  async findById(id: ULID): Promise<CategoryReadModel | null> {
    // Check cache
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    // Load from underlying
    const model = await this.underlying.findById(id);

    // Cache it
    if (model) {
      this.cache.set(id, model);

      // Auto-expire
      setTimeout(() => this.cache.delete(id), this.cacheExpiry);
    }

    return model;
  }

  async invalidate(id: ULID): Promise<void> {
    this.cache.delete(id);
  }

  async invalidateAll(): Promise<void> {
    this.cache.clear();
  }
}
```

---

## Eventual Consistency

### Understanding the Trade-off

**Strong Consistency (Traditional):**

```typescript
// Write and read see same data immediately
await createCategoryUseCase.execute({ name: "Work" });

const category = await getCategoryQuery.execute({ id });
// ✅ Category exists immediately
```

**Eventual Consistency (CQRS with Read Models):**

```typescript
// Write completes...
await createCategoryUseCase.execute({ name: "Work" });

// Read model updated async
const category = await getCategoryQuery.execute({ id });
// ⚠️ Might not exist yet (for a few milliseconds)
```

### Handling Eventual Consistency

**Pattern 1: Return ID from Command**

```typescript
// Command returns ID
const result = await createCategoryUseCase.execute({ name: "Work" });

// Use ID to query (guaranteed to exist in write model)
const category = await getCategoryQuery.execute({ id: result.id });
```

**Pattern 2: Optimistic UI Updates**

```typescript
// In React
const createCategory = async (name: string) => {
  // Optimistically add to UI
  const tempId = makeId();
  setCategories((prev) => [
    ...prev,
    {
      id: tempId,
      name,
      sessionCount: 0,
      isOptimistic: true, // Mark as tentative
    },
  ]);

  try {
    // Create on server
    const result = await createCategoryUseCase.execute({ name });

    // Replace optimistic with real
    setCategories((prev) =>
      prev.map((c) =>
        c.id === tempId ? { ...c, id: result.id, isOptimistic: false } : c,
      ),
    );
  } catch (error) {
    // Rollback optimistic update
    setCategories((prev) => prev.filter((c) => c.id !== tempId));
  }
};
```

**Pattern 3: Polling**

```typescript
// Poll until read model updated
const waitForReadModel = async (
  id: ULID,
  maxAttempts = 10,
): Promise<CategoryReadModel> => {
  for (let i = 0; i < maxAttempts; i++) {
    const model = await categoryReadModel.findById(id);
    if (model) {
      return model;
    }

    // Wait 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Read model update timeout");
};
```

---

## Materialized Views

### Concept

A **materialized view** is a pre-computed query result stored as a table.

```sql
-- Traditional view (query every time)
CREATE VIEW category_statistics AS
  SELECT
    c.id,
    c.name,
    COUNT(s.id) as session_count,
    SUM(s.total_duration_ms) as total_duration_ms
  FROM categories c
  LEFT JOIN sessions s ON c.id = s.category_id
  GROUP BY c.id;

-- Materialized view (stored result, refreshed periodically)
CREATE MATERIALIZED VIEW category_statistics_mv AS
  SELECT
    c.id,
    c.name,
    COUNT(s.id) as session_count,
    SUM(s.total_duration_ms) as total_duration_ms
  FROM categories c
  LEFT JOIN sessions s ON c.id = s.category_id
  GROUP BY c.id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW category_statistics_mv;
```

### Event-Driven Materialized View

```typescript
// Update materialized view when events occur
@injectable()
export class UpdateCategoryStatisticsMaterializedView
  implements IEventHandler<SessionStopped>
{
  constructor(
    @inject(TYPES.IDatabase)
    private db: Database,
  ) {}

  async handle(event: SessionStopped): Promise<void> {
    // Recalculate statistics for this category
    await this.db.run(
      `
      INSERT INTO category_statistics_mv (id, name, session_count, total_duration_ms)
      SELECT 
        c.id,
        c.name,
        COUNT(s.id),
        SUM(s.total_duration_ms)
      FROM categories c
      LEFT JOIN sessions s ON c.id = s.category_id
      WHERE c.id = ?
      GROUP BY c.id
      ON CONFLICT(id) DO UPDATE SET
        session_count = excluded.session_count,
        total_duration_ms = excluded.total_duration_ms
    `,
      [event.categoryId],
    );
  }
}
```

---

## Testing Read Models

### Test Read Model Updates

```typescript
describe("CategoryReadModel", () => {
  let readModel: InMemoryCategoryReadModel;

  beforeEach(() => {
    readModel = new InMemoryCategoryReadModel();
  });

  it("should insert category", async () => {
    await readModel.insert({
      id: "cat-1" as ULID,
      name: "Work",
      color: null,
      icon: null,
      createdAt: 1000,
      sessionCount: 0,
      totalDurationMs: 0,
      lastUsedAt: null,
      isActive: false,
    });

    const category = await readModel.findById("cat-1" as ULID);
    expect(category).toBeDefined();
    expect(category!.name).toBe("Work");
  });

  it("should increment session count", async () => {
    await readModel.insert({
      id: "cat-1" as ULID,
      name: "Work",
      sessionCount: 0,
      // ...
    });

    await readModel.incrementSessionCount("cat-1" as ULID);
    await readModel.incrementSessionCount("cat-1" as ULID);

    const category = await readModel.findById("cat-1" as ULID);
    expect(category!.sessionCount).toBe(2);
  });
});
```

### Test Event Handlers

```typescript
describe("SessionStoppedReadModelHandler", () => {
  let handler: SessionStoppedReadModelHandler;
  let readModel: InMemoryCategoryReadModel;
  let sessionRepo: InMemorySessionRepository;

  beforeEach(() => {
    readModel = new InMemoryCategoryReadModel();
    sessionRepo = new InMemorySessionRepository();
    handler = new SessionStoppedReadModelHandler(readModel, sessionRepo);
  });

  it("should update read model when session stops", async () => {
    // Setup
    const session = createSession();
    await sessionRepo.save(session);

    await readModel.insert({
      id: session.getCategoryId(),
      name: "Work",
      totalDurationMs: 0,
      // ...
    });

    // Handle event
    const event = new SessionStopped({
      sessionId: session.id,
      categoryId: session.getCategoryId(),
      occurredAt: Date.now(),
    });

    await handler.handle(event);

    // Verify
    const category = await readModel.findById(session.getCategoryId());
    expect(category!.totalDurationMs).toBeGreaterThan(0);
    expect(category!.isActive).toBe(false);
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Use read models for complex queries**

```typescript
// ✅ Good - Optimized read model
const categories = await categoryReadModel.findAllWithStats();

// ❌ Bad - Calculate on every query
const categories = await Promise.all(
  (await categoryRepo.findAll()).map(async (c) => ({
    ...c,
    stats: await calculateStats(c.id),
  })),
);
```

**2. Update read models via events**

```typescript
// ✅ Good - Event-driven
class SessionStoppedHandler {
  async handle(event: SessionStopped) {
    await readModel.updateStats(event.categoryId);
  }
}
```

**3. Keep read models simple**

```typescript
// ✅ Good - Flat structure
interface CategoryReadModel {
  id: ULID;
  name: string;
  sessionCount: number;
}

// ❌ Bad - Complex nested structure
interface CategoryReadModel {
  category: {
    details: {
      info: {
        name: string;
      };
    };
  };
}
```

### ❌ DON'T:

**1. Don't query write model for reads**

```typescript
// ❌ Bad - Using domain model for queries
const sessions = await sessionRepo.findAll();
const dtos = sessions.map((s) => this.toDTO(s));

// ✅ Good - Using read model
const sessions = await sessionReadModel.findAll();
```

**2. Don't update read model in use cases**

```typescript
// ❌ Bad - Use case updating read model
class CreateCategoryUseCase {
  async execute(command) {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);
    await this.readModel.insert(category); // ❌ NO!
  }
}

// ✅ Good - Event handler updates read model
class CategoryCreatedHandler {
  async handle(event: CategoryCreated) {
    await this.readModel.insert(event);
  }
}
```

---

## Summary

**Read Models:**

- Denormalized data structures
- Optimized for queries
- Updated via domain events
- Eventual consistency

**Benefits:**

- ⚡ Fast queries
- 📊 Pre-calculated statistics
- 🎯 Optimized for specific views
- 📈 Scalable reads

**Patterns:**

- In-memory (small data)
- Database (large data)
- Cached (frequently accessed)
- Materialized views (complex aggregations)

**In Our Project:**

- `CategoryReadModel` - Pre-calculated stats
- `SessionReadModel` - Denormalized with category name
- Event handlers update read models
- Queries use read models, not domain

**Key Trade-off:** Eventual consistency for performance.

---

## Related Documents

- [Commands and Queries](./commands-and-queries.md)
- [Event Handlers](./event-handlers.md)
- [Domain Events](./domain-events.md)

---

## References

- **CQRS** by Greg Young
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 12: Repositories)
- **Building Event-Driven Microservices** by Adam Bellemare
