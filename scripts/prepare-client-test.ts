// One-off: prepares (does NOT send) the client test campaign. Idempotent.
import { prisma } from "@/db/client";
import { contactFormSchema } from "@/schemas/contact";
import { contactListFormSchema } from "@/schemas/contact-list";
import { campaignFormSchema } from "@/schemas/campaign";
import { createContact, addContactsToList } from "@/services/contact-service";
import { createContactList } from "@/services/contact-list-service";
import { createCampaign, getAudienceInfo, getBlockedEmails } from "@/services/campaign-service";
import { renderPersonalizedEmail, buildEmailFooterText } from "@/lib/email-render";
import { createUnsubscribeToken, buildUnsubscribePageUrl } from "@/lib/unsubscribe-token";

const ORG = "boiltech-org";
const EMAILS = ["pravin.raj@boilertechenergy.com", "Engineers@boilertechenergy.com", "boilertechenergyengineers@gmail.com", "Admin@boilertechenergy.com"];
const LIST_NAME = "Client Test - 24 Oct";
const CAMPAIGN_NAME = "BoilerTech Client Test - 24 Oct";
const SUBJECT = "BoilerTech Energy - Test Email";

async function main() {
  const blocked = new Set(await getBlockedEmails(ORG));
  const ids: string[] = [];
  for (const raw of EMAILS) {
    const input = contactFormSchema.parse({ email: raw, status: "ACTIVE" });
    const email = input.email.toLowerCase().trim();
    let c = await prisma.contact.findUnique({ where: { organizationId_email: { organizationId: ORG, email } }, select: { id: true, status: true } });
    if (c) console.log("REUSED contact", email, c.status);
    else { c = await createContact(ORG, input); console.log("CREATED contact", email); }
    console.log("  suppressed/unsubscribed:", blocked.has(email));
    ids.push(c.id);
  }
  let list = await prisma.contactList.findFirst({ where: { organizationId: ORG, name: LIST_NAME }, select: { id: true } });
  if (list) console.log("REUSED list", list.id);
  else { list = await createContactList(ORG, contactListFormSchema.parse({ name: LIST_NAME, description: "" })); console.log("CREATED list", list.id); }
  await addContactsToList(ORG, ids, list.id);

  const template = await prisma.emailTemplate.findFirst({ where: { organizationId: ORG, name: "Welcome Email" }, select: { id: true, previewText: true, htmlContent: true } });
  if (!template) throw new Error("Welcome Email template not found");
  const admin = await prisma.user.findFirst({ where: { organizationId: ORG, role: "ADMIN" }, select: { id: true } });
  let campaign = await prisma.campaign.findFirst({ where: { organizationId: ORG, name: CAMPAIGN_NAME }, select: { id: true, status: true } });
  if (campaign) console.log("REUSED campaign", campaign.id, campaign.status);
  else {
    const c = await createCampaign(ORG, admin?.id ?? null, campaignFormSchema.parse({ name: CAMPAIGN_NAME, subject: SUBJECT, contactListId: list.id, templateId: template.id }));
    campaign = { id: c.id, status: c.status };
    console.log("CREATED campaign", c.id, c.status);
  }
  const members = await prisma.contactListMember.count({ where: { contactListId: list.id } });
  const audience = await getAudienceInfo(ORG, list.id);
  console.log("LIST members:", members, "| audience (eligible):", audience.eligibleRecipients);

  const settings = await prisma.settings.findUnique({ where: { organizationId: ORG }, select: { companyName: true, companyAddress: true, unsubscribeFooterText: true } });
  const footer = {
    unsubscribeUrl: buildUnsubscribePageUrl(createUnsubscribeToken({ organizationId: ORG, email: EMAILS[0].toLowerCase(), campaignId: campaign.id })).replace(/\/unsubscribe\/.*/, "/unsubscribe/<signed-token>"),
    companyName: settings?.companyName, companyAddress: settings?.companyAddress, footerText: settings?.unsubscribeFooterText,
  };
  const rendered = renderPersonalizedEmail({ subject: SUBJECT, previewText: template.previewText, htmlContent: template.htmlContent }, audience.sampleData ?? undefined, footer);
  console.log("SUBJECT:", rendered.subject);
  console.log("FROM:", `${process.env.EMAIL_FROM_NAME ?? ""} <${process.env.EMAIL_FROM_ADDRESS ?? process.env.EMAIL_FROM ?? "?"}>`);
  console.log("FOOTER (text part):" + buildEmailFooterText(footer));
  console.log("HTML has Unsubscribe link:", rendered.html.includes(">Unsubscribe</a>"));
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
