# Cardboard — Additional MVP Roadmap (Post-Beta → Production Launch)

> **Scope:** Phases G–M building on existing Phases A–F
> **Total additional effort:** ~10–12 weeks
> **Created:** 2026-02-20

---

## Phase G: Username System (~3–4 days)

**Dependencies:** Phase B (auth)

### Features Built

**G.1 — Schema & Validation**
- Add `username String @unique` and `usernameChangedAt DateTime?` to User model in `prisma/schema.prisma`
- Validation: required, 3–20 chars, `/^[a-zA-Z0-9_]{3,20}$/`, case-insensitive uniqueness
- Reserved words blocklist: admin, system, cardboard, support, help, null, undefined
- Migration strategy: add nullable first, backfill from `name`, then make required

**G.2 — Registration Flow Update**
- `src/services/auth.service.ts` → `register()`: accept + validate `username` param
- `src/app/api/auth/register/route.ts`: add username to body, 409 if taken
- `src/app/(auth)/register/page.tsx`: username field with real-time availability check
- New route `GET /api/auth/check-username?username=foo`: public, rate-limited 10/min, returns `{ available: boolean }`

**G.3 — Username Change with Cooldown**
- New route `PUT /api/user/username`: validate format + uniqueness, enforce 30-day cooldown via `usernameChangedAt`, return 429 with `nextChangeDate` if within cooldown
- `src/app/profile/page.tsx`: inline edit with availability check, cooldown display, confirm dialog

**G.4 — Display Usernames Throughout UI**
- Replace `name` with `@username` in: navbar user menu, order book trade history, notifications, trade details, admin verification queue, dispute details, shipping instructions

### Verification
- [ ] Registration requires username, rejects duplicates (case-insensitive)
- [ ] Real-time availability check works on registration form
- [ ] Username shown throughout UI
- [ ] 30-day cooldown enforced on changes, old username freed

---

## Phase H: PSA Integration Overhaul (~1.5 weeks)

**Dependencies:** Phase D (admin verification)

### Features Built

**H.1 — Verify & Fix Existing Scraping**
- Test `src/services/psa-scan.service.ts` with 10+ real cert numbers across eras
- Fix HTML parsing failures, add 5s timeout, retry with backoff
- Document which certs have/lack scans
- If unreliable, deprioritize in favor of H.2

**H.2 — PSA API Integration**
- New service `src/services/psa-api.service.ts` with:
  - `getPsaAccessToken()` — OAuth2 client credentials, cached ~1hr
  - `lookupCert(certNumber)` — returns `PsaCertData { certNumber, grade, cardName, year, brand, set, variety, populationHigher, populationEqual, isCertValid, imageUrl? }`
  - `getCertImageUrl(certNumber)` — deterministic URL construction
  - `validateCert(certNumber, expected)` — compare API data against submitted data
- Uses existing env vars: `PSA_API_CLIENT_ID`, `PSA_API_CLIENT_SECRET`
- Replace scraping calls in: `verification.service.ts` → `lookupCertification()`, `order.service.ts` → sell order cert validation, `card-instance.service.ts` → registration validation
- Fallback chain: PSA API → scraping → manual admin verification

**H.3 — Display PSA Scan Images Everywhere**
- New component `src/components/cards/PsaScanImage.tsx`: props `certNumber`, `size` (sm/md/lg), `showBack?`, loading skeleton, catalog image fallback, lazy loading via Intersection Observer
- Display in: card detail page (hero image), order book (thumbnail), portfolio (per instance), admin verification (large front + back), sell wizard step 2 (preview after cert entry), vault wizard step 2, trade details

**H.4 — Caching**
- Store PSA API response in `CardInstance.certLookupData` (Json field, already exists)
- Cache extracted image URLs in `CardInstance.imageUrls` array
- In-memory API token caching with expiry tracking
- Rate limit awareness: request queuing, log rate limit headers

### Verification
- [ ] PSA API returns structured data for valid certs, clear error for invalid
- [ ] Scan images display on card detail, order book, portfolio, admin panel, wizards
- [ ] PsaScanImage handles loading, missing scans, fallback gracefully
- [ ] Cert data cached — repeat lookups don't re-hit API
- [ ] Scraping fallback works if API unavailable

---

## Phase I: Stripe Payment Lifecycle (~2 weeks)

**Dependencies:** Phase E (notifications)

### Features Built

**I.1 — Test Environment Setup**
- Configure test keys: `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PUBLISHABLE_KEY=pk_test_...`
- Stripe CLI webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- New env var `STRIPE_ENABLED=true|false` in `src/services/escrow.service.ts` (replaces NODE_ENV check) — allows test Stripe calls in development
- Document test cards: `4242424242424242` (success), `4000000000000002` (decline), `4000000000003220` (3DS)

