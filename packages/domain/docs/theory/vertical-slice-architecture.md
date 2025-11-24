# Vertical Slice Architecture

## What is Vertical Slice Architecture?

**Vertical Slice Architecture** organizes code by **features** (vertical slices) rather than by **technical layers** (horizontal). Each slice contains all the code needed for one feature, from UI to database.

### Key Principle

> "Structure code around features, not technical concerns."

**The Contrast:**

**Horizontal Layers (Traditional):**

```
src/
├── controllers/        # All controllers
│   ├── CategoryController.ts
│   ├── SessionController.ts
│   └── UserController.ts
├── services/          # All services
│   ├── CategoryService.ts
│   ├── SessionService.ts
│   └── UserService.ts
├── repositories/      # All repositories
│   ├── CategoryRepository.ts
│   ├── SessionRepository.ts
│   └── UserRepository.ts
└── models/            # All models
    ├── Category.ts
    ├── Session.ts
    └── User.ts
```

**Vertical Slices (Feature-based):**

```
src/
├── features/
│   ├── create-category/          # One complete feature
│   │   ├── CreateCategoryController.ts
│   │   ├── CreateCategoryUseCase.ts
│   │   ├── CreateCategoryValidator.ts
│   │   └── CreateCategoryDTO.ts
│   ├── start-session/            # Another complete feature
│   │   ├── StartSessionController.ts
│   │   ├── StartSessionUseCase.ts
│   │   ├── StartSessionValidator.ts
│   │   └── StartSessionDTO.ts
│   └── list-categories/          # Another feature
│       ├── ListCategoriesController.ts
│       ├── ListCategoriesQuery.ts
│       └── CategoryListDTO.ts
└── shared/                        # Only truly shared code
    ├── Category.ts                # Domain entities
    └── validators/
```

---

## Why Vertical Slices?

### Problem with Horizontal Layers

**1. High coupling across layers:**

```typescript
// To add a feature, touch files in EVERY layer
// controllers/CreateCategoryController.ts
// services/CategoryService.ts
// repositories/CategoryRepository.ts
// models/Category.ts
// validators/CategoryValidator.ts
// dtos/CategoryDTO.ts
```

**2. Hard to find related code:**

```typescript
// Where's all the "create category" code?
// Scattered across 6 different directories!
```

**3. Shared code becomes bloated:**

```typescript
// CategoryService.ts has methods for 20 different features!
class CategoryService {
  create() {}
  update() {}
  delete() {}
  list() {}
  listActive() {}
  search() {}
  archive() {}
  // ... 13 more methods
}
```

### Solution with Vertical Slices

**1. Low coupling:**

```typescript
// All "create category" code in one place
features/create-category/
  - Everything needed for this feature
  - Nothing else
```

**2. Easy to navigate:**

```typescript
// Want to modify "create category"?
// Go to features/create-category/
// Everything you need is there!
```

**3. Small, focused modules:**

```typescript
// Each feature is independent
export class CreateCategoryUseCase {
  // Only handles creating
}

export class UpdateCategoryUseCase {
  // Only handles updating
}
```

---

## Structure

### Feature Organization

```
src/features/
├── create-category/
│   ├── CreateCategory.controller.ts    # HTTP endpoint
│   ├── CreateCategory.usecase.ts       # Business logic
│   ├── CreateCategory.validator.ts     # Input validation
│   ├── CreateCategory.dto.ts           # Data transfer object
│   ├── CreateCategory.test.ts          # Tests
│   └── index.ts                         # Public exports
│
├── rename-category/
│   ├── RenameCategory.controller.ts
│   ├── RenameCategory.usecase.ts
│   ├── RenameCategory.validator.ts
│   ├── RenameCategory.dto.ts
│   ├── RenameCategory.test.ts
│   └── index.ts
│
├── start-session/
│   ├── StartSession.controller.ts
│   ├── StartSession.usecase.ts
│   ├── StartSession.test.ts
│   └── index.ts
│
└── list-sessions/
    ├── ListSessions.controller.ts
    ├── ListSessions.query.ts
    ├── ListSessions.dto.ts
    ├── ListSessions.test.ts
    └── index.ts
```

---

## Implementation Examples

### Feature: Create Category

**Complete vertical slice:**

