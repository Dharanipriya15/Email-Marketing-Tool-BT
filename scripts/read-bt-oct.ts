// Read-only: BT_OCT status.
import { prisma } from "@/db/client";
async function main() {
  const cs = await prisma.campaign.findMany({ where: { organizationId: "boiltech-org", name: "BT_OCT" }, select: { id: true, status: true, scheduledAt: true, sentAt: true, totalRecipients: true, totalSent: true, contactListId: true, templateId: true } });
  for (const c of cs) {
    const g = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: { _all: true } });
    console.log(JSON.stringify({ ...c, recipients: Object.fromEntries(g.map((x) => [x.status, x._count._all])) }));
  }
  console.log("matches:", cs.length, "now:", new Date().toISOString());
}
main().finally(() => prisma.$disconnect());