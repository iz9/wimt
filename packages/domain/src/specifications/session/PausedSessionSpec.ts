import { Session } from "../../aggregate/Session";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Session is paused
 *
 * Use case: Find paused sessions that can be resumed, "Paused sessions you can continue",
 * UI show resume button
 */
export class PausedSessionSpec extends CompositeSpecification<Session> {
  isSatisfiedBy(session: Session): boolean {
    return session.state === "paused";
  }
}
