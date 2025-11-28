import { isNotNil } from "es-toolkit";

import { SessionSegment } from "../../entities";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Segment has valid duration (>= 300ms)
 *
 * Business Rule: Segments shorter than 300ms are considered invalid
 * (likely accidental clicks) and should not be added to session history.
 *
 * Use case: Validate segments before adding to history, filter out invalid segments
 */
export class ValidSegmentDurationSpec extends CompositeSpecification<SessionSegment> {
  isSatisfiedBy(segment: SessionSegment): boolean {
    // Segment must be stopped to have a duration
    if (segment.state !== "stopped") {
      return false;
    }

    const duration = segment.durationMs;

    return (
      isNotNil(duration) &&
      duration >= ValidSegmentDurationSpec.MIN_VALID_DURATION_MS
    );
  }

  private static readonly MIN_VALID_DURATION_MS = 300;
}
