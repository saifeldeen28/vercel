# Copilot Instructions

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint via Next.js
```

There are no tests defined in this project.

## Architecture

**Delivery Dispatch System** — Next.js 14 (App Router) admin dashboard for managing Cairo delivery driver assignments with WhatsApp notifications.

### Data flow

1. User enters a date (`DD-MM-YYYY`) → frontend auto-fetches `GET /api/orders-summary`
2. User submits driver count → `POST /api/delivery` queries Supabase, calls Hugging Face ML API for geographic clustering, returns driver assignments
3. User optionally edits assignments in `DispatchEditor` modal
4. User sends `POST /api/drivers-messaging` → Green API sends WhatsApp messages to each driver

Shopify webhooks (`api/webhook.mjs`, `api/order*.js`) write orders to Supabase and send WhatsApp alerts. A GitHub Actions cron at 02:00 UTC calls `GET /api/reconcile` as a safety net to catch missed webhooks.

### Two Green API instances

| Purpose | Env vars |
|---|---|
| Admin/driver group (internal) | `GREEN_API_INSTANCE_ID`, `GREEN_API_TOKEN`, `GREEN_API_GROUP_CHAT_ID` |
| Customer notifications | `GREEN_API_ORDER_INSTANCE_ID`, `GREEN_API_ORDER_TOKEN`, `GREEN_API_ORDER_CHAT_ID` |

`order.js` exclusively uses the customer instance. All other API handlers use the admin/driver instance.

### Supabase key split

- `SUPABASE_SERVICE_ROLE_KEY` — used by `delivery.js`, `reconcile.js`, `orders-summary.js` (bypasses RLS)
- `SUPABASE_ANON_KEY` — used by `webhook.mjs` and `order-*.js` handlers

## Key Conventions

### Date format handling

- **Frontend state / display**: `DD-MM-YYYY` (e.g. `20-02-2026`)
- **API / Supabase**: `YYYY-MM-DD`
- Always convert with `toISODate()` before any API call and `toDisplayDate()` when setting state from a `Date` object. Both helpers live in `app/page.tsx`.

### Delivery rates — single source of truth

`lib/deliveryRates.js` exports `deliveryRates` (object) and `getDeliveryRate(area)` (case-insensitive helper, defaults to 100 EGP). Import from this file everywhere rates are needed — never hardcode rates in API handlers or components.

### Shopify `line_items.properties` filtering

All three files that format WhatsApp messages from Shopify line item properties (`webhook.mjs`, `reconcile.js`, `order.js`) must apply the same filter before including a property:

```js
!propName.includes('appid') &&
!propName.startsWith('__') &&
!propName.startsWith('cl_option')   // intentional: matches both cl_option and cl_options
```

### Delivery time formatting

`webhook.mjs` and `reconcile.js` share a `formatDeliveryTime(value)` helper. Shopify stores delivery time as Unix millisecond timestamps; the helper converts them to `HH:MM` in `Africa/Cairo` timezone. Non-numeric strings pass through unchanged.

### Reconcile uses `created_at_min`, not `updated_at_min`

The reconcile endpoint fetches Shopify orders from the last 24 h using `created_at_min` to avoid re-pulling old orders that recently had a status update.

### `api/orders-summary.js` query param parsing

Uses WHATWG `URL` / `searchParams` (not the deprecated `url.parse()`).

### WhatsApp message format (full order notifications)

1. Order number header
2. Delivery date, day, time, area
3. Customer name (translated to Arabic if English via Google Translate), phone
4. Products with variant, quantity, filtered properties
5. Full address
6. Payment method + COD amount if applicable
7. Order notes

Reconcile messages are prefixed with `⚠️ طلب مُسترجع`. Send with `sendFileByUrl` when product images are available; fall back to `sendMessage` otherwise.

### TypeScript path alias

`@/*` resolves to the repository root (see `tsconfig.json`). Use `@/lib/deliveryRates` — not relative paths — when importing from `lib/`.
