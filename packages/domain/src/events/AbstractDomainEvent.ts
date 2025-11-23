import { DateTime } from "../shared/TimeProvider";

export abstract class AbstractDomainEvent {
  abstract readonly type: string;

  protected constructor(public readonly occurredAt: DateTime) {}
}
