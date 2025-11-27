import { Session } from "../../aggregate/Session";
import { CompositeSpecification } from "../Specification";
import type { DateTime } from "../../valueObjects/DateTime";

/**
 * Specification: Session stopped (completed) within a date range
 *
 * Use case: "Sessions completed today", "Sessions finished this week",
 * completion time analytics
 *
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 */
export class SessionStoppedInRangeSpec extends CompositeSpecification<Session> {
  constructor(
    private readonly startDate: DateTime,
    private readonly endDate: DateTime,
  ) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    if (session.stoppedAt === null) {
      return false;
    }

    return (
      session.stoppedAt.isSameOrAfter(this.startDate) &&
      session.stoppedAt.isSameOrBefore(this.endDate)
    );
  }
}
