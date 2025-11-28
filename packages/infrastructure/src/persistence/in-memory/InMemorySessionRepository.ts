import { Session } from "@wimt/domain/aggregates";
import type { ISessionRepository } from "@wimt/domain/repositories";
import type { Specification } from "@wimt/domain/specifications";
import type { ULID } from "@wimt/domain/valueObjects";
import { injectable } from "inversify";

@injectable()
export class InMemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, Session> = new Map();

  async findManyBySpec(spec: Specification<Session>): Promise<Session[]> {
    const all = Array.from(this.sessions.values());
    return all.filter((session) => spec.isSatisfiedBy(session));
  }

  async findOneBySpec(spec: Specification<Session>): Promise<Session | null> {
    const all = Array.from(this.sessions.values());
    return all.find((session) => spec.isSatisfiedBy(session)) || null;
  }

  async findAll(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(id: ULID): Promise<void> {
    this.sessions.delete(id);
  }

  async findById(id: ULID): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async count(): Promise<number> {
    return this.sessions.size;
  }
}
