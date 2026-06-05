import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerAccountsTable = pgTable("provider_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  environment: text("environment").notNull().default("sandbox"),
  status: text("status").notNull().default("active"),
  priority: integer("priority").default(1),
  supportedMethods: text("supported_methods").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProviderAccountSchema = createInsertSchema(providerAccountsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertProviderAccount = z.infer<typeof insertProviderAccountSchema>;
export type ProviderAccount = typeof providerAccountsTable.$inferSelect;
