import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionExported extends DomainEvent {
  readonly type = "SessionExported";

  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
