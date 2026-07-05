import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { requireSession } from "../middlewares/apiKeyAuth.js";
import { recordAuditLog } from "../lib/auditLog.js";

const router = Router();

function generateApiKey(environment: string): { key: string; hash: string; prefix: string } {
  const prefix = environment === "production" ? "sk_live" : "sk_test";
  const secret = randomBytes(24).toString("hex");
  const key = `${prefix}_${secret}`;
  const hash = createHash("sha256").update(key).digest("hex");
  return { key, hash, prefix: `${prefix}_${secret.slice(0, 8)}` };
}

function mapKey(k: typeof apiKeysTable.$inferSelect, includeSecret?: boolean, secretKey?: string) {
  const isExpired = k.expiresAt !== null && k.expiresAt.getTime() <= Date.now();
  const base = {
    id: k.id,
    system_id: k.systemId,
    name: k.name,
    key_prefix: k.keyPrefix,
    environment: k.environment,
    status: isExpired && k.status === "active" ? "expired" : k.status,
    permissions: k.permissions,
    last_used_at: k.lastUsedAt?.toISOString() ?? null,
    expires_at: k.expiresAt?.toISOString() ?? null,
    created_at: k.createdAt.toISOString(),
  };
  if (includeSecret && secretKey) {
    return { ...base, key: secretKey };
  }
  return base;
}

router.get("/", requireSession, async (req, res): Promise<void> => {
  try {
    const { system_id } = req.query as Record<string, string>;
    const where = system_id ? eq(apiKeysTable.systemId, system_id) : undefined;
    const rows = await db.select().from(apiKeysTable).where(where).orderBy(sql`${apiKeysTable.createdAt} desc`);
    res.json(rows.map((k) => mapKey(k)));
  } catch (err) {
    req.log.error({ err }, "Error listing API keys");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireSession, async (req, res): Promise<void> => {
  try {
    const { system_id, name, environment, permissions, expires_at } = req.body;
    if (!system_id || !name || !environment) {
      res.status(400).json({ error: "system_id, name and environment are required" });
      return;
    }

    let expiresAt: Date | null = null;
    if (expires_at) {
      expiresAt = new Date(expires_at);
      if (Number.isNaN(expiresAt.getTime())) {
        res.status(400).json({ error: "expires_at inválido" });
        return;
      }
    }

    const { key, hash, prefix } = generateApiKey(environment);
    const [apiKey] = await db
      .insert(apiKeysTable)
      .values({ systemId: system_id, name, keyHash: hash, keyPrefix: prefix, environment, permissions: permissions || [], status: "active", expiresAt })
      .returning();

    recordAuditLog(req, {
      action: "api_key.created",
      entity: "api_key",
      entityId: apiKey.id,
      newValue: { name: apiKey.name, system_id: apiKey.systemId, environment: apiKey.environment, permissions: apiKey.permissions, expires_at: apiKey.expiresAt?.toISOString() ?? null },
    });

    res.status(201).json(mapKey(apiKey, true, key));
  } catch (err) {
    req.log.error({ err }, "Error creating API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/revoke", requireSession, async (req, res): Promise<void> => {
  try {
    const [existing] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "API key not found" }); return; }

    const [updated] = await db
      .update(apiKeysTable)
      .set({ status: "revoked" })
      .where(eq(apiKeysTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "API key not found" }); return; }

    recordAuditLog(req, {
      action: "api_key.revoked",
      entity: "api_key",
      entityId: updated.id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    res.json(mapKey(updated));
  } catch (err) {
    req.log.error({ err }, "Error revoking API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/rotate", requireSession, async (req, res): Promise<void> => {
  try {
    const { expires_at } = req.body ?? {};

    const [existing] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, req.params.id));
    if (!existing) { res.status(404).json({ error: "API key not found" }); return; }

    let expiresAt: Date | null = existing.expiresAt;
    if (expires_at !== undefined) {
      expiresAt = expires_at ? new Date(expires_at) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        res.status(400).json({ error: "expires_at inválido" });
        return;
      }
    }

    const { key, hash, prefix } = generateApiKey(existing.environment);
    const [rotated] = await db
      .update(apiKeysTable)
      .set({ keyHash: hash, keyPrefix: prefix, status: "active", expiresAt })
      .where(eq(apiKeysTable.id, req.params.id))
      .returning();

    recordAuditLog(req, {
      action: "api_key.rotated",
      entity: "api_key",
      entityId: rotated.id,
      oldValue: { key_prefix: existing.keyPrefix, status: existing.status, expires_at: existing.expiresAt?.toISOString() ?? null },
      newValue: { key_prefix: rotated.keyPrefix, status: rotated.status, expires_at: rotated.expiresAt?.toISOString() ?? null },
    });

    res.json(mapKey(rotated, true, key));
  } catch (err) {
    req.log.error({ err }, "Error rotating API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
