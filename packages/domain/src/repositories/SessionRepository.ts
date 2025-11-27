import { Session } from "../aggregate/Session";
import { Specification } from "../specifications";
import { ULID } from "../valueObjects/ulid";

export interface ISessionRepository {
  // spec is optional. If not provided, returns all sessions
  find(spec: Specification<Session>): Promise<Session[]>;
  findOne(spec: Specification<Session>): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(id: ULID): Promise<void>;
  findById(id: ULID): Promise<Session | null>;
  count(): Promise<number>;
}
