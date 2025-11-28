import type { DateTime } from "../../valueObjects/DateTime";

import { SessionSegment } from "../../entities/SessionSegment";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Segment started within a date range
 *
 * Use case: Filter segments for reports (today, this week, this month),
 * time-based analytics
 *
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 */
export class SegmentStartedInRangeSpec extends CompositeSpecification<SessionSegment> {
  constructor(
    private readonly startDate: DateTime,
    private readonly endDate: DateTime,
  ) {
    super();
  }

  isSatisfiedBy(segment: SessionSegment): boolean {
    return (
      segment.startedAt.isSameOrAfter(this.startDate) &&
      segment.startedAt.isSameOrBefore(this.endDate)
    );
  }
}
