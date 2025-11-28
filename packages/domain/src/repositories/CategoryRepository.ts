import { Category } from "../aggregate";
import { Specification } from "../specifications";
import { ULID } from "../valueObjects";

export interface ICategoryRepository {
  findManyBySpec(spec: Specification<Category>): Promise<Category[]>;
  findOneBySpec(spec: Specification<Category>): Promise<Category | null>;
  findById(id: ULID): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  save(category: Category): Promise<void>;
  delete(id: ULID): Promise<void>;
  count(): Promise<number>;
}

export const CategoryRepositorySymbol = Symbol.for("CategoryRepository");
