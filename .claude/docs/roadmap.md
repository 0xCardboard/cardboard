# Cardboard Roadmap

> Updated: 2026-02-17
> Status: Phases 1A–1D complete and merged to main.

---

## What's Done

| Phase | Description | Status |
|-------|-------------|--------|
| 1A | Auth (custom JWT + refresh token rotation), service layer, Vitest, Prisma schema | Done |
| 1B | Card catalog, Pokemon TCG + One Piece sync adapters, browse/detail UI | Done |
| 1C | Order book, price-time priority matching engine, card instances, trading pipeline | Done |
| 1D | Stripe escrow (charge → capture → transfer), shipping, verification (PSA cert lookup), disputes | Done |

---

## What's Next

### Phase 1E-pre: Basic Portfolio + Quick Fixes

**Rationale**: Users can already own verified cards and have trade history, but the portfolio page is a dead stub. These are high-impact UX gaps that should ship before infrastructure work.

#### 1E-pre.1: Basic Portfolio Page

Replace the portfolio stub (`src/app/(marketplace)/portfolio/page.tsx`) with a functional page.

**New service**: `src/services/portfolio.service.ts`
- `getUserPortfolio(userId)` — returns user's card instances grouped by status (VERIFIED, LISTED, PENDING_SHIPMENT, IN_TRANSIT, PENDING_VERIFICATION, REDEEMED)
- `getPortfolioSummary(userId)` — total cards, total estimated value (sum of Card.marketPrice for owned instances), cards by game
- Filter ARCHIVED and LOST statuses from display (future statuses from Phase 1G)

**UI**: `src/app/(marketplace)/portfolio/page.tsx`
- Tab layout: All Cards | Verified | Listed | In Transit | Pending Verification
- Card grid showing: card image, name, set, grade, grading company, status badge, estimated value
- Summary bar: total cards, total estimated value
- Actions per card: "List for Sale" (→ listing wizard), "Redeem" (→ redemption flow)
- Empty state with CTA to browse marketplace

#### 1E-pre.2: Platform Fee Correction

**Problem**: Matching engine defaults to 3% (`PLATFORM_FEE_RATE || "0.03"`) but landing page advertises 5%.

**Changes**:
- `src/services/matching.service.ts:4` — change default from `"0.03"` to `"0.05"`
- `.env.example` — set `PLATFORM_FEE_RATE=0.05`
- `src/app/page.tsx` — verify landing page fee copy matches (currently shows 5%, which is correct)

#### 1E-pre.3: Fill-or-Kill Market Orders

**Problem**: Market orders currently rest as OPEN if no liquidity exists. Should fill what's available and auto-cancel the remainder.

**Changes in** `src/services/matching.service.ts`:
- After the matching loop completes (`while (remainingQty > 0)` exits), check if the order is type MARKET and has unfilled quantity
- If so, cancel the remaining unfilled portion:
  - If `filledQuantity > 0`: set status to PARTIALLY_FILLED → then CANCELLED (create notification: "Market order partially filled — {filledQty}/{totalQty} filled, remainder cancelled due to insufficient liquidity")
  - If `filledQuantity === 0`: set status to CANCELLED (notify: "Market order cancelled — no matching orders available")
- Add return field `cancelledRemainder: number` to `MatchResult`

**Changes in** `src/services/order.service.ts`:
- After `matchOrder()` returns, re-fetch order — if MARKET and now CANCELLED, clean up card instance (same as cancel logic for sell orders)

#### 1E-pre.4: PSA-Only at Launch

**Problem**: BGS and CGC cert lookups fall back to manual verification with no real API. Supporting them adds admin burden with no automated verification.

**Changes**:
- `prisma/schema.prisma` — keep `GradingCompany` enum as-is (PSA, BGS, CGC) for future compatibility, but:
- `src/services/order.service.ts` — validate that sell orders only accept `gradingCompany: "PSA"` at placement time. Reject BGS/CGC with error: "Only PSA graded cards are accepted at this time. BGS and CGC support coming soon."
- `src/services/card-instance.service.ts` — same validation on CardInstance registration
- `src/app/page.tsx` FAQ — add note about PSA-only for launch
- Buy orders: `gradingCompany` filter on orders should only allow PSA (or null for "any")

