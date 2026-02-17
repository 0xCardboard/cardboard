import { Queue } from "bullmq";

export const QUEUE_NAMES = {
  CARD_SYNC: "card-sync",
  ORDER_MATCHING: "order-matching",
  LOAN_MONITOR: "loan-monitor",
  PAYMENT_PROCESSING: "payment-processing",
  SHIP_DEADLINE: "ship-deadline",
  WASH_TRADE_DETECTION: "wash-trade-detection",
} as const;

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

export const cardSyncQueue = new Queue(QUEUE_NAMES.CARD_SYNC, {
  connection: getRedisConnection(),
});

export const orderMatchingQueue = new Queue(QUEUE_NAMES.ORDER_MATCHING, {
  connection: getRedisConnection(),
});

export const loanMonitorQueue = new Queue(QUEUE_NAMES.LOAN_MONITOR, {
  connection: getRedisConnection(),
});

export const paymentProcessingQueue = new Queue(QUEUE_NAMES.PAYMENT_PROCESSING, {
  connection: getRedisConnection(),
});

export const shipDeadlineQueue = new Queue(QUEUE_NAMES.SHIP_DEADLINE, {
  connection: getRedisConnection(),
});

export const washTradeDetectionQueue = new Queue(QUEUE_NAMES.WASH_TRADE_DETECTION, {
  connection: getRedisConnection(),
});
