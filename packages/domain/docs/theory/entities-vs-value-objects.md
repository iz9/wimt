# Entities vs Value Objects

## The Fundamental Question

When modeling a domain concept in DDD, the first question you must answer is:

> **"Does this thing have an identity that persists over time, or is it defined purely by its attributes?"**

This single question determines whether you're dealing with an **Entity** or a **Value Object**.

---

## Identity: The Core Difference

### Entities Have Identity

**Example: Two People Named "John"**

```typescript
const person1 = new Person("John Doe", "john@example.com");
const person2 = new Person("John Doe", "different@example.com");

person1.equals(person2); // false - different people!
```

Even though both are named "John Doe", they're **different people** with **different identities**.

### Value Objects Have No Identity

**Example: Two $100 Bills**

```typescript
const money1 = Money.create(100, "USD");
const money2 = Money.create(100, "USD");

money1.equals(money2); // true - same value, same thing!
```

Both represent "$100 USD" - they're the **same thing**. It doesn't matter which specific $100 bill you have.

---

## Quick Comparison Table

| Aspect          | Entity                  | Value Object                 |
| --------------- | ----------------------- | ---------------------------- |
| **Identity**    | Has unique ID           | No ID needed                 |
| **Equality**    | By ID                   | By all attributes            |
| **Mutability**  | Often mutable           | Always immutable             |
| **Lifecycle**   | Tracked over time       | Created and discarded        |
| **Replacement** | Can't replace (same ID) | Easy to replace (create new) |
| **Example**     | User, Order, Session    | Money, Email, Duration       |

---

## Detailed Characteristics

### Entities

#### 1. **Have Unique Identity (ID)**

```typescript
export class Category extends AggregateRoot {
  public readonly id: ULID; // Identity!
  public name: string;

  constructor(params: { id?: ULID; name: string }) {
    super();
    this.id = params.id ?? makeId(); // Generate or use provided ID
    this.name = params.name;
  }
}
```

**The ID uniquely identifies this category forever**, even if the name changes.

#### 2. **Can Change Over Time (Mutable)**

```typescript
class Category {
  changeName(params: { name: string }): void {
    this.ensureValidName(params.name);
    this.name = params.name; // Same category, different name
  }

  setColor(params: { color: string }): void {
    this.color = params.color; // Same category, different color
  }
}
```

**Same entity (same ID), different state**.

#### 3. **Have Lifecycle**

```typescript
// Create
const category = new Category({ name: "Work" });

// Modify
category.changeName({ name: "Professional Work" });
category.setColor({ color: "#FF0000" });

// Persist
await repository.save(category);

// Retrieve later
const loaded = await repository.findById(category.id);
// Same entity, same ID!
```

#### 4. **Equality by ID**

```typescript
class Category {
  equals(other: Category): boolean {
    return this.id === other.id; // Only compare ID!
  }
}

const cat1 = new Category({ id: "123", name: "Work" });
const cat2 = new Category({ id: "123", name: "Different Name" });

cat1.equals(cat2); // true - same ID, same category!
```

#### 5. **Often Aggregate Roots**

```typescript
export class Session extends AggregateRoot {
  public readonly id: ULID;
  private segments: SessionSegment[];

  // Manages its own state and child entities
  pause(timeProvider: TimeProvider): void { ... }
  resume(timeProvider: TimeProvider): void { ... }
  stop(timeProvider: TimeProvider): void { ... }
}
```

### Value Objects

#### 1. **No Identity (No ID)**

```typescript
class Duration {
  constructor(private readonly milliseconds: number) {}
  // No ID field!
}
```

**Duration doesn't need an ID** - it's just a value.

#### 2. **Immutable (Never Change)**

```typescript
class Duration {
  add(other: Duration): Duration {
    // Returns NEW duration, doesn't modify this one
    return new Duration(this.milliseconds + other.milliseconds);
  }
}

const d1 = Duration.fromSeconds(5);
const d2 = d1.add(Duration.fromSeconds(10));

// d1 is unchanged
console.log(d1.toSeconds()); // Still 5
console.log(d2.toSeconds()); // 15
```

#### 3. **No Lifecycle (Created and Discarded)**

```typescript
// Create
const duration = Duration.fromMinutes(30);

// Use it
const total = duration.add(Duration.fromMinutes(15));

// Discard (garbage collected)
// No persistence, no tracking
```

#### 4. **Equality by Value**

