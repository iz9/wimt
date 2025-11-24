# Persistence Patterns

## Domain vs Persistence

**Domain models** are optimized for business logic. **Persistence models** are optimized for storage. They don't need to be the same!

### Key Principle

> "The domain model should not know or care about persistence details."

**The Problem:**

```typescript
// ❌ Domain entity tightly coupled to database
class Session {
  @Column() // ❌ ORM annotation in domain!
  private segments: SessionSegment[];

  @BeforeInsert() // ❌ Persistence hook in domain!
  validate(): void {}

  // ❌ Domain knows about database structure
  toRow(): DatabaseRow {}
}
```

**The Solution:**

```typescript
// ✅ Domain - Pure business logic
class Session {
  private segments: SessionSegment[]; // No persistence details

  pause(timeProvider: TimeProvider): void {
    // Pure domain logic
  }
}

// ✅ Persistence - Separate concern
class SessionMapper {
  toDomain(row: SessionRow): Session {
    // Map database to domain
  }

  toPersistence(session: Session): SessionRow {
    // Map domain to database
  }
}
```

---

## Repository Pattern (Review)

### Interface in Domain

```typescript
// Domain defines what it needs
export interface ISessionRepository {
  save(session: Session): Promise<void>;
  findById(id: ULID): Promise<Session | null>;
  findAll(): Promise<Session[]>;
  findActive(): Promise<Session | null>;
  delete(id: ULID): Promise<void>;
}
```

### Implementation in Infrastructure

```typescript
// Infrastructure provides implementation
@injectable()
export class InMemorySessionRepository implements ISessionRepository {
  private sessions = new Map<ULID, Session>();

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findById(id: ULID): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  // ... other methods
}
```

---

## Serialization Strategies

### 1. In-Memory (Simple)

**Just store objects directly:**

```typescript
export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<ULID, Category>();

  async save(category: Category): Promise<void> {
    // Store domain object directly
    this.categories.set(category.id, category);
  }

  async findById(id: ULID): Promise<Category | null> {
    // Return domain object directly
    return this.categories.get(id) || null;
  }
}
```

**Pros:**

- ✅ Simple - no mapping
- ✅ Fast - no serialization
- ✅ Perfect for testing

**Cons:**

- ❌ Data lost on restart
- ❌ Not scalable
- ❌ Can't share between processes

### 2. JSON Storage (React Native AsyncStorage)

**Serialize to JSON:**

```typescript
export class AsyncStorageCategoryRepository implements ICategoryRepository {
  private readonly STORAGE_KEY = "@categories";

  async save(category: Category): Promise<void> {
    // 1. Load all categories
    const categories = await this.loadAll();

    // 2. Update or add
    const index = categories.findIndex((c) => c.id === category.id);
    if (index >= 0) {
      categories[index] = category;
    } else {
      categories.push(category);
    }

    // 3. Serialize to JSON
    const json = JSON.stringify(this.serializeCategories(categories));

    // 4. Save to AsyncStorage
    await AsyncStorage.setItem(this.STORAGE_KEY, json);
  }

  async findById(id: ULID): Promise<Category | null> {
    const categories = await this.loadAll();
    return categories.find((c) => c.id === id) || null;
  }

  private async loadAll(): Promise<Category[]> {
    const json = await AsyncStorage.getItem(this.STORAGE_KEY);
    if (!json) return [];

    const data = JSON.parse(json);
    return this.deserializeCategories(data);
  }

  private serializeCategories(categories: Category[]): any[] {
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      createdAt: c.createdAt,
    }));
  }

  private deserializeCategories(data: any[]): Category[] {
    return data.map(
      (item) =>
        new Category({
          id: item.id,
          name: item.name,
          createdAt: item.createdAt,
          color: item.color,
          icon: item.icon,
        }),
    );
  }
}
```

**Pros:**

- ✅ Persists across restarts
- ✅ Built into React Native
- ✅ Simple key-value API

**Cons:**

- ❌ Load all data at once
- ❌ Not query-friendly
- ❌ No transactions

### 3. SQLite (Structured Queries)

**Use relational database:**

