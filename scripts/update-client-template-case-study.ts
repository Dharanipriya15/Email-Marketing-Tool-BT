// One-off: replaces the client-test template body with the case-study HTML. Sends nothing.
import { readFileSync } from "node:fs";
import { prisma } from "@/db/client";
import { templateFormSchema } from "@/schemas/template";
import { campaignFormSchema } from "@/schemas/campaign";
import { updateTemplate } from "@/services/template-service";
import { updateCampaign } from "@/services/campaign-service";

const ORG = "boiltech-org";
const TEMPLATE_ID = "cmvlr6t9m0001zwxcgzjw0xb3";
const CAMPAIGN_ID = "cmvlr5ngn000fzw60ffjsiny1";
const SUBJECT = "Technical Case Study: High Bed Temperature in an AFBC Boiler";

async function main() {
  const html = readFileSync("scripts/content/afbc-case-study.html", "utf8");
  await updateTemplate(ORG, TEMPLATE_ID, templateFormSchema.parse({
    name: "BoilerTech Client Test - Oct 2026",
    subject: SUBJECT,
    previewText: "Field insights from Boilertech Energy Services on bed-coil heat transfer",
    htmlContent: html,
  }));
  const c = await prisma.campaign.findFirstOrThrow({ where: { id: CAMPAIGN_ID, organizationId: ORG }, select: { name: true, contactListId: true } });
  await updateCampaign(ORG, CAMPAIGN_ID, campaignFormSchema.parse({ name: c.name, subject: SUBJECT, contactListId: c.contactListId, templateId: TEMPLATE_ID }));

  const t = await prisma.emailTemplate.findUniqueOrThrow({ where: { id: TEMPLATE_ID }, select: { subject: true, previewText: true, htmlContent: true } });
  const count = (re: RegExp) => (t.htmlContent.match(re) ?? []).length;
  const src = (re: RegExp) => (html.match(re) ?? []).length;
  console.log("TEMPLATE subject:", t.subject, "| preview:", t.previewText);
  for (const [n, re] of [["h2", /<h2\b/g], ["h3", /<h3\b/g], ["ul", /<ul\b/g], ["li", /<li\b/g], ["strong", /<strong\b/g], ["p", /<p\b/g], ["hr", /<hr\b/g]] as const)
    console.log(`  <${n}> source=${src(re)} stored=${count(re)}`);
  console.log("  inline colors kept:", t.htmlContent.includes("#0f2b46"), "| special chars kept:", ["\u2013", "\u00B0", "\u2212", "\u00D7"].every((ch) => t.htmlContent.includes(ch)));
  console.log("  stored length:", t.htmlContent.length, "source length:", html.length);
  console.log("CAMPAIGN", JSON.stringify(await prisma.campaign.findUniqueOrThrow({ where: { id: CAMPAIGN_ID }, select: { status: true, subject: true, templateId: true, totalRecipients: true } })));
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
