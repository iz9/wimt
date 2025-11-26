import { DomainError } from "./DomainError";

export class EmptySessionError extends DomainError {
  constructor() {
    super("empty session");
    this.name = "EmptySessionError";
  }
}
