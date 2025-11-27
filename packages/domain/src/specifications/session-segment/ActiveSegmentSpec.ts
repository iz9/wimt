import { SessionSegment } from "../../entities/SessionSegment";
import { CompositeSpecification } from "../Specification";

export class ActiveSegmentSpec extends CompositeSpecification<SessionSegment> {
  isSatisfiedBy(segment: SessionSegment): boolean {
    return segment.state === "active";
  }
}
