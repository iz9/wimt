import { SessionSegment } from "../../entities/SessionSegment";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Segment duration is at least the specified minimum
 *
 * Use case: Filter productive work segments, exclude short/accidental segments
 *
 * @param minimumDurationMs - Minimum duration in milliseconds
 */
export class LongSegmentSpec extends CompositeSpecification<SessionSegment> {
  constructor(private readonly minimumDurationMs: number) {
    super();
  }

  isSatisfiedBy(segment: SessionSegment): boolean {
    const duration = segment.durationMs;
    return duration !== null && duration >= this.minimumDurationMs;
  }
}
