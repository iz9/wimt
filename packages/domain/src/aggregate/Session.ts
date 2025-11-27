import { AggregateRoot } from "./AggregateRoot";
import { makeId, ULID } from "../valueObjects/ulid";
import { SessionSegment } from "../entities/SessionSegment";
import { DateTime } from "../valueObjects/DateTime";
import { invariant, isNil, isNotNil, last } from "es-toolkit";
import { ValidationDomainError } from "../errors/ValidationDomainError";
import { SessionStarted } from "../events/SessionStarted";
import { SessionPaused } from "../events/SessionPaused";
import { SessionResumed } from "../events/SessionResumed";
import { SessionStopped } from "../events/SessionStopped";
import { NoActiveSegmentError } from "../errors/NoActiveSegmentError";
import { SegmentTooShort } from "../events/SegmentTooShort";
import { DomainError } from "../errors/DomainError";
import { TooShortSegmentError } from "../errors/TooShortSegmentError";
import { EmptySessionError } from "../errors/EpmtySessionError";
import {
  ValidSegmentDurationSpec,
  StoppedSegmentSpec,
} from "../specifications";
import { SegmentCollectionValidator } from "../services/SegmentCollectionValidator";

export class Session extends AggregateRoot {
  private segmentCollectionValidator = new SegmentCollectionValidator();
  public categoryId: ULID;
  private _history: SessionSegment[] = [];
  private _stoppedAt: DateTime | null = null;
  private _activeSegment: SessionSegment | null = null;
  public readonly createdAt: DateTime;
  constructor(props: SessionProps) {
    super(props.id);

    invariant(
      props.categoryId,
      new ValidationDomainError("categoryId props is required"),
    );
    this.categoryId = props.categoryId;

    invariant(
      props.createdAt,
      new ValidationDomainError("createdAt prop is required"),
    );
    this.createdAt = props.createdAt;

    this._stoppedAt = props.stoppedAt ?? null;

    this._activeSegment = props.activeSegment ?? null;
    this._history = props.history ?? [];
    const segmentValidation = this.segmentCollectionValidator.validate(
      [...this._history, this._activeSegment].filter(isNotNil),
    );
    invariant(
      segmentValidation.isValid,
      new ValidationDomainError(segmentValidation.errors.join(", ")),
    );

    if (isNil(props.id)) {
      // fresh session
      this.start();
    }
  }

  private start() {
    this._activeSegment = this.createSegment(this.createdAt);
    this.addEvent(new SessionStarted(this.id, this.createdAt.clone()));
  }

  get history() {
    return this._history;
  }

  get state(): SessionState {
    if (isNotNil(this.stoppedAt)) return "stopped";
    if (isNotNil(this.activeSegment)) {
      return "active";
    }
    return "paused";
  }

  private createSegment(startedAt: DateTime) {
    return new SessionSegment({ startedAt: startedAt.clone() });
  }

  get stoppedAt() {
    return this._stoppedAt;
  }

  get activeSegment(): SessionSegment | null {
    return this._activeSegment;
  }

  stop(stoppedAt: DateTime) {
    const eventOcurredAt = stoppedAt.clone();
    invariant(
      this.state !== "stopped",
      new ValidationDomainError("session is already stopped"),
    );

    try {
      this.stopActiveSegment(stoppedAt);
    } catch (error) {
      switch (true) {
        case error instanceof NoActiveSegmentError:
        case error instanceof TooShortSegmentError:
          break;
        default:
          throw error;
      }
    }

    const target = last(this._history);

    invariant(isNotNil(target), new EmptySessionError());

    invariant(
      target.stoppedAt,
      new DomainError("target segment must be stopped by this time"),
    );

    this._stoppedAt = target.stoppedAt.clone();

    const totalDuration = this.getDurationMs();
    invariant(
      totalDuration,
      new DomainError("total duration must be defined by this time"),
    );

    this.addEvent(new SessionStopped(this.id, totalDuration, eventOcurredAt));
  }

  pause(pausedAt: DateTime) {
    invariant(
      this.state === "active",
      new DomainError(
        "Only active session can be paused. Current state: " + this.state + ".",
      ),
    );
    try {
      this.stopActiveSegment(pausedAt);
    } catch (error) {
      if (error instanceof TooShortSegmentError) {
        return;
      } else {
        throw error;
      }
    }
    const segment = last(this._history);
    if (isNil(segment)) return;
    this.addEvent(new SessionPaused(this.id, segment.id, pausedAt.clone()));
  }

  private stopActiveSegment(stoppedAt: DateTime) {
    const segment = this.activeSegment;
    invariant(isNotNil(segment), new NoActiveSegmentError());

    segment.stop(stoppedAt.clone());

    const isValid = new ValidSegmentDurationSpec().isSatisfiedBy(segment);

    if (!isValid) {
      this.addEvent(new SegmentTooShort(segment.id, stoppedAt));
      throw new TooShortSegmentError();
    }

    this._activeSegment = null;
    this._history.push(segment);
  }

  resume(resumedAt: DateTime) {
    invariant(
      this.state === "paused",
      new ValidationDomainError(
        "Only paused session can be resumed. Current state: " +
          this.state +
          ".",
      ),
    );
    this._activeSegment = this.createSegment(resumedAt);
    this.addEvent(
      new SessionResumed(this.id, this._activeSegment.id, resumedAt.clone()),
    );
  }

  getDurationMs() {
    if (this.state !== "stopped") return null;

    const stoppedSegmentSpec = new StoppedSegmentSpec();
    return this.history
      .filter((segment) => stoppedSegmentSpec.isSatisfiedBy(segment))
      .reduce((acc, segment) => acc + (segment.durationMs ?? 0), 0);
  }

  toJSON() {
    return {
      id: this.id,
      categoryId: this.categoryId,
      createdAt: this.createdAt,
      stoppedAt: this.stoppedAt,
      history: this.history,
    };
  }

  ajustStartTime(_newStartTime: DateTime) {
    throw new Error("Method not implemented.");
  }

  ajustStopTime(_newStopTime: DateTime) {
    throw new Error("Method not implemented.");
  }

  static _validTestInstance(props: Partial<SessionProps> = {}) {
    const start = DateTime.create(0);
    const p = {
      createdAt: start.clone(),
      categoryId: makeId(),
      segments: [new SessionSegment({ startedAt: start.clone() })],
      ...props,
    };
    return new Session(p);
  }
}

type SessionState = "active" | "paused" | "stopped";
type SessionProps = {
  id?: ULID;
  categoryId: ULID;
  createdAt: DateTime;
  activeSegment?: SessionSegment | null;
  stoppedAt?: DateTime | null;
  history?: SessionSegment[];
};
