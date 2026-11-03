// One-off: creates the client template and points the DRAFT campaign at it. Sends nothing.
import { prisma } from "@/db/client";
import { templateFormSchema } from "@/schemas/template";
import { campaignFormSchema } from "@/schemas/campaign";
import { createTemplate } from "@/services/template-service";
import { updateCampaign } from "@/services/campaign-service";

const ORG = "boiltech-org";
const NAME = "BoilerTech Client Test - Oct 2026";
const SUBJECT = "Keep Your Boiler Running Safely and Efficiently";
const HTML = `<h2>Hello from BoilerTech Energy</h2>
<p>Dear Customer,</p>
<p>A well-maintained boiler runs safer, uses less fuel, and avoids costly breakdowns. At BoilerTech Energy, our engineers help industries keep their boilers performing at their best, all year round.</p>
<p><strong>How we can help:</strong></p>
<ul><li>Boiler installation and commissioning</li><li>Preventive maintenance and periodic servicing</li><li>Breakdown support and repairs</li><li>Efficiency and safety checks</li></ul>
<p>If your boiler is due for a check-up, or you would like expert advice, simply reply to this email and our team will get in touch.</p>
<p><a href="https://boilertechenergy.com">Visit boilertechenergy.com</a></p>
<p>Warm regards,<br>Team BoilerTech Energy</p>`;

async function main() {
  let t = await prisma.emailTemplate.findFirst({ where: { organizationId: ORG, name: NAME }, select: { id: true } });
  if (t) console.log("REUSED template", t.id);
  else {
    t = await createTemplate(ORG, templateFormSchema.parse({ name: NAME, subject: SUBJECT, previewText: "A quick note from the BoilerTech Energy team", htmlContent: HTML }));
    console.log("CREATED template", t.id);
  }
  const c = await prisma.campaign.findFirstOrThrow({ where: { organizationId: ORG, name: "BoilerTech Client Test - 24 Oct" }, select: { id: true, contactListId: true } });
  await updateCampaign(ORG, c.id, campaignFormSchema.parse({ name: "BoilerTech Client Test - 24 Oct", subject: SUBJECT, contactListId: c.contactListId, templateId: t.id }));
  const after = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id }, select: { status: true, subject: true, templateId: true, contactListId: true, totalRecipients: true } });
  console.log("CAMPAIGN", c.id, JSON.stringify(after));
  const stored = await prisma.emailTemplate.findUniqueOrThrow({ where: { id: t.id }, select: { htmlContent: true } });
  console.log("STORED HTML length", stored.htmlContent.length, "| link kept:", stored.htmlContent.includes("https://boilertechenergy.com"));
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
