import { DomainError } from "./DomainError";

export class OverlappingSegmentError extends DomainError {
  constructor() {
    super("segments overlap");
    this.name = "OverlappingSegmentError";
  }
}
