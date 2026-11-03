// READ-ONLY pilot-readiness report for boiltech-org. Never prints secrets or allowlist addresses.
import { prisma } from "@/db/client";
import { eligibleContactsWhere, getBlockedEmails } from "@/services/campaign-service";

const ORG = "boiltech-org";
const isSim = (e: string) => e.toLowerCase().endsWith("@simulator.amazonses.com");

async function main() {
  const blocked = await getBlockedEmails(ORG);
  const lists = await prisma.contactList.findMany({ where: { organizationId: ORG }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  console.log("== Contact lists ==");
  for (const l of lists) {
    const members = await prisma.contact.findMany({ where: { organizationId: ORG, listMemberships: { some: { contactListId: l.id } } }, select: { email: true, status: true } });
    const sendable = await prisma.contact.findMany({ where: eligibleContactsWhere(ORG, l.id, blocked), select: { email: true } });
    const byStatus: Record<string, number> = {};
    for (const m of members) byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    console.log(JSON.stringify({
      id: l.id, name: l.name, total: members.length, byStatus,
      sendable: sendable.length,
      sendableReal: sendable.filter((c) => !isSim(c.email)).length,
      simulatorTotal: members.filter((c) => isSim(c.email)).length,
      sendableSimulator: sendable.filter((c) => isSim(c.email)).length,
    }));
  }
  console.log("blocked emails (suppression+unsubscribe) in org:", blocked.length);
  console.log("== Templates ==");
  for (const t of await prisma.emailTemplate.findMany({ where: { organizationId: ORG }, select: { id: true, name: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }))
    console.log(JSON.stringify(t));
  console.log("== DRAFT campaigns ==");
  for (const c of await prisma.campaign.findMany({ where: { organizationId: ORG, status: "DRAFT" }, select: { id: true, name: true, contactListId: true, templateId: true, updatedAt: true } }))
    console.log(JSON.stringify(c));
  console.log("== Env (no secrets) ==");
  const e = process.env;
  const allow = (e.EMAIL_TEST_ALLOWLIST ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const app = e.APP_URL?.trim();
  console.log(JSON.stringify({
    EMAIL_SENDING_ENABLED: e.EMAIL_SENDING_ENABLED ?? "(unset)",
    EMAIL_MAX_CAMPAIGN_RECIPIENTS: e.EMAIL_MAX_CAMPAIGN_RECIPIENTS ?? "(unset; default 100)",
    EMAIL_SEND_RATE_PER_SEC: e.EMAIL_SEND_RATE_PER_SEC ?? "(unset; default 5)",
    EMAIL_BATCH_SIZE: e.EMAIL_BATCH_SIZE ?? "(unset; default 50)",
    EMAIL_TEST_ALLOWLIST_entries: allow.length,
    EMAIL_TEST_ALLOWLIST_domainEntries: allow.filter((x) => !x.includes("@") || x.startsWith("@")).length,
    EMAIL_PROVIDER: e.EMAIL_PROVIDER ?? "(unset)",
    AWS_SES_CONFIGURATION_SET_set: !!e.AWS_SES_CONFIGURATION_SET,
    AWS_SNS_TOPIC_ARN_set: !!e.AWS_SNS_TOPIC_ARN,
    APP_URL_set: !!app,
    APP_URL_isHttps: !!app && app.startsWith("https://"),
    APP_URL_isLocalhost: !app || /localhost|127\.0\.0\.1/.test(app),
  }));
}
main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; }).finally(() => prisma.$disconnect());