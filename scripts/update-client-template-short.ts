// One-off: replaces the client-test template body with the SHORT case study. Sends nothing.
import { readFileSync } from "node:fs";
import { prisma } from "@/db/client";
import { templateFormSchema } from "@/schemas/template";
import { campaignFormSchema } from "@/schemas/campaign";
import { updateTemplate } from "@/services/template-service";
import { updateCampaign } from "@/services/campaign-service";
import { renderPersonalizedEmail } from "@/lib/email-render";
import { applyTracking, isTrackingAvailable } from "@/lib/tracking";

const ORG = "boiltech-org";
const TEMPLATE_ID = "cmvlr6t9m0001zwxcgzjw0xb3";
const CAMPAIGN_ID = "cmvlr5ngn000fzw60ffjsiny1";
const SUBJECT = "High Bed Temperature in Your AFBC Boiler? It May Not Be an Airflow Problem";

async function main() {
  const html = readFileSync("scripts/content/afbc-case-study-short.html", "utf8");
  await updateTemplate(ORG, TEMPLATE_ID, templateFormSchema.parse({
    name: "BoilerTech Client Test - Oct 2026", subject: SUBJECT,
    previewText: "A short field case study from Boilertech Energy Services", htmlContent: html,
  }));
  const c = await prisma.campaign.findFirstOrThrow({ where: { id: CAMPAIGN_ID, organizationId: ORG }, select: { name: true, contactListId: true } });
  await updateCampaign(ORG, CAMPAIGN_ID, campaignFormSchema.parse({ name: c.name, subject: SUBJECT, contactListId: c.contactListId, templateId: TEMPLATE_ID }));

  const t = await prisma.emailTemplate.findUniqueOrThrow({ where: { id: TEMPLATE_ID }, select: { subject: true, previewText: true, htmlContent: true } });
  console.log("TEMPLATE subject:", t.subject, "| preview:", t.previewText);
  console.log("STORED CTA:", t.htmlContent.match(/<a\b[^>]*>Request a Boiler Assessment<\/a>/)?.[0] ?? "MISSING");
  console.log("degree sign kept:", t.htmlContent.includes("\u00B0C"), "| em/strong/ul kept:", /<em>/.test(t.htmlContent), /<strong>/.test(t.htmlContent), /<ul>/.test(t.htmlContent));
  const rendered = renderPersonalizedEmail({ subject: t.subject, previewText: t.previewText, htmlContent: t.htmlContent }, undefined, { unsubscribeUrl: "https://x/unsubscribe/t" });
  const campaignHtml = applyTracking(rendered.html, "preview", { trackOpens: true, trackClicks: true, skipUrls: [] });
  console.log("tracking available (APP_URL public https):", isTrackingAvailable());
  console.log("CTA href as a CAMPAIGN send would render:", campaignHtml.match(/<a\b[^>]*href="([^"]+)"[^>]*>Request a Boiler Assessment/)?.[1]);
  console.log("CTA href in TEST send render:", rendered.html.match(/<a\b[^>]*href="([^"]+)"[^>]*>Request a Boiler Assessment/)?.[1]);
  console.log("CAMPAIGN", JSON.stringify(await prisma.campaign.findUniqueOrThrow({ where: { id: CAMPAIGN_ID }, select: { status: true, subject: true, totalRecipients: true } })));
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
