# Architecture Decision Records (ADRs)

## What are ADRs?

**Architecture Decision Records (ADRs)** are lightweight documents that capture important architectural decisions, the context in which they were made, and their consequences.

### Key Principle

> "Document not just what you decided, but why you decided it."

**The Problem:**

```
// 6 months later...
Developer: "Why are we using ULID instead of UUID?"
Team: "¯\_(ツ)_/¯ Someone decided that once..."
```

**The Solution:**

```markdown
# ADR-001: Use ULID for Entity IDs

## Status

Accepted

## Context

We need unique identifiers for entities. Options: UUID, ULID, auto-increment.

## Decision

Use ULID (Universally Unique Lexicographically Sortable Identifier).

## Consequences

✅ Sortable by creation time
✅ 26 character string (vs UUID 36)
✅ URL-safe
❌ Slightly less adoption than UUID
```

---

## ADR Format

### Standard Template

```markdown
# ADR-[NUMBER]: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

What is the issue we're facing? What factors are at play?
What are our constraints?

## Decision

What decision did we make? Be specific.

## Consequences

What are the positive and negative outcomes?

- ✅ Positive consequences
- ❌ Negative consequences
- ⚠️ Neutral or unknown consequences

## Alternatives Considered

What other options did we consider?
Why didn't we choose them?
```

---

## Our Project's ADRs

### ADR-001: Use ULID for Entity IDs

````markdown
# ADR-001: Use ULID for Entity IDs

## Status

Accepted (2025-11-19)

## Context

We need unique identifiers for domain entities (Session, Category, etc.).

**Requirements:**

- Globally unique across all entities
- Immutable once created
- Can be generated client-side (React Native)
- Small size for storage and URLs
- Ideally sortable by creation time

**Options considered:**

1. Auto-increment integers
2. UUID v4
3. ULID
4. Snowflake IDs

## Decision

Use **ULID** (Universally Unique Lexicographically Sortable Identifier).

Library: `ulid` npm package

```typescript
import { ulid } from "ulid";

const id = ulid(); // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
```
````

## Consequences

### ✅ Positive

- **Sortable:** Chronologically sortable by creation time
- **Compact:** 26 characters (vs UUID's 36)
- **URL-safe:** No special characters
- **Client-side generation:** Can create offline
- **Human-readable:** Easier to debug than UUIDs
- **Collision-resistant:** 48-bit timestamp + 80-bit random

### ❌ Negative

- **Less adoption:** UUID is more widely known
- **Library dependency:** Need `ulid` package
- **Time-based:** Reveals approximate creation time (might be security concern)

### ⚠️ Neutral

- IDs are not sequential (gap between IDs)
- Cannot infer entity type from ID alone

## Alternatives Considered

### Auto-increment Integers

- ❌ Not globally unique (conflicts in distributed system)
- ❌ Must be generated server-side
- ❌ Reveals count (security concern)
- ✅ Smallest size
- ✅ Simple

### UUID v4

- ✅ Globally unique
- ✅ Industry standard
- ✅ Many libraries
- ❌ Not sortable
- ❌ Longer (36 chars)
- ❌ Contains hyphens (not URL-safe)

### Snowflake IDs

- ✅ Sortable
- ✅ Compact
- ❌ Requires centralized ID generator
- ❌ More complex setup

## Related Decisions

- ADR-002: Use TypeScript type alias for ULID

````

---

### ADR-002: Use InversifyJS for Dependency Injection

```markdown
# ADR-002: Use InversifyJS for Dependency Injection

## Status
Accepted (2025-11-19)

## Context
We're implementing Clean Architecture with clear separation between layers.
We need a way to wire dependencies without tight coupling.

**Requirements:**
- Type-safe dependency injection
- Support for TypeScript decorators
- Interface-based binding
- Testability (easy to swap implementations)
- Works in React Native

**Options considered:**
1. Manual DI (constructor injection without framework)
2. TSyringe
3. InversifyJS
4. TypeDI

## Decision
Use **InversifyJS** for dependency injection.

```typescript
@injectable()
class CreateCategoryUseCase {
  constructor(
    @inject(TYPES.ICategoryRepository)
    private categoryRepo: ICategoryRepository
  ) {}
}
````

## Consequences

### ✅ Positive

- **Type-safe:** Full TypeScript support
- **Well-documented:** Extensive docs and examples
- **Mature:** Stable, well-tested library
- **Flexible:** Multiple binding strategies (singleton, transient, etc.)
- **React Native compatible:** Works in RN without issues
- **Decorator support:** Clean syntax with `@injectable()` and `@inject()`

### ❌ Negative

- **Learning curve:** Requires understanding IoC concepts
- **Boilerplate:** Need to define types/symbols
- **Reflection required:** Needs `reflect-metadata`
- **Bundle size:** ~20KB (small but not zero)

### ⚠️ Neutral

- Must use decorators (experimental TypeScript feature)
- Container setup requires careful planning

## Alternatives Considered

### Manual DI

```typescript
// Manual injection
const repo = new InMemoryCategoryRepository();
const useCase = new CreateCategoryUseCase(repo);
```

- ✅ No dependencies
- ✅ Simple for small projects
- ❌ Hard to manage at scale
- ❌ Lots of manual wiring
- ❌ Difficult to swap implementations

### TSyringe

- ✅ Lightweight
- ✅ Simple API
- ❌ Less features than InversifyJS
- ❌ Smaller community

### TypeDI

- ✅ Simple decorator-based
- ❌ Less flexible than InversifyJS
- ❌ Issues with React Native

## Related Decisions

- ADR-003: Container structure and modules

````

---

### ADR-003: Domain Layer Has No Infrastructure Dependencies

```markdown
# ADR-003: Domain Layer Has No Infrastructure Dependencies

## Status
Accepted (2025-11-19)

## Context
Following Clean Architecture and DDD principles, we need to decide how to
structure dependencies between layers.

The core question: Should the domain layer know about infrastructure?

## Decision
The **domain layer MUST have ZERO dependencies on infrastructure**.

```typescript
// ✅ Domain defines interface
export interface ICategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
}

