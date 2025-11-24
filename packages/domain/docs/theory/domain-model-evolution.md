# Domain Model Evolution & Refactoring

## Evolving Your Domain Model

Domain models are not static. As you learn more about the business, your model **must** evolve. A model that doesn't change is likely a model that is becoming obsolete.

### Key Principle

> "Refactoring is not just for code cleanliness; it's for deepening your understanding of the domain."

**The Cycle:**

1. **Learn** new business insight
2. **Refactor** model to match insight
3. **Simplify** code based on new model
4. **Repeat**

---

## Signs You Need to Refactor

### 1. Awkward Naming

**Sign:** You find yourself explaining "Well, we call it `User`, but it's actually a `Customer`..."
**Fix:** Rename to match the Ubiquitous Language.

### 2. Logic Leaking

**Sign:** You see the same validation logic repeated in multiple services.
**Fix:** Push logic down into the Entity or Value Object.

### 3. God Aggregates

**Sign:** An Aggregate Root has too many responsibilities or is becoming a performance bottleneck.
**Fix:** Split the Aggregate.

### 4. Anemic Model

**Sign:** Entities are just data bags; services do all the work.
**Fix:** Move behavior into Entities.

---

## Common Refactoring Patterns

### 1. Extract Value Object

**Scenario:** You have primitive values that belong together or have associated logic.

**Before:**

```typescript
class Session {
  startTime: number;
  endTime: number | null;

  getDuration(): number {
    if (!this.endTime) return 0;
    return this.endTime - this.startTime;
  }
}
```

**Refactoring:**

1. Create `Duration` value object.
2. Replace primitives with `Duration`.

**After:**

```typescript
class Session {
  duration: Duration;

  getDuration(): Duration {
    return this.duration;
  }
}
```

### 2. Extract Entity

**Scenario:** Part of an aggregate has its own lifecycle or identity but is currently embedded.

**Before:**

```typescript
class Session {
  // Embedded segments logic
  segments: { start: number, end: number }[];

  addSegment(start: number) { ... }
  stopSegment(end: number) { ... }
}
```

**Refactoring:**

1. Create `SessionSegment` entity.
2. Delegate logic to the new entity.

**After:**

```typescript
class Session {
  segments: SessionSegment[];

  addSegment(timeProvider: TimeProvider) {
    this.segments.push(SessionSegment.create(timeProvider));
  }
}
```

### 3. Split Aggregate

**Scenario:** An aggregate is too large, causing concurrency issues or memory bloat.

**Before:**

```typescript
class Project {
  tasks: Task[]; // 1000s of tasks!

  addTask(task: Task) { ... }
  completeTask(taskId: ULID) { ... }
}
```

**Refactoring:**

1. Promote `Task` to its own Aggregate Root.
2. Reference `Project` by ID in `Task`.

**After:**

```typescript
class Project {
  // Only project-level data
  name: string;
}

class Task {
  projectId: ULID; // Reference by ID
  status: TaskStatus;
}
```

**Consequence:** You lose immediate consistency (can't update Project and Task in one transaction). You must use **Domain Events** for eventual consistency.

### 4. Merge Aggregates

**Scenario:** Two aggregates are always updated together, and the boundary creates unnecessary complexity.

**Before:**

```typescript
class Order { ... }
class OrderLine { ... } // Separate aggregate?
```

**Refactoring:**

1. Demote `OrderLine` to be an entity inside `Order`.

**After:**

```typescript
class Order {
  lines: OrderLine[]; // Managed by Order
}
```

---

## Safe Refactoring Techniques

### Parallel Change (Expand and Contract)

When changing a core model used by many parts of the system (DB, API, UI), use **Parallel Change** to avoid breaking everything.

**Step 1: Expand**
Add the new structure while keeping the old one.

```typescript
class Category {
  name: string; // Old
  categoryName: CategoryName; // New

  constructor(name: string) {
    this.name = name;
    this.categoryName = CategoryName.create(name); // Populate both
  }
}
```

**Step 2: Migrate**
Update all readers/writers to use the new structure.

```typescript
// Update use cases to read/write categoryName
const name = category.categoryName.value;
```

**Step 3: Contract**
Remove the old structure.

```typescript
class Category {
  // name: string; // Deleted
  categoryName: CategoryName;
}
```

---

## Handling Data Migration

Refactoring code is easy; refactoring data is hard.

### 1. Lazy Migration (Read-Repair)

Migrate data only when it is accessed.

```typescript
class SessionMapper {
  toDomain(row: any): Session {
    if (row.schema_version < 2) {
      return this.migrateV1toV2(row);
    }
    return this.standardMap(row);
  }
}
```

### 2. Eager Migration (Batch Job)

Run a script to update all records in the database.

```typescript
async function migrateAll() {
  const cursor = db.collection("sessions").find();
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const newDoc = transform(doc);
    await db.collection("sessions").save(newDoc);
  }
}
```

---

## Summary

**Evolution is Natural:** Don't fear changing your domain model. It's a sign of learning.

**Refactoring Patterns:**

- **Extract Value Object:** For primitives with logic.
- **Extract Entity:** For distinct lifecycles.
- **Split Aggregate:** For performance/concurrency.
- **Merge Aggregate:** For transactional consistency.

**Safety First:** Use **Parallel Change** pattern to refactor safely without breaking the system.

**Data:** Have a strategy for migrating existing data (Lazy vs Eager).

---

## Related Documents

- [Entities vs Value Objects](./entities-vs-value-objects.md)
- [Aggregate Root Pattern](./aggregate-root-pattern.md)
- [Anti-Patterns & Code Smells](./anti-patterns-code-smells.md)

---

## References

- **Refactoring to Patterns** by Joshua Kerievsky
- **Domain-Driven Design** by Eric Evans (Chapter 10: Supple Design)
- **Implementing Domain-Driven Design** by Vaughn Vernon
