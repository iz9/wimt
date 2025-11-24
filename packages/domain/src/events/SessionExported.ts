import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../valueObjects/DateTime";

export class SessionExported extends AbstractDomainEvent {
  readonly type = "SessionExported";
  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
