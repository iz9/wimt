import { invariant, isString } from "es-toolkit";
import { ValidationDomainError } from "../errors/ValidationDomainError";
export class CategoryName {
  private constructor(public readonly value: string) {}
  static create(value: string): CategoryName {
    invariant(
      isString(value),
      new ValidationDomainError("Category name must be a string"),
    );
    const trimmedValue = value.trim();
    invariant(
      trimmedValue.length >= CategoryName.MIN_LENGTH,
      new ValidationDomainError(
        `Category name must be at least ${CategoryName.MIN_LENGTH} characters long`,
      ),
    );
    invariant(
      trimmedValue.length <= CategoryName.MAX_LENGTH,
      new ValidationDomainError(
        `Category name must not be longer than ${CategoryName.MAX_LENGTH} characters`,
      ),
    );
    return new CategoryName(trimmedValue);
  }
  static MAX_LENGTH = 255;
  static MIN_LENGTH = 1;
  equals(other: CategoryName): boolean {
    return this.value === other.value;
  }
  toJSON() {
    return this.value;
  }
}
