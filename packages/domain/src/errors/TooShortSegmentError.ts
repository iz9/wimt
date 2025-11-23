import { DomainError } from "./DomainError";

export class TooShortSegmentError extends DomainError {
  constructor() {
    super("слишком короткий сегмент");
    this.name = "TooShortSegmentError";
  }
}
