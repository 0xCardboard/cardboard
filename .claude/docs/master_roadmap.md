# Cardboard — Unified Roadmap

> **Single source of truth.** Replaces all previous roadmap documents (roadmap.md, production_roadmap.md, PLAN1–PLAN4).
> **Updated:** 2026-02-18
> **Status:** Phases 1A–1D complete. Phase 1E partially complete (see audit notes below).

---

## Executive Summary

Cardboard is a P2P marketplace for trading graded trading cards (Pokémon, One Piece, MTG, etc.) that combines exchange-style order books with physical card custody ("vaulting"). This roadmap covers everything from MVP completion through market-ready production platform.

**Revenue model:**

| Stream | Mechanism | Phase |
|--------|-----------|-------|
| Trading fee | 5% per trade (seller-side) | MVP (Phase 2) |
| Swap fee | Flat $5–10 per vaulted card swap | Phase 8 |
| Lending spread | 15% of interest payments on collateralized loans | Phase 10 |

**Non-revenue but strategic:** Collection tracking, Pokédex completion, and price alerts drive vault deposits (inventory) and engagement (DAU), which feed the trading fee revenue engine.

---

## How to Read This Roadmap

Phases 1–4 complete MVP functionality and harden it for production use. Phases 5–6 add compliance and physical operations. Phases 7–11 build differentiation and new revenue. Mobile follows after web stability.

Each initiative includes effort estimates (S/M/L/XL ≈ 1/2–3/3–5/4–6 weeks), dependencies, and technical scope. Items marked **✅ DONE** are merged to main. Items marked **⚠️ PARTIAL** have code that exists but has gaps.

---

## Phase 0: Foundation (COMPLETE)

| Sub-phase | Description | Status |
|-----------|-------------|--------|
| 1A | Auth (custom JWT + refresh token rotation with family-based detection), service layer, Vitest, Prisma schema (19 models, 11 enums) | ✅ Done |
| 1B | Card catalog (Pokemon TCG + One Piece sync adapters), browse/detail UI, paginated search | ✅ Done |
| 1C | Order book, price-time priority matching engine, card instances, trading pipeline, wash trade detection integration | ✅ Done |
| 1D | Stripe escrow (authorize → capture → transfer), shipping, verification (PSA cert lookup via OAuth2), disputes | ✅ Done |

**Built infrastructure:** 16 services, 49 API routes, 25 UI components, 5 BullMQ workers (card-sync, order-matching, payment-processing, ship-deadline, wash-trade), WebSocket server with 3 channels, Redis sliding window rate limiting.

---

## Phase 1: Quick Fixes & Order Book Polish

> **Theme:** Fix known bugs and enforce business rules before adding features.
> **Effort:** S (1 week)
> **Dependencies:** None

### 1.1 — Platform Fee Correction

**Problem:** `matching.service.ts:4` defaults to 3% (`PLATFORM_FEE_RATE || "0.03"`) but landing page advertises 5%.

**Changes:**
- `src/services/matching.service.ts:4` — change default from `"0.03"` to `"0.05"`
- `.env.example` — set `PLATFORM_FEE_RATE=0.05`
- Verify landing page copy matches (currently shows 5% — correct)

### 1.2 — Fill-or-Kill Market Orders

**Problem:** Market orders currently rest as OPEN if no liquidity exists. Should fill what's available and auto-cancel the remainder.

**Changes in `matching.service.ts`:**
- After matching loop exits with unfilled market order quantity:
  - `filledQuantity > 0`: PARTIALLY_FILLED → CANCELLED, notify "Market order partially filled — {filled}/{total}, remainder cancelled due to insufficient liquidity"
  - `filledQuantity === 0`: CANCELLED, notify "Market order cancelled — no matching orders available"
- Add `cancelledRemainder: number` to `MatchResult`

**Changes in `order.service.ts`:**
- After `matchOrder()`, if MARKET and now CANCELLED → clean up card instance (same as cancel logic for sell orders)

### 1.3 — PSA-Only at Launch

**Problem:** BGS and CGC cert lookups fall back to manual verification with no real API.

**Changes:**
- `src/services/order.service.ts` — reject sell orders with `gradingCompany` other than PSA: "Only PSA graded cards are accepted at this time. BGS and CGC support coming soon."
- `src/services/card-instance.service.ts` — same validation on CardInstance registration
- Buy orders: `gradingCompany` filter allows only PSA (or null for "any")
- Landing page FAQ — add note about PSA-only for launch
- Keep `GradingCompany` enum as-is (PSA, BGS, CGC) for future compatibility

### 1.4 — Seller Shipping Deadline (3 Business Days)

**Problem:** No deadline for seller to ship after trade match. Buyers wait indefinitely.

**New BullMQ job:** `src/jobs/ship-deadline.worker.ts`
- On trade creation + payment capture → enqueue delayed job (3 business days)
- Job checks: does inbound shipment exist for this trade?
  - No shipment → auto-cancel trade, refund buyer via `cancelEscrow()`, notify both, penalize seller reputation
  - Shipment exists but not delivered → no action
- Business day calculation: skip Sat/Sun (no holiday calendar for V1)

**Schema addition on Trade:**
```prisma
shipDeadline    DateTime?
```

**Trigger in `escrow.service.ts`:** After `processTradePayment()` → `shipDeadlineQueue.add('check-shipment', { tradeId }, { delay: calculateBusinessDayDelay(3) })`

---

## Phase 2: Auth Hardening, Real-Time & Search

> **Theme:** Make the platform trustworthy and fast before adding features.
> **Effort:** L (3–5 weeks)
> **Dependencies:** Phase 1

### 2.1 — Auth Hardening

The current auth system (custom JWT + refresh token rotation with family chaining) works but is missing critical flows for a production platform.

**2.1a — Password Reset / Forgot Password**

**Effort:** S (3–5 days)

New endpoints:
- `POST /api/auth/forgot-password` — accepts email, generates time-limited reset token (1 hour), sends email with reset link
- `POST /api/auth/reset-password` — accepts token + new password, validates token, updates password, invalidates all existing refresh token families

Schema addition on User:
```prisma
resetToken          String?
resetTokenExpiresAt DateTime?
```

New service method: `auth.service.ts → requestPasswordReset(email)`, `resetPassword(token, newPassword)`

