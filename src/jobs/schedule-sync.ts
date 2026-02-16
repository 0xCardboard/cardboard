import { cardSyncQueue } from "./queue";

export async function scheduleRecurringSync() {
  // Daily full sync at 3am UTC
  await cardSyncQueue.upsertJobScheduler(
    "daily-full-sync",
    { pattern: "0 3 * * *" },
    {
      name: "sync",
      data: { type: "FULL_SYNC" },
    }
  );

  // Hourly price sync
  await cardSyncQueue.upsertJobScheduler(
    "hourly-price-sync",
    { pattern: "0 * * * *" },
    {
      name: "sync",
      data: { type: "PRICE_SYNC" },
    }
  );

  console.log("[schedule] Recurring sync jobs configured");
}
