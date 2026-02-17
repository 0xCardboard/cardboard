import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue";
import { checkForWashTrading } from "@/services/wash-trade-detector.service";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

interface WashTradeJobData {
  tradeId: string;
}

const worker = new Worker(
  QUEUE_NAMES.WASH_TRADE_DETECTION,
  async (job: Job<WashTradeJobData>) => {
    console.log(`[wash-trade] Checking trade ${job.data.tradeId}`);
    const result = await checkForWashTrading(job.data.tradeId);
    if (result.alertsCreated > 0) {
      console.log(
        `[wash-trade] Created ${result.alertsCreated} alert(s) for trade ${job.data.tradeId}`,
      );
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

worker.on("failed", (job, err) => {
  console.error(`[wash-trade] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[wash-trade] Job ${job.id} completed`);
});

console.log("[wash-trade] Worker started, waiting for jobs...");
