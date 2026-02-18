import type { User, Reputation } from "@/generated/prisma/client";

let counter = 0;

export function createMockUser(overrides: Partial<User> = {}): User {
  counter++;
  return {
    id: `user-${counter}`,
    email: `user${counter}@test.com`,
    passwordHash: "$2a$12$mockhashmockhashmockhashmockhashmockhashmockhash",
    name: `Test User ${counter}`,
    avatarUrl: null,
    stripeAccountId: null,
    stripeCustomerId: null,
    role: "USER" as const,
    passwordResetToken: null,
    passwordResetExpires: null,
    emailVerified: false,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function createMockAdmin(overrides: Partial<User> = {}): User {
  return createMockUser({ role: "ADMIN" as const, ...overrides });
}

export function createMockReputation(overrides: Partial<Reputation> = {}): Reputation {
  counter++;
  return {
    id: `rep-${counter}`,
    userId: `user-${counter}`,
    score: 0,
    totalTrades: 0,
    successfulTrades: 0,
    avgShipTimeDays: 0,
    disputeCount: 0,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}
