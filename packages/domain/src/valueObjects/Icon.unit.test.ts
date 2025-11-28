import { Icon } from "./Icon";

describe("Icon", () => {
  describe("create", () => {
    it("should create an icon", () => {
      const icon = Icon.create("icon");
      expect(icon).toBeDefined();
      expect(icon.value).toBe("icon");
      expect(icon instanceof Icon).toBe(true);
    });

    it("should throw an error if the icon is invalid type", () => {
      // @ts-expect-error intentionally invalid type
      expect(() => Icon.create(null)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => Icon.create(undefined)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => Icon.create(123)).toThrow();
      // @ts-expect-error intentionally invalid type
      expect(() => Icon.create(true)).toThrow();
    });

    it("should throw an error if the icon is empty", () => {
      expect(() => Icon.create("")).toThrow();
    });
  });

  describe("equals", () => {
    it("should return true if icons are equal", () => {
      const icon1 = Icon.create("icon");
      const icon2 = Icon.create("icon");
      expect(icon1.equals(icon2)).toBe(true);

      const icon3 = Icon.create("icon2");
      expect(icon1.equals(icon3)).toBe(false);
    });
  });
});
