import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue";
import { matchOrder } from "@/services/matching.service";

interface OrderMatchingJobData {
  orderId: string;
  orderBookId: string;
  cardId: string;
}

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

const worker = new Worker(
  QUEUE_NAMES.ORDER_MATCHING,
  async (job: Job<OrderMatchingJobData>) => {
    console.log(
      `[order-matching] Processing job ${job.id}: order=${job.data.orderId} card=${job.data.cardId}`,
    );
    const result = await matchOrder(job.data.orderId);
    console.log(
      `[order-matching] Completed: ${result.tradesCreated} trades, ${result.ordersUpdated} orders updated`,
    );
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

worker.on("failed", (job, err) => {
  console.error(`[order-matching] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[order-matching] Job ${job.id} completed successfully`);
});

console.log("[order-matching] Worker started, waiting for jobs...");
