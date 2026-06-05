import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import dashboardRouter from "./dashboard.js";
import paymentsRouter from "./payments.js";
import customersRouter from "./customers.js";
import systemsRouter from "./systems.js";
import apiKeysRouter from "./api-keys.js";
import subscriptionsRouter from "./subscriptions.js";
import webhooksRouter from "./webhooks.js";
import feesRouter from "./fees.js";
import auditLogsRouter from "./audit-logs.js";
import providersRouter from "./providers.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1/dashboard", dashboardRouter);
router.use("/v1/payments", paymentsRouter);
router.use("/v1/customers", customersRouter);
router.use("/v1/systems", systemsRouter);
router.use("/v1/api-keys", apiKeysRouter);
router.use("/v1/subscriptions", subscriptionsRouter);
router.use("/v1/webhooks", webhooksRouter);
router.use("/v1/fees", feesRouter);
router.use("/v1/audit-logs", auditLogsRouter);
router.use("/v1/providers", providersRouter);

export default router;
