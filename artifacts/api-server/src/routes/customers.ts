import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db";
import { eq, sql, or, ilike } from "drizzle-orm";
import { mapPayment } from "./dashboard.js";

const router = Router();

function mapCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    document: c.document,
    document_type: c.documentType,
    address_city: c.addressCity,
    address_state: c.addressState,
    asaas_customer_id: c.asaasCustomerId,
    pagbank_customer_id: c.pagbankCustomerId,
    created_by_system_id: c.createdBySystemId,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

router.get("/", async (req, res): Promise<void> => {
  try {
    const { search, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(Number(limit) || 20, 100);
    const off = Number(offset) || 0;

    const where = search
      ? or(ilike(customersTable.name, `%${search}%`), ilike(customersTable.email, `%${search}%`))
      : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(customersTable).where(where).orderBy(sql`${customersTable.createdAt} desc`).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
    ]);

    res.json({ data: rows.map(mapCustomer), total: Number(count), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "Error listing customers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res): Promise<void> => {
  try {
    const { name, email, phone, document, document_type, address } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    const [customer] = await db
      .insert(customersTable)
      .values({
        name, email, phone, document,
        documentType: document_type,
        addressStreet: address?.street,
        addressNumber: address?.number,
        addressDistrict: address?.district,
        addressCity: address?.city,
        addressState: address?.state,
        addressZipCode: address?.zip_code,
      })
      .returning();

    res.status(201).json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Error creating customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  try {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, req.params.id));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Error getting customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/payments", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.customerId, req.params.id))
      .orderBy(sql`${paymentsTable.createdAt} desc`);
    res.json(rows.map(mapPayment));
  } catch (err) {
    req.log.error({ err }, "Error getting customer payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
