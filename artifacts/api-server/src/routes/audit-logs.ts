import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  try {
    const { action, entity, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(Number(limit) || 20, 100);
    const off = Number(offset) || 0;

    const conditions = [];
    if (action) conditions.push(eq(auditLogsTable.action, action));
    if (entity) conditions.push(eq(auditLogsTable.entity, entity));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(auditLogsTable).where(where).orderBy(sql`${auditLogsTable.createdAt} desc`).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(auditLogsTable).where(where),
    ]);

    res.json({
      data: rows.map((l) => ({
        id: l.id,
        user_id: l.userId,
        source_system_id: l.sourceSystemId,
        action: l.action,
        entity: l.entity,
        entity_id: l.entityId,
        ip_address: l.ipAddress,
        created_at: l.createdAt.toISOString(),
      })),
      total: Number(count),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    req.log.error({ err }, "Error listing audit logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
