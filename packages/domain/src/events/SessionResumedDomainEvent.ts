import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionResumedDomainEvent extends DomainEvent {
  readonly type = "SessionResumedDomainEvent";

  constructor(
    public readonly sessionId: string,
    public readonly segmentId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