UI: `/forgot-password` page with email input, `/reset-password/[token]` page with new password form.

**2.1b — Email Verification at Registration**

**Effort:** S (3–5 days)

Flow changes:
- On registration → generate verification token, send verification email
- `User.emailVerified` field (Boolean, default false)
- Until verified: user can browse but cannot place orders, create card instances, or initiate shipments
- Persistent banner: "Verify your email to start trading"
- Resend verification endpoint: `POST /api/auth/resend-verification`

Schema addition:
```prisma
emailVerified          Boolean  @default(false)
emailVerificationToken String?
```

**2.1c — Two-Factor Authentication (2FA/MFA)**

**Effort:** M (1–2 weeks)

Implementation:
- TOTP-based (Google Authenticator, Authy compatible)
- `POST /api/auth/2fa/setup` — generate secret, return QR code URI
- `POST /api/auth/2fa/verify` — verify TOTP code to enable 2FA
- `POST /api/auth/2fa/disable` — disable with password confirmation
- Login flow: if 2FA enabled → return `{ requires2FA: true }`, client shows TOTP input → `POST /api/auth/2fa/challenge`
- Backup codes: generate 10 one-time-use codes on setup

Dependencies: `otplib` package for TOTP generation/verification

Schema additions:
```prisma
twoFactorEnabled Boolean  @default(false)
twoFactorSecret  String?
backupCodes      String[] @default([])
```

**2.1d — Account Deletion (GDPR)**

**Effort:** S (3–5 days)

- `POST /api/auth/delete-account` — requires password confirmation
- Soft delete: set `User.deletedAt`, anonymize PII (email → hash, name → "Deleted User")
- Hard requirement: no active orders, no in-transit shipments, no active loans, no pending swaps
- If user has VERIFIED cards in vault: require redemption first
- 30-day grace period before hard anonymization (allows recovery)
- All refresh tokens invalidated immediately

### 2.2 — Wire WebSocket to OrderBook Component

**⚠️ PARTIAL:** WebSocket server exists (`src/lib/websocket.ts`, `src/lib/ws-server.ts`), hooks exist (`src/hooks/useWebSocket.ts`, `useOrderBook`), channels defined (`orderbook:{cardId}`, `notifications:{userId}`, `trades:{cardId}`). But the `OrderBook.tsx` component polls the API instead of using the WebSocket hook.

**Effort:** S (2–3 days)

**Changes:**
- `src/components/marketplace/OrderBook.tsx` — replace polling `useEffect` with `useOrderBook(cardId)` hook
- Hook already returns `{ bids, asks, lastTrade }` from WebSocket channel
- Add reconnection logic and fallback to polling if WebSocket disconnects
- `TradeHistory.tsx` — wire to `trades:{cardId}` channel for real-time trade feed
- `NotificationBell.tsx` — wire to `notifications:{userId}` channel (currently polls)

### 2.3 — Search & Catalog Performance

**⚠️ PARTIAL:** Current search uses Prisma `contains` (case-insensitive LIKE query). Works for small catalogs but will be a bottleneck at full catalog scale (10K+ cards).

**Effort:** M (1–2 weeks)

**Changes:**
- Add PostgreSQL `pg_trgm` extension + GIN trigram index on `Card.name`
- Replace Prisma `contains` with raw SQL trigram search for card name queries (Prisma `$queryRaw`)
- New endpoint: `GET /api/cards/autocomplete?q=char` — returns top 10 card name matches in < 100ms
- Add Redis caching layer for popular search queries (TTL 5 minutes)
- New trending endpoint: `GET /api/cards/trending` — cards with most trades in last 7 days

**Autocomplete UI:**
- `src/components/marketplace/SearchAutocomplete.tsx` — debounced input with dropdown results
- Wire into CardBrowser page header and global search bar
- Show card name, set, game, and thumbnail in results

### 2.4 — Email Notification Triggers + HTML Templates

**⚠️ PARTIAL:** `email.service.ts` exists with adapter pattern (Resend + console fallback) and checks `UserSettings` preferences. But no triggers are wired — no emails actually send. Templates are text-only.

**Effort:** M (1–2 weeks)

**Email triggers to add:**
- Trade filled (buyer + seller)
- Verification result (approved/rejected)
- Dispute opened/resolved
- Shipping deadline approaching (1 day warning)
- Shipping deadline missed (auto-cancel notification)
- Welcome email on registration
- Email verification
- Password reset
- Wash trade alert (admin)

**HTML template system:**
- Create `src/lib/email-templates/` directory
- Base layout template with Cardboard branding
- Per-event templates using React Email or MJML
- Text fallback for every HTML template
- Unsubscribe link in footer (updates UserSettings preferences)

**Settings UI addition:**
- `src/components/profile/SettingsTab.tsx` — add toggles for each notification type (UserSettings fields already exist: `emailOnTrade`, `emailOnShipment`, `emailOnVerification`, `emailOnMarketing`)

### 2.5 — Remaining Phase 1E Items (Audit Status)

These items from the original Phase 1E are already built:

| Item | Status | Notes |
|------|--------|-------|
| Redis sliding window rate limiting | ✅ Done | `src/lib/rate-limit.ts`, middleware applied to routes |
| Anti-wash-trade detection | ✅ Done | `wash-trade-detector.service.ts` (133 lines), 3 detection rules, BullMQ worker |
| Notification bell + dropdown + page | ✅ Done | Bell, dropdown (last 5), full page with filters, mark-read |
| WebSocket infrastructure | ✅ Done | Server exists, channels defined, hooks written |
| WebSocket → UI wiring | ❌ Not done | See 2.2 above |
| Email notification triggers | ❌ Not done | See 2.4 above |

---

## Phase 3: Data, Profiles & Portfolio

> **Theme:** Give users reasons to check Cardboard daily — price data, portfolio insights, reputation.
> **Effort:** L (3–5 weeks)
> **Dependencies:** Phase 2

### 3.1 — Price History Service (OHLCV)

**Effort:** M (2–3 weeks)

New service: `src/services/price-history.service.ts`
- `recordTrade(cardId, price, quantity)` — called after each trade in matching.service.ts
- `getOHLCV(cardId, interval, startDate, endDate)` — aggregates trades into candles (1h, 4h, 1d, 1w intervals)
- `getLatestPrice(cardId)` — last trade price
- `getPriceChange(cardId, period)` — % change over 24h, 7d, 30d
- PriceHistory model already exists in schema — populate from trades

