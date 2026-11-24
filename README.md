# Commerce Platform

A white-label, multi-tenant e-commerce platform. Merchants sign up, create one or
more stores, and sell through a hosted storefront on a subdomain or their own
domain. The platform operator earns subscription fees and a transaction fee on
card payments.

No vendor branding is hard-coded: the platform name comes from `PLATFORM_NAME`,
and every storefront uses the merchant's own logo, colors, fonts and copy.

## Features

| Area | What's included |
|---|---|
| **Merchant admin** | Dashboard (KPIs, daily sales, gross profit and margin from cost snapshots, top products, low stock, setup checklist), products with up to 3 options / 100 variants, media uploads, inventory, CSV import/export, manual + automated collections, orders (fulfil with tracking, refund per line with restock, cancel, mark paid, comments, packing slip, printable receipt with VAT summary, CSV export), customers, discount codes, product review moderation with public replies, staff roles with email invitations |
| **Online store** | Theme editor with live preview (colors with automatic contrast, fonts, logo, hero, announcement bar, footer, social links), CMS pages, header/footer menus, custom domains with DNS verification |
| **Storefront** | Home, collections (sorting, pagination), product page with availability-aware variant picker, star ratings and reviews (verified-purchase badge), "email me when it's back in stock", search, cart, one-page checkout, order status page and receipt, customer accounts with address book, SEO (metadata, JSON-LD, sitemap.xml, robots.txt) |
| **Payments** | Stripe Connect Express (destination charges + platform fee), cash on delivery, bank transfer, a dev-only test gateway |
| **Taxes & shipping** | Per-country VAT (inclusive or exclusive, optional tax on shipping), shipping zones with price/condition-based rates |
| **Recovery & retention** | Abandoned-checkout reminder email with a one-click link that restores the cart (attributed when it converts), back-in-stock emails sent automatically on restock, refund or cancellation |
| **Accounts & plans** | Account-level subscription; plans cap stores, products and staff and gate custom domains and the API; usage meter in the admin |
| **Security** | TOTP two-factor auth with recovery codes, session list with remote sign-out, audit log, nonce-based CSP, self-hosted fonts (no third-party requests) |
| **UX** | Store rail and quick switcher (Ctrl/⌘ K), keyboard shortcuts (G then a letter, `?` for help), light/dark/system themes with accent colors, animated landing page |
| **Content & marketing** | Blog with RSS and article structured data, newsletter with double opt-in and consent records (CSV export), contact page with spam protection and an admin inbox, live Google preview, social share image |
| **Notifications** | In-app bell and notification centre with per-type email preferences: orders, low stock, reviews, disputes, failing webhooks, team, billing and security events |
| **Onboarding & legal** | Guided first store, dashboard setup guide; platform Terms, Privacy, Cookie, DPA, Subscriptions and Acceptable Use pages; legal page templates for stores (EU 14-day withdrawal) |
| **Developers** | REST API v1 with scoped, hashed tokens and rate limiting; signed webhooks with retries and delivery logs |
| **Platform admin** | Stores (suspend, plan, fee override, trial extension), plans synced to Stripe Billing, users, GMV and fee reporting |
| **i18n** | English and Italian across admin, storefront and emails (type-checked dictionaries) |

## Architecture

- **Next.js 15 (App Router)** with React Server Components and Server Actions; TypeScript strict.
- **PostgreSQL + Prisma 6.** Every merchant-owned row carries `storeId`; every admin action goes
  through `requireStoreAccess(slug, role)` before touching data.
- **Host-based multi-tenancy** in `src/middleware.ts`:
  - `APP_URL` host → merchant admin, platform admin, API
  - `<slug>.<STOREFRONT_ROOT_DOMAIN>` → that store's storefront
  - any other host → storefront for a *verified* custom domain
  - `/sites/<slug>/…` on the app host → path-based storefront (handy in development)
- **Money** is integer minor units everywhere; rates are basis points. All totals come from one pure,
  tested pricing engine (`src/lib/pricing.ts`) and are recomputed server-side at checkout.
- **Orders** are created from a frozen checkout snapshot inside a transaction that locks the checkout
  row, so a Stripe webhook and the customer's return page can't create duplicates.

```
src/
  middleware.ts            tenant routing
  app/(platform)/          landing, auth, merchant admin (/admin), platform admin (/platform)
  app/(store)/sites/[site] storefront (rewritten from store hosts)
  app/api/                 REST API v1, Stripe webhook, cron, health, TLS ask
  server/                  domain services (checkout, orders, billing, webhooks, …)
  lib/                     pure helpers (pricing, money, i18n, theme, csv, auth, storage)
prisma/                    schema, migrations, seed
tests/unit, tests/e2e      Vitest and Playwright suites
```

## Quick start (local)

Requirements: Node 22, PostgreSQL 16. Step-by-step guide for Windows (WSL + Docker) and Mac, in
Italian: [`docs/AVVIO-LOCALE.md`](docs/AVVIO-LOCALE.md).

```bash
cp .env.example .env            # set DATABASE_URL and a random APP_SECRET
npm ci
npm run db:deploy
SEED_DEMO=true npm run db:seed  # plans + demo store (demo@example.com / demo12345)
npm run dev
```

