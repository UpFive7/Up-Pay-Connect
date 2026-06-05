import { Router } from "express";
import { db } from "@workspace/db";
import { providerFeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

function mapFee(f: typeof providerFeesTable.$inferSelect) {
  return {
    id: f.id,
    provider: f.provider,
    payment_method: f.paymentMethod,
    fee_type: f.feeType,
    fixed_amount: f.fixedAmount,
    percentage_rate: f.percentageRate,
    settlement_days: f.settlementDays,
    active: f.active,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt?.toISOString() ?? null,
  };
}

router.get("/", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(providerFeesTable).orderBy(sql`${providerFeesTable.createdAt} desc`);
    res.json(rows.map(mapFee));
  } catch (err) {
    req.log.error({ err }, "Error listing fees");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res): Promise<void> => {
  try {
    const { provider, payment_method, fee_type, fixed_amount, percentage_rate, settlement_days } = req.body;
    if (!provider || !payment_method || !fee_type) {
      res.status(400).json({ error: "provider, payment_method and fee_type are required" });
      return;
    }

    const [fee] = await db
      .insert(providerFeesTable)
      .values({ provider, paymentMethod: payment_method, feeType: fee_type, fixedAmount: fixed_amount, percentageRate: percentage_rate, settlementDays: settlement_days })
      .returning();

    res.status(201).json(mapFee(fee));
  } catch (err) {
    req.log.error({ err }, "Error creating fee");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res): Promise<void> => {
  try {
    const { fixed_amount, percentage_rate, settlement_days, active } = req.body;
    const [updated] = await db
      .update(providerFeesTable)
      .set({
        ...(fixed_amount !== undefined && { fixedAmount: fixed_amount }),
        ...(percentage_rate !== undefined && { percentageRate: percentage_rate }),
        ...(settlement_days !== undefined && { settlementDays: settlement_days }),
        ...(active !== undefined && { active }),
      })
      .where(eq(providerFeesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Fee not found" }); return; }
    res.json(mapFee(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating fee");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
