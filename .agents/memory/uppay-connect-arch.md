---
name: UpPay Connect Architecture
description: Key non-obvious decisions for the UpPay Connect project (provider routing, amount encoding, shared helpers)
---

## Provider routing rule
Pix / Boleto / Subscription → Asaas
Credit card / Debit card / Payment link / Checkout → PagBank
Lives in `artifacts/api-server/src/routes/payments.ts` `routeProvider()`.

**Why:** Business requirement — Asaas handles Brazilian bank instruments; PagBank handles card network.

**How to apply:** Any new payment method must be added to this function before going live.

## Amounts are always centavos (integers)
All monetary DB columns are `integer`. Display via `formatCurrency(centavos)` in `lib/format.ts`.

**Why:** Avoids floating-point rounding issues for financial data.

## mapPayment is in dashboard.ts
The canonical payment serializer `mapPayment` is exported from `dashboard.ts` and imported by `payments.ts` and `customers.ts`.

**Why:** Single source of truth; avoids drift between list and detail responses.

## wouter only exports routing primitives
`useState` must come from `react`, not `wouter`. Design subagent made this mistake once in `payments.tsx`.
