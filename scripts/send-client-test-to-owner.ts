// One-off: sends ONE test of the client template to the owner only, mirroring sendTestEmailAction.
import { prisma } from "@/db/client";
import { getTestAllowlist } from "@/lib/email-sending-config";
import { isAllowedTestRecipient } from "@/lib/test-email-recipients";
import { buildEmailFooterText, renderPersonalizedEmail } from "@/lib/email-render";
import { buildOneClickUnsubscribeUrl, buildUnsubscribePageUrl, createUnsubscribeToken } from "@/lib/unsubscribe-token";
import { htmlToPlainText } from "@/lib/email-text";
import { applyPersonalization } from "@/lib/personalization";
import { getEmailProvider } from "@/services/email/provider";

const ORG = "boiltech-org";
const TO = "dharanipriya154@gmail.com";

async function main() {
  const provider = getEmailProvider();
  if (!provider) throw new Error("provider not configured");
  const orgUsers = await prisma.user.findMany({ where: { organizationId: ORG }, select: { email: true } });
  if (!isAllowedTestRecipient(TO, getTestAllowlist(), orgUsers.map((u) => u.email))) throw new Error("not allowed");
  const t = await prisma.emailTemplate.findFirstOrThrow({ where: { organizationId: ORG, name: "BoilerTech Client Test - Oct 2026" }, select: { subject: true, previewText: true, htmlContent: true } });
  const settings = await prisma.settings.findUnique({ where: { organizationId: ORG }, select: { companyName: true, companyAddress: true, unsubscribeFooterText: true } });
  const token = createUnsubscribeToken({ organizationId: ORG, email: TO });
  const footer = { unsubscribeUrl: buildUnsubscribePageUrl(token), companyName: settings?.companyName, companyAddress: settings?.companyAddress, footerText: settings?.unsubscribeFooterText };
  const rendered = renderPersonalizedEmail({ subject: t.subject, previewText: t.previewText, htmlContent: t.htmlContent }, undefined, footer);
  const result = await provider.sendEmail({
    to: TO,
    subject: `[Test] ${rendered.subject}`,
    html: rendered.html,
    text: applyPersonalization(htmlToPlainText(t.htmlContent)) + buildEmailFooterText(footer),
    headers: { "List-Unsubscribe": `<${buildOneClickUnsubscribeUrl(token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  console.log("TO:", TO, "| SUBJECT:", `[Test] ${rendered.subject}`);
  console.log("RESULT:", JSON.stringify(result));
}
main().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
