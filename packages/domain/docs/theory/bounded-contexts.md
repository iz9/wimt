# Bounded Contexts

## What is a Bounded Context?

A **Bounded Context** is an explicit boundary within which a particular domain model is defined and applicable. It's where a specific **Ubiquitous Language** is valid and consistent.

### Key Principle

> "A model is not universal. Define explicit boundaries where each model applies."

**The Problem:**

```typescript
// ❌ "Session" means different things in different parts of system
// Time Tracking Context
class Session {
  categoryId: ULID;
  segments: SessionSegment[];
  pause(): void {}
}

// User Authentication Context (same name, different concept!)
class Session {
  userId: ULID;
  token: string;
  expiresAt: DateTime;
  logout(): void {}
}

// ❌ Confusion! Which Session is which?
```

**The Solution:**

```typescript
// ✅ Separate contexts with explicit boundaries

// packages/time-tracking (Time Tracking Context)
namespace TimeTracking {
  export class Session {
    // Tracking session
    categoryId: ULID;
    segments: SessionSegment[];
    pause(): void {}
  }
}

// packages/auth (Authentication Context)
namespace Auth {
  export class Session {
    // User session
    userId: ULID;
    token: string;
    logout(): void {}
  }
}

// ✅ Clear: TimeTracking.Session vs Auth.Session
```

---

## Why Bounded Contexts Matter

### 1. **Same Word, Different Meaning**

**Example: "Category" in different contexts**

```typescript
// E-Commerce Context
class Category {
  products: Product[];
  parent: Category | null;
  displayOnMenu: boolean;
}

// Time Tracking Context
class Category {
  sessions: Session[];
  color: string;
  icon: string;
}

// Same word, completely different models!
```

### 2. **Prevent Model Bloat**

**Without Bounded Contexts:**

```typescript
// ❌ One giant Session that tries to do everything
class Session {
  // Time tracking
  categoryId: ULID;
  segments: SessionSegment[];

  // Analytics
  analyticsData: AnalyticsSnapshot;
  metrics: Metric[];

  // Reporting
  reportFormat: string;
  exportSettings: ExportConfig;

  // Sync
  syncStatus: string;
  lastSynced: DateTime;

  // User preferences
  displaySettings: DisplayPrefs;

  // ❌ God object - too many responsibilities!
}
```

**With Bounded Contexts:**

```typescript
// ✅ Time Tracking Context - Core tracking
class Session {
  categoryId: ULID;
  segments: SessionSegment[];
  pause(): void {}
}

// ✅ Analytics Context - Separate model
class SessionAnalytics {
  sessionId: ULID;
  metrics: Metric[];
  snapshots: AnalyticsSnapshot[];
}

// ✅ Reporting Context - Separate model
class SessionReport {
  sessionId: ULID;
  format: ReportFormat;
  data: ReportData;
}

// Each context focused on its responsibility
```

### 3. **Independent Evolution**

**Different contexts can evolve independently:**

```typescript
// Time Tracking Context evolves
class Session {
  // Add new feature: tags
  tags: string[]; // ✅ Only in this context
}

// Analytics Context doesn't need tags
class SessionAnalytics {
  // Stays the same
  metrics: Metric[];
}
```

---

## Identifying Bounded Contexts

### Signs You Need a New Context

**1. Different language for same concept**

```
Marketing: "Lead", "Conversion", "Campaign"
Sales: "Prospect", "Deal", "Pipeline"
→ Two contexts: Marketing & Sales
```

**2. Different rules**

```
Inventory: Product can have negative stock (backorder)
Accounting: Product quantity cannot be negative
→ Two contexts: Inventory & Accounting
```

**3. Different teams**

```
Mobile team: Manages app, offline sync, local storage
Backend team: Manages API, database, business logic
→ Two contexts: Mobile & Backend
```

### Our Project's Contexts

