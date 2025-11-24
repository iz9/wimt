# Event Handlers & Event Bus

## What are Event Handlers?

**Event Handlers** are components that react to **domain events** after they've occurred. An **Event Bus** is the mechanism that dispatches events to their handlers. Together, they enable **event-driven architecture** where parts of your system react to changes without tight coupling.

### Key Principle

> "Domain events record what happened. Event handlers decide what to do about it."

**Simple Example:**

```typescript
// Domain event (what happened)
class CategoryCreated extends AbstractDomainEvent {
  constructor(
    public readonly categoryId: ULID,
    public readonly categoryName: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }

  readonly type = "CategoryCreated";
}

// Event handler (what to do about it)
@injectable()
class SendWelcomeNotificationHandler {
  async handle(event: CategoryCreated): Promise<void> {
    await this.notificationService.send(
      `Category "${event.categoryName}" created!`,
    );
  }
}
```

---

## Why Use Event Handlers?

### 1. **Decoupling**

**Without Event Handlers (Tightly Coupled):**

```typescript
class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);

    // ❌ Tightly coupled to all side effects!
    await this.notificationService.send(`Category created!`);
    await this.analyticsService.track("category_created");
    await this.cacheService.invalidate("categories");
    await this.searchService.index(category);
    // What if we need to add more?
  }
}
```

**With Event Handlers (Decoupled):**

```typescript
class CreateCategoryUseCase {
  async execute(command: CreateCategoryCommand): Promise<void> {
    const category = new Category({ name: command.name });
    await this.categoryRepo.save(category);

    // ✅ Just publish events
    const events = category.pullDomainEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    // Event handlers take care of the rest!
  }
}

// Separate handlers (can add/remove without changing use case)
class NotificationHandler {
  async handle(event: CategoryCreated) {
    await this.notificationService.send(...);
  }
}

class AnalyticsHandler {
  async handle(event: CategoryCreated) {
    await this.analyticsService.track(...);
  }
}

class CacheInvalidationHandler {
  async handle(event: CategoryCreated) {
    await this.cacheService.invalidate(...);
  }
}
```

### 2. **Single Responsibility**

Each handler has one job:

- `NotificationHandler` - Send notifications
- `AnalyticsHandler` - Track analytics
- `CacheInvalidationHandler` - Invalidate cache
- `SearchIndexHandler` - Update search index

### 3. **Testability**

```typescript
// Test use case without all the side effects
describe("CreateCategoryUseCase", () => {
  it("should create category and emit event", async () => {
    const mockEventBus = new MockEventBus();
    const useCase = new CreateCategoryUseCase(repo, mockEventBus);

    await useCase.execute({ name: "Work" });

    expect(mockEventBus.publishedEvents).toHaveLength(1);
    expect(mockEventBus.publishedEvents[0].type).toBe("CategoryCreated");
  });
});

// Test individual handlers in isolation
describe("NotificationHandler", () => {
  it("should send notification", async () => {
    const event = new CategoryCreated("id", "Work", Date.now());
    const handler = new NotificationHandler(mockNotificationService);

    await handler.handle(event);

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      'Category "Work" created!',
    );
  });
});
```

### 4. **Flexibility**

```typescript
// Easy to add new behavior - just add a new handler!
class UpdateReadModelHandler {
  async handle(event: CategoryCreated) {
    await this.readModel.insert({
      id: event.categoryId,
      name: event.categoryName,
      sessionCount: 0,
    });
  }
}

// Register it
eventBus.subscribe("CategoryCreated", updateReadModelHandler);
```

---

## Event Bus Interface

```typescript
export interface IEventBus {
  /**
   * Publish an event to all subscribed handlers
   */
  publish<T extends AbstractDomainEvent>(event: T): Promise<void>;

  /**
   * Subscribe a handler to an event type
   */
  subscribe<T extends AbstractDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void;

  /**
   * Unsubscribe a handler from an event type
   */
  unsubscribe<T extends AbstractDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void;
}

export interface IEventHandler<T extends AbstractDomainEvent> {
  handle(event: T): Promise<void>;
}
```

---

## In-Memory Event Bus Implementation

```typescript
@injectable()
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, IEventHandler<any>[]> = new Map();

  subscribe<T extends AbstractDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(handler);
  }

  unsubscribe<T extends AbstractDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  async publish<T extends AbstractDomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    // Execute all handlers sequentially
    for (const handler of handlers) {
      await handler.handle(event);
    }
  }
}
```

