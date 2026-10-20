// SES mailbox-simulator load test (100 recipients). Run: node --env-file=.env --import tsx scripts/ses-load-test.ts
process.env.EMAIL_SEND_RATE_PER_SEC = "1"; // SES sandbox: 1 msg/sec (app default is 5)
async function main() {
  const { prisma } = await import("@/db/client");
  const { createCampaign } = await import("@/services/campaign-service");
  const send = await import("@/services/campaign-send-service");
  const org = await prisma.organization.findFirst({ where: { id: "boiltech-org" } });
  if (!org) throw new Error("org not found");
  console.log("org", org.id, org.name);
  let list = await prisma.contactList.findFirst({ where: { organizationId: org.id, name: "SES Load Test" } });
  if (!list) list = await prisma.contactList.create({ data: { organizationId: org.id, name: "SES Load Test", description: "SES mailbox simulator load test" } });
  for (let i = 1; i <= 100; i++) {
    const email = `success+${i}@simulator.amazonses.com`;
    const c = await prisma.contact.upsert({ where: { organizationId_email: { organizationId: org.id, email } }, update: {}, create: { organizationId: org.id, email, firstName: "Sim", lastName: String(i) } });
    await prisma.contactListMember.upsert({ where: { contactListId_contactId: { contactListId: list.id, contactId: c.id } }, update: {}, create: { contactListId: list.id, contactId: c.id } });
  }
  const members = await prisma.contactListMember.findMany({ where: { contactListId: list.id }, include: { contact: true } });
  if (members.length !== 100 || members.some((m) => !m.contact.email.endsWith("@simulator.amazonses.com"))) throw new Error("list not clean: " + members.length);
  console.log("list", list.id, "members", members.length);
  const tpl = await prisma.emailTemplate.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } });
  if (!tpl) throw new Error("no template");
  console.log("template", tpl.id, tpl.name);
  const camp = await createCampaign(org.id, null, { name: "SES Load Test " + new Date().toISOString(), subject: "SES load test", contactListId: list.id, templateId: tpl.id });
  console.log("campaign", camp.id);
  const t0 = Date.now();
  console.log("prepared", await send.prepareCampaign(org.id, camp.id));
  for (let n = 1; n <= 10; n++) {
    const r = await send.processCampaignBatch(camp.id, { batchSize: 50, maxPerRun: 50 });
    console.log("batch", n, JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(1) + "s");
    if (r.completed || r.remaining === 0) break;
  }
  console.log("elapsedSec", ((Date.now() - t0) / 1000).toFixed(1));
  const g = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: camp.id }, _count: true });
  console.log("statusCounts", JSON.stringify(g));
  const errs = await prisma.campaignRecipient.findMany({ where: { campaignId: camp.id, lastError: { not: null } }, select: { email: true, lastError: true }, take: 5 });
  console.log("errors", JSON.stringify(errs));
  console.log("campaignRow", JSON.stringify(await prisma.campaign.findUnique({ where: { id: camp.id }, select: { status: true, totalRecipients: true, totalSent: true, totalFailed: true } })));
  const { SESv2Client, GetAccountCommand } = await import("@aws-sdk/client-sesv2");
  const ses = new SESv2Client({ region: process.env.AWS_SES_REGION, credentials: { accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY! } });
  const acct = await ses.send(new GetAccountCommand({}));
  console.log("sendQuota", JSON.stringify(acct.SendQuota), "productionAccess", acct.ProductionAccessEnabled);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FAILED", e?.name, e?.message); process.exit(1); });

export {};
