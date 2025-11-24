# Invariants

## What are Invariants?

An **invariant** is a condition that must **always be true** throughout the lifetime of an object. Invariants are fundamental business rules that define what it means for an object to be in a **valid state**.

In Domain-Driven Design, invariants are the core of your domain model - they encode the business rules that cannot be violated.

### Simple Example

```typescript
class BankAccount {
  private balance: number;

  constructor(initialBalance: number) {
    // INVARIANT: Balance cannot be negative
    invariant(initialBalance >= 0, "Balance cannot be negative");
    this.balance = initialBalance;
  }

  withdraw(amount: number) {
    // INVARIANT: Cannot withdraw more than balance
    invariant(this.balance >= amount, "Insufficient funds");
    this.balance -= amount;
  }
}
```

The invariant "balance ≥ 0" must be true:

- ✅ After construction
- ✅ After every method call
- ✅ At all times during the object's lifetime

---

## Why Use Invariants?

### 1. **Prevent Invalid States**

Without invariants, objects can enter invalid states:

```typescript
// BAD: Can create invalid category
class Category {
  name: string = ""; // Empty name is invalid!
}

// GOOD: Constructor enforces invariant
class Category {
  name: string;

  constructor(name: string) {
    invariant(isNotNil(name), "name is required");
    invariant(trim(name).length > 0, "name cannot be empty");
    this.name = name;
  }
}
```

### 2. **Make Business Rules Explicit**

Invariants document what's allowed:

```typescript
class Session {
  private segments: SessionSegment[];

  addSegment(segment: SessionSegment) {
    // INVARIANT: Segments cannot overlap
    invariant(!this.hasOverlap(segment), "Segments cannot overlap in time");
    this.segments.push(segment);
  }
}
```

The code itself is the specification.

### 3. **Fail Fast**

Invariants catch problems immediately, not later:

```typescript
// Without invariant: fails later with confusing error
const category = new Category();
category.name = "  "; // Technically set, but invalid
await repository.save(category); // Database error? Or silent corruption?

// With invariant: fails immediately with clear message
const category = new Category("  "); // ❌ Throws: "name cannot be empty"
```

### 4. **Enable Fearless Refactoring**

If invariants are enforced in constructor, you **know** objects are always valid:

```typescript
class Session {
  constructor(segments: SessionSegment[]) {
    invariant(this.hasNoOverlaps(segments), "No overlapping segments");
    this.segments = segments;
  }

  // Can safely assume no overlaps anywhere in the class
  getTotalDuration(): Duration {
    // No need to check for overlaps - guaranteed by invariant
    return this.segments.reduce((sum, s) => sum + s.duration, 0);
  }
}
```

---

## Invariants vs Validation

| Aspect          | Invariants                | Validation                 |
| --------------- | ------------------------- | -------------------------- |
| **When**        | Always (object lifetime)  | At specific points (input) |
| **Where**       | Domain model              | Application boundaries     |
| **Enforced By** | Constructor/methods       | DTOs/controllers           |
| **Failure**     | Throws error              | Returns validation result  |
| **Purpose**     | Maintain domain integrity | Reject bad input           |
| **Example**     | "Balance ≥ 0"             | "Email format correct"     |

**Key Difference:** Invariants protect the **domain model**. Validation protects against **external input**.

### Example

```typescript
// APPLICATION LAYER: Validation (checking external input)
class CreateCategoryCommand {
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

// DOMAIN LAYER: Invariant (protecting domain integrity)
class Category extends AggregateRoot {
  constructor(params: { name: string }) {
    super();
    // Invariant: name must not be empty
    invariant(isNotNil(params.name), "name is required");
    invariant(trim(params.name).length > 0, "name is required");
    this.name = params.name;
  }
}
```

**Both are needed!** Validation is first line of defense, invariants are the guarantee.

---

## Types of Invariants

### 1. **Simple Invariants**

Single condition checks:

```typescript
constructor(duration: number) {
  invariant(duration > 0, 'Duration must be positive');
  this.duration = duration;
}
```

### 2. **Composite Invariants**

Multiple conditions that must all be true:

```typescript
constructor(params: { name: string }) {
  // All these must be true
  invariant(isNotNil(params.name), 'name is required');
  invariant(typeof params.name === 'string', 'name must be a string');
  invariant(trim(params.name).length > 0, 'name cannot be empty');
  invariant(params.name.length <= 100, 'name too long');

  this.name = params.name;
}
```

### 3. **Cross-Property Invariants**

Relations between multiple properties:

```typescript
class DateRange {
  constructor(
    public readonly start: DateTime,
    public readonly end: DateTime,
  ) {
    // INVARIANT: end must be after start
    invariant(end > start, "End date must be after start date");
  }
}
```

### 4. **Collection Invariants**

