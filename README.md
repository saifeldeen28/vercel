# 🚚 Delivery Dispatch System

An admin dashboard for managing delivery driver assignments and WhatsApp dispatch notifications. Built with Next.js 14 and deployed on Vercel.

---

## ✨ Features

- **Date-based dispatch** — enter a delivery date to instantly see order count, total earnings, and total COD
- **ML-powered clustering** — driver assignments are optimized via a Hugging Face API that clusters orders geographically
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
    delivery.js           # POST /api/dispatch/delivery — ML clustering + driver assignment
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
| `CRON_SECRET` | Shared secret protecting the `/api/reconcile` endpoint |

For GitHub Actions, add `CRON_SECRET` and `VERCEL_APP_URL` as repository secrets.

---

## 🔗 API Endpoints

### Dispatch

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/dispatch/orders-summary` | Order count, total earnings, total COD for a date |
| `POST` | `/api/dispatch/delivery` | Run ML clustering and return driver assignments |
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