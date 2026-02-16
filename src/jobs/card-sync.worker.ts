import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue";
import { runSync } from "@/services/card-sync.service";
import type { CardSyncJobData } from "@/types/card";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

const worker = new Worker(
  QUEUE_NAMES.CARD_SYNC,
  async (job: Job<CardSyncJobData>) => {
    console.log(`[card-sync] Processing job ${job.id}: ${job.data.type}`);
    const result = await runSync(job.data);
    console.log(
      `[card-sync] Completed: ${result.cardsUpserted} cards upserted, ` +
        `${result.setsProcessed} sets processed in ${result.durationMs}ms`
    );
    if (result.errors.length > 0) {
      console.warn(`[card-sync] ${result.errors.length} errors:`, result.errors);
    }
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 5000,
    },
  }
);

worker.on("failed", (job, err) => {
  console.error(`[card-sync] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[card-sync] Job ${job.id} completed successfully`);
});

console.log("[card-sync] Worker started, waiting for jobs...");