Constraints on collections:

```typescript
class Session {
  private segments: SessionSegment[];

  constructor(segments: SessionSegment[]) {
    // INVARIANT: At least one segment required
    invariant(segments.length > 0, "Session must have at least one segment");

    // INVARIANT: Segments must not overlap
    invariant(this.hasNoOverlaps(segments), "Segments cannot overlap");

    // INVARIANT: Segments must be chronologically ordered
    invariant(this.isChronological(segments), "Segments must be in order");

    this.segments = segments;
  }
}
```

### 5. **State Invariants**

Valid state transitions:

```typescript
class Session {
  private isStopped: boolean = false;

  stop() {
    // INVARIANT: Cannot stop twice
    invariant(!this.isStopped, "Session already stopped");
    this.isStopped = true;
  }
}
```

---

## Implementing Invariants in TypeScript

### Pattern 1: Using es-toolkit `invariant`

```typescript
import { invariant, isNotNil, trim } from "es-toolkit";

class Category extends AggregateRoot {
  constructor(params: { name: string }) {
    super();

    // Check invariants
    invariant(isNotNil(params.name), "name is required");
    invariant(trim(params.name).length > 0, "name cannot be empty");

    this.name = params.name;
  }
}
```

**How `invariant` works:**

```typescript
function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
```

### Pattern 2: Guard Methods

```typescript
class Category extends AggregateRoot {
  constructor(params: { name: string }) {
    super();
    this.ensureValidName(params.name);
    this.name = params.name;
  }

  private ensureValidName(name: string): void {
    invariant(isNotNil(name), "name is required");
    invariant(trim(name).length > 0, "name cannot be empty");
    invariant(name.length <= 100, "name too long");
  }

  rename(newName: string): void {
    this.ensureValidName(newName); // Reuse guard
    this.name = newName;
  }
}
```

**Benefits:**

- Reusable validation logic
- Clear method names
- DRY principle

### Pattern 3: Value Objects

```typescript
class CategoryName {
  private constructor(private readonly value: string) {}

  static create(name: string): CategoryName {
    invariant(isNotNil(name), "name is required");
    invariant(trim(name).length > 0, "name cannot be empty");
    invariant(name.length <= 100, "name too long");

    return new CategoryName(trim(name));
  }

  toString(): string {
    return this.value;
  }
}

class Category {
  constructor(private name: CategoryName) {
    // No invariant check needed - CategoryName is always valid!
  }
}
```

**Benefits:**

- Invariants enforced once at creation
- Type system ensures validity
- Impossible to create invalid value object

---

## Invariants in Our Project

### Example 1: Category Name

**File:** `src/entities/Category.ts`

```typescript
class Category extends AggregateRoot {
  private hasName(name?: string): void {
    invariant(isNotNil(name), "name is required");
    invariant(isNotNil(name) && trim(name).length > 0, "name is required");
  }
}
```

**Invariants Enforced:**

1. Name must not be null/undefined
2. Name must not be empty after trimming whitespace

### Example 2: Session Segments (Future)

```typescript
class Session extends AggregateRoot {
  private ensureNoOverlaps(segments: SessionSegment[]): void {
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      invariant(current.endTime <= next.startTime, "Segments cannot overlap");
    }
  }
}
```

**Invariant:** Segments must not overlap in time

### Example 3: Duration Value Object

```typescript
class Duration {
  private constructor(private readonly milliseconds: number) {}

  static fromMilliseconds(ms: number): Duration {
    invariant(ms >= 0, "Duration cannot be negative");
    invariant(Number.isFinite(ms), "Duration must be finite");

    return new Duration(ms);
  }
}
```

**Invariants:**

1. Duration ≥ 0
2. Duration is a finite number

---

## Where to Enforce Invariants

### ✅ Constructor (Always)

```typescript
constructor(name: string) {
  invariant(isNotNil(name), 'name is required');
  this.name = name;
}
```

**Why:** Ensures object is valid from creation.

### ✅ Mutating Methods

```typescript
rename(newName: string): void {
  invariant(isNotNil(newName), 'name is required');
  this.name = newName;
}
```

**Why:** Maintains invariants after state changes.

### ✅ Before State Transitions

```typescript
pause(timeProvider: TimeProvider): void {
  invariant(!this.isStopped, 'Cannot pause stopped session');
  // Proceed with pause logic
}
```

**Why:** Prevents invalid state transitions.

### ❌ Getters (Usually Not)

```typescript
// DON'T do this
get name(): string {
  invariant(isNotNil(this._name), 'name is required');
  return this._name;
}
```

**Why:** If invariants in constructor are correct, this is redundant.

---

## Invariant Error Handling

### When Invariant Fails

```typescript
try {
  const category = new Category({ name: "" });
} catch (error) {
  console.log(error.message); // "name cannot be empty"
}
```

