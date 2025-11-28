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
- ✅ Domain package complete: Entities, Value Objects, Aggregates, Events, Repositories (interfaces), Specifications
- ✅ Infrastructure package implemented: SQLite + In-Memory repositories, Mappers with comprehensive tests
- ❌ Application package: NOT YET CREATED
- Apps: mobile (React Native), web (Next.js), docs (Next.js)
- Key aggregates: Category (complete), Session (complete) with SessionSegment entities
- Domain events defined for session lifecycle
- EventStorming document in `packages/domain/docs/eventStorming/eventStorming-19-11-25.md`

**Next Steps:** Create Application layer with use cases, commands, queries, and event publisher.
```

---

## 📋 Overview

This document outlines the implementation progress and next steps for the time tracking application following DDD and Clean Architecture principles.

### Current Architecture Status

✅ **Completed:**

#### Domain Layer (`@wimt/domain`)

- ✅ **Aggregates:** `Category`, `Session` (with full lifecycle: start, pause, resume, stop)
- ✅ **Entities:** `SessionSegment` (with time adjustment, stop logic)
- ✅ **Value Objects:** `ULID`, `DateTime`, `CategoryName`, `Color`, `Icon`
- ✅ **Domain Events:** `CategoryCreated`, `SessionStarted`, `SessionPaused`, `SessionResumed`, `SessionStopped`, `SegmentAdjusted`, `SessionExported`
- ✅ **Errors:** `DomainError`, `ValidationDomainError`, `NotFoundDomainError` with specific errors
- ✅ **Repository Interfaces:** `ICategoryRepository`, `ISessionRepository`
- ✅ **Specifications:** `Specification<T>` pattern with composable specs (AND/OR), including:
  - Category specs: `ActiveCategorySpec`, `CategoryNameMatchesSpec`
  - Session specs: `ActiveSessionSpec`, `PausedSessionSpec`, `StoppedSessionSpec`, `SessionForCategorySpec`
- ✅ **Domain Services:** Session validation, segment overlap detection
- ✅ **Base Classes:** `AggregateRoot` with domain event collection

#### Infrastructure Layer (`@wimt/infrastructure`)

- ✅ **SQLite Schema:** Tables for categories, sessions, and session_segments
- ✅ **Mappers:** `CategoryMapper`, `SessionMapper` (with complex aggregate mapping)
- ✅ **Repositories:**
  - `SqliteCategoryRepository` - SQLite persistence with Drizzle ORM
  - `SqliteSessionRepository` - Multi-table aggregate persistence
  - `InMemoryCategoryRepository` - In-memory for testing
  - `InMemorySessionRepository` - In-memory for testing
- ✅ **Database Client:** sql.js integration with Drizzle adapter
- ✅ **Tests:** 59 passing unit tests across all repositories and mappers
- ✅ **Dependency Injection:** InversifyJS setup with symbols

❌ **Missing:**

- Application layer (use cases/command handlers/queries)
- Presentation layer integration
- Application-level DI container configuration
- Integration tests with real SQLite database
- Read models for CQRS queries
- Event publisher and handlers

---

## 🏗️ Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (Mobile, Web, API Adapters)                 │
│                        ❌ TODO                           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Application Layer                      │
│        (Use Cases, Commands, Queries, DTOs)              │
│                        ❌ TODO                           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                     Domain Layer                         │
│   (Entities, Aggregates, Value Objects, Events, Rules)   │
│                    ✅ COMPLETE                           │
└──────────────────────────────────────────────────────────┘
                        ▲
┌───────────────────────┴─────────────────────────────────┐
│                 Infrastructure Layer                     │
│     (Repositories, DB, File System, External APIs)       │
│                    ✅ COMPLETE                           │
└──────────────────────────────────────────────────────────┘
```

---

## 📦 Package Structure

### Current Monorepo Packages

```
packages/
├── domain/              # ✅ Complete - Pure domain logic
├── infrastructure/      # ✅ Complete - Repositories, SQLite, mappers
├── application/         # ❌ TO CREATE - Use cases, commands, queries
└── shared/              # 🔄 Optional - Common types, utilities

apps/
├── mobile/              # React Native app (needs integration)
├── web/                 # Next.js web app (needs integration)
└── docs/                # Documentation site
```

---

## 🎯 Next Implementation Steps

### **Phase 1: Create Application Layer Package** 🎯 **← NEXT STEP**

#### Step 1.1: Package Setup

Create `packages/application/` with the following structure:

