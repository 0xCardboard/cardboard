# Cardboard

P2P marketplace for trading graded trading cards (Pokemon, One Piece, etc.). Features exchange-style order books, Stripe Connect escrow, and a Phase 2 lending system for collateralized loans using cards.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19, TypeScript 5 (strict mode)
- **Database**: PostgreSQL 16 via Prisma 7 ORM (with PrismaPg adapter)
- **Cache/Queues**: Redis 7 (ioredis) + BullMQ for background jobs
- **Auth**: NextAuth v4 (credentials provider, JWT sessions)
- **Payments**: Stripe Connect (escrow for trades)
- **UI**: Tailwind CSS 4, shadcn/ui (Radix + CVA), Lucide icons
- **Path alias**: `@/*` → `./src/*`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, register
│   ├── (marketplace)/      # Cards, orders, portfolio
│   ├── (lending)/          # Loans, lend, borrow (Phase 2)
│   ├── (admin)/            # Shipments, verification
│   ├── api/                # API routes (auth, register)
│   └── profile/            # User profiles
├── components/
│   ├── ui/                 # shadcn/ui primitives (Button, Card, Table, etc.)
│   ├── layout/             # Navbar, Footer
│   └── providers/          # SessionProvider (NextAuth)
├── lib/                    # Singletons & utilities
│   ├── db.ts               # Prisma client singleton
│   ├── redis.ts            # Redis client singleton
│   ├── auth.ts             # NextAuth configuration
│   └── utils.ts            # cn() helper for Tailwind class merging
├── types/                  # Domain types (card, order, lending, user)
└── jobs/                   # BullMQ queue definitions (card-sync, order-matching, loan-monitor)
prisma/
└── schema.prisma           # 19 models, 10 enums
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build (`prisma generate && next build`) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check only) |
| `npm run dev:services` | Start PostgreSQL + Redis via Docker Compose |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Prisma Studio GUI |

**Setup**: `npm install` → `npm run dev:services` → `npm run db:migrate` → `npm run dev`

## Key Domain Concepts

- **TcgGame / CardSet / Card**: Catalog hierarchy synced from external APIs (PSA, Pokemon TCG)
- **CardInstance**: A graded physical card (IOU) with grading company + grade
- **OrderBook / Order / Trade**: Exchange-style trading with limit/market orders and escrow
- **Loan / LoanOffer**: Phase 2 collateralized lending using card instances
- **Shipment**: Inbound/outbound tracking for physical card movement

## Database

Schema at `prisma/schema.prisma`. Key enums: `UserRole`, `GradingCompany` (PSA/BGS/CGC), `OrderSide`, `OrderType`, `OrderStatus`, `EscrowStatus`, `ShipmentStatus`, `LoanStatus`.

After schema changes: `npm run db:migrate` to generate and apply a migration.

## Environment Variables

See `.env.example` for required variables: `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Stripe keys, PSA API credentials, Pokemon TCG API key.

## Additional Documentation

Check these files for detailed guidance on specific topics:

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — singleton services, auth flow, server/client component split, API route conventions, UI component system, type organization, job queues
