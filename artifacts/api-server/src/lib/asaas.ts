import { logger } from "./logger.js";

const ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";

function getKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY not configured");
  return key;
}

async function asaasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${ASAAS_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "access_token": getKey(),
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    logger.error({ status: res.status, body, path }, "Asaas API error");
    const msg = (body?.errors as Array<{ description: string }> | undefined)?.[0]?.description
      ?? body?.message as string
      ?? `Asaas error ${res.status}`;
    throw new AsaasError(msg, res.status);
  }

  return body as T;
}

export class AsaasError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "AsaasError";
  }
}

// ─── Customer ────────────────────────────────────────────────────────────────

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
}

export async function createAsaasCustomer(data: AsaasCustomerInput): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD" | "UNDEFINED";

export interface AsaasPaymentInput {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  postalService?: boolean;
}

export interface AsaasPayment {
  id: string;
  status: string;
  billingType: string;
  value: number;
  netValue: number;
  originalValue?: number;
  interestValue?: number;
  feeValue?: number;
  dueDate: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
  invoiceNumber?: string;
  externalReference?: string;
}

export async function createAsaasPayment(data: AsaasPaymentInput): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Pix QR Code ─────────────────────────────────────────────────────────────

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
  allowsMultiplePayments: boolean;
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

// ─── Boleto identification ────────────────────────────────────────────────────

export interface AsaasIdentificationField {
  identificationField: string;
  nossoNumero: string;
  barCode: string;
}

export async function getBoletoDigitableLine(paymentId: string): Promise<AsaasIdentificationField> {
  return asaasFetch<AsaasIdentificationField>(`/payments/${paymentId}/identificationField`);
}

// ─── Webhook registration ─────────────────────────────────────────────────────

export type AsaasWebhookEvent =
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_AWAITING_APPROVAL"
  | "PAYMENT_RESTORED"
  | "PAYMENT_BANK_SLIP_VIEWED"
  | "PAYMENT_CHECKOUT_VIEWED"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED";

const ALL_PAYMENT_EVENTS: AsaasWebhookEvent[] = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_AWAITING_APPROVAL",
  "PAYMENT_RESTORED",
  "PAYMENT_BANK_SLIP_VIEWED",
  "PAYMENT_CHECKOUT_VIEWED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_DUNNING_RECEIVED",
  "PAYMENT_DUNNING_REQUESTED",
];

export interface AsaasWebhookConfig {
  id?: string;
  url: string;
  email: string;
  apiVersion: number;
  enabled: boolean;
  interrupted: boolean;
  authToken: string;
  events: AsaasWebhookEvent[];
}

export async function registerWebhook(config: Omit<AsaasWebhookConfig, "apiVersion" | "events">): Promise<AsaasWebhookConfig> {
  return asaasFetch<AsaasWebhookConfig>("/webhook", {
    method: "POST",
    body: JSON.stringify({
      ...config,
      apiVersion: 3,
      events: ALL_PAYMENT_EVENTS,
    }),
  });
}

export async function getWebhookConfig(): Promise<AsaasWebhookConfig | null> {
  try {
    const result = await asaasFetch<{ data: AsaasWebhookConfig[] }>("/webhook");
    return result.data?.[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Map billing type ─────────────────────────────────────────────────────────

export function toAsaasBillingType(method: string): AsaasBillingType {
  const map: Record<string, AsaasBillingType> = {
    pix: "PIX",
    boleto: "BOLETO",
    credit_card: "CREDIT_CARD",
    debit_card: "DEBIT_CARD",
  };
  return map[method] ?? "UNDEFINED";
}

// ─── Due date (today + N days) ────────────────────────────────────────────────

export function dueDateFromNow(days = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