// ✅ Infrastructure implements
export class AsyncStorageCategoryRepository implements ICategoryRepository {
  // Implementation details
}
````

**Dependency Direction:**

```
Presentation → Application → Domain
                            ↑
                     Infrastructure
```

## Consequences

### ✅ Positive

- **Testability:** Easy to test domain with mocks
- **Flexibility:** Swap infrastructure without changing domain
- **Portability:** Domain can be used in any environment
- **Focus:** Domain only contains business logic
- **Independence:** Domain evolves independently

### ❌ Negative

- **More files:** Need interfaces and implementations
- **Indirection:** Repository interface separate from implementation
- **Learning curve:** Team must understand dependency inversion

### ⚠️ Neutral

- Requires disciplined architecture enforcement
- Need DI container to wire dependencies

## Examples

### ✅ Correct

```typescript
// Domain defines what it needs
interface ITimeProvider {
  now(): DateTime;
}

// Domain uses interface
class Session {
  start(timeProvider: ITimeProvider): void {
    this.startTime = timeProvider.now();
  }
}

// Infrastructure provides implementation
class RealTimeProvider implements ITimeProvider {
  now(): DateTime {
    return Date.now();
  }
}
```

### ❌ Incorrect

```typescript
// ❌ Domain importing from infrastructure
import { AsyncStorage } from "@react-native-async-storage/async-storage";

class Session {
  async save(): Promise<void> {
    await AsyncStorage.setItem(this.id, JSON.stringify(this));
  }
}
```

## Enforcement

### Package.json Restrictions

```json
{
  "dependencies": {
    "dayjs": "^1.11.10",
    "es-toolkit": "^1.0.0",
    "inversify": "^6.0.2",
    "reflect-metadata": "^0.2.1",
    "ulid": "^2.3.0"
  }
}
```

No React Native, database, or UI libraries allowed!

### Import Linting

```typescript
// .eslintrc.js
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          "@react-native-async-storage/*",
          "react-native-*",
          "@expo/*"
        ]
      }
    ]
  }
}
```

## Related Decisions

- ADR-002: InversifyJS for DI
- ADR-004: Repository pattern for persistence

````

---

### ADR-004: TimeProvider Pattern for Time Abstraction

```markdown
# ADR-004: TimeProvider Pattern for Time Abstraction

## Status
Accepted (2025-11-20)

## Context
Time-dependent logic (sessions, timestamps, duration) is hard to test if
it uses `Date.now()` or `new Date()` directly.

**Problem:**
```typescript
// ❌ Hard to test
class Session {
  start(): void {
    this.startTime = Date.now(); // Always current time!
  }
}

// Test is flaky
it('should start at specific time', () => {
  const session = new Session();
  session.start();
  expect(session.startTime).toBe(1234567890); // ❌ Fails!
});
````

## Decision

