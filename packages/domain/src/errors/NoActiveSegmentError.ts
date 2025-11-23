import { DomainError } from "./DomainError";

export class NoActiveSegmentError extends DomainError {
  constructor() {
    super("no active segment to stop/pause");
    this.name = "NoActiveSegmentError";
  }
}
