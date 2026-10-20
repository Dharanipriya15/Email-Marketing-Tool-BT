// Background sending worker for a VPS or local machine.
// Loops the same dispatcher as /api/cron/dispatch: starts due scheduled
// campaigns and sends SENDING campaigns at EMAIL_SEND_RATE_PER_SEC.
// Run: npm run worker   (Ctrl+C to stop; finishes the current email first)
import { isSendingEnabled } from "@/lib/email-sending-config";

const IDLE_MS = 15_000;
const DISABLED_MS = 60_000;
let stopping = false;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal} received, stopping after the current batch`);
    stopping = true;
  });
}

async function main() {
  const { dispatchDueCampaigns } = await import("@/services/campaign-send-service");
  const { prisma } = await import("@/db/client");
  console.log("[worker] started");
  while (!stopping) {
    if (!isSendingEnabled()) {
      console.log("[worker] EMAIL_SENDING_ENABLED is not true; idling");
      await sleep(DISABLED_MS);
      continue;
    }
    try {
      const summary = await dispatchDueCampaigns(new Date(), { timeBudgetMs: 50_000 });
      const sent = summary.processed.reduce((total, p) => total + p.result.sent, 0);
      const busy = summary.processed.some((p) => p.result.remaining > 0);
      if (summary.processed.length || summary.started.length || summary.flaggedStuck) {
        console.log(
          `[worker] ${new Date().toISOString()} started=${summary.started.length} batches=${summary.processed.length} sent=${sent} flaggedStuck=${summary.flaggedStuck}`
        );
      }
      if (!busy) await sleep(IDLE_MS);
    } catch (error) {
      console.error("[worker] dispatch failed:", error instanceof Error ? error.message.split("\n").pop() : "unknown error");
      await sleep(IDLE_MS);
    }
  }
  await prisma.$disconnect();
  console.log("[worker] stopped");
}

main().catch((error) => {
  console.error("[worker] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