- Admin: <http://localhost:3000> → log in as `demo@example.com` / `demo12345`
- Demo storefront: <http://demo.localhost:3000> (modern browsers resolve `*.localhost`)
  or <http://localhost:3000/sites/demo>
- Make yourself platform admin: `npm run platform:admin -- you@example.com "Your Name" yourpassword`

Without Stripe keys, checkout offers cash on delivery, bank transfer and (in development only) a
test payment method.

## Configuration

All settings are environment variables; see [`.env.example`](.env.example) for the full, commented list.
The essentials:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public URL of the admin/app host |
| `STOREFRONT_ROOT_DOMAIN` | Stores are served at `<slug>.<this>` |
| `APP_SECRET` | 32+ random bytes; also encrypts 2FA secrets, so never rotate it casually |
| `PLATFORM_NAME` | Your white-label platform name |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments + merchant subscriptions |
| `PLATFORM_FEE_BPS` | Default fee on card payments (plans can override) |
| `SMTP_URL`, `EMAIL_FROM` | Transactional email (logged to the console when empty) |
| `STORAGE_DRIVER` (`local` \| `s3`) + `S3_*` | Upload storage (S3, R2, MinIO, …) |
| `CRON_SECRET` | Protects `/api/cron/*` |
| `BILLING_ENFORCED` | Pause stores without an active/trialing subscription |
| `DIRECT_DATABASE_URL` | Serverless only: direct (non-pooled) URL used by `vercel-build` for migrations |
| `CUSTOM_DOMAIN_TARGET` | CNAME target shown to merchants (e.g. `cname.vercel-dns.com` on Vercel) |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Vercel only: register merchants' verified custom domains on the project |

## Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run in production |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a running, seeded server |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations and seed |
| `npm run platform:admin -- <email> [name] [password]` | Create or promote a platform administrator |

## Stripe setup

1. Enable **Connect** (Express accounts) in your Stripe dashboard.
2. Set the three Stripe environment variables.
3. Add two webhook endpoints, both pointing to `https://<APP_URL host>/api/webhooks/stripe`:
   - **Account** endpoint → `STRIPE_WEBHOOK_SECRET`: `payment_intent.succeeded`, `payment_intent.payment_failed`,
     `charge.refunded`, `checkout.session.completed`, `customer.subscription.created|updated|deleted`,
     `invoice.payment_failed`
   - **Connect** endpoint ("events on connected accounts") → `STRIPE_CONNECT_WEBHOOK_SECRET`: `account.updated`
4. Merchants connect their payout account from **Settings → Payments**.
5. Create plans in **/platform/plans**; Stripe Prices are created automatically.

## Scheduled jobs

Call with `Authorization: Bearer $CRON_SECRET`:

- `GET /api/cron/webhooks`, every 5 minutes: retries failed webhook deliveries
- `GET /api/cron/cleanup`, hourly: expires abandoned checkouts (cancelling unpaid PaymentIntents),
  purges expired sessions, rate-limit buckets and stale carts
- `GET /api/cron/recovery`, every 15–30 minutes: sends one reminder per abandoned checkout
  (1–48 hours after the last activity, only when the shopper typed an email; merchants can turn it off
  in **Settings → Checkout**)

## Security notes

- Passwords: bcrypt (cost 12). Sessions: random tokens, only SHA-256 stored, httpOnly + SameSite cookies.
- Rate limiting (Postgres-backed) on login, signup, password reset, checkout and the API.
- Customer accounts are activated by email link, so nobody can claim another shopper's order history.
- Uploads are validated by magic bytes; SVG is rejected; files are served with `nosniff` and a sandbox CSP.
- Merchant content is rendered by a safe rich-text renderer (no raw HTML).
- Webhook destinations are checked against private/internal IP ranges (SSRF protection).
- CSV exports neutralise spreadsheet formula injection.
- Stripe webhooks are signature-verified and processed idempotently.
- Staff accounts support TOTP 2FA; TOTP secrets are sealed with AES-256-GCM and recovery codes are hashed.
- Sensitive admin actions are written to a per-store audit log.
- A strict, nonce-based Content Security Policy is applied to every page.

## Deployment

Two supported targets:

- **Docker** (any VPS): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), Docker Compose + Caddy with automatic HTTPS for
  subdomains and custom domains.
- **Vercel + Neon + R2**: `vercel.json` (EU region, cron jobs) and the `vercel-build` script are included;
  custom domains are registered through the Vercel API. Uploads are capped at 4 MB there.

Sizing, costs and a step-by-step guide (in Italian): [docs/DEPLOY-PRODUZIONE.md](docs/DEPLOY-PRODUZIONE.md).
API reference: [docs/API.md](docs/API.md).

## Known limitations

- Fiscal e-invoicing (e.g. Romania's e-Factura, Italy's SdI) is not included: the printable receipt is
  explicitly not a tax invoice. Export orders as CSV or integrate a certified provider through the API/webhooks.
- One VAT rate per order (the store's rate for the destination country); reduced rates per product are not supported yet.
- Discounts apply to the whole order (no product- or collection-specific discounts yet).
- No built-in carrier rate APIs; shipping uses flat or condition-based rates.
- No multi-currency storefront (one currency per store) and no gift cards yet.
