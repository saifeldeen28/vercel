# 🚚 Delivery Dispatch System

An admin dashboard for managing delivery driver assignments and WhatsApp dispatch notifications. Built with Next.js 14 and deployed on Vercel.

---

## ✨ Features

- **Date-based dispatch** — enter a delivery date to instantly see order count, total earnings, and total COD
- **Geographic clustering** — driver assignments are computed locally using a Hierarchical Agglomerative Clustering (HAC) algorithm with Cairo area coordinates and macro-region groupings
- **Editable assignments** — move or split delivery areas between drivers before sending
- **WhatsApp notifications** — send formatted dispatch summaries to each driver via Green API
- **Shopify webhook integration** — new, paid, fulfilled, and cancelled orders sync automatically to Supabase
- **Daily reconciliation** — a GitHub Actions cron job catches any orders missed by webhooks

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Messaging | Green API (WhatsApp) |
| Deployment | Vercel |
| Automation | GitHub Actions |

---

## 📁 Project Structure

```
app/
  page.tsx                # Main dispatch dashboard
  globals.css             # Tailwind base + custom component classes
  components/
    DispatchEditor.tsx    # Modal for editing driver assignments
    DriverCard.tsx        # Per-driver display card
    StatsCard.tsx         # Reusable summary stat chip

lib/
  deliveryRates.js        # Centralized delivery rates — single source of truth

api/
  dispatch/
    delivery.js           # POST /api/dispatch/delivery — geographic HAC clustering + driver assignment
    drivers-messaging.js  # POST /api/dispatch/drivers-messaging — WhatsApp dispatch messages
    orders-summary.js     # GET  /api/dispatch/orders-summary — order count + earnings + COD
  webhooks/
    new-order.mjs         # POST /api/webhooks/new-order — Shopify order sync + WhatsApp alert
    order-paid.js         # POST /api/webhooks/order-paid — update order status to paid
    order-fulfilled.js    # POST /api/webhooks/order-fulfilled — update order status to fulfilled
    order-cancelled.js    # POST /api/webhooks/order-cancelled — delete order + WhatsApp alert
  reconcile.js            # GET  /api/reconcile — daily safety-net (GitHub Actions cron)

.github/
  workflows/
    reconcile.yml         # Cron: calls /api/reconcile daily at 02:00 UTC
```

