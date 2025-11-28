import { ulid as generateULID, ULID as ULID_BASE } from "ulid";

export type ULID = ULID_BASE;

/**
 * lightweight wrapper around ulid generator
 */
export const makeId = (): ULID => generateULID();
