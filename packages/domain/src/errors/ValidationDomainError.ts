import { DomainError } from "./DomainError";

export class ValidationDomainError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationDomainError";
  }
}
