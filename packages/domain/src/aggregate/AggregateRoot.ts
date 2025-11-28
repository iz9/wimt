import { ULID } from "ulid";

import { EntityBase } from "../entities/Entity.base";
import { AbstractDomainEvent } from "../events/AbstractDomainEvent";

/**
 * Base AggregateRoot that collects domain events (simple event buffer).
 * This pattern allows application layer to dispatch events (e.g. to infrastructure).
 *
 * Aggregate Root is the entry point to an aggregate - a cluster of domain objects
 * treated as a single unit. Only the aggregate root can be directly accessed from
 * outside, ensuring consistency and enforcing business rules.
 *
 * @see {@link file://../../docs/theory/aggregate-root-pattern.md} for detailed explanation of the pattern
 *
 * @example
 * ```typescript
 * export class Session extends AggregateRoot {
 *   private _segments: SessionSegment[] = [];
 *
 *   pause(timeProvider: TimeProvider): void {
 *     // Business logic...
 *     this.addEvent(new SessionPaused(...));
 *   }
 *
 *   // Pull events for publishing
 *   const events = session.pullDomainEvents();
 * }
 * ```
 */
export class AggregateRoot extends EntityBase {
  private _domainEvents: AbstractDomainEvent[] = [];

  constructor(id?: ULID) {
    super(id);
  }

  public pullDomainEvents(): AbstractDomainEvent[] {
    const evts = this._domainEvents.slice();

    this._domainEvents = [];

    return evts;
  }

  protected addEvent(event: AbstractDomainEvent): void {
    this._domainEvents.push(event);
  }
}
