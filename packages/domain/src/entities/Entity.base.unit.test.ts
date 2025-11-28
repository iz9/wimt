import { EntityBase } from "./Entity.base";

describe("EntityBase", () => {
  it("should create entity with id", () => {
    const entity = new EntityBase();

    expect(entity.id).toBeDefined();
  });

  it("should not allow to change id", () => {
    const entity = new EntityBase();

    // @ts-expect-error this on purpose
    expect(() => (entity.id = "123")).toThrow();
  });
});
