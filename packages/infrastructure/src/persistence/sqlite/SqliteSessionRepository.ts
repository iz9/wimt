import { eq } from "drizzle-orm";
import { injectable, inject } from "inversify";

import type { ISessionRepository } from "@wimt/domain/repositories";
import type { Specification } from "@wimt/domain/specifications";

import { Session } from "@wimt/domain/aggregates";
import { type ULID } from "@wimt/domain/valueObjects";

import type { DbClient } from "./db-client";

import { DbClientSymbol } from "./db-client";
import { SessionMapper } from "./mappers/SessionMapper";
import { sessions, sessionSegments } from "./schema";

@injectable()
export class SqliteSessionRepository implements ISessionRepository {
  private mapper = new SessionMapper();

  constructor(@inject(DbClientSymbol) private db: DbClient) {}

  async count(): Promise<number> {
    const result = await this.db.select().from(sessions);

    return result.length;
  }

  async delete(id: ULID): Promise<void> {
    // Delete segments first (foreign key constraint)
    await this.db
      .delete(sessionSegments)
      .where(eq(sessionSegments.sessionId, id));

    // Delete session
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async findAll(): Promise<Session[]> {
    const sessionRows = await this.db.select().from(sessions);

    // Load all sessions with their segments
    const sessionsWithSegments = await Promise.all(
      sessionRows.map(async (sessionRow) => {
        const segmentRows = await this.db
          .select()
          .from(sessionSegments)
          .where(eq(sessionSegments.sessionId, sessionRow.id));

        return this.mapper.toDomain(sessionRow, segmentRows);
      }),
    );

    return sessionsWithSegments;
  }

  async findById(id: ULID): Promise<Session | null> {
    const sessionRows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (sessionRows.length === 0) {
      return null;
    }

    const sessionRow = sessionRows[0]!;

    // Load segments for this session
    const segmentRows = await this.db
      .select()
      .from(sessionSegments)
      .where(eq(sessionSegments.sessionId, id));

    return this.mapper.toDomain(sessionRow, segmentRows);
  }

  async findManyBySpec(spec: Specification<Session>): Promise<Session[]> {
    const allSessions = await this.findAll();

    return allSessions.filter((session) => spec.isSatisfiedBy(session));
  }

  async findOneBySpec(spec: Specification<Session>): Promise<Session | null> {
    const allSessions = await this.findAll();

    return allSessions.find((session) => spec.isSatisfiedBy(session)) || null;
  }

  async save(session: Session): Promise<void> {
    const sessionRow = this.mapper.sessionToPersistence(session);
    const allSegments = this.mapper.getAllSegments(session);

    // Check if session exists
    const existing = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id))
      .limit(1);

    // Save or update session
    if (existing.length > 0) {
      await this.db
        .update(sessions)
        .set(sessionRow)
        .where(eq(sessions.id, session.id));
    } else {
      await this.db.insert(sessions).values(sessionRow);
    }

    // Delete old segments and insert new ones
    // This is a simple approach - delete all and re-insert
    await this.db
      .delete(sessionSegments)
      .where(eq(sessionSegments.sessionId, session.id));

    // Insert all segments
    if (allSegments.length > 0) {
      const segmentRows = allSegments.map((segment) =>
        this.mapper.segmentToPersistence(segment, session.id),
      );

      await this.db.insert(sessionSegments).values(segmentRows);
    }
  }
}
