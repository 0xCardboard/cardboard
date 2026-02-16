# Architectural Patterns

Conventions and design decisions used across the Cardboard codebase.

## Singleton Services via `globalThis`

External service clients (Prisma, Redis) use a `globalThis` caching pattern to prevent multiple instances during Next.js hot module reload in development.

- Prisma client: `src/lib/db.ts:4-16` — checks `globalForPrisma.prisma` before creating a new client, caches on `globalThis` in non-production
- Redis client: `src/lib/redis.ts:3-13` — identical pattern with `globalForRedis.redis`

All service singletons are exported from `src/lib/` and imported directly where needed. There is no DI container or service layer — route handlers call Prisma directly.

## NextAuth JWT Authentication

Authentication uses NextAuth v4 with a credentials provider and JWT session strategy (`src/lib/auth.ts`).

- **Authorize flow**: Email/password validated with `bcrypt.compare()` (`src/lib/auth.ts:27-30`)
- **JWT enrichment**: `id` and `role` added to token in the `jwt` callback (`src/lib/auth.ts:49-54`)
- **Session enrichment**: Token fields mapped back to `session.user` in the `session` callback (`src/lib/auth.ts:57-61`)
- **Type augmentation**: Session and JWT types extended via `declare module` in `src/types/next-auth.d.ts:4-19`

Client components access session via `useSession()` hook (e.g., `src/components/layout/Navbar.tsx:8`). There is currently no server-side auth middleware for protecting routes.

## Server Components by Default

Pages are server components unless they need interactivity. Only files with explicit `"use client"` directives run on the client:

- **Client components**: Login/Register forms (`src/app/(auth)/login/page.tsx:1`), Navbar (`src/components/layout/Navbar.tsx:1`), SessionProvider (`src/components/providers/SessionProvider.tsx:1`)
- **Server components**: All marketplace, lending, admin, and profile pages (no `"use client"` directive)
- **Dynamic route params**: Received as `Promise` and awaited — Next.js 15+ async params pattern (e.g., `src/app/(marketplace)/cards/[cardId]/page.tsx:1-2`)

## Route Group Organization

Next.js route groups partition features without affecting URL paths:

| Group | Purpose | Routes |
|-------|---------|--------|
| `(auth)` | Authentication | `/login`, `/register` |
| `(marketplace)` | Trading | `/cards`, `/cards/[cardId]`, `/orders`, `/portfolio` |
| `(lending)` | P2P lending | `/loans`, `/lend`, `/borrow` |
| `(admin)` | Administration | `/shipments`, `/verification` |

Each group can have its own `layout.tsx`. The admin layout includes a visual indicator to distinguish admin pages (`src/app/(admin)/layout.tsx:1-10`).

## API Route Pattern

API routes export named HTTP method handlers from `route.ts` files. The consistent structure:

1. Parse request body with `await request.json()`
2. Validate inputs inline with early-return error responses
3. Perform database operations via Prisma
4. Return `NextResponse.json()` with appropriate status codes
5. Wrap in try-catch with generic 500 fallback

Reference implementation: `src/app/api/auth/register/route.ts:8-59`

Response format: `NextResponse.json({ error: string }, { status: number })` for errors, `NextResponse.json({ user: ... }, { status: 201 })` for success.

## UI Component System (shadcn/ui + Radix + CVA)

All reusable UI primitives live in `src/components/ui/` and follow a consistent pattern:

- **Radix UI primitives** for accessibility (keyboard nav, ARIA attributes)
- **class-variance-authority (CVA)** for variant/size definitions (`src/components/ui/button.tsx:7-35`)
- **`React.forwardRef`** on every component for ref forwarding
- **`cn()` utility** (`src/lib/utils.ts`) merges Tailwind classes via `clsx` + `tailwind-merge`
- **Composition pattern**: Complex components split into sub-components (e.g., `Card` → `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`)
- **`asChild` polymorphic prop** via Radix Slot for rendering as different elements (`src/components/ui/button.tsx:40`)

## Type Organization

Types are organized by domain in `src/types/`:

| File | Domain | Pattern |
|------|--------|---------|
| `card.ts` | Card sync | `interface` for adapter contracts (`CardSyncAdapter`, `ExternalCardSet`, `ExternalCard`) |
| `order.ts` | Trading | `interface` for order book snapshots (`OrderBookEntry`, `OrderBookSnapshot`) |
| `lending.ts` | Loans | `interface` for loan terms/summaries |
| `user.ts` | Users | `type` for unions (`ReputationBadge`), colocated utility functions |
| `next-auth.d.ts` | Auth | Module augmentation for NextAuth types |

Convention: `interface` for object shapes, `type` for unions. Utility functions can be colocated with their types (e.g., `getReputationBadge()` in `src/types/user.ts:3-9`).

## BullMQ Job Queues

Background processing uses BullMQ with Redis as the broker (`src/jobs/queue.ts`).

Three named queues:
- `card-sync` — syncs card data from external APIs (PSA, Pokemon TCG)
- `order-matching` — matches buy/sell orders on the exchange
- `loan-monitor` — monitors loan terms and triggers collections

Queue creation uses a shared `getRedisConnection()` helper that parses `REDIS_URL` into connection options (`src/jobs/queue.ts:9-16`).

## Client-Side Error Handling

Form pages follow a consistent error UX pattern:

1. State: `const [error, setError] = useState("")` alongside `loading` state
2. Try-catch around fetch/signIn calls
3. Check `res.ok` or `result?.error` for failure conditions
4. Display: Conditional `{error && <div className="...bg-destructive/10...">}` block

Examples: `src/app/(auth)/login/page.tsx:18-38`, `src/app/(auth)/register/page.tsx:19-55`

## Prisma Schema Conventions

The database schema (`prisma/schema.prisma`) uses:

- **19 models** organized by domain (Users, Cards, Trading, Lending, Logistics)
- **10 enums** for constrained values (e.g., `UserRole`, `GradingCompany`, `OrderSide`, `EscrowStatus`)
- **`@default(uuid())` or `@default(cuid())`** for primary keys
- **Referential integrity** via `@relation` with explicit foreign keys
- **`@updatedAt`** timestamps on mutable models
