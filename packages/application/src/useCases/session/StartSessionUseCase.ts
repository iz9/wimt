import "reflect-metadata";

import { isNull, invariant } from "es-toolkit";
import { inject, injectable } from "inversify";

import { Session } from "@wimt/domain/aggregates";
import {
  CategoryRepositorySymbol,
  type ICategoryRepository,
  type ISessionRepository,
  SessionRepositorySymbol,
} from "@wimt/domain/repositories";
import { type ITimeService, TimeServiceSymbol } from "@wimt/domain/shared";
import { ActiveSessionSpec } from "@wimt/domain/specifications";
import { DateTime } from "@wimt/domain/valueObjects";

import type { StartSessionCommand, StartSessionResult } from "../../commands";

import { ActiveSessionExistsAlreadyError } from "../../errors";
import { DomainEventPublisher } from "../../services";

/**
 * Use Case: Start a new time tracking session
 *
 * Business Rules:
 * - Only one active session allowed at a time
 * - Category must exist
 * - Session starts with one active segment
 *
 * Domain Events Emitted:
 * - SessionStartedEvent
 */
@injectable()
export class StartSessionUseCase {
  constructor(
    @inject(SessionRepositorySymbol) private sessionRepo: ISessionRepository,
    @inject(CategoryRepositorySymbol) private categoryRepo: ICategoryRepository,
    @inject(DomainEventPublisher) private eventPublisher: DomainEventPublisher,
    @inject(TimeServiceSymbol) private timeService: ITimeService,
  ) {}

  async execute(command: StartSessionCommand): Promise<StartSessionResult> {
    // 1. Validate category exists
    const category = await this.categoryRepo.findById(command.categoryId);

    if (!category) {
      throw new Error(`Category with id ${command.categoryId} not found`);
    }

    // 2. Check for existing active session
    const existingActiveSession = await this.sessionRepo.findOneBySpec(
      new ActiveSessionSpec(),
    );

    invariant(
      isNull(existingActiveSession),
      new ActiveSessionExistsAlreadyError(),
    );

    // 3. Create new session (domain logic)
    const session = new Session({
      categoryId: command.categoryId,
      createdAt: this.timeService.now(),
    });

    // 4. Persist session
    await this.sessionRepo.save(session);

    // 5. Publish domain events
    const events = session.pullDomainEvents();

    await this.eventPublisher.publishAll(events);

    // 6. Return result DTO
    return {
      sessionId: session.id,
      startedAt: session.createdAt.value,
    };
  }
}