BullMQ job: `price-aggregation` — runs hourly, pre-computes OHLCV candles from raw trades for common intervals

Card detail page additions:
- Interactive price chart (candlestick for OHLCV data)
- Volume bars below price chart
- Price comparison: Cardboard price vs. external market price (from catalog sync)

### 3.2 — Portfolio Upgrades (Valuation, Gain/Loss, Cost Basis)

**⚠️ PARTIAL:** `portfolio.service.ts` exists (51 lines) with basic card list + summary. But fetches ALL user instances for summary (N+1 problem), no value-over-time, no gain/loss, no cost basis.

**Effort:** M (2–3 weeks)

**Upgrades to `portfolio.service.ts`:**
- `getPortfolioValue(userId)` — optimized single query with SUM aggregation (replace N+1)
- `getPortfolioHistory(userId, period)` — daily snapshots of total value (needs BullMQ job to snapshot daily)
- `getCostBasis(userId)` — for each owned card: acquisition price (trade price paid or declared value at import)
- `getGainLoss(userId)` — per-card unrealized P&L: current market price vs. cost basis
- `getPortfolioBreakdown(userId)` — value by game, by set, by card

Schema addition on CardInstance:
```prisma
acquisitionPrice  Int?      // cents — price paid to acquire (from trade or declared at import)
acquiredAt        DateTime? // when ownership was gained
```

BullMQ job: `portfolio-snapshot` — runs daily at midnight, stores total value per user for history charting

Portfolio UI upgrades:
- Line chart: portfolio value over time
- Per-card: current value, cost basis, unrealized gain/loss (green/red)
- Summary: total value, total cost basis, total unrealized P&L
- Export: CSV download for tax reporting

### 3.3 — Reputation Scoring

**⚠️ PARTIAL:** `Reputation` model exists in schema (score field always 0), `Review` model exists but no UI.

**Effort:** S (1 week)

New service: `src/services/reputation.service.ts`
- `calculateReputation(userId)` — computes score from: completed trades (weight: 40%), average review rating (30%), account age (15%), verification status (15%)
- `updateReputation(userId)` — called after trade completion, review submission
- `getReputationBadge(score)` — maps score to tier: New (0–10), Bronze (11–50), Silver (51–100), Gold (101–250), Platinum (250+)

Trigger: `matching.service.ts` → after trade completion → `updateReputation(buyerId)` + `updateReputation(sellerId)`

UI: Reputation badge displayed next to username throughout the app (order book, trade history, swap proposals, profiles)

### 3.4 — Public Profiles

**Effort:** M (1–2 weeks)

New page: `src/app/(marketplace)/profile/[userId]/page.tsx`
- Public collection showcase (VERIFIED cards user has marked as public)
- Trade stats: total trades, volume, avg trade size
- Reputation badge + score breakdown
- Recent reviews received
- Member since date

Profile settings addition: toggle cards as "showcase" in portfolio (boolean on CardInstance or separate showcase list)

---

## Phase 4: Dashboard, Digitization & Listing

> **Theme:** Complete the core product loop — users can discover, buy, sell, and manage cards end-to-end.
> **Effort:** XL (4–6 weeks)
> **Dependencies:** Phase 3

### 4.1 — Homepage Dashboard (Logged-In Users)

**Effort:** M (1–2 weeks)

Current state: all users see the marketing landing page.

**Changes:**
- Logged-in users see a dashboard at `/` with:
  - Portfolio summary (total value, daily change)
  - Active orders (open bids/asks with status)
  - Recent trades
  - Watchlist highlights (Phase 9 — stub until then)
  - Trending cards (from Phase 2.3 trending endpoint)
  - Notifications preview
- Non-logged-in users continue to see marketing landing page

### 4.2 — R2 Upload Service + Card Digitization

**Effort:** L (3–4 weeks)

New service: `src/services/upload.service.ts`
- `uploadCardImage(cardInstanceId, file, imageType: 'front' | 'back' | 'cert')` — uploads to Cloudflare R2, returns URL
- `getCardImages(cardInstanceId)` — returns all images for a card
- `deleteCardImages(cardInstanceId)` — cleanup on redemption

New model:
```prisma
model CardDigitization {
  id              String   @id @default(cuid())
  cardInstanceId  String   @unique
  assignedToId    String?
  frontImageUrl   String?
  backImageUrl    String?
  certImageUrl    String?
  certVerified    Boolean  @default(false)
  conditionMatch  Boolean  @default(false)
  slabIntact      Boolean  @default(false)
  status          DigitizationStatus @default(PENDING)
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  cardInstance    CardInstance @relation(fields: [cardInstanceId], references: [id])
  assignedTo      User?        @relation("DigitizationAssignments", fields: [assignedToId], references: [id])
}

enum DigitizationStatus {
  PENDING
  ASSIGNED
  IN_PROGRESS
  APPROVED
  REJECTED
}
```

New CardInstance statuses: Add `DIGITIZING`, `ARCHIVED`, `LOST` to `CardInstanceStatus` enum.

Admin digitization workflow:
1. Card arrives → admin claims task (sets `assignedToId`)
2. Upload front/back/cert photos
3. Checklist: cert verified ✓, condition match ✓, slab intact ✓
4. **Auto-reject on any failed check** → reject, refund, return card
5. Approve → card becomes VERIFIED, admin assigns vault location (Phase 7)

Admin UI: `src/app/(admin)/digitization/page.tsx`
- Queue of PENDING cards, sortable by arrival date
- Claim button (assigns to current admin)
- Digitization form: photo upload areas, checklist toggles, approve/reject
- Cert number search: admin types cert number → finds card in queue
- Metrics: cards processed per admin, avg processing time

### 4.3 — Redemption Cleanup + Lost Card Handling

**Effort:** S (1 week)

**Redemption flow completion:**
- User redeems → outbound shipment created → shipment delivered → CardInstance → `ARCHIVED`
- Delete digitization record + images from R2

**Lost card handling:**
- Admin marks shipment as `EXCEPTION` → "Mark as Lost" button
- Inbound lost: seller's card lost → refund buyer, notify both, CardInstance → `LOST`
- Outbound lost (redemption): card lost during return shipping → notify user, trigger insurance claim (Phase 9), CardInstance → `LOST`

