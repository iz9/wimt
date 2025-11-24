# DTOs and Mapping

## What is a DTO?

A **DTO (Data Transfer Object)** is a **simple data structure** used to transfer data between layers or across boundaries. DTOs contain no business logic—just data.

### Key Principle

> "DTOs are about data transfer, not behavior. They protect your domain from external concerns."

**Simple Example:**

```typescript
// ❌ Bad - Exposing domain object to UI
function getCategory(): Category {
  return category; // UI can call category.changeName()!
}

// ✅ Good - Return DTO
function getCategory(): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
  }; // Plain data, no methods
}
```

---

## Why Use DTOs?

### 1. **Protect Domain from External Layers**

**Without DTOs:**

```typescript
// ❌ UI gets domain object
const category = await categoryRepo.findById(id);

// UI can accidentally call domain methods
category.changeName({ name: "Hacked!" }); // Oops!
category.delete(); // Even worse!
```

**With DTOs:**

```typescript
// ✅ UI gets plain data
const categoryData: CategoryDTO = await getCategoryQuery.execute({ id });

// Can't call domain methods - they don't exist!
// categoryData.changeName() // ❌ Compilation error
```

### 2. **Decouple API from Domain**

**Domain can change without breaking API:**

```typescript
// Domain changes
class Category {
  // Renamed property
  private categoryName: string; // Was: name

  getName(): string {
    return this.categoryName;
  }
}

// DTO stays the same - API contract unchanged
interface CategoryDTO {
  id: ULID;
  name: string; // Still "name"
  color: string | null;
}

// Mapping adapts to changes
function toDTO(category: Category): CategoryDTO {
  return {
    id: category.id,
    name: category.getName(), // Adapt to domain change
    color: category.color,
  };
}
```

### 3. **Optimize for Presentation**

**Domain optimized for logic, DTO optimized for display:**

```typescript
// Domain - Business logic optimized
class Session {
  private segments: SessionSegment[];

  getTotalDuration(): Duration {
    return this.segments.reduce(/*...*/);
  }
}

// DTO - Display optimized
interface SessionDTO {
  id: ULID;
  categoryName: string; // Denormalized!
  totalDurationMs: number; // Pre-calculated!
  formattedDuration: string; // "2h 30m"
  isActive: boolean; // Pre-calculated!
  segmentCount: number; // Pre-calculated!
}
```

### 4. **Control What Data is Exposed**

```typescript
// Domain - All data
class User {
  public id: ULID;
  public email: string;
  private passwordHash: string; // Sensitive!
  private refreshToken: string; // Sensitive!
}

// DTO - Only safe data
interface UserDTO {
  id: ULID;
  email: string;
  // passwordHash NOT exposed!
  // refreshToken NOT exposed!
}
```

---

## DTO Structure

### Simple DTO

```typescript
export interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
  readonly createdAt: number; // Timestamp
}
```

**Characteristics:**

- All fields `readonly`
- Plain types (no domain classes)
- Primitives preferred (number, string, boolean)
- No methods
- No validation logic

### Nested DTO

```typescript
export interface SessionDTO {
  readonly id: ULID;
  readonly category: CategoryDTO; // Nested!
  readonly segments: SegmentDTO[];
  readonly totalDurationMs: number;
  readonly isActive: boolean;
  readonly startTime: number;
}

export interface SegmentDTO {
  readonly id: ULID;
  readonly startedAt: number;
  readonly stoppedAt: number | null;
  readonly durationMs: number | null;
}
```

### List DTO

```typescript
export interface CategoriesListDTO {
  readonly items: CategoryDTO[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
```

### Computed/Enriched DTO

```typescript
export interface CategoryWithStatsDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;

  // Computed fields
  readonly totalSessionCount: number;
  readonly totalDurationMs: number;
  readonly averageDurationMs: number;
  readonly lastUsed: number | null;
  readonly isActive: boolean;
}
```

