import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionResumed extends DomainEvent {
  readonly type = "SessionResumed";

  constructor(
    public readonly sessionId: string,
    public readonly segmentId: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
