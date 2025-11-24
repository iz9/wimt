# Architecture Styles Comparison

## Comparing Popular Architectures

Understanding different architectural styles helps you choose the right approach for your project and understand the trade-offs of each pattern.

### Key Question

> "Which architecture should I use, and why?"

This guide compares:

1. **Layered Architecture** (Traditional N-Tier)
2. **Hexagonal Architecture** (Ports & Adapters)
3. **Onion Architecture**
4. **Clean Architecture**
5. **Domain-Driven Design** (DDD)

---

## 1. Layered Architecture (N-Tier)

### Structure

```
┌─────────────────────────┐
│   Presentation Layer    │  UI, Controllers
├─────────────────────────┤
│   Business Logic Layer  │  Services, Domain Logic
├─────────────────────────┤
│   Data Access Layer     │  Repositories, ORM
├─────────────────────────┤
│   Database Layer        │  SQL, Storage
└─────────────────────────┘

Dependencies: Top → Bottom (each layer depends on layer below)
```

### Example

```typescript
// Presentation Layer
class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Get()
  async getAll() {
    return await this.categoryService.getAllCategories();
  }
}

// Business Logic Layer
class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  async getAllCategories() {
    return await this.categoryRepository.findAll();
  }

  async createCategory(name: string) {
    // Business logic
    if (name.length > 100) throw new Error("Name too long");
    return await this.categoryRepository.save(new Category(name));
  }
}

// Data Access Layer
class CategoryRepository {
  async findAll() {
    return await db.query("SELECT * FROM categories");
  }

  async save(category: Category) {
    await db.query("INSERT INTO categories ...");
  }
}
```

### ✅ Pros

- **Simple:** Easy to understand
- **Familiar:** Most developers know this pattern
- **Quick start:** Fast to implement
- **Tool support:** Many frameworks support this

### ❌ Cons

- **Database-centric:** Domain depends on database
- **Hard to test:** Each layer depends on layer below
- **Technology coupling:** Business logic tied to infrastructure
- **Rigid dependencies:** Can't invert dependencies easily

### When to Use

- ✅ Small CRUD applications
- ✅ Prototypes and MVPs
- ✅ Simple business logic
- ❌ Complex domain logic
- ❌ Need for testability
- ❌ Multiple data sources

---

## 2. Hexagonal Architecture (Ports & Adapters)

### Structure

```
        ┌─────────────────────────────┐
        │   Primary Adapters          │  UI, API, CLI
        │   (Drive Application)       │
        └────────────┬────────────────┘
                     │
        ┌────────────▼────────────────┐
        │   Primary Ports             │  Use Cases Interfaces
        ├─────────────────────────────┤
        │                             │
        │   Application Core          │  Business Logic
        │   (Domain + Use Cases)      │
        │                             │
        ├─────────────────────────────┤
        │   Secondary Ports           │  Repository Interfaces
        └────────────┬────────────────┘
                     │
        ┌────────────▼────────────────┐
        │   Secondary Adapters        │  Database, APIs
        │   (Driven by Application)   │
        └─────────────────────────────┘

Dependencies: Adapters → Ports → Core (all point inward)
```

### Example

```typescript
// Port (Interface)
interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findAll(): Promise<Category[]>;
}

// Core (Domain)
class Category {
  constructor(public name: string) {
    if (name.length > 100) throw new Error("Name too long");
  }
}

// Core (Use Case)
class CreateCategoryUseCase {
  constructor(private repository: ICategoryRepository) {} // Port!

  async execute(name: string) {
    const category = new Category(name);
    await this.repository.save(category);
  }
}

// Adapter (Implementation)
class SqlCategoryRepository implements ICategoryRepository {
  async save(category: Category) {
    await db.query("INSERT INTO categories ...");
  }

  async findAll() {
    const rows = await db.query("SELECT * FROM categories");
    return rows.map((r) => new Category(r.name));
  }
}

// Primary Adapter (UI)
class CategoryController {
  constructor(private createCategory: CreateCategoryUseCase) {}

  @Post()
  async create(@Body() dto: CreateCategoryDTO) {
    await this.createCategory.execute(dto.name);
  }
}
```

### ✅ Pros

- **Technology independence:** Core doesn't know about database
- **Testable:** Easy to mock ports
- **Flexible:** Swap adapters without changing core
- **Multiple adapters:** Support REST API, GraphQL, CLI simultaneously

