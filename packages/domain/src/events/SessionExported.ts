import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../shared/TimeProvider";

export class SessionExported extends AbstractDomainEvent {
  readonly type = "SessionExported";
  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
