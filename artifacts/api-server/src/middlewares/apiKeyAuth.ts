import { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

type ParamsDictionary = Record<string, string>;

export interface ApiKeyContext {
  id: string;
  systemId: string;
  environment: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext | undefined;
    }
  }
}

// Populates req.apiKey when a valid `x-api-key` header is present.
// Does NOT reject requests by itself — permission enforcement happens in requirePermission().
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers["x-api-key"];
  const key = Array.isArray(header) ? header[0] : header;

  if (!key) {
    next();
    return;
  }

  try {
    const hash = createHash("sha256").update(key).digest("hex");
    const [record] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash, hash));

    if (!record || record.status !== "active") {
      res.status(401).json({ error: "API key inválida ou revogada" });
      return;
    }

    req.apiKey = {
      id: record.id,
      systemId: record.systemId,
      environment: record.environment,
      permissions: record.permissions ?? [],
    };

    // Fire-and-forget last-used timestamp update
    void db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, record.id));

    next();
  } catch (err) {
    req.log.error({ err }, "Error validating API key");
    res.status(500).json({ error: "Internal server error" });
  }
}

// Enforces access: allows authenticated session users (internal admin panel) unconditionally,
// and API-key callers only when their key carries the required permission (or "*").
export function requirePermission<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = any>(
  permission: string,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next): void => {
    if (req.isAuthenticated()) {
      next();
      return;
    }

    if (req.apiKey) {
      if (req.apiKey.permissions.includes("*") || req.apiKey.permissions.includes(permission)) {
        next();
        return;
      }
      (res as Response).status(403).json({ error: `API key sem permissão "${permission}"` });
      return;
    }

    (res as Response).status(401).json({ error: "Autenticação necessária: use uma sessão válida ou uma API key" });
  };
}

// For endpoints reserved for the internal admin panel only — API keys never grant access,
// regardless of permissions.
export function requireSession<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = any>(
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  (res as Response).status(401).json({ error: "Unauthorized" });
}
