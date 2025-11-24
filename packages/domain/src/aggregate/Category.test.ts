import { CategoryName } from "../valueObjects/CategoryName";
import { Category } from "../aggregate/Category";
import { Color } from "../valueObjects/Color";
import { Icon } from "../valueObjects/Icon";
import { DateTime } from "../valueObjects/DateTime";

describe("Category", () => {
  const now = DateTime.create(Date.now());

  describe("creation", () => {
    it("should create a category with auto-generated id and createdAt", () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: now,
      });

      expect(category.id).toBeDefined();
      expect(typeof category.id).toBe("string");
      expect(category.createdAt).toBe(now);
    });
  });

  describe("reconstruction", () => {
    it("should reconstruct category with existing id and createdAt", () => {
      const existingId = "01JD..." as any;
      const existingDate = DateTime.create(1700000000000);

      const category = new Category({
        name: CategoryName.create("Work"),
        id: existingId,
        createdAt: existingDate,
      });

      expect(category.id).toBe(existingId);
      expect(category.createdAt).toBe(existingDate);
    });
  });

  describe("change name", () => {
    it("should change name", () => {
      const category = new Category({
        name: CategoryName.create("Category"),
        createdAt: now,
      });
      category.setName(CategoryName.create("New Category"));
      expect(category.name.value).toBe("New Category");
    });
  });

  describe("set color", () => {
    it("should set color", () => {
      const category = new Category({
        name: CategoryName.create("Category"),
        createdAt: now,
      });
      category.setColor(Color.create("#000000"));
      expect(category.color?.value).toBe("#000000");
    });
  });

  describe("set icon", () => {
    it("should set icon", () => {
      const category = new Category({
        name: CategoryName.create("Category"),
        createdAt: now,
      });
      category.setIcon(Icon.create("icon"));
      expect(category.icon?.value).toBe("icon");
    });
  });
});
