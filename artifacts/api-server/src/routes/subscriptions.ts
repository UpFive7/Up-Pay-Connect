import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

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

    const [sub] = await db
      .insert(subscriptionsTable)
      .values({ customerId: customer_id, amount, paymentMethod: payment_method, billingCycle: billing_cycle, description, sourceSystem: source_system, externalReference: external_reference, nextDueDate: next_due_date, status: "active", provider: "asaas" })
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
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ status: "cancelled" })
      .where(eq(subscriptionsTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Subscription not found" }); return; }
    res.json(mapSub(updated));
  } catch (err) {
    req.log.error({ err }, "Error cancelling subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
