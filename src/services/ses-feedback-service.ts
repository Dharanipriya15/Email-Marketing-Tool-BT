// Applies SES bounce/complaint notifications (delivered via SNS) to the DB:
// recipient -> BOUNCED, contact -> BOUNCED, and the address is suppressed in
// the organization that sent the message. Server-side only.
import { prisma } from "@/db/client";

type Feedback = { kind: "bounce" | "complaint"; messageId: string; emails: string[] };

// Accepts both classic SES notifications (notificationType) and
// configuration-set event publishing (eventType).
export function parseSesFeedback(raw: string): Feedback | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const type = String(data.notificationType ?? data.eventType ?? "");
  const messageId = String((data.mail as { messageId?: string } | undefined)?.messageId ?? "");
  if (!messageId) return null;
  if (type === "Bounce") {
    const bounce = data.bounce as { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] } | undefined;
    // Transient/undetermined bounces are not suppressed.
    if (bounce?.bounceType !== "Permanent") return null;
    const emails = (bounce.bouncedRecipients ?? []).map((r) => r.emailAddress ?? "").filter(Boolean);
    return { kind: "bounce", messageId, emails };
  }
  if (type === "Complaint") {
    const complaint = data.complaint as { complainedRecipients?: { emailAddress?: string }[] } | undefined;
    const emails = (complaint?.complainedRecipients ?? []).map((r) => r.emailAddress ?? "").filter(Boolean);
    return { kind: "complaint", messageId, emails };
  }
  return null;
}

export async function applySesFeedback(feedback: Feedback): Promise<{ suppressed: number }> {
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { providerMessageId: feedback.messageId },
    select: { id: true, organizationId: true, campaignId: true, contactId: true, email: true, status: true },
  });
  if (!recipient) {
    console.warn("[ses-feedback] no recipient for message id; ignored");
    return { suppressed: 0 };
  }
  const { organizationId } = recipient;
  const now = new Date();
  const emails = feedback.emails.length > 0 ? feedback.emails : [recipient.email];
  let suppressed = 0;
  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    await prisma.suppression.upsert({
      where: { organizationId_email: { organizationId, email } },
      update: {},
      create: { organizationId, email, reason: feedback.kind === "bounce" ? "BOUNCED" : "COMPLAINED", source: "ses-sns" },
    });
    await prisma.contact.updateMany({
      where: { organizationId, email, status: "ACTIVE" },
      data: { status: feedback.kind === "bounce" ? "BOUNCED" : "SUPPRESSED" },
    });
    suppressed++;
  }
  if (feedback.kind === "bounce" && recipient.status !== "BOUNCED") {
    const updated = await prisma.campaignRecipient.updateMany({
      where: { id: recipient.id, status: { not: "BOUNCED" } },
      data: { status: "BOUNCED", bouncedAt: now },
    });
    if (updated.count > 0) {
      await prisma.campaign.update({ where: { id: recipient.campaignId }, data: { totalBounced: { increment: 1 } } });
      await prisma.emailEvent.create({
        data: { organizationId, campaignId: recipient.campaignId, campaignRecipientId: recipient.id, type: "BOUNCED", occurredAt: now },
      });
    }
  }
  return { suppressed };
}
