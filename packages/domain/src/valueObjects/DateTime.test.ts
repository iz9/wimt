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

  describe("unitToMs", () => {
    it("should return the number of milliseconds in a unit", () => {
      expect(DateTime.unitToMs("ms")).toBe(1);
      expect(DateTime.unitToMs("second")).toBe(1000);
      expect(DateTime.unitToMs("minute")).toBe(60 * 1000);
      expect(DateTime.unitToMs("hour")).toBe(60 * 60 * 1000);
      expect(DateTime.unitToMs("day")).toBe(24 * 60 * 60 * 1000);
      expect(DateTime.unitToMs("week")).toBe(7 * 24 * 60 * 60 * 1000);
      expect(DateTime.unitToMs("month")).toBe(30 * 24 * 60 * 60 * 1000);
      expect(DateTime.unitToMs("year")).toBe(365 * 24 * 60 * 60 * 1000);
    });
  });

  describe("isSame", () => {
    it("should return true for same timestamps", () => {
      const timestamp = 1700000000000;
      const dt1 = DateTime.create(timestamp);
      const dt2 = DateTime.create(timestamp);
      expect(dt1.isSame(dt2)).toBe(true);
    });

    it("should return false for different timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      expect(dt1.isSame(dt2)).toBe(false);
    });
  });

  describe("isBefore", () => {
    it("should return true for before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      expect(dt1.isBefore(dt2)).toBe(true);
    });

    it("should return false for after timestamps", () => {
      const dt1 = DateTime.create(2000);
      const dt2 = DateTime.create(1000);
      expect(dt1.isBefore(dt2)).toBe(false);
    });
  });

  describe("isAfter", () => {
    it("should return true for after timestamps", () => {
      const dt1 = DateTime.create(2000);
      const dt2 = DateTime.create(1000);
      expect(dt1.isAfter(dt2)).toBe(true);
    });

    it("should return false for before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      expect(dt1.isAfter(dt2)).toBe(false);
    });
  });

  describe("isSameOrBefore", () => {
    it("should return true for same or before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(1000);
      expect(dt1.isSameOrBefore(dt2)).toBe(true);
    });

    it("should return true for before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      expect(dt1.isSameOrBefore(dt2)).toBe(true);
    });

    it("should return false for after timestamps", () => {
      const dt1 = DateTime.create(2000);
      const dt2 = DateTime.create(1000);
      expect(dt1.isSameOrBefore(dt2)).toBe(false);
    });
  });

  describe("isSameOrAfter", () => {
    it("should return true for same or after timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(1000);
      expect(dt1.isSameOrAfter(dt2)).toBe(true);
    });

    it("should return true for after timestamps", () => {
      const dt1 = DateTime.create(2000);
      const dt2 = DateTime.create(1000);
      expect(dt1.isSameOrAfter(dt2)).toBe(true);
    });

    it("should return false for before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      expect(dt1.isSameOrAfter(dt2)).toBe(false);
    });
  });

  describe("isBetween", () => {
    it("should return true for between timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      const dt3 = DateTime.create(1500);
      expect(dt3.isBetween(dt2, dt1)).toBe(true);
    });

    it("should return false for before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      const dt3 = DateTime.create(500);
      expect(dt2.isBetween(dt1, dt3)).toBe(false);
    });

    it("should return false for after timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      const dt3 = DateTime.create(2500);
      expect(dt1.isBetween(dt2, dt3)).toBe(false);
    });
  });

  describe("isSameOrBetween", () => {
    it("should return true for same or between timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      const dt3 = DateTime.create(1500);
      expect(dt3.isSameOrBetween(dt2, dt1)).toBe(true);
    });

    it("should return false for before timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      const dt3 = DateTime.create(500);
      expect(dt3.isSameOrBetween(dt1, dt2)).toBe(false);
    });

    it("should return false for after timestamps", () => {
      const dt1 = DateTime.create(1000);
      const dt2 = DateTime.create(2000);
      const dt3 = DateTime.create(2500);
      expect(dt3.isSameOrBetween(dt1, dt2)).toBe(false);
    });
  });

  describe("diff", () => {
    it("should return  the difference in milliseconds", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(2000);
      const diff = dt1.diff(dt2);
      expect(diff.value).toBe(-2000);
      expect(diff.unit).toBe("ms");
    });

    it("should return the difference in seconds", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("second") * 10);
      const diff = dt1.diff(dt2, "second");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("second"));
      expect(diff.unit).toBe("second");
    });

    it("should return the difference in minutes", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("minute") * 10);
      const diff = dt1.diff(dt2, "minute");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("minute"));
      expect(diff.unit).toBe("minute");
    });

    it("should return the difference in hours", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("hour") * 10);
      const diff = dt1.diff(dt2, "hour");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("hour"));
      expect(diff.unit).toBe("hour");
    });

    it("should return the difference in days", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("day") * 10);
      const diff = dt1.diff(dt2, "day");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("day"));
      expect(diff.unit).toBe("day");
    });

    it("should return the difference in weeks", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("week") * 10);
      const diff = dt1.diff(dt2, "week");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("week"));
      expect(diff.unit).toBe("week");
    });

    it("should return the difference in months", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("month") * 10);
      const diff = dt1.diff(dt2, "month");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("month"));
      expect(diff.unit).toBe("month");
    });

    it("should return the difference in years", () => {
      const dt1 = DateTime.create(0);
      const dt2 = DateTime.create(DateTime.unitToMs("year") * 10);
      const diff = dt1.diff(dt2, "year");
      expect(diff.value).toBe(-10 * DateTime.unitToMs("year"));
      expect(diff.unit).toBe("year");
    });
  });

  describe("add", () => {
    it("should add the specified amount of time", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(500, "ms");
      expect(dt2.value).toBe(500);
    });

    it("should add the specified amount of time in seconds", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "second");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("second"));
    });

    it("should add the specified amount of time in minutes", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "minute");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("minute"));
    });

    it("should add the specified amount of time in hours", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "hour");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("hour"));
    });

    it("should add the specified amount of time in days", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "day");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("day"));
    });

    it("should add the specified amount of time in weeks", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "week");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("week"));
    });

    it("should add the specified amount of time in months", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "month");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("month"));
    });

    it("should add the specified amount of time in years", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.add(5, "year");
      expect(dt2.value).toBe(5 * DateTime.unitToMs("year"));
    });
  });

  describe("subtract", () => {
    it("should subtract the specified amount of time", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(500, "ms");
      expect(dt2.value).toBe(-500);
    });
    it("should subtract the specified amount of time in seconds", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "second");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("second"));
    });
    it("should subtract the specified amount of time in minutes", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "minute");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("minute"));
    });
    it("should subtract the specified amount of time in hours", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "hour");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("hour"));
    });
    it("should subtract the specified amount of time in days", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "day");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("day"));
    });
    it("should subtract the specified amount of time in weeks", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "week");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("week"));
    });
    it("should subtract the specified amount of time in months", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "month");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("month"));
    });
    it("should subtract the specified amount of time in years", () => {
      const dt1 = DateTime.create(0);
      const dt2 = dt1.subtract(5, "year");
      expect(dt2.value).toBe(-5 * DateTime.unitToMs("year"));
    });
  });

  describe("clone", () => {
    it("should return equal DateTime", () => {
      const dt1 = DateTime.create(1700000000000);
      const dt2 = dt1.clone();
      expect(dt1.value).toBe(dt2.value);
    });
  });

  describe("toJSON", () => {
    it("should return a string", () => {
      const json = DateTime.create(1).toJSON();
      expect(json).toBe("1");
    });
  });
});
