import { DateTime } from "../valueObjects/DateTime";
import { ULID } from "../valueObjects/ulid";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

export class SessionPaused extends AbstractDomainEvent {
  readonly type = "SessionPaused";

  constructor(
    public readonly sessionId: ULID,
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
