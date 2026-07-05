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

## Auth — web-only, mobile routes removed
The `replit-auth` skill template includes mobile token exchange routes that import `ExchangeMobileAuthorizationCodeBody` etc. from `@workspace/api-zod`. Those schemas are only generated if mobile endpoints exist in the OpenAPI spec. For web-only apps: remove mobile imports + route handlers from `auth.ts`, and remove `deleteSession`/`ISSUER_URL` from the import list.

**Why:** This app is a web internal panel — no mobile. Adding the full spec just to satisfy the template would bloat the API unnecessarily.

## lib/replit-auth-web needs vite/client types
Add `"types": ["vite/client"]` to `lib/replit-auth-web/tsconfig.json` and `vite: "catalog:"` to its `devDependencies`. Without this, `import.meta.env.BASE_URL` causes a TS2339 error during `typecheck:libs`.

## drizzle-orm query builders are lazy — `void db.update(...)` never runs
A bare `void db.update(table).set(...).where(...)` (no `await`, `.then()`, or `.catch()`) silently never executes the query — drizzle's `QueryPromise` only fires on `.then()`. TypeScript compiles it fine and no error is thrown anywhere.

**Why:** Discovered while adding fire-and-forget side-effect updates (e.g. `lastUsedAt` tracking, auto-expiring API keys) in `apiKeyAuth.ts` — the DB rows never changed despite no errors in logs, since silence is the default failure mode.

**How to apply:** For any "fire-and-forget" DB write, always attach `.catch((err) => log.error(...))` at minimum so the query actually executes and failures are visible. Never use `void db.<verb>(...)` alone.