```typescript
// features/create-category/CreateCategory.dto.ts
export interface CreateCategoryDTO {
  name: string;
  color?: string;
  icon?: string;
}

// features/create-category/CreateCategory.validator.ts
import { z } from "zod";

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: z.string().optional(),
});

export class CreateCategoryValidator {
  validate(dto: unknown): CreateCategoryDTO {
    return CreateCategorySchema.parse(dto);
  }
}

// features/create-category/CreateCategory.usecase.ts
export class CreateCategoryUseCase {
  constructor(
    private categoryRepo: ICategoryRepository,
    private validator: CreateCategoryValidator,
  ) {}

  async execute(dto: unknown): Promise<{ id: ULID }> {
    // Validate
    const validated = this.validator.validate(dto);

    // Check uniqueness
    const existing = await this.categoryRepo.findByName(validated.name);
    if (existing) {
      throw new DuplicateCategoryError(validated.name);
    }

    // Create domain entity
    const category = new Category({
      name: validated.name,
      color: validated.color,
      icon: validated.icon,
    });

    // Save
    await this.categoryRepo.save(category);

    return { id: category.id };
  }
}

// features/create-category/CreateCategory.controller.ts
@Controller("/categories")
export class CreateCategoryController {
  constructor(private useCase: CreateCategoryUseCase) {}

  @Post()
  async create(@Body() dto: CreateCategoryDTO) {
    return await this.useCase.execute(dto);
  }
}

// features/create-category/index.ts
export { CreateCategoryUseCase } from "./CreateCategory.usecase";
export { CreateCategoryController } from "./CreateCategory.controller";
export { CreateCategoryDTO } from "./CreateCategory.dto";
```

### Feature: Start Session

```typescript
// features/start-session/StartSession.dto.ts
export interface StartSessionDTO {
  categoryId: ULID;
}

// features/start-session/StartSession.usecase.ts
export class StartSessionUseCase {
  constructor(
    private sessionRepo: ISessionRepository,
    private categoryRepo: ICategoryRepository,
    private timeProvider: TimeProvider,
  ) {}

  async execute(dto: StartSessionDTO): Promise<{ sessionId: ULID }> {
    // Validate category exists
    const category = await this.categoryRepo.findById(dto.categoryId);
    if (!category) {
      throw new CategoryNotFoundError(dto.categoryId);
    }

    // Check for active session
    const activeSession = await this.sessionRepo.findActive();
    if (activeSession) {
      throw new ActiveSessionExistsError();
    }

    // Create session
    const session = Session.create(dto.categoryId, this.timeProvider);
    await this.sessionRepo.save(session);

    return { sessionId: session.id };
  }
}

// features/start-session/StartSession.controller.ts
@Controller("/sessions")
export class StartSessionController {
  constructor(private useCase: StartSessionUseCase) {}

  @Post()
  async start(@Body() dto: StartSessionDTO) {
    return await this.useCase.execute(dto);
  }
}
```

---

## Shared Code

### What Goes in Shared?

**✅ DO share:**

- Domain entities
- Value objects
- Domain services
- Interfaces/ports
- Common utilities

```
src/shared/
├── domain/
│   ├── entities/
│   │   ├── Category.ts        # Shared entity
│   │   └── Session.ts
│   ├── valueObjects/
│   │   ├── Duration.ts
│   │   └── DateTime.ts
│   └── services/
│       └── DurationCalculator.ts
├── interfaces/
│   ├── ICategoryRepository.ts
│   └── ISessionRepository.ts
└── utils/
    ├── ulid.ts
    └── invariant.ts
```

**❌ DON'T share:**

- Feature-specific validators
- Feature-specific DTOs
- Feature-specific logic

```typescript
// ❌ Bad - Feature-specific in shared
shared / validators / CreateCategoryValidator.ts; // Should be in feature

// ✅ Good - Truly shared
shared / domain / entities / Category.ts; // Used by many features
```

---

## Vertical Slices with Clean Architecture

### Combining Both Patterns

