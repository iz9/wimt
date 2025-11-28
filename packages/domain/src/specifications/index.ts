// Base specification
export { type Specification, CompositeSpecification } from "./Specification";

// Category specifications
export { CategoryNameMatchesSpec } from "./category/CategoryNameMatchesSpec";

// SessionSegment specifications
export { ActiveSegmentSpec } from "./session-segment/ActiveSegmentSpec";

export { StoppedSegmentSpec } from "./session-segment/StoppedSegmentSpec";

export { LongSegmentSpec } from "./session-segment/LongSegmentSpec";

export { SegmentStartedInRangeSpec } from "./session-segment/SegmentStartedInRangeSpec";

export { ValidSegmentDurationSpec } from "./session-segment/ValidSegmentDurationSpec";

// Session specifications
export { ActiveSessionSpec } from "./session/ActiveSessionSpec";

export { PausedSessionSpec } from "./session/PausedSessionSpec";

export { StoppedSessionSpec } from "./session/StoppedSessionSpec";

export { SessionForCategorySpec } from "./session/SessionForCategorySpec";

export { SessionCreatedInRangeSpec } from "./session/SessionCreatedInRangeSpec";

export { LongSessionSpec } from "./session/LongSessionSpec";

export { SessionWithMultipleSegmentsSpec } from "./session/SessionWithMultipleSegmentsSpec";

export { SessionStoppedInRangeSpec } from "./session/SessionStoppedInRangeSpec";