---

## Mapping Domain to DTO

### Pattern 1: Mapper Class

```typescript
export class CategoryMapper {
  static toDTO(category: Category): CategoryDTO {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt,
    };
  }

  static toDTOList(categories: Category[]): CategoryDTO[] {
    return categories.map((c) => this.toDTO(c));
  }
}

// Usage
const category = await categoryRepo.findById(id);
const dto = CategoryMapper.toDTO(category);
```

### Pattern 2: Instance Method

```typescript
export class Category {
  toDTO(): CategoryDTO {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      icon: this.icon,
      createdAt: this.createdAt,
    };
  }
}

// Usage
const category = await categoryRepo.findById(id);
const dto = category.toDTO();
```

**Trade-off:**

- **Mapper class:** Domain stays pure, but more files
- **Instance method:** Convenient, but couples domain to DTO structure

**Recommendation:** Use mapper class for cleaner separation.

### Pattern 3: In Query Handler

```typescript
export class GetCategoryQueryHandler {
  async handle(query: GetCategoryQuery): Promise<CategoryDTO | null> {
    const category = await this.categoryRepo.findById(query.categoryId);

    if (!category) {
      return null;
    }

    // Map inline
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

---

## DTOs in Our Project

### Category DTO

```typescript
export interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
  readonly createdAt: number;
}

