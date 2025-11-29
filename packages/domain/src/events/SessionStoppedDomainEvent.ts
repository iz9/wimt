import { DateTime } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class SessionStoppedDomainEvent extends DomainEvent {
  readonly type = "SessionStoppedDomainEvent";

  constructor(
    public readonly sessionId: string,
    public readonly totalDurationMs: number,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