### 4.4 — Batch Shipments

**Effort:** S (1 week)

New model:
```prisma
model BatchShipment {
  id            String   @id @default(cuid())
  userId        String
  trackingNumber String?
  carrier       String?
  status        ShipmentStatus @default(PENDING)
  shipments     Shipment[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Schema addition on Shipment: `batchShipmentId String?`

Flow: user ships multiple cards in one package → one tracking number → all associated shipments transition together.

### 4.5 — Listing Wizard (/sell Page)

**Effort:** M (1–2 weeks)

Current state: users must navigate to card detail and use the inline order form.

New page: `src/app/(marketplace)/sell/page.tsx`

Step-by-step wizard:
1. **Select card** — search catalog, pick the card you're selling
2. **Card details** — enter cert number, grading company (PSA only), grade
3. **Set price** — choose order type (LIMIT with price, or MARKET), see current order book for reference
4. **Review & submit** — summary of listing, fee estimate (5%), confirm

Creates CardInstance (PENDING_SHIPMENT) + Order in one flow.

### 4.6 — Carrier / Shipping Integration

**Effort:** M (2–3 weeks)

Current state: shipments tracked manually with user-entered tracking numbers. No API integration.

**Integration with EasyPost (or similar):**
- `src/services/carrier.service.ts`
  - `generateLabel(shipmentId, fromAddress, toAddress, weight)` — creates shipping label via API
  - `getTrackingUpdates(trackingNumber)` — fetches real-time tracking from carrier
  - `estimateDeliveryDate(fromZip, toZip, carrier)` — delivery time estimate
  - Webhook handler for tracking status updates
- Auto-update shipment status from carrier webhooks (IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED)
- Display estimated delivery date on shipment tracking UI
- Generate printable shipping labels from admin and user interfaces

---

## Phase 5: Infrastructure & Scale

> **Theme:** Prepare the engine for real volume before opening the floodgates.
> **Effort:** M (2–3 weeks)
> **Dependencies:** Phase 4

### 5.1 — Unified Worker Process

**Effort:** S (3–5 days)

New entry point: `src/jobs/worker.ts`
- Single process that starts all BullMQ workers: card-sync, order-matching, payment-processing, ship-deadline, wash-trade
- Health check endpoint for worker process
- Graceful shutdown handling
- Docker Compose service: `worker` alongside `web`

### 5.2 — Redis Sorted Set Matching Engine

**Effort:** M (2–3 weeks)

**Problem:** Current matching engine uses Prisma DB queries for price-time priority matching. This works for MVP volume but will be a bottleneck at scale — every match requires multiple DB round-trips inside a transaction.

**Migration plan:**
- Maintain order book state in Redis sorted sets: `orderbook:{cardId}:bids` (sorted by price DESC, then timestamp ASC) and `orderbook:{cardId}:asks` (sorted by price ASC, then timestamp ASC)
- Match in Redis (O(log n) lookups), then persist results to Postgres in batch
- Atomic matching: use Redis Lua scripts to prevent race conditions
- Fallback: if Redis is unavailable, fall back to current Prisma matching (degrade gracefully)
- Hydrate Redis from Postgres on startup (recover from Redis failures)

**Changes:**
- New: `src/lib/redis-orderbook.ts` — Redis sorted set operations for order book state
- Modify: `src/services/matching.service.ts` — replace Prisma queries with Redis lookups, batch-persist matched trades
- Modify: `src/services/order.service.ts` — on order placement, add to Redis sorted set AND Postgres
- New: `src/jobs/orderbook-sync.worker.ts` — periodic consistency check between Redis and Postgres state

### 5.3 — Full Catalog Population

**Effort:** S (1 week)

Current state: sync adapters have a 5-set limit for development.

**Changes:**
- Remove set limit from Pokemon TCG and One Piece sync adapters
- Incremental sync: only fetch sets released after last sync date
- Full sync: background job, runs weekly
- Target: 10,000+ Pokemon cards, 2,000+ One Piece cards
- Verify search performance with full catalog (< 200ms response, validated by Phase 2.3 optimizations)

---

## Phase 6: Trust & Compliance

> **Theme:** "Trust the platform before you trust it with your cards."
> **Effort:** L (3–5 weeks)
> **Dependencies:** Phase 5 (platform must be stable before adding compliance gates)

### 6.1 — KYC via Stripe Identity at Registration

**Hypothesis:** Requiring identity verification reduces fraud and builds trust for a custody + payments platform.

**Success metrics:**
- 100% of active users identity-verified
- Fraud/chargeback rate < 0.5%
- Registration-to-verified conversion > 80%

**Effort:** M (2–3 weeks)

New service: `src/services/kyc.service.ts`
- `initiateVerification(userId)` — creates Stripe Identity VerificationSession
- `handleVerificationResult(sessionId)` — webhook handler for verification events
- `getUserVerificationStatus(userId)` — UNVERIFIED | PENDING | VERIFIED | FAILED
- `isUserVerified(userId)` — boolean guard

Schema additions:
```prisma
enum KycStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  FAILED
}

