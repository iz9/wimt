import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionPaused extends DomainEvent {
  readonly type = "SessionPaused";

  constructor(
    public readonly sessionId: ULID,
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
