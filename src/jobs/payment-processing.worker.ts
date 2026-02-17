import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue";
import { retryFailedPayment } from "@/services/escrow.service";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

interface PaymentJobData {
  tradeId: string;
}

const worker = new Worker(
  QUEUE_NAMES.PAYMENT_PROCESSING,
  async (job: Job<PaymentJobData>) => {
    console.log(`[payment] Processing job ${job.id}: ${job.name} for trade ${job.data.tradeId}`);

    switch (job.name) {
      case "retry-failed-payment":
        await retryFailedPayment(job.data.tradeId);
        break;
      default:
        console.warn(`[payment] Unknown job name: ${job.name}`);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

worker.on("failed", (job, err) => {
  console.error(`[payment] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[payment] Job ${job.id} completed successfully`);
});

console.log("[payment] Worker started, waiting for jobs...");