---

## Creating Event Handlers

### Basic Event Handler

```typescript
@injectable()
export class CategoryCreatedHandler implements IEventHandler<CategoryCreated> {
  constructor(
    @inject(TYPES.ILogger)
    private logger: ILogger,
  ) {}

  async handle(event: CategoryCreated): Promise<void> {
    this.logger.info(`Category created: ${event.categoryName}`, {
      categoryId: event.categoryId,
      occurredAt: event.occurredAt,
    });
  }
}
```

### Handler with Dependencies

```typescript
@injectable()
export class SendCategoryCreatedNotificationHandler
  implements IEventHandler<CategoryCreated>
{
  constructor(
    @inject(TYPES.INotificationService)
    private notificationService: INotificationService,

    @inject(TYPES.IUserRepository)
    private userRepository: IUserRepository,
  ) {}

  async handle(event: CategoryCreated): Promise<void> {
    // Load user to notify
    const user = await this.userRepository.getCurrentUser();

    // Send notification
    await this.notificationService.send({
      userId: user.id,
      title: "Category Created",
      message: `Your category "${event.categoryName}" has been created!`,
      type: "info",
    });
  }
}
```

---

## Event Handlers in Our Project

### Category Event Handlers

```typescript
// Log category creation
@injectable()
export class LogCategoryCreatedHandler
  implements IEventHandler<CategoryCreated>
{
  constructor(@inject(TYPES.ILogger) private logger: ILogger) {}

  async handle(event: CategoryCreated): Promise<void> {
    this.logger.info("Category created", {
      categoryId: event.categoryId,
      categoryName: event.categoryName,
      occurredAt: event.occurredAt,
    });
  }
}

// Update category read model
@injectable()
export class UpdateCategoryReadModelHandler
  implements IEventHandler<CategoryCreated>
{
  constructor(
    @inject(TYPES.ICategoryReadModel)
    private readModel: ICategoryReadModel,
  ) {}

  async handle(event: CategoryCreated): Promise<void> {
    await this.readModel.insert({
      id: event.categoryId,
      name: event.categoryName,
      sessionCount: 0,
      totalDuration: 0,
      lastUsed: null,
      createdAt: event.occurredAt,
    });
  }
}

// Track analytics
@injectable()
export class TrackCategoryCreatedHandler
  implements IEventHandler<CategoryCreated>
{
  constructor(
    @inject(TYPES.IAnalyticsService)
    private analytics: IAnalyticsService,
  ) {}

  async handle(event: CategoryCreated): Promise<void> {
    await this.analytics.track("category_created", {
      categoryId: event.categoryId,
      categoryName: event.categoryName,
    });
  }
}
```

### Session Event Handlers

```typescript
// Update statistics when session starts
@injectable()
export class UpdateStatisticsOnSessionStartHandler
  implements IEventHandler<SessionStarted>
{
  constructor(
    @inject(TYPES.ICategoryStatisticsRepository)
    private statsRepo: ICategoryStatisticsRepository,
  ) {}

  async handle(event: SessionStarted): Promise<void> {
    await this.statsRepo.incrementSessionCount(event.categoryId);
    await this.statsRepo.updateLastUsed(event.categoryId, event.occurredAt);
  }
}

// Notify on session stop
@injectable()
export class NotifySessionStoppedHandler
  implements IEventHandler<SessionStopped>
{
  constructor(
    @inject(TYPES.INotificationService)
    private notifications: INotificationService,

    @inject(TYPES.ISessionRepository)
    private sessionRepo: ISessionRepository,
  ) {}

  async handle(event: SessionStopped): Promise<void> {
    const session = await this.sessionRepo.findById(event.sessionId);
    if (!session) return;

    const duration = session.getTotalDuration();

    await this.notifications.send({
      title: "Session Completed",
      message: `Tracked ${this.formatDuration(duration)} in session`,
      type: "success",
    });
  }

  private formatDuration(duration: Duration): string {
    const hours = Math.floor(duration.toHours());
    const minutes = Math.floor(duration.toMinutes() % 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
}

// Update read model on segment too short
@injectable()
export class HandleSegmentTooShortHandler
  implements IEventHandler<SegmentTooShort>
{
  constructor(@inject(TYPES.ILogger) private logger: ILogger) {}

  async handle(event: SegmentTooShort): Promise<void> {
    this.logger.warn("Segment too short, discarded", {
      sessionId: event.sessionId,
      segmentId: event.segmentId,
      duration: event.duration,
    });
  }
}
```

