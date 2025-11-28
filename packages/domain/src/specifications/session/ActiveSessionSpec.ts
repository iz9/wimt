import { Session } from "../../aggregate";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Session is currently active
 *
 * Use case: Find currently running sessions, validate before starting new session,
 * UI active session indicator, "What am I working on right now?"
 */
export class ActiveSessionSpec extends CompositeSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return session.state === "active";
  }
}
