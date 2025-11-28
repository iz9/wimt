import type { ULID } from "../../valueObjects";

import { Session } from "../../aggregate";
import { CompositeSpecification } from "../Specification";

/**
 * Specification: Session belongs to a specific category
 *
 * Use case: Filter sessions by category, "All Work sessions",
 * category statistics, prevent duplicate active sessions per category
 *
 * @param categoryId - ID of the category to match
 */
export class SessionForCategorySpec extends CompositeSpecification<Session> {
  constructor(private readonly categoryId: ULID) {
    super();
  }

  isSatisfiedBy(session: Session): boolean {
    return session.categoryId === this.categoryId;
  }
}
