# Implementation Plan: Time Tracking Application

## 🤖 Context Recovery Prompt

```
You are working on a time tracking application following strict DDD (Domain-Driven Design) and Clean Architecture principles. The project is a monorepo using Turborepo with the following structure:

**Key Principles:**
1. Domain layer must be PURE - no dependencies on frameworks, infrastructure, or UI
2. All business logic resides in the domain layer
3. Use dependency inversion - domain defines interfaces, infrastructure implements them
4. Domain events are used for side effects and decoupling
5. Aggregates enforce business invariants
6. Application layer orchestrates use cases using domain objects

**Current State:**
- Domain package: `@wimt/domain` - contains entities, value objects, aggregates, events, and errors
- Apps: mobile (React Native), web (Next.js), docs (Next.js)
- Key aggregates: Category, Session (with SessionSegment entities)
- Domain events already defined for session lifecycle
- EventStorming document in `packages/domain/docs/eventStorming/eventStorming-19-11-25.md`

**Next Steps:** Refer to this implementation plan document for the layered architecture implementation.
```

---

## 📋 Overview

This document outlines the next steps for implementing the time tracking application following DDD and Clean Architecture principles. The application tracks time spent on different categories, allowing users to start/pause/resume/stop sessions.

### Current Architecture Status

✅ **Completed:**

- Domain entities: `Category`
- Aggregate root base class with event collection
- Domain events: `CategoryCreated`, `SessionStarted`, `SessionPaused`, `SessionResumed`, `SessionStopped`, `SegmentTooShort`, `SessionExported`
- Value objects: `DateTime`, `ULID`
- Domain errors defined
- EventStorming analysis complete

🔄 **In Progress:**

- Session aggregate implementation
- SessionSegment entity

❌ **Missing:**

- Application layer (use cases/command handlers)
- Infrastructure layer (repositories, persistence, time provider implementation)
- Presentation layer integration
- Dependency injection container setup
- Testing infrastructure

---

## 🏗️ Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (Mobile, Web, API Adapters)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Application Layer                      │
│        (Use Cases, Commands, Queries, DTOs)              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                     Domain Layer                         │
│   (Entities, Aggregates, Value Objects, Events, Rules)   │
│                    ⚠️ PURE - NO DEPS                     │
└──────────────────────────────────────────────────────────┘
                        ▲
┌───────────────────────┴─────────────────────────────────┐
│                 Infrastructure Layer                     │
│     (Repositories, DB, File System, External APIs)       │
└──────────────────────────────────────────────────────────┘
```

---

## 📦 Package Structure

### Recommended Monorepo Packages

```
packages/
├── domain/              # ✅ Pure domain logic (exists)
├── application/         # ❌ Use cases, command/query handlers (TO CREATE)
├── infrastructure/      # ❌ Repositories, adapters (TO CREATE)
└── shared/              # ❌ Common types, utilities (TO CREATE)

