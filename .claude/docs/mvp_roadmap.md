# Cardboard — MVP Roadmap (Private Beta)

> **Target:** Private beta with 10–50 trusted users
> **Ops team:** 3–5 people (need proper admin tooling)
> **Catalog:** Pokémon only, all sets
> **Platform fee:** Waived for beta (PLATFORM_FEE_RATE=0)
> **Created:** 2026-02-18

---

## What We're Proving

The beta validates one thing: **the full physical-card-to-trade loop works end-to-end.** A user can ship a real graded card to the warehouse, have it authenticated and digitized by the ops team, see it in their portfolio, and trade it on an exchange-style order book — with escrow protecting both sides.

**Two valid user flows (both must work):**

**Flow A — Vault First:** User registers card (cert number) → ships to warehouse → ops authenticates + digitizes → card appears in user's portfolio as VERIFIED → user can list it for sale on the order book.

**Flow B — Sell First:** User finds card in catalog → registers card + places sell order simultaneously → trade matches → buyer's payment held in escrow → seller ships card to warehouse → ops authenticates + digitizes → if authentic: funds released to seller, card vaulted as buyer's property. If fails: buyer refunded, card returned to seller.

---

## What's Already Built

Everything from Phases 1A–1D is complete and merged to main:

| Component | Status | Notes |
|-----------|--------|-------|
| Auth (JWT + refresh token rotation) | ✅ Built | Missing: password reset, email verification |
| Card catalog + Pokémon sync | ✅ Built | Capped at 5 sets — needs limit removal |
| Order book + matching engine | ✅ Built | Prisma-based, fine for beta volume |
| OrderForm (buy + sell with cert fields) | ✅ Built | Already handles sell-side registration inline |
| Stripe escrow (authorize → capture → transfer) | ✅ Built | Full payment flow operational |
| Shipping service (inbound + outbound + redemption) | ✅ Built | No carrier API — manual tracking |
| Verification service (approve/reject + PSA cert lookup) | ✅ Built | Needs: admin claiming, simplified digitization |
| Disputes service | ✅ Built | Full open/resolve/queue flow |
| WebSocket server + client hooks | ✅ Built | Not wired to OrderBook component |
| Notification service + bell + dropdown + page | ✅ Built | Bell (129L), dropdown (122L), page (281L) |
| Email service (Resend + console adapter) | ✅ Built | No triggers wired — sends nothing yet |
| Portfolio service + page | ✅ Built | Service (161L), page (386L) — needs review |
| Ship deadline worker | ✅ Built | Already wired to escrow service, 3 biz day enforcement |
| Rate limiting (Redis sliding window) | ✅ Built | Not needed for beta — trusted users |
| Wash trade detection | ✅ Built | Not needed for beta — trusted users |
| 5 BullMQ workers | ✅ Built | Need unified entry point (worker.ts) |

**Bottom line:** The core trading infrastructure is built. The MVP work is about completing gaps, upgrading the admin experience, and polishing the user-facing sell flow.

---

## MVP Build Phases

### Phase A: Foundation Fixes

> **Goal:** Catalog ready, market orders correct, PSA enforced, worker running
> **Effort:** ~1 week
> **Dependencies:** None — can start immediately

#### A.1 — Full Pokémon Catalog Sync

**Problem:** Only 5 sets sync. Beta needs the full Pokémon catalog for real trading.

**Changes:**
- `src/services/sync/pokemon-tcg.adapter.ts:4` — remove `DEFAULT_SET_LIMIT = 5`, sync all sets
- `src/services/sync/pokemon-tcg.adapter.ts:113` — remove `pageSize=${DEFAULT_SET_LIMIT}` from URL, use API's default pagination
- Add compound indexes in `prisma/schema.prisma` for search performance at scale:
  - `Card: @@index([setId, rarity])`, `@@index([supertype])`
  - `CardSet: @@index([gameId, releaseDate])`
- One Piece adapter: **disable** for beta (Pokémon only). Comment out registration in `src/services/sync/index.ts` or add `ENABLED_GAMES=pokemon` env var

**Run:** Initial full sync will populate 10,000+ Pokémon cards across 300+ sets. Verify browse/search performance.

#### A.2 — Platform Fee Waiver

- `.env` — set `PLATFORM_FEE_RATE=0`
- `.env.example` — set `PLATFORM_FEE_RATE=0` with comment: `# Set to 0.05 for 5% fee in production`
- No code changes needed — matching service already reads from env

