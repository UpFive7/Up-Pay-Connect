import { Router } from "express";
import { db } from "@workspace/db";
import { webhookDeliveriesTable, paymentsTable, paymentEventsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { registerWebhook, getWebhookConfig, AsaasError } from "../lib/asaas.js";
import crypto from "crypto";

const router = Router();

// ─── Internal status mapping ──────────────────────────────────────────────────

const ASAAS_EVENT_TO_STATUS: Record<string, string | null> = {
  PAYMENT_RECEIVED: "paid",
  PAYMENT_CONFIRMED: "paid",
  PAYMENT_OVERDUE: "expired",
  PAYMENT_DELETED: "cancelled",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_AWAITING_APPROVAL: "processing",
  PAYMENT_RESTORED: "pending",
  PAYMENT_BANK_SLIP_VIEWED: null,      // no status change — just log
  PAYMENT_CHECKOUT_VIEWED: null,
  PAYMENT_CHARGEBACK_REQUESTED: "processing",
  PAYMENT_CHARGEBACK_DISPUTE: "processing",
  PAYMENT_DUNNING_RECEIVED: "paid",
  PAYMENT_DUNNING_REQUESTED: "processing",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapDelivery(d: typeof webhookDeliveriesTable.$inferSelect) {
  return {
    id: d.id,
    payment_id: d.paymentId,
    source_system_id: d.sourceSystemId,
    event: d.event,
    url: d.url,
    http_status: d.httpStatus,
    attempts: d.attempts,
    status: d.status,
    next_retry_at: d.nextRetryAt?.toISOString() ?? null,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt?.toISOString() ?? null,
  };
}

function getPublicUrl(): string {
  const domains = process.env.REPLIT_DOMAINS ?? "";
  const first = domains.split(",")[0]?.trim();
  if (first) return `https://${first}`;
  return "https://localhost";
}

// ─── Asaas webhook receiver (public — no session auth) ───────────────────────

router.post("/asaas", async (req, res): Promise<void> => {
  try {
    // Optional token verification
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken) {
      const incoming = req.headers["asaas-access-token"] as string | undefined;
      if (!incoming || incoming !== expectedToken) {
        req.log.warn({ url: req.url }, "Asaas webhook: invalid token");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    const body = req.body as {
      event?: string;
      payment?: {
        id?: string;
        status?: string;
        value?: number;
        netValue?: number;
      };
    };

    const { event, payment: asaasPayment } = body;

    if (!event || !asaasPayment?.id) {
      res.status(400).json({ error: "Missing event or payment.id" });
      return;
    }

    req.log.info({ event, providerPaymentId: asaasPayment.id }, "Asaas webhook received");

    // Find our payment by provider payment ID
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.providerPaymentId, asaasPayment.id));

    if (!payment) {
      req.log.warn({ providerPaymentId: asaasPayment.id }, "Asaas webhook: payment not found");
      // Return 200 so Asaas doesn't keep retrying for unknown payments
      res.json({ received: true, matched: false });
      return;
    }

    // Log delivery
    await db.insert(webhookDeliveriesTable).values({
      paymentId: payment.id,
      event,
      url: `${getPublicUrl()}/api/v1/webhooks/asaas`,
      payload: body as Record<string, unknown>,
      httpStatus: 200,
      attempts: 1,
      status: "success",
    });

    // Update payment status if applicable
    const newStatus = ASAAS_EVENT_TO_STATUS[event];
    if (newStatus && payment.status !== newStatus) {
      const oldStatus = payment.status;

      const updates: Record<string, unknown> = {
        status: newStatus,
        providerStatus: asaasPayment.status,
      };

      if (newStatus === "paid") updates.paidAt = new Date();
      if (newStatus === "refunded") updates.refundedAt = new Date();
      if (newStatus === "cancelled") updates.cancelledAt = new Date();

      // Update net amount if Asaas provides it
      if (asaasPayment.netValue != null) {
        updates.netAmount = Math.round(asaasPayment.netValue * 100);
        updates.providerFee = payment.amount - Math.round(asaasPayment.netValue * 100);
      }

      await db
        .update(paymentsTable)
        .set(updates)
        .where(eq(paymentsTable.id, payment.id));

      await db.insert(paymentEventsTable).values({
        paymentId: payment.id,
        event: event.toLowerCase().replace(/_/g, "."),
        oldStatus,
        newStatus,
        provider: "asaas",
      });

      req.log.info({ paymentId: payment.id, event, oldStatus, newStatus }, "Payment status updated via webhook");
    }

    res.json({ received: true, matched: true });
  } catch (err) {
    req.log.error({ err }, "Error processing Asaas webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Setup: register webhook URL in Asaas ────────────────────────────────────

router.post("/asaas/setup", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const publicUrl = getPublicUrl();
    const webhookUrl = `${publicUrl}/api/v1/webhooks/asaas`;

    // Use existing token or generate a new one
    let token = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!token) {
      token = crypto.randomBytes(24).toString("hex");
      // We can't persist env vars at runtime, so we return it for the user to save
    }

    const config = await registerWebhook({
      url: webhookUrl,
      email: req.user?.email ?? "admin@uppay.com.br",
      enabled: true,
      interrupted: false,
      authToken: token,
    });

    res.json({
      success: true,
      webhook_url: webhookUrl,
      token_used: !!process.env.ASAAS_WEBHOOK_TOKEN,
      generated_token: process.env.ASAAS_WEBHOOK_TOKEN ? undefined : token,
      asaas: config,
    });
  } catch (err) {
    if (err instanceof AsaasError) {
      res.status(502).json({ error: `Asaas: ${err.message}` });
      return;
    }
    req.log.error({ err }, "Error setting up Asaas webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Status: get current webhook config from Asaas ───────────────────────────

router.get("/asaas/status", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const config = await getWebhookConfig();
    const publicUrl = getPublicUrl();
    res.json({
      configured: config != null,
      enabled: config?.enabled ?? false,
      interrupted: config?.interrupted ?? false,
      url: config?.url ?? null,
      expected_url: `${publicUrl}/api/v1/webhooks/asaas`,
      token_set: !!process.env.ASAAS_WEBHOOK_TOKEN,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting Asaas webhook status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── List deliveries ──────────────────────────────────────────────────────────

router.get("/deliveries", async (req, res): Promise<void> => {
  try {
    const { status, source_system_id, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(Number(limit) || 20, 100);
    const off = Number(offset) || 0;

    const conditions = [];
    if (status) conditions.push(eq(webhookDeliveriesTable.status, status));
    if (source_system_id) conditions.push(eq(webhookDeliveriesTable.sourceSystemId, source_system_id));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(webhookDeliveriesTable).where(where).orderBy(sql`${webhookDeliveriesTable.createdAt} desc`).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(webhookDeliveriesTable).where(where),
    ]);

    res.json({ data: rows.map(mapDelivery), total: Number(count), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "Error listing webhook deliveries");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/deliveries/:id/resend", async (req, res): Promise<void> => {
  try {
    const [existing] = await db.select().from(webhookDeliveriesTable).where(eq(webhookDeliveriesTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "Delivery not found" }); return; }

    const [updated] = await db
      .update(webhookDeliveriesTable)
      .set({ status: "pending", attempts: existing.attempts + 1, nextRetryAt: null })
      .where(eq(webhookDeliveriesTable.id, req.params.id))
      .returning();

    res.json(mapDelivery(updated));
  } catch (err) {
    req.log.error({ err }, "Error resending webhook delivery");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(webhookDeliveriesTable);
    const [success] = await db.select({ count: sql<number>`count(*)` }).from(webhookDeliveriesTable).where(eq(webhookDeliveriesTable.status, "success"));
    const [failed] = await db.select({ count: sql<number>`count(*)` }).from(webhookDeliveriesTable).where(eq(webhookDeliveriesTable.status, "failed"));
    const [pending] = await db.select({ count: sql<number>`count(*)` }).from(webhookDeliveriesTable).where(eq(webhookDeliveriesTable.status, "pending"));
    const [retrying] = await db.select({ count: sql<number>`count(*)` }).from(webhookDeliveriesTable).where(eq(webhookDeliveriesTable.status, "retrying"));

    res.json({
      total: Number(total.count),
      success: Number(success.count),
      failed: Number(failed.count),
      pending: Number(pending.count),
      retrying: Number(retrying.count),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting webhook stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