apps/
├── mobile/             # React Native app
├── web/                # Next.js web app
└── docs/               # Documentation site
```

---

## 🎯 Implementation Steps

### Phase 1: Complete Domain Layer

#### 1.1 Session Aggregate (High Priority)

**File:** `packages/domain/src/aggregates/Session.ts`

**Requirements:**

- Extends `AggregateRoot`
- Contains `SessionSegment[]` entities
- Properties:
  - `id: ULID`
  - `categoryId: ULID`
  - `segments: SessionSegment[]`
  - `isStopped: boolean`

**Methods to implement:**

- `static create(categoryId: ULID, timeProvider: TimeProvider): Session` - Creates new session with first segment
- `pause(timeProvider: TimeProvider): void` - Pauses current active segment
- `resume(timeProvider: TimeProvider): void` - Creates new segment
- `stop(timeProvider: TimeProvider): void` - Stops session permanently
- `getTotalDuration(): Duration` - Calculate total time across segments
- `export(): ExportedSessionData` - Prepare data for export

**Business Rules to Enforce:**

- Only one active segment at a time
- Cannot pause if no active segment (throw `NoActiveSegmentError`)
- Cannot resume if already active
- Cannot start new segment if stopped (throw `SessionAlreadyStoppedError`)
- Segments < 300ms emit `SegmentTooShort` event and are not saved
- No overlapping segments (throw `OverlapingSegmentError`)

**Domain Events to Emit:**

- `SessionStarted` - when session is created
- `SessionPaused` - when segment ends
- `SessionResumed` - when new segment starts after pause
- `SessionStopped` - when session ends permanently
- `SegmentTooShort` - when segment is filtered out

#### 1.2 SessionSegment Entity

**File:** `packages/domain/src/entities/SessionSegment.ts`

**Requirements:**

- NOT an aggregate root
- Properties:
  - `id: ULID`
  - `startedAt: DateTime`
  - `stoppedAt?: DateTime`

**Methods:**

- `static start(timeProvider: TimeProvider): SessionSegment`
- `stop(timeProvider: TimeProvider): void`
- `getDuration(): Duration`
- `isActive(): boolean`

#### 1.3 Enhanced Value Objects

**File:** `packages/domain/src/valueObjects/Duration.ts`

**Requirements:**

- Constructor takes milliseconds
- Factory methods: `fromMilliseconds()`, `between(start, end)`
- Conversion methods: `toMilliseconds()`, `toSeconds()`, `toMinutes()`, `toHours()`
- Comparison methods: `isLessThan()`, `add()`

**Why:** Encapsulates duration calculations and comparisons, enforces business rule for minimum segment duration (300ms).

#### 1.4 Repository Interfaces (Domain Layer)

**File:** `packages/domain/src/repositories/ICategoryRepository.ts`

**Methods:**

- `save(category: Category): Promise<void>`
- `findById(id: ULID): Promise<Category | null>`
- `findAll(): Promise<Category[]>`

**File:** `packages/domain/src/repositories/ISessionRepository.ts`

**Methods:**

- `save(session: Session): Promise<void>`
- `findById(id: ULID): Promise<Session | null>`
- `findByCategory(categoryId: ULID): Promise<Session[]>`
- `findActive(): Promise<Session[]>`

**Why:** Domain defines contracts, infrastructure provides implementations. This is dependency inversion.

---

### Phase 2: Application Layer (New Package)

#### 2.1 Create Application Package

**Action:** Create `packages/application/` with proper package.json

**Dependencies:**

- `@wimt/domain` (workspace)
- `inversify` for DI
- `reflect-metadata`

**Structure:**

```
packages/application/
├── src/
│   ├── useCases/
│   │   ├── category/
│   │   │   ├── CreateCategory.ts
│   │   │   └── ListCategories.ts
│   │   └── session/
│   │       ├── StartSession.ts
│   │       ├── PauseSession.ts
│   │       ├── ResumeSession.ts
│   │       ├── StopSession.ts
│   │       └── ExportSession.ts
│   ├── commands/
│   │   └── ...command DTOs
│   ├── queries/
│   │   └── ...query DTOs
│   └── services/
│       └── DomainEventPublisher.ts
└── package.json
```

#### 2.2 Use Case Implementation Pattern

**Example:** `packages/application/src/useCases/session/StartSession.ts`

**Structure:**

- Inject dependencies: repositories, time provider, event publisher (all via interfaces)
- Define command DTO (input) and result DTO (output)
- Use `@injectable()` decorator for DI
- Use `@inject()` for constructor parameters

**Execution Flow:**

1. Validate inputs (e.g., category exists)
2. Use domain objects to execute business logic
3. Persist changes via repositories
4. Pull domain events from aggregates
5. Publish events via event publisher
6. Return result DTO

**Why this pattern:**

- Use case orchestrates the workflow
- Domain objects contain business logic
- Events are collected from aggregates and published
- Infrastructure concerns (persistence) are abstracted via interfaces
- Single responsibility: one use case per user action

#### 2.3 Command/Query DTOs

**File:** `packages/application/src/commands/CreateCategoryCommand.ts`

**Purpose:** Define input/output interfaces for each use case

**Why:** DTOs decouple external API from domain models, allow validation at application boundary.

#### 2.4 Domain Event Publisher

**File:** `packages/application/src/services/DomainEventPublisher.ts`

**Responsibilities:**

- Maintain map of event types to handler functions
- `subscribe(eventType, handler)` - Register event listeners
- `publish(event)` - Execute all handlers for given event type
- Use `@injectable()` decorator for DI

**Why:** Allows decoupled reaction to domain events (logging, analytics, notifications, read model updates).

---

### Phase 3: Infrastructure Layer (New Package)

#### 3.1 Create Infrastructure Package

**Structure:**

```
packages/infrastructure/
├── src/
│   ├── persistence/
│   │   ├── inMemory/
│   │   │   ├── InMemoryCategoryRepository.ts
│   │   │   └── InMemorySessionRepository.ts
│   │   ├── sqlite/
│   │   │   ├── SqliteCategoryRepository.ts
│   │   │   └── SqliteSessionRepository.ts
│   │   └── AsyncStorage/
│   │       └── (React Native persistence)
│   ├── time/
│   │   └── SystemTimeProvider.ts
│   └── export/
│       └── MarkdownExporter.ts
└── package.json
```

#### 3.2 Repository Implementations

**File:** `packages/infrastructure/src/persistence/inMemory/InMemoryCategoryRepository.ts`

**Implementation:**

- Use `Map<string, Category>` for in-memory storage
- Implement all methods from `ICategoryRepository` interface
- Use `@injectable()` decorator for DI
- Simple CRUD operations using Map methods

**Why Start with In-Memory:**

- Fast to implement
- Perfect for testing
- Can swap to real DB later without changing application layer
- Demonstrates dependency inversion

#### 3.3 Time Provider Implementation

**File:** `packages/infrastructure/src/time/SystemTimeProvider.ts`

**Implementation:**

- Implements `TimeProvider` interface from domain
- `now()` method returns `Date.now()`
- Use `@injectable()` decorator

**File:** `packages/infrastructure/src/time/MockTimeProvider.ts` (for testing)

**Implementation:**

- Implements `TimeProvider` interface
- Maintains internal `currentTime` state
- Additional methods for testing:
  - `setTime(time)` - Set specific time
  - `advance(ms)` - Move time forward by milliseconds
- No `@injectable()` needed (used directly in tests)

**Why:** Enables time-based testing, simulating pauses/resumes without actual delays.

#### 3.4 Export Service

**File:** `packages/infrastructure/src/export/MarkdownExporter.ts`

**Responsibilities:**

- Takes `Session` and `Category` as input
- Formats data as markdown string
- Include: category name, total duration, list of segments with timestamps
- Use `@injectable()` decorator

---

### Phase 4: Dependency Injection Setup

#### 4.1 Create Container Configuration

**File:** `packages/application/src/di/container.ts`

**Setup:**

- Import `Container` from inversify
- Import `reflect-metadata` at top
- Import all domain interfaces
- Import all infrastructure implementations
- Import all use cases

**Container Bindings:**

1. Repositories - bind interface to implementation, use `.inSingletonScope()`
2. Providers - bind `TimeProvider` to `SystemTimeProvider`, singleton
3. Services - bind `DomainEventPublisher`, singleton
4. Use Cases - bind each use case to itself with `.toSelf()` (transient)

**Export:** `createContainer()` function that returns configured container

**Why:**

- Centralized dependency configuration
- Easy to swap implementations (e.g., InMemory → SQLite)
- Testability: can create test containers with mocks

#### 4.2 App Integration

**File:** `apps/mobile/app/contexts/DIContext.tsx`

**Implementation:**

- Create React Context for DI container
- `DIProvider` component: creates container with `useMemo()`, provides via context
- `useDI()` hook: gets container from context
- `useUseCase<T>(identifier)` hook: resolves use case from container
- Wrap app with `<DIProvider>` at root level

---

### Phase 5: Testing Strategy

#### 5.1 Domain Layer Tests

**File:** `packages/domain/src/aggregates/Session.test.ts`

**Test Cases:**

- Session creation starts with one active segment
- SessionStarted event is emitted on creation
- Pause stops active segment and emits SessionPaused event
- Segments shorter than 300ms are filtered with SegmentTooShort event
- Cannot pause without active segment (throws NoActiveSegmentError)
- Cannot resume stopped session (throws SessionAlreadyStoppedError)
- Multiple pause/resume cycles create multiple segments

**Testing Pattern:**

- Use `MockTimeProvider` in `beforeEach()`
- Use `timeProvider.advance(ms)` to simulate time passing
- Check aggregate state and pulled domain events
- Verify business rule violations throw correct errors

**Why:** Domain logic is fully testable without any infrastructure dependencies.

#### 5.2 Application Layer Tests

**File:** `packages/application/src/useCases/session/StartSession.test.ts`

**Test Cases:**

- Successfully creates session for existing category
- Returns session ID in result
- Throws error when category doesn't exist
- Events are published after session creation
- Session is persisted in repository

**Testing Pattern:**

- Create test DI container in `beforeEach()`
- Get use case and repositories from container
- Set up test data (e.g., save category)
- Execute use case
- Verify results and side effects (persistence, events)

---

### Phase 6: UI Integration

#### 6.1 React Native Hook Pattern

**File:** `apps/mobile/app/hooks/useStartSession.ts`

**Implementation:**

- Use `useUseCase<StartSessionUseCase>()` to get use case instance
- Wrap use case execution in `useCallback()`
- Handle errors (logging, user feedback)
- Return async function that takes categoryId

**File:** `apps/mobile/app/components/CategoryCard.tsx`

**Implementation:**

- Import and use custom hook (e.g., `useStartSession()`)
- Call hook function on user action (button press)
- Pass required parameters from component props
- Handle loading/error states if needed

**Why:**

- UI only knows about use cases, not domain internals
- Business logic stays in domain
- Easy to test components (mock useUseCase)

---

## 🎨 Read Models & Queries (CQRS Pattern)

### Query Side Implementation

**File:** `packages/application/src/queries/GetCategorySummaryQuery.ts`

**DTO Structure:**

- `categoryId: string`
- `categoryName: string`
- `totalDurationMs: number`
- `sessionCount: number`

**Implementation:**

- Use `@injectable()` decorator
- Inject repositories via constructor
- `execute()` method returns array of DTOs
- Fetch all categories and sessions
- Calculate aggregations (total duration, count)
- Map to DTO format

**Why:** Separation of reads (queries) from writes (commands). Queries can be optimized differently from writes.

---

## 🔒 Business Rules Summary

| Rule                                | Enforcement Location | Error if Violated            |
| ----------------------------------- | -------------------- | ---------------------------- |
| Only one active segment per session | Session aggregate    | `OverlapingSegmentError`     |
| Cannot pause without active segment | Session aggregate    | `NoActiveSegmentError`       |
| Segments < 300ms not saved          | Session aggregate    | Emits `SegmentTooShort`      |
| Cannot resume stopped session       | Session aggregate    | `SessionAlreadyStoppedError` |
| Category name required              | Category entity      | `DomainError` (invariant)    |

---

## 📚 Documentation to Maintain

1. **EventStorming Diagram** - Update when new events/commands are discovered
2. **Architecture Decision Records (ADRs)** - Document WHY certain patterns chosen
3. **API Documentation** - Use cases as API contracts
4. **Testing Guidelines** - How to test each layer

---

## 🚀 Migration Path

### From Current State to Clean Architecture

**Step 1:** Complete domain aggregates (Session, SessionSegment)  
**Step 2:** Create application package with basic use cases  
**Step 3:** Create infrastructure package with in-memory repositories  
**Step 4:** Set up DI container  
**Step 5:** Integrate one use case end-to-end (e.g., StartSession)  
**Step 6:** Gradually add remaining use cases  
**Step 7:** Replace in-memory with persistent storage

**Avoid:**

- ❌ Creating all layers at once
- ❌ Coupling UI directly to domain
- ❌ Putting business logic in use cases
- ❌ Using domain entities as DTOs

---

## 🧪 Quality Metrics

- **Domain Purity:** Zero imports from infrastructure/application in domain layer
- **Test Coverage:** >80% for domain layer, >70% for application layer
- **Dependency Direction:** Always toward domain, never outward
- **Event Coverage:** All state changes emit domain events

---

## 📖 References

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Implementing Domain-Driven Design by Vaughn Vernon](https://vaughnvernon.co/?page_id=168)

---

## 📝 Notes for Future Context

- All timestamps use `DateTime` (number) value object, implementation in `TimeProvider`
- ULID used for all IDs (time-sortable)
- Domain events are pull-based (aggregates collect, app layer publishes)
- Inversify used for DI (already in dependencies)
- Monorepo uses pnpm workspaces + Turborepo
- Mobile uses React Native, Web uses Next.js
- Domain package has no exports defined in package.json yet - need to add proper exports map

---

**Last Updated:** 2025-11-23  
**Status:** Planning Phase  
**Next Action:** Implement Session aggregate and SessionSegment entity
