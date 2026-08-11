import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const musicLibraries = sqliteTable("music_libraries", {
  ownerId: text("owner_id").primaryKey(),
  accountEmail: text("account_email"),
  accountName: text("account_name"),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});
