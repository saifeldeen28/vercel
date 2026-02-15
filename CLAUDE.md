# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Delivery Dispatch System** - A Next.js admin dashboard for managing delivery driver assignments and dispatch operations. Drivers are assigned delivery areas/orders for a given date, and can be notified via WhatsApp with their assignments.

**Tech Stack:**
- Next.js 14 (App Router)
- React 18
- TypeScript (strict mode)
- Tailwind CSS
- Supabase (backend/database)
- Green API (WhatsApp messaging integration)

## Architecture

### High-level Structure

The application has two main parts:
- **Frontend**: Single-page React dashboard in `app/page.tsx` (Next.js App Router) with client-side state management
- **Backend**: Vercel serverless functions in `/api` directory handling dispatch logic and Shopify webhook integrations
- **Components**: Reusable React components in `app/components/`
- **Styling**: Tailwind CSS with custom component classes defined in `app/globals.css`
- **Database**: Supabase (PostgreSQL) for persistent order and dispatch data
- **External Integrations**: Hugging Face ML API (driver clustering), Green API (WhatsApp messaging), Shopify webhooks

### Core Data Flow

**Dispatch Process:**
1. User inputs delivery date and driver count in the form on the main page
2. Submission triggers `POST /api/delivery` which:
   - Queries Supabase for orders matching the delivery_date
   - Converts order locations to coordinates
   - Sends to Hugging Face ML API for optimal driver clustering/assignment
   - Calculates earnings and COD collection per driver using delivery rates
   - Returns driver assignments with detailed order information
3. User reviews assignments and can edit them (move/split areas)
4. User sends WhatsApp notifications via `POST /api/drivers-messaging` which:
   - Formats dispatch summary and order details with delivery rates
   - Sends messages via Green API for each driver
   - Returns messaging status with Green API response IDs

**Order Intake Process:**
- Shopify webhooks trigger order creation, payment, fulfillment, and cancellation handlers in `/api/`
- Orders are synced to Supabase with delivery date and area information
- WhatsApp notifications are sent to customers with order details and product images
- Order status is tracked through the `orders` table

### Key Components

**app/page.tsx** (Main Component)
- Manages all dispatch logic and state
- Imports delivery rate mapping from centralized config (`lib/deliveryRates.js`)
- Handles form submission for dispatch creation
- Manages messaging flow and state
- Renders stats cards and driver cards from dispatch results

**app/components/DispatchEditor.tsx** (Modal)
- Edit interface for dispatch assignments
- Drag-and-drop style area movement between drivers (click to select, click driver to move)
- Split functionality to divide one area into two parts for the same driver
- Recalculates earnings and COD collection based on delivery rates
- Uses complex state management with area grouping logic

**app/components/DriverCard.tsx** (Display)
- Shows individual driver's assigned orders, areas, earnings, and COD collection
- Displays WhatsApp message ID from the Green API response

**app/components/StatsCard.tsx** (Display)
- Reusable summary stat component with icon and color variants

### Data Types

Key TypeScript interfaces (defined in page.tsx and DispatchEditor.tsx):
- `Order`: Individual delivery order with address, customer info, COD status
- `DispatchResult`: Single driver's assignment with orders, areas, totals
- `DispatchResponse`: Full response from dispatch API with summary and per-driver results
- `MessagingResponse`: Result of WhatsApp notification batch with per-driver message statuses

## Common Commands

```bash
# Development
npm run dev              # Start dev server at http://localhost:3000

# Production
npm run build           # Build for production
npm start               # Start production server

# Linting
npm run lint            # Run Next.js linter (ESLint)

# No test command currently defined in package.json
```

## Important Implementation Details

### Delivery Rates System
- **Single source of truth**: Centralized in `lib/deliveryRates.js`
- Cairo-based delivery areas with fixed EGP rates per area
- Imported by API endpoints (`api/delivery.js`, `api/drivers-messaging.js`) and frontend (`app/page.tsx`)
- Provides `deliveryRates` object and `getDeliveryRate()` helper function
- Supports case-insensitive area matching via lowercase comparison
- Default rate: 100 EGP if area not found in mapping
- Used to calculate driver earnings, displayed in dispatch editor and WhatsApp messages

### API Endpoints (Vercel Serverless Functions)

