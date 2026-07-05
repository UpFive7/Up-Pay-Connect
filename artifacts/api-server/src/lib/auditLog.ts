import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export function recordAuditLog(
  req: Request,
  params: {
    action: string;
    entity: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  },
): void {
  db.insert(auditLogsTable)
    .values({
      userId: req.user?.id ?? null,
      sourceSystemId: null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    })
    .catch((err) => {
      req.log.error({ err }, "Error recording audit log");
    });
}
