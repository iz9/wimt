import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../shared/TimeProvider";

export class SessionStarted extends AbstractDomainEvent {
  readonly type = "SessionStarted";
  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
