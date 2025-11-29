import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionStartedDomainEvent extends DomainEvent {
  readonly type = "SessionStartedDomainEvent";

  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
