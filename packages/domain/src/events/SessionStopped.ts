import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { DateTime } from "../valueObjects/DateTime";

export class SessionStopped extends AbstractDomainEvent {
  readonly type = "SessionStopped";

  constructor(
    public readonly sessionId: string,
    public readonly totalDurationMs: number,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
