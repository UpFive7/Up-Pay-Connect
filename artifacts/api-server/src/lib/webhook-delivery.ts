import { db } from "@workspace/db";
import { webhookDeliveriesTable, integratedSystemsTable, paymentsTable } from "@workspace/db";
import { eq, and, or, isNull, lte, lt } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "./logger.js";

// ─── Enqueue ───────────────────────────────────────────────────────────────

// Payload shape sent to integrated systems' webhook_url.
interface OutboundWebhookPayload {
  event: string;
  payment: ReturnType<typeof import("../routes/dashboard.js").mapPayment>;
}

export async function enqueueOutboundWebhook(
  event: string,
  payment: typeof paymentsTable.$inferSelect,
): Promise<void> {
  try {
    const [system] = await db
      .select()
      .from(integratedSystemsTable)
      .where(eq(integratedSystemsTable.slug, payment.sourceSystem));

    if (!system || system.status !== "active" || !system.defaultWebhookUrl) return;

    const { mapPayment } = await import("../routes/dashboard.js");
    const payload: OutboundWebhookPayload = { event, payment: mapPayment(payment) };

    await db.insert(webhookDeliveriesTable).values({
      paymentId: payment.id,
      sourceSystemId: system.id,
      event,
      url: system.defaultWebhookUrl,
      payload: payload as unknown as Record<string, unknown>,
      status: "pending",
      attempts: 0,
    });

    logger.info({ event, paymentId: payment.id, systemSlug: system.slug }, "Outbound webhook enqueued");
  } catch (err) {
    logger.error({ err, event, paymentId: payment.id }, "Failed to enqueue outbound webhook");
  }
}

// ─── Signing ───────────────────────────────────────────────────────────────

function ensureSystemSecret(secret: string | null): string {
  return secret ?? crypto.randomBytes(32).toString("hex");
}

function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// ─── Retry schedule ────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const REQUEST_TIMEOUT_MS = 10_000;

// ─── Delivery ──────────────────────────────────────────────────────────────

async function deliverOne(delivery: typeof webhookDeliveriesTable.$inferSelect): Promise<void> {
  const attemptNumber = delivery.attempts + 1;

  let secret: string | null = null;
  let systemId: string | null = delivery.sourceSystemId;
  if (systemId) {
    const [system] = await db.select().from(integratedSystemsTable).where(eq(integratedSystemsTable.id, systemId));
    if (system) {
      secret = ensureSystemSecret(system.webhookSecret);
      if (!system.webhookSecret) {
        await db.update(integratedSystemsTable).set({ webhookSecret: secret }).where(eq(integratedSystemsTable.id, system.id));
      }
    }
  }

  const body = JSON.stringify(delivery.payload ?? {});
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-UpPay-Event": delivery.event,
    "X-UpPay-Delivery-Id": delivery.id,
  };
  if (secret) headers["X-UpPay-Signature"] = signPayload(secret, body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(delivery.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const responseBody = await response.text().catch(() => "");
    const success = response.status >= 200 && response.status < 300;

    if (success) {
      await db
        .update(webhookDeliveriesTable)
        .set({
          status: "success",
          attempts: attemptNumber,
          httpStatus: response.status,
          responseBody: responseBody.slice(0, 2000),
          headers,
          nextRetryAt: null,
        })
        .where(eq(webhookDeliveriesTable.id, delivery.id));
      logger.info({ deliveryId: delivery.id, url: delivery.url, status: response.status }, "Outbound webhook delivered");
      return;
    }

    await handleFailure(delivery, attemptNumber, response.status, responseBody, headers);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await handleFailure(delivery, attemptNumber, null, message, headers);
  }
}

async function handleFailure(
  delivery: typeof webhookDeliveriesTable.$inferSelect,
  attemptNumber: number,
  httpStatus: number | null,
  responseBody: string,
  headers: Record<string, string>,
): Promise<void> {
  const exhausted = attemptNumber >= MAX_ATTEMPTS;
  const delay = RETRY_DELAYS_MS[attemptNumber - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

  await db
    .update(webhookDeliveriesTable)
    .set({
      status: exhausted ? "failed" : "retrying",
      attempts: attemptNumber,
      httpStatus: httpStatus ?? undefined,
      responseBody: responseBody.slice(0, 2000),
      headers,
      nextRetryAt: exhausted ? null : new Date(Date.now() + delay),
    })
    .where(eq(webhookDeliveriesTable.id, delivery.id));

  logger.warn(
    { deliveryId: delivery.id, url: delivery.url, attemptNumber, exhausted, httpStatus },
    exhausted ? "Outbound webhook exhausted retries" : "Outbound webhook delivery failed, will retry",
  );
}

// ─── Queue processing ──────────────────────────────────────────────────────

export async function processOutboundWebhookQueue(limitCount = 25): Promise<{ processed: number }> {
  const due = await db
    .select()
    .from(webhookDeliveriesTable)
    .where(
      and(
        or(eq(webhookDeliveriesTable.status, "pending"), eq(webhookDeliveriesTable.status, "retrying")),
        or(isNull(webhookDeliveriesTable.nextRetryAt), lte(webhookDeliveriesTable.nextRetryAt, new Date())),
      ),
    )
    .limit(limitCount);

  if (due.length === 0) return { processed: 0 };

  await Promise.allSettled(due.map((d) => deliverOne(d)));
  return { processed: due.length };
}

// ─── Background loop ───────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

export function startOutboundWebhookLoop(): void {
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Outbound webhook delivery loop started");

  const run = async () => {
    try {
      const result = await processOutboundWebhookQueue();
      if (result.processed > 0) {
        logger.info(result, "Outbound webhook queue processed");
      }
    } catch (err) {
      logger.error({ err }, "Outbound webhook loop error");
    }
  };

  setInterval(() => void run(), POLL_INTERVAL_MS);
}
