import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class CategoryCreated extends DomainEvent {
  readonly type = "CategoryCreated";

  constructor(
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