```typescript
class Duration {
  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds; // All attributes!
  }
}

const d1 = Duration.fromSeconds(5);
const d2 = Duration.fromSeconds(5);

d1.equals(d2); // true - same value!
```

#### 5. **Encapsulate Domain Concepts**

```typescript
// Instead of primitives
function calculateDuration(start: number, end: number): number { ... }

// Use value objects
function calculateDuration(start: DateTime, end: DateTime): Duration { ... }
```

---

## Examples from Our Project

### Entities in Our Project

#### 1. **Category** (Entity ✅)

```typescript
export class Category extends AggregateRoot {
  public readonly id: ULID; // Identity!
  public name: string;
  public color?: string;
  public icon?: string;
  public readonly createdAt: DateTime;

  constructor(params: { id?: ULID; name: string }) {
    super();
    this.id = params.id ?? makeId();
    this.name = params.name;
    this.createdAt = Date.now();
  }

  changeName(params: { name: string }): void {
    this.ensureValidName(params.name);
    this.name = params.name; // Mutation!
  }

  setColor(params: { color: string }): void {
    this.color = params.color; // Mutation!
  }
}
```

**Why Entity?**

- ✅ Has unique ID (ULID)
- ✅ Can change over time (name, color, icon)
- ✅ Has lifecycle (created, modified, persisted)
- ✅ Two categories with same name are different categories
- ✅ Identity matters: "Work" category today is same "Work" category tomorrow

#### 2. **Session** (Entity ✅)

```typescript
export class Session extends AggregateRoot {
  public readonly id: ULID; // Identity!
  private categoryId: ULID;
  private segments: SessionSegment[];
  private isStopped: boolean;

  // Can change state
  pause(timeProvider: TimeProvider): void { ... }
  resume(timeProvider: TimeProvider): void { ... }
  stop(timeProvider: TimeProvider): void { ... }
}
```

**Why Entity?**

- ✅ Has unique ID
- ✅ State changes over time (paused, resumed, stopped)
- ✅ Lifecycle tracked (start time, end time, modifications)
- ✅ Two sessions started at same time are different sessions

#### 3. **SessionSegment** (Entity ✅)

```typescript
class SessionSegment {
  public readonly id: ULID; // Identity!
  private startedAt: DateTime;
  private stoppedAt?: DateTime;

  stop(timeProvider: TimeProvider): void {
    this.stoppedAt = timeProvider.now(); // Mutation!
  }
}
```

**Why Entity?**

- ✅ Has unique ID
- ✅ Can change (start active, then stopped)
- ✅ Part of Session aggregate
- ✅ Two segments with same start time are different segments

### Value Objects in Our Project

#### 1. **Duration** (Value Object ✅)

```typescript
class Duration {
  private constructor(private readonly milliseconds: number) {}

  static fromMilliseconds(ms: number): Duration {
    if (ms < 0) throw new Error("Duration cannot be negative");
    return new Duration(ms);
  }

  add(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds);
  }

  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds;
  }
}
```

**Why Value Object?**

- ✅ No ID needed
- ✅ Immutable (add returns new Duration)
- ✅ Defined by value (5000ms is 5000ms)
- ✅ Two 5-second durations are the same thing

#### 2. **DateTime** (Could be Value Object)

**Current (Type Alias):**

```typescript
export type DateTime = number;
```

**Better as Value Object:**

```typescript
class DateTime {
  private constructor(private readonly timestamp: number) {}

  static now(): DateTime {
    return new DateTime(Date.now());
  }

  static fromTimestamp(ms: number): DateTime {
    return new DateTime(ms);
  }

  isBefore(other: DateTime): boolean {
    return this.timestamp < other.timestamp;
  }

  equals(other: DateTime): boolean {
    return this.timestamp === other.timestamp;
  }
}
```

**Why Value Object?**

