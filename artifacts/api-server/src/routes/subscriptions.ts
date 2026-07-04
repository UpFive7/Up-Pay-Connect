import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, customersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import {
  AsaasError,
  createAsaasCustomer,
  createAsaasSubscription,
  cancelAsaasSubscription,
  toAsaasBillingType,
  toAsaasBillingCycle,
} from "../lib/asaas.js";

const router = Router();

function mapSub(s: typeof subscriptionsTable.$inferSelect) {
  return {
    id: s.id,
    customer_id: s.customerId,
    amount: s.amount,
    payment_method: s.paymentMethod,
    billing_cycle: s.billingCycle,
    description: s.description,
    source_system: s.sourceSystem,
    external_reference: s.externalReference,
    status: s.status,
    provider: s.provider,
    provider_subscription_id: s.providerSubscriptionId,
    next_due_date: s.nextDueDate,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt?.toISOString() ?? null,
  };
}

router.get("/", async (req, res): Promise<void> => {
  try {
    const { status, source_system, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(Number(limit) || 20, 100);
    const off = Number(offset) || 0;

    const conditions = [];
    if (status) conditions.push(eq(subscriptionsTable.status, status));
    if (source_system) conditions.push(eq(subscriptionsTable.sourceSystem, source_system));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(subscriptionsTable).where(where).orderBy(sql`${subscriptionsTable.createdAt} desc`).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(where),
    ]);

    res.json({ data: rows.map(mapSub), total: Number(count), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "Error listing subscriptions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res): Promise<void> => {
  try {
    const { customer_id, amount, payment_method, billing_cycle, description, source_system, external_reference, next_due_date } = req.body;
    if (!customer_id || !amount || !payment_method || !billing_cycle || !source_system) {
      res.status(400).json({ error: "customer_id, amount, payment_method, billing_cycle and source_system are required" });
      return;
    }
    if (!next_due_date) {
      res.status(400).json({ error: "next_due_date is required" });
      return;
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customer_id));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

    let asaasCustomerId = customer.asaasCustomerId;
    let providerSubscriptionId: string | null = null;
    let status = "active";

    if (process.env.ASAAS_API_KEY) {
      try {
        if (!asaasCustomerId) {
          const asaasCustomer = await createAsaasCustomer({
            name: customer.name,
            cpfCnpj: customer.document ?? undefined,
            email: customer.email ?? undefined,
            mobilePhone: customer.phone ?? undefined,
          });
          asaasCustomerId = asaasCustomer.id;
          await db.update(customersTable).set({ asaasCustomerId }).where(eq(customersTable.id, customer_id));
        }

        const asaasSub = await createAsaasSubscription({
          customer: asaasCustomerId,
          billingType: toAsaasBillingType(payment_method),
          value: amount / 100,
          nextDueDate: next_due_date,
          cycle: toAsaasBillingCycle(billing_cycle),
          description: description ?? undefined,
          externalReference: external_reference ?? undefined,
        });
        providerSubscriptionId = asaasSub.id;
      } catch (asaasErr) {
        if (asaasErr instanceof AsaasError) {
          req.log.error({ err: asaasErr }, "Asaas subscription creation failed");
          res.status(502).json({ error: `Asaas: ${asaasErr.message}` });
          return;
        }
        throw asaasErr;
      }
    }

    const [sub] = await db
      .insert(subscriptionsTable)
      .values({
        customerId: customer_id,
        amount,
        paymentMethod: payment_method,
        billingCycle: billing_cycle,
        description,
        sourceSystem: source_system,
        externalReference: external_reference,
        nextDueDate: next_due_date,
        status,
        provider: "asaas",
        providerSubscriptionId,
      })
      .returning();

    res.status(201).json(mapSub(sub));
  } catch (err) {
    req.log.error({ err }, "Error creating subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  try {
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, req.params.id));
    if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }
    res.json(mapSub(sub));
  } catch (err) {
    req.log.error({ err }, "Error getting subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/cancel", async (req, res): Promise<void> => {
  try {
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "Subscription not found" }); return; }

    if (existing.status === "cancelled") {
      res.status(400).json({ error: "Assinatura já está cancelada" });
      return;
    }

    if (existing.provider === "asaas" && existing.providerSubscriptionId) {
      try {
        await cancelAsaasSubscription(existing.providerSubscriptionId);
      } catch (asaasErr) {
        if (asaasErr instanceof AsaasError) {
          req.log.error({ err: asaasErr, subscriptionId: existing.id }, "Asaas subscription cancel failed");
          res.status(502).json({ error: `Asaas: ${asaasErr.message}` });
          return;
        }
        throw asaasErr;
      }
    }

    const [updated] = await db
      .update(subscriptionsTable)
      .set({ status: "cancelled" })
      .where(eq(subscriptionsTable.id, req.params.id))
      .returning();
    res.json(mapSub(updated));
  } catch (err) {
    req.log.error({ err }, "Error cancelling subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