**I.2 — End-to-End Flow Testing (5 paths)**
- **Path 1 (sell-first happy):** buyer adds card → buy order → seller onboards Connect → sell order → match → charge → ship → verify → payout. Verify PaymentIntent + Transfer in Stripe dashboard.
- **Path 2 (vault-first happy):** seller vaults → admin verifies → list → buyer buys → charge → instant release → transfer
- **Path 3 (payment failure):** declined card → escrow PAYMENT_FAILED → retry enqueued → 24hr auto-cancel → sell order reopened
- **Path 4 (refund):** sell-first match → charged → admin rejects → refund → verify in Stripe
- **Path 5 (incomplete onboarding):** seller starts Connect but doesn't finish → sell order blocked with prompt
- Document results as test log with Stripe dashboard screenshots

**I.3 — Payment Status Dashboard**
- New page `src/app/(marketplace)/payments/page.tsx` with 3 sections:
  - **Payment Methods:** list cards (brand, last4, expiry), set default, remove, add via SetupIntent
  - **Transaction History:** table (date, type, card name, amount, status badge, Stripe ref), click-to-expand details. Source: Trades where user is buyer or seller
  - **Seller Payout Status** (if Connect account): onboarding status, total earned, pending payouts, "Complete Onboarding" CTA, link to Express dashboard
- Accessible from navbar user menu → "Payments"

**I.4 — Payment Error UX**
- Buyer charge failure: in-app + email notification with link to payments page
- Payments page: retry banner with 24hr countdown, "Retry Now" button, "Update Card & Retry" flow
- After 24hr auto-cancel: clear notification
- Seller onboarding: block sell orders without onboarding → "Set Up Seller Account" CTA → Connect link → redirect back after complete

**I.5 — Webhook Reliability**
- Enhance `src/app/api/webhooks/stripe/route.ts`:
  - Idempotency: track processed event IDs in Redis SET with 48hr TTL
  - Structured logging per event
  - Return 500 on failure for Stripe retry
  - New events: `charge.refunded` (update escrow + notify), `account.updated` (detect onboarding completion + notify), `payment_method.detached` (sync deletion)
  - Log processing time, alert if >10s

### Verification
- [ ] Test card charges succeed + show in Stripe dashboard
- [ ] Connect onboarding works in test mode
- [ ] All 5 paths verified end-to-end
- [ ] Payments page: transaction history, payment methods, payout status
- [ ] Failed charge: error shown, retry works, 24hr auto-cancel works
- [ ] Refund visible in Stripe dashboard
- [ ] Webhook idempotency: duplicate events ignored

---

## Phase J: Admin Dashboard (~1 week)

**Dependencies:** Phase D (admin pages), Phase I (Stripe data)

### Features Built

**J.1 — Admin Tab in Navbar**
- `src/components/layout/Navbar.tsx`: if `user.role === "ADMIN"` → render "Admin" link with Lucide `Shield` icon, after "Portfolio", before user menu
- Mobile: in hamburger menu with same logic
- Client-side role from JWT payload (already includes `role`)

**J.2 — Dashboard Landing Page**
- New page `src/app/(admin)/admin/page.tsx` with metric cards grid:
  - Pending Verifications (count + unclaimed count) — `CardInstance` status PENDING_VERIFICATION
  - Active Trades in Escrow (count + $ total) — `Trade` escrowStatus CAPTURED
  - Open Orders (count, buy/sell split) — `Order` status OPEN or PARTIALLY_FILLED
  - Active Users 7d (count) — users with recent activity
  - Pending Shipments (count, in/out split) — `Shipment` active statuses
  - Open Disputes (count) — `Dispute` status OPEN
- New route `GET /api/admin/dashboard/metrics`: `withAdmin()`, batch queries, Redis cache 60s

**J.3 — Quick Actions**
- Action cards below metrics linking to:
  - "Verify Next Card" → `/admin/verification` (unclaimed filter)
  - "Review Shipments" → `/admin/shipments`
  - "Resolve Disputes" → `/admin/disputes`
  - "Manage Trades" → `/admin/trades` (new)
- Each shows relevant count

**J.4 — Admin Trade Management**
- New page `src/app/(admin)/admin/trades/page.tsx`
- Table: trade ID, buyer @username, seller @username, card, price, escrow status, date, actions
- Filters: escrow status dropdown, date range
- Actions: CAPTURED → Release Escrow / Refund Buyer; PAYMENT_FAILED → Retry / Cancel; RELEASED/REFUNDED → view-only
- New route `GET /api/admin/trades` (with filters); existing routes for release/refund

