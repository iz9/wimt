import { Session } from "../../aggregate/Session";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Session is stopped (completed)
 *
 * Use case: Filter completed sessions for reports, calculate statistics,
 * "Session history", analytics queries
 */
export class StoppedSessionSpec extends CompositeSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return session.state === "stopped";
  }
}
