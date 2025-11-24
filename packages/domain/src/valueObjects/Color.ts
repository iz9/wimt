import { invariant, isString } from "es-toolkit";
import { ValidationDomainError } from "../errors/ValidationDomainError";
export class Color {
  private constructor(public readonly value: HexColor) {}
  static create(value: HexColor): Color {
    invariant(
      isString(value),
      new ValidationDomainError("Color value must be a string"),
    );
    invariant(
      this.isValidHexColor(value),
      new ValidationDomainError("Color value must be a valid hex color"),
    );
    return new Color(value.toLowerCase());
  }

  static isValidHexColor(value: string): boolean {
    const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    return hexColorRegex.test(value);
  }

  equals(other: Color): boolean {
    return this.value === other.value;
  }

  toJSON() {
    return this.value;
  }
}

type HexColor = string;
