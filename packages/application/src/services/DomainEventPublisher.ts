import "reflect-metadata";

import { injectable } from "inversify";

import type { DomainEvent } from "@wimt/domain/events";

// Type for event class constructor
type EventClass<T extends DomainEvent = DomainEvent> = new (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => T;

type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

/**
 * Type-safe in-memory event publisher for domain events.
 * Events are published synchronously to all registered handlers.
 *
 * Uses event class constructors as keys for type safety and refactoring support.
 *
 * Usage:
 * - Subscribe handlers during app initialization with event classes
 * - Publish events after saving aggregates to repository
 */
@injectable()
export class DomainEventPublisher {
  private handlers = new Map<EventClass, EventHandler<any>[]>();

  /**
   * Clear all registered handlers (useful for testing).
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Publish a domain event to all registered handlers.
   * Handlers are executed sequentially in registration order.
   *
   * @param event - The domain event to publish
   */
  async publish(event: DomainEvent): Promise<void> {
    const eventClass = event.constructor as EventClass;
    const handlers = this.handlers.get(eventClass) || [];

    for (const handler of handlers) {
      await handler(event);
    }
  }

  /**
   * Publish multiple events sequentially.
   *
   * @param events - Array of domain events to publish
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Subscribe a handler to a specific event class.
   * Multiple handlers can be registered for the same event class.
   *
   * @param eventClass - The event class constructor (e.g., SessionStartedDomainEvent)
   * @param handler - Async or sync function to handle the event
   */
  subscribe<T extends DomainEvent>(
    eventClass: EventClass<T>,
    handler: EventHandler<T>,
  ): void {
    const handlers = this.handlers.get(eventClass) || [];

    handlers.push(handler);
    this.handlers.set(eventClass, handlers);
  }
}