```
src/
├── features/                    # Vertical slices
│   ├── create-category/
│   │   └── application/         # Application layer
│   │       ├── CreateCategory.usecase.ts
│   │       ├── CreateCategory.dto.ts
│   │       └── CreateCategory.validator.ts
│   └── start-session/
│       └── application/
│           ├── StartSession.usecase.ts
│           └── StartSession.dto.ts
│
├── shared/
│   ├── domain/                  # Domain layer (shared)
│   │   ├── entities/
│   │   └── valueObjects/
│   ├── infrastructure/          # Infrastructure layer (shared)
│   │   ├── persistence/
│   │   └── time/
│   └── presentation/            # Presentation layer
│       └── controllers/
│           ├── CreateCategoryController.ts
│           └── StartSessionController.ts
```

**Benefits:**

- ✅ Features are independent
- ✅ Still follows Clean Architecture
- ✅ Shared domain remains DRY

---

## Mediator Pattern (MediatR)

### Common Pattern with Vertical Slices

**Instead of injecting each use case, inject one mediator:**

```typescript
// Traditional - Inject many use cases
class CategoryController {
  constructor(
    private createCategory: CreateCategoryUseCase,
    private updateCategory: UpdateCategoryUseCase,
    private deleteCategory: DeleteCategoryUseCase,
    private listCategories: ListCategoriesQuery,
  ) {}
}

// With Mediator - Inject one mediator
class CategoryController {
  constructor(private mediator: IMediator) {}

  @Post()
  async create(@Body() dto: CreateCategoryDTO) {
    return await this.mediator.send(new CreateCategoryCommand(dto));
  }

  @Get()
  async list() {
    return await this.mediator.send(new ListCategoriesQuery());
  }
}

// Mediator routes to correct handler
class Mediator implements IMediator {
  async send<T>(request: IRequest<T>): Promise<T> {
    const handler = this.getHandler(request);
    return await handler.handle(request);
  }
}

// Each feature has a handler
export class CreateCategoryHandler
  implements IRequestHandler<CreateCategoryCommand>
{
  async handle(command: CreateCategoryCommand): Promise<{ id: ULID }> {
    // Same logic as use case
  }
}
```

---

## Testing Vertical Slices

### Feature-Complete Tests

```typescript
// features/create-category/CreateCategory.test.ts
describe("Create Category Feature", () => {
  let useCase: CreateCategoryUseCase;
  let repo: InMemoryCategoryRepository;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    const validator = new CreateCategoryValidator();
    useCase = new CreateCategoryUseCase(repo, validator);
  });

  it("should create category", async () => {
    const result = await useCase.execute({
      name: "Work",
    });

    expect(result.id).toBeDefined();

    const category = await repo.findById(result.id);
    expect(category).toBeDefined();
    expect(category!.name).toBe("Work");
  });

  it("should validate name", async () => {
    await expect(useCase.execute({ name: "" })).rejects.toThrow(
      "name is required",
    );
  });

  it("should prevent duplicates", async () => {
    await useCase.execute({ name: "Work" });

    await expect(useCase.execute({ name: "Work" })).rejects.toThrow(
      DuplicateCategoryError,
    );
  });
});
```

**All tests for one feature in one file!**

---

## Benefits of Vertical Slices

### ✅ Pros

**1. Easy to understand**

```typescript
// Want to know how "create category" works?
// Read features/create-category/
// Everything is there!
```

**2. Low coupling between features**

```typescript
// Change "create category"
// Won't affect "start session"
// Features are independent
```

**3. Easy to add/remove features**

```typescript
// Add new feature?
// Create new folder
// Don't touch existing features

// Remove feature?
// Delete folder
// Don't touch anything else
```

**4. Parallel development**

```typescript
// Team member 1: works on create-category/
// Team member 2: works on start-session/
// No merge conflicts!
```

**5. Clear scope**

```typescript
// Each feature has clear boundaries
// No "where does this go?" questions
```

### ❌ Cons

**1. Code duplication**

```typescript
// Might duplicate validation logic
// Might duplicate DTO mappings
```

**2. Shared code management**

```typescript
// What's truly shared?
// What's feature-specific?
// Requires discipline
```

**3. Different from traditional**

```typescript
// Team might resist
// "Where's the services folder?"
```

---

## When to Use Vertical Slices

### ✅ Use Vertical Slices When:

- Feature set is well-defined
- Features are independent
- Team is growing
- Want to enable parallel development
- Microservices future (each slice can become a service)

### ❌ Don't Use When:

