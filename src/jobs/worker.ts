/**
 * Unified worker process — starts all BullMQ workers and scheduled jobs.
 *
 * Run as a separate process alongside the Next.js web server:
 *   npm run worker
 */
import "dotenv/config";

// Import workers — each creates a Worker instance at module scope
import "./card-sync.worker";
import "./order-matching.worker";
import "./payment-processing.worker";
import "./ship-deadline.worker";
import "./wash-trade.worker";

// Import and start recurring sync schedules
import { scheduleRecurringSync } from "./schedule-sync";

const WORKERS = [
  "card-sync",
  "order-matching",
  "payment-processing",
  "ship-deadline",
  "wash-trade",
];

async function start() {
  console.log(`[worker] Starting unified worker process (${WORKERS.length} workers)...`);
  console.log(`[worker] Workers: ${WORKERS.join(", ")}`);

  await scheduleRecurringSync();
  console.log("[worker] Recurring sync jobs scheduled");
  console.log("[worker] All workers running. Press Ctrl+C to stop.");
}

function shutdown(signal: string) {
  console.log(`\n[worker] Received ${signal}, shutting down gracefully...`);
  // BullMQ workers handle their own cleanup on process exit
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});
