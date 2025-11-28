import "reflect-metadata";

import { Container } from "inversify";

import type { ICategoryRepository } from "@wimt/domain/repositories";
import type { ITimeService } from "@wimt/domain/shared";

import { Category } from "@wimt/domain/aggregates";
import { CategoryRepositorySymbol } from "@wimt/domain/repositories";
import { TimeServiceSymbol } from "@wimt/domain/shared";
import {
  CategoryNameMatchesSpec,
  CompositeSpecification,
} from "@wimt/domain/specifications";
import { CategoryName } from "@wimt/domain/valueObjects";

import { TimeService } from "../../time/TimeService";
import { InMemoryCategoryRepository } from "./InMemoryCategoryRepository";

class IdSpec extends CompositeSpecification<Category> {
  constructor(private readonly id: string) {
    super();
  }

  isSatisfiedBy(candidate: Category): boolean {
    return candidate.id === this.id;
  }
}

describe("InMemoryCategoryRepository", () => {
  let container: Container;
  let repository: ICategoryRepository;
  let time: ITimeService;

  beforeEach(() => {
    container = new Container();
    container
      .bind<ICategoryRepository>(CategoryRepositorySymbol)
      .to(InMemoryCategoryRepository);
    container.bind<ITimeService>(TimeServiceSymbol).to(TimeService);
    repository = container.get<ICategoryRepository>(CategoryRepositorySymbol);
    time = container.get<ITimeService>(TimeServiceSymbol);
  });

  it("should save and find a category", async () => {
    const category = new Category({
      name: CategoryName.create("Test Category"),
      createdAt: time.now(),
    });

    await repository.save(category);

    const found = await repository.findById(category.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(category.id);
  });

  it("should return null if category not found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await repository.findById("non-existent" as any);

    expect(found).toBeNull();
  });

  it("should delete a category", async () => {
    const category = new Category({
      name: CategoryName.create("Test Category"),
      createdAt: time.now(),
    });

    await repository.save(category);
    await repository.delete(category.id);

    const found = await repository.findById(category.id);

    expect(found).toBeNull();
  });

  it("should count categories", async () => {
    const category1 = new Category({
      name: CategoryName.create("Test Category 1"),
      createdAt: time.now(),
    });
    const category2 = new Category({
      name: CategoryName.create("Test Category 2"),
      createdAt: time.now(),
    });

    await repository.save(category1);
    await repository.save(category2);

    const count = await repository.count();

    expect(count).toBe(2);
  });

  it("should find by specification", async () => {
    const category1 = new Category({
      name: CategoryName.create("Test Category 1"),
      createdAt: time.now(),
    });
    const category2 = new Category({
      name: CategoryName.create("Test Category 2"),
      createdAt: time.now(),
    });

    await repository.save(category1);
    await repository.save(category2);

    const spec = new CategoryNameMatchesSpec("Test Category 1");
    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(1);
    expect(found[0]?.id).toBe(category1.id);
  });

  it("should find one by specification", async () => {
    const category1 = new Category({
      name: CategoryName.create("Test Category 1"),
      createdAt: time.now(),
    });
    const category2 = new Category({
      name: CategoryName.create("Test Category 2"),
      createdAt: time.now(),
    });

    await repository.save(category1);
    await repository.save(category2);

    const spec = new CategoryNameMatchesSpec("Test Category 2");
    const found = await repository.findOneBySpec(spec);

    expect(found).toBeDefined();
    expect(found?.id).toBe(category2.id);
  });

  it("should find many by composite OR specification", async () => {
    const category1 = new Category({
      name: CategoryName.create("Test Category 1"),
      createdAt: time.now(),
    });
    const category2 = new Category({
      name: CategoryName.create("Test Category 2"),
      createdAt: time.now(),
    });

    const category3 = new Category({
      name: CategoryName.create("Test Category 3"),
      createdAt: time.now(),
    });

    await repository.save(category1);
    await repository.save(category2);
    await repository.save(category3);

    const spec1 = new CategoryNameMatchesSpec("Test Category 1");
    const spec2 = new IdSpec(category2.id).and(
      new CategoryNameMatchesSpec(category2.name.value),
    );

    const spec = spec1.or(spec2);

    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(2);

    const foundByName = found.find((category) => spec1.isSatisfiedBy(category));
    const foundById = found.find((category) => spec2.isSatisfiedBy(category));

    expect(foundByName?.id).toBe(category1.id);
    expect(foundById?.id).toBe(category2.id);
  });
});