---

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your credentials (see [Environment Variables](#-environment-variables) below).

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access — used by dispatch + reconcile endpoints |
| `SUPABASE_ANON_KEY` | Public DB access — used by webhook handlers |
| `GREEN_API_INSTANCE_ID` | Green API instance for admin/driver group notifications |
| `GREEN_API_TOKEN` | Token for the admin/driver instance |
| `GREEN_API_GROUP_CHAT_ID` | WhatsApp group chat ID for admin alerts |
| `GREEN_API_ORDER_INSTANCE_ID` | Separate Green API instance for customer notifications |
| `GREEN_API_ORDER_TOKEN` | Token for the customer instance |
| `GREEN_API_ORDER_CHAT_ID` | WhatsApp chat ID for customer notifications |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin API token (for fetching product images) |
| `SHOPIFY_STORE_DOMAIN` | e.g. `your-store.myshopify.com` |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhook secret for HMAC verification (see setup below) |
| `NEXT_PUBLIC_ADMIN_API_KEY` | Admin API key for dispatch endpoints (see setup below) |
| `CRON_SECRET` | Shared secret protecting the `/api/reconcile` endpoint |

For GitHub Actions, add `CRON_SECRET` and `VERCEL_APP_URL` as repository secrets.

---

## 🔐 Admin API Key Setup

The dispatch endpoints (`/api/dispatch/*`) are protected with API key authentication to prevent unauthorized access to customer data.

### 1. Generate a secure API key

On Linux/Mac:
```bash
openssl rand -base64 32
```

On Windows (PowerShell):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Or use any random password generator (32+ characters recommended).

### 2. Add to environment variables

Add to your `.env.local`:
```bash
NEXT_PUBLIC_ADMIN_API_KEY=your_generated_key_here
```

**Important**: The key must be prefixed with `NEXT_PUBLIC_` to be accessible in the frontend.

### 3. Deploy to Vercel

Add the same key to your Vercel environment variables:
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add `NEXT_PUBLIC_ADMIN_API_KEY` with your generated key
3. Redeploy your application

### Security Notes

- **Key visibility**: The API key will be visible in browser DevTools (Network tab). This is acceptable for single-admin use.
- **Key rotation**: If the key is compromised, generate a new one and update both `.env.local` and Vercel.
- **Never commit**: The `.env.local` file is gitignored. Never commit the actual key to version control.

---

## 🔗 API Endpoints

### Dispatch

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/dispatch/orders-summary` | Order count, total earnings, total COD for a date |
| `POST` | `/api/dispatch/delivery` | Run geographic HAC clustering and return driver assignments |
| `POST` | `/api/dispatch/drivers-messaging` | Send WhatsApp messages to all drivers |

### Shopify Webhooks

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/webhooks/new-order` | Sync new order to Supabase + send WhatsApp alert |
| `POST` | `/api/webhooks/order-paid` | Update order status to `paid` |
| `POST` | `/api/webhooks/order-fulfilled` | Update order status to `fulfilled` |
| `POST` | `/api/webhooks/order-cancelled` | Delete order from DB + send cancellation alert |

### Cron

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/reconcile` | Fetch last 24h Shopify orders and sync any that were missed |

---

## 🔐 Shopify Webhook Setup

All webhook endpoints are protected with HMAC-SHA256 signature verification to ensure only Shopify can trigger them.

### 1. Configure webhooks in Shopify Admin

1. Go to **Settings → Notifications → Webhooks**
2. Create or edit each webhook:
   - **Order creation**: `https://your-domain.vercel.app/api/webhooks/new-order`
   - **Order payment**: `https://your-domain.vercel.app/api/webhooks/order-paid`
   - **Order fulfillment**: `https://your-domain.vercel.app/api/webhooks/order-fulfilled`
   - **Order cancellation**: `https://your-domain.vercel.app/api/webhooks/order-cancelled`
3. Set webhook format to **JSON**
4. Set webhook API version to **2024-01** or later

### 2. Get your webhook secret

1. In Shopify Admin, click on any configured webhook
2. Click **Show** next to "Webhook signing secret"
3. Copy the secret value (format: `shpwhk_...`)

### 3. Add to environment variables

Add the secret to your `.env.local`:
```bash
SHOPIFY_WEBHOOK_SECRET=shpwhk_your_actual_secret_here
```

**Important**: All webhooks configured in your Shopify store share the same signing secret. You only need to configure it once.

### 4. Deploy and test

1. Deploy your changes to Vercel
2. Trigger a test order in Shopify
3. Check Shopify's webhook logs (Settings → Notifications → Webhooks → click webhook → Recent deliveries) to verify successful delivery (HTTP 200)

If you see `401 Unauthorized` errors, double-check that:
- `SHOPIFY_WEBHOOK_SECRET` is correctly set in your Vercel environment variables
- The secret matches the one shown in Shopify admin
- The webhook is sending the `X-Shopify-Hmac-SHA256` header

---

## 📋 Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint
```

---

## 📝 Notes

- **Date format** — the UI uses `DD-MM-YYYY`; all API calls and Supabase queries use `YYYY-MM-DD`. Never mix them.
- **Delivery rates** — all area rates live in `lib/deliveryRates.js`. Edit only that file to update pricing.
- **Two Green API instances** — one for admin/driver group messages, one for customer-facing order confirmations. See `.env.example` for which keys map to which.
- **Reconcile cron** uses `created_at_min` (not `updated_at_min`) to avoid re-pulling old orders that received recent status updates.