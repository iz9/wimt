import { AbstractDomainEvent } from "./AbstractDomainEvent";
import { ULID } from "ulid";
import { DateTime } from "../valueObjects/DateTime";

export class CategoryEdited extends AbstractDomainEvent {
  readonly type = "CategoryEdited";

  constructor(
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