**J.5 — Activity Feed**
- Bottom of dashboard: last 20 platform events (trades, verifications, disputes, shipments) chronological
- New route `GET /api/admin/dashboard/activity`: unified feed, paginated (20 default)

### Verification
- [ ] Admin sees "Admin" tab; regular users do not
- [ ] Metrics correct and cached (60s)
- [ ] Quick actions link to correct pages
- [ ] Trade management: release/refund actions work
- [ ] Activity feed shows recent events
- [ ] Dashboard loads <2s

---

## Phase K: Frontend Polish (~1.5–2 weeks)

**Dependencies:** Phase G (usernames), Phase H (PSA images)

### Features Built

**K.1 — Trades Tab Redesign**
- Redesign `src/app/(marketplace)/orders/page.tsx` with 3 tabs:

**Tab 1 — Open Orders (DEFAULT, `/orders?tab=open`):**
- Orders with status OPEN or PARTIALLY_FILLED
- Card layout: PSA thumbnail, card name, BUY/SELL badge (green/red), LIMIT/MARKET badge, price, filled/total qty, relative date, **Cancel Order** button with confirmation
- Sort: newest first, by price, by card name
- Empty: "No open orders. Browse the marketplace."

**Tab 2 — Trade History (`/orders?tab=history`):**
- Completed trades
- Card layout: PSA thumbnail, card name, BOUGHT/SOLD badge, price + qty, counterparty @username, date
- Escrow progress bar: PENDING → CAPTURED → RELEASED (or REFUNDED branch)
- Click-to-expand: full details, Stripe ref, fee breakdown

**Tab 3 — Pending Shipments (`/orders?tab=shipments`):**
- Trades needing shipping or in transit
- Card layout: PSA thumbnail, card name, INBOUND/OUTBOUND badge, status (AWAITING → SHIPPED → IN_TRANSIT → DELIVERED → VERIFIED)
- Seller: deadline countdown "Ship by [date] — X days", **Ship Now** CTA (warehouse address, tracking input, Mark as Shipped)
- Tracking link if number provided

Design: card-based (not tables), consistent colors (green=success/buy, red=sell/cancel, yellow=pending, blue=progress), responsive mobile stacking, WebSocket real-time updates

**K.2 — Browse Page Multi-Select Searchable Filters**
- New component `src/components/ui/SearchableMultiSelect.tsx`:
  - Click opens dropdown with text input at top
  - Real-time filtering as user types (case-insensitive substring)
  - Checkboxes for multi-select
  - Selected items as removable chips/tags
  - "Clear All" button, click-outside/Escape to close
  - Count display: "3 of 48 selected"

- Apply to `src/app/(marketplace)/cards/page.tsx` filters:
  - Game (from TcgGame, searchable by name)
  - Set (from CardSet filtered by game, searchable by name/code)
  - Character (distinct Card.character values)
  - Rarity (distinct Card.rarity values)
  - Supertype (distinct Card.supertype values)

- Cascading: game selection filters sets, set selection filters characters/rarities
- API changes `GET /api/cards`: accept comma-separated values `?setId=a,b,c` → `WHERE setId IN (...)`
- URL state: all filters in query params (shareable), restore on load via `useSearchParams`
- UX: filter count badges, "Reset All Filters" button, active filter summary above results, results count

**K.3 — UX Consistency Pass**
- Consistent loading skeletons, empty states with CTAs, error states with retry
- Page titles and breadcrumbs
- Mobile responsiveness audit for orders and browse

### Verification
- [ ] Trades defaults to Open Orders tab
- [ ] Tab switching works, URL updates
- [ ] Cancel works on open orders
- [ ] Trade history shows escrow progress bar
- [ ] Shipments show deadline countdown + Ship Now CTA
- [ ] Filters are multi-select searchable
- [ ] Multiple values per filter work
- [ ] Cascading: game filters sets
- [ ] Filters in URL (shareable)
- [ ] Reset All clears everything
- [ ] Mobile responsive

---

## Phase L: Backend Hardening & API-First (~2–2.5 weeks)

**Dependencies:** Phases G–K complete

### Features Built

**L.1 — API-First Audit**
- Verify every user action has a REST route (full audit table of 30+ endpoints)
- Ensure no server-component-only logic that React Native can't reach
- Standardize response shape: `{ data?, error?, message? }`
- Standardize errors: 400/401/403/404/409/429
- Standardize pagination: `{ data, pagination: { page, limit, total, totalPages } }`

**L.2 — OpenAPI Documentation**
- Generate OpenAPI 3.1 spec using `zod-openapi`
- Define request/response schemas with zod for every route
- Serve Swagger UI at `/api/docs`
- Output `openapi.yaml` in repo root for future mobile client auto-generation
- Document: method, path, auth requirements, schemas, error cases

