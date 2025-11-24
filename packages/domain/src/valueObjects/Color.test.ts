import { Color } from "./Color";

describe("Color", () => {
  describe("creation", () => {
    it("should create a color", () => {
      const color = Color.create("#FF0000");
      expect(color).toBeDefined();
    });
    it("should throw an error if the color is invalid type", () => {
      // @ts-expect-error intentionally invalid type
      expect(() => Color.create(null)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => Color.create(undefined)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => Color.create(123)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => Color.create(true)).toThrow();
    });
    it("should throw if NOT hex color", () => {
      expect(() => Color.create("#III")).toThrow();
      expect(() => Color.create("#z32")).toThrow();
      expect(() => Color.create("#FFFFFFF")).toThrow();
    });
  });
  describe("equals", () => {
    it("should compare colors", () => {
      const color1 = Color.create("#FF0000");
      const color2 = Color.create("#FF0000");
      expect(color1.equals(color2)).toBe(true);

      const color3 = Color.create("#00FF00");
      expect(color1.equals(color3)).toBe(false);
    });

    it("should be case insensitive", () => {
      const color1 = Color.create("#ffffff");
      const color2 = Color.create("#FFFFFF");
      expect(color1.equals(color2)).toBe(true);
    });

    it("should support short hex codes", () => {
      const color = Color.create("#F00");
      expect(color.value).toBe("#f00");
    });
  });
  describe("toJSON", () => {
    it("should return a string", () => {
      const color = Color.create("#FF0000");
      expect(color.toJSON()).toBe("#ff0000");
    });
  });
});
