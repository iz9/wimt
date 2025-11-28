import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  color: text("color"),
  icon: text("icon"),
});

// What you select from database
export type CategoryRow = typeof categories.$inferSelect;

// What you insert into database
export type NewCategoryRow = typeof categories.$inferInsert;

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }),
  activeSegmentId: text("active_segment_id"),
});

export type NewSessionRow = typeof sessions.$inferInsert;

export type SessionRow = typeof sessions.$inferSelect;

export const sessionSegments = sqliteTable("session_segments", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }),
});

export type NewSessionSegmentRow = typeof sessionSegments.$inferInsert;

export type SessionSegmentRow = typeof sessionSegments.$inferSelect;
