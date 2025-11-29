import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionPausedDomainEvent extends DomainEvent {
  readonly type = "SessionPausedDomainEvent";

  constructor(
    public readonly sessionId: ULID,
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
