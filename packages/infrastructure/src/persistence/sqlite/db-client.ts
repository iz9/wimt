import type { SQLiteDatabase } from "expo-sqlite";
import type { Database } from "sql.js";

import { drizzle as drizzleExpo } from "drizzle-orm/expo-sqlite";
import { drizzle as drizzleSqlJs } from "drizzle-orm/sql-js";

import * as schema from "./schema";

export type DbClient =
  | ReturnType<typeof createExpoDbClient>
  | ReturnType<typeof createSqlJsDbClient>;

/**
 * Create a drizzle client for React Native using expo-sqlite
 */
export function createExpoDbClient(expoDb: SQLiteDatabase) {
  return drizzleExpo(expoDb, { schema });
}

/**
 * Create a drizzle client for web using sql.js
 */
export function createSqlJsDbClient(sqlJsDb: Database) {
  return drizzleSqlJs(sqlJsDb, { schema });
}
