import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SegmentTooShortDomainEvent extends DomainEvent {
  readonly type = "SegmentTooShortDomainEvent";

  constructor(
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