### ❌ Cons

- **More files:** Need interfaces and implementations
- **Learning curve:** Ports/adapters concept
- **Indirection:** More abstraction layers

### When to Use

- ✅ Need to support multiple UIs (web, mobile, CLI)
- ✅ Want to swap infrastructure easily
- ✅ High testability requirements
- ✅ Long-term maintainability important

---

## 3. Onion Architecture

### Structure

```
        ┌─────────────────────────────────┐
        │   Infrastructure                │  DB, APIs, UI
        │   ┌───────────────────────┐     │
        │   │   Application         │     │
        │   │   ┌─────────────┐     │     │
        │   │   │   Domain    │     │     │
        │   │   │   (Core)    │     │     │
        │   │   └─────────────┘     │     │
        │   │                       │     │
        │   └───────────────────────┘     │
        │                                 │
        └─────────────────────────────────┘

Dependencies: All layers point inward toward domain
```

### Example

```typescript
// Inner Layer: Domain
class Category {
  constructor(public readonly name: string) {
    if (!name) throw new Error("Name required");
  }
}

// Middle Layer: Application Services
interface ICategoryRepository {
  save(category: Category): Promise<void>;
}

class CategoryService {
  constructor(private repository: ICategoryRepository) {}

  async createCategory(name: string) {
    const category = new Category(name);
    await this.repository.save(category);
  }
}

// Outer Layer: Infrastructure
class SqlCategoryRepository implements ICategoryRepository {
  async save(category: Category) {
    await db.query("INSERT ...");
  }
}
```

### ✅ Pros

- **Domain-centric:** Business logic at center
- **Dependency inversion:** All dependencies point inward
- **Clear separation:** Each layer has specific responsibility

### ❌ Cons

- **Similar to Clean/Hexagonal:** Can be confusing which to use
- **Layer coupling:** Still some coupling between layers

### When to Use

- ✅ Similar use cases to Hexagonal
- ✅ Prefer concentric circles metaphor
- ✅ Want Domain-driven focus

---

## 4. Clean Architecture

### Structure

```
        ┌─────────────────────────────────┐
        │   Frameworks & Drivers          │  UI, DB, External
        ├─────────────────────────────────┤
        │   Interface Adapters            │  Controllers, Presenters
        ├─────────────────────────────────┤
        │   Application Business Rules    │  Use Cases
        ├─────────────────────────────────┤
        │   Enterprise Business Rules     │  Entities
        └─────────────────────────────────┘

Dependencies: Outer → Inner (strictly inward)
```

### Example

```typescript
// Inner Layer: Entities (Enterprise Business Rules)
class Category {
  constructor(
    public readonly id: string,
    public name: string,
  ) {
    if (!name) throw new Error("Name required");
  }

  changeName(newName: string) {
    if (!newName) throw new Error("Name required");
    this.name = newName;
  }
}

// Second Layer: Use Cases (Application Business Rules)
interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: string): Promise<Category | null>;
}

class CreateCategoryUseCase {
  constructor(private repository: ICategoryRepository) {}

  async execute(request: { name: string }): Promise<{ id: string }> {
    const category = new Category(generateId(), request.name);
    await this.repository.save(category);
    return { id: category.id };
  }
}

// Third Layer: Interface Adapters
class CategoryController {
  constructor(private createCategory: CreateCategoryUseCase) {}

  async create(req: Request, res: Response) {
    const result = await this.createCategory.execute({
      name: req.body.name,
    });
    res.json(result);
  }
}

// Outer Layer: Frameworks & Drivers
class SqlCategoryRepository implements ICategoryRepository {
  async save(category: Category) {
    await db.query("INSERT INTO categories (id, name) VALUES (?, ?)", [
      category.id,
      category.name,
    ]);
  }

  async findById(id: string) {
    const row = await db.query("SELECT * FROM categories WHERE id = ?", [id]);
    return row ? new Category(row.id, row.name) : null;
  }
}
```

### ✅ Pros

- **Clear layers:** Four distinct layers with specific roles
- **Testable:** Inner layers easy to test
- **Framework independent:** Business logic not tied to frameworks
- **Database independent:** Can change database easily

### ❌ Cons

- **Boilerplate:** More files and abstractions
- **Learning curve:** Understanding all layers takes time
- **Overkill for simple apps:** Too much for CRUD

### When to Use