---

## Registering Event Handlers

### Manual Registration

```typescript
// In container setup
const eventBus = container.get<IEventBus>(TYPES.IEventBus);

// Get handlers
const logHandler = container.get<LogCategoryCreatedHandler>(
  TYPES.LogCategoryCreatedHandler,
);
const readModelHandler = container.get<UpdateCategoryReadModelHandler>(
  TYPES.UpdateCategoryReadModelHandler,
);

// Register handlers
eventBus.subscribe("CategoryCreated", logHandler);
eventBus.subscribe("CategoryCreated", readModelHandler);
```

### Automatic Registration with Decorators

```typescript
// Custom decorator for automatic registration
export function EventHandler(eventType: string) {
  return function (target: any) {
    // Store metadata
    Reflect.defineMetadata("eventType", eventType, target);
    return injectable()(target);
  };
}

// Use decorator
@EventHandler("CategoryCreated")
export class LogCategoryCreatedHandler
  implements IEventHandler<CategoryCreated>
{
  async handle(event: CategoryCreated): Promise<void> {
    console.log("Category created:", event);
  }
}

// Auto-register all handlers
export function registerEventHandlers(
  container: Container,
  eventBus: IEventBus,
) {
  // Get all handlers from container
  const handlers = container.getAll<IEventHandler<any>>(TYPES.IEventHandler);

  for (const handler of handlers) {
    const eventType = Reflect.getMetadata("eventType", handler.constructor);
    if (eventType) {
      eventBus.subscribe(eventType, handler);
    }
  }
}
```

### Module-based Registration

```typescript
// events.module.ts
import { ContainerModule } from "inversify";

export const eventsModule = new ContainerModule((bind) => {
  // Bind event bus
  bind<IEventBus>(TYPES.IEventBus).to(InMemoryEventBus).inSingletonScope();

  // Bind handlers
  bind<IEventHandler<CategoryCreated>>(TYPES.CategoryCreatedHandler).to(
    LogCategoryCreatedHandler,
  );

  bind<IEventHandler<CategoryCreated>>(TYPES.UpdateCategoryReadModelHandler).to(
    UpdateCategoryReadModelHandler,
  );

  bind<IEventHandler<SessionStarted>>(TYPES.SessionStartedHandler).to(
    UpdateStatisticsOnSessionStartHandler,
  );
});

// After container is loaded
const eventBus = container.get<IEventBus>(TYPES.IEventBus);

// Register all handlers
eventBus.subscribe(
  "CategoryCreated",
  container.get(TYPES.CategoryCreatedHandler),
);
eventBus.subscribe(
  "CategoryCreated",
  container.get(TYPES.UpdateCategoryReadModelHandler),
);
eventBus.subscribe(
  "SessionStarted",
  container.get(TYPES.SessionStartedHandler),
);
```

---

## Synchronous vs Asynchronous Handlers

### Synchronous (In-Process)

**Current implementation - handlers execute in same process:**

```typescript
class InMemoryEventBus {
  async publish(event: AbstractDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    // Execute sequentially
    for (const handler of handlers) {
      await handler.handle(event); // Waits for each handler
    }
  }
}
```

**Pros:**

- Simple
- Immediate consistency
- Easy to debug
- No infrastructure needed

**Cons:**

- Blocking (slow handler blocks everything)
- Can't scale handlers independently
- Error in one handler affects others

### Asynchronous (Message Queue)

**Future: Handlers execute via message queue (e.g., RabbitMQ, Kafka):**

```typescript
class MessageQueueEventBus implements IEventBus {
  constructor(private messageQueue: IMessageQueue) {}

  async publish(event: AbstractDomainEvent): Promise<void> {
    // Just publish to queue and return
    await this.messageQueue.publish(event.type, event);
    // Handlers process asynchronously
  }
}
```

**Pros:**

- Non-blocking (publish returns immediately)
- Scalable (add more handler instances)
- Resilient (retry on failure)
- Can process across services

**Cons:**

- Eventual consistency
- More complex infrastructure
- Harder to debug

**Recommendation:** Start with in-memory (synchronous), move to message queue only if needed.

---

## Error Handling in Event Handlers

### Strategy 1: Fail Fast

```typescript
class InMemoryEventBus {
  async publish(event: AbstractDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    for (const handler of handlers) {
      // If handler throws, stop processing
      await handler.handle(event); // ❌ Throws, stops other handlers
    }
  }
}
```

