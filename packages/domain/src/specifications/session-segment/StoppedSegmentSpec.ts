import { SessionSegment } from "../../entities";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Segment is stopped (completed)
 *
 * Use case: Filter completed segments for duration calculations,
 * find segments eligible for time adjustments
 */
export class StoppedSegmentSpec extends CompositeSpecification<SessionSegment> {
  isSatisfiedBy(segment: SessionSegment): boolean {
    return segment.state === "stopped";
  }
}
