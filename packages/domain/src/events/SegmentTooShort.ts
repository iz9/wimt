import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { ULID } from "ulid";
import { DateTime } from "../shared/TimeProvider";

export class SegmentTooShort extends AbstractDomainEvent {
  readonly type = "SegmentTooShort";

  constructor(
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
