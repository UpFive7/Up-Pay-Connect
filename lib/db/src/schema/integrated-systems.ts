import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const integratedSystemsTable = pgTable("integrated_systems", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  defaultWebhookUrl: text("default_webhook_url"),
  allowedIps: text("allowed_ips"),
  environment: text("environment").notNull().default("sandbox"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIntegratedSystemSchema = createInsertSchema(integratedSystemsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertIntegratedSystem = z.infer<typeof insertIntegratedSystemSchema>;
export type IntegratedSystem = typeof integratedSystemsTable.$inferSelect;
