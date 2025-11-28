import { ULID } from "ulid";

import { DateTime } from "../valueObjects/DateTime";
import { AbstractDomainEvent } from "./AbstractDomainEvent";

export class CategoryCreated extends AbstractDomainEvent {
  readonly type = "CategoryCreated";

  constructor(
    public readonly categoryId: ULID,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}
