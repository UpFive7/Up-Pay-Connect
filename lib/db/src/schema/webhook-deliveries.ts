import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const webhookDeliveriesTable = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id"),
  sourceSystemId: uuid("source_system_id"),
  event: text("event").notNull(),
  url: text("url").notNull(),
  payload: jsonb("payload"),
  headers: jsonb("headers"),
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveriesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