- ✅ Complex business logic
- ✅ Long-term projects
- ✅ Large teams
- ✅ Enterprise applications
- ❌ Simple CRUD apps
- ❌ Quick prototypes

---

## 5. Domain-Driven Design (DDD)

### Structure

```
        ┌─────────────────────────────────┐
        │   Bounded Contexts              │
        │   ┌───────────────────────┐     │
        │   │   Aggregates          │     │
        │   │   ├─ Entities         │     │
        │   │   └─ Value Objects    │     │
        │   ├───────────────────────┤     │
        │   │   Domain Services     │     │
        │   ├───────────────────────┤     │
        │   │   Repositories        │     │
        │   ├───────────────────────┤     │
        │   │   Domain Events       │     │
        │   └───────────────────────┘     │
        └─────────────────────────────────┘

Focus: Modeling complex business domains
```

### Example

```typescript
// Aggregate Root
class Session extends AggregateRoot {
  private categoryId: ULID;
  private segments: SessionSegment[];
  private isStopped: boolean;

  static create(categoryId: ULID, timeProvider: TimeProvider): Session {
    const session = new Session(categoryId, [], false);
    const firstSegment = SessionSegment.create(timeProvider);
    session.segments.push(firstSegment);

    // Domain Event
    session.addEvent(new SessionStarted(session.id, categoryId));

    return session;
  }

  pause(timeProvider: TimeProvider): void {
    // Business Rule
    if (this.isStopped) {
      throw new SessionAlreadyStoppedError();
    }

    const activeSegment = this.getActiveSegment();
    if (!activeSegment) {
      throw new NoActiveSegmentError();
    }

    activeSegment.stop(timeProvider);
    this.addEvent(new SessionPaused(this.id));
  }
}

// Value Object
class Duration {
  private constructor(private readonly milliseconds: number) {}

  static fromMinutes(minutes: number): Duration {
    return new Duration(minutes * 60 * 1000);
  }

  plus(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds);
  }
}

// Domain Service
class SessionDurationCalculator {
  calculate(session: Session): Duration {
    return session
      .getSegments()
      .reduce(
        (total, segment) => total.plus(segment.getDuration()),
        Duration.zero(),
      );
  }
}

// Repository Interface (in domain)
interface ISessionRepository {
  save(session: Session): Promise<void>;
  findById(id: ULID): Promise<Session | null>;
}
```

### ✅ Pros

- **Rich domain model:** Behavior in entities, not services
- **Ubiquitous language:** Code matches business terminology
- **Complex domains:** Handles complexity well
- **Strategic patterns:** Bounded contexts, context mapping

### ❌ Cons

- **High complexity:** Steep learning curve
- **Time investment:** Takes time to model properly
- **Not for simple domains:** Overkill for CRUD

### When to Use

- ✅ Complex business domains
- ✅ Domain experts available
- ✅ Core domain is competitive advantage
- ❌ Simple CRUD
- ❌ Technical/data-centric applications

---

## Side-by-Side Comparison

| Aspect                     | Layered       | Hexagonal         | Onion        | Clean            | DDD             |
| -------------------------- | ------------- | ----------------- | ------------ | ---------------- | --------------- |
| **Complexity**             | Low           | Medium            | Medium       | Medium-High      | High            |
| **Learning Curve**         | Easy          | Medium            | Medium       | Steep            | Very Steep      |
| **Testability**            | Low           | High              | High         | High             | High            |
| **Database Independence**  | No            | Yes               | Yes          | Yes              | Yes             |
| **Framework Independence** | No            | Yes               | Yes          | Yes              | Yes             |
| **Best For**               | Simple CRUD   | Multiple adapters | Domain focus | Enterprise       | Complex domains |
| **Worst For**              | Complex logic | Simple apps       | Simple apps  | Quick prototypes | Simple CRUD     |
| **Boilerplate**            | Low           | Medium            | Medium       | High             | High            |
| **Dependencies Direction** | Top→Bottom    | Inward            | Inward       | Inward           | Varies          |

---

## Choosing the Right Architecture

### Decision Matrix

**Simple CRUD Application (Blog, Simple API)**

```
Choose: Layered Architecture
- Fast to build
- Everyone understands it
- Low maintenance
```

**Application with Multiple UIs (Web + Mobile + API)**

```
Choose: Hexagonal Architecture
- Same use cases for all UIs
- Easy to add new adapters
- Technology flexibility
```

