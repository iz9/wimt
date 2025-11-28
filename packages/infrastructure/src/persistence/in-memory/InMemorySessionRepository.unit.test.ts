import "reflect-metadata";

import { Container } from "inversify";

import type { ISessionRepository } from "@wimt/domain/repositories";
import type { ITimeService } from "@wimt/domain/shared";

import { Session } from "@wimt/domain/aggregates";
import { SessionSegment } from "@wimt/domain/entities";
import { SessionRepositorySymbol } from "@wimt/domain/repositories";
import { TimeServiceSymbol } from "@wimt/domain/shared";
import {
  ActiveSessionSpec,
  StoppedSessionSpec,
  SessionForCategorySpec,
  CompositeSpecification,
} from "@wimt/domain/specifications";
import { makeId } from "@wimt/domain/valueObjects";

import { TimeService } from "../../services/time/TimeService";
import { InMemorySessionRepository } from "./InMemorySessionRepository";

class IdSpec extends CompositeSpecification<Session> {
  constructor(private readonly id: string) {
    super();
  }

  isSatisfiedBy(candidate: Session): boolean {
    return candidate.id === this.id;
  }
}

describe("InMemorySessionRepository", () => {
  let container: Container;
  let repository: ISessionRepository;
  let time: ITimeService;

  beforeEach(() => {
    container = new Container();
    container
      .bind<ISessionRepository>(SessionRepositorySymbol)
      .to(InMemorySessionRepository);
    container.bind<ITimeService>(TimeServiceSymbol).to(TimeService);
    repository = container.get<ISessionRepository>(SessionRepositorySymbol);
    time = container.get<ITimeService>(TimeServiceSymbol);
  });

  it("should save and find a session", async () => {
    const session = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session);

    const found = await repository.findById(session.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(session.id);
  });

  it("should return null if session not found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await repository.findById("non-existent" as any);

    expect(found).toBeNull();
  });

  it("should delete a session", async () => {
    const session = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session);
    await repository.delete(session.id);

    const found = await repository.findById(session.id);

    expect(found).toBeNull();
  });

  it("should count sessions", async () => {
    const session1 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });
    const session2 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session1);
    await repository.save(session2);

    const count = await repository.count();

    expect(count).toBe(2);
  });

  it("should find all sessions", async () => {
    const session1 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });
    const session2 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session1);
    await repository.save(session2);

    const all = await repository.findAll();

    expect(all.length).toBe(2);
  });

  it("should find by ActiveSessionSpec", async () => {
    const activeSession = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    const now = time.now();
    const stoppedSession = new Session({
      categoryId: makeId(),
      createdAt: now,
      activeSegment: null,
      history: [
        new SessionSegment({
          startedAt: now,
          stoppedAt: now.add(60, "second"),
        }),
      ],
      stoppedAt: now.add(60, "second"),
    });

    await repository.save(activeSession);
    await repository.save(stoppedSession);

    const spec = new ActiveSessionSpec();
    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(1);
    expect(found[0]?.id).toBe(activeSession.id);
    expect(found[0]?.state).toBe("active");
  });

  it("should find by StoppedSessionSpec", async () => {
    const activeSession = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    const now = time.now();
    const stoppedSession = new Session({
      categoryId: makeId(),
      createdAt: now,
      activeSegment: null,
      history: [
        new SessionSegment({
          startedAt: now,
          stoppedAt: now.add(60, "second"),
        }),
      ],
      stoppedAt: now.add(60, "second"),
    });

    await repository.save(activeSession);
    await repository.save(stoppedSession);

    const spec = new StoppedSessionSpec();
    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(1);
    expect(found[0]?.id).toBe(stoppedSession.id);
    expect(found[0]?.state).toBe("stopped");
  });

  it("should find by SessionForCategorySpec", async () => {
    const categoryId1 = makeId();
    const categoryId2 = makeId();

    const session1 = new Session({
      categoryId: categoryId1,
      createdAt: time.now(),
    });
    const session2 = new Session({
      categoryId: categoryId2,
      createdAt: time.now(),
    });
    const session3 = new Session({
      categoryId: categoryId1,
      createdAt: time.now(),
    });

    await repository.save(session1);
    await repository.save(session2);
    await repository.save(session3);

    const spec = new SessionForCategorySpec(categoryId1);
    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(2);
    expect(found.every((s) => s.categoryId === categoryId1)).toBe(true);
  });

  it("should find one by specification", async () => {
    const categoryId = makeId();
    const session1 = new Session({
      categoryId: categoryId,
      createdAt: time.now(),
    });
    const session2 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session1);
    await repository.save(session2);

    const spec = new SessionForCategorySpec(categoryId);
    const found = await repository.findOneBySpec(spec);

    expect(found).toBeDefined();
    expect(found?.id).toBe(session1.id);
  });

  it("should return null when findOneBySpec finds no match", async () => {
    const spec = new SessionForCategorySpec(makeId());
    const found = await repository.findOneBySpec(spec);

    expect(found).toBeNull();
  });

  it("should find many by composite AND specification", async () => {
    const categoryId = makeId();
    const activeSession1 = new Session({
      categoryId: categoryId,
      createdAt: time.now(),
    });

    const activeSession2 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    const now = time.now();
    const stoppedSession = new Session({
      categoryId: categoryId,
      createdAt: now,
      activeSegment: null,
      history: [
        new SessionSegment({
          startedAt: now,
          stoppedAt: now.add(60, "second"),
        }),
      ],
      stoppedAt: now.add(60, "second"),
    });

    await repository.save(activeSession1);
    await repository.save(activeSession2);
    await repository.save(stoppedSession);

    const spec = new SessionForCategorySpec(categoryId).and(
      new ActiveSessionSpec(),
    );

    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(1);
    expect(found[0]?.id).toBe(activeSession1.id);
  });

  it("should find many by composite OR specification", async () => {
    const categoryId = makeId();
    const session1 = new Session({
      categoryId: categoryId,
      createdAt: time.now(),
    });
    const session2 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });
    const session3 = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session1);
    await repository.save(session2);
    await repository.save(session3);

    const spec1 = new SessionForCategorySpec(categoryId);
    const spec2 = new IdSpec(session2.id);

    const spec = spec1.or(spec2);

    const found = await repository.findManyBySpec(spec);

    expect(found.length).toBe(2);

    const foundByCategoryId = found.find((session) =>
      spec1.isSatisfiedBy(session),
    );
    const foundById = found.find((session) => spec2.isSatisfiedBy(session));

    expect(foundByCategoryId?.id).toBe(session1.id);
    expect(foundById?.id).toBe(session2.id);
  });

  it("should update existing session on save", async () => {
    const session = new Session({
      categoryId: makeId(),
      createdAt: time.now(),
    });

    await repository.save(session);

    // Pause the session
    const pauseTime = time.now().add(60, "second");

    session.pause(pauseTime);

    await repository.save(session);

    const found = await repository.findById(session.id);

    expect(found?.state).toBe("paused");
  });
});
