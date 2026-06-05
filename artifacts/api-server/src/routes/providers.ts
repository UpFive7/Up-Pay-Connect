import { Router } from "express";
import { db } from "@workspace/db";
import { providerAccountsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

function mapProvider(p: typeof providerAccountsTable.$inferSelect) {
  return {
    id: p.id,
    provider: p.provider,
    environment: p.environment,
    status: p.status,
    priority: p.priority,
    supported_methods: p.supportedMethods,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt?.toISOString() ?? null,
  };
}

router.get("/", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(providerAccountsTable).orderBy(sql`${providerAccountsTable.priority} asc`);
    res.json(rows.map(mapProvider));
  } catch (err) {
    req.log.error({ err }, "Error listing providers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res): Promise<void> => {
  try {
    const { status, priority, supported_methods } = req.body;
    const [updated] = await db
      .update(providerAccountsTable)
      .set({
        ...(status && { status }),
        ...(priority !== undefined && { priority }),
        ...(supported_methods && { supportedMethods: supported_methods }),
      })
      .where(eq(providerAccountsTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Provider not found" }); return; }
    res.json(mapProvider(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
