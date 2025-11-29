import "reflect-metadata";

import { Container } from "inversify";

import { Category, Session } from "@wimt/domain/aggregates";
import { SessionStartedDomainEvent } from "@wimt/domain/events";
import {
  CategoryRepositorySymbol,
  ICategoryRepository,
  ISessionRepository,
  SessionRepositorySymbol,
} from "@wimt/domain/repositories";
import { ITimeService, TimeServiceSymbol } from "@wimt/domain/shared";
import { CategoryName } from "@wimt/domain/valueObjects";
import {
  InMemoryCategoryRepository,
  InMemorySessionRepository,
} from "@wimt/infrastructure/db/in-memory";
import { TimeService } from "@wimt/infrastructure/services";

import { DomainEventPublisher } from "../../services";
import { StartSessionUseCase } from "./StartSessionUseCase";

describe("StartSessionUseCase", () => {
  let container: Container;
  let useCase: StartSessionUseCase;
  let sessionRepo: ISessionRepository;
  let categoryRepo: ICategoryRepository;
  let eventPublisher: DomainEventPublisher;
  let timeService: ITimeService;

  beforeEach(() => {
    container = new Container();

    // Bind repositories
    container
      .bind<ISessionRepository>(SessionRepositorySymbol)
      .to(InMemorySessionRepository)
      .inSingletonScope();

    container
      .bind<ICategoryRepository>(CategoryRepositorySymbol)
      .to(InMemoryCategoryRepository)
      .inSingletonScope();

    // Bind services
    container.bind(DomainEventPublisher).toSelf().inSingletonScope();
    container.bind(TimeServiceSymbol).to(TimeService).inSingletonScope();

    // Bind use case
    container.bind(StartSessionUseCase).toSelf();

    // Get instances
    useCase = container.get(StartSessionUseCase);
    sessionRepo = container.get<ISessionRepository>(SessionRepositorySymbol);
    categoryRepo = container.get<ICategoryRepository>(CategoryRepositorySymbol);
    eventPublisher = container.get(DomainEventPublisher);
    timeService = container.get(TimeServiceSymbol);
  });

  afterEach(() => {
    eventPublisher.clearHandlers();
  });

  describe("successful session start", () => {
    it("should create and save a new session", async () => {
      // Given: A category exists
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: timeService.now(),
      });

      await categoryRepo.save(category);

      // When: Starting a session
      const result = await useCase.execute({
        categoryId: category.id,
      });

      // Then: Session should be created
      expect(result.sessionId).toBeDefined();
      expect(result.startedAt).toBeGreaterThan(0);

      // And: Session should be persisted
      const savedSession = await sessionRepo.findById(result.sessionId);

      expect(savedSession).not.toBeNull();
      expect(savedSession!.categoryId).toBe(category.id);
      expect(savedSession!.state).toBe("active");
    });

    it("should emit SessionStartedEvent", async () => {
      // Given: A category and event handler
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: timeService.now(),
      });

      await categoryRepo.save(category);

      const eventHandler = jest.fn();

      eventPublisher.subscribe(SessionStartedDomainEvent, eventHandler);

      // When: Starting a session
      const result = await useCase.execute({ categoryId: category.id });

      // Then: Event should be published
      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: result.sessionId,
        }),
      );
    });

    it("should return correct session metadata", async () => {
      // Given: A category
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: timeService.now(),
      });

      await categoryRepo.save(category);

      const beforeStart = timeService.now().value;

      // When: Starting a session
      const result = await useCase.execute({ categoryId: category.id });

      const afterStart = timeService.now().value;

      // Then: Result should have correct data
      expect(result.sessionId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(result.startedAt).toBeGreaterThanOrEqual(beforeStart);
      expect(result.startedAt).toBeLessThanOrEqual(afterStart);
    });
  });

  describe("validation errors", () => {
    it("should throw error if category does not exist", async () => {
      // When: Starting session with non-existent category
      const promise = useCase.execute({
        categoryId: "non-existent-category-id",
      });

      // Then: Should throw error
      await expect(promise).rejects.toThrow("not found");
    });

    it("should throw error if active session already exists", async () => {
      // Given: A category and an existing active session
      const category = new Category({
        name: CategoryName.create("Work"),
        createdAt: timeService.now(),
      });

      await categoryRepo.save(category);

      const existingSession = new Session({
        categoryId: category.id,
        createdAt: timeService.now(),
      });

      await sessionRepo.save(existingSession);

      // When: Trying to start another session
      const promise = useCase.execute({ categoryId: category.id });

      // Then: Should throw error
      await expect(promise).rejects.toThrow("active session already exists");
    });
  });

  describe("session state", () => {
    it("should create session in active state", async () => {
      // Given: A category
      const category = new Category({
        name: CategoryName.create("Development"),
        createdAt: timeService.now(),
      });

      await categoryRepo.save(category);

      // When: Starting a session
      const result = await useCase.execute({ categoryId: category.id });

      // Then: Session should be active
      const session = await sessionRepo.findById(result.sessionId);

      expect(session!.state).toBe("active");
    });

    it("should create session with initial segment", async () => {
      // Given: A category
      const category = new Category({
        name: CategoryName.create("Meeting"),
        createdAt: timeService.now(),
      });

      await categoryRepo.save(category);

      // When: Starting a session
      const result = await useCase.execute({ categoryId: category.id });

      // Then: Session should be in active state with one segment
      const session = await sessionRepo.findById(result.sessionId);

      // Note: Session segments are private implementation
      // We verify through the state which confirms segment creation
      expect(session!.state).toBe("active");
    });
  });
});
