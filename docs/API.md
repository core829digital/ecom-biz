# REST API v1

Base URL: `https://<APP_URL host>/api/v1`. Create tokens in **Settings → Developers**.

```bash
curl https://app.example.com/api/v1/products -H "Authorization: Bearer sk_…"
```

## Conventions

- JSON in and out. Amounts are **integers in minor units** (1990 = 19.90).
- Lists accept `page` (default 1) and `limit` (default 50, max 250) and return
  `{ data, page, limit, total, has_more }`.
- Errors: `{ "error": { "code", "message" } }` with status `400` (bad JSON/parameter),
  `401` (missing/invalid token), `403` (missing scope or inactive store), `404`, `409`,
  `422` (validation), `429` (rate limit: 120 requests/minute/token, see `Retry-After`).

## Scopes

`read_products`, `write_products`, `read_inventory`, `write_inventory`,
`read_orders`, `write_orders`, `read_customers`, `write_customers`.

## Endpoints

| Method | Path | Scope | Notes |
|---|---|---|---|
| GET | `/shop` | any | Store details and the token's scopes |
| GET | `/products` | read_products | Filters: `status`, `handle`, `updated_since` |
| POST | `/products` | write_products | Body: `title`, `status`, `options[]`, `variants[]` (one per option combination), `images[]` (https URLs), `tags[]`, … |
| GET | `/products/{id}` | read_products | |
| PATCH | `/products/{id}` | write_products | Only fields you send change. `variants: [{ id, price?, sku?, inventory_quantity?, … }]` updates existing variants |
| DELETE | `/products/{id}` | write_products | 204 |
| GET | `/inventory` | read_inventory | Filter: `sku` |
| POST | `/inventory` | write_inventory | `{ variant_id \| sku, available \| adjustment }` |
| GET | `/orders` | read_orders | Filters: `status`, `financial_status`, `fulfillment_status`, `created_since`, `updated_since` |
| GET | `/orders/{id or number}` | read_orders | Includes fulfillments |
| POST | `/orders/{id}/fulfillments` | write_orders | `{ lines?: [{ line_id, quantity }], tracking_company?, tracking_number?, tracking_url?, notify_customer? }` |
| GET | `/customers` | read_customers | Filters: `email`, `updated_since` |
| POST | `/customers` | write_customers | |
| GET | `/customers/{id}` | read_customers | Includes addresses and order count |

### Example: create a product with variants

```json
POST /api/v1/products
{
  "title": "Ceramic Mug",
  "status": "active",
  "options": [{ "name": "Color", "values": ["White", "Black"] }],
  "variants": [
    { "option1": "White", "price": 1250, "sku": "MUG-W", "inventory_quantity": 10 },
    { "option1": "Black", "price": 1350, "sku": "MUG-B" }
  ]
}
```

## Webhooks

Topics: `orders/create`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`, `orders/refunded`,
`products/create`, `products/update`, `products/delete`, `inventory/update`,
`customers/create`, `customers/update`.

Each delivery is a `POST` with body `{ id, topic, created_at, data }` and headers
`X-Webhook-Id`, `X-Webhook-Topic`, `X-Webhook-Timestamp`, `X-Webhook-Signature`.

The signature covers the timestamp and the **raw** body (`<timestamp>.<raw body>`), so a captured
delivery can't be replayed later with a new timestamp. Verify both:

```js
const ts = Number(req.headers["x-webhook-timestamp"]);
if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) throw new Error("stale or missing timestamp");
const expected = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("base64");
const a = Buffer.from(expected), b = Buffer.from(String(req.headers["x-webhook-signature"] ?? ""));
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("invalid signature");
// Deduplicate on X-Webhook-Id: retries reuse the same id.
```

Respond with any `2xx` within 10 seconds. Failed deliveries are retried with
exponential backoff (1 min → ~2 h) up to 8 attempts. Endpoints must be public `https` URLs.
