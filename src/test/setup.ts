import { vi } from "vitest";

// Set test environment variables
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-chars!!";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cardboard_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.PLATFORM_FEE_RATE = "0.03";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: createMockPrismaClient(),
}));

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: vi.fn(), retrieve: vi.fn() },
    setupIntents: { create: vi.fn() },
    paymentIntents: { create: vi.fn() },
    paymentMethods: { attach: vi.fn(), retrieve: vi.fn(), detach: vi.fn() },
    refunds: { create: vi.fn() },
    transfers: { create: vi.fn() },
    accounts: { create: vi.fn(), retrieve: vi.fn() },
    accountLinks: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
}));

// Mock BullMQ queues
vi.mock("@/jobs/queue", () => ({
  QUEUE_NAMES: {
    CARD_SYNC: "card-sync",
    ORDER_MATCHING: "order-matching",
    LOAN_MONITOR: "loan-monitor",
    PAYMENT_PROCESSING: "payment-processing",
    WASH_TRADE_DETECTION: "wash-trade-detection",
  },
  cardSyncQueue: { add: vi.fn().mockResolvedValue({}) },
  orderMatchingQueue: { add: vi.fn().mockResolvedValue({}) },
  loanMonitorQueue: { add: vi.fn().mockResolvedValue({}) },
  paymentProcessingQueue: { add: vi.fn().mockResolvedValue({}) },
  washTradeDetectionQueue: { add: vi.fn().mockResolvedValue({}) },
}));

function createMockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    groupBy: vi.fn(),
  };
}

function createMockPrismaClient() {
  const models: Record<string, ReturnType<typeof createMockModel>> = {};

  return new Proxy(
    { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(createMockPrismaClient())) },
    {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        // Cache model mocks so the same object is returned each time
        if (!models[prop]) {
          models[prop] = createMockModel();
        }
        return models[prop];
      },
    },
  );
}
