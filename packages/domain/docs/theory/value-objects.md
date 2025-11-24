# Value Objects

## What is a Value Object?

A **Value Object** is a domain concept that is defined by its **attributes** rather than its **identity**. Unlike entities, value objects have no unique identifier - two value objects with the same attributes are considered equal.

### Simple Example

```typescript
// Value Object: Two instances with same value are equal
const price1 = new Money(100, "USD");
const price2 = new Money(100, "USD");
price1.equals(price2); // true - same value, same thing!

// Entity: Two instances with same data are still different
const user1 = new User(1, "John");
const user2 = new User(2, "John"); // Different people, same name
user1.equals(user2); // false - different identity!
```

**Key Insight:** Value objects are about **what they are** (their value), entities are about **who they are** (their identity).

---

## Characteristics of Value Objects

### 1. **Immutable**

Once created, a value object cannot change. Need a different value? Create a new object.

```typescript
class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  // Returns NEW object, doesn't modify this one
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch");
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  // No setters - immutable!
}
```

**Why immutable?**

- Thread-safe
- Predictable
- Can be shared safely
- Prevents accidental modifications

### 2. **Identity by Value**

Two value objects are equal if all their attributes are equal.

```typescript
class Duration {
  constructor(private readonly milliseconds: number) {}

  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds;
  }
}

const duration1 = new Duration(5000);
const duration2 = new Duration(5000);

duration1 === duration2; // false (different objects in memory)
duration1.equals(duration2); // true (same value!)
```

### 3. **Self-Validating**

Value objects ensure they are always valid through constructor validation.

```typescript
class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      throw new Error("Email cannot be empty");
    }

    if (!trimmed.includes("@")) {
      throw new Error("Invalid email format");
    }

    return new Email(trimmed);
  }

  toString(): string {
    return this.value;
  }
}

// Cannot create invalid email
const email = Email.create("user@example.com"); // ✅
Email.create("invalid"); // ❌ Throws error
```

### 4. **Conceptually Whole**

Value objects represent a complete concept, not just primitive types.

```typescript
// ❌ Primitive obsession
function calculatePrice(amount: number, currency: string): number { ... }

// ✅ Value object
class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {}
}

function calculatePrice(price: Money): Money { ... }
```

---

## Why Use Value Objects?

### 1. **Type Safety**

```typescript
// Without value objects - easy to mix up!
function transfer(from: string, to: string, amount: number, currency: string) {
  // Oops, swapped from/to!
  debit(to, amount, currency);
  credit(from, amount, currency);
}

// With value objects - compiler catches errors
function transfer(from: AccountId, to: AccountId, money: Money) {
  debit(to, money); // Type error if parameters swapped!
  credit(from, money);
}
```

### 2. **Encapsulate Validation**

```typescript
// Without value objects - validation everywhere
function setName(name: string) {
  if (!name || name.trim().length === 0) {
    throw new Error("Name required");
  }
  if (name.length > 100) {
    throw new Error("Name too long");
  }
  this.name = name;
}

// With value objects - validate once
class CategoryName {
  private constructor(private readonly value: string) {}

  static create(name: string): CategoryName {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error("Name required");
    if (trimmed.length > 100) throw new Error("Name too long");
    return new CategoryName(trimmed);
  }
}

// Everywhere else, just use it - guaranteed valid
function setName(name: CategoryName) {
  this.name = name; // No validation needed!
}
```

### 3. **Express Domain Concepts**

```typescript
// Unclear - what does this mean?
const x = 5000;

// Clear - domain concept
const duration = Duration.fromMilliseconds(5000);
const sessionLength = Duration.fromMinutes(30);
```

### 4. **Reduce Errors**

```typescript
// Easy to make mistakes
function calculateDuration(start: number, end: number): number {
  return end - start; // Or is it start - end?
}

// Hard to make mistakes
function calculateDuration(start: DateTime, end: DateTime): Duration {
  return Duration.between(start, end); // Clear intent
}
```

---

## Value Objects in Our Project

### Example 1: DateTime (Current)

**Current approach:**

```typescript
export type DateTime = number;
```

This is a **primitive obsession**. We're using a number, but it represents a point in time.

**Better with Value Object:**

```typescript
class DateTime {
  private constructor(private readonly timestamp: number) {}

  static now(): DateTime {
    return new DateTime(Date.now());
  }

  static fromTimestamp(ms: number): DateTime {
    if (!Number.isFinite(ms)) {
      throw new Error("Invalid timestamp");
    }
    return new DateTime(ms);
  }

  toMilliseconds(): number {
    return this.timestamp;
  }

  isBefore(other: DateTime): boolean {
    return this.timestamp < other.timestamp;
  }

  isAfter(other: DateTime): boolean {
    return this.timestamp > other.timestamp;
  }

  equals(other: DateTime): boolean {
    return this.timestamp === other.timestamp;
  }
}
```

