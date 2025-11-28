import { CategoryName } from "./CategoryName";

describe("CategoryName", () => {
  describe("creation", () => {
    it("should create a name", () => {
      const name = CategoryName.create("name");
      expect(name).toBeDefined();
      expect(name.value).toBe("name");
      expect(name instanceof CategoryName).toBe(true);
    });
    it("should throw an error if the name is invalid type", () => {
      // @ts-expect-error intentionally invalid type
      expect(() => CategoryName.create(null)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => CategoryName.create(undefined)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => CategoryName.create(123)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => CategoryName.create(true)).toThrow();
    });
    it("should throw an error if the name is empty", () => {
      expect(() => CategoryName.create("")).toThrow();
      expect(() => CategoryName.create("   ")).toThrow();
    });
    it("should trim the name", () => {
      const name = CategoryName.create("  name  ");
      expect(name.value).toBe("name");
    });
    it("should throw error if category name is too long", () => {
      expect(() =>
        CategoryName.create("a".repeat(CategoryName.MAX_LENGTH + 1))
      ).toThrow();
    });
    it("should throw error if category name is too short", () => {
      expect(() =>
        CategoryName.create("a".repeat(CategoryName.MIN_LENGTH - 1))
      ).toThrow();
    });
  });
  describe("equals", () => {
    it("should compare names", () => {
      const name1 = CategoryName.create("name");
      const name2 = CategoryName.create("name");
      expect(name1.equals(name2)).toBe(true);

      const name3 = CategoryName.create("name2");
      expect(name1.equals(name3)).toBe(false);
    });
  });
});
