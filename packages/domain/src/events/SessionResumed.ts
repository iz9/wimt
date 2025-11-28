import { DateTime } from "../valueObjects/DateTime";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

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
