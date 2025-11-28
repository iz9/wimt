import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionStarted extends DomainEvent {
  readonly type = "SessionStarted";

  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
