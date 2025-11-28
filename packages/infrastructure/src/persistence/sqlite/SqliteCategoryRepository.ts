import { Category } from "@wimt/domain/aggregates";
import type { ICategoryRepository } from "@wimt/domain/repositories";
import type { Specification } from "@wimt/domain/specifications";
import { type ULID } from "@wimt/domain/valueObjects";
import { injectable, inject } from "inversify";
import { eq } from "drizzle-orm";
import type { DbClient } from "./db-client";
import { categories } from "./schema";
import { CategoryMapper } from "./mappers/CategoryMapper";

export const DbClientSymbol = Symbol.for("DbClient");

@injectable()
export class SqliteCategoryRepository implements ICategoryRepository {
  private mapper = new CategoryMapper();
  constructor(@inject(DbClientSymbol) private db: DbClient) {}

  async findManyBySpec(spec: Specification<Category>): Promise<Category[]> {
    const allCategories = await this.findAll();

    return allCategories.filter((category) => spec.isSatisfiedBy(category));
  }

  async findOneBySpec(spec: Specification<Category>): Promise<Category | null> {
    const allCategories = await this.findAll();

    return (
      allCategories.find((category) => spec.isSatisfiedBy(category)) || null
    );
  }

  async findAll(): Promise<Category[]> {
    const rows = await this.db.select().from(categories);
    return this.mapper.toDomainMany(rows);
  }

  async findById(id: ULID): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapper.toDomain(rows[0]!);
  }

  async save(category: Category): Promise<void> {
    const data = this.mapper.toPersistence(category);

    const existing = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, category.id))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(categories)
        .set(data)
        .where(eq(categories.id, category.id));
    } else {
      await this.db.insert(categories).values(data);
    }
  }

  async delete(id: ULID): Promise<void> {
    await this.db.delete(categories).where(eq(categories.id, id));
  }

  async count(): Promise<number> {
    const result = await this.db.select().from(categories);
    return result.length;
  }
}
