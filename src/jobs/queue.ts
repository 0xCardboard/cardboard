import { Queue } from "bullmq";

export const QUEUE_NAMES = {
  CARD_SYNC: "card-sync",
  ORDER_MATCHING: "order-matching",
  LOAN_MONITOR: "loan-monitor",
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
