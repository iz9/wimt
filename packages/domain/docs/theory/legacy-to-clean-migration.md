# Legacy to Clean Migration Strategies

## Migrating to Clean Architecture

Migrating a legacy codebase to Clean Architecture is a marathon, not a sprint. It requires a strategic approach to avoid breaking existing functionality while incrementally improving the design.

### Key Principle

> "Don't rewrite from scratch. Refactor incrementally."

**The Goal:**

- ✅ Decouple business logic from frameworks
- ✅ Introduce tests
- ✅ Define clear boundaries
- ✅ Improve maintainability

---

## Strategy 1: Strangler Fig Pattern

**Concept:** Create a new system around the edges of the old one, gradually replacing pieces until the old system can be strangled (removed).

**How to Apply:**

1. **Identify a Slice:** Pick a small, isolated feature (e.g., "Create Category").
2. **Build New:** Implement this feature using Clean Architecture in a new module/package.
3. **Route:** Point the API/UI to the new implementation for this feature.
4. **Repeat:** Pick the next feature.
5. **Remove:** Once all features are moved, delete the legacy code.

**Example:**

```typescript
// Legacy Controller
class LegacyController {
  handleRequest(req, res) {
    if (req.path === "/create-category") {
      // Route to NEW Clean Architecture Use Case
      return newCreateCategoryController.handle(req, res);
    }
    // Fallback to OLD legacy logic
    return legacyService.handle(req, res);
  }
}
```

---

## Strategy 2: Anti-Corruption Layer (ACL)

**Concept:** Protect your new clean domain model from the messy legacy model using a translation layer.

**Scenario:** You need to use data from the legacy database/service, but its structure is bad.

**Implementation:**

```typescript
// Legacy Model (Messy)
interface LegacyUser {
  user_id: string;
  f_name: string;
  l_name: string;
  // ... 50 other fields
}

// New Domain Model (Clean)
class User {
  constructor(
    public readonly id: ULID,
    public readonly name: UserName,
  ) {}
}

// Anti-Corruption Layer (Translator)
class LegacyUserAdapter implements IUserRepository {
  constructor(private legacyDb: any) {}

  async findById(id: ULID): Promise<User | null> {
    const legacyUser = await this.legacyDb.findUser(id);
    if (!legacyUser) return null;

    // Translate Legacy -> Clean
    return new User(
      legacyUser.user_id,
      UserName.create(legacyUser.f_name, legacyUser.l_name),
    );
  }
}
```

**Benefit:** Your new domain model remains pure and doesn't know about `f_name` or `l_name`.

---

## Strategy 3: Bubble Context

**Concept:** Create a pristine "bubble" for new code. Inside the bubble, everything is perfect Clean Architecture. Outside, it interacts with legacy via ACLs.

**Steps:**

1. Define a **Bounded Context** for the new work.
2. Build a **Clean Core** (Domain + Use Cases).
3. Build **Adapters** to talk to the legacy system (database, APIs).
4. As the bubble grows, the legacy system shrinks.

---

## Tactical Refactoring Steps

### Step 1: Invert Dependencies

**Problem:** Business logic imports database directly.
**Fix:** Introduce an interface.

**Before:**

```typescript
import { db } from "./db"; // Direct dependency

class Service {
  save(data) {
    db.insert(data);
  }
}
```

**After:**

```typescript
// Interface (Port)
interface IRepository {
  save(data): void;
}

// Implementation (Adapter)
class DbRepository implements IRepository {
  save(data) {
    db.insert(data);
  }
}

// Service (Clean)
class Service {
  constructor(private repo: IRepository) {}
  save(data) {
    this.repo.save(data);
  }
}
```

### Step 2: Extract Domain Entities

**Problem:** Logic is scattered in services and controllers.
**Fix:** Group data and behavior into Entities.

**Before:**

```typescript
function approveOrder(order) {
  if (order.status === "PENDING") {
    order.status = "APPROVED";
  }
}
```

**After:**

```typescript
class Order {
  approve() {
    if (this.status !== 'PENDING') throw new Error(...);
    this.status = 'APPROVED';
  }
}
```

### Step 3: Introduce Use Cases

**Problem:** Controllers contain business logic.
**Fix:** Extract logic into Use Case classes.

---

## Database Migration Strategies

### 1. Shared Database

New code uses the **same database** as legacy code.

- ✅ Simplest to start.
- ❌ New model constrained by old schema.
- ⚠️ Use ACL to hide schema ugliness.

### 2. Parallel Database

New code uses a **new database**. Sync data between old and new.

- ✅ Total freedom for new schema.
- ❌ Complex synchronization (Dual Write or CDC).
- ⚠️ Use only if schema is unsalvageable.

---

## Summary

**Don't Rewrite:** Refactor incrementally using **Strangler Fig**.
**Protect Domain:** Use **Anti-Corruption Layers** to isolate new code from old data structures.
**Invert Dependencies:** The first step to Clean Architecture is breaking hard dependencies on infrastructure.
**Extract Domain:** Move logic from services/controllers into **Entities**.

**Mindset:** "Leave the campground cleaner than you found it."

---

## Related Documents

- [Hexagonal Architecture](./hexagonal-architecture.md)
- [Anti-Patterns & Code Smells](./anti-patterns-code-smells.md)
- [Bounded Contexts](./bounded-contexts.md)

---

## References

- **Working Effectively with Legacy Code** by Michael Feathers
- **Refactoring** by Martin Fowler
- **Monolith to Microservices** by Sam Newman