```
packages/application/
├── src/
│   ├── commands/           # Command DTOs (inputs)
│   ├── queries/            # Query DTOs (read models)
│   ├── useCases/
│   │   ├── category/
│   │   └── session/
│   ├── services/
│   │   └── DomainEventPublisher.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Dependencies:**

```json
{
  "dependencies": {
    "@wimt/domain": "workspace:*",
    "inversify": "^6.0.2",
    "reflect-metadata": "^0.2.1"
  }
}
```

#### Step 1.2: Use Case Implementation Pattern

**Priority Use Cases to Implement:**

1. **Category Use Cases**
   - `CreateCategoryUseCase` - Create new category
   - `ListCategoriesUseCase` - Get all categories
   - `DeleteCategoryUseCase` - Delete category

2. **Session Use Cases**
   - `StartSessionUseCase` - Start tracking for a category
   - `PauseSessionUseCase` - Pause active session
   - `ResumeSessionUseCase` - Resume paused session
   - `StopSessionUseCase` - Stop session permanently
   - `GetActiveSessionUseCase` - Query current active session

**Use Case Pattern:**

```typescript
// packages/application/src/useCases/session/StartSessionUseCase.ts
import { injectable, inject } from "inversify";
import { Session } from "@wimt/domain/aggregates";
import {
  ISessionRepository,
  ICategoryRepository,
} from "@wimt/domain/repositories";
import { NotFoundDomainError } from "@wimt/domain/errors";
import { DomainEventPublisher } from "../../services/DomainEventPublisher";

export interface StartSessionCommand {
  categoryId: string;
}

export interface StartSessionResult {
  sessionId: string;
  startedAt: number; // UTC milliseconds
}

@injectable()
export class StartSessionUseCase {
  constructor(
    @inject("ISessionRepository") private sessionRepo: ISessionRepository,
    @inject("ICategoryRepository") private categoryRepo: ICategoryRepository,
    @inject(DomainEventPublisher) private eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: StartSessionCommand): Promise<StartSessionResult> {
    // 1. Validate - category must exist
    const category = await this.categoryRepo.findById(command.categoryId);
    if (!category) {
      throw new NotFoundDomainError(`Category ${command.categoryId} not found`);
    }

    // 2. Create domain object (business logic in domain)
    const session = new Session({
      categoryId: command.categoryId,
      createdAt: DateTime.create(Date.now()),
    });

    // 3. Persist
    await this.sessionRepo.save(session);

    // 4. Publish domain events
    const events = session.pullDomainEvents();
    events.forEach((event) => this.eventPublisher.publish(event));

    // 5. Return result DTO
    return {
      sessionId: session.id,
      startedAt: session.createdAt.value,
    };
  }
}
```

#### Step 1.3: Domain Event Publisher

```typescript
// packages/application/src/services/DomainEventPublisher.ts
import { injectable } from "inversify";
import { DomainEvent } from "@wimt/domain/events";

type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

@injectable()
export class DomainEventPublisher {
  private handlers = new Map<string, EventHandler<any>[]>();

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.constructor.name) || [];

    for (const handler of handlers) {
      await handler(event);
    }
  }
}
```

#### Step 1.4: Command & Query DTOs

```typescript
// packages/application/src/commands/CreateCategoryCommand.ts
export interface CreateCategoryCommand {
  name: string;
  color?: string;
  icon?: string;
}

export interface CreateCategoryResult {
  categoryId: string;
}
```

```typescript
// packages/application/src/queries/CategorySummaryQuery.ts
export interface CategorySummaryDTO {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  activeSessions: number;
  totalDurationMs: number;
}
```

---

### Phase 2: Dependency Injection Container

#### Step 2.1: Container Configuration

```typescript
// packages/application/src/di/container.ts
import "reflect-metadata";
import { Container } from "inversify";
import {
  ISessionRepository,
  ICategoryRepository,
} from "@wimt/domain/repositories";
import {
  SqliteSessionRepository,
  SqliteCategoryRepository,
  DbClient,
  createSqlJsDbClient,
} from "@wimt/infrastructure";
import { DomainEventPublisher } from "../services/DomainEventPublisher";

// Use case imports
import { StartSessionUseCase } from "../useCases/session/StartSessionUseCase";
import { CreateCategoryUseCase } from "../useCases/category/CreateCategoryUseCase";

export async function createContainer(): Promise<Container> {
  const container = new Container();

  // Database Client
  const db = await createSqlJsDbClient();
  container.bind<DbClient>("DbClient").toConstantValue(db);

  // Repositories
  container
    .bind<ICategoryRepository>("ICategoryRepository")
    .to(SqliteCategoryRepository)
    .inSingletonScope();

  container
    .bind<ISessionRepository>("ISessionRepository")
    .to(SqliteSessionRepository)
    .inSingletonScope();

  // Services
  container.bind(DomainEventPublisher).toSelf().inSingletonScope();

  // Use Cases
  container.bind(StartSessionUseCase).toSelf();
  container.bind(CreateCategoryUseCase).toSelf();

  return container;
}
```

---

### Phase 3: Testing Application Layer

#### Step 3.1: Use Case Tests

```typescript
// packages/application/src/useCases/session/StartSessionUseCase.test.ts
describe("StartSessionUseCase", () => {
  let container: Container;
  let useCase: StartSessionUseCase;
  let sessionRepo: ISessionRepository;
  let categoryRepo: ICategoryRepository;

  beforeEach(async () => {
    container = await createTestContainer(); // In-memory repositories
    useCase = container.get(StartSessionUseCase);
    sessionRepo = container.get<ISessionRepository>("ISessionRepository");
    categoryRepo = container.get<ICategoryRepository>("ICategoryRepository");
  });

  it("should start session for existing category", async () => {
    // Setup
    const category = new Category({ name: CategoryName.create("Work") });
    await categoryRepo.save(category);

    // Execute
    const result = await useCase.execute({
      categoryId: category.id,
    });

    // Verify
    expect(result.sessionId).toBeDefined();
    const session = await sessionRepo.findById(result.sessionId);
    expect(session).not.toBeNull();
    expect(session!.state).toBe("active");
  });

  it("should throw error when category does not exist", async () => {
    await expect(
      useCase.execute({ categoryId: "non-existent-id" }),
    ).rejects.toThrow(NotFoundDomainError);
  });
});
```

---

### Phase 4: UI Integration (After Application Layer)

#### Step 4.1: React Context for DI

```typescript
// apps/mobile/app/contexts/DIContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { Container } from 'inversify';
import { createContainer } from '@wimt/application';