- ✅ No unique identity (2024-01-01 is 2024-01-01)
- ✅ Immutable (timestamps don't change)
- ✅ Defined by value (specific point in time)

#### 3. **CategoryName** (Could be Value Object)

```typescript
class CategoryName {
  private constructor(private readonly value: string) {}

  static create(name: string): CategoryName {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("Category name cannot be empty");
    }
    if (trimmed.length > 100) {
      throw new Error("Category name too long");
    }
    return new CategoryName(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CategoryName): boolean {
    return this.value === other.value;
  }
}
```

**Why Value Object?**

- ✅ No identity (string "Work" is string "Work")
- ✅ Immutable
- ✅ Encapsulates validation

---

## The Identity Test

### Question 1: "If I change all the attributes, is it still the same thing?"

**Entity:** Yes, it's the same thing (same ID)

```typescript
const category = new Category({ id: "123", name: "Work" });
category.changeName({ name: "Professional" });
category.setColor({ color: "#FF0000" });
// Still the same category (ID: 123)
```

**Value Object:** No, it's a different thing

```typescript
const money1 = Money.create(100, "USD");
const money2 = Money.create(200, "USD");
// Different money, different value
```

### Question 2: "Do I need to track this thing over time?"

**Entity:** Yes

- Users sign up, update profiles, make purchases (tracked over time)
- Sessions start, pause, resume, stop (lifecycle)
- Categories created, renamed, used in sessions (history matters)

**Value Object:** No

- Duration of 5 seconds is just 5 seconds
- Email "user@example.com" is just an email address
- Money $100 is just $100

### Question 3: "Can two instances with identical data be different things?"

**Entity:** Yes

```typescript
const user1 = new User(1, "John", "john@example.com");
const user2 = new User(2, "John", "john@example.com");
// Different users! (different IDs)
```

**Value Object:** No

```typescript
const email1 = Email.create("user@example.com");
const email2 = Email.create("user@example.com");
// Same email address! (same value)
```

---

## Common Mistakes

### ❌ Mistake 1: Value Object with ID

```typescript
// WRONG - Value objects don't need IDs
class Duration {
  constructor(
    private readonly id: string, // ❌ Why does duration need an ID?
    private readonly milliseconds: number,
  ) {}
}
```

**Fix:** Remove the ID - it's defined by its value!

### ❌ Mistake 2: Mutable Value Object

```typescript
// WRONG - Value objects should be immutable
class Money {
  constructor(
    public amount: number, // ❌ Public, mutable!
    public currency: string,
  ) {}

  setAmount(amount: number) {
    // ❌ Setter!
    this.amount = amount;
  }
}
```

**Fix:** Make it immutable!

```typescript
class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  withAmount(amount: number): Money {
    return new Money(amount, this.currency); // Return new instance
  }
}
```

### ❌ Mistake 3: Entity Without ID

```typescript
// WRONG - Entities need identity
class User {
  constructor(
    public name: string,
    public email: string,
  ) {}
  // ❌ How do we distinguish between users?
}
```

**Fix:** Add an ID!

```typescript
class User {
  constructor(
    public readonly id: UserId,
    public name: string,
    public email: string,
  ) {}
}
```

### ❌ Mistake 4: Comparing Entity by Value

```typescript
// WRONG - Entities should compare by ID
class Category {
  equals(other: Category): boolean {
    return (
      this.name === other.name && // ❌ Comparing by value!
      this.color === other.color
    );
  }
}
```

**Fix:** Compare by ID!

```typescript
class Category {
  equals(other: Category): boolean {
    return this.id === other.id; // ✅ Compare by identity!
  }
}
```

---

## When to Choose Which

### Choose Entity When:

✅ **Thing has a lifecycle**

- Created, modified, deleted over time
- Example: User account, Session, Order

✅ **Identity matters**

- Two things with same data are different
- Example: Two users named "John"

✅ **Thing can change**

- Needs to be updated while maintaining identity
- Example: User updates email, Session adds segments

✅ **Need to track over time**

- Need history, audit trail
- Example: Category used in multiple sessions

✅ **Relationships with other entities**

- Referenced by other parts of system
- Example: Session references Category by ID

### Choose Value Object When:

✅ **Thing is defined by its value**

- All that matters is what it is, not who it is
- Example: Duration, Email, Money

✅ **Thing is immutable**

- Doesn't change after creation
- Example: Transaction amount, Birth date

✅ **No lifecycle needed**

- Created, used, discarded
- Example: Color, Temperature, Coordinate

✅ **Equality by value makes sense**

- Two instances with same data are the same
- Example: Two "$100" are the same amount

✅ **Encapsulate related primitives**

- Group related data together
- Example: Amount + Currency = Money

---

## Refactoring Examples

### Example 1: String to Value Object

**Before (Primitive Obsession):**

```typescript
class Category {
  constructor(public name: string) {
    if (!name || name.trim().length === 0) {
      throw new Error("Name required");
    }
  }
}
```

**After (Value Object):**

```typescript
class CategoryName {
  private constructor(private readonly value: string) {}

  static create(name: string): CategoryName {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error("Name required");
    return new CategoryName(trimmed);
  }
}

class Category {
  constructor(public name: CategoryName) {
    // No validation needed - CategoryName is always valid!
  }
}
```

### Example 2: Multiple Primitives to Value Object

**Before:**

```typescript
class SessionSegment {
  constructor(
    public startTime: number,
    public endTime: number,
  ) {}

  getDuration(): number {
    return this.endTime - this.startTime;
  }
}
```

**After:**

```typescript
class TimeRange {
  constructor(
    private readonly start: DateTime,
    private readonly end: DateTime,
  ) {
    if (!end.isAfter(start)) {
      throw new Error("End must be after start");
    }
  }

  getDuration(): Duration {
    return Duration.between(this.start, this.end);
  }
}

class SessionSegment {
  constructor(public timeRange: TimeRange) {}

  getDuration(): Duration {
    return this.timeRange.getDuration();
  }
}
```

### Example 3: Mutable Data to Immutable Value Object

**Before:**

```typescript
class Session {
  private totalDuration: number = 0;

  addSegment(durationMs: number) {
    this.totalDuration += durationMs; // Mutation
  }
}
```

**After:**

```typescript
class Session {
  private totalDuration: Duration = Duration.zero();

  addSegment(duration: Duration) {
    this.totalDuration = this.totalDuration.add(duration); // New instance!
  }
}
```

---

## Testing Entities vs Value Objects

### Testing Entities

```typescript
describe("Category entity", () => {
  it("should maintain identity across changes", () => {
    const category = new Category({ name: "Work" });
    const originalId = category.id;

    category.changeName({ name: "Professional" });
    category.setColor({ color: "#FF0000" });

    // Same entity
    expect(category.id).toBe(originalId);
  });

  it("should be equal if same ID", () => {
    const cat1 = new Category({ id: "123", name: "Work" });
    const cat2 = new Category({ id: "123", name: "Different" });

    expect(cat1.equals(cat2)).toBe(true); // Same ID!
  });

  it("should not be equal if different ID", () => {
    const cat1 = new Category({ id: "123", name: "Work" });
    const cat2 = new Category({ id: "456", name: "Work" });

    expect(cat1.equals(cat2)).toBe(false); // Different IDs!
  });
});
```

### Testing Value Objects

```typescript
describe("Duration value object", () => {
  it("should be immutable", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = d1.add(Duration.fromSeconds(10));

    // Original unchanged
    expect(d1.toSeconds()).toBe(5);
    expect(d2.toSeconds()).toBe(15);
  });

  it("should be equal if same value", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(5);

    expect(d1.equals(d2)).toBe(true);
  });

  it("should not be equal if different value", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    expect(d1.equals(d2)).toBe(false);
  });
});
```

---

## Advanced: Entities Containing Value Objects

Entities often contain value objects as properties:

```typescript
class User {
  constructor(
    public readonly id: UserId, // Value Object
    private email: Email, // Value Object
    private address: Address, // Value Object
    private dateOfBirth: DateTime, // Value Object
  ) {}

  changeEmail(newEmail: Email): void {
    this.email = newEmail; // Replace value object
  }
}
```

**Benefits:**

- Entity handles lifecycle and identity
- Value objects handle validation and immutability
- Clear separation of concerns

---

## Summary

| Concept           | Entity                             | Value Object                               |
| ----------------- | ---------------------------------- | ------------------------------------------ |
| **Definition**    | Thing with unique identity         | Thing defined by its value                 |
| **Identity**      | Has ID (ULID, UUID, etc.)          | No ID                                      |
| **Equality**      | By ID only                         | By all attributes                          |
| **Mutability**    | Can change state                   | Always immutable                           |
| **Lifecycle**     | Created, modified, tracked         | Created, used, discarded                   |
| **Test Question** | "Is it the same thing?" → Check ID | "Is it the same value?" → Check all fields |

**Key Principle:**

- **Entities** = "Who it is" (identity matters)
- **Value Objects** = "What it is" (value matters)

**In Our Project:**

- **Entities:** Category, Session, SessionSegment
- **Value Objects:** Duration, DateTime (should be), CategoryName (could be)

**Decision Tree:**

1. Does it have a unique identity? → **Entity**
2. Is it defined purely by its value? → **Value Object**
3. Will it change over time while maintaining identity? → **Entity**
4. Is it immutable and replaceable? → **Value Object**

---

## Related Documents

- [Value Objects](./value-objects.md)
- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Invariants](./invariants.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapters 5-6)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapters 5-6)
- **Domain Modeling Made Functional** by Scott Wlaschin
