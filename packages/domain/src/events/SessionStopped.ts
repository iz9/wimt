import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionStopped extends DomainEvent {
  readonly type = "SessionStopped";

  constructor(
    public readonly sessionId: string,
    public readonly totalDurationMs: number,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
