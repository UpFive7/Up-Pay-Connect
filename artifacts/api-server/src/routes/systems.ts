import { Router } from "express";
import { db } from "@workspace/db";
import { integratedSystemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

function mapSystem(s: typeof integratedSystemsTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    status: s.status,
    default_webhook_url: s.defaultWebhookUrl,
    allowed_ips: s.allowedIps,
    environment: s.environment,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt?.toISOString() ?? null,
  };
}

router.get("/", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(integratedSystemsTable).orderBy(sql`${integratedSystemsTable.createdAt} desc`);
    res.json(rows.map(mapSystem));
  } catch (err) {
    req.log.error({ err }, "Error listing systems");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res): Promise<void> => {
  try {
    const { name, slug, description, default_webhook_url, allowed_ips, environment } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name and slug are required" }); return; }

    const [system] = await db
      .insert(integratedSystemsTable)
      .values({ name, slug, description, defaultWebhookUrl: default_webhook_url, allowedIps: allowed_ips, environment: environment || "sandbox" })
      .returning();

    res.status(201).json(mapSystem(system));
  } catch (err) {
    req.log.error({ err }, "Error creating system");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  try {
    const [system] = await db.select().from(integratedSystemsTable).where(eq(integratedSystemsTable.id, req.params.id));
    if (!system) { res.status(404).json({ error: "System not found" }); return; }
    res.json(mapSystem(system));
  } catch (err) {
    req.log.error({ err }, "Error getting system");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res): Promise<void> => {
  try {
    const { name, description, status, default_webhook_url, allowed_ips, environment } = req.body;
    const [updated] = await db
      .update(integratedSystemsTable)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(default_webhook_url !== undefined && { defaultWebhookUrl: default_webhook_url }),
        ...(allowed_ips !== undefined && { allowedIps: allowed_ips }),
        ...(environment && { environment }),
      })
      .where(eq(integratedSystemsTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "System not found" }); return; }
    res.json(mapSystem(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating system");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
