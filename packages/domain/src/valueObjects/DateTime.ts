import { invariant } from "es-toolkit";
import { ValidationDomainError } from "../errors/ValidationDomainError";

type TimeStamp = number;

export class DateTime {
  private constructor(private readonly timestamp: TimeStamp) {}

  static create(timestamp: number): DateTime {
    invariant(
      Number.isFinite(timestamp),
      new ValidationDomainError("Invalid timestamp"),
    );
    return new DateTime(timestamp);
  }

  equals(other: DateTime): boolean {
    return this.timestamp === other.timestamp;
  }

  get value(): number {
    return this.timestamp;
  }

  toJSON() {
    return String(this.timestamp);
  }
}