```
┌─────────────────────────────────────────────────────────┐
│              TIME TRACKING CONTEXT                      │
│  (Core domain - main business value)                    │
│                                                         │
│  Entities: Session, Category, SessionSegment           │
│  Language: pause, resume, duration, segment            │
│  Focus: Tracking time accurately                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              ANALYTICS CONTEXT                          │
│  (Supporting - derive insights)                         │
│                                                         │
│  Entities: CategoryStatistics, SessionSummary          │
│  Language: total, average, trend, insight              │
│  Focus: Analyzing time data                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              REPORTING CONTEXT                          │
│  (Supporting - export data)                             │
│                                                         │
│  Entities: Report, Export, Template                    │
│  Language: export, format, template, generate          │
│  Focus: Exporting time data                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              USER CONTEXT                               │
│  (Supporting - user management)                         │
│                                                         │
│  Entities: User, Settings, Preferences                 │
│  Language: login, profile, preferences                  │
│  Focus: Managing users                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Context Relationships

### 1. Shared Kernel

**Two contexts share some code:**

```typescript
// Shared kernel: Common value objects
// packages/shared
export class ULID {}
export class DateTime {}
export class Duration {}

// Time Tracking Context uses shared kernel
import { ULID, DateTime } from "@wimt/shared";
class Session {
  id: ULID;
  startTime: DateTime;
}

// Analytics Context uses same shared kernel
import { ULID, DateTime } from "@wimt/shared";
class SessionAnalytics {
  sessionId: ULID;
  analysisTime: DateTime;
}
```

**When to use:**

- Small, stable code
- Low risk of breaking changes
- Both teams agree on changes

### 2. Customer-Supplier

**One context (supplier) provides data to another (customer):**

```typescript
// Time Tracking Context (Supplier)
// Provides session data
export interface ISessionProvider {
  getSession(id: ULID): Promise<Session>;
  getSessions(categoryId: ULID): Promise<Session[]>;
}

// Analytics Context (Customer)
// Consumes session data
class AnalyticsService {
  constructor(private sessionProvider: ISessionProvider) {}

  async calculateStats(categoryId: ULID): Promise<Stats> {
    const sessions = await this.sessionProvider.getSessions(categoryId);
    // Calculate analytics
  }
}
```

**Pattern:**

- Supplier defines interface
- Customer uses interface
- Clear dependency direction

### 3. Conformist

**Downstream context conforms to upstream:**

```typescript
// External API (Upstream - we don't control)
interface ExternalTimeTrackingAPI {
  entries: Array<{
    id: string;
    start_time: number;
    end_time: number;
  }>;
}

// Our Context (Downstream - conforms to their model)
class ExternalAPIAdapter {
  mapToSession(entry: ExternalTimeTrackingAPI["entries"][0]): Session {
    // Map their model to ours
    return new Session({
      id: entry.id as ULID,
      startTime: entry.start_time,
      // ...
    });
  }
}
```

### 4. Anti-Corruption Layer

**Protect our model from external systems:**

```typescript
// External calendar API (different model)
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

// ❌ Without ACL - external model leaks into our domain
class Session {
  static fromGoogleEvent(event: GoogleCalendarEvent): Session {
    // Our Session now depends on Google's structure!
  }
}

// ✅ With ACL - translate at boundary
class GoogleCalendarAdapter {
  toSession(event: GoogleCalendarEvent): Session {
    // Translation layer protects our domain
    return Session.create(
      this.extractCategoryId(event.summary),
      this.timeProvider,
    );
  }

  private extractCategoryId(summary: string): ULID {
    // Parse category from summary
  }
}

// Our domain stays clean
class Session {
  // No knowledge of Google Calendar
}
```

---

## Implementing Bounded Contexts

### Physical Boundaries (Recommended)

```
packages/
├── time-tracking/          # Time Tracking Context
│   ├── domain/
│   │   ├── Session.ts
│   │   ├── Category.ts
│   │   └── SessionSegment.ts
│   ├── application/
│   └── infrastructure/
│
├── analytics/              # Analytics Context
│   ├── domain/
│   │   ├── CategoryStatistics.ts
│   │   └── SessionSummary.ts
│   ├── application/
│   └── infrastructure/
│
├── reporting/              # Reporting Context
│   ├── domain/
│   │   ├── Report.ts
│   │   └── Export.ts
│   ├── application/
│   └── infrastructure/
│
└── shared/                 # Shared Kernel
    ├── ULID.ts
    ├── DateTime.ts
    └── Duration.ts
```

### Context Map

```typescript
// context-map.ts
/**
 * Context Map - Defines relationships between contexts
 *
 * Time Tracking (Core)
 *   ↓ (Customer-Supplier)
 * Analytics (Supporting)
 *   ↓ (Customer-Supplier)
 * Reporting (Supporting)
 *
 * All contexts use Shared Kernel (ULID, DateTime, Duration)
 */

