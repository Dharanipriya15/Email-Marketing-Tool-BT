// One-off: permanently stop the "SES Load Test 2026-10-20T07:36:33Z" campaign (boiltech-org).
// CampaignStatus has no CANCELLED, so the campaign goes to FAILED (never picked up by
// prepare [DRAFT/SCHEDULED], dispatch [SCHEDULED/SENDING] or resume [PAUSED]).
// PENDING/QUEUED recipients -> SUPPRESSED with a note (worker only claims PENDING).
// Run: npx tsx --env-file=.env scripts/cancel-load-test.ts [--apply]   (dry run without --apply)
import { prisma } from "@/db/client";
import { withDbRetry } from "@/lib/db-retry";

const ORG_ID = "boiltech-org";
// Stored name includes milliseconds; pinned by id as well.
const NAME = "SES Load Test 2026-10-20T07:36:33.418Z";
const CAMPAIGN_ID = "cmvgddoet00b5zwmw7nvce0pi";
const APPLY = process.argv.includes("--apply");
const NOTE = "Cancelled by admin: load test stopped manually";

async function counts(campaignId: string) {
  const g = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  return Object.fromEntries(g.map((x) => [x.status, x._count._all]));
}

async function main() {
  const matches = await withDbRetry(() =>
    prisma.campaign.findMany({ where: { id: CAMPAIGN_ID, organizationId: ORG_ID, name: NAME }, select: { id: true, status: true, name: true } })
  );
  if (matches.length !== 1) throw new Error(`Expected exactly 1 campaign, found ${matches.length}. Aborting.`);
  const c = matches[0];
  console.log("campaign", c.id, "status before:", c.status);
  console.log("recipients before:", await withDbRetry(() => counts(c.id)));
  if (!APPLY) { console.log("dry run; pass --apply to change"); return; }

  const res = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const camp = await tx.campaign.updateMany({
        where: { id: c.id, organizationId: ORG_ID, name: NAME, status: { in: ["SENDING", "PAUSED", "SCHEDULED", "DRAFT"] } },
        data: { status: "FAILED" },
      });
      if (camp.count !== 1) throw new Error("Campaign status changed concurrently; aborting (rolled back).");
      const recips = await tx.campaignRecipient.updateMany({
        where: { campaignId: c.id, organizationId: ORG_ID, status: { in: ["PENDING", "QUEUED"] } },
        data: { status: "SUPPRESSED", lastError: NOTE },
      });
      return { campaignUpdated: camp.count, recipientsUpdated: recips.count };
    })
  );
  console.log("updated:", res);
  const after = await withDbRetry(() => prisma.campaign.findUnique({ where: { id: c.id }, select: { status: true } }));
  console.log("status after:", after?.status);
  console.log("recipients after:", await withDbRetry(() => counts(c.id)));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());