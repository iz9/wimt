import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../valueObjects/DateTime";

export class SessionResumed extends AbstractDomainEvent {
  readonly type = "SessionResumed";

  constructor(
    public readonly sessionId: string,
    public readonly segmentId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