#### A.3 — Fill-or-Kill Market Orders

**Problem:** Market orders rest as OPEN if no liquidity. Should fill what's available and cancel the remainder.

**Changes in** `src/services/matching.service.ts`:
- After the matching loop completes, if order is type MARKET and has unfilled quantity:
  - `filledQuantity > 0`: status → PARTIALLY_FILLED then CANCELLED, notify: "Market order partially filled — {filled}/{total}, remainder cancelled"
  - `filledQuantity === 0`: status → CANCELLED, notify: "Market order cancelled — no matching orders"
- Add `cancelledRemainder: number` to `MatchResult`

**Changes in** `src/services/order.service.ts`:
- After `matchOrder()` returns, if MARKET and now CANCELLED, clean up card instance (same logic as manual cancel for sell orders)

#### A.4 — PSA-Only Enforcement

**Changes:**
- `src/services/order.service.ts` — validate `gradingCompany === "PSA"` on sell order placement. Reject BGS/CGC: "Only PSA graded cards are accepted at this time."
- `src/services/card-instance.service.ts` — same validation on CardInstance registration
- `src/components/order-book/OrderForm.tsx` — remove BGS/CGC from `GRADING_COMPANIES` array (currently shows all three), only show PSA
- Buy orders: `gradingCompany` filter should default to PSA

#### A.5 — Unified Worker Process

**New file:** `src/jobs/worker.ts`

Standalone entry point that starts all BullMQ workers and scheduled jobs. Decoupled from the Next.js web server.

```typescript
// Pseudostructure:
// 1. Import all workers (card-sync, order-matching, payment-processing, ship-deadline, wash-trade)
// 2. Call scheduleRecurringSync() — daily 3am FULL_SYNC, hourly PRICE_SYNC
// 3. Graceful shutdown on SIGTERM/SIGINT
// 4. Log worker startup/shutdown events
```

**package.json:** Add `"worker": "tsx src/jobs/worker.ts"`

**Deploy:** Run `npm run worker` as a separate process alongside `npm run dev`.

#### Verification: After Phase A
- [ ] Browse page shows 10,000+ Pokémon cards across all sets
- [ ] Search/filter works with full catalog (<500ms response)
- [ ] Market orders with no liquidity are immediately cancelled (not left OPEN)
- [ ] Only PSA appears in sell form; BGS/CGC rejected at API level
- [ ] `npm run worker` starts all 5 BullMQ workers + sync schedule
- [ ] Trades execute with $0 platform fee

---

### Phase B: Auth Completion

> **Goal:** Users can reset passwords and must verify email before transacting
> **Effort:** ~1.5 weeks
> **Dependencies:** Email service (already built)

#### B.1 — Password Reset / Forgot Password

**New methods in** `src/services/auth.service.ts`:
- `requestPasswordReset(email)` — generates cryptographically random token (32 bytes, hex-encoded), stores `passwordResetToken` (hashed) + `passwordResetExpires` (1 hour from now) on User, sends reset email via `email.service.ts`
- `resetPassword(token, newPassword)` — validates token matches hash + not expired, updates password hash, invalidates ALL refresh tokens for that user (force re-login on all devices), clears reset fields

**Schema additions on User:**
```prisma
passwordResetToken    String?
passwordResetExpires  DateTime?
```

