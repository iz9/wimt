import { Category } from "@wimt/domain/aggregates";
import type { ICategoryRepository } from "@wimt/domain/repositories";
import type { Specification } from "@wimt/domain/specifications";
import type { ULID } from "@wimt/domain/valueObjects";
import { injectable } from "inversify";

@injectable()
export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories: Map<string, Category> = new Map();

  async findManyBySpec(spec?: Specification<Category>): Promise<Category[]> {
    const all = Array.from(this.categories.values());
    if (!spec) {
      return all;
    }
    return all.filter((category) => spec.isSatisfiedBy(category));
  }

  async findOneBySpec(spec: Specification<Category>): Promise<Category | null> {
    const all = Array.from(this.categories.values());
    return all.find((category) => spec.isSatisfiedBy(category)) || null;
  }

  async findAll(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, category);
  }

  async delete(id: ULID): Promise<void> {
    this.categories.delete(id);
  }

  async findById(id: ULID): Promise<Category | null> {
    return this.categories.get(id) || null;
  }

  async count(): Promise<number> {
    return this.categories.size;
  }
}
