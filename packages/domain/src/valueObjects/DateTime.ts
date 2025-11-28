import { invariant } from "es-toolkit";

import { ValidationDomainError } from "../errors";

export type Diff = {
  value: number;
  unit: Unit;
};

export type Unit =
  | "ms"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year";

type TimeStamp = number;

export class DateTime {
  private constructor(private readonly timestamp: TimeStamp) {}

  get value(): number {
    return this.timestamp;
  }

  static create(timestamp: number): DateTime {
    invariant(
      Number.isFinite(timestamp),
      new ValidationDomainError("Invalid timestamp"),
    );

    return new DateTime(timestamp);
  }

  static unitToMs(unit: Unit): number {
    switch (unit) {
      case "ms":
        return 1;
      case "second":
        return 1000;
      case "minute":
        return 60 * 1000;
      case "hour":
        return 60 * 60 * 1000;
      case "day":
        return 24 * 60 * 60 * 1000;
      case "week":
        return 7 * 24 * 60 * 60 * 1000;
      case "month":
        return 30 * 24 * 60 * 60 * 1000;
      case "year":
        return 365 * 24 * 60 * 60 * 1000;
    }
  }

  add(amount: number, unit: Unit = "ms"): DateTime {
    return new DateTime(this.timestamp + amount * DateTime.unitToMs(unit));
  }

  clone(): DateTime {
    return new DateTime(this.timestamp);
  }

  diff(other: DateTime, unit: Unit = "ms"): Diff {
    const diffMs = this.timestamp - other.timestamp;
    // const value = diffMs / DateTime.unitToMs(unit);

    return {
      value: diffMs,
      unit,
    };
  }

  isAfter(other: DateTime): boolean {
    return this.timestamp > other.timestamp;
  }

  isBefore(other: DateTime): boolean {
    return this.timestamp < other.timestamp;
  }

  isBetween(other: DateTime, other2: DateTime): boolean {
    return (
      (this.isAfter(other) && this.isBefore(other2)) ||
      (this.isBefore(other) && this.isAfter(other2))
    );
  }

  isSame(other: DateTime): boolean {
    return this.timestamp === other.timestamp;
  }

  isSameOrAfter(other: DateTime): boolean {
    return this.timestamp >= other.timestamp;
  }

  isSameOrBefore(other: DateTime): boolean {
    return this.timestamp <= other.timestamp;
  }

  isSameOrBetween(other: DateTime, other2: DateTime): boolean {
    return (
      (this.isSameOrAfter(other) && this.isSameOrBefore(other2)) ||
      (this.isSameOrBefore(other) && this.isSameOrAfter(other2))
    );
  }

  subtract(amount: number, unit: Unit = "ms"): DateTime {
    return new DateTime(this.timestamp - amount * DateTime.unitToMs(unit));
  }

  toJSON() {
    return String(this.timestamp);
  }
}
