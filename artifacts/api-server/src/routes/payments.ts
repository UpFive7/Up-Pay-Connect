import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, paymentEventsTable, customersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { mapPayment } from "./dashboard.js";
import {
  AsaasError,
  createAsaasCustomer,
  createAsaasPayment,
  getPixQrCode,
  getBoletoDigitableLine,
  toAsaasBillingType,
  dueDateFromNow,
} from "../lib/asaas.js";
import { syncPendingAsaasPayments } from "../lib/asaas-sync.js";

const router = Router();

function routeProvider(method: string): string {
  const asaasMap = ["pix", "boleto", "subscription"];
  return asaasMap.includes(method) ? "asaas" : "pagbank";
}

// Ensure customer exists in Asaas, creating if needed. Returns asaas customer id.
async function ensureAsaasCustomer(customerId: string): Promise<string> {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));

  if (!customer) throw new Error("Customer not found");

  if (customer.asaasCustomerId) return customer.asaasCustomerId;

  // Create in Asaas
  const asaasCustomer = await createAsaasCustomer({
    name: customer.name,
    cpfCnpj: customer.document ?? undefined,
    email: customer.email ?? undefined,
    mobilePhone: customer.phone ?? undefined,
  });

  // Save back
  await db
    .update(customersTable)
    .set({ asaasCustomerId: asaasCustomer.id })
    .where(eq(customersTable.id, customerId));

  return asaasCustomer.id;
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
    const {
      amount, currency, payment_method, description,
      external_reference, source_system, callback_url,
      expires_in, customer_id,
    } = req.body;

    if (!amount || !payment_method || !source_system) {
      res.status(400).json({ error: "amount, payment_method and source_system são obrigatórios" });
      return;
    }

    const provider = routeProvider(payment_method);
    const isAsaas = provider === "asaas";

    // ── Asaas real integration ──────────────────────────────────────────────
    if (isAsaas) {
      if (!customer_id) {
        res.status(400).json({ error: "Pagamentos via Pix e Boleto exigem um cliente. Selecione ou cadastre um cliente." });
        return;
      }

      const asaasCustomerId = await ensureAsaasCustomer(customer_id);
      const billingType = toAsaasBillingType(payment_method);
      const valueReais = amount / 100;
      const dueDate = dueDateFromNow(3);

      const asaasPayment = await createAsaasPayment({
        customer: asaasCustomerId,
        billingType,
        value: valueReais,
        dueDate,
        description: description ?? undefined,
        externalReference: external_reference ?? undefined,
      });

      // Fetch extra data per method
      let copyPaste: string | undefined;
      let qrCodeBase64: string | undefined;
      let boletoUrl: string | undefined;
      let digitableLine: string | undefined;

      if (payment_method === "pix") {
        try {
          const pix = await getPixQrCode(asaasPayment.id);
          copyPaste = pix.payload;
          qrCodeBase64 = pix.encodedImage;
        } catch (e) {
          req.log.warn({ err: e }, "Could not fetch Pix QR code");
        }
      }

      if (payment_method === "boleto") {
        boletoUrl = asaasPayment.bankSlipUrl;
        try {
          const boleto = await getBoletoDigitableLine(asaasPayment.id);
          digitableLine = boleto.identificationField;
        } catch (e) {
          req.log.warn({ err: e }, "Could not fetch boleto digitable line");
        }
      }

      // Net / fee (Asaas returns in reais → convert to centavos)
      const netCents = asaasPayment.netValue != null ? Math.round(asaasPayment.netValue * 100) : Math.round(amount * 0.98);
      const feeCents = asaasPayment.feeValue != null ? Math.round(asaasPayment.feeValue * 100) : Math.round(amount * 0.02);

      const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

      const [payment] = await db
        .insert(paymentsTable)
        .values({
          amount,
          currency: currency || "BRL",
          paymentMethod: payment_method,
          description: description ?? null,
          externalReference: external_reference ?? null,
          sourceSystem: source_system,
          callbackUrl: callback_url ?? null,
          customerId: customer_id ?? null,
          provider: "asaas",
          providerPaymentId: asaasPayment.id,
          providerStatus: asaasPayment.status,
          status: "pending",
          expiresAt,
          dueDate,
          grossAmount: amount,
          netAmount: netCents,
          providerFee: feeCents,
          copyPaste: copyPaste ?? null,
          qrCodeBase64: qrCodeBase64 ?? null,
          boletoUrl: boletoUrl ?? null,
          boletoDIgitableLine: digitableLine ?? null,
        })
        .returning();

      await db.insert(paymentEventsTable).values({
        paymentId: payment.id,
        event: "payment.created",
        oldStatus: null,
        newStatus: "pending",
        provider: "asaas",
      });

      res.status(201).json(mapPayment(payment));
      return;
    }

    // ── PagBank (mock for now — will integrate when we have PagBank credentials) ──
    const mockLinkData = payment_method === "payment_link"
      ? { paymentLinkUrl: `https://pagseguro.uol.com.br/checkout/v2/payment.html?code=mock_${Math.random().toString(36).slice(2, 10)}` }
      : {};

    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        amount,
        currency: currency || "BRL",
        paymentMethod: payment_method,
        description: description ?? null,
        externalReference: external_reference ?? null,
        sourceSystem: source_system,
        callbackUrl: callback_url ?? null,
        customerId: customer_id ?? null,
        provider: "pagbank",
        status: "pending",
        expiresAt,
        grossAmount: amount,
        netAmount: Math.round(amount * 0.98),
        providerFee: Math.round(amount * 0.02),
        ...mockLinkData,
      })
      .returning();

    await db.insert(paymentEventsTable).values({
      paymentId: payment.id,
      event: "payment.created",
      oldStatus: null,
      newStatus: "pending",
      provider: "pagbank",
    });

    res.status(201).json(mapPayment(payment));
  } catch (err) {
    if (err instanceof AsaasError) {
      req.log.error({ err }, "Asaas API error creating payment");
      res.status(502).json({ error: `Asaas: ${err.message}` });
      return;
    }
    req.log.error({ err }, "Error creating payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Manual sync trigger ──────────────────────────────────────────────────────

router.post("/sync", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const olderThan = Number(req.query.older_than_minutes) || 0;
    const result = await syncPendingAsaasPayments(olderThan, 100);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error running payment sync");
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
