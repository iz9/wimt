import { isNil } from "es-toolkit";

import { SessionSegment } from "../entities";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class SegmentCollectionValidator {
  /**
   * Domain Service: Validate segment collection invariants
   */

  areSegmentsSorted(segments: SessionSegment[]): boolean {
    for (let i = 1; i < segments.length; i++) {
      const currentStart = segments[i]?.startedAt;
      const prevStart = segments[i - 1]?.startedAt;

      if (isNil(currentStart) || isNil(prevStart)) {
        continue;
      }

      if (!currentStart.isAfter(prevStart)) {
        return false;
      }
    }

    return true;
  }

  doSegmentsOverlap(segments: SessionSegment[]): boolean {
    for (let i = 0; i < segments.length; i++) {
      const currentStop = segments[i]?.stoppedAt;
      const nextStart = segments[i + 1]?.startedAt;

      if (isNil(currentStop) || isNil(nextStart)) {
        continue;
      }

      if (!currentStop.isBefore(nextStart)) {
        return true; // They overlap
      }
    }

    return false; // No overlap
  }

  validate(segments: SessionSegment[]): ValidationResult {
    const errors: string[] = [];

    if (!this.areSegmentsSorted(segments)) {
      errors.push("Segments must be sorted by startedAt");
    }

    if (this.doSegmentsOverlap(segments)) {
      errors.push("Segments must not overlap");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
