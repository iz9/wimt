import { invariant } from "es-toolkit";
import { DateTime } from "../valueObjects/DateTime";
import { ULID } from "../valueObjects/ulid";
import { ValidationDomainError } from "../errors/ValidationDomainError";
import { SegmentAlreadyStoppedError } from "../errors/SegmentAlreadyStoppedError";
import { EntityBase } from "./Entity.base";

export class SessionSegment extends EntityBase {
  private _startedAt: DateTime;
  private _stoppedAt: DateTime | null;
  private _state: "active" | "stopped";
  constructor(props: SessionSegmentProps) {
    super(props.id);
    this._startedAt = props.startedAt;
    this._stoppedAt = props.stoppedAt ?? null;
    this._state = props.stoppedAt ? "stopped" : "active";
  }

  get state() {
    return this._state;
  }

  get durationMs() {
    if (this.state === "active") {
      return null;
    }

    invariant(this.stoppedAt, "stoppedAt is required when segment is stopped");

    return this.stoppedAt.value - this.startedAt.value;
  }

  get startedAt() {
    return this._startedAt;
  }

  get stoppedAt() {
    return this._stoppedAt;
  }

  stop(stopedAt: DateTime) {
    invariant(this.state === "active", new SegmentAlreadyStoppedError());
    invariant(
      stopedAt.value > this.startedAt.value,
      new ValidationDomainError("stop time must be after start time"),
    );
    this._stoppedAt = stopedAt;
    this._state = "stopped";
  }

  adjustStartTime(newStartTime: DateTime) {
    invariant(
      newStartTime.value < this.stoppedAt!.value,
      new ValidationDomainError("new start time must be before stop time"),
    );
    this._startedAt = newStartTime;
  }

  adjustStopTime(newStopTime: DateTime) {
    invariant(
      newStopTime.value > this.startedAt.value,
      new ValidationDomainError("new stop time must be after start time"),
    );
    this._stoppedAt = newStopTime;
  }

  toJSON() {
    return {
      id: this.id,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
    };
  }
}

type SessionSegmentProps = {
  id?: ULID;
  startedAt: DateTime;
  stoppedAt?: DateTime | null;
};
