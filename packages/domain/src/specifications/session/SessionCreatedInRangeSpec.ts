import { Session } from "../../aggregate/Session";
import { CompositeSpecification } from "../Specification";
import type { DateTime } from "../../valueObjects/DateTime";

/**
 * Specification: Session created within a date range
 *
 * Use case: Daily/weekly/monthly reports, "Sessions created today",
 * "Sessions from last week", time-based analytics
 *
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 */
export class SessionCreatedInRangeSpec extends CompositeSpecification<Session> {
  constructor(
    private readonly startDate: DateTime,
    private readonly endDate: DateTime,
  ) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    return (
      session.createdAt.isSameOrAfter(this.startDate) &&
      session.createdAt.isSameOrBefore(this.endDate)
    );
  }
}