#### 1E-pre.5: Seller Shipping Deadline (3 Business Days)

**Problem**: After a trade matches and the buyer is charged, there's no deadline for the seller to ship. Buyers can be stuck waiting indefinitely.

**New BullMQ job**: `src/jobs/ship-deadline.worker.ts`
- When a trade is created and payment is captured, enqueue a delayed job with 3 business day delay
- Job checks: does an INBOUND shipment exist for this trade?
  - If no shipment: auto-cancel trade, refund buyer via `cancelEscrow()`, notify both parties, penalize seller reputation
  - If shipment exists but not delivered: no action (card is in transit)
- Business day calculation: skip Saturday/Sunday (no holiday calendar for V1)

**Changes to** `src/services/escrow.service.ts`:
- After successful `processTradePayment()`, enqueue the ship-deadline job:
  ```
  shipDeadlineQueue.add('check-shipment', { tradeId }, { delay: calculateBusinessDayDelay(3) })
  ```

**New queue** in `src/jobs/queue.ts`: `ship-deadline`

**Schema addition** on Trade:
```prisma
shipDeadline    DateTime?    // When seller must ship by
```

---

### Phase 1E: Rate Limiting + Notifications + Real-Time + Email

> Significantly expanded from original plan: now includes WebSocket infrastructure, email notifications, and notification UI.

#### 1E.1: Redis Sliding Window Rate Limiting

**New file**: `src/lib/rate-limit.ts`

Sliding window counter using Redis:
- `rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }>`
- Uses Redis `MULTI` with `INCR` + `EXPIRE` for atomic increment
- Returns `remaining` count and `resetAt` timestamp for headers

