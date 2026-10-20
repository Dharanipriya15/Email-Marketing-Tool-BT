// Resume the SES load-test campaign through processCampaignBatch, retrying on transient DB errors.
process.env.EMAIL_SEND_RATE_PER_SEC = "1";
const CAMPAIGN = "cmvgdnjcj00b5zwq8x8rak7a1";
async function main() {
  const { prisma } = await import("@/db/client");
  const send = await import("@/services/campaign-send-service");
  const t0 = Date.now();
  for (let n = 1; n <= 60; n++) {
    try {
      const r = await send.processCampaignBatch(CAMPAIGN, { batchSize: 10, maxPerRun: 10 });
      console.log("batch", n, JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(1) + "s");
      if (r.completed || r.remaining === 0) break;
    } catch (err) {
      const e = err as Error;
      console.log("batch", n, "error", e?.name, String(e?.message).split("\n").pop());
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.log("resumeElapsedSec", ((Date.now() - t0) / 1000).toFixed(1));
  const g = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: CAMPAIGN }, _count: true });
  console.log("statusCounts", JSON.stringify(g));
  const errs = await prisma.campaignRecipient.findMany({ where: { campaignId: CAMPAIGN, lastError: { not: null } }, select: { email: true, status: true, lastError: true }, take: 5 });
  console.log("errors", JSON.stringify(errs));
  const stuck = await prisma.campaignRecipient.findMany({ where: { campaignId: CAMPAIGN, status: "SENDING" }, select: { email: true } });
  console.log("stuckSending", JSON.stringify(stuck));
  const c = await prisma.campaign.findUnique({ where: { id: CAMPAIGN }, select: { status: true, totalRecipients: true, totalSent: true, totalFailed: true, sentAt: true, completedAt: true } });
  console.log("campaignRow", JSON.stringify(c));
  const { SESv2Client, GetAccountCommand } = await import("@aws-sdk/client-sesv2");
  const ses = new SESv2Client({ region: process.env.AWS_SES_REGION, credentials: { accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY! } });
  const acct = await ses.send(new GetAccountCommand({}));
  console.log("sendQuota", JSON.stringify(acct.SendQuota), "productionAccess", acct.ProductionAccessEnabled);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FAILED", e?.name, e?.message); process.exit(1); });

export {};