**L.3 — Wiring Gap Audit**
- WebSocket: verify all publish calls fire (matching, order, notification services), test reconnection, JWT auth on connection
- BullMQ: verify all 5 workers process end-to-end, add dead letter queue (DLQ after 3 retries), job completion logging
- Email: verify all critical triggers, test Resend delivery, add delivery logging
- Data: database constraints (unique cert per grading company), missing indexes (admin dashboard queries), foreign key cascade audit

**L.4 — Error Handling & Resilience**
- Global API error handler with consistent 500 response + stack trace logging
- Stripe error → user-friendly message mapping
- PSA API error → graceful fallback
- DB connection pool exhaustion handling
- Redis degradation: disable dependent features vs crash
- New route `GET /api/health`: returns `{ status, database, redis, version }` for readiness/liveness probes

### Verification
- [ ] All actions have documented REST routes
- [ ] Consistent response shapes
- [ ] OpenAPI spec + Swagger UI accessible
- [ ] WebSocket channels fire correctly
- [ ] Workers process with retry + DLQ
- [ ] Health check correct
- [ ] Error handling consistent

---

## Phase M: Deployment & Go-Live (~1.5–2 weeks)

**Dependencies:** Phase L

### Features Built

**M.1 — Infrastructure (Railway recommended)**
- Web service: Next.js (`npm run build && npm start`, port 3000)
- Worker service: BullMQ (`npm run worker`, no port)
- PostgreSQL + Redis: Railway plugins (auto-provisioned)
- WebSocket: separate service or integrated
- Alternatives documented: Vercel+Neon+Upstash, AWS ECS, Fly.io

**M.2 — Environment Configuration**
- Production env vars: DATABASE_URL, REDIS_URL (Railway auto), JWT secrets (64-byte random), Stripe live/test keys, PSA creds, Resend key, PLATFORM_FEE_RATE=0 (soft launch)
- Separate environments: staging (Stripe test keys) + production (live keys)
- Secrets in Railway env vars (encrypted at rest), never in git

**M.3 — Domain & DNS**
- Register domain, configure A/CNAME → Railway, MX for email, www redirect
- SSL: Railway auto (Let's Encrypt) or Cloudflare
- Resend verified domain: SPF, DKIM, DMARC records
- Stripe webhook: register production URL for `/api/webhooks/stripe`

**M.4 — CI/CD Pipeline**
- `.github/workflows/deploy.yml`:
  - Push to main: `npm ci` → lint → typecheck → prisma generate → build → deploy
  - PR: same checks + preview environment + PR comment with URL
- Branch strategy: main→prod, staging→staging, features→previews

**M.5 — Database in Production**
- `npx prisma migrate deploy` (not `migrate dev`)
- Railway build: `npx prisma migrate deploy && npm run build`
- Initial: full Pokemon catalog sync + admin accounts
- Daily backups via Railway

**M.6 — Monitoring**
- Sentry (`@sentry/nextjs` free tier): errors, API failures, webhook failures
- UptimeRobot/BetterStack: `GET /api/health` every 5min, alert on down
- Structured JSON logging for routes + workers
- Railway metrics: CPU, memory, response times

### Verification
- [ ] App at custom domain with SSL
- [ ] Env vars set, DB migrated, catalog synced
- [ ] Workers running
- [ ] WebSocket over WSS
- [ ] Stripe webhooks receiving
- [ ] Email from custom domain (SPF/DKIM valid)
- [ ] CI/CD: push → lint → build → deploy
- [ ] Preview envs for PRs
- [ ] Sentry captures errors
- [ ] Health check monitored
- [ ] Full loop tested in staging

---

## Build Order

```
Phases A-F (existing MVP)
    |
    +-- G (Usernames) + H (PSA) -- in parallel
    |
    +-- I (Stripe) + J (Admin) -- in parallel
    |
    +-- K (Frontend Polish) -- after G + H
    |
    +-- L (Backend Hardening) -- after all features
    |
    +-- M (Deploy & Go-Live) -- final
```

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | REST + OpenAPI over GraphQL | Routes already REST, auto-generates mobile client |
| 2 | Railway hosting | All services in one platform, simplest path |
| 3 | React Native for future mobile | Shares TypeScript, reuses OpenAPI client |
| 4 | PSA API over scraping | Structured, reliable, rate-limit-aware |
| 5 | 30-day username cooldown | Fixes mistakes without breaking identity |
| 6 | Multi-select searchable filters | 10k+ cards need fast narrowing |
| 7 | 3-tab trades page | Different needs: manage orders, review history, track shipments |
| 8 | Sentry | Free tier, best Next.js support |
| 9 | Staging + test keys | Never test payments against live Stripe |
| 10 | OpenAPI in repo | Single source of truth, enables auto-gen clients |
