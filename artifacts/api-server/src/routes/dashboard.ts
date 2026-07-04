import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, webhookDeliveriesTable, subscriptionsTable } from "@workspace/db";
import { sql, eq, gte, and } from "drizzle-orm";
import { requireSession } from "../middlewares/apiKeyAuth.js";

const router = Router();

router.get("/summary", requireSession, async (req, res): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayReceived] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}),0)` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.paidAt, today)));

    const [pending] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}),0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"));

    const [paidMonth] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}),0)` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.status, "paid"), gte(paymentsTable.paidAt, monthStart)));

    const [failed] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}),0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "failed"));

    const [fees] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.providerFee}),0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "paid"));

    const [net] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.netAmount}),0)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "paid"));

    const [webhookErrors] = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookDeliveriesTable)
      .where(eq(webhookDeliveriesTable.status, "failed"));

    const [activeSubs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"));

    res.json({
      total_received_today: Number(todayReceived.total),
      total_pending: Number(pending.total),
      total_paid_month: Number(paidMonth.total),
      total_failed: Number(failed.total),
      total_provider_fees: Number(fees.total),
      total_net_amount: Number(net.total),
      webhooks_with_error: Number(webhookErrors.count),
      active_subscriptions: Number(activeSubs.count),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payment-methods", requireSession, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        method: paymentsTable.paymentMethod,
        count: sql<number>`count(*)`,
        total_amount: sql<number>`coalesce(sum(${paymentsTable.amount}),0)`,
      })
      .from(paymentsTable)
      .groupBy(paymentsTable.paymentMethod);

    res.json(rows.map((r) => ({ method: r.method, count: Number(r.count), total_amount: Number(r.total_amount) })));
  } catch (err) {
    req.log.error({ err }, "Error getting payment methods breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/providers", requireSession, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        provider: paymentsTable.provider,
        count: sql<number>`count(*)`,
        total_amount: sql<number>`coalesce(sum(${paymentsTable.amount}),0)`,
      })
      .from(paymentsTable)
      .groupBy(paymentsTable.provider);

    res.json(rows.map((r) => ({ provider: r.provider, count: Number(r.count), total_amount: Number(r.total_amount) })));
  } catch (err) {
    req.log.error({ err }, "Error getting providers breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/systems", requireSession, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        source_system: paymentsTable.sourceSystem,
        count: sql<number>`count(*)`,
        total_amount: sql<number>`coalesce(sum(${paymentsTable.amount}),0)`,
      })
      .from(paymentsTable)
      .groupBy(paymentsTable.sourceSystem);

    res.json(rows.map((r) => ({ source_system: r.source_system, count: Number(r.count), total_amount: Number(r.total_amount) })));
  } catch (err) {
    req.log.error({ err }, "Error getting systems breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recent-transactions", requireSession, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(paymentsTable)
      .orderBy(sql`${paymentsTable.createdAt} desc`)
      .limit(10);

    res.json(rows.map(mapPayment));
  } catch (err) {
    req.log.error({ err }, "Error getting recent transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/daily-volume", requireSession, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        date: sql<string>`date(${paymentsTable.createdAt})`,
        count: sql<number>`count(*)`,
        total_amount: sql<number>`coalesce(sum(${paymentsTable.amount}),0)`,
      })
      .from(paymentsTable)
      .where(gte(paymentsTable.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      .groupBy(sql`date(${paymentsTable.createdAt})`)
      .orderBy(sql`date(${paymentsTable.createdAt})`);

    res.json(rows.map((r) => ({ date: r.date, count: Number(r.count), total_amount: Number(r.total_amount) })));
  } catch (err) {
    req.log.error({ err }, "Error getting daily volume");
    res.status(500).json({ error: "Internal server error" });
  }
});

function mapPayment(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id,
    source_system_id: p.sourceSystemId,
    customer_id: p.customerId,
    provider: p.provider,
    provider_payment_id: p.providerPaymentId,
    status: p.status,
    external_reference: p.externalReference,
    amount: p.amount,
    gross_amount: p.grossAmount,
    provider_fee: p.providerFee,
    net_amount: p.netAmount,
    currency: p.currency,
    payment_method: p.paymentMethod,
    description: p.description,
    installments: p.installments,
    qr_code: p.qrCode,
    qr_code_base64: p.qrCodeBase64,
    copy_paste: p.copyPaste,
    boleto_url: p.boletoUrl,
    boleto_barcode: p.boletoBarcode,
    boleto_digitable_line: p.boletoDIgitableLine,
    payment_link_url: p.paymentLinkUrl,
    checkout_url: p.checkoutUrl,
    source_system: p.sourceSystem,
    callback_url: p.callbackUrl,
    expires_at: p.expiresAt?.toISOString() ?? null,
    due_date: p.dueDate,
    paid_at: p.paidAt?.toISOString() ?? null,
    cancelled_at: p.cancelledAt?.toISOString() ?? null,
    refunded_at: p.refundedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt?.toISOString() ?? null,
  };
}

export { mapPayment };
export default router;
