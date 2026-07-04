import { db } from "@workspace/db";
import { paymentsTable, paymentEventsTable } from "@workspace/db";
import { eq, and, lt, isNotNull, inArray } from "drizzle-orm";
import { getAsaasPayment } from "./asaas.js";
import { logger } from "./logger.js";
import { enqueueOutboundWebhook } from "./webhook-delivery.js";

// Map Asaas payment status → our internal status
const ASAAS_STATUS_MAP: Record<string, string> = {
  RECEIVED: "paid",
  CONFIRMED: "paid",
  PENDING: "pending",
  OVERDUE: "expired",
  REFUNDED: "refunded",
  REFUND_REQUESTED: "processing",
  CHARGEBACK_REQUESTED: "processing",
  CHARGEBACK_DISPUTE: "processing",
  AWAITING_CHARGEBACK_REVERSAL: "processing",
  DUNNING_REQUESTED: "processing",
  DUNNING_RECEIVED: "paid",
  AWAITING_RISK_ANALYSIS: "processing",
};

const TERMINAL_STATUSES = new Set(["paid", "cancelled", "refunded", "expired", "failed"]);

export interface SyncResult {
  checked: number;
  updated: number;
  errors: number;
}

export async function syncPendingAsaasPayments(
  olderThanMinutes = 5,
  limitCount = 50,
): Promise<SyncResult> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  // Find pending Asaas payments older than cutoff that have a provider ID
  const pending = await db
    .select()
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.provider, "asaas"),
        isNotNull(paymentsTable.providerPaymentId),
        // Only non-terminal statuses
        inArray(paymentsTable.status, ["pending", "processing"]),
        lt(paymentsTable.createdAt, cutoff),
      ),
    )
    .limit(limitCount);

  if (pending.length === 0) {
    return { checked: 0, updated: 0, errors: 0 };
  }

  logger.info({ count: pending.length }, "Asaas sync: checking pending payments");

  let updated = 0;
  let errors = 0;

  await Promise.allSettled(
    pending.map(async (payment) => {
      try {
        const asaasPayment = await getAsaasPayment(payment.providerPaymentId!);
        const newStatus = ASAAS_STATUS_MAP[asaasPayment.status];

        if (!newStatus || newStatus === payment.status) return;

        const oldStatus = payment.status;

        const updates: Record<string, unknown> = {
          status: newStatus,
          providerStatus: asaasPayment.status,
        };

        if (newStatus === "paid") updates.paidAt = new Date();
        if (newStatus === "refunded") updates.refundedAt = new Date();
        if (newStatus === "cancelled") updates.cancelledAt = new Date();

        if (asaasPayment.netValue != null) {
          updates.netAmount = Math.round(asaasPayment.netValue * 100);
          updates.providerFee = payment.amount - Math.round(asaasPayment.netValue * 100);
        }

        const [updatedPayment] = await db
          .update(paymentsTable)
          .set(updates)
          .where(eq(paymentsTable.id, payment.id))
          .returning();

        await db.insert(paymentEventsTable).values({
          paymentId: payment.id,
          event: "payment.status_synced",
          oldStatus,
          newStatus,
          provider: "asaas",
        });
        void enqueueOutboundWebhook(`payment.${newStatus}`, updatedPayment);

        logger.info({ paymentId: payment.id, oldStatus, newStatus }, "Asaas sync: status updated");
        updated++;
      } catch (err) {
        logger.warn({ err, paymentId: payment.id }, "Asaas sync: error checking payment");
        errors++;
      }
    }),
  );

  return { checked: pending.length, updated, errors };
}

// ─── Background polling loop ──────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startAsaasSyncLoop(): void {
  if (!process.env.ASAAS_API_KEY) {
    logger.warn("Asaas sync loop not started: ASAAS_API_KEY not set");
    return;
  }

  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Asaas sync loop started");

  const run = async () => {
    try {
      const result = await syncPendingAsaasPayments(5, 50);
      if (result.checked > 0) {
        logger.info(result, "Asaas sync loop completed");
      }
    } catch (err) {
      logger.error({ err }, "Asaas sync loop error");
    }
  };

  // First run after 1 minute (let server warm up)
  setTimeout(() => {
    void run();
    setInterval(() => void run(), POLL_INTERVAL_MS);
  }, 60_000);
}
