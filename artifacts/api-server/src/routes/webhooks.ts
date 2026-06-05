import { Router } from "express";
import { db } from "@workspace/db";
import { webhookDeliveriesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

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