**API routes:**
- `POST /api/auth/forgot-password` — accepts `{ email }`, always returns 200 (don't leak whether email exists)
- `POST /api/auth/reset-password` — accepts `{ token, newPassword }`

**UI pages:**
- `/forgot-password` — email input form, success message ("If an account exists, we've sent a reset link")
- `/reset-password/[token]` — new password + confirm password form

**Email:** "Reset your password" with link to `/reset-password/{token}`. Expires in 1 hour.

#### B.2 — Email Verification at Registration

**Flow:**
1. Registration creates user with `emailVerified: false`
2. System generates verification token, sends email with link
3. User clicks link → `POST /api/auth/verify-email` → `emailVerified = true`
4. Until verified: user can browse catalog but **cannot** place orders, register card instances, or initiate shipments
5. Persistent banner on all authenticated pages: "Verify your email to start trading" with resend button

**New methods in** `src/services/auth.service.ts`:
- `sendVerificationEmail(userId)` — generates token, stores on user, sends email
- `verifyEmail(token)` — validates token, sets `emailVerified = true`
- `resendVerification(userId)` — rate-limited (max 3 per hour)

**Schema additions on User:**
```prisma
emailVerified             Boolean   @default(false)
emailVerificationToken    String?
emailVerificationExpires  DateTime?
```

**API routes:**
- `POST /api/auth/verify-email` — accepts `{ token }`
- `POST /api/auth/resend-verification` — requires auth, rate-limited

**API guards:**
- Add `requireEmailVerified()` check to order placement, card instance registration, shipment creation, and dispute creation routes
- Returns `403 { error: "Email verification required" }` with resend link

**Registration change:** After successful `register()`, auto-call `sendVerificationEmail(userId)` before returning.

**UI:** Verification banner component in the main layout, dismissible only after verification. `/verify-email/[token]` success/error page.

#### Verification: After Phase B
- [ ] Forgot password → email with reset link → new password works → old sessions invalidated
- [ ] Registration sends verification email automatically
- [ ] Unverified users can browse but get 403 on transactional endpoints
- [ ] Verification link works and removes the banner
- [ ] Resend verification is rate-limited (3/hour)
- [ ] Reset link expires after 1 hour

---

### Phase C: Sell Flow

> **Goal:** Two ways to sell — guided wizard for new users, inline for experienced users
> **Effort:** ~2 weeks
> **Dependencies:** Phase A (PSA enforcement, catalog)

#### C.1 — Listing Wizard (/sell page)

**New page:** `src/app/(marketplace)/sell/page.tsx`

Step-by-step guided flow — the primary entry point for selling a card.

**Step 1 — Find Your Card:**
- Search bar with card name autocomplete (use existing catalog search, debounced 300ms)
- Results grid: card image, name, set name, card number
- User clicks a card to select it

**Step 2 — Card Details:**
- Pre-filled: card name, set, image (from catalog)
- User enters: PSA cert number, grade (enforce grade 10 only for launch, with note "PSA 10 only at launch")
- Grading company fixed to PSA (no selector needed)
- Validation: cert number format check (PSA uses 8-digit numbers)
- Show PSA scan preview: link/embed `https://www.psacard.com/cert/{certNumber}/psa` so user can confirm the cert matches their card

**Step 3 — Set Your Price:**
- Order type toggle: LIMIT or MARKET
- If LIMIT: price input (USD) with the current order book context shown alongside:
  - Best bid (highest buy order)
  - Best ask (lowest sell order currently listed)
  - Last trade price (if any)
  - Spread indicator
- If MARKET: show best bid with note "Your card will sell at the best available buy price"
- Fee disclosure: "Platform fee: $0 (beta)" — placeholder for when fee goes live

**Step 4 — Review & Confirm:**
- Summary card: card image + name + cert number + grade + price + order type
- Explain what happens next based on scenario:
  - If matched immediately: "Your card matched a buyer! Ship your card to our warehouse within 3 business days. Buyer's payment is held in escrow until we verify your card."
  - If no match yet: "Your sell order is now on the order book. When a buyer matches your price, you'll be notified to ship your card."
  - If card is already in vault (VERIFIED): "Your card is already verified. The trade will execute instantly."
- Confirm button → calls existing `placeOrder()` with `side: "SELL"`

**Navigation:** Accessible from navbar "Sell" button, portfolio page "List for Sale" action, and homepage CTA.

#### C.2 — Enhanced Inline Sell (OrderForm Upgrade)

**Changes to** `src/components/order-book/OrderForm.tsx`:

The existing component already has sell-side fields (cert number, grading company, grade). Enhancements:

- Remove BGS/CGC from dropdown (PSA-only, per Phase A.4) — or better, remove the dropdown entirely and show "PSA" as fixed text
- Enforce grade = 10 only (input or fixed display with "PSA 10 only at launch" note)
- Add cert number format validation (8 digits)
- Add contextual info panel when SELL tab is active:
  - Best bid, last trade price, spread
  - Brief explainer: "When matched, you'll ship this card to our warehouse for verification"
- Improve success state: after order placed, show clear next steps ("Check your orders page for status. Ship within 3 business days after matching.")

#### C.3 — Post-Match Sell Flow UX

When a sell order matches, the seller needs clear guidance. Enhance the notification and orders page:

**Notification enhancement** (in `notification.service.ts` triggers):
- On sell order match: "Your [card name] sold for $[price]! Ship your card to our warehouse within 3 business days."
- Include warehouse shipping address in the notification or link to shipping instructions page

**Orders page enhancement** (`src/app/(marketplace)/orders/page.tsx`):
- FILLED sell orders should show a prominent "Ship Now" CTA with:
  - Warehouse shipping address
  - Packing instructions (protect the slab, use tracking)
  - Deadline countdown ("Ship by [date] — X days remaining")
  - "Mark as Shipped" action → prompts for tracking number
- Orders in PENDING_SHIPMENT state show tracking status if provided

**New static page:** `/shipping-instructions` — permanent page with warehouse address, packing guidelines, and FAQ about the verification process.

#### Verification: After Phase C
- [ ] `/sell` wizard walks through all 4 steps and places a sell order
- [ ] Inline OrderForm on card detail enforces PSA-only and grade 10
- [ ] After sell match, notification includes clear shipping instructions
- [ ] Orders page shows "Ship Now" CTA with deadline countdown for matched sells
- [ ] Shipping instructions page accessible from multiple entry points

---

### Phase D: Admin Verification & Digitization

> **Goal:** Ops team can claim cards from a queue, authenticate via PSA cert lookup, approve/reject, and pull PSA scan images — for both vault-first and sell-first flows
> **Effort:** ~2 weeks
> **Dependencies:** Phase A (worker process), existing verification service

#### D.1 — Admin Claiming System

**Problem:** With 3-5 ops people, two admins might try to verify the same card simultaneously.

**Schema additions:**
```prisma
// Add to CardInstance:
claimedById     String?
claimedAt       DateTime?
```

**New methods in** `src/services/verification.service.ts`:
- `claimCard(adminId, cardInstanceId)` — sets `claimedById` + `claimedAt`, ensures card is PENDING_VERIFICATION and not already claimed. Returns the card with full details for verification.
- `unclaimCard(adminId, cardInstanceId)` — releases claim (admin decides to skip or can't verify)
- `getMyClaimedCards(adminId)` — cards this admin has claimed but not yet resolved

**Queue enhancement** in `getVerificationQueue()`:
- Show `claimedById` and `claimedBy.name` in results
- Filter options: "Unclaimed" (default), "My Claims", "All"
- Sort: oldest first (FIFO)

#### D.2 — Simplified Digitization Workflow

**Flow (replaces current binary approve/reject):**

1. Admin opens verification queue → sees PENDING_VERIFICATION cards
2. Admin clicks "Claim" on a card → card locked to them, status stays PENDING_VERIFICATION
3. Admin sees the card detail panel:
   - **Card info:** name, set, cert number, grade (from CardInstance + Card catalog)
   - **PSA Scan:** display from `https://www.psacard.com/cert/{certNumber}/psa` (iframe or extracted images)
   - **Cert Lookup:** button to run PSA cert lookup (already built in `lookupCertification()`)
   - **Cert lookup result:** shows verified grade, card name, year — admin compares against what seller submitted
   - **Optional notes:** free-text field for anything notable about the card
4. Admin decision:
   - **Approve** → cert matches, card is authentic → CardInstance status → VERIFIED, `imageUrls` populated with PSA scan URL(s)
     - If card has a pending trade (sell-first flow): trigger escrow release (funds to seller)
     - If no pending trade (vault-first flow): card appears in owner's portfolio as VERIFIED
   - **Reject** → cert doesn't match, card suspicious, damaged → CardInstance remains, flagged for return
     - If card has a pending trade: trigger escrow cancellation (refund buyer), queue card for return to seller
     - If no pending trade: notify owner of rejection with reason, queue card for return

**Schema additions on CardInstance:**
```prisma
verificationNotes    String?
psaScanUrl           String?
certLookupData       Json?      // Cached PSA API response
verifiedById         String?
verifiedAt           DateTime?
```

**Service changes** in `verification.service.ts`:
- Rename `verifyCard()` to `completeVerification(adminId, cardInstanceId, { approved, notes? })`
- On approve: set status VERIFIED, populate `psaScanUrl` from PSA scan fetch, cache cert lookup data, set `verifiedById` + `verifiedAt`, then:
  - Check if there's a matched trade pending this card's verification → release escrow
  - Create notification for card owner: "Your [card name] has been verified!"
- On reject: keep current reject behavior (cancel escrow if applicable, notify), add `verificationNotes` for the reason
- New: `getCertLookupAndScan(certNumber)` — runs PSA cert lookup AND fetches scan URL in one call

#### D.3 — PSA Scan Image Fetching

**Every PSA cert has a scan page at a deterministic URL:**
```
https://www.psacard.com/cert/{certNumber}/psa
```
Example: cert `44589233` → `https://www.psacard.com/cert/44589233/psa`

This eliminates R2 image upload infrastructure entirely. No Cloudflare R2, no presigned URLs, no upload service.

**New utility:** `src/services/psa-scan.service.ts`
- `getPsaScanUrl(certNumber: string): string` — returns `https://www.psacard.com/cert/${certNumber}/psa`. Pure string construction, no API call needed.
- `getPsaScanImageUrls(certNumber: string): Promise<{ front?: string; back?: string }>` — fetches the cert page and extracts the direct image URLs for the front/back scans (these are embedded `<img>` tags on the cert page). Cache results on the CardInstance.

**Usage:**
- Admin verification panel: display the scan page in an iframe or extract and display the front/back images directly
- CardInstance `psaScanUrl` field: stores the cert page URL
- CardInstance `imageUrls` array: stores extracted front/back image URLs (for display on card detail pages, portfolio, etc.)

**Fallback:** Some very old certs may not have scans. If the cert page returns no images, admin sees "No PSA scan available" and can still approve/reject based on cert lookup data alone. Notes field can document this.

#### D.4 — Admin Verification UI Upgrade

**Redesign** `src/app/(admin)/verification/page.tsx`:

**Queue View (default):**
- Table: card name, set, cert number, owner, submitted date, status (Unclaimed / Claimed by [name])
- Filter tabs: "Unclaimed" | "My Claims" | "All Pending"
- Search: type cert number to find a specific card
- "Claim" button on unclaimed cards
- Click a claimed card to open the verification panel

**Verification Panel (after claiming):**
- Left side: card catalog info (image from catalog, name, set, card number)
- Center: PSA scan image (fetched from PSA website)
- Right side: verification controls
  - "Run Cert Lookup" button → shows results inline (grade, card name, year, valid/invalid)
  - Cert lookup comparison: system auto-highlights mismatches between submitted data and PSA data
  - Notes field (optional, free text)
  - **Approve** button (green) — "Verify & Release" if there's a pending trade, "Verify & Vault" if vault-first
  - **Reject** button (red) — prompts for reason (dropdown: "Cert mismatch", "Suspected counterfeit", "Damaged encasement", "Other" + free text)
  - "Unclaim" link — release back to queue

**Context banner at top of verification panel:**
- If sell-first flow (pending trade exists): "⚡ Trade pending — buyer's funds in escrow. Approving will release $X to seller."
- If vault-first flow (no trade): "📦 Pre-trade deposit — approving will add this card to [owner name]'s portfolio."

#### Verification: After Phase D
- [ ] Admin can claim a card from the queue (locks it to them)
- [ ] Other admins see the card as "Claimed by [name]"
- [ ] PSA scan image displays in verification panel
- [ ] Cert lookup runs and results display inline
- [ ] Approve on sell-first card releases escrow to seller
- [ ] Approve on vault-first card adds to owner's portfolio as VERIFIED
- [ ] Reject on sell-first card refunds buyer and queues return
- [ ] Reject on vault-first card notifies owner and queues return
- [ ] Cert number search finds specific cards in queue

---

### Phase E: Real-Time & Notifications

> **Goal:** Order book updates live, notifications work in-app and via email for key events
> **Effort:** ~1.5 weeks
> **Dependencies:** Phase A (worker), email service (already built)

#### E.1 — Wire WebSocket to OrderBook Component

**Problem:** WebSocket server exists, hooks exist (`useOrderBook`, `useNotifications`), but the OrderBook component polls the API instead.

**Changes to** `src/components/order-book/OrderBook.tsx`:
- Replace the polling `useEffect` with `useOrderBook(cardId)` hook
- Hook provides real-time order book updates (new orders, fills, cancels)
- Add visual "🔴 Live" indicator when WebSocket is connected
- Fallback: if WebSocket disconnects, revert to polling automatically (degrade gracefully)
- Add real-time trade ticker below the order book: shows last few trades as they happen via `trades:{cardId}` channel

**Changes to** `src/components/layout/NotificationBell.tsx`:
- Wire `useNotifications()` hook so new notifications appear in the bell immediately (no page refresh)
- Bell count updates in real-time

**Verify integration points (already built, just confirm they fire):**
- `matching.service.ts` publishes to `orderbook:{cardId}` and `trades:{cardId}` after trade
- `order.service.ts` publishes to `orderbook:{cardId}` after order placement/cancellation
- `notification.service.ts` publishes to `notifications:{userId}` after creating notification

#### E.2 — Email Notifications for Critical Events

**Problem:** Email service exists with Resend adapter but nothing triggers it. Wire up emails for the events that matter most during beta.

**Changes to** `src/services/notification.service.ts`:
- After creating an in-app notification, check the event type and send email if it's a critical event
- Check `UserSettings` preferences before sending (the fields already exist in the schema)

**Critical event emails for beta:**

| Event | Email Subject | Trigger Point |
|-------|--------------|---------------|
| Trade matched (buyer) | "Your order for [card] has been filled" | `matching.service.ts` after trade creation |
| Trade matched (seller) | "Your [card] sold — ship within 3 days" | `matching.service.ts` after trade creation |
| Card verified (approve) | "Your [card] has been verified" | `verification.service.ts` on approve |
| Card verification failed | "Verification issue with your [card]" | `verification.service.ts` on reject |
| Escrow released (seller) | "Payment released — $X on the way" | `escrow.service.ts` on release |
| Ship deadline warning | "Reminder: Ship your card by [date]" | New — 24 hours before deadline |
| Ship deadline missed | "Your trade has been cancelled" | `ship-deadline.worker.ts` on expiry |

**Ship deadline warning email:**
- Add a second BullMQ delayed job in `escrow.service.ts` alongside the existing deadline job
- Fires 24 hours before deadline (2 business days after trade)
- Sends reminder email + in-app notification to seller

**Email format:** Plain text for MVP (already the default in email.service.ts). Include:
- What happened
- What the user needs to do (if anything)
- Link to the relevant page (orders, portfolio, etc.)

#### E.3 — Notification Trigger Wiring

Currently `createNotification()` is called in some services but not all relevant places. Audit and wire:

| Event | Service | Currently Notifies? | Action |
|-------|---------|-------------------|--------|
| Trade created | matching.service.ts | Verify | Ensure buyer + seller notified |
| Order cancelled | order.service.ts | Verify | Notify owner |
| Card verified | verification.service.ts | Verify | Notify owner |
| Card rejected | verification.service.ts | Verify | Notify owner |
| Escrow released | escrow.service.ts | Verify | Notify seller |
| Escrow cancelled/refunded | escrow.service.ts | Verify | Notify buyer |
| Dispute opened | dispute.service.ts | Verify | Notify counterparty |
| Dispute resolved | dispute.service.ts | Verify | Notify both parties |
| Ship deadline missed | ship-deadline.worker.ts | Verify | Notify buyer + seller |
| Ship deadline warning (NEW) | New delayed job | Build | Notify seller |

**Task:** Walk through each service and verify `createNotification()` calls exist. Add missing ones. Then add the email trigger after each notification for critical events.

#### Verification: After Phase E
- [ ] OrderBook component updates in real-time (no page refresh needed)
- [ ] "Live" indicator shows WebSocket connection status
- [ ] New notifications appear in bell instantly via WebSocket
- [ ] Seller receives email when their card sells
- [ ] Buyer receives email when their order fills
- [ ] Seller gets email reminder 24 hours before ship deadline
- [ ] Card owner gets email when verification completes (pass or fail)

---

### Phase F: Portfolio & UX Polish

> **Goal:** Users can see and manage their cards, overall experience feels complete
> **Effort:** ~1 week
> **Dependencies:** Phases C + D (sell flow, verification)

#### F.1 — Portfolio Page Review & Enhancement

**Existing state:** Portfolio service (161L) and page (386L) already exist with card grid and status tabs.

**Review and enhance:**
- Verify all card statuses display correctly: PENDING_SHIPMENT, IN_TRANSIT, PENDING_VERIFICATION, VERIFIED, LISTED, REDEEMED
- Each card shows: PSA scan image (from `psaScanUrl` or catalog `imageUrl`), name, set, grade, status badge, estimated value
- Status-specific actions:
  - VERIFIED: "List for Sale" → links to `/sell` wizard (pre-populated with this card)
  - LISTED: "View Order" → links to order on orders page, "Cancel Listing" action
  - PENDING_SHIPMENT: "Shipping Instructions" → links to `/shipping-instructions`
  - All: "View Details" → card detail page
- Summary bar: total cards, total estimated value (from `Card.marketPrice`), cards by status count
- Empty state: "No cards yet — browse the marketplace or sell your first card" with CTAs

#### F.2 — Vault My Card Wizard

For users who want to vault a card before selling it (Flow A), a dedicated entry point with its own wizard.

**New page:** `src/app/(marketplace)/vault/page.tsx`

"Vault My Card" — a focused wizard for depositing a card into the vault.

**Step 1 — Find Your Card:**
- Same search/select experience as the sell wizard (reuse the search component)
- User searches by card name, selects from catalog results

**Step 2 — Card Details:**
- Pre-filled: card name, set, image from catalog
- User enters: PSA cert number (8 digits), grade fixed to PSA 10
- Show PSA scan preview: embed/link `https://www.psacard.com/cert/{certNumber}/psa` so user can verify they entered the right cert
- Validation: cert number format, not already registered on platform

**Step 3 — Confirm & Ship:**
- Summary: card name + cert number + PSA scan preview
- Explain what happens: "Ship your card to our warehouse. Once we verify it, it'll appear in your portfolio as a verified card. You can then sell it, swap it, or just hold it."
- Warehouse shipping address displayed prominently
- Packing guidelines (inline summary + link to `/shipping-instructions`)
- "Confirm & Get Shipping Instructions" button → creates CardInstance in PENDING_SHIPMENT

**Post-confirmation:** Redirect to a success page showing:
- "Card registered! Ship it to us at [address]"
- Link to portfolio to track status
- Option to "Vault Another Card" (restart wizard)

**Navigation:** Accessible from navbar (alongside "Sell"), portfolio empty state, homepage quick actions.

**Backend:** `POST /api/card-instances` creates a CardInstance in PENDING_SHIPMENT status without an associated order. This is the vault-first registration endpoint — distinct from the sell flow which creates a CardInstance + Order together.

#### F.3 — Homepage Polish

The current homepage is a marketing landing page. For beta:

- Keep the landing page for unauthenticated visitors
- For authenticated users: add a simple dashboard section above the fold:
  - "Welcome back, [name]" with quick stats: X cards in portfolio, X open orders
  - Quick actions: "Sell a Card", "Browse Marketplace", "My Portfolio"
  - Recent activity: last 3-5 notifications inline
- Not a full market analytics dashboard — just orientation for where to go

#### Verification: After Phase F
- [ ] Portfolio shows all card statuses with correct actions per status
- [ ] PSA scan images display on portfolio cards (where available)
- [ ] "Vault My Card" wizard walks user through find card → enter cert → confirm & ship
- [ ] PSA scan preview displays during cert entry so user can verify they entered correctly
- [ ] Vaulted card appears in portfolio as PENDING_SHIPMENT after wizard completion
- [ ] "List for Sale" on a VERIFIED card pre-populates the sell wizard
- [ ] Authenticated homepage shows quick stats and navigation

---

## What's Explicitly NOT in MVP

These are deferred to post-beta phases. Documenting them here so we don't scope creep:

| Feature | Why Deferred |
|---------|-------------|
| KYC (Stripe Identity) | Private beta with trusted users — no compliance need |
| 2FA / MFA | Trusted users; password reset + email verify is sufficient |
| GDPR account deletion | Not needed for 10-50 beta users |
| Rate limiting (active) | Built but unnecessary for trusted users |
| Wash trade detection (active) | Built but unnecessary for trusted users |
| Card swaps | Post-beta differentiator |
| Collection tracker / Pokédex | Post-beta — portfolio is sufficient for now |
| Price alerts / watchlists | Post-beta |
| Insurance | Requires insurance partner procurement |
| Lending system | Requires stable trading volume |
| Bulk CSV import | Post-beta onboarding tool |
| Public API | Post-beta ecosystem tool |
| Mobile app | Web only for beta |
| Redis matching migration | Prisma handles beta volume fine |
| Carrier API integration | Manual tracking sufficient for beta |
| HTML email templates | Plain text emails fine for beta |
| Full-text search / autocomplete | Prisma `contains` sufficient for beta catalog |
| Price history / OHLCV charts | Need trading data first |
| R2 image uploads | PSA scans replace the need for this |
| Warehouse vault locations | Ops team is small, physical organization is manual |
| Receiving dock software | 3-5 people can coordinate without formal receiving system |
| Inventory audits | Too few cards to need automated audits |
| Reputation scoring | Trusted users, not enough data |
| Public profiles | Post-beta |
| One Piece / other games | Pokémon only for beta |
| Grade expansion (PSA 7-9) | PSA 10 only for simplicity |

---

## MVP Sequencing Summary

| Phase | Theme | Key Deliverables | Effort |
|-------|-------|-----------------|--------|
| **A** | Foundation | Full Pokémon catalog, fill-or-kill, PSA-only, fee waiver, worker process | ~1w |
| **B** | Auth | Password reset, email verification at registration | ~1.5w |
| **C** | Sell Flow | Listing wizard (/sell), inline sell upgrade, post-match seller UX | ~2w |
| **D** | Admin | Claiming system, simplified digitization, PSA scan fetching, verification UI | ~2w |
| **E** | Real-Time | WebSocket → OrderBook, email notifications for critical events | ~1.5w |
| **F** | Polish | Portfolio enhancements, vault-first flow, homepage for authenticated users | ~1w |

**Total estimated effort: ~9 weeks**

**Recommended build order:** A → B → C and D in parallel → E → F

Phases C (sell flow) and D (admin verification) can be built simultaneously if you have two developers — they touch different files and are independently testable. Phase E wires everything together with real-time updates and emails. Phase F is final polish before inviting beta users.

---

## Pre-Launch Checklist

Before inviting the first beta users:

### Infrastructure
- [ ] PostgreSQL database provisioned (production-ready, with backups)
- [ ] Redis instance running (for BullMQ + WebSocket pub/sub)
- [ ] Next.js app deployed
- [ ] Worker process running (`npm run worker`)
- [ ] Stripe account in live mode (or test mode for initial testing)
- [ ] Resend email provider configured with verified domain
- [ ] Full Pokémon catalog synced (10,000+ cards)
- [ ] Environment variables set: `PLATFORM_FEE_RATE=0`, PSA API credentials, Stripe keys, Resend key, Redis URL

### Ops Team Setup
- [ ] Admin accounts created for all 3-5 ops team members
- [ ] Warehouse address documented and added to `/shipping-instructions`
- [ ] Ops team trained on: claiming cards, running cert lookup, approve/reject flow
- [ ] Packing/shipping guidelines written for sellers
- [ ] Return process documented (for rejected cards)

### Test the Full Loop (Both Flows)
- [ ] **Flow A:** Register card → ship → ops verifies → appears in portfolio → list for sale → someone buys → escrow executes
- [ ] **Flow B:** Find card → sell wizard → place sell order → matches buyer → seller ships → ops verifies → funds released
- [ ] Failed verification: reject a card → buyer refunded → seller notified
- [ ] Ship deadline: let 3 business days pass → auto-cancel → buyer refunded
- [ ] Password reset: trigger forgot password → receive email → reset works
- [ ] Email verification: register → receive email → verify → can now trade

### Invite Plan
- [ ] Beta invite email/message drafted
- [ ] Feedback channel set up (Discord? Direct messages?)
- [ ] Known limitations documented for beta users ("Pokémon only, PSA 10 only, no fees during beta")

---

## Key Design Decisions (MVP-Specific)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Platform fee waived | Remove friction for beta testing. Turn on (5%) at soft launch. |
| 2 | PSA scans from `psacard.com/cert/{certNumber}/psa` — no R2 uploads | Deterministic URL, zero infrastructure. Every PSA cert has scans. |
| 3 | Simplified digitization (cert lookup + approve/reject) | Full checklist/photo workflow is overkill for 3-5 trusted ops with low volume. |
| 4 | Admin claiming without metrics | Prevents duplicate work, but performance tracking isn't needed with a small team. |
| 5 | Both sell flows from day one | Some users want to vault first, others want to sell immediately. Both are natural. |
| 6 | Email for critical events only | Don't spam beta users. Trade fills, verification results, and ship deadlines are what matter. |
| 7 | No rate limiting / wash trade detection | Built and ready to activate, but unnecessary overhead for 10-50 trusted users. |
| 8 | Pokémon only, all sets | Biggest market, both adapters exist but focus on one. Full catalog for real trading. |
| 9 | Wizard + inline sell | Wizard for new users, inline for card-detail browsing. Both call the same API. |
| 10 | No warehouse software | 3-5 ops people managing <500 cards can use labeled bins + a spreadsheet. Software comes at scale. |
| 11 | WebSocket as priority | Real-time order book is the core marketplace experience. Polling feels like a toy. |
| 12 | Plain text emails | Faster to build, easier to debug. HTML templates post-beta. |
| 13 | Grade 10 only | Simplifies matching and verification. Expand to 7-10 post-beta. |
