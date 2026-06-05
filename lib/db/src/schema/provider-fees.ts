import { pgTable, text, integer, timestamp, uuid, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerFeesTable = pgTable("provider_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  paymentMethod: text("payment_method").notNull(),
  feeType: text("fee_type").notNull().default("percentage"),
  fixedAmount: integer("fixed_amount"),
  percentageRate: real("percentage_rate"),
  settlementDays: integer("settlement_days"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProviderFeeSchema = createInsertSchema(providerFeesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertProviderFee = z.infer<typeof insertProviderFeeSchema>;
export type ProviderFee = typeof providerFeesTable.$inferSelect;