Use **TimeProvider pattern** to abstract time as an injectable dependency.

```typescript
// Interface
export interface TimeProvider {
  now(): DateTime;
}

// Production implementation
export class RealTimeProvider implements TimeProvider {
  now(): DateTime {
    return Date.now();
  }
}

// Test implementation
export class MockTimeProvider implements TimeProvider {
  constructor(private currentTime: DateTime) {}

  now(): DateTime {
    return this.currentTime;
  }

  advance(ms: number): void {
    this.currentTime += ms;
  }
}

// Domain uses interface
class Session {
  start(timeProvider: TimeProvider): void {
    this.startTime = timeProvider.now(); // ✅ Controllable!
  }
}
```

## Consequences

### ✅ Positive

- **Testable:** Can control time in tests
- **Deterministic:** Tests always pass
- **Flexibility:** Can implement different time strategies
- **Explicit:** Time dependency is visible
- **No global state:** No hidden dependencies

### ❌ Negative

- **Extra parameter:** Must pass timeProvider to methods
- **Boilerplate:** Need to inject timeProvider everywhere
- **Learning curve:** Team must understand pattern

### ⚠️ Neutral

- TimeProvider must be injected (not optional)
- Methods that need time must accept TimeProvider

## Testing Benefits

### Before

```typescript
// ❌ Flaky test
it("should track 5 minutes", async () => {
  session.start();
  await sleep(5 * 60 * 1000); // Wait 5 real minutes!
  session.pause();
  expect(session.getDuration()).toBe(5 * 60 * 1000);
});
```

### After

```typescript
// ✅ Fast, deterministic test
it("should track 5 minutes", () => {
  const mockTime = new MockTimeProvider(1000000);
  session.start(mockTime);

  mockTime.advance(5 * 60 * 1000); // Instant!

  session.pause(mockTime);
  expect(session.getDuration()).toBe(5 * 60 * 1000);
});
```

## Alternatives Considered

### Using Date.now() directly

- ✅ Simple
- ❌ Untestable
- ❌ Flaky tests
- ❌ Hidden dependency

### Mocking Date.now globally

```typescript
jest.spyOn(Date, "now").mockReturnValue(1234567890);
```

- ✅ No code changes needed
- ❌ Global state (tests affect each other)
- ❌ Hard to advance time
- ❌ Fragile (easy to forget to restore)

### Using a Time library (dayjs, moment)

- ✅ Rich API
- ❌ Still uses real time
- ❌ Doesn't solve testability
- ✅ Good for formatting (we use dayjs for display)

## Implementation

### In Production

```typescript
container
  .bind<TimeProvider>(TYPES.TimeProvider)
  .to(RealTimeProvider)
  .inSingletonScope();
```

### In Tests

```typescript
const mockTime = new MockTimeProvider(1000000);
const session = Session.create(categoryId, mockTime);
```

## Related Decisions

- ADR-005: DateTime and Duration value objects

````

---

### ADR-005: Use React Query for State Management

```markdown
# ADR-005: Use React Query (TanStack Query) for State Management

## Status
Accepted (2025-11-21)

## Context
React Native app needs state management for server state (data from use cases).

**Requirements:**
- Cache data to avoid redundant queries
- Automatic refetching on focus
- Optimistic updates
- Error handling
- Loading states
- Works with Clean Architecture

**Options considered:**
1. Redux + RTK Query
2. Zustand
3. React Query (TanStack Query)
4. Apollo Client (GraphQL)
5. SWR

## Decision
Use **React Query (TanStack Query)** for server state management.

```typescript
export function useListCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const query = container.get<ListCategoriesQuery>(TYPES.ListCategoriesQuery);
      return await query.execute({});
    }
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase);
      return await useCase.execute(command);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });
}
````

## Consequences

### ✅ Positive

- **Automatic caching:** Data cached by query key
- **Auto refetching:** Refetch on window focus, reconnect
- **Loading states:** Built-in `isLoading`, `isError`
- **Optimistic updates:** Easy to implement
- **Devtools:** Excellent debugging experience
- **Small bundle:** ~13KB (smaller than Redux)
- **Framework agnostic:** Not coupled to architecture
- **Pagination/Infinite scroll:** Built-in support

### ❌ Negative

- **Learning curve:** Different mental model
- **Not for local state:** Only for server state
- **Query keys:** Must manage carefully
- **Additional dependency:** Another library to maintain

### ⚠️ Neutral

- Need Zustand or Context for local UI state
- Must invalidate queries manually

