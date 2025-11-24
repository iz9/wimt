import { invariant, isString } from "es-toolkit";
import { ValidationDomainError } from "../errors/ValidationDomainError";
export class Icon {
  private constructor(public readonly value: string) {}
  static create(value: string): Icon {
    invariant(
      isString(value),
      new ValidationDomainError("Icon value must be a string"),
    );
    invariant(
      value.length > 0,
      new ValidationDomainError("Icon value must not be empty"),
    );
    invariant(
      this.isValidIconName(value),
      new ValidationDomainError("Icon value must be a valid icon name"),
    );
    return new Icon(value);
  }

  private static isValidIconName(value: string): boolean {
    // todo: maybe if future we will have icon validation
    return true;
  }
  equals(other: Icon): boolean {
    return this.value === other.value;
  }

  toJSON() {
    return this.value;
  }
}
