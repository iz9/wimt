import { DateTime } from "../valueObjects/DateTime";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

export class SessionExported extends AbstractDomainEvent {
  readonly type = "SessionExported";

  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
