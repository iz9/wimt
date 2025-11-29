import { DateTime, type ULID } from "../valueObjects";
import { DomainEvent } from "./DomainEvent";

export class CategoryCreatedDomainEvent extends DomainEvent {
  readonly type = "CategoryCreatedDomainEvent";

  constructor(
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