**Problem:** One failing handler stops all subsequent handlers.

### Strategy 2: Continue on Error

```typescript
class InMemoryEventBus {
  constructor(
    @inject(TYPES.ILogger)
    private logger: ILogger,
  ) {}

  async publish(event: AbstractDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    for (const handler of handlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        // Log error but continue
        this.logger.error("Event handler failed", {
          eventType: event.type,
          handler: handler.constructor.name,
          error: error.message,
        });
        // Continue to next handler
      }
    }
  }
}
```

**Better:** Errors are logged, other handlers still execute.

### Strategy 3: Dead Letter Queue

```typescript
class InMemoryEventBus {
  constructor(
    private logger: ILogger,
    private deadLetterQueue: IDeadLetterQueue,
  ) {}

  async publish(event: AbstractDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    for (const handler of handlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        this.logger.error("Event handler failed", { error });

        // Send to dead letter queue for retry/investigation
        await this.deadLetterQueue.add({
          event,
          handler: handler.constructor.name,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }
  }
}
```

---

## Testing Event Handlers

### Test Individual Handler

```typescript
describe("LogCategoryCreatedHandler", () => {
  let handler: LogCategoryCreatedHandler;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    handler = new LogCategoryCreatedHandler(mockLogger);
  });

  it("should log category creation", async () => {
    const event = new CategoryCreated("cat-123", "Work", Date.now());

    await handler.handle(event);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Category created",
      expect.objectContaining({
        categoryId: "cat-123",
        categoryName: "Work",
      }),
    );
  });
});
```

### Test Event Bus

```typescript
describe("InMemoryEventBus", () => {
  let eventBus: InMemoryEventBus;
  let mockHandler: MockEventHandler;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    mockHandler = new MockEventHandler();
  });

  it("should publish event to subscribed handlers", async () => {
    eventBus.subscribe("CategoryCreated", mockHandler);

    const event = new CategoryCreated("cat-123", "Work", Date.now());
    await eventBus.publish(event);

    expect(mockHandler.handle).toHaveBeenCalledWith(event);
  });

  it("should not publish to unsubscribed handlers", async () => {
    eventBus.subscribe("CategoryCreated", mockHandler);
    eventBus.unsubscribe("CategoryCreated", mockHandler);

    const event = new CategoryCreated("cat-123", "Work", Date.now());
    await eventBus.publish(event);

    expect(mockHandler.handle).not.toHaveBeenCalled();
  });

  it("should handle multiple handlers for same event", async () => {
    const handler1 = new MockEventHandler();
    const handler2 = new MockEventHandler();

    eventBus.subscribe("CategoryCreated", handler1);
    eventBus.subscribe("CategoryCreated", handler2);

    const event = new CategoryCreated("cat-123", "Work", Date.now());
    await eventBus.publish(event);

    expect(handler1.handle).toHaveBeenCalledWith(event);
    expect(handler2.handle).toHaveBeenCalledWith(event);
  });
});
```

### Mock Event Bus for Testing

```typescript
export class MockEventBus implements IEventBus {
  public publishedEvents: AbstractDomainEvent[] = [];

  async publish(event: AbstractDomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  subscribe(): void {
    // No-op for mock
  }

  unsubscribe(): void {
    // No-op for mock
  }

  reset(): void {
    this.publishedEvents = [];
  }
}

// Usage
describe("CreateCategoryUseCase", () => {
  it("should publish CategoryCreated event", async () => {
    const mockEventBus = new MockEventBus();
    const useCase = new CreateCategoryUseCase(repo, mockEventBus);

    await useCase.execute({ name: "Work" });

    expect(mockEventBus.publishedEvents).toHaveLength(1);
    expect(mockEventBus.publishedEvents[0]).toBeInstanceOf(CategoryCreated);
  });
});
```

---

## Integration with React Native

### Subscribe to Events in UI

```typescript
// hooks/useEventSubscription.ts
import { useEffect } from 'react';
import { useContainer } from './useContainer';
import { TYPES } from '@wimt/infrastructure/di/types';

export function useEventSubscription<T extends AbstractDomainEvent>(
  eventType: string,
  handler: (event: T) => void
) {
  const container = useContainer();

  useEffect(() => {
    const eventBus = container.get<IEventBus>(TYPES.IEventBus);

    const eventHandler: IEventHandler<T> = {
      handle: async (event: T) => {
        handler(event);
      }
    };

    eventBus.subscribe(eventType, eventHandler);

    return () => {
      eventBus.unsubscribe(eventType, eventHandler);
    };
  }, [eventType, handler, container]);
}

// In component
export function CategoryList() {
  const [showNotification, setShowNotification] = useState(false);

  useEventSubscription<CategoryCreated>('CategoryCreated', (event) => {
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  });

  return (
    <View>
      {showNotification && (
        <Notification message="Category created!" />
      )}
      <FlatList data={categories} ... />
    </View>
  );
}
```