**Invariant violations throw errors!** This is correct - if an invariant fails, the object should not be created.

### Should You Catch Invariant Errors?

**Generally NO** at the domain layer:

```typescript
// ❌ DON'T
try {
  const category = new Category({ name: userInput });
} catch (error) {
  // Trying to recover from invariant violation
}
```

**Instead:** Validate before calling constructor:

```typescript
// ✅ DO
// Application layer
if (!userInput || trim(userInput).length === 0) {
  return { error: "Name is required" };
}

// Now safe - invariant won't fail
const category = new Category({ name: userInput });
```

**Exception:** Application boundaries can catch and translate:

```typescript
// Application layer
try {
  const category = new Category({ name: userInput });
  await repository.save(category);
  return { success: true };
} catch (error) {
  // Translate domain error to user-friendly message
  return { success: false, error: "Invalid category name" };
}
```

---

## Common Invariants

### String Invariants

```typescript
// Not empty
invariant(str.length > 0, "Cannot be empty");

// Not just whitespace
invariant(trim(str).length > 0, "Cannot be whitespace only");

// Length constraints
invariant(str.length <= 100, "Too long");
invariant(str.length >= 3, "Too short");

// Format
invariant(/^[a-zA-Z]+$/.test(str), "Must contain only letters");
```

### Number Invariants

```typescript
// Positive
invariant(num > 0, "Must be positive");

// Non-negative
invariant(num >= 0, "Must be non-negative");

// Range
invariant(num >= min && num <= max, "Out of range");

// Finite
invariant(Number.isFinite(num), "Must be finite");

// Integer
invariant(Number.isInteger(num), "Must be integer");
```

### Collection Invariants

```typescript
// Not empty
invariant(arr.length > 0, "Cannot be empty");

// Size constraints
invariant(arr.length <= 100, "Too many items");

// All items valid
invariant(
  arr.every((item) => item.isValid()),
  "Contains invalid items",
);

// Unique
invariant(new Set(arr).size === arr.length, "Must be unique");
```

### Date/Time Invariants

```typescript
// Not in past
invariant(date > Date.now(), "Cannot be in past");

// Range
invariant(end > start, "End must be after start");

// Reasonable bounds
invariant(date > MIN_DATE && date < MAX_DATE, "Date out of bounds");
```

---

## Testing Invariants

### Test That Valid Input Succeeds

```typescript
describe("Category", () => {
  it("should create category with valid name", () => {
    const category = new Category({ name: "Work" });

    expect(category.name).toBe("Work");
  });
});
```

### Test That Invalid Input Fails

```typescript
describe("Category invariants", () => {
  it("should reject empty name", () => {
    expect(() => new Category({ name: "" })).toThrow("name is required");
  });

  it("should reject null name", () => {
    expect(() => new Category({ name: null as any })).toThrow(
      "name is required",
    );
  });

  it("should reject whitespace-only name", () => {
    expect(() => new Category({ name: "   " })).toThrow("name cannot be empty");
  });
});
```

### Test Edge Cases

```typescript
describe("Category edge cases", () => {
  it("should trim whitespace", () => {
    const category = new Category({ name: "  Work  " });
    expect(category.name).toBe("Work"); // If you trim in constructor
  });

  it("should accept Unicode characters", () => {
    expect(() => new Category({ name: "日本語" })).not.toThrow();
  });
});
```

---

## Invariants and Immutability

### Immutable Objects Have Simpler Invariants

```typescript
class CategoryName {
  private constructor(private readonly value: string) {}

  static create(name: string): CategoryName {
    // Check ONCE at creation
    invariant(isNotNil(name), "name is required");
    invariant(trim(name).length > 0, "name cannot be empty");

    return new CategoryName(name);
  }

  // No setters - cannot change after creation
  // Invariant guaranteed for lifetime
}
```

### Mutable Objects Need Invariants on Every Change

```typescript
class Category {
  private name: string;

  constructor(name: string) {
    this.ensureValidName(name);
    this.name = name;
  }

  rename(newName: string) {
    this.ensureValidName(newName); // Must check again!
    this.name = newName;
  }

  private ensureValidName(name: string): void {
    invariant(isNotNil(name), "name is required");
    invariant(trim(name).length > 0, "name cannot be empty");
  }
}
```

---

## Complex Invariants

### Cross-Aggregate Invariants (Avoid!)

**Bad:**

```typescript
class Session {
  constructor(
    private categoryId: ULID,
    categoryRepository: ICategoryRepository, // BAD!
  ) {
    // Checking other aggregate's existence - TOO COMPLEX
    const category = await categoryRepository.findById(categoryId);
    invariant(isNotNil(category), "Category must exist");
  }
}
```

**Why bad:**

