import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SegmentTooShort extends DomainEvent {
  readonly type = "SegmentTooShort";

  constructor(
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
