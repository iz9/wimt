import { Category } from "../aggregate/Category";
import { Specification } from "../specifications";
import { ULID } from "../valueObjects/ulid";

export interface ICategoryRepository {
  // spec is optional. If not provided, returns all categories
  find(spec?: Specification<Category>): Promise<Category[]>;
  findOne(spec: Specification<Category>): Promise<Category | null>;
  save(category: Category): Promise<void>;
  delete(id: ULID): Promise<void>;
  findById(id: ULID): Promise<Category | null>;
  count(): Promise<number>;
}
