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
