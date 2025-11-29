import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionExportedDomainEvent extends DomainEvent {
  readonly type = "SessionExportedDomainEvent";

  constructor(
    public readonly sessionId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
