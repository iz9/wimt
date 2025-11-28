import { CategoryName } from "../valueObjects/CategoryName";
import { Category } from "./Category";
import { Color } from "../valueObjects/Color";
import { Icon } from "../valueObjects/Icon";
import { DateTime } from "../valueObjects/DateTime";
import { CategoryCreated } from "../events/CategoryCreated";
import { CategoryEdited } from "../events/CategoryEdited";

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

    it("should emit CategoryCreated event", () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: now,
      });
      const events = category.pullDomainEvents();
      const targetEvent = events.find(
        (event) => event instanceof CategoryCreated,
      );
      expect(targetEvent).toBeDefined();
    });
  });

  describe("property immutability", () => {
    it("should have readonly createdAt", () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: now,
      });

      const originalCreatedAt = category.createdAt;

      // Verify property descriptor shows readonly
      const descriptor = Object.getOwnPropertyDescriptor(category, "createdAt");
      expect(descriptor?.writable).toBe(false);

      // Verify value doesn't change
      expect(
        () => ((category as any).createdAt = DateTime.create(0)),
      ).toThrow();
      expect(category.createdAt).toBe(originalCreatedAt);
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
    it("should not emit event when reconstructing from persistence", () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        id: "existing-id" as any,
        createdAt: now,
      });

      const events = category.pullDomainEvents();
      expect(events.length).toBe(0); // No events on reconstruction
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

    it("should emit CategoryEdited event", () => {
      const category = new Category({
        name: CategoryName.create("Category"),
        createdAt: now,
      });
      category.setName(CategoryName.create("New Category"));
      const events = category.pullDomainEvents();
      const targetEvent = events.find(
        (event) => event instanceof CategoryEdited,
      );
      expect(targetEvent).toBeDefined();
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

    it("should emit CategoryEdited event", () => {
      const category = new Category({
        name: CategoryName.create("Category"),
        createdAt: now,
      });
      category.setColor(Color.create("#000000"));
      const events = category.pullDomainEvents();
      const targetEvent = events.find(
        (event) => event instanceof CategoryEdited,
      );
      expect(targetEvent).toBeDefined();
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

    it("should emit CategoryEdited event", () => {
      const category = new Category({
        name: CategoryName.create("Category"),
        createdAt: now,
      });
      category.setIcon(Icon.create("icon"));
      const events = category.pullDomainEvents();
      const targetEvent = events.find(
        (event) => event instanceof CategoryEdited,
      );
      expect(targetEvent).toBeDefined();
    });
  });
});
