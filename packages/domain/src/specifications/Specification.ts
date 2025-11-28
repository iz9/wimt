/**
 * Base Specification interface
 * Encapsulates business rules for selecting/filtering domain objects
 */
export interface Specification<T> {
  /**
   * Check if candidate satisfies this specification
   */
  isSatisfiedBy(candidate: T): boolean;

  /**
   * Combine specifications with AND logic
   */
  and(other: Specification<T>): Specification<T>;

  /**
   * Combine specifications with OR logic
   */
  or(other: Specification<T>): Specification<T>;

  /**
   * Negate specification
   */
  not(): Specification<T>;
}

/**
 * Abstract base class with composition logic
 */
export abstract class CompositeSpecification<T> implements Specification<T> {
  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  abstract isSatisfiedBy(candidate: T): boolean;

  not(): Specification<T> {
    return new NotSpecification(this);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }
}

/**
 * AND combination of two specifications
 */
class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate)
    );
  }
}

/**
 * NOT negation of a specification
 */
class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private readonly spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * OR combination of two specifications
 */
class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate)
    );
  }
}
