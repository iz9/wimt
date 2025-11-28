import { Session } from "../../aggregate";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Session has multiple segments (was paused/resumed at least once)
 *
 * Use case: Find sessions with pause/resume cycles, analyze interruption patterns,
 * "Sessions with breaks", fragmented work analysis
 */
export class SessionWithMultipleSegmentsSpec extends CompositeSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return session.history.length > 1;
  }
}
