import { Session } from "../aggregate";
import { Specification } from "../specifications";
import { ULID } from "../valueObjects";

export interface ISessionRepository {
  findManyBySpec(spec: Specification<Session>): Promise<Session[]>;
  findOneBySpec(spec: Specification<Session>): Promise<Session | null>;
  findAll(): Promise<Session[]>;
  findById(id: ULID): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(id: ULID): Promise<void>;
  count(): Promise<number>;
}

export const SessionRepositorySymbol = Symbol.for("SessionRepository");
