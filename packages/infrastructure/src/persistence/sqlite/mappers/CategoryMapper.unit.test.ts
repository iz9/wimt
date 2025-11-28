// CategoryMapper.test.ts
import { Category } from "@wimt/domain/aggregates";
import { CategoryMapper } from "./CategoryMapper";
import { CategoryName, Color, DateTime } from "@wimt/domain/valueObjects";
import { CategoryRow } from "../schema";

describe("CategoryMapper", () => {
  const mapper = new CategoryMapper();

  describe("toDomain", () => {
    it("should map database row to domain entity", () => {
      const row: CategoryRow = {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        name: "Work",
        createdAt: new Date("2024-01-01"),
        color: "#ff0000",
        icon: "briefcase",
      };

      const category = mapper.toDomain(row);

      expect(category.id).toBe(row.id);
      expect(category.name.value).toBe("Work");
      expect(category.color?.value).toBe("#ff0000");
      expect(category.icon?.value).toBe("briefcase");
    });

    it("should handle null color and icon", () => {
      const row: CategoryRow = {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        name: "Work",
        createdAt: new Date("2024-01-01"),
        color: null,
        icon: null,
      };

      const category = mapper.toDomain(row);

      expect(category.color).toBeNull();
      expect(category.icon).toBeNull();
    });
  });

  describe("toPersistence", () => {
    it("should map domain entity to database row", () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
        color: Color.create("#ff0000"),
      });

      const row = mapper.toPersistence(category);

      expect(row.id).toBe(category.id);
      expect(row.name).toBe("Work");
      expect(row.color).toBe("#ff0000");
    });
  });
});
