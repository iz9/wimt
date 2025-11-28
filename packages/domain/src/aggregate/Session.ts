import { invariant, isNil, isNotNil, last } from "es-toolkit";

import { SessionSegment } from "../entities";
import {
  DomainError,
  EmptySessionError,
  NoActiveSegmentError,
  TooShortSegmentError,
  ValidationDomainError,
} from "../errors";
import {
  SessionPaused,
  SegmentTooShort,
  SessionResumed,
  SessionStarted,
  SessionStopped,
} from "../events";
import { SegmentCollectionValidator } from "../services";
import {
  StoppedSegmentSpec,
  ValidSegmentDurationSpec,
} from "../specifications";
import { DateTime, makeId, type ULID } from "../valueObjects";
import { AggregateRoot } from "./AggregateRoot";

type SessionProps = {
  id?: ULID;
  categoryId: ULID;
  createdAt: DateTime;
  activeSegment?: SessionSegment | null;
  stoppedAt?: DateTime | null;
  history?: SessionSegment[];
};

type SessionState = "active" | "paused" | "stopped";

export class Session extends AggregateRoot {
  public categoryId: ULID;
  public readonly createdAt: DateTime;
  private _activeSegment: SessionSegment | null = null;
  private _history: SessionSegment[] = [];
  private _stoppedAt: DateTime | null = null;
  private segmentCollectionValidator = new SegmentCollectionValidator();

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

  get activeSegment(): SessionSegment | null {
    return this._activeSegment;
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

  get stoppedAt() {
    return this._stoppedAt;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addSegment(_segment: SessionSegment) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ajustStartTime(_newStartTime: DateTime) {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ajustStopTime(_newStopTime: DateTime) {
    throw new Error("Method not implemented.");
  }

  getDurationMs() {
    if (this.state !== "stopped") return null;

    const stoppedSegmentSpec = new StoppedSegmentSpec();

    return this.history
      .filter((segment) => stoppedSegmentSpec.isSatisfiedBy(segment))
      .reduce((acc, segment) => acc + (segment.durationMs ?? 0), 0);
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

  toJSON() {
    return {
      id: this.id,
      categoryId: this.categoryId,
      createdAt: this.createdAt,
      stoppedAt: this.stoppedAt,
      history: this.history,
    };
  }

  private createSegment(startedAt: DateTime) {
    return new SessionSegment({ startedAt: startedAt.clone() });
  }

  private start() {
    this._activeSegment = this.createSegment(this.createdAt);
    this.addEvent(new SessionStarted(this.id, this.createdAt.clone()));
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
}
