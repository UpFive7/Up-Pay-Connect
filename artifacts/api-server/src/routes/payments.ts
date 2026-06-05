import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, paymentEventsTable } from "@workspace/db";
import { eq, sql, and, ilike } from "drizzle-orm";
import { mapPayment } from "./dashboard.js";

const router = Router();

// Determine provider based on payment method
function routeProvider(method: string): string {
  const asaasMap = ["pix", "boleto", "subscription"];
  return asaasMap.includes(method) ? "asaas" : "pagbank";
}

router.get("/", async (req, res): Promise<void> => {
  try {
    const { status, provider, payment_method, source_system, limit = "20", offset = "0" } = req.query as Record<string, string>;

    const conditions = [];
    if (status) conditions.push(eq(paymentsTable.status, status));
    if (provider) conditions.push(eq(paymentsTable.provider, provider));
    if (payment_method) conditions.push(eq(paymentsTable.paymentMethod, payment_method));
    if (source_system) conditions.push(eq(paymentsTable.sourceSystem, source_system));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const lim = Math.min(Number(limit) || 20, 100);
    const off = Number(offset) || 0;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(paymentsTable).where(where).orderBy(sql`${paymentsTable.createdAt} desc`).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(paymentsTable).where(where),
    ]);

    res.json({ data: rows.map(mapPayment), total: Number(count), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "Error listing payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res): Promise<void> => {
  try {
    const { amount, currency, payment_method, description, external_reference, source_system, callback_url, expires_in, customer_id } = req.body;

    if (!amount || !payment_method || !source_system) {
      res.status(400).json({ error: "amount, payment_method and source_system are required" });
      return;
    }

    const provider = routeProvider(payment_method);
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    // Simulate provider response with mock data
    const mockPixData = payment_method === "pix" ? {
      qrCode: "pix-qr-code-placeholder",
      copyPaste: "00020126330014br.gov.bcb.pix01119999999999999520400005303986540510.005802BR5924UpPay Connect6009Sao Paulo6304A1B2",
    } : {};

    const mockBoletoData = payment_method === "boleto" ? {
      boletoUrl: "https://boleto.exemplo.com/boleto",
      boletoBarcode: "34191.79001 01043.510047 91020.150008 2 10010000011000",
      boletoDIgitableLine: "34191790010104351004791020150008210010000011000",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    } : {};

    const mockLinkData = payment_method === "payment_link" ? {
      paymentLinkUrl: `https://pagamento.uppay.com.br/pay_${Math.random().toString(36).slice(2, 10)}`,
    } : {};

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        amount,
        currency: currency || "BRL",
        paymentMethod: payment_method,
        description,
        externalReference: external_reference,
        sourceSystem: source_system,
        callbackUrl: callback_url,
        customerId: customer_id || null,
        provider,
        status: "pending",
        expiresAt,
        grossAmount: amount,
        netAmount: Math.round(amount * 0.98),
        providerFee: Math.round(amount * 0.02),
        ...mockPixData,
        ...mockBoletoData,
        ...mockLinkData,
      })
      .returning();

    await db.insert(paymentEventsTable).values({
      paymentId: payment.id,
      event: "payment.created",
      oldStatus: null,
      newStatus: "pending",
      provider,
    });

    res.status(201).json(mapPayment(payment));
  } catch (err) {
    req.log.error({ err }, "Error creating payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  try {
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
    if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
    res.json(mapPayment(payment));
  } catch (err) {
    req.log.error({ err }, "Error getting payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/cancel", async (req, res): Promise<void> => {
  try {
    const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }

    const [updated] = await db
      .update(paymentsTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    await db.insert(paymentEventsTable).values({
      paymentId: req.params.id,
      event: "payment.cancelled",
      oldStatus: existing.status,
      newStatus: "cancelled",
    });

    res.json(mapPayment(updated));
  } catch (err) {
    req.log.error({ err }, "Error cancelling payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/refund", async (req, res): Promise<void> => {
  try {
    const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }

    const refundAmount = req.body?.amount;
    const newStatus = refundAmount && refundAmount < existing.amount ? "partially_refunded" : "refunded";

    const [updated] = await db
      .update(paymentsTable)
      .set({ status: newStatus, refundedAt: new Date() })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    await db.insert(paymentEventsTable).values({
      paymentId: req.params.id,
      event: `payment.${newStatus}`,
      oldStatus: existing.status,
      newStatus,
    });

    res.json(mapPayment(updated));
  } catch (err) {
    req.log.error({ err }, "Error refunding payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/events", async (req, res): Promise<void> => {
  try {
    const events = await db
      .select()
      .from(paymentEventsTable)
      .where(eq(paymentEventsTable.paymentId, req.params.id))
      .orderBy(sql`${paymentEventsTable.createdAt} desc`);

    res.json(events.map((e) => ({
      id: e.id,
      payment_id: e.paymentId,
      event: e.event,
      old_status: e.oldStatus,
      new_status: e.newStatus,
      provider: e.provider,
      created_at: e.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting payment events");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