**Apply to routes** via middleware helper `withRateLimit()`:
| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/auth/login | 10 | 15 min |
| POST /api/auth/register | 5 | 1 hour |
| POST /api/orders | 30 | 1 min |
| POST /api/disputes | 5 | 1 hour |
| POST /api/shipments/* | 20 | 1 min |
| GET /api/* (general) | 100 | 1 min |

**Response headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
**429 response**: `{ error: "Too many requests", retryAfter: seconds }`

#### 1E.2: Anti-Wash-Trade Detection

**New service**: `src/services/wash-trade-detector.service.ts`

Detects coordinated trading patterns using BullMQ (runs after each trade):

**Detection rules**:
1. **Rapid round-trip**: Same two users trading the same card back and forth within 7 days
2. **Price manipulation**: Trade price >50% deviation from card's `marketPrice` (if marketPrice exists)
3. **Volume anomaly**: Same user pair executing >5 trades in 24 hours

**On detection**:
- Create `TradingAlert` record (model already exists in schema, currently unused)
- Notify all admins via notification
- Do NOT auto-block trades — admin reviews and decides

**Queue**: Add `wash-trade-detection` to `src/jobs/queue.ts`
**Worker**: `src/jobs/wash-trade.worker.ts`
**Trigger**: Enqueue job in `matching.service.ts` after trade creation

#### 1E.3: Notification Bell + Dropdown + Page

**New components**:
- `src/components/layout/NotificationBell.tsx` — bell icon in Navbar with unread count badge
- `src/components/layout/NotificationDropdown.tsx` — dropdown showing last 5 notifications, "Mark all read", link to full page
- `src/app/(marketplace)/notifications/page.tsx` — full notification history with filters (all/unread), pagination, mark-read actions

**API already exists**: GET `/api/notifications`, POST `/api/notifications/[id]/read`, POST `/api/notifications/read-all`

#### 1E.4: WebSocket Infrastructure (Real-Time)

**New file**: `src/lib/websocket.ts`

WebSocket server for real-time updates, implemented as a custom Next.js server or standalone process alongside the worker.

**Channels**:
- `orderbook:{cardId}` — broadcasts order book changes (new order, fill, cancel) to subscribers viewing that card
- `notifications:{userId}` — broadcasts new notifications to authenticated users
- `trades:{cardId}` — broadcasts new trade executions

**Integration points**:
- `order.service.ts` — after order placement/cancellation, publish to `orderbook:{cardId}`
- `matching.service.ts` — after trade creation, publish to `trades:{cardId}` and `orderbook:{cardId}`
- `notification.service.ts` — after creating notification, publish to `notifications:{userId}`

**Client hook**: `src/hooks/useWebSocket.ts`
- `useOrderBook(cardId)` — subscribes to order book updates
- `useNotifications()` — subscribes to notification stream, updates bell count
- Auto-reconnect with exponential backoff
- JWT-authenticated connection

**Technology**: `ws` library (lightweight, no Socket.io overhead). Auth via token in connection query string.

#### 1E.5: Transactional Email Notifications

**New service**: `src/services/email.service.ts`

Transactional emails for critical events. Provider: Resend, Postmark, or AWS SES (TBD — use adapter pattern).

**Email triggers** (check UserSettings preferences before sending):
| Event | Email Subject | UserSettings Check |
|-------|---------------|-------------------|
| Trade matched | "Your order has been filled" | `notifyTradeFilled` |
| Card verified | "Your card has been verified" | `notifyCardVerified` |
| Card verification failed | "Verification failed for your card" | `notifyCardVerified` |
| Escrow released (seller paid) | "Payment released — funds on the way" | `notifyEscrowReleased` |
| Dispute opened against you | "A dispute has been filed" | `notifyDisputeUpdate` |
| Dispute resolved | "Your dispute has been resolved" | `notifyDisputeUpdate` |
| Shipment delivered | "Your card has been delivered" | `notifyShipmentUpdate` |
| Ship deadline warning (2 days) | "Reminder: Ship your card" | `notifyShipmentUpdate` |

**Modifications to** `src/services/notification.service.ts`:
- After creating a DB notification, check UserSettings and optionally trigger email
- Add `emailNotifications Boolean @default(true)` to UserSettings (master email toggle)

**Templates**: Simple text-based emails for V1. No HTML template engine needed yet.

---

### Phase 1F: Price History + Portfolio Valuation + Profiles

#### 1F.1: OHLCV Price Aggregation

**New service**: `src/services/price-history.service.ts`

Aggregates trade data into OHLCV candles stored in the existing `PriceHistory` model.

**BullMQ job**: Runs every hour (or on-demand after trades)
- For each card with trades in the period:
  - Calculate open (first trade price), high, low, close (last trade price), volume (trade count)
  - Upsert `PriceHistory` record for the period

**Query methods**:
- `getPriceHistory(cardId, period: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL')` — returns candle data for charts
- `getLatestPrice(cardId)` — last trade price

**API**: GET `/api/cards/[cardId]/price-history?period=1M`

#### 1F.2: Portfolio Valuation (enhance 1E-pre portfolio)

Extend `portfolio.service.ts` with:
- `getPortfolioValue(userId)` — sum of estimated values using latest trade prices (from PriceHistory) falling back to Card.marketPrice
- `getPortfolioBreakdown(userId)` — value by game, by set, by grading company
- Daily portfolio snapshot job (BullMQ) — stores daily total value for portfolio history chart

#### 1F.3: Reputation Scoring + Public Profiles

**Enhance** `src/services/dispute.service.ts` — update Reputation model on trade completion and dispute resolution (partially exists).

**Reputation formula**:
- Base: `(successfulTrades / totalTrades) * 100`
- Bonuses: fast shipping (avgShipTimeDays < 2 = +5), high volume (>50 trades = +5)
- Penalties: disputes lost (-10 per), ship deadline missed (-5 per)

**Profile page** (`src/app/profile/[userId]/page.tsx` — currently a stub):
- Public info: name, avatar, reputation score/badge, member since
- Trade stats: total trades, success rate, avg ship time
- Collection showcase (if `profilePublic` setting is true): verified cards grid
- Recent reviews received
- Respect UserSettings.showTradeHistory and UserSettings.profilePublic

---

### Phase 1G: Homepage Dashboard + Uploads + Admin Digitization + Redemption

#### 1G.1: Homepage Dashboard (Logged-In Users)

Replace the marketing landing page with a market dashboard when authenticated.

**Sections**:
- **Trending Cards**: top 10 cards by trade volume in last 7 days
- **Recent Trades**: last 10 trades across the platform (price, card, time)
- **Featured Sets**: sets with most activity
- **Market Stats**: total trades today, total volume (USD), active listings count, registered users count
- **Your Portfolio Summary**: card count, estimated value, open orders

**Keep** the marketing landing page for unauthenticated visitors.

#### 1G.2: R2 Image Upload Service

**New service**: `src/services/upload.service.ts`

Cloudflare R2 (S3-compatible) presigned upload URLs.

**Methods**:
- `getPresignedUploadUrl(userId, purpose: 'card-front' | 'card-back' | 'card-additional' | 'dispute-evidence', fileType: string)` — returns `{ uploadUrl: string, fileKey: string }`
- `deleteFile(fileKey: string)` — delete from R2
- `getPublicUrl(fileKey: string)` — return CDN URL

**API routes**:
- POST `/api/uploads/presign` — get upload URL (authenticated)
- DELETE `/api/uploads/[fileKey]` — admin only

**File key format**: `{purpose}/{userId}/{timestamp}-{uuid}.{ext}`

**Env vars**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

#### 1G.3: Admin Card Digitization Workflow

**Problem**: Verification is currently a binary approve/reject toggle. No photos, condition notes, or cert data are captured during verification. The `imageUrls` field on CardInstance exists but is never populated.

**Schema changes** (`prisma/schema.prisma`):

New model:
```prisma
model CardDigitization {
  id                String   @id @default(cuid())
  cardInstanceId    String   @unique
  frontImageUrl     String
  backImageUrl      String
  additionalImages  String[] @default([])
  conditionNotes    String?
  certLookupData    Json?       // Cached PSA API response
  certVerified      Boolean  @default(false)
  gradeConfirmed    Boolean  @default(false)
  encasementIntact  Boolean  @default(true)
  labelAuthentic    Boolean  @default(true)
  digitizedAt       DateTime @default(now())
  digitizedById     String
  assignedToId      String?     // Admin who claimed this card

  cardInstance CardInstance @relation(...)
  digitizedBy  User         @relation("DigitizedBy", ...)
  assignedTo   User?        @relation("AssignedTo", ...)
}
```

New enum values on `CardInstanceStatus`:
- `DIGITIZING` — admin has claimed the card, digitization in progress
- `ARCHIVED` — soft-deleted after physical redemption delivery
- `LOST` — card lost in transit

**Two-step verification flow** (replaces current single-step):
1. Card arrives → `PENDING_VERIFICATION` (existing, via shipment delivery)
2. Admin clicks "Claim & Begin Digitization" → `DIGITIZING` (card locked to this admin)
3. Admin uploads front/back photos (via R2), runs PSA cert lookup, records condition notes, fills checklist:
   - `certVerified` — PSA API confirms cert number matches grade + card name
   - `gradeConfirmed` — Grade on slab matches what seller submitted
   - `encasementIntact` — Slab is not cracked, tampered, or damaged
   - `labelAuthentic` — Label looks genuine (not counterfeit)
4. **If any checklist item is false → auto-reject.** Card returned to seller, buyer refunded.
5. Admin clicks "Approve" → `VERIFIED`, CardInstance.imageUrls populated from digitization record
6. Admin clicks "Reject" → `PENDING_SHIPMENT`, escrow cancelled, buyer refunded, card queued for return

**Card identification on intake**: Admin looks up incoming card by **cert number** (scan or type). System matches to CardInstance by `certNumber` field.

**Admin team features**:
- Card claiming: admin clicks "Claim" to lock a PENDING_VERIFICATION card to themselves → prevents duplicate work
- `assignedToId` on CardDigitization tracks who is working on it
- Admin metrics: cards digitized per admin per day/week, average digitization time

**Service changes** (`src/services/verification.service.ts`):
- Split `verifyCard()` into:
  - `claimForDigitization(adminId, cardInstanceId)` — sets status to DIGITIZING, creates CardDigitization draft
  - `saveDigitizationProgress(adminId, cardInstanceId, data)` — updates photos, notes, checklist (saves progress)
  - `completeDigitization(adminId, cardInstanceId, approved: boolean)` — finalizes: if all checks pass + approved → VERIFIED; else → reject
- Keep `lookupCertification()` as-is (PSA only)
- New: `getAdminDigitizationMetrics(adminId?, dateRange?)` — cards processed, avg time

**UI changes** (`src/app/(admin)/verification/page.tsx`):
- Redesign as multi-step:
  1. **Queue view**: table of PENDING_VERIFICATION cards with "Claim" button, plus DIGITIZING cards assigned to current admin
  2. **Digitization form**: photo upload (front/back), cert lookup button, condition notes textarea, checklist toggles
  3. **Review & submit**: summary of all data, approve/reject buttons
- Add cert number search: admin can type/scan cert number to find the card in the queue
- Admin dashboard tab: team metrics (cards processed per admin, backlog size)

**API routes**:
- POST `/api/admin/verification/[cardInstanceId]/claim` — claim card for digitization
- PATCH `/api/admin/verification/[cardInstanceId]/digitize` — save digitization progress
- POST `/api/admin/verification/[cardInstanceId]/complete` — approve or reject
- GET `/api/admin/verification/metrics` — admin performance metrics

#### 1G.4: Redemption Cleanup (Digital Deletion)

**Problem**: When a user redeems their physical card, the CardInstance goes to REDEEMED but persists forever. Outbound redemption deliveries are a no-op in `updateShipmentStatus()`.

**Approach**: Soft delete via ARCHIVED status (not hard delete).

Hard delete is unsafe because:
- `Order.cardInstanceId` FK would lose trade history context
- `Shipment.cardInstanceId` FK would destroy shipping audit trail
- `Loan.cardInstanceId` FK would destroy lending history

**Changes to** `src/services/shipment.service.ts` `updateShipmentStatus()`:

When an outbound redemption shipment (no `tradeId`) is marked DELIVERED:
1. Set `CardInstance.status = "ARCHIVED"`, add `archivedAt = new Date()` field
2. Delete the `CardDigitization` record (removes photos/cert data — the "digital file")
3. Delete uploaded images from R2 storage via `upload.service.ts`
4. Notify user: "Your card has been delivered. The digital representation has been removed."

**Schema addition** on CardInstance:
```prisma
archivedAt     DateTime?
```

**Filter ARCHIVED cards** from all user-facing queries: portfolio, card instances, order placement, order book.

#### 1G.5: Card Lost in Transit

When admin marks a shipment as EXCEPTION, add a "Mark as Lost" sub-action.

**Behavior by direction**:
- **Inbound** (card being shipped to company): cancel escrow for associated trade, auto-open dispute, set CardInstance status to LOST, notify buyer and seller
- **Outbound redemption** (card being shipped to owner): set CardInstance status to LOST, notify user that carrier claim is required (user works with carrier directly — platform does not provide insurance)

**Schema addition** on CardInstance: `LOST` added to `CardInstanceStatus` enum (covered above).

No `insuredValue` or `insuranceClaimed` fields needed on Shipment — insurance is the user's responsibility with their carrier.

#### 1G.6: Batch Shipments

Users sending multiple cards at once share one tracking number.

**New model**:
```prisma
model BatchShipment {
  id             String            @id @default(cuid())
  userId         String
  trackingNumber String?
  carrier        String?
  status         ShipmentStatus    @default(LABEL_CREATED)
  direction      ShipmentDirection
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  user           User              @relation(fields: [userId], references: [id])
  shipments      Shipment[]
}
```

**Schema addition** on Shipment:
```prisma
batchShipmentId String?
batchShipment   BatchShipment? @relation(fields: [batchShipmentId], references: [id])
```

When batch shipment status changes, all child shipments update together via `shipment.service.ts`.

#### 1G.7: Listing Wizard

**New page**: `src/app/(marketplace)/sell/page.tsx`

Step-by-step guided flow for sellers:

1. **Select Card**: search/browse the catalog, select the card you're selling
2. **Card Details**: enter cert number (PSA only enforced), grade (10 only enforced), upload photos (optional at listing, required at digitization)
3. **Set Price**: choose LIMIT price or MARKET. Show current order book for reference (best bid, last trade price)
4. **Review & Confirm**: summary of listing, fee disclosure (5% platform fee), submit

**Backend**: calls existing `placeOrder()` with `side: "SELL"` — no new API needed, just new UI.

**Link from**: portfolio page "List for Sale" action, navbar "Sell" button, card detail page "Sell This Card" CTA.

---

### Phase 1G-post: Worker Process + Sync Initialization

#### Separate Worker Process

**New file**: `src/jobs/worker.ts`

Standalone entry point that runs all BullMQ workers and scheduled jobs. Decoupled from the Next.js web server.

**Responsibilities**:
- Call `scheduleRecurringSync()` on startup (fixes the current dead code)
- Start all BullMQ workers: card-sync, order-matching, payment-processing, ship-deadline, wash-trade-detection
- Graceful shutdown on SIGTERM/SIGINT

**Updated schedule** in `src/jobs/schedule-sync.ts`:
- Daily 3am UTC: FULL_SYNC
- Hourly: PRICE_SYNC

**package.json** new script: `"worker": "tsx src/jobs/worker.ts"`

**Deployment**: run `npm run worker` as a separate process alongside `npm run dev` / `npm run start`.

---

## Post-MVP Phases

### Phase 2A: Full Catalog Population

**Problem**: Only 22 seed cards exist. Full Pokemon TCG has 10,000+ cards across 300+ sets. One Piece has 2,000+ across 20+ sets.

**Changes**:
1. Remove `DEFAULT_SET_LIMIT = 5` cap in `src/services/sync/pokemon-tcg.adapter.ts` and `onepiece.adapter.ts` — sync ALL sets
2. Add incremental sync job type — only sync sets released in last 90 days for daily runs
3. Update schedule in `src/jobs/schedule-sync.ts`:
   - Daily 3am: `INCREMENTAL_SYNC` (recent sets only)
   - Sunday 3am: `FULL_SYNC` (everything)
   - Hourly: `PRICE_SYNC` (existing)
4. Add compound database indexes for performance at scale:
   - Card: `@@index([setId, rarity])`, `@@index([supertype])`
   - CardSet: `@@index([gameId, releaseDate])`
5. Price sync optimization — only update cards with price changes, not full re-fetch

**Files**: `src/services/sync/pokemon-tcg.adapter.ts`, `src/services/sync/onepiece.adapter.ts`, `src/services/card-sync.service.ts`, `src/jobs/schedule-sync.ts`, `prisma/schema.prisma`

### Phase 2B: Additional TCG Games

The adapter pattern in `src/services/sync/index.ts` makes this plug-and-play. Per game: create adapter, register it, seed initial data.

**Priority order**:
1. **Magic: The Gathering** — Scryfall API (free, no auth, 25,000+ cards). Largest collector market.
2. **Yu-Gi-Oh** — YGOPRODeck API (free, 12,000+ cards)
3. **Dragon Ball Super** — Smaller market, API availability TBD
4. **Lorcana** — Growing Disney TCG, community APIs

Per game: ~1-2 weeks (adapter + tests + full sync + QA)

### Phase 2C: Lending System

Schema already exists (`Loan`, `LoanOffer` models, `LOCKED_COLLATERAL` status, `loan-monitor` BullMQ queue definition).

**Implementation sequence**:
1. **Loan request** — owner locks VERIFIED card as collateral → `LOCKED_COLLATERAL`
2. **Loan offers** — lenders browse and submit term proposals
3. **Acceptance** — Stripe transfers principal from lender to borrower
4. **Monitoring** — `loan-monitor` BullMQ job checks for overdue loans
5. **Repayment** — borrower pays principal + interest, card unlocks
6. **Default** — overdue cards auto-listed for liquidation, proceeds to lender

**Platform monetization**: Platform takes a percentage of each interest payment. Add to Loan model:
```prisma
platformFeeRate    Float    @default(0.15)   // 15% of interest
platformFeeAmount  Int?     // calculated on each interest payment, in cents
```

**No origination fee**. Revenue is purely from interest spread.

### Phase 2D: Advanced Analytics

- Price charts populated from real trade data (OHLCV candles from Phase 1F)
- Market dashboard: top movers, most traded, volume by game
- Price alerts: users set target prices, BullMQ job notifies on triggers
- Portfolio history: daily snapshots of total portfolio value over time

### Phase 2E: Community Features

- Public profile pages with collection showcase (foundation laid in Phase 1F)
- Per-card discussion threads
- Watchlist (track price changes, new listings for specific cards)
- Trade reviews and ratings (Review model already exists)

### Phase 2F: Operational Scaling

- **More grading companies**: Add SGC, TAG, ACE to `GradingCompany` enum + cert lookup APIs (revisit BGS/CGC when APIs become available)
- **Grade expansion**: Support grades beyond 10 as the market evolves
- **Warehouse management**: Multi-location support, Warehouse model, warehouseId on CardInstance
- **International shipping**: Address model, carrier API integration, customs forms
- **Compliance**: KYC via Stripe Identity for high-value trades, AML monitoring (extends TradingAlert), tax reporting (1099-K for US sellers)
- **Card transfers**: Direct gifting between users without trading (physical card stays in custody, only ownerId changes)
- **Storage fees**: Monthly fee for cards held > N days without being listed. StorageFee model + BullMQ monitor job

---

## Phase 3: iOS App (React Native + Expo)

**Why React Native**: Team stack is TypeScript/React. Shared types from `src/types/`. Expo provides camera, push notifications, OTA updates. The app is a pure API consumer — no SSR needed.

**Auth**: Migrate to OAuth2 + PKCE for both web and mobile (replaces current localStorage JWT). This is a prerequisite that should happen before M1. The current refresh token rotation with family chaining maps well to PKCE flows.

### Phase M1: Core Read-Only (first mobile release)
- Login/register via existing `/api/auth/` endpoints (with PKCE)
- Browse card catalog with search and filters
- Card detail with order book (WebSocket real-time from Phase 1E)
- Portfolio view
- Push notification registration (Expo Push)

### Phase M2: Trading
- Place buy/sell orders
- Order and trade history
- Payment method management (Stripe mobile SDK)
- Shipment tracking with push notifications

### Phase M3: Camera + Cert Scanning
- Camera for scanning PSA cert labels
- OCR to pre-fill cert number and grade
- Photo upload for card images before shipping

### Phase M4: Full Parity
- Notifications center, profiles, redemption, lending (if launched)
- Deep linking (share card listings, trade confirmations)

**Backend changes needed for mobile**:
- Add `pushTokens String[]` to User model
- Modify `notification.service.ts` to send push via Expo Push API
- New route: POST `/api/users/push-token`
- OAuth2 + PKCE flow in `auth.service.ts`

---

## Overall Sequencing

| Priority | Phase | What | Dependencies |
|----------|-------|------|--------------|
| 1 | **1E-pre** | Basic portfolio, fee fix, fill-or-kill, PSA-only, ship deadline | None |
| 2 | **1E** | Rate limiting, wash-trade detection, notification UI, WebSocket, email | 1E-pre |
| 3 | **1F** | Price history (OHLCV), portfolio valuation, reputation, profiles | 1E |
| 4 | **1G** | Homepage dashboard, R2 uploads, admin digitization, redemption cleanup, batch shipments, listing wizard | 1F (upload service needed for digitization) |
| 5 | **1G-post** | Worker process, sync initialization | 1G |
| 6 | **2A** | Full catalog population (lift sync limits) | 1G-post (worker must be running) |
| 7 | **2B** | MTG + Yu-Gi-Oh adapters | 2A |
| 8 | **2D** | Advanced analytics + price alerts | 2A + 1F |
| 9 | **2C** | Lending system | Stable trading platform |
| 10 | **3 M1-M2** | iOS app (core + trading) | Stable API + OAuth2 migration |
| 11 | **2E** | Community features | After user base grows |
| 12 | **2F** | Operational scaling | Ongoing, revenue-dependent |
| 13 | **3 M3-M4** | iOS camera + full parity | After M2 settled |

---

## Key Design Decisions (from 2026-02-17 review)

| # | Decision | Impact |
|---|----------|--------|
| 1 | Single warehouse location | No warehouseId on CardInstance until Phase 2F |
| 2 | Cert number scan for intake | Admin verification UI needs cert number search |
| 3 | User pays flat redemption shipping fee | Need fee config + Stripe charge on redemption |
| 4 | User handles carrier insurance | No insuredValue/insuranceClaimed fields on Shipment |
| 5 | Per-card order book with company filters, PSA + BGS 10 only | Order model already has gradingCompany + minGrade. Enforce PSA-only + grade 10 at order placement |
| 6 | Fill-or-kill market orders | Matching service change — cancel unfilled market remainder |
| 7 | 5% platform fee, lower later | Update default in matching.service.ts from 0.03 → 0.05 |
| 8 | 3 business day ship deadline | New BullMQ job + Trade.shipDeadline field |
| 9 | Auto-reject on any failed digitization check | Simplifies admin flow — no partial approval |
| 10 | PSA only at launch | Reject BGS/CGC at order/instance creation |
| 11 | Admin team with claiming + metrics | CardDigitization.assignedToId + metrics endpoint |
| 12 | Basic portfolio ships before 1E | New 1E-pre phase |
| 13 | Transactional email in Phase 1E | email.service.ts with adapter pattern |
| 14 | Step-by-step listing wizard | New /sell page in Phase 1G |
| 15 | OAuth2 + PKCE for web + mobile | Auth migration before mobile Phase M1 |
| 16 | WebSocket in Phase 1E | ws library, channels for orderbook + notifications + trades |
| 17 | Separate worker process for BullMQ | New src/jobs/worker.ts entry point |
| 18 | Lending revenue = % of interest payments | platformFeeRate on Loan model |
| 19 | USD only | currency field in UserSettings is display-only, no multi-currency Stripe |

---

## Verification Checklist

### After Phase 1E-pre:
1. Portfolio page shows user's cards grouped by status with estimated values
2. Market orders auto-cancel unfilled remainder (fill-or-kill)
3. BGS/CGC sell orders rejected with "PSA only" message
4. Platform fee is 5% (matching.service default = 0.05)
5. Seller gets auto-cancelled + refunded after 3 business days without shipping

### After Phase 1E:
6. Rate limited endpoints return 429 with proper headers
7. Wash trades between same user pair flagged as TradingAlert
8. Notification bell shows unread count, dropdown shows recent 5
9. WebSocket delivers real-time order book updates on card detail page
10. Transactional emails sent for trade fills, verification results, disputes (respecting user preferences)

### After Phase 1G:
11. Full digitization flow: card arrives → admin claims → uploads photos + cert lookup → checklist → approve → buyer sees card with images
12. Auto-reject: any failed checklist item → reject, refund, return card
13. Cert number search: admin types cert number, finds card in queue
14. Admin metrics: cards processed per admin visible on dashboard
15. Redemption deletion: user redeems → outbound delivered → CardInstance ARCHIVED, digitization + images deleted
16. Lost card: admin marks shipment EXCEPTION → "Mark as Lost" → appropriate handling by direction
17. Batch shipment: multiple cards, one tracking number, all transition together
18. Listing wizard: step-by-step sell flow from card selection to order placement

### After Phase 2A:
19. Full sync: 10,000+ Pokemon cards, 2,000+ One Piece cards populated
20. Incremental sync only touches recent sets
21. Browse/search performance with full catalog (< 200ms response times)