const DIContext = createContext<Container | null>(null);

export function DIProvider({ children }: { children: React.ReactNode }) {
  const container = useMemo(() => createContainer(), []);

  return (
    <DIContext.Provider value={container}>
      {children}
    </DIContext.Provider>
  );
}

export function useContainer(): Container {
  const container = useContext(DIContext);
  if (!container) {
    throw new Error('useContainer must be used within DIProvider');
  }
  return container;
}

export function useUseCase<T>(identifier: any): T {
  const container = useContainer();
  return container.get<T>(identifier);
}
```

#### Step 4.2: Custom Hooks

```typescript
// apps/mobile/app/hooks/useStartSession.ts
import { useCallback } from "react";
import { StartSessionUseCase } from "@wimt/application";
import { useUseCase } from "../contexts/DIContext";

export function useStartSession() {
  const useCase = useUseCase<StartSessionUseCase>(StartSessionUseCase);

  return useCallback(
    async (categoryId: string) => {
      try {
        const result = await useCase.execute({ categoryId });
        return result;
      } catch (error) {
        console.error("Failed to start session:", error);
        throw error;
      }
    },
    [useCase],
  );
}
```

---

## 🎯 Recommended Next Steps Priority

### ✨ Immediate Next Step (This Session):

**Create Application Package with Essential Use Cases**

1. Create `packages/application/` directory structure
2. Implement `DomainEventPublisher`
3. Implement first use case: `StartSessionUseCase`
4. Implement second use case: `CreateCategoryUseCase`
5. Create DI container configuration
6. Write tests for both use cases

### After Application Layer:

1. **Integration Tests** - Test entire flow from use case → repository → database
2. **Read Models** - Implement CQRS queries for statistics/summaries
3. **UI Integration** - Connect React Native app to use cases
4. **Event Handlers** - Add side effects (logging, analytics, notifications)

---

## 📊 Progress Summary

| Layer              | Status         | Completion |
| ------------------ | -------------- | ---------- |
| **Domain**         | ✅ Complete    | 100%       |
| **Infrastructure** | ✅ Complete    | 100%       |
| **Application**    | ❌ Not Started | 0%         |
| **Presentation**   | ❌ Not Started | 0%         |

**Test Coverage:**

- Domain: ✅ Well tested (complex aggregate logic verified)
- Infrastructure: ✅ 59 passing unit tests
- Application: ❌ No tests yet
- Integration: ❌ No tests yet

---

## 🧭 Architecture Decisions

### Key Patterns Used

1. **Domain-Driven Design**
   - Aggregates enforce business rules
   - Value objects for immutability
   - Domain events for side effects

2. **Clean Architecture**
   - Dependency inversion (domain → infrastructure)
   - Use cases orchestrate workflows
   - DTOs separate external API from domain

3. **CQRS** (Partial)
   - Specifications for flexible queries
   - Read models planned for statistics

4. **Repository Pattern**
   - Interfaces in domain
   - Multiple implementations (SQLite, In-Memory)
   - Mappers handle persistence concerns

---

## 📝 Technical Decisions

### Date/Time Handling

- **Storage:** Unix timestamps (milliseconds) in SQLite INTEGER columns
- **Domain:** `DateTime` value object wrapping milliseconds
- **Database:** Drizzle's `{ mode: "timestamp_ms" }` for type-safe Date conversion
- **Timezone:** All UTC in storage, convert to user timezone in UI

### ID Generation

- **Format:** ULID (Universally Unique Lexicographically Sortable Identifier)
- **Benefits:** Time-sortable, URL-safe, 128-bit like UUID

### Persistence

- **Primary:** SQLite with sql.js (works in browser & React Native)
- **ORM:** Drizzle ORM for type-safe queries
- **Testing:** In-memory repositories for fast unit tests

---

**Last Updated:** 2024-11-28  
**Status:** Domain ✅ | Infrastructure ✅ | **Next: Application Layer** 🎯  
**Next Action:** Create `packages/application/` with use cases and DI container
