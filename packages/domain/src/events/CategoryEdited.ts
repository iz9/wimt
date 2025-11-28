import { ULID } from "ulid";

import { DateTime } from "../valueObjects/DateTime";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

export class CategoryEdited extends AbstractDomainEvent {
  readonly type = "CategoryEdited";

  constructor(
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