## Alternatives Considered

### Redux + RTK Query

- ✅ Very popular
- ✅ Great devtools
- ❌ More boilerplate
- ❌ Larger bundle (~50KB)
- ❌ Overkill for our use case

### Zustand

- ✅ Very simple
- ✅ Tiny bundle (~3KB)
- ❌ Manual cache management
- ❌ No built-in refetching
- ➡️ Use for local UI state instead

### SWR

- ✅ Similar to React Query
- ✅ Smaller bundle
- ❌ Less features
- ❌ Vue/Svelte support (we don't need)

## Integration with Clean Architecture

### Query Hook

```typescript
// React Query wraps use case call
export function useListCategories() {
  const container = useContainer();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const query = container.get<ListCategoriesQuery>(
        TYPES.ListCategoriesQuery,
      );
      return await query.execute({});
    },
  });
}
```

### Mutation Hook

```typescript
export function useCreateCategory() {
  const container = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const useCase = container.get<CreateCategoryUseCase>(
        TYPES.CreateCategoryUseCase,
      );
      return await useCase.execute(command);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
```

Clean Architecture preserved - React Query just manages caching!

## Related Decisions

- ADR-002: InversifyJS for DI
- ADR-010: React Native Integration

````

---

## Creating New ADRs

### When to Create an ADR

**Create an ADR when:**
- ✅ Making a significant architectural decision
- ✅ Choosing between multiple viable options
- ✅ Decision will be hard to reverse
- ✅ Team needs to understand context
- ✅ Future developers will ask "why?"

**Don't create an ADR for:**
- ❌ Trivial decisions (naming conventions)
- ❌ Obvious choices (using TypeScript in TS project)
- ❌ Temporary experiments
- ❌ Implementation details

### ADR Lifecycle

```markdown
## Status
Proposed → Accepted → [Deprecated/Superseded]
````

**Proposed:** Under discussion  
**Accepted:** Team agreed, implemented  
**Deprecated:** No longer recommended  
**Superseded:** Replaced by newer ADR

### Example: Superseding an ADR

```markdown
# ADR-001: Use UUID for Entity IDs

## Status

~~Accepted~~ **Superseded by ADR-006**

## Context

[Original context]

## Decision

Use UUID v4 for entity IDs.

## Why Superseded

ULID provides better sortability and shorter IDs.
See ADR-006 for new decision.
```

---

## Best Practices

### ✅ DO:

**1. Keep ADRs concise**

```markdown
# ✅ Good - Clear and concise

Use ULID for IDs because they're sortable and compact.

# ❌ Bad - Too verbose

We conducted an extensive analysis of all possible identifier
strategies across 47 different use cases and determined that...
```

**2. Include alternatives**

```markdown
## Alternatives Considered

- UUID: More standard, but not sortable
- Auto-increment: Simple, but not globally unique
```

**3. Be honest about trade-offs**

```markdown
## Consequences

✅ Sortable
❌ Less well-known than UUID
```

**4. Date your decisions**

```markdown
## Status

Accepted (2025-11-21)
```

### ❌ DON'T:

**1. Don't skip consequences**

```markdown
# ❌ Bad - No consequences

## Decision

Use ULID.

# ✅ Good - Include cons

## Consequences

✅ Sortable
❌ Less adoption
```

**2. Don't delete old ADRs**

```markdown
# ❌ Bad - Delete ADR-001

[file deleted]

# ✅ Good - Mark as superseded

## Status

Superseded by ADR-006
```

---

## Summary

**ADRs are:**

- Lightweight documentation
- Capture architectural decisions
- Include context and consequences
- Living records (can be updated)

**When to create:**

- Significant architectural decisions
- Multiple viable options exist
- Future team needs context

**Format:**

- Number and title
- Status (Proposed/Accepted/Deprecated)
- Context (why?)
- Decision (what?)
- Consequences (trade-offs)
- Alternatives (what else?)

**In Our Project:**

- ADR-001: ULID for IDs
- ADR-002: InversifyJS for DI
- ADR-003: Domain layer independence
- ADR-004: TimeProvider pattern
- ADR-005: React Query for state

**Key Benefit:** Future developers understand **why** decisions were made!

---

## Related Documents

- All theory documents explain "how"
- ADRs explain "why"

---

## References

- **Documenting Architecture Decisions** by Michael Nygard
- **ADR GitHub Organization** - https://adr.github.io
- **Architecture Decision Records** by ThoughtWorks
