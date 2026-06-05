# UpPay Connect

Internal payment infrastructure admin panel for UpFive7, connecting internal systems to Asaas and PagBank.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/uppay-connect run dev` — run the frontend (port 20739, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, base path `/api`)
- Frontend: React + Vite + Wouter routing + Tailwind CSS + shadcn/ui
- Charts: Recharts
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — all database table definitions (one file per domain)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (run codegen to refresh)
- `lib/api-zod/src/generated/` — auto-generated Zod schemas
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/uppay-connect/src/pages/` — all frontend pages
- `artifacts/uppay-connect/src/components/layout.tsx` — sidebar + layout shell
- `artifacts/uppay-connect/src/lib/format.ts` — currency/date/status badge formatters

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → React Query hooks. Never hand-write API calls.
- **Provider routing**: Pix/Boleto/Subscription → Asaas; Credit card/Debit card/Payment link/Checkout → PagBank. Logic lives in `payments.ts`.
- **Amounts in centavos**: All monetary values are integers (centavos). Display with `formatCurrency()` from `lib/format.ts`.
- **UUID primary keys**: All tables use `defaultRandom()` UUIDs.
- **mapPayment helper**: Defined in `dashboard.ts`, imported by `payments.ts` and `customers.ts` — single source of truth for payment serialization.

## Product

Full-stack admin panel with:
- **Dashboard**: KPI summary cards + daily volume chart + payment method/provider/system breakdowns
- **Payments**: Full list with status/provider/method filters + detail view + event timeline + cancel/refund actions
- **Customers**: List + search + detail with payment history
- **Systems**: Manage integrated systems (UpSchedule, CRM WhatsApp, CRM Empresarial, etc.)
- **API Keys**: Create/revoke keys per system with environment scoping
- **Subscriptions**: Recurring billing management
- **Webhooks**: Delivery log with retry support + stats
- **Fees**: Provider fee configuration (Asaas/PagBank rates per method)
- **Audit Logs**: System activity trail
- **Providers**: Manage Asaas/PagBank accounts and priority

## Brand palette

- Primary/CTAs: `#FF6B2B` (orange)
- Links/charts: `#2563EB` (blue)
- Sidebar/text: `#101010` (near black)
- Cards/backgrounds: White / `#F9FAFB`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after editing schema files
- Do NOT import `useState` from `wouter` — it only exports routing primitives
- `mapPayment` is in `dashboard.ts` and must be imported with `.js` extension in ESM context

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
