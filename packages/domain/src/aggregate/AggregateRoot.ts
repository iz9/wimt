import { AbstractDomainEvent } from "../events/AbstractDomainEvent";

/**
 * Base AggregateRoot that collects domain events (simple event buffer).
 * This pattern allows application layer to dispatch events (e.g. to infrastructure).
 */
export abstract class AggregateRoot {
  private _domainEvents: AbstractDomainEvent[] = [];

  protected addEvent(event: AbstractDomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): AbstractDomainEvent[] {
    const evts = this._domainEvents.slice();
    this._domainEvents = [];
    return evts;
  }
}