**Long-term Enterprise Application**

```
Choose: Clean Architecture
- Clear layer separation
- Highly testable
- Framework independent
```

**Complex Business Domain (E-commerce, Finance, Healthcare)**

```
Choose: Clean Architecture + DDD
- Domain complexity requires DDD patterns
- Clean Architecture for layer structure
- Combine both approaches
```

---

## Our Project: Hybrid Approach

### What We're Using

```
Clean Architecture (Structure) + DDD (Modeling) + Hexagonal (Integration)

┌─────────────────────────────────────────────────────────┐
│   Presentation (Clean)                                   │  React Native
│   Primary Adapters (Hexagonal)                          │
├─────────────────────────────────────────────────────────┤
│   Application (Clean)                                   │  Use Cases
├─────────────────────────────────────────────────────────┤
│   Domain (DDD)                                          │  Entities,
│   - Aggregates, Entities, Value Objects                │  Aggregates,
│   - Domain Services, Domain Events                     │  Events
├─────────────────────────────────────────────────────────┤
│   Infrastructure (Clean)                                │  Repositories,
│   Secondary Adapters (Hexagonal)                       │  TimeProvider
└─────────────────────────────────────────────────────────┘
```

**Why This Combination:**

1. **Clean Architecture layers** → Structure and dependency rules
2. **DDD patterns** → Rich domain modeling (Session, Category aggregates)
3. **Hexagonal ports/adapters** → Technology independence

**Benefits:**

- ✅ Clear structure (Clean)
- ✅ Rich domain model (DDD)
- ✅ Flexible integrations (Hexagonal)
- ✅ Highly testable (All three)

---

## Evolution Path

### Start Simple, Evolve as Needed

```
Stage 1: Layered Architecture
  ↓ "Need better testability"
Stage 2: Add Interfaces (Toward Hexagonal)
  ↓ "Domain getting complex"
Stage 3: Domain-Driven Design patterns
  ↓ "Need clear layers"
Stage 4: Full Clean Architecture + DDD
```

**Don't Start with Full DDD unless:**

- ✅ You have complex domain
- ✅ You have time to model properly
- ✅ Team understands DDD

**Do Start with:**

- Layered (if very simple)
- Hexagonal (if need flexibility)
- Clean Architecture (if enterprise project)

---

## Common Mistakes

### ❌ Using DDD for Simple CRUD

```typescript
// ❌ Overkill for simple blog
class BlogPost extends AggregateRoot {
  // 500 lines of complex domain logic
  // for simple create/read/update/delete
}

// ✅ Simple CRUD is fine
class BlogPost {
  id: string;
  title: string;
  content: string;
}
```

### ❌ No Architecture for Complex Domain

```typescript
// ❌ Complex business logic in controllers
@Controller()
class OrderController {
  async createOrder() {
    // 200 lines of business logic here
    // No domain model!
  }
}
```

### ❌ Mixing Patterns Incorrectly

```typescript
// ❌ Primary adapter calling secondary adapter directly
class UIComponent {
  async loadCategories() {
    // Skipping use case layer!
    return await database.query("SELECT * FROM categories");
  }
}
```

---

## Summary

**Layered Architecture:**

- Simple, database-centric
- Good for: Simple CRUD
- Issues: Coupling, hard to test

**Hexagonal Architecture:**

- Ports and adapters
- Good for: Multiple UIs, testability
- Issues: More files, indirection

**Onion Architecture:**

- Domain-centric layers
- Good for: Same as Hexagonal
- Issues: Similar to Clean

**Clean Architecture:**

- Four clear layers
- Good for: Enterprise apps
- Issues: Boilerplate, learning curve

**DDD:**

- Rich domain modeling
- Good for: Complex domains
- Issues: High complexity, time investment

**Our Project:**

- Clean Architecture (layers)
- DDD (domain modeling)
- Hexagonal (ports & adapters)

**Choose Based On:**

- Domain complexity
- Team experience
- Project timeline
- Maintenance requirements

**Key Takeaway:** There's no "best" architecture - choose what fits your needs!

---

## Related Documents

- [Clean Architecture Layers](./clean-architecture-layers.md)
- [Hexagonal Architecture](./hexagonal-architecture.md)
- [Domain-Driven Design fundamentals](./aggregate-root-pattern.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Clean Architecture** by Robert C. Martin
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Patterns of Enterprise Application Architecture** by Martin Fowler
