import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class CategoryEdited extends DomainEvent {
  readonly type = "CategoryEdited";

  constructor(
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