// Add to User:
kycStatus           KycStatus @default(UNVERIFIED)
kycVerifiedAt       DateTime?
stripeVerificationId String?
```

Flow: Register → email verification (Phase 2.1b) → KYC screen (Stripe Identity embedded UI) → until VERIFIED, user can browse but cannot transact.

API guards: `requireVerified()` middleware on all transactional routes (orders, card-instances, shipments, trades, disputes, lending). Returns `403 { error: "Identity verification required" }`.

### 6.2 — Security Audit & Hardening

**Effort:** M (2–3 weeks)

Scope:
- Auth middleware audit: centralize into `requireAuth()` and `requireAdmin()` wrappers (currently inline per route)
- Input validation: Zod schemas for all API request bodies → `src/lib/validators/` directory
- CSRF protection verification for all state-changing requests
- Dependency audit: `npm audit` fix, pin critical dependencies
- Secrets management: verify no secrets in client bundles, `.env` validation at startup
- Session security: `Secure` + `SameSite` cookie attributes for production
- Structured audit logging: `src/services/audit-log.service.ts` (user ID, action, timestamp, IP)

### 6.3 — Terms of Service & Legal Framework

**Effort:** S (1 week eng + legal review)

- Static pages: `/terms`, `/privacy`, `/custody-agreement`
- Acceptance tracked: `tosAcceptedAt`, `custodyAgreementVersion` on User
- Re-acceptance flow when terms updated (version check on login)
- Custody Agreement covers: liability limits, dispute process, card condition guarantees, redemption timelines

---

## Phase 7: Warehouse Management System

> **Theme:** "Every card has an address, every movement has a record."
> **Effort:** L (4–6 weeks)
> **Dependencies:** Phase 6 (compliance must be in place before scaling intake)

### Physical Setup

Storage: Labeled bins on industrial metal shelving. Cards sorted by cert number (ascending) within bins. Location format: `{Shelf}{Unit}-B{Bin}` (e.g., `A3-B7`).

| Component | Specification | Cost |
|-----------|--------------|------|
| Shelving units | 4-5 metal units, 6 shelves each (48"×18"×72") | $150–250 each |
| Bins | Plastic card bins, ~50–100 slabs each standing upright | $3–5 each |
| Labels | Printed adhesive labels per bin + shelf | $50 (label printer) |
| Workstations | 2 receiving/digitization stations | $500–800 each |
| **Total** | **~5,000 card capacity** | **$2,000–4,000** |

### 7.1 — Vault Location Tracking

**Effort:** M (2–3 weeks)

New model:
```prisma
model VaultLocation {
  id            String   @id @default(cuid())
  code          String   @unique    // e.g., "A3-B7"
  shelf         String              // e.g., "A3"
  bin           String              // e.g., "B7"
  capacity      Int      @default(75)
  currentCount  Int      @default(0)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  cardInstances CardInstance[]

  @@index([shelf])
  @@index([isActive, currentCount])
}
```

CardInstance additions: `vaultLocationId String?`, `vaultedAt DateTime?`

New service: `src/services/vault.service.ts`
- `assignLocation(cardInstanceId, locationCode)` — assign + increment count + set vaultedAt
- `removeFromVault(cardInstanceId)` — clear on redemption, decrement count
- `getNextAvailableLocation(certNumber)` — suggest bin by cert number ordering + capacity
- `findCard(certNumber)` — returns vault location (< 5 second lookup)
- `getLocationInventory(locationCode)` — all cards at location
- `getVaultSummary()` — total vaulted, capacity %, locations near full
- `bulkRelocate(from, to, cardInstanceIds[])` — reorganization

Admin vault page: `src/app/(admin)/vault/page.tsx` — visual grid of locations (capacity color coded), search by cert number or location.

### 7.2 — Receiving Dock Workflow

**Effort:** M (2–3 weeks)

New model: `ReceivingLog` — tracks every package arrival with tracking number, carrier, condition, item count, expected count, discrepancy notes, photo URLs, status (RECEIVED → PROCESSING → COMPLETE | DISCREPANCY).

New service: `src/services/receiving.service.ts`
- `logPackageArrival(data)` — log + auto-match tracking number to pending inbound shipments
- `matchCardsToShipments(receivingLogId, certNumbers[])` — staff scans cert numbers, system matches to pending shipments
- `flagDiscrepancy(receivingLogId, notes)` — wrong card, missing card, damaged slab
- `getReceivingQueue()` — packages in RECEIVED or PROCESSING
- `getReceivingMetrics(dateRange)` — packages/day, avg processing time, discrepancy rate

Admin receiving page: Receive Package form → Process Package (scan cert numbers) → discrepancy alerts → daily dashboard.

### 7.3 — Inventory Audit Tool

**Effort:** M (2–3 weeks)

New models: `InventoryAudit` + `AuditItem` — random sample audits with per-card results (MATCH, WRONG_LOCATION, MISSING, EXTRA).

New service: `src/services/inventory-audit.service.ts`
- `startAudit(adminId, samplePercentage)` — select random N% of VERIFIED cards
- `recordAuditResult(auditItemId, result, notes?)` — staff confirms each card
- `completeAudit(auditId)` — calculate accuracy, flag mismatches
- `getAuditHistory()` — past audits with trends

Target: quarterly 10% audits, > 99.5% accuracy.

---

## Phase 8: Card Swaps

> **Theme:** "Your vaulted card, their vaulted card — swap in seconds, no shipping."
> **Effort:** L (3–4 weeks)
> **Dependencies:** Phase 7 (vault system must be operational)

### 8.1 — Swap Proposals (Browse-and-Propose)

**Revenue:** Flat $5 for swaps < $500 total value, flat $10 for ≥ $500. Fee charged to proposer.

New models: `SwapProposal`, `SwapCard` (with `SwapStatus` and `SwapSide` enums). Proposals auto-expire after 7 days.

New service: `src/services/swap.service.ts`
- `proposeSwap(proposerId, recipientId, offeredIds[], requestedIds[], message?)`
- `acceptSwap(userId, swapId)` — charge fee → execute ownership transfer
- `declineSwap(userId, swapId, reason?)`
- `cancelSwap(userId, swapId)`
- `counterSwap(userId, swapId, newOfferedIds[], newRequestedIds[], message?)`
- `executeSwap(swapId)` — atomically swap `ownerId` on CardInstances. **No physical movement** — cards stay in vault locations.

UI:
- Vault browse page: `src/app/(marketplace)/vault-browse/page.tsx` — all VERIFIED vaulted cards, filterable
- Swap inbox: `src/app/(marketplace)/swaps/page.tsx` — tabs: Received | Sent | Completed

BullMQ: `swap-expiry` worker runs hourly, expires stale proposals.

Notifications: SWAP_PROPOSED, SWAP_ACCEPTED, SWAP_DECLINED, SWAP_COUNTERED, SWAP_COMPLETED, SWAP_EXPIRED

---

## Phase 9: Collection Tracking & Price Intelligence

> **Theme:** "Gotta catch 'em all — and know exactly what you're missing."
> **Effort:** L (3–5 weeks)
> **Dependencies:** Phase 5.3 (full catalog), Phase 3.1 (price history)

### 9.1 — Collection Tracker & Pokédex-Style Completion

**This is the #1 customer-facing differentiator.**

New models: `Collection`, `CollectionGoal` (with `GoalTargetType` enum: SET, GAME, CUSTOM)

New service: `src/services/collection.service.ts`
- `getCollectionProgress(collectionId)` — per goal: total cards in set, owned count, completion %, missing cards, estimated cost to complete
- `getMissingCards(userId, setId)` — sorted by market price
- `getCompletionLeaderboard(setId, limit)` — top collectors by completion %

Auto-collection: first verified card → auto-create default collection + matching set goal.

UI:
- Collection hub: `src/app/(marketplace)/collection/page.tsx` — all goals with completion bars
- Set Pokédex view: `src/app/(marketplace)/collection/[setId]/page.tsx` — grid: owned (full color + grade badge) vs. missing (grayed out + price + "Buy" link to order book)
- Stats: owned/total, completion %, total value, cost to complete

### 9.2 — Price Alerts & Watchlists

New models: `PriceAlert` (with `AlertDirection`: ABOVE/BELOW), `Watchlist`

New services:
- `price-alert.service.ts` — max 50 active alerts per user, checked after each trade via BullMQ
- `watchlist.service.ts` — max 200 cards, notifies on new sell orders

UI:
- Card detail: "Set Price Alert" + "Add to Watchlist" buttons
- Watchlist page: `src/app/(marketplace)/watchlist/page.tsx`
- Alerts page: `src/app/(marketplace)/alerts/page.tsx`

### 9.3 — Vault Insurance

**Implementation:** Partner with collectibles insurance provider (not self-insured). Platform facilitates enrollment, premium collection, and claims.

New models: `InsurancePolicy`, `InsuranceClaim` (with `ClaimStatus` enum)

New service: `src/services/insurance.service.ts`
- `enrollCard(userId, cardInstanceId, declaredValue?)` — create policy, calculate premium (~1–2% annual)
- `fileClaim(userId, policyId, reason, description, evidence[])` — initiate claim

UI: "Insure" button on vaulted cards in portfolio, insurance management page.

---

## Phase 10: Lending System

> **Theme:** "Unlock the value of your collection without selling it."
> **Effort:** XL (4–6 weeks)
> **Dependencies:** Phase 7 (vault), Phase 6.1 (KYC), stable trading with price history

### 10.1 — Collateralized Card Lending

Loan and LoanOffer models already exist in schema.

**LTV limits:** Max 50% of market value (conservative — cards are volatile). 30% max if no trade history on platform.

**Interest:** Lenders set rates, platform takes 15% of interest (`platformFeeRate` on Loan).

**Monitoring (`src/jobs/loan-monitor.worker.ts`):**
- LTV > 70% → warn borrower
- LTV > 90% → auto-liquidate (list card for sale)
- Past due + 7 day grace → DEFAULTED, auto-liquidate
- Liquidation: auto-create SELL LIMIT at market price, step down to 90% then 80% if unfilled

UI:
- `src/app/(lending)/borrow/page.tsx` — select card, see max loan, submit request
- `src/app/(lending)/lend/page.tsx` — browse requests, submit offers
- `src/app/(lending)/loans/page.tsx` — active loans, repayment history

---

## Phase 11: Growth & Ecosystem

> **Theme:** Meet collectors where they are.
> **Effort:** L (3–4 weeks per item)
> **Dependencies:** Stable platform (Phase 6+)

### 11.1 — Additional TCG Games

**Effort:** M per game (1–2 weeks each)

1. **Magic: The Gathering** — Scryfall API (free, 25,000+ cards)
2. **Yu-Gi-Oh** — YGOPRODeck API (free, 12,000+ cards)
3. **Dragon Ball Super** — API TBD
4. **Disney Lorcana** — community APIs

Each: new sync adapter in `src/services/sync/`, register in index, seed, QA.

### 11.2 — Bulk Collection Import (CSV)

**Effort:** M (2–3 weeks)

New service: `src/services/bulk-import.service.ts`
- Parse CSV (cert_number, grading_company, grade)
- Validate: format, PSA-only, not already registered, optional cert lookup
- Create CardInstances in PENDING_SHIPMENT status
- User ships all imported cards in one batch shipment

UI: `src/app/(marketplace)/import/page.tsx` — drag-and-drop CSV, validation results, import history.

### 11.3 — Public REST API

**Effort:** L (3–4 weeks)

Read-only at launch, write scopes later (Phase 12+):

| Endpoint | Scope | Description |
|----------|-------|-------------|
| `GET /api/v1/cards` | `read:cards` | Search/browse catalog |
| `GET /api/v1/cards/:id` | `read:cards` | Card detail |
| `GET /api/v1/cards/:id/orderbook` | `read:orderbook` | Current order book |
| `GET /api/v1/cards/:id/trades` | `read:trades` | Recent trades |
| `GET /api/v1/cards/:id/price-history` | `read:prices` | OHLCV candles |
| `GET /api/v1/market/stats` | `read:market` | Platform-wide stats |
| `GET /api/v1/market/movers` | `read:market` | Top price movers |

API key model: `ApiKey` with hashed key, scopes, rate limits (60/min free tier).

### 11.4 — OAuth2 + PKCE Migration (Mobile Foundation)

**Effort:** M (2–3 weeks)

Prerequisite for mobile app. Current refresh token family chaining maps well to PKCE flows.

Changes:
- `POST /api/auth/token` (OAuth2 token endpoint)
- `POST /api/auth/authorize` (PKCE challenge/verifier)
- Update `auth.service.ts` with PKCE support
- Add `pushTokens String[]` to User model
- Web app updated to use new auth flow (backwards-compatible transition)

---

## Phase 12: Intelligence, Community & Operational Maturity

> **Theme:** The platform that gets smarter, the community that grows.
> **Dependencies:** Ongoing after Phase 11

### 12.1 — Advanced Market Analytics Dashboard

**Effort:** L (3–4 weeks)

Logged-in homepage expansion:
- Top movers (24h, 7d, 30d price change %)
- Most traded by volume
- Market heat map (sets colored by price movement)
- Volume charts (platform-wide daily)
- New listings real-time feed
- Set analytics (avg price movement, volume, value locked)

Card detail page additions:
- Candlestick chart (OHLCV from Phase 3.1)
- Order book depth chart (visual bid/ask walls)
- Volume bars

### 12.2 — Community Features

**Effort:** L (3–5 weeks)

- Public profiles with collection showcase (foundation in Phase 3.4)
- Follow system + activity feed
- Per-card discussion threads
- Collection leaderboards (top completionists per set)
- Trade reviews UI (Review model exists, build the UI)

### 12.3 — Expanded Grading Company Support

**Effort:** S–M per company

- **SGC** — add to enum, cert lookup API
- **BGS (Beckett)** — when API access available
- **CGC** — when API access available

### 12.4 — Grade Expansion (PSA 7–10)

**Effort:** S (1 week)

Current: PSA 10 only. Expand to 7–10 (covers vast majority of graded card trading). Order book already has `minGrade` filter. Update validation to accept 7–10. Card detail: show order book filtered by grade tab.

### 12.5 — Compliance & Tax Reporting

**Effort:** L (3–4 weeks)

- 1099-K generation for US sellers exceeding IRS threshold ($600/year)
- AML monitoring (extend TradingAlert with rules for large transactions, structuring)
- Cost basis tracking (from Phase 3.2) → exportable capital gains/losses
- GDPR data export: user's complete history (trades, shipments, fees, snapshots)

---

## Mobile App Phases (Post Phase 11.4)

> Web is primary; mobile is secondary. React Native + Expo.

### M1: Core Read-Only (first mobile release)
- Login/register with KYC
- Browse catalog with search
- Card detail with real-time order book (WebSocket)
- Portfolio view + collection tracker
- Push notifications (Expo Push)

### M2: Trading + Swaps
- Place buy/sell orders
- Swap proposals
- Order and trade history
- Payment management (Stripe mobile SDK)
- Shipment tracking with push

### M3: Camera + Import
- PSA cert label scanning (OCR → pre-fill cert number + grade)
- Card photo upload before shipping
- Bulk import via CSV or camera batch scan

### M4: Full Parity
- Notifications, price alerts, watchlist
- Insurance management
- Lending (if launched)
- Deep linking (share listings, swap proposals)

**Backend changes for mobile:**
- `pushTokens String[]` on User (Phase 11.4)
- `notification.service.ts` → Expo Push API integration
- `POST /api/users/push-token` endpoint
- OAuth2 + PKCE (Phase 11.4)

---

## Overall Sequencing

| # | Phase | Theme | Key Deliverables | Effort | Dependencies |
|---|-------|-------|-----------------|--------|--------------|
| 0 | Foundation | Core platform | Auth, catalog, order book, escrow, shipping, verification | ✅ Done | — |
| 1 | Quick Fixes | Business rules | Fee fix, fill-or-kill, PSA-only, ship deadline | S (1w) | — |
| 2 | Auth + Real-Time + Search | Trust & speed | Password reset, email verify, 2FA, GDPR delete, WebSocket wiring, full-text search, email triggers | L (3–5w) | Phase 1 |
| 3 | Data & Profiles | Daily engagement | Price history, portfolio upgrades (gain/loss), reputation, public profiles | L (3–5w) | Phase 2 |
| 4 | Dashboard + Digitization | Product completion | Homepage, R2 uploads, admin digitization, listing wizard, carrier integration, batch shipments | XL (4–6w) | Phase 3 |
| 5 | Infrastructure | Scale prep | Unified workers, Redis matching migration, full catalog | M (2–3w) | Phase 4 |
| 6 | Compliance | Trust gate | KYC (Stripe Identity), security audit, ToS/legal | L (3–5w) | Phase 5 |
| 7 | Warehouse | Physical ops | Vault tracking, receiving dock, inventory audits | L (4–6w) | Phase 6 |
| 8 | Swaps | New revenue | Browse-and-propose swaps, flat fee ($5/$10) | L (3–4w) | Phase 7 |
| 9 | Collection + Intelligence | #1 differentiator | Pokédex completion, price alerts, watchlists, insurance | L (3–5w) | Phase 5.3 + 3.1 |
| 10 | Lending | Revenue expansion | Collateralized loans, LTV monitoring, liquidation | XL (4–6w) | Phase 7 + stable |
| 11 | Growth | Ecosystem | More TCGs, bulk import, public API, OAuth2/PKCE | L (3–4w/item) | Phase 6+ |
| 12 | Intelligence + Community | Maturity | Market analytics, social, grading expansion, tax reporting | L (ongoing) | Phase 11 |
| M | Mobile | Distribution | M1 (read-only) → M2 (trading) → M3 (camera) → M4 (parity) | Per-phase | Phase 11.4 |

---

## Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Order book only, no Buy Now | Exchange-style order book is the core differentiator |
| 2 | 5% platform fee (lower later) | Revenue from day one; competitive pressure to reduce over time |
| 3 | PSA only at launch | Only grading company with cert lookup API; BGS/CGC add admin burden |
| 4 | Fill-or-kill market orders | Market orders shouldn't rest on the book — fill or cancel |
| 5 | 3 business day ship deadline | Protect buyers from indefinite waits |
| 6 | Auto-reject on any failed digitization check | Simplifies admin flow — no partial approval |
| 7 | Single warehouse, cert-number ordering | Cost-effective for 1K–10K cards; deterministic organization |
| 8 | Swaps = ownership transfer only | No physical movement — ownerId changes, cards stay in vault |
| 9 | Flat swap fee ($5/$10) | Simple, predictable, not percentage-based |
| 10 | KYC for all users at registration | Custody platform — trust from day one |
| 11 | Redis matching near-term (Phase 5) | Prisma matching works for MVP but bottlenecks at scale |
| 12 | WebSocket is core differentiator | Real-time order book updates, not polling |
| 13 | Insurance via partner, not self-insured | Facilitate enrollment/claims, don't underwrite risk |
| 14 | Lending LTV max 50% | Conservative — card values are volatile |
| 15 | Public API read-only first | Reduce abuse surface; write access later |
| 16 | Mobile after web stability | Web is primary UX; mobile validates demand first |
| 17 | Bulk import creates PENDING_SHIPMENT | Cards not tradeable until physically verified |
| 18 | Collection tracker auto-creates on first vault | Reduce friction — no manual setup |
| 19 | USD only | No multi-currency Stripe for V1 |
| 20 | OAuth2 + PKCE for web + mobile | Auth migration required before mobile |
| 21 | Quarterly 10% inventory audits | Catch problems early without full counts |
| 22 | Grade expansion to 7–10 | PSA 7–10 covers the vast majority of graded card trading |

---

## Production Gaps in Existing Code (Audit: 2026-02-18)

These are issues found in built code that are addressed by specific phases above:

| Gap | Current State | Fix Phase |
|-----|---------------|-----------|
| Platform fee 3% vs 5% | `matching.service.ts:4` defaults to 0.03 | Phase 1.1 |
| Market orders rest on book | No fill-or-kill logic | Phase 1.2 |
| BGS/CGC accepted but manual | Falls back to manual verification | Phase 1.3 |
| No ship deadline enforcement | BullMQ job exists but not triggered | Phase 1.4 |
| No password reset | Missing flow entirely | Phase 2.1a |
| No email verification | Registration doesn't verify email | Phase 2.1b |
| No 2FA/MFA | No TOTP support | Phase 2.1c |
| No account deletion | No GDPR compliance | Phase 2.1d |
| OrderBook polls API | WebSocket hooks exist, not wired | Phase 2.2 |
| Search uses Prisma `contains` | No full-text search, no autocomplete | Phase 2.3 |
| Email service never triggers | Adapter exists, no events wired | Phase 2.4 |
| No HTML email templates | Text-only via Resend | Phase 2.4 |
| Reputation score always 0 | Model exists, no calculation logic | Phase 3.3 |
| Portfolio N+1 query | Fetches ALL instances for summary | Phase 3.2 |
| No portfolio value history | No daily snapshots | Phase 3.2 |
| No cost basis / gain-loss | No acquisition price tracking | Phase 3.2 |
| No public profiles | Profile page is private only | Phase 3.4 |
| Homepage = landing page for all | No logged-in dashboard | Phase 4.1 |
| Verification is binary approve/reject | No photos, no condition notes | Phase 4.2 |
| No shipping label generation | Manual tracking entry | Phase 4.6 |
| Redemption doesn't archive | Card stays VERIFIED after redeem | Phase 4.3 |
| Matching uses Prisma queries | Not Redis sorted sets | Phase 5.2 |
| Catalog limited to 5 sets | Dev limit not removed | Phase 5.3 |
| No card detail price chart | PriceHistory model unused | Phase 3.1 |
| No depth chart visualization | Just aggregated bids/asks | Phase 12.1 |
| No notification preference toggles | UserSettings fields exist, no UI | Phase 2.4 |
| Lending pages are stubs | "Coming in Phase 2" placeholders | Phase 10 |

---

## Verification Checklist

### After Phase 1 (Quick Fixes):
1. ☐ Platform fee is 5% (matching.service default = 0.05)
2. ☐ Market orders auto-cancel unfilled remainder
3. ☐ BGS/CGC sell orders rejected with "PSA only" message
4. ☐ Seller auto-cancelled + refunded after 3 business days without shipping

### After Phase 2 (Auth + Real-Time + Search):
5. ☐ Password reset email flow works end-to-end
6. ☐ New users must verify email before trading
7. ☐ 2FA setup + login challenge works with TOTP apps
8. ☐ Account deletion soft-deletes and anonymizes PII
9. ☐ OrderBook component uses WebSocket (not polling)
10. ☐ Card search returns results in < 100ms with autocomplete
11. ☐ Trade fills, verification results, and disputes trigger emails

### After Phase 3 (Data & Profiles):
12. ☐ Card detail page shows interactive price chart
13. ☐ Portfolio shows gain/loss per card and total P&L
14. ☐ Reputation badges visible throughout the app
15. ☐ Public profile page accessible by other users

### After Phase 4 (Dashboard + Digitization):
16. ☐ Logged-in homepage shows dashboard with portfolio + orders
17. ☐ Full digitization: arrive → claim → photos → checklist → approve/reject
18. ☐ Listing wizard creates CardInstance + Order in guided flow
19. ☐ Shipping labels generated via carrier API
20. ☐ Redemption archives card + deletes images

### After Phase 5 (Infrastructure):
21. ☐ All BullMQ workers run from single process
22. ☐ Order matching uses Redis sorted sets
23. ☐ Full catalog: 10,000+ Pokemon, 2,000+ One Piece cards
24. ☐ Search < 200ms at full catalog scale

### After Phase 7 (Warehouse):
25. ☐ Every VERIFIED card has a vault location
26. ☐ Staff retrieves any card in < 2 minutes by cert number
27. ☐ Incoming packages logged with discrepancy tracking
28. ☐ Quarterly audit > 99.5% accuracy

### After Phase 8 (Swaps):
29. ☐ Accepted swap atomically transfers ownership, no physical movement
30. ☐ Flat fee charged to proposer
31. ☐ Stale proposals auto-expire after 7 days

### After Phase 9 (Collection):
32. ☐ Set Pokédex shows owned vs. missing with completion %
33. ☐ Price alerts trigger notifications at target price
34. ☐ Watchlist notifies on new listings

---

## Schema Summary: New Models by Phase

| Model | Phase | Purpose |
|-------|-------|---------|
| CardDigitization | 4.2 | Admin verification workflow with photos + checklist |
| BatchShipment | 4.4 | Multiple cards in one shipment |
| VaultLocation | 7.1 | Physical storage location tracking |
| ReceivingLog | 7.2 | Package intake audit trail |
| InventoryAudit + AuditItem | 7.3 | Spot-check inventory accuracy |
| SwapProposal + SwapCard | 8.1 | P2P card swap proposals |
| Collection + CollectionGoal | 9.1 | User collection tracking |
| PriceAlert | 9.2 | Target price notifications |
| Watchlist | 9.2 | Card monitoring |
| InsurancePolicy + InsuranceClaim | 9.3 | Vault card insurance |
| ApiKey | 11.3 | Third-party API access |

Plus field additions: `User.kycStatus`, `User.emailVerified`, `User.twoFactorEnabled`, `User.resetToken`, `CardInstance.vaultLocationId`, `CardInstance.acquisitionPrice`, `Trade.shipDeadline`, etc.

Plus enum additions: `KycStatus`, `DigitizationStatus`, `SwapStatus`, `SwapSide`, `GoalTargetType`, `AlertDirection`, `ReceivingStatus`, `AuditStatus`, `AuditItemResult`, `ClaimStatus`