### Example 2: Duration (Needed)

```typescript
class Duration {
  private constructor(private readonly milliseconds: number) {}

  static fromMilliseconds(ms: number): Duration {
    if (ms < 0) {
      throw new Error("Duration cannot be negative");
    }
    if (!Number.isFinite(ms)) {
      throw new Error("Duration must be finite");
    }
    return new Duration(ms);
  }

  static fromSeconds(seconds: number): Duration {
    return Duration.fromMilliseconds(seconds * 1000);
  }

  static fromMinutes(minutes: number): Duration {
    return Duration.fromMilliseconds(minutes * 60 * 1000);
  }

  static between(start: DateTime, end: DateTime): Duration {
    const diff = end.toMilliseconds() - start.toMilliseconds();
    return Duration.fromMilliseconds(diff);
  }

  toMilliseconds(): number {
    return this.milliseconds;
  }

  toSeconds(): number {
    return this.milliseconds / 1000;
  }

  toMinutes(): number {
    return this.milliseconds / (60 * 1000);
  }

  toHours(): number {
    return this.milliseconds / (60 * 60 * 1000);
  }

  add(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds);
  }

  isLessThan(other: Duration): boolean {
    return this.milliseconds < other.milliseconds;
  }

  isGreaterThan(other: Duration): boolean {
    return this.milliseconds > other.milliseconds;
  }

  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds;
  }
}
```

**Usage:**

```typescript
class Session extends AggregateRoot {
  getTotalDuration(): Duration {
    return this.segments.reduce(
      (total, segment) => total.add(segment.getDuration()),
      Duration.fromMilliseconds(0)
    );
  }
}

// Business rule using value object
const MIN_DURATION = Duration.fromMilliseconds(300);

if (segmentDuration.isLessThan(MIN_DURATION)) {
  this.addEvent(new SegmentTooShort(...));
}
```

### Example 3: CategoryName (Potential)

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

class Category extends AggregateRoot {
  constructor(params: { name: CategoryName; id?: ULID }) {
    super();
    this.name = params.name; // Already validated!
    this.id = params.id ?? makeId();
  }
}
```

---

## When to Use Value Objects

### ✅ Use Value Object When:

**1. Identity doesn't matter**

- Two things with same attributes are the same thing
- Example: Money, Duration, DateRange, Color

**2. Concept has validation rules**

- Email format, phone number format
- Value ranges (0-100 percentage)
- Business rules (minimum duration)

**3. Primitive obsession**

- Using strings/numbers for domain concepts
- Example: Using `string` for email, `number` for money

**4. Multiple related primitives**

- Amount + currency = Money
- Street + city + zip = Address
- Start + end = DateRange

**5. Immutability is desired**

- Values that shouldn't change
- Sharable state

### ❌ Don't Use Value Object When:

**1. Identity matters**

- Two users with same name are different people
- Two sessions started at same time are different sessions
- Use Entity instead!

**2. Object needs to change**

- Mutable state over time
- Use Entity with identity

**3. Simple primitive is enough**

- Not everything needs to be a value object
- `userId: string` might be fine
- Only wrap if it adds value

**4. Performance critical**

- Value objects create more objects
- Usually not a problem, but consider for hot paths

---

## Implementing Value Objects

### Pattern 1: Simple Value Object

```typescript
class Temperature {
  private constructor(private readonly celsius: number) {}

  static fromCelsius(c: number): Temperature {
    return new Temperature(c);
  }

  static fromFahrenheit(f: number): Temperature {
    return new Temperature(((f - 32) * 5) / 9);
  }

  toCelsius(): number {
    return this.celsius;
  }

  toFahrenheit(): number {
    return (this.celsius * 9) / 5 + 32;
  }

  equals(other: Temperature): boolean {
    return this.celsius === other.celsius;
  }
}
```

### Pattern 2: Multi-Attribute Value Object

```typescript
class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error("Amount cannot be negative");
    }
    if (!currency || currency.length !== 3) {
      throw new Error("Invalid currency code");
    }
    return new Money(amount, currency.toUpperCase());
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("Cannot add different currencies");
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### Pattern 3: Range Value Object

```typescript
class DateRange {
  private constructor(
    private readonly start: DateTime,
    private readonly end: DateTime,
  ) {}

  static create(start: DateTime, end: DateTime): DateRange {
    if (end.isBefore(start)) {
      throw new Error("End date must be after start date");
    }
    return new DateRange(start, end);
  }

  getStart(): DateTime {
    return this.start;
  }

  getEnd(): DateTime {
    return this.end;
  }

  getDuration(): Duration {
    return Duration.between(this.start, this.end);
  }

  contains(dateTime: DateTime): boolean {
    return !dateTime.isBefore(this.start) && !dateTime.isAfter(this.end);
  }

  overlaps(other: DateRange): boolean {
    return !this.end.isBefore(other.start) && !other.end.isBefore(this.start);
  }

  equals(other: DateRange): boolean {
    return this.start.equals(other.start) && this.end.equals(other.end);
  }
}
```

