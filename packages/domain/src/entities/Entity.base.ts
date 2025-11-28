import { makeId, ULID } from "../valueObjects";

export class EntityBase {
  readonly id!: ULID;

  constructor(id?: ULID) {
    this.defineImmutable("id", id ?? makeId());
  }

  protected defineImmutable<T>(propertyName: string, value: T): void {
    Object.defineProperty(this, propertyName, {
      value,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }
}
