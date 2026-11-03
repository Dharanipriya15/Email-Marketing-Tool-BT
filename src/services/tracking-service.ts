// Records opens/clicks. Totals count unique recipients: the first open/click
// sets openedAt/clickedAt (guarded by "is null") and only that increments.
import type { CampaignRecipientStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db/client";

const OPENABLE: CampaignRecipientStatus[] = ["SENT", "DELIVERED"];
const CLICKABLE: CampaignRecipientStatus[] = ["SENT", "DELIVERED", "OPENED"];

async function findRecipient(recipientId: string) {
  return prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    select: { id: true, organizationId: true, campaignId: true, sentAt: true },
  });
}

export async function recordOpen(recipientId: string, metadata?: Prisma.InputJsonValue): Promise<boolean> {
  const recipient = await findRecipient(recipientId);
  // Ignore unknown recipients and ones we never actually sent to.
  if (!recipient?.sentAt) return false;
  const now = new Date();
  const first = await prisma.campaignRecipient.updateMany({
    where: { id: recipient.id, openedAt: null },
    data: { openedAt: now },
  });
  if (first.count === 0) return false;
  await prisma.campaignRecipient.updateMany({
    where: { id: recipient.id, status: { in: OPENABLE } },
    data: { status: "OPENED" },
  });
  await prisma.campaign.update({ where: { id: recipient.campaignId }, data: { totalOpened: { increment: 1 } } });
  await prisma.emailEvent.create({
    data: {
      organizationId: recipient.organizationId,
      campaignId: recipient.campaignId,
      campaignRecipientId: recipient.id,
      type: "OPENED",
      occurredAt: now,
      ...(metadata ? { metadata } : {}),
    },
  });
  return true;
}

export async function recordClick(recipientId: string, url: string): Promise<boolean> {
  const recipient = await findRecipient(recipientId);
  if (!recipient?.sentAt) return false;
  // A click proves the email was opened (images may have been blocked).
  await recordOpen(recipientId, { inferredFromClick: true });
  const now = new Date();
  const first = await prisma.campaignRecipient.updateMany({
    where: { id: recipient.id, clickedAt: null },
    data: { clickedAt: now },
  });
  if (first.count === 0) return false;
  await prisma.campaignRecipient.updateMany({
    where: { id: recipient.id, status: { in: CLICKABLE } },
    data: { status: "CLICKED" },
  });
  await prisma.campaign.update({ where: { id: recipient.campaignId }, data: { totalClicked: { increment: 1 } } });
  await prisma.emailEvent.create({
    data: {
      organizationId: recipient.organizationId,
      campaignId: recipient.campaignId,
      campaignRecipientId: recipient.id,
      type: "CLICKED",
      occurredAt: now,
      metadata: { url: url.slice(0, 2000) },
    },
  });
  return true;
}