// Time Tracking provides data
export interface ITimeTrackingProvider {
  getSession(id: ULID): Promise<Session>;
  getSessions(filter: SessionFilter): Promise<Session[]>;
  getCategory(id: ULID): Promise<Category>;
}

// Analytics consumes from Time Tracking
// Reporting consumes from Time Tracking
// Both depend on Time Tracking, not each other
```

---

## Translation Between Contexts

### Pattern: Context Mappers

```typescript
// Time Tracking Context
export class Session {
  id: ULID;
  categoryId: ULID;
  segments: SessionSegment[];

  getTotalDuration(): Duration {
    return this.segments.reduce(
      (sum, s) => sum.plus(s.getDuration() || Duration.zero()),
      Duration.zero(),
    );
  }
}

// Analytics Context (different model!)
export class SessionAnalytics {
  sessionId: ULID;
  categoryId: ULID;
  totalDurationMs: number; // Pre-calculated
  segmentCount: number; // Pre-calculated
  averageSegmentMs: number; // Pre-calculated
}

// Mapper translates between contexts
export class SessionAnalyticsMapper {
  static fromSession(session: Session): SessionAnalytics {
    const duration = session.getTotalDuration();
    const segments = session.getSegments();

    return new SessionAnalytics({
      sessionId: session.id,
      categoryId: session.getCategoryId(),
      totalDurationMs: duration.toMilliseconds(),
      segmentCount: segments.length,
      averageSegmentMs: duration.toMilliseconds() / segments.length,
    });
  }
}

// Usage
const session = await timeTrackingRepo.getSession(id);
const analytics = SessionAnalyticsMapper.fromSession(session);
await analyticsRepo.save(analytics);
```

### Pattern: Published Language

**Define shared DTOs at context boundaries:**

```typescript
// time-tracking/contracts/DTOs.ts
// Published Language - stable contract
export interface SessionDTO {
  id: string;
  categoryId: string;
  startTime: number;
  totalDurationMs: number;
  isActive: boolean;
}

// Time Tracking Context publishes this
export class SessionPublisher {
  toDTO(session: Session): SessionDTO {
    return {
      id: session.id,
      categoryId: session.getCategoryId(),
      startTime: session.getStartTime(),
      totalDurationMs: session.getTotalDuration().toMilliseconds(),
      isActive: !session.isStopped(),
    };
  }
}

// Analytics Context consumes this
export class SessionConsumer {
  fromDTO(dto: SessionDTO): SessionAnalytics {
    return new SessionAnalytics({
      sessionId: dto.id as ULID,
      categoryId: dto.categoryId as ULID,
      totalDurationMs: dto.totalDurationMs,
      // ...
    });
  }
}
```

---

## Current Project Context Strategy

### Single Monolith (Current)

```
packages/domain/          # All in one context now
├── entities/
│   ├── Session.ts
│   └── Category.ts
├── valueObjects/
├── services/
└── repositories/
```

**When to stay monolith:**

- ✅ Small team
- ✅ Simple domain
- ✅ Fast iteration
- ✅ No conflicting models

### Future: Split Contexts

**When to split:**

```
❌ Signs you need to split:

1. Models getting bloated
   Session has 20+ properties

2. Different teams
   Mobile team vs Backend team

3. Different update frequencies
   Core tracking stable, analytics changes often

4. Performance requirements
   Analytics needs denormalized read models

5. Independent deployment
   Want to deploy reporting without touching tracking
```

**How to split (future):**

```
packages/
├── time-tracking/        # Core domain
│   └── domain/
│       ├── Session.ts
│       └── Category.ts
│
├── analytics/            # Split when needed
│   └── domain/
│       ├── CategoryStats.ts
│       └── SessionSummary.ts
│
└── shared/               # Shared kernel
    ├── ULID.ts
    └── Duration.ts
```

---

## Context Integration Patterns

### 1. Events (Recommended)

```typescript
// Time Tracking Context publishes events
class Session {
  stop(timeProvider: TimeProvider): void {
    // ... business logic

    this.addEvent(
      new SessionStopped({
        sessionId: this.id,
        categoryId: this.categoryId,
        totalDuration: this.getTotalDuration().toMilliseconds(),
        occurredAt: timeProvider.now(),
      }),
    );
  }
}

