import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceSystemId: uuid("source_system_id"),
  customerId: uuid("customer_id"),
  provider: text("provider").notNull().default("asaas"),
  providerPaymentId: text("provider_payment_id"),
  providerStatus: text("provider_status"),
  status: text("status").notNull().default("pending"),
  externalReference: text("external_reference"),
  idempotencyKey: text("idempotency_key"),
  amount: integer("amount").notNull(),
  grossAmount: integer("gross_amount"),
  providerFee: integer("provider_fee"),
  platformFee: integer("platform_fee"),
  netAmount: integer("net_amount"),
  currency: text("currency").notNull().default("BRL"),
  paymentMethod: text("payment_method").notNull(),
  description: text("description"),
  installments: integer("installments"),
  qrCode: text("qr_code"),
  qrCodeBase64: text("qr_code_base64"),
  copyPaste: text("copy_paste"),
  boletoUrl: text("boleto_url"),
  boletoBarcode: text("boleto_barcode"),
  boletoDIgitableLine: text("boleto_digitable_line"),
  paymentLinkUrl: text("payment_link_url"),
  checkoutUrl: text("checkout_url"),
  sourceSystem: text("source_system").notNull(),
  callbackUrl: text("callback_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  dueDate: text("due_date"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