- Domain layer depends on repository (infrastructure)
- Makes testing harder
- Violates aggregate boundaries

**Better:**

```typescript
// Check in application layer before creating session
class StartSessionUseCase {
  async execute(command: StartSessionCommand) {
    const category = await this.categoryRepo.findById(command.categoryId);

    if (!category) {
      throw new Error("Category not found"); // Application error
    }

    // Now safe to create session - just stores the ID
    const session = Session.create(command.categoryId, this.timeProvider);
  }
}
```

### Multi-Entity Invariants

If invariant involves multiple entities, consider if they should be in the same aggregate:

```typescript
// If segments must not overlap, they should be in Session aggregate
class Session {
  private segments: SessionSegment[];

  addSegment(segment: SessionSegment) {
    // Session enforces invariant across all segments
    invariant(!this.hasOverlap(segment), "Segments cannot overlap");
    this.segments.push(segment);
  }
}
```

---

## Best Practices

### ✅ DO:

1. **Check invariants in constructor** - Always
2. **Check invariants on state changes** - Every mutating method
3. **Use clear error messages** - "name is required" not "invalid"
4. **Keep invariants simple** - Easy to understand and verify
5. **Use guard methods** - Reusable validation logic
6. **Test invariants thoroughly** - Valid and invalid cases
7. **Document complex invariants** - JSDoc comments explaining why

### ❌ DON'T:

1. **Don't check invariants in getters** - Redundant if constructor is correct
2. **Don't access infrastructure** - No repositories, databases, etc.
3. **Don't make async checks** - Invariants must be synchronous
4. **Don't catch invariant errors in domain** - Let them bubble up
5. **Don't use invariants for validation** - Validation is at boundaries
6. **Don't make invariants too complex** - If hard to check, refactor design

---

## Invariants vs Domain Errors

**Invariant Violation:**

- Indicates a **programming error**
- Should never happen in correct code
- Throws generic `Error`
- Checked in constructor/mutating methods

```typescript
invariant(name.length > 0, "name cannot be empty");
// Programming error if this fails
```

**Domain Error:**

- Indicates a **business rule violation**
- Can happen during normal operation
- Throws specific `DomainError` subclass
- Checked in business logic methods

```typescript
if (this.isStopped) {
  throw new SessionAlreadyStoppedError();
  // Business rule: cannot modify stopped session
}
```

**Guideline:**

- **Invariants** protect object integrity (always true)
- **Domain Errors** enforce business rules (situationally true)

---

## Performance Considerations

### Invariants Have Cost

```typescript
class Session {
  addSegment(segment: SessionSegment) {
    // O(n) check on every add!
    invariant(!this.hasOverlap(segment), "No overlaps");
    this.segments.push(segment);
  }

  private hasOverlap(segment: SessionSegment): boolean {
    return this.segments.some((s) => s.overlaps(segment));
  }
}
```

### Optimization Strategies

**1. Use data structures that maintain invariants:**

```typescript
class Session {
  // Sorted set maintains chronological order
  private segments: SortedSet<SessionSegment>;

  addSegment(segment: SessionSegment) {
    // Just check adjacent segments, not all
    const prev = this.segments.getPrevious(segment);
    const next = this.segments.getNext(segment);

    invariant(!segment.overlaps(prev), "Overlaps previous");
    invariant(!segment.overlaps(next), "Overlaps next");

    this.segments.add(segment);
  }
}
```

**2. Check once in constructor:**

```typescript
constructor(segments: SessionSegment[]) {
  // Expensive check, but only once
  invariant(this.hasNoOverlaps(segments), 'No overlaps');
  this.segments = segments;

  // After this, maintain invariant with cheaper checks
}
```

**3. Use immutability:**

```typescript
class Session {
  private constructor(private readonly segments: readonly SessionSegment[]) {
    // Check once, guaranteed forever
    invariant(this.hasNoOverlaps(segments), "No overlaps");
  }

  // Return new session instead of mutating
  withSegment(segment: SessionSegment): Session {
    return new Session([...this.segments, segment]);
  }
}
```

---

## Summary

**Invariants:**

- Are conditions that must **always be true**
- Are enforced in **constructors** and **mutating methods**
- Protect **domain integrity**
- Should be **simple** and **fast** to check
- Throw **errors** when violated (programming errors)
- Are different from **validation** (external input checks)
- Are different from **domain errors** (business rule violations)

**In our project:**

- Category uses `invariant()` from `es-toolkit`
- Checks name is not null/empty
- Should be expanded to Session for segment invariants

**Key Principle:** If an invariant can be violated, your domain model is wrong. Fix the design, not the invariant.

---

## Related Documents

- [Domain Errors](./domain-errors.md)
- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Category Requirements](../entities/Category-requirements.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Design by Contract** by Bertrand Meyer
