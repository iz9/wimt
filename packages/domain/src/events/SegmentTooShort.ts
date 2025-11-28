import { ULID } from "ulid";

import { DateTime } from "../valueObjects/DateTime";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

export class SegmentTooShort extends AbstractDomainEvent {
  readonly type = "SegmentTooShort";

  constructor(
    public readonly segmentId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
