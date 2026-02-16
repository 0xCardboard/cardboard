# Cardboard

P2P marketplace for trading graded TCG cards (Pokemon, One Piece, and more).

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **PostgreSQL** + Prisma ORM
- **Redis** + BullMQ (queues)
- **Tailwind CSS** + shadcn/ui
- **Stripe Connect** (payments & escrow)

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Setup

```bash
# Install dependencies
npm install

# Start Postgres + Redis
npm run dev:services

# Run database migrations
npm run db:migrate

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run dev:services` | Start Postgres + Redis via Docker |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
