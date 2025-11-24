import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../valueObjects/DateTime";

export class SessionStarted extends AbstractDomainEvent {
  readonly type = "SessionStarted";
  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