**Core Dispatch Endpoints:**
- `POST /api/delivery`:
  - Input: `delivery_date` (YYYY-MM-DD), `drivers_count` (1-20)
  - Process: Queries Supabase for orders, calls Hugging Face ML API for clustering, calculates earnings
  - Output: Driver assignments with orders, areas, earnings, COD collection

- `POST /api/drivers-messaging`:
  - Input: `delivery_date`, `dispatch_results[]` (driver assignments)
  - Process: Formats WhatsApp messages with dispatch summary and order details, sends via Green API
  - Output: Messaging results with Green API response IDs per driver

**Shopify Webhook Handlers:**
- `POST /api/order`: New order from Shopify → sync to Supabase, send customer WhatsApp notification with order summary and product images
- `POST /api/order-paid` / `POST /api/paid`: Update order status to 'paid' in Supabase
- `POST /api/order-fulfilled`: Update order status to 'fulfilled' in Supabase
- `POST /api/order-cancelled`: Delete order from Supabase when cancelled
- `POST /api/webhook`: Debug endpoint for inspecting Shopify webhook payload structure
- `POST /api/test`: Test endpoint for webhook payload analysis

**External API Integrations:**
- **Hugging Face ML API** (`https://saifeldeen28-vercel-ml.hf.space/assign-drivers`): Accepts order coordinates and driver count, returns optimal driver assignments using clustering
- **Green API** (`https://api.green-api.com`): WhatsApp messaging service for driver and customer notifications
- **Supabase**: PostgreSQL database for orders, order items, and delivery tracking
- **Shopify**: Webhook provider for order lifecycle events

### Styling
- Tailwind CSS v3.3 with custom component classes
- Custom Tailwind components in `globals.css`: `.card`, `.btn-primary`, `.input-field`
- CSS variables defined for colors (primary, success, danger, gray shades)
- Responsive design: mobile-first with `md:` and `lg:` breakpoints

### TypeScript Path Alias
- `@/*` resolves to repository root (configured in `tsconfig.json`)
- Currently not used in this codebase (all imports use relative paths)

## File Structure Highlights

```
app/
  layout.tsx              # Root layout, sets page title/description
  page.tsx                # Main dispatch dashboard
  globals.css             # Tailwind + custom component classes
  components/
    DispatchEditor.tsx    # Modal for editing assignments (select/move/split areas)
    DriverCard.tsx        # Driver display component
    StatsCard.tsx         # Summary stat component

lib/
  deliveryRates.js        # Centralized delivery rates config (single source of truth for all areas)

api/
  delivery.js             # Dispatch assignment logic (Supabase → ML API → driver clusters)
  drivers-messaging.js    # WhatsApp message formatting and sending via Green API
  order.js                # Shopify order webhook → sync to Supabase + customer WhatsApp
  order-paid.js           # Shopify order paid webhook → update Supabase status
  order-fulfilled.js      # Shopify order fulfilled webhook → update Supabase status
  order-cancelled.js      # Shopify order cancelled webhook → delete from Supabase
  paid.mjs                # Shopify paid webhook handler (alternative)
  webhook.mjs             # Debug endpoint for webhook payload inspection
  test.js                 # Test endpoint for webhook analysis
```

## State Management Notes

The main page uses React `useState` hooks for all state:
- `deliveryDate`, `driversCount`: Form inputs
- `loading`, `messagingLoading`: Loading states for API calls
- `error`, `messagingError`: Error messages
- `dispatchResult`, `messagingResult`: API response data
- `isEditing`: Modal visibility for DispatchEditor

The DispatchEditor maintains its own internal state for the editing session and doesn't persist changes until user clicks "Save".

## Known Constraints & Implementation Notes

**Frontend State Management:**
- No persistent storage on the frontend (all state is lost on page refresh)
- Area-to-driver assignments are in-memory only until messaging is sent
- Editing UI requires two-click interaction (select area, then select destination driver)
- Requires valid `delivery_date` (YYYY-MM-DD) and `drivers_count` (1-20) to initiate dispatch

**API & Data Flow:**
- Green API credentials are hardcoded in `api/drivers-messaging.js` (should use environment variables)
- Shopify webhook handlers expect specific order attribute structure and delivery_date field
- ML clustering is synchronous and may timeout on very large order volumes (100+ orders)
- WhatsApp messages are rate-limited with 1-second delays between sends to avoid API throttling
