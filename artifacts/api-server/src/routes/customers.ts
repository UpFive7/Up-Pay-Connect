import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, paymentsTable } from "@workspace/db";
import { eq, sql, or, ilike } from "drizzle-orm";
import { mapPayment } from "./dashboard.js";
import { createAsaasCustomer, AsaasError } from "../lib/asaas.js";
import { requirePermission } from "../middlewares/apiKeyAuth.js";

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

router.get("/", requirePermission("customers:read"), async (req, res): Promise<void> => {
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

router.post("/", requirePermission("customers:write"), async (req, res): Promise<void> => {
  try {
    const { name, email, phone, document, document_type, address } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    // Insert into our DB first
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

    // Sync to Asaas immediately (non-blocking — failure does not reject the request)
    if (process.env.ASAAS_API_KEY) {
      try {
        const asaasCustomer = await createAsaasCustomer({
          name,
          cpfCnpj: document ?? undefined,
          email: email ?? undefined,
          mobilePhone: phone ?? undefined,
        });

        await db
          .update(customersTable)
          .set({ asaasCustomerId: asaasCustomer.id })
          .where(eq(customersTable.id, customer.id));

        customer.asaasCustomerId = asaasCustomer.id;
        req.log.info({ customerId: customer.id, asaasId: asaasCustomer.id }, "Customer synced to Asaas");
      } catch (asaasErr) {
        // Log but don't fail the request — sync can be retried later
        if (asaasErr instanceof AsaasError) {
          req.log.warn({ err: asaasErr, customerId: customer.id }, "Asaas sync failed for new customer");
        } else {
          req.log.warn({ err: asaasErr, customerId: customer.id }, "Unexpected error syncing to Asaas");
        }
      }
    }

    res.status(201).json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Error creating customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requirePermission("customers:read"), async (req, res): Promise<void> => {
  try {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, req.params.id));
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Error getting customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requirePermission("customers:write"), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, document, document_type, address } = req.body;

    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }
    if (name !== undefined && !name) { res.status(400).json({ error: "name cannot be empty" }); return; }

    const [customer] = await db
      .update(customersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(document !== undefined && { document }),
        ...(document_type !== undefined && { documentType: document_type }),
        ...(address?.street !== undefined && { addressStreet: address.street }),
        ...(address?.number !== undefined && { addressNumber: address.number }),
        ...(address?.district !== undefined && { addressDistrict: address.district }),
        ...(address?.city !== undefined && { addressCity: address.city }),
        ...(address?.state !== undefined && { addressState: address.state }),
        ...(address?.zip_code !== undefined && { addressZipCode: address.zip_code }),
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, id))
      .returning();

    // Re-sync to Asaas if already linked, or create if now eligible and not yet linked
    if (process.env.ASAAS_API_KEY) {
      try {
        const asaasCustomer = await createAsaasCustomer({
          name: customer.name,
          cpfCnpj: customer.document ?? undefined,
          email: customer.email ?? undefined,
          mobilePhone: customer.phone ?? undefined,
        });

        if (!customer.asaasCustomerId) {
          await db
            .update(customersTable)
            .set({ asaasCustomerId: asaasCustomer.id })
            .where(eq(customersTable.id, id));
          customer.asaasCustomerId = asaasCustomer.id;
        }
        req.log.info({ customerId: id, asaasId: asaasCustomer.id }, "Customer re-synced to Asaas after update");
      } catch (asaasErr) {
        if (asaasErr instanceof AsaasError) {
          req.log.warn({ err: asaasErr, customerId: id }, "Asaas sync failed on customer update");
        } else {
          req.log.warn({ err: asaasErr, customerId: id }, "Unexpected error syncing to Asaas on update");
        }
      }
    }

    res.json(mapCustomer(customer));
  } catch (err) {
    req.log.error({ err }, "Error updating customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/payments", requirePermission("customers:read"), async (req, res): Promise<void> => {
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
