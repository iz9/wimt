import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { ULID } from "../valueObjects/ulid";
import { DateTime } from "../valueObjects/DateTime";

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