// Analytics Context subscribes
@EventHandler("SessionStopped")
class UpdateAnalyticsOnSessionStopped {
  async handle(event: SessionStopped): Promise<void> {
    // Update analytics in our context
    await this.analyticsRepo.updateStats({
      categoryId: event.categoryId,
      addDuration: event.totalDuration,
      incrementCount: 1,
    });
  }
}

// ✅ Contexts decoupled via events
```

### 2. APIs (Synchronous)

```typescript
// Time Tracking exposes API
export class TimeTrackingAPI {
  constructor(private sessionRepo: ISessionRepository) {}

  async getSession(id: ULID): Promise<SessionDTO> {
    const session = await this.sessionRepo.findById(id);
    if (!session) throw new NotFoundError();
    return this.toDTO(session);
  }
}

// Analytics calls API
export class AnalyticsService {
  constructor(private timeTrackingAPI: TimeTrackingAPI) {}

  async analyzeSession(sessionId: ULID): Promise<Analytics> {
    const sessionDTO = await this.timeTrackingAPI.getSession(sessionId);
    // Analyze
  }
}
```

### 3. Shared Database (Anti-pattern for separate contexts)

```typescript
// ❌ Both contexts accessing same tables
// Time Tracking
await db.query("SELECT * FROM sessions WHERE id = ?", [id]);

// Analytics
await db.query("SELECT * FROM sessions WHERE category_id = ?", [categoryId]);

// ❌ Shared database couples contexts
// Changes to schema affect both
// No clear boundary
```

---

## Best Practices

### ✅ DO:

**1. Make boundaries explicit**

```typescript
// ✅ Clear boundaries via directories
packages/time-tracking/
packages/analytics/
packages/shared/
```

**2. Use Anti-Corruption Layer for external systems**

```typescript
// ✅ Protect domain from external models
class GoogleCalendarACL {
  toSession(event: GoogleCalendarEvent): Session {}
}
```

**3. Define clear interfaces between contexts**

```typescript
// ✅ Published interface
export interface ITimeTrackingProvider {
  getSession(id: ULID): Promise<SessionDTO>;
}
```

**4. Keep shared kernel minimal**

```typescript
// ✅ Only stable, low-level concepts
export class ULID {}
export class DateTime {}
export class Duration {}

// ❌ Don't put domain entities in shared kernel
```

### ❌ DON'T:

**1. Don't share domain entities across contexts**

```typescript
// ❌ Bad
// Analytics importing Time Tracking entity
import { Session } from "@wimt/time-tracking";

// ✅ Good
// Analytics has its own model
class SessionAnalytics {}
```

**2. Don't let contexts leak into each other**

```typescript
// ❌ Bad - Analytics logic in Time Tracking
class Session {
  calculateStatistics(): Statistics {
    // ❌ Analytics concern!
  }
}

// ✅ Good - Separate contexts
class SessionAnalytics {
  calculate(): Statistics {}
}
```

**3. Don't share databases without boundaries**

```typescript
// ❌ Bad - Direct access
// Analytics querying tracking tables
db.query("SELECT * FROM sessions");

// ✅ Good - Via interface
timeTrackingProvider.getSessions();
```

---

## Summary

**Bounded Context:**

- Explicit boundary where a model applies
- Has its own Ubiquitous Language
- Can have same terms with different meanings
- Prevents model bloat

**Context Relationships:**

- **Shared Kernel** - Shared code
- **Customer-Supplier** - One provides, other consumes
- **Anti-Corruption Layer** - Protect from external systems
- **Conformist** - Accept upstream model

**Our Project:**

- Currently: Single context (time tracking)
- Future: May split into tracking, analytics, reporting
- Use events to integrate contexts
- Keep shared kernel minimal (ULID, DateTime, Duration)

**When to Split:**

- Models getting bloated
- Different teams
- Different update frequencies
- Need independent deployment

**Key Benefit:** Each context focused, evolvable, and maintainable!

---

## Related Documents

- [Ubiquitous Language](./ubiquitous-language.md)
- [Domain Events](./domain-events.md)
- [Event Handlers](./event-handlers.md)

---

## References

- **Domain-Driven Design** by Eric Evans (Chapter 14: Maintaining Model Integrity)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 2-4: Bounded Contexts)
- **Domain-Driven Design Distilled** by Vaughn Vernon
