/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Container } from "inversify";

import { Category } from "@wimt/domain/aggregates";
import { CategoryNameMatchesSpec } from "@wimt/domain/specifications";
import { CategoryName, Color, Icon, DateTime } from "@wimt/domain/valueObjects";

import {
  SqliteCategoryRepository,
  DbClientSymbol,
} from "./SqliteCategoryRepository";

// Mock drizzle db client
const createMockDbClient = () => {
  const storage = new Map<string, any>();

  return {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            const all = Array.from(storage.values());
            // Simple mock for eq condition
            const filtered = all.filter((row) => {
              // This is a simplified implementation
              return true;
            });

            return Promise.resolve(filtered.slice(0, n));
          },
        }),
        then: (resolve: any) => {
          resolve(Array.from(storage.values()));
        },
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => {
        storage.set(data.id, data);

        return Promise.resolve();
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => {
          storage.set(data.id, data);

          return Promise.resolve();
        },
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => {
        // Extract id from condition - this is a simplified mock
        const entries = Array.from(storage.entries());

        if (entries.length > 0) {
          storage.delete(entries[entries.length - 1]![0]);
        }

        return Promise.resolve();
      },
    }),
    _storage: storage, // For testing purposes
  };
};

describe("SqliteCategoryRepository", () => {
  let repository: SqliteCategoryRepository;
  let mockDb: ReturnType<typeof createMockDbClient>;
  let container: Container;

  beforeEach(() => {
    mockDb = createMockDbClient();
    container = new Container();
    container.bind(DbClientSymbol).toConstantValue(mockDb as any);
    container.bind(SqliteCategoryRepository).toSelf();
    repository = container.get(SqliteCategoryRepository);
  });

  describe("save and findById", () => {
    it("should save and retrieve a category", async () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
        color: Color.create("#FF0000"),
        icon: Icon.create("briefcase"),
      });

      await repository.save(category);

      const found = await repository.findById(category.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(category.id);
      expect(found?.name.value).toBe("Work");
      expect(found?.color?.value).toBe("#ff0000");
      expect(found?.icon?.value).toBe("briefcase");
    });

    it("should update existing category on save", async () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
      });

      await repository.save(category);

      category.setName(CategoryName.create("Personal"));
      await repository.save(category);

      const found = await repository.findById(category.id);

      expect(found?.name.value).toBe("Personal");
    });
  });

  describe("find", () => {
    it("should return all categories", async () => {
      const cat1 = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
      });
      const cat2 = new Category({
        name: CategoryName.create("Personal"),
        createdAt: DateTime.create(Date.now()),
      });

      await repository.save(cat1);
      await repository.save(cat2);

      const all = await repository.findAll();

      expect(all.length).toBe(2);
    });

    it("should filter categories by specification", async () => {
      const cat1 = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
      });
      const cat2 = new Category({
        name: CategoryName.create("Personal"),
        createdAt: DateTime.create(Date.now()),
      });

      await repository.save(cat1);
      await repository.save(cat2);

      const spec = new CategoryNameMatchesSpec("Work");
      const filtered = await repository.findManyBySpec(spec);

      expect(filtered.length).toBe(1);
      expect(filtered[0]!.name.value).toBe("Work");
    });
  });

  describe("findOne", () => {
    it("should return first category matching specification", async () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
      });

      await repository.save(category);

      const spec = new CategoryNameMatchesSpec("Work");
      const found = await repository.findOneBySpec(spec);

      expect(found).not.toBeNull();
      expect(found?.name.value).toBe("Work");
    });

    it("should return null when no category matches", async () => {
      const spec = new CategoryNameMatchesSpec("NonExistent");
      const found = await repository.findOneBySpec(spec);

      expect(found).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a category by id", async () => {
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
      });

      await repository.save(category);
      await repository.delete(category.id);

      const found = await repository.findById(category.id);

      expect(found).toBeNull();
    });
  });

  describe("count", () => {
    it("should return correct count of categories", async () => {
      expect(await repository.count()).toBe(0);

      const cat1 = new Category({
        name: CategoryName.create("Work"),
        createdAt: DateTime.create(Date.now()),
      });
      const cat2 = new Category({
        name: CategoryName.create("Personal"),
        createdAt: DateTime.create(Date.now()),
      });

      await repository.save(cat1);
      expect(await repository.count()).toBe(1);

      await repository.save(cat2);
      expect(await repository.count()).toBe(2);
    });
  });
});