---

## Value Object Best Practices

### 1. **Use Private Constructor + Static Factory**

```typescript
class Email {
  // Private - can't call directly
  private constructor(private readonly value: string) {}

  // Public factory - enforces validation
  static create(email: string): Email {
    // Validation here
    return new Email(email);
  }
}
```

**Why?**

- Forces validation
- Can't bypass with `new Email()`
- Can have multiple factory methods

### 2. **Make All Fields Readonly**

```typescript
class Point {
  constructor(
    private readonly x: number,
    private readonly y: number,
  ) {}

  // No setX(), setY() methods!
  // Return new instance instead
  moveX(dx: number): Point {
    return new Point(this.x + dx, this.y);
  }
}
```

### 3. **Implement Equals Method**

```typescript
class UserId {
  constructor(private readonly value: string) {}

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
```

### 4. **Provide Convenient Factories**

```typescript
class Duration {
  static fromMilliseconds(ms: number): Duration { ... }
  static fromSeconds(s: number): Duration { ... }
  static fromMinutes(m: number): Duration { ... }
  static fromHours(h: number): Duration { ... }

  static zero(): Duration {
    return Duration.fromMilliseconds(0);
  }
}
```

### 5. **Encapsulate Behavior**

```typescript
class Money {
  // Don't just expose amount and currency
  // Provide meaningful operations

  add(other: Money): Money { ... }
  subtract(other: Money): Money { ... }
  multiply(factor: number): Money { ... }
  isGreaterThan(other: Money): boolean { ... }

  // Not just getters!
}
```

---

## Testing Value Objects

### Test Creation

```typescript
describe("Duration", () => {
  it("should create from milliseconds", () => {
    const duration = Duration.fromMilliseconds(5000);

    expect(duration.toMilliseconds()).toBe(5000);
  });

  it("should create from seconds", () => {
    const duration = Duration.fromSeconds(5);

    expect(duration.toMilliseconds()).toBe(5000);
  });
});
```

### Test Validation

```typescript
describe("Duration validation", () => {
  it("should reject negative duration", () => {
    expect(() => Duration.fromMilliseconds(-100)).toThrow(
      "Duration cannot be negative",
    );
  });

  it("should reject infinite duration", () => {
    expect(() => Duration.fromMilliseconds(Infinity)).toThrow(
      "Duration must be finite",
    );
  });
});
```

### Test Equality

```typescript
describe("Duration equality", () => {
  it("should be equal if same value", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromMilliseconds(5000);

    expect(d1.equals(d2)).toBe(true);
  });

  it("should not be equal if different value", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    expect(d1.equals(d2)).toBe(false);
  });
});
```

### Test Operations

```typescript
describe("Duration operations", () => {
  it("should add durations", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    const sum = d1.add(d2);

    expect(sum.toSeconds()).toBe(15);
  });

  it("should compare durations", () => {
    const short = Duration.fromSeconds(5);
    const long = Duration.fromSeconds(10);

    expect(short.isLessThan(long)).toBe(true);
    expect(long.isGreaterThan(short)).toBe(true);
  });
});
```

### Test Immutability

```typescript
describe("Duration immutability", () => {
  it("should not modify original on add", () => {
    const d1 = Duration.fromSeconds(5);
    const d2 = Duration.fromSeconds(10);

    const sum = d1.add(d2);

    // Original unchanged
    expect(d1.toSeconds()).toBe(5);
    expect(d2.toSeconds()).toBe(10);

    // New object created
    expect(sum.toSeconds()).toBe(15);
  });
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Mutable Value Object

```typescript
// BAD - Can be modified!
class Money {
  constructor(
    public amount: number, // public!
    public currency: string, // public!
  ) {}
}

const money = new Money(100, "USD");
money.amount = 200; // Mutation - bad!
```

**Fix:**

```typescript
// GOOD - Immutable
class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  getAmount(): number {
    return this.amount;
  }
}
```

### ❌ Pitfall 2: No Validation

```typescript
// BAD - Can create invalid value
class Email {
  constructor(private readonly value: string) {}
}

const email = new Email("not-an-email"); // Oops!
```

**Fix:**

```typescript
// GOOD - Validates on creation
class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    if (!email.includes("@")) {
      throw new Error("Invalid email");
    }
    return new Email(email);
  }
}
```

### ❌ Pitfall 3: Using === Instead of equals()

```typescript
const d1 = Duration.fromSeconds(5);
const d2 = Duration.fromSeconds(5);

