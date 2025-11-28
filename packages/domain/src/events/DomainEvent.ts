import { DateTime } from "../valueObjects";

/**
 * Base class for all domain events in the system.
 *
 * Domain events represent business-significant occurrences that have already happened.
 * They are immutable records of the past and are used to decouple different parts of
 * the system, maintain an audit trail, and enable event-driven architectures.
 *
 * Key principles:
 * - Events are named in past tense (e.g., SessionStarted, CategoryCreated)
 * - Events are immutable once created
 * - Events contain only essential data about what happened
 * - Events are emitted by aggregates after state changes
 *
 * @see {@link file://../../docs/theory/domain-events.md} for detailed explanation of the pattern
 *
 * @example
 * ```typescript
 * export class CategoryCreated extends AbstractDomainEvent {
 *   readonly type = 'CategoryCreated';
 *
 *   constructor(
 *     public readonly categoryId: ULID,
 *     public readonly categoryName: string,
 *     occurredAt: DateTime
 *   ) {
 *     super(occurredAt);
 *   }
 * }
 * ```
 */
export abstract class DomainEvent {
  abstract readonly type: string;

  protected constructor(public readonly occurredAt: DateTime) {}
}
