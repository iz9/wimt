import { DateTime } from "./DateTime";

describe("DateTime", () => {
  describe("create", () => {
    it("should create a DateTime from timestamp", () => {
      const timestamp = 1700000000000;
      const dateTime = DateTime.create(timestamp);
      expect(dateTime.value).toBe(timestamp);
    });

    it("should throw error for invalid timestamp", () => {
      expect(() => DateTime.create(NaN)).toThrow();
      expect(() => DateTime.create(Infinity)).toThrow();
      expect(() => DateTime.create(-Infinity)).toThrow();
    });
  });

  describe("equals", () => {
    it("should return true for same timestamps", () => {
      const timestamp = 1700000000000;
      const dt1 = DateTime.create(timestamp);
      const dt2 = DateTime.create(timestamp);
      expect(dt1.equals(dt2)).toBe(true);
    });

    it("should return false for different timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      expect(dt1.equals(dt2)).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should return a string", () => {
      const json = DateTime.create(1).toJSON();
      expect(json).toBe("1");
    });
  });
});