```typescript
// Database row type
interface CategoryRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: number;
}

export class SqliteCategoryRepository implements ICategoryRepository {
  constructor(private db: Database) {}

  async save(category: Category): Promise<void> {
    await this.db.run(
      `INSERT INTO categories (id, name, color, icon, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         color = excluded.color,
         icon = excluded.icon`,
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
    const row = await this.db.get<CategoryRow>(
      "SELECT * FROM categories WHERE id = ?",
      [id],
    );

    return row ? this.mapToDomain(row) : null;
  }

  async findAll(): Promise<Category[]> {
    const rows = await this.db.all<CategoryRow>(
      "SELECT * FROM categories ORDER BY name",
    );

    return rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: CategoryRow): Category {
    return new Category({
      id: row.id as ULID,
      name: row.name,
      color: row.color,
      icon: row.icon,
      createdAt: row.created_at,
    });
  }
}
```

**Pros:**

- ✅ Structured queries
- ✅ Indexes for performance
- ✅ Transactions
- ✅ Large datasets

**Cons:**

- ❌ More complex setup
- ❌ Schema migrations
- ❌ More boilerplate

---

## Mapping Domain to Persistence

### Pattern: Separate Mapper

```typescript
export class SessionMapper {
  // Domain → Database
  toPersistence(session: Session): SessionRow {
    return {
      id: session.id,
      category_id: session.getCategoryId(),
      start_time: session.getStartTime(),
      is_stopped: session.isStopped(),
      created_at: Date.now(),
    };
  }

  // Database → Domain
  toDomain(row: SessionRow, segments: SessionSegmentRow[]): Session {
    // Use factory for reconstitution
    return Session.reconstitute({
      id: row.id as ULID,
      categoryId: row.category_id as ULID,
      startTime: row.start_time,
      isStopped: row.is_stopped === 1,
      segments: segments.map((s) => this.segmentToDomain(s)),
    });
  }

  private segmentToDomain(row: SessionSegmentRow): SessionSegment {
    return new SessionSegment({
      id: row.id as ULID,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
    });
  }
}
```

### Pattern: Factory Reconstitution

```typescript
export class Session {
  // For creating NEW sessions
  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    const id = makeId();
    const startTime = timeProvider.now();

    const firstSegment = new SessionSegment({
      id: makeId(),
      startedAt: startTime,
      stoppedAt: null,
    });

    const session = new Session(
      id,
      categoryId,
      [firstSegment],
      false,
      startTime,
    );

    // Emit event for new session
    session.addEvent(
      new SessionStarted({
        sessionId: id,
        categoryId,
        startTime,
        occurredAt: startTime,
      }),
    );

    return session;
  }

  // For loading from database (reconstitution)
  static reconstitute(data: {
    id: ULID;
    categoryId: ULID;
    segments: SessionSegment[];
    isStopped: boolean;
    startTime: DateTime;
  }): Session {
    // No validation, no events
    return new Session(
      data.id,
      data.categoryId,
      data.segments,
      data.isStopped,
      data.startTime,
    );
  }
}
```

---

## Handling Aggregates

### Pattern: Save Root and Children Together

```typescript
export class SqliteSessionRepository implements ISessionRepository {
  async save(session: Session): Promise<void> {
    await this.db.runInTransaction(async () => {
      // 1. Save session (aggregate root)
      await this.db.run(
        `INSERT INTO sessions (id, category_id, start_time, is_stopped)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category_id = excluded.category_id,
           is_stopped = excluded.is_stopped`,
        [
          session.id,
          session.getCategoryId(),
          session.getStartTime(),
          session.isStopped() ? 1 : 0,
        ],
      );

      // 2. Delete old segments
      await this.db.run("DELETE FROM session_segments WHERE session_id = ?", [
        session.id,
      ]);

      // 3. Save new segments
      const segments = session.getSegments();
      for (const segment of segments) {
        await this.db.run(
          `INSERT INTO session_segments (id, session_id, started_at, stopped_at)
           VALUES (?, ?, ?, ?)`,
          [
            segment.id,
            session.id,
            segment.getStartedAt(),
            segment.getStoppedAt(),
          ],
        );
      }
    });
  }

  async findById(id: ULID): Promise<Session | null> {
    // 1. Load session
    const sessionRow = await this.db.get<SessionRow>(
      "SELECT * FROM sessions WHERE id = ?",
      [id],
    );

    if (!sessionRow) return null;

    // 2. Load segments
    const segmentRows = await this.db.all<SessionSegmentRow>(
      "SELECT * FROM session_segments WHERE session_id = ? ORDER BY started_at",
      [id],
    );

    // 3. Reconstitute aggregate
    return SessionMapper.toDomain(sessionRow, segmentRows);
  }
}
```

**Key:** Always load/save aggregate as a unit.

---

## Schema Design

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  is_stopped INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,

  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_sessions_category ON sessions(category_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);
CREATE INDEX idx_sessions_is_stopped ON sessions(is_stopped);
```

### Session Segments Table

```sql
CREATE TABLE session_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  stopped_at INTEGER,

  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_segments_session ON session_segments(session_id);
CREATE INDEX idx_segments_started_at ON session_segments(started_at);
```

### Categories Table

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  icon TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_categories_name ON categories(name);
```

---

## Migrations

### Pattern: Version-based Migrations

```typescript
export class DatabaseMigrations {
  private readonly migrations = [
    this.createInitialSchema, // v1
    this.addCategoryColor, // v2
    this.addCategoryIcon, // v3
    this.addSessionSegments, // v4
  ];

  async migrate(db: Database): Promise<void> {
    // Get current version
    const currentVersion = await this.getCurrentVersion(db);

    // Run pending migrations
    for (let i = currentVersion; i < this.migrations.length; i++) {
      console.log(`Running migration ${i + 1}...`);
      await this.migrations[i](db);
      await this.setVersion(db, i + 1);
    }
  }

  private async createInitialSchema(db: Database): Promise<void> {
    await db.exec(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        is_stopped INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);
  }

  private async addCategoryColor(db: Database): Promise<void> {
    await db.exec(`
      ALTER TABLE categories ADD COLUMN color TEXT;
    `);
  }

  private async addCategoryIcon(db: Database): Promise<void> {
    await db.exec(`
      ALTER TABLE categories ADD COLUMN icon TEXT;
    `);
  }

  private async addSessionSegments(db: Database): Promise<void> {
    await db.exec(`
      CREATE TABLE session_segments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        stopped_at INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      
      CREATE INDEX idx_segments_session ON session_segments(session_id);
    `);
  }

  private async getCurrentVersion(db: Database): Promise<number> {
    try {
      const result = await db.get<{ version: number }>(
        "SELECT version FROM schema_version",
      );
      return result?.version || 0;
    } catch {
      // Table doesn't exist, version is 0
      await db.exec(`
        CREATE TABLE schema_version (version INTEGER);
        INSERT INTO schema_version (version) VALUES (0);
      `);
      return 0;
    }
  }

  private async setVersion(db: Database, version: number): Promise<void> {
    await db.run("UPDATE schema_version SET version = ?", [version]);
  }
}
```

---

## Optimistic Concurrency

### Pattern: Version Number

```typescript
// Add version to entity
class Category {
  private version: number = 1;

  incrementVersion(): void {
    this.version++;
  }

  getVersion(): number {
    return this.version;
  }
}

// Check version in repository
export class SqliteCategoryRepository {
  async save(category: Category): Promise<void> {
    const result = await this.db.run(
      `UPDATE categories 
       SET name = ?, color = ?, version = ?
       WHERE id = ? AND version = ?`,
      [
        category.name,
        category.color,
        category.getVersion() + 1,
        category.id,
        category.getVersion(), // Current version
      ],
    );

    if (result.changes === 0) {
      throw new ConcurrencyError(
        `Category ${category.id} was modified by another operation`,
      );
    }

    category.incrementVersion();
  }
}
```

---

## Soft Deletes

### Pattern: Deleted Flag

```typescript
// Add deleted flag
class Category {
  private isDeleted: boolean = false;

  delete(): void {
    this.isDeleted = true;
    this.addEvent(new CategoryDeleted(this.id, Date.now()));
  }

  isActive(): boolean {
    return !this.isDeleted;
  }
}

// Schema
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER
);

// Repository only returns active by default
export class SqliteCategoryRepository {
  async findAll(): Promise<Category[]> {
    const rows = await this.db.all<CategoryRow>(
      'SELECT * FROM categories WHERE is_deleted = 0 ORDER BY name'
    );
    return rows.map(row => this.mapToDomain(row));
  }

  async findAllIncludingDeleted(): Promise<Category[]> {
    const rows = await this.db.all<CategoryRow>(
      'SELECT * FROM categories ORDER BY name'
    );
    return rows.map(row => this.mapToDomain(row));
  }
}
```

---

## Testing Persistence

### Test In-Memory

```typescript
describe("InMemoryCategoryRepository", () => {
  let repo: InMemoryCategoryRepository;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
  });

  it("should save and retrieve category", async () => {
    const category = new Category({ name: "Work" });

    await repo.save(category);

    const retrieved = await repo.findById(category.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Work");
  });
});
```

### Test SQLite

```typescript
describe("SqliteCategoryRepository", () => {
  let db: Database;
  let repo: SqliteCategoryRepository;

  beforeEach(async () => {
    // Use in-memory SQLite for tests
    db = await openDatabase(":memory:");

    // Run migrations
    await new DatabaseMigrations().migrate(db);

    repo = new SqliteCategoryRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("should persist category across instances", async () => {
    const category = new Category({ name: "Work" });
    await repo.save(category);

    // Create new repository instance
    const newRepo = new SqliteCategoryRepository(db);

    const retrieved = await newRepo.findById(category.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Work");
  });
});
```

---

## Best Practices

### ✅ DO:

**1. Keep domain pure**

```typescript
// ✅ Domain - No persistence details
class Session {
  private segments: SessionSegment[];
}

// ❌ Domain - Knows about database
class Session {
  @Column()
  private segments: SessionSegment[];
}
```

**2. Use factories for reconstitution**

```typescript
// ✅ Separate creation from reconstitution
static create(...): Session { }      // New sessions
static reconstitute(...): Session { } // From database
```

**3. Save aggregates atomically**

```typescript
// ✅ Transaction for aggregate
await db.runInTransaction(async () => {
  await saveSession(session);
  await saveSegments(session.getSegments());
});
```

**4. Map at repository boundary**

```typescript
// ✅ Mapper in infrastructure
class SessionMapper {
  toDomain(row: SessionRow): Session {}
  toPersistence(session: Session): SessionRow {}
}
```

### ❌ DON'T:

**1. Don't use ORM annotations in domain**

```typescript
// ❌ Bad - ORM in domain
class Session {
  @Column()
  private categoryId: ULID;
}
```

**2. Don't expose database details**

```typescript
// ❌ Bad - Returns database row
async findById(id: ULID): Promise<SessionRow> { }

// ✅ Good - Returns domain object
async findById(id: ULID): Promise<Session | null> { }
```

**3. Don't emit events on reconstitution**

```typescript
// ❌ Bad - Events on load
static reconstitute(data: any): Session {
  const session = new Session(...);
  session.addEvent(new SessionLoaded(...)); // ❌ NO!
  return session;
}

// ✅ Good - Events only for business operations
static create(...): Session {
  const session = new Session(...);
  session.addEvent(new SessionCreated(...)); // ✅ YES!
  return session;
}
```

---

## Summary

**Persistence Strategies:**

- **In-Memory:** Testing, development
- **JSON (AsyncStorage):** Simple persistence, small data
- **SQLite:** Structured queries, large data

**Mapping:**

- Separate mapper classes
- Domain → Persistence
- Persistence → Domain (reconstitution)

**Aggregates:**

- Save/load as unit
- Use transactions
- Root controls all access

**Schema:**

- Design for queries
- Add indexes
- Use migrations

**In Our Project:**

- Start with InMemory for tests
- AsyncStorage for MVP
- SQLite when needed
- Clean separation: domain ← repository → persistence

**Key Benefit:** Domain stays pure, persistence can evolve independently!

---

## Related Documents

- [Repositories](./repositories.md)
- [Factories](./factories.md)
- [Testing Domain Models](./testing-domain-models.md)

---

## References

- **Patterns of Enterprise Application Architecture** by Martin Fowler
- **Domain-Driven Design** by Eric Evans (Chapter 6: Lifecycle of a Domain Object)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 12: Repositories)