if (d1 === d2) {
  // ❌ Always false - different objects!
  console.log("Equal");
}

if (d1.equals(d2)) {
  // ✅ True - same value!
  console.log("Equal");
}
```

### ❌ Pitfall 4: Primitive Obsession

```typescript
// BAD - Just primitives
function calculateTotal(
  amount: number,
  currency: string,
  tax: number
): number { ... }

// GOOD - Value objects
function calculateTotal(
  price: Money,
  taxRate: Percentage
): Money { ... }
```

---

## Value Objects vs Entities

| Aspect         | Value Object           | Entity                     |
| -------------- | ---------------------- | -------------------------- |
| **Identity**   | No unique ID           | Has unique ID              |
| **Equality**   | By value               | By ID                      |
| **Mutability** | Immutable              | Often mutable              |
| **Lifecycle**  | Created, discarded     | Created, modified, tracked |
| **Example**    | Duration, Money, Email | Category, Session, User    |
| **Comparison** | `obj1.equals(obj2)`    | `obj1.id === obj2.id`      |
| **Sharing**    | Safe to share          | Be careful sharing         |

### When to Choose

**Choose Value Object if:**

- "Is this thing defined by what it is?"
- "Are two instances with same data the same thing?"
- Answer: **Yes** → Value Object

**Choose Entity if:**

- "Does this thing have a lifecycle?"
- "Can two instances have same data but be different?"
- Answer: **Yes** → Entity

**Examples:**

- **Value Object:** Two `Duration(5000ms)` are the same duration
- **Entity:** Two `Category("Work")` are different categories (different IDs)

---

## Advanced Patterns

### Pattern: Value Object Collections

```typescript
class Tags {
  private constructor(private readonly values: readonly string[]) {}

  static create(tags: string[]): Tags {
    const unique = [...new Set(tags.map((t) => t.trim().toLowerCase()))];
    return new Tags(unique);
  }

  contains(tag: string): boolean {
    return this.values.includes(tag.toLowerCase());
  }

  add(tag: string): Tags {
    if (this.contains(tag)) {
      return this;
    }
    return new Tags([...this.values, tag.toLowerCase()]);
  }

  toArray(): readonly string[] {
    return this.values;
  }
}
```

### Pattern: Composite Value Objects

```typescript
class Address {
  constructor(
    private readonly street: Street,
    private readonly city: City,
    private readonly zipCode: ZipCode,
    private readonly country: Country,
  ) {}

  // Each component is also a value object!
}

class Street {
  private constructor(private readonly value: string) {}

  static create(street: string): Street {
    const trimmed = street.trim();
    if (trimmed.length === 0) {
      throw new Error("Street cannot be empty");
    }
    return new Street(trimmed);
  }
}
```

### Pattern: Null Object

```typescript
class Duration {
  static zero(): Duration {
    return Duration.fromMilliseconds(0);
  }

  isZero(): boolean {
    return this.milliseconds === 0;
  }
}

// Usage - avoid null checks
const duration = session.getDuration() ?? Duration.zero();
```

---

## Serialization

Value objects often need to be serialized for storage/transport:

```typescript
class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {}

  static create(amount: number, currency: string): Money { ... }

  // Serialization
  toJSON(): { amount: number; currency: string } {
    return {
      amount: this.amount,
      currency: this.currency
    };
  }

  // Deserialization
  static fromJSON(json: { amount: number; currency: string }): Money {
    return Money.create(json.amount, json.currency);
  }
}

// Usage
const money = Money.create(100, 'USD');
const json = JSON.stringify(money); // Automatically calls toJSON()
const restored = Money.fromJSON(JSON.parse(json));
```

---

## Summary

**Value Objects:**

- Are defined by their **value**, not identity
- Are **immutable** - cannot change after creation
- Are **self-validating** - always in valid state
- Represent **domain concepts** - not just primitives
- Are **equal by value** - implement `equals()` method
- Are **safe to share** - immutable and no identity

**Use them to:**

- Replace **primitive obsession**
- **Encapsulate validation** in one place
- Make code more **type-safe**
- Express **domain concepts** clearly
- **Reduce errors** through immutability

**In our project:**

- Create `Duration` value object ⭐ Most important!
- Consider `CategoryName` value object
- Maybe enhance `DateTime` to full value object

**Key Principle:** If it's defined by what it is, not who it is, make it a value object!

---

## Related Documents

- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Invariants](./invariants.md)
- [Domain Errors](./domain-errors.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 5: Model-Driven Design)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 6: Value Objects)
- **Domain Modeling Made Functional** by Scott Wlaschin
