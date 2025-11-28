// infrastructure/src/persistence/sqlite/mappers/CategoryMapper.ts
import { Category } from "@wimt/domain/aggregates";
import {
  CategoryName,
  Color,
  Icon,
  DateTime,
  type ULID,
} from "@wimt/domain/valueObjects";

import type { CategoryRow, NewCategoryRow } from "../schema";

export class CategoryMapper {
  /**
   * Convert database row to domain entity
   */
  toDomain(row: CategoryRow): Category {
    return new Category({
      id: row.id as ULID,
      name: CategoryName.create(row.name),
      createdAt: DateTime.create(row.createdAt.getTime()),
      color: row.color ? Color.create(row.color) : undefined,
      icon: row.icon ? Icon.create(row.icon) : undefined,
    });
  }

  /**
   * Map multiple rows to domain entities
   */
  toDomainMany(rows: CategoryRow[]): Category[] {
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Convert domain entity to database row for persistence
   */
  toPersistence(category: Category): NewCategoryRow {
    return {
      id: category.id,
      name: category.name.value,
      createdAt: new Date(category.createdAt.value),
      color: category.color?.value ?? null,
      icon: category.icon?.value ?? null,
    };
  }
}