export class CategoryMapper {
  static toDTO(category: Category): CategoryDTO {
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

### Session DTO

```typescript
export interface SessionDTO {
  readonly id: ULID;
  readonly categoryId: ULID;
  readonly categoryName: string; // Denormalized
  readonly startTime: number;
  readonly totalDurationMs: number;
  readonly isActive: boolean;
  readonly isStopped: boolean;
  readonly segmentCount: number;
  readonly segments: SegmentDTO[];
}

export interface SegmentDTO {
  readonly id: ULID;
  readonly startedAt: number;
  readonly stoppedAt: number | null;
  readonly durationMs: number | null;
}

export class SessionMapper {
  static toDTO(session: Session, category: Category): SessionDTO {
    const segments = session.getSegments();

    return {
      id: session.id,
      categoryId: session.getCategoryId(),
      categoryName: category.name, // From category
      startTime: session.getStartTime(),
      totalDurationMs: session.getTotalDuration().toMilliseconds(),
      isActive: !session.isStopped() && session.hasActiveSegment(),
      isStopped: session.isStopped(),
      segmentCount: segments.length,
      segments: segments.map((s) => this.segmentToDTO(s)),
    };
  }

  private static segmentToDTO(segment: SessionSegment): SegmentDTO {
    return {
      id: segment.id,
      startedAt: segment.getStartedAt(),
      stoppedAt: segment.getStoppedAt(),
      durationMs: segment.getDuration()?.toMilliseconds() ?? null,
    };
  }
}
```

### Statistics DTO

```typescript
export interface CategoryStatisticsDTO {
  readonly categoryId: ULID;
  readonly categoryName: string;
  readonly totalDurationMs: number;
  readonly sessionCount: number;
  readonly averageDurationMs: number;
  readonly lastSessionDate: number | null;

  // Formatted for display
  readonly totalDurationFormatted: string; // "5h 30m"
  readonly averageDurationFormatted: string; // "30m"
}

export class StatisticsMapper {
  static toDTO(
    stats: CategoryStatistics,
    category: Category,
  ): CategoryStatisticsDTO {
    return {
      categoryId: stats.categoryId,
      categoryName: category.name,
      totalDurationMs: stats.totalDuration.toMilliseconds(),
      sessionCount: stats.sessionCount,
      averageDurationMs: stats.averageDuration.toMilliseconds(),
      lastSessionDate: stats.lastSessionDate,

      // Formatted versions
      totalDurationFormatted: this.formatDuration(stats.totalDuration),
      averageDurationFormatted: this.formatDuration(stats.averageDuration),
    };
  }

  private static formatDuration(duration: Duration): string {
    const hours = Math.floor(duration.toHours());
    const minutes = Math.floor(duration.toMinutes() % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
```

---

## Mapping DTO to Domain (Commands)

### Command DTOs

```typescript
// Input DTO (Command)
export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}

// In command handler
export class CreateCategoryCommandHandler {
  async handle(command: CreateCategoryCommand): Promise<{ id: ULID }> {
    // Map command to domain
    const category = new Category({ name: command.name });

    if (command.color) {
      category.setColor({ color: command.color });
    }

    if (command.icon) {
      category.setIcon({ icon: command.icon });
    }

    await this.categoryRepo.save(category);

    return { id: category.id };
  }
}
```

### Update Command

```typescript
export interface UpdateCategoryCommand {
  readonly categoryId: ULID;
  readonly name?: string;
  readonly color?: string | null;
  readonly icon?: string | null;
}

export class UpdateCategoryCommandHandler {
  async handle(command: UpdateCategoryCommand): Promise<void> {
    const category = await this.categoryRepo.findById(command.categoryId);

    if (!category) {
      throw new CategoryNotFoundError(command.categoryId);
    }

    // Map command to domain methods
    if (command.name !== undefined) {
      category.changeName({ name: command.name });
    }

    if (command.color !== undefined) {
      category.setColor({ color: command.color });
    }

    if (command.icon !== undefined) {
      category.setIcon({ icon: command.icon });
    }

    await this.categoryRepo.save(category);
  }
}
```

---

## Denormalization in DTOs

**Problem:** Domain is normalized, but UI needs denormalized data.

**Solution:** Compute and include related data in DTO.

```typescript
// Domain - Normalized
class Session {
  private categoryId: ULID; // Just ID
}

// DTO - Denormalized
interface SessionDTO {
  categoryId: ULID;
  categoryName: string; // ✅ Included!
  categoryColor: string | null; // ✅ Included!
}

// Mapper loads and denormalizes
export class SessionMapper {
  static async toDTOWithCategory(
    session: Session,
    categoryRepo: ICategoryRepository,
  ): Promise<SessionDTO> {
    // Load related category
    const category = await categoryRepo.findById(session.getCategoryId());

    if (!category) {
      throw new Error("Category not found");
    }

    return {
      id: session.id,
      categoryId: session.getCategoryId(),
      categoryName: category.name, // Denormalized
      categoryColor: category.color, // Denormalized
      // ... other fields
    };
  }
}

// Or in query handler
export class GetSessionQueryHandler {
  async handle(query: GetSessionQuery): Promise<SessionDTO | null> {
    const session = await this.sessionRepo.findById(query.sessionId);
    if (!session) return null;

    const category = await this.categoryRepo.findById(session.getCategoryId());
    if (!category) throw new Error("Category not found");

    return SessionMapper.toDTO(session, category); // Pass both
  }
}
```

---

## Testing DTOs and Mapping

### Test Mapping

```typescript
describe("CategoryMapper", () => {
  it("should map category to DTO", () => {
    const category = new Category({ name: "Work" });
    category.setColor({ color: "#FF0000" });

    const dto = CategoryMapper.toDTO(category);

    expect(dto.id).toBe(category.id);
    expect(dto.name).toBe("Work");
    expect(dto.color).toBe("#FF0000");
    expect(dto.createdAt).toBe(category.createdAt);
  });

  it("should map list of categories", () => {
    const categories = [
      new Category({ name: "Work" }),
      new Category({ name: "Hobby" }),
    ];

    const dtos = CategoryMapper.toDTOList(categories);

    expect(dtos).toHaveLength(2);
    expect(dtos[0].name).toBe("Work");
    expect(dtos[1].name).toBe("Hobby");
  });
});
```

### Test DTO is Plain Object

```typescript
describe("CategoryDTO", () => {
  it("should be plain object without methods", () => {
    const category = new Category({ name: "Work" });
    const dto = CategoryMapper.toDTO(category);

    // Should be plain object
    expect(dto instanceof Category).toBe(false);
    expect(typeof dto).toBe("object");

    // Should not have domain methods
    expect((dto as any).changeName).toBeUndefined();
    expect((dto as any).setColor).toBeUndefined();
  });
});
```

---

## Common Patterns

### Pattern: Pagination DTO

```typescript
export interface PaginatedDTO<T> {
  readonly items: T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasMore: boolean;
}

export class PaginatedCategoriesDTO implements PaginatedDTO<CategoryDTO> {
  readonly items: CategoryDTO[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasMore: boolean;

  constructor(
    categories: Category[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = CategoryMapper.toDTOList(categories);
    this.page = page;
    this.pageSize = pageSize;
    this.total = total;
    this.hasMore = page * pageSize < total;
  }
}
```

### Pattern: Summary vs Detail DTOs

```typescript
// List view - Minimal data
export interface CategorySummaryDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
}

// Detail view - Rich data
export interface CategoryDetailDTO {
  readonly id: ULID;
  readonly name: string;
  readonly color: string | null;
  readonly icon: string | null;
  readonly createdAt: number;
  readonly sessionCount: number;
  readonly totalDurationMs: number;
  readonly lastUsed: number | null;
}
```

### Pattern: Conditional Fields

```typescript
export interface SessionDTO {
  readonly id: ULID;
  readonly categoryId: ULID;

  // Only if includeCategory = true
  readonly category?: CategoryDTO;

  // Only if includeSegments = true
  readonly segments?: SegmentDTO[];

  // Only if includeStatistics = true
  readonly statistics?: {
    totalDurationMs: number;
    segmentCount: number;
  };
}

// Mapper with options
export class SessionMapper {
  static toDTO(
    session: Session,
    options: {
      includeCategory?: boolean;
      includeSegments?: boolean;
      includeStatistics?: boolean;
    } = {},
  ): SessionDTO {
    const dto: SessionDTO = {
      id: session.id,
      categoryId: session.getCategoryId(),
    };

    if (options.includeCategory) {
      // Load and include category
    }

    if (options.includeSegments) {
      dto.segments = session.getSegments().map(/*...*/);
    }

    if (options.includeStatistics) {
      dto.statistics = {
        totalDurationMs: session.getTotalDuration().toMilliseconds(),
        segmentCount: session.getSegments().length,
      };
    }

    return dto;
  }
}
```

---

## DTO Validation

**Where to validate:**

- **Incoming DTOs (Commands):** Validate at application layer boundary
- **Outgoing DTOs (Queries):** No validation needed (already valid domain)

### Command Validation

```typescript
export interface CreateCategoryCommand {
  readonly name: string;
  readonly color?: string | null;
}

export class CreateCategoryCommandValidator {
  validate(command: CreateCategoryCommand): ValidationResult {
    const errors: string[] = [];

    // Validate DTO structure
    if (!command.name || command.name.trim().length === 0) {
      errors.push("Name is required");
    }

    if (command.name && command.name.length > 100) {
      errors.push("Name too long (max 100 characters)");
    }

    if (command.color && !this.isValidHexColor(command.color)) {
      errors.push("Invalid color format (must be hex, e.g., #FF0000)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
  }
}

// In command handler
export class CreateCategoryCommandHandler {
  constructor(private validator: CreateCategoryCommandValidator) {}

  async handle(command: CreateCategoryCommand): Promise<{ id: ULID }> {
    // Validate command
    const validation = this.validator.validate(command);
    if (!validation.isValid) {
      throw new ValidationError("Invalid command", validation.errors);
    }

    // Proceed with domain logic
    const category = new Category({ name: command.name });
    // ...
  }
}
```

---

## Best Practices

### ✅ DO:

**1. Use DTOs at layer boundaries**

```typescript
// ✅ Application → Presentation
async handle(query: GetCategoryQuery): Promise<CategoryDTO> {
  const category = await this.repo.findById(query.categoryId);
  return CategoryMapper.toDTO(category);
}
```

**2. Keep DTOs simple**

```typescript
// ✅ Good - Plain data
interface CategoryDTO {
  id: ULID;
  name: string;
}

// ❌ Bad - Methods, logic
interface CategoryDTO {
  id: ULID;
  name: string;
  validate(): boolean; // ❌ No methods!
}
```

**3. Use readonly fields**

```typescript
// ✅ Good - Immutable
interface CategoryDTO {
  readonly id: ULID;
  readonly name: string;
}
```

**4. Map at query handler level**

```typescript
// ✅ Good - Query returns DTO
async handle(query: GetCategoryQuery): Promise<CategoryDTO> {
  const category = await this.repo.findById(query.categoryId);
  return this.toDTO(category);
}

// ❌ Bad - Repository returns DTO
interface ICategoryRepository {
  findById(id: ULID): Promise<CategoryDTO>; // ❌ Should return Category!
}
```

**5. Optimize DTOs for presentation**

```typescript
// ✅ Good - Pre-calculated, formatted
interface SessionDTO {
  totalDurationMs: number;
  totalDurationFormatted: string; // "2h 30m"
  isActive: boolean;
}
```

### ❌ DON'T:

**1. Don't expose domain objects directly**

```typescript
// ❌ Bad
function getCategory(): Category {
  return category;
}

// ✅ Good
function getCategory(): CategoryDTO {
  return CategoryMapper.toDTO(category);
}
```

**2. Don't put business logic in DTOs**

```typescript
// ❌ Bad
interface CategoryDTO {
  id: ULID;
  name: string;

  // ❌ Business logic!
  isValid(): boolean { }
  calculateSomething(): number { }
}

// ✅ Good - Just data
interface CategoryDTO {
  id: ULID;
  name: string;
}
```

**3. Don't use domain types in DTOs**

```typescript
// ❌ Bad - Using domain type
interface SessionDTO {
  duration: Duration; // Domain class!
}

// ✅ Good - Primitive
interface SessionDTO {
  durationMs: number;
}
```

**4. Don't map in domain layer**

```typescript
// ❌ Bad - Domain knows about DTO
class Category {
  constructor() {
    // ...
  }

  toDTO(): CategoryDTO {} // ❌ Domain shouldn't know about DTOs!
}

// ✅ Good - Separate mapper
class CategoryMapper {
  static toDTO(category: Category): CategoryDTO {}
}
```

---

## Summary

**DTOs are:**

- Simple data structures
- No business logic
- Used for data transfer
- Boundary between layers

**Why use DTOs:**

- Protect domain from external layers
- Decouple API from domain
- Optimize for presentation
- Control what data is exposed

**Mapping:**

- **Domain → DTO:** In query handlers
- **DTO → Domain:** In command handlers
- Use mapper classes for separation

**In Our Project:**

- `CategoryDTO` - Simple category data
- `SessionDTO` - Session with denormalized category
- `CategoryStatisticsDTO` - Computed statistics
- `CreateCategoryCommand` - Input DTO

**Pattern:**

```typescript
// Query returns DTO
const dto: CategoryDTO = await getCategoryQuery.execute({ id });

// Command accepts DTO
await createCategoryCommand.execute({ name: "Work" });
```

**Key Principle:** Domain objects stay in domain layer. DTOs cross boundaries.

---

## Related Documents

- [Application Layer](./application-layer.md)
- [Commands and Queries](./commands-and-queries.md)
- [Clean Architecture Layers](./clean-architecture-layers.md)

---

## References

- **Patterns of Enterprise Application Architecture** by Martin Fowler (DTO pattern)
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Clean Architecture** by Robert C. Martin
