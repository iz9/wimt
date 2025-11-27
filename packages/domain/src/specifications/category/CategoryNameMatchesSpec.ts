import { CompositeSpecification } from "../Specification";
import type { Category } from "../../aggregate/Category";

/**
 * Specification: Category name matches search term (case-insensitive)
 *
 * Use case: Search/filter categories by name
 */
export class CategoryNameMatchesSpec extends CompositeSpecification<Category> {
  constructor(private readonly searchTerm: string) {
    super();
  }

  isSatisfiedBy(category: Category): boolean {
    const categoryName = category.name.value.toLowerCase();
    const search = this.searchTerm.toLowerCase();
    return categoryName.includes(search);
  }
}