---

## Best Practices

### ✅ DO:

**1. Keep handlers focused**

```typescript
// ✅ Good - One responsibility
class LogCategoryCreatedHandler {
  async handle(event: CategoryCreated) {
    this.logger.info('Category created', { event });
  }
}

class NotifyCategoryCreatedHandler {
  async handle(event: CategoryCreated) {
    await this.notificationService.send(...);
  }
}

// ❌ Bad - Too many responsibilities
class CategoryCreatedHandler {
  async handle(event: CategoryCreated) {
    this.logger.info(...);
    await this.notificationService.send(...);
    await this.analyticsService.track(...);
    await this.cacheService.invalidate(...);
  }
}
```

**2. Make handlers idempotent**

```typescript
// ✅ Good - Can be called multiple times safely
class UpdateReadModelHandler {
  async handle(event: CategoryCreated) {
    // Upsert (insert or update)
    await this.readModel.upsert({
      id: event.categoryId,
      name: event.categoryName,
    });
  }
}
```

**3. Handle errors gracefully**

```typescript
// ✅ Good
class NotificationHandler {
  async handle(event: CategoryCreated) {
    try {
      await this.notificationService.send(...);
    } catch (error) {
      this.logger.error('Failed to send notification', { error });
      // Don't rethrow - let other handlers continue
    }
  }
}
```

### ❌ DON'T:

**1. Don't modify events**

```typescript
// ❌ Bad - Events should be immutable!
class BadHandler {
  async handle(event: CategoryCreated) {
    (event as any).processed = true; // ❌ Mutation!
  }
}
```

**2. Don't have handlers depend on order**

```typescript
// ❌ Bad - Handler B depends on handler A running first
class HandlerA {
  async handle(event: CategoryCreated) {
    await cache.set("category-created", true);
  }
}

class HandlerB {
  async handle(event: CategoryCreated) {
    const wasCreated = await cache.get("category-created"); // ❌ Fragile!
    if (wasCreated) {
      /* ... */
    }
  }
}
```

**3. Don't call other use cases from handlers**

```typescript
// ❌ Bad - Creates tight coupling
class CreateCategoryHandler {
  async handle(event: CategoryCreated) {
    // ❌ Calling another use case from handler!
    await this.sendWelcomeEmailUseCase.execute({
      categoryId: event.categoryId,
    });
  }
}

// ✅ Good - Just do the work
class SendWelcomeEmailHandler {
  async handle(event: CategoryCreated) {
    await this.emailService.send({
      to: user.email,
      subject: "Welcome",
      body: `Category "${event.categoryName}" created!`,
    });
  }
}
```

---

## Summary

**Event Handlers:**

- React to domain events
- Decoupled from use cases
- Single responsibility
- Testable in isolation

**Event Bus:**

- Publishes events to handlers
- Subscribe/unsubscribe handlers
- In-memory (synchronous) or message queue (async)

**In Our Project:**

- `InMemoryEventBus` - Simple, synchronous
- Handlers for logging, notifications, analytics, read models
- Register in DI container
- Test with `MockEventBus`

**Pattern:**

```typescript
// Use case publishes event
const events = category.pullDomainEvents();
await eventBus.publish(events[0]);

// Event bus notifies handlers
class LogHandler {
  async handle(event: CategoryCreated) {
    this.logger.info('Category created');
  }
}

class NotificationHandler {
  async handle(event: CategoryCreated) {
    await this.notifications.send(...);
  }
}
```

**Key Benefits:**

- Decouple use cases from side effects
- Easy to add new behavior (new handler)
- Test use cases and handlers separately
- Clean separation of concerns

---

## Related Documents

- [Domain Events](./domain-events.md)
- [Dependency Injection](./dependency-injection.md)
- [Application Layer](./application-layer.md)

---

## References

- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon (Chapter 8: Domain Events)
- **Enterprise Integration Patterns** by Hohpe & Woolf (Event-Driven Messaging)
