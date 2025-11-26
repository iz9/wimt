import { DomainError } from "./DomainError";

export class SegmentAlreadyStoppedError extends DomainError {
  constructor() {
    super("segment already stopped");
    this.name = "SegmentAlreadyStoppedError";
  }
}
