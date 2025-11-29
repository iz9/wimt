import { ApplicationError } from "./ApplicationError";

export class ActiveSessionExistsAlreadyError extends ApplicationError {
  constructor() {
    super(
      "Cannot start new session: an active session already exists. Please stop or pause the current session first.",
    );
  }
}
