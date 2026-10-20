import { prisma } from "@/db/client";
import type { UnsubscribePayload } from "@/lib/unsubscribe-token";

export type UnsubscribeResult = { alreadyUnsubscribed: boolean };

// Records an unsubscribe. Idempotent: repeating it (double clicks, mail
// client one-click retries) never creates duplicates or double-counts.
export async function unsubscribeRecipient(
  payload: UnsubscribePayload,
  source: "link" | "one-click"
): Promise<UnsubscribeResult> {
  const organizationId = payload.organizationId;
  const email = payload.email.trim().toLowerCase();

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) {
      throw new Error("Unknown organization for unsubscribe token.");
    }

    // Only link records that really belong to this organization.
    const [contact, campaign] = await Promise.all([
      tx.contact.findFirst({ where: { organizationId, email }, select: { id: true } }),
      payload.campaignId
        ? tx.campaign.findFirst({ where: { id: payload.campaignId, organizationId }, select: { id: true } })
        : null,
    ]);

    const existing = await tx.unsubscribe.findFirst({ where: { organizationId, email }, select: { id: true } });
    const alreadyUnsubscribed = Boolean(existing);

    if (!existing) {
      await tx.unsubscribe.create({
        data: {
          organizationId,
          email,
          contactId: contact?.id ?? null,
          campaignId: campaign?.id ?? null,
          reason: source === "one-click" ? "One-click unsubscribe" : "Unsubscribe link",
        },
      });
      if (campaign) {
        await tx.campaign.update({ where: { id: campaign.id }, data: { totalUnsubscribed: { increment: 1 } } });
        await tx.campaignRecipient.updateMany({
          where: { campaignId: campaign.id, email, unsubscribedAt: null },
          data: { unsubscribedAt: new Date() },
        });
      }
    }

    await tx.suppression.upsert({
      where: { organizationId_email: { organizationId, email } },
      create: { organizationId, email, reason: "UNSUBSCRIBED", source: `unsubscribe:${source}` },
      update: {},
    });

    // Don't overwrite BOUNCED/SUPPRESSED; only active contacts flip.
    await tx.contact.updateMany({
      where: { organizationId, email, status: "ACTIVE" },
      data: { status: "UNSUBSCRIBED" },
    });

    return { alreadyUnsubscribed };
  });
}

export async function isUnsubscribed(organizationId: string, email: string): Promise<boolean> {
  const suppression = await prisma.suppression.findUnique({
    where: { organizationId_email: { organizationId, email: email.trim().toLowerCase() } },
    select: { id: true },
  });
  return Boolean(suppression);
}