- Very small codebase (< 10 features)
- Features heavily share logic
- Team is small (1-2 developers)
- Lots of cross-cutting concerns

---

## Migration Strategy

### From Horizontal to Vertical

**Step 1: Identify features**

```
Features:
- Create Category
- Rename Category
- Delete Category
- Start Session
- Pause Session
- Stop Session
```

**Step 2: Create feature folders**

```
src/features/
├── create-category/
├── rename-category/
├── delete-category/
├── start-session/
├── pause-session/
└── stop-session/
```

**Step 3: Move code slice by slice**

```typescript
// Move from:
controllers/CategoryController.ts (create method)
services/CategoryService.ts (create method)
validators/CategoryValidator.ts

// To:
features/create-category/
  ├── CreateCategory.controller.ts
  ├── CreateCategory.usecase.ts
  └── CreateCategory.validator.ts
```

**Step 4: Keep shared code shared**

```typescript
// Domain entities stay in shared
shared / domain / entities / Category.ts;

// Repositories stay in shared
shared / infrastructure / CategoryRepository.ts;
```

---

## Our Project: Hybrid Approach

### Current Structure (Horizontal)

```
packages/application/useCases/
  ├── CreateCategoryUseCase.ts
  ├── StartSessionUseCase.ts
  └── PauseSessionUseCase.ts
```

### Could Evolve To (Vertical)

```
packages/application/features/
  ├── create-category/
  │   ├── CreateCategory.usecase.ts
  │   ├── CreateCategory.command.ts
  │   └── CreateCategory.validator.ts
  ├── start-session/
  │   ├── StartSession.usecase.ts
  │   ├── StartSession.command.ts
  │   └── StartSession.handler.ts
  └── list-categories/
      ├── ListCategories.query.ts
      └── ListCategories.handler.ts
```

**When to migrate:**

- ✅ When we have 20+ use cases
- ✅ When features become complex
- ✅ When team grows to 5+ developers
- ❌ Not yet - we're still small!

---

## Best Practices

### ✅ DO:

**1. Make features autonomous**

```typescript
// ✅ Feature has everything it needs
features/create-category/
  ├── usecase.ts
  ├── validator.ts
  ├── dto.ts
  └── tests.ts
```

**2. Minimize shared code**

```typescript
// ✅ Only share true domain
shared / domain / Category.ts;

// ❌ Don't share feature logic
shared / CreateCategoryLogic.ts;
```

**3. Use consistent naming**

```typescript
// ✅ Same pattern for all features
create-category/
  └── CreateCategory.*

start-session/
  └── StartSession.*
```

### ❌ DON'T:

**1. Don't create feature dependencies**

```typescript
// ❌ Feature depending on another feature
import { CreateCategoryUseCase } from "../create-category";

// ✅ Both depend on shared domain
import { Category } from "shared/domain";
```

**2. Don't duplicate domain logic**

```typescript
// ❌ Each feature has own validation
create-category/Category.validation.ts
update-category/Category.validation.ts

// ✅ Validation in domain
shared/domain/Category.ts (with invariants)
```

---

## Summary

**Vertical Slice Architecture:**

- Organize by features, not layers
- Each slice contains everything for one feature
- Minimal shared code

**Benefits:**

- Low coupling between features
- Easy to understand
- Parallel development
- Easy to add/remove features

**Trade-offs:**

- Possible code duplication
- Different from traditional
- Requires discipline

**When to Use:**

- Growing codebase
- Independent features
- Growing team
- ❌ Not for tiny projects

**Our Project:**

- Currently horizontal (Clean Architecture)
- Could evolve to vertical slices
- Not urgent - team is small

**Key Insight:** Vertical slices are about **feature cohesion**, not replacing layers. You can combine vertical slices with Clean Architecture!

---

## Related Documents

- [Clean Architecture Layers](./clean-architecture-layers.md)
- [Architecture Styles Comparison](./architecture-styles-comparison.md)
- [Bounded Contexts](./bounded-contexts.md)

---

## References

- **Vertical Slice Architecture** by Jimmy Bogard
- **Feature Slices for ASP.NET Core MVC** by Jimmy Bogard
- **Clean Architecture** by Robert C. Martin
- **Building Microservices** by Sam Newman
