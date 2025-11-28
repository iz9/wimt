import { DateTime } from "../valueObjects/DateTime";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

export class SessionStarted extends AbstractDomainEvent {
  readonly type = "SessionStarted";

  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
