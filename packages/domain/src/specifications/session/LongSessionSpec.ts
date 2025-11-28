import { Session } from "../../aggregate";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Session duration is at least the specified minimum
 *
 * Use case: Find productive work sessions (> 1 hour), "Deep work" sessions (> 30 min),
 * filter short/test sessions, quality metrics
 *
 * @param minimumDurationMs - Minimum duration in milliseconds
 */
export class LongSessionSpec extends CompositeSpecification<Session> {
  constructor(private readonly minimumDurationMs: number) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    const duration = session.getDurationMs();

    return duration !== null && duration >= this.minimumDurationMs;
  }
}
