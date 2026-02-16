import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { matchOrder } from "@/services/matching.service";

describe("matching.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const makeBuyOrder = (overrides = {}) => ({
    id: "buy-1",
    orderBookId: "ob-1",
    userId: "buyer-1",
    side: "BUY",
    type: "LIMIT",
    price: 5000,
    quantity: 1,
    filledQuantity: 0,
    status: "OPEN",
    gradingCompany: null,
    minGrade: null,
    orderBook: { id: "ob-1", cardId: "card-1" },
    ...overrides,
  });

  const makeSellOrder = (overrides = {}) => ({
    id: "sell-1",
    orderBookId: "ob-1",
    userId: "seller-1",
    side: "SELL",
    type: "LIMIT",
    price: 4900,
    quantity: 1,
    filledQuantity: 0,
    status: "OPEN",
    cardInstanceId: "inst-1",
    ...overrides,
  });

  it("matches a buy order against a lower ask", async () => {
    const buyOrder = makeBuyOrder();
    const sellOrder = makeSellOrder();

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(buyOrder);
    (prisma.order.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sellOrder)
      .mockResolvedValueOnce(null);

    // Mock transaction to execute the callback
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<void>) => {
        const txMock = {
          trade: { create: vi.fn().mockResolvedValue({ id: "trade-1" }) },
          order: { update: vi.fn().mockResolvedValue({}) },
          cardInstance: { update: vi.fn().mockResolvedValue({}) },
        };
        await fn(txMock as unknown as typeof prisma);
      },
    );

    const result = await matchOrder("buy-1");
    expect(result.tradesCreated).toBe(1);
    expect(result.ordersUpdated).toBe(2);
  });

  it("does not match when no opposite orders exist", async () => {
    const buyOrder = makeBuyOrder();

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(buyOrder);
    (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await matchOrder("buy-1");
    expect(result.tradesCreated).toBe(0);
    expect(result.ordersUpdated).toBe(0);
  });

  it("does not match when ask price exceeds bid price", async () => {
    const buyOrder = makeBuyOrder({ price: 4000 });

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(buyOrder);
    // findFirst returns null because no ask <= 4000
    (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await matchOrder("buy-1");
    expect(result.tradesCreated).toBe(0);
  });

  it("skips already filled orders", async () => {
    const filledOrder = makeBuyOrder({ status: "FILLED" });

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(filledOrder);

    const result = await matchOrder("buy-1");
    expect(result.tradesCreated).toBe(0);
  });

  it("skips cancelled orders", async () => {
    const cancelledOrder = makeBuyOrder({ status: "CANCELLED" });

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(cancelledOrder);

    const result = await matchOrder("buy-1");
    expect(result.tradesCreated).toBe(0);
  });

  it("returns 0 for missing order", async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await matchOrder("nonexistent");
    expect(result.tradesCreated).toBe(0);
  });

  it("handles partial fills across multiple matches", async () => {
    const buyOrder = makeBuyOrder({ quantity: 3, filledQuantity: 0 });
    const sellOrder1 = makeSellOrder({ id: "sell-1", quantity: 1, filledQuantity: 0 });
    const sellOrder2 = makeSellOrder({ id: "sell-2", quantity: 1, filledQuantity: 0 });

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(buyOrder);
    (prisma.order.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sellOrder1)
      .mockResolvedValueOnce(sellOrder2)
      .mockResolvedValueOnce(null); // no more matches for remaining qty

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<void>) => {
        const txMock = {
          trade: { create: vi.fn().mockResolvedValue({ id: "trade" }) },
          order: { update: vi.fn().mockResolvedValue({}) },
          cardInstance: { update: vi.fn().mockResolvedValue({}) },
        };
        await fn(txMock as unknown as typeof prisma);
      },
    );

    const result = await matchOrder("buy-1");
    expect(result.tradesCreated).toBe(2);
    expect(result.ordersUpdated).toBe(4); // 2 trades * 2 orders each
  });

  it("uses trade price from resting order (buy incoming)", async () => {
    const buyOrder = makeBuyOrder({ price: 5000 });
    const sellOrder = makeSellOrder({ price: 4500 }); // lower ask = better for buyer

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(buyOrder);
    (prisma.order.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sellOrder)
      .mockResolvedValueOnce(null);

    let tradePrice: number | null = null;
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<void>) => {
        const txMock = {
          trade: {
            create: vi.fn().mockImplementation((args: { data: { price: number } }) => {
              tradePrice = args.data.price;
              return Promise.resolve({ id: "trade-1" });
            }),
          },
          order: { update: vi.fn().mockResolvedValue({}) },
          cardInstance: { update: vi.fn().mockResolvedValue({}) },
        };
        await fn(txMock as unknown as typeof prisma);
      },
    );

    await matchOrder("buy-1");
    // Trade executes at the resting (sell) order's price
    expect(tradePrice).toBe(4500);
  });

  it("uses trade price from resting order (sell incoming)", async () => {
    // Scenario: resting buy at $15, incoming sell at $14.50
    // Trade should execute at $15 (the resting buy's price)
    const buyOrder = makeBuyOrder({ price: 1500 });
    const sellOrder = makeSellOrder({ id: "sell-1", price: 1450 });

    // Sell order is incoming
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(sellOrder);
    // findBestMatch returns the resting buy order
    (prisma.order.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(buyOrder)
      .mockResolvedValueOnce(null);

    let tradePrice: number | null = null;
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<void>) => {
        const txMock = {
          trade: {
            create: vi.fn().mockImplementation((args: { data: { price: number } }) => {
              tradePrice = args.data.price;
              return Promise.resolve({ id: "trade-1" });
            }),
          },
          order: { update: vi.fn().mockResolvedValue({}) },
          cardInstance: { update: vi.fn().mockResolvedValue({}) },
        };
        await fn(txMock as unknown as typeof prisma);
      },
    );

    await matchOrder("sell-1");
    // Trade executes at the resting (buy) order's price, NOT the incoming sell's price
    expect(tradePrice).toBe(1500);
  });
});
