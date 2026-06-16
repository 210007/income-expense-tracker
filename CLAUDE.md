# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

No test suite is configured.

## Environment Variables

Create a `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox          # sandbox | development | production
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # optional — AddressAutocomplete degrades to plain text without it
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=             # from `stripe listen` locally or Stripe dashboard webhook signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_INVOICING_PRICE_ID=         # Stripe Price ID for the Invoicing module subscription
STRIPE_ESTIMATES_PRICE_ID=         # Stripe Price ID for the Estimates module ($6/mo)
STRIPE_TIME_TRACKING_PRICE_ID=     # Stripe Price ID for the Time Tracking module ($9/mo)
STRIPE_ACCOUNTS_PAYABLE_PRICE_ID=  # Stripe Price ID for the Accounts Payable module ($6/mo)
STRIPE_PROJECTS_PRICE_ID=          # Stripe Price ID for the Projects module ($9/mo)
STRIPE_TAX_PRICE_ID=               # Stripe Price ID for the Tax Reporting module ($6/mo)
STRIPE_INVENTORY_PRICE_ID=         # Stripe Price ID for the Inventory module ($12/mo)
STRIPE_TEAM_PRICE_ID=              # Stripe Price ID for the Team Access module ($15/mo)
STRIPE_RECURRING_PRICE_ID=         # Stripe Price ID for the Recurring Transactions module ($6/mo)
STRIPE_SCHEDULING_PRICE_ID=        # Stripe Price ID for the Scheduling module ($9/mo)
CRON_SECRET=                       # Random secret string — add to Vercel env vars too; guards /api/cron/* routes
```

## Architecture

**SoloBooks** is a bookkeeping app for small businesses and freelancers. Stack: Next.js 16 App Router + TypeScript + Tailwind CSS v4 + Supabase + Plaid.

### Supabase clients

Two clients with different privilege levels:
- `lib/supabaseClient.ts` — browser client using the anon key; used in all `"use client"` pages
- `lib/supabaseServer.ts` — server client using the service role key; use only in API routes when you need to bypass RLS

API routes authenticate users by accepting a Supabase JWT in the `Authorization: Bearer <token>` header, then calling `supabase.auth.getUser()` to resolve the identity. The client passes `session.access_token` from `supabase.auth.getSession()`.

### Page architecture

The Navbar (`components/Navbar.tsx`) hides itself on `/` and `/login`. All authenticated pages live under routes that the Navbar covers.

Most pages are pure `"use client"` components that check `supabase.auth.getSession()` on mount and redirect to `/login` if unauthenticated. The exceptions are thin server wrappers (e.g. `app/transactions/page.tsx`) that add a `<Suspense>` boundary around the real client component.

### Database schema

All tables have RLS enabled — queries from the browser client are automatically scoped to the authenticated user.

| Table | Purpose |
|---|---|
| `transactions` | Core table: `id`, `user_id`, `txn_date`, `type` (income/expense), `amount`, `vendor`, `description`, `category`, `plaid_transaction_id`, `plaid_account_id`, `source` |
| `receipts` | Receipt attachments: `id`, `transaction_id` |
| `categories` | Per-user categories: `name`, `type` (income/expense/both) |
| `plaid_items` | Bank connections: `item_id`, `access_token`, `user_id` |
| `customers` | Customer records: `name`, `email`, `phone`, `address`, `notes` |
| `customer_fields` | User-defined extra field definitions: `label`, `field_type` (text/number/date/boolean) |
| `customer_field_values` | Values per customer per custom field (stored as `text` regardless of type) |
| `user_modules` | Active module subscriptions: `module` (e.g. `invoicing`), `stripe_subscription_id`, `status` |
| `invoices` | Invoice headers: `customer_id`, `invoice_number`, `status` (draft/sent/paid/void), `issue_date`, `due_date` |
| `invoice_items` | Line items: `invoice_id`, `description`, `quantity`, `unit_price` |

### Plaid integration

`lib/plaid.ts` exports a singleton `plaidClient`. The bank flow is:
1. `POST /api/plaid/create-link-token` — creates a Plaid Link token
2. `ConnectBankButton` opens Plaid Link via `react-plaid-link`
3. `POST /api/plaid/exchange-public-token` — exchanges the token and stores the access token in `plaid_items`
4. `POST /api/plaid/import-transactions` — pages through all linked items and upserts transactions using `plaid_transaction_id` as the conflict key (last 30 days)

### Database migrations

Migrations are SQL files in `supabase/migrations/`. Apply them manually via the Supabase Dashboard SQL Editor — the Supabase CLI is not configured for this project. See `MIGRATION.md` for the project URL.
