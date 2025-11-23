import { ulid as generateULID } from "ulid";

export type ULID = string;

/**
 * lightweight wrapper around ulid generator
 */
export const makeId = (): ULID => generateULID();
