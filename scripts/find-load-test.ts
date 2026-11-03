import { prisma } from "@/db/client";
async function main() {
  const cs = await prisma.campaign.findMany({ where: { OR: [{ name: { contains: "Load Test", mode: "insensitive" } }, { status: { in: ["SENDING", "PAUSED"] } }] }, select: { id: true, organizationId: true, name: true, status: true, sentAt: true, totalRecipients: true } });
  for (const c of cs) {
    const g = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: { _all: true } });
    console.log(JSON.stringify({ ...c, nameJson: JSON.stringify(c.name), recipients: Object.fromEntries(g.map((x) => [x.status, x._count._all])) }));
  }
  console.log("matches:", cs.length);
}
main().finally(() => prisma.$disconnect());