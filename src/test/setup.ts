import { vi } from "vitest";

// Set test environment variables
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-chars!!";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cardboard_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.PLATFORM_FEE_RATE = "0.03";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: createMockPrismaClient(),
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
