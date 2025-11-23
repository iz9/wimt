import { DomainError } from "./DomainError";

export class SessionAlreadyStoppedError extends DomainError {
  constructor() {
    super("session already stopped");
    this.name = "SessionAlreadyStoppedError";
  }
}
