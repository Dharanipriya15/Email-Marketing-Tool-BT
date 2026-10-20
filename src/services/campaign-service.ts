import { prisma } from "@/db/client";
import type { CampaignStatus, Prisma } from "@prisma/client";
import type { CampaignFormData } from "@/schemas/campaign";

const MAX_NAME_LENGTH = 150;
const COPY_SUFFIX = " (Copy)";

// Statuses in which nothing has been handed to the email provider yet, so the
// campaign can safely be deleted. Sending/completed campaigns keep history.
const DELETABLE_STATUSES: CampaignStatus[] = ["DRAFT", "SCHEDULED"];

export class CampaignNotFoundError extends Error {
  constructor() {
    super("Campaign not found.");
  }
}

export class CampaignNotEditableError extends Error {
  constructor(public readonly status: CampaignStatus) {
    super("Campaign can no longer be changed.");
  }
}

export class CampaignInvalidReferenceError extends Error {
  constructor(public readonly field: "contactListId" | "templateId") {
    super(field === "contactListId" ? "Contact list not found." : "Template not found.");
  }
}

export class CampaignNotReadyError extends Error {
  constructor() {
    super("Campaign needs an audience and a template before it can be scheduled.");
  }
}

export type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  contactListId: string | null;
  contactListName: string | null;
  templateId: string | null;
  templateName: string | null;
  // Live eligible-recipient estimate for not-yet-sent campaigns; null otherwise.
  estimatedRecipients: number | null;
  totalRecipients: number;
  totalSent: number;
  scheduledAt: Date | null;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

// Emails that must never be mailed: the durable suppression list plus any
// recorded unsubscribe (which may exist without a linked contact).
export async function getBlockedEmails(organizationId: string): Promise<string[]> {
  const [suppressions, unsubscribes] = await Promise.all([
    prisma.suppression.findMany({ where: { organizationId }, select: { email: true } }),
    prisma.unsubscribe.findMany({ where: { organizationId }, select: { email: true } }),
  ]);
  return [...new Set([...suppressions, ...unsubscribes].map((row) => row.email.toLowerCase()))];
}

export function eligibleContactsWhere(
  organizationId: string,
  contactListId: string,
  blockedEmails: string[]
): Prisma.ContactWhereInput {
  return {
    organizationId,
    status: "ACTIVE",
    listMemberships: { some: { contactListId } },
    unsubscribes: { none: {} },
    ...(blockedEmails.length > 0 ? { email: { notIn: blockedEmails } } : {}),
  };
}

// Counts ACTIVE contacts in the list that are not suppressed or unsubscribed.
// Returns 0 for a list that doesn't belong to the organization.
export async function estimateRecipients(organizationId: string, contactListId: string): Promise<number> {
  const list = await prisma.contactList.findFirst({
    where: { id: contactListId, organizationId },
    select: { id: true },
  });
  if (!list) return 0;

  const blockedEmails = await getBlockedEmails(organizationId);
  return prisma.contact.count({ where: eligibleContactsWhere(organizationId, contactListId, blockedEmails) });
}

// First eligible contact of a list, used to preview personalization with real data.
export async function getSampleRecipient(organizationId: string, contactListId: string) {
  const blockedEmails = await getBlockedEmails(organizationId);
  return prisma.contact.findFirst({
    where: eligibleContactsWhere(organizationId, contactListId, blockedEmails),
    orderBy: { createdAt: "asc" },
    select: { firstName: true, lastName: true, company: true, industry: true, location: true, email: true },
  });
}

export type AudienceInfo = {
  eligibleRecipients: number;
  // Personalization values from the first eligible contact, or null so
  // previews fall back to sample data.
  sampleData: Record<string, string> | null;
};

export async function getAudienceInfo(organizationId: string, contactListId: string): Promise<AudienceInfo> {
  const [eligibleRecipients, sample] = await Promise.all([
    estimateRecipients(organizationId, contactListId),
    getSampleRecipient(organizationId, contactListId),
  ]);
  return {
    eligibleRecipients,
    sampleData:
      eligibleRecipients > 0 && sample
        ? {
            first_name: sample.firstName ?? "",
            last_name: sample.lastName ?? "",
            company: sample.company ?? "",
            industry: sample.industry ?? "",
            location: sample.location ?? "",
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listCampaigns(organizationId: string): Promise<CampaignRow[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      contactList: { select: { name: true } },
      template: { select: { name: true } },
    },
  });

  const listIdsNeedingEstimate = [
    ...new Set(
      campaigns
        .filter((c) => DELETABLE_STATUSES.includes(c.status) && c.contactListId)
        .map((c) => c.contactListId as string)
    ),
  ];
  const estimates = new Map<string, number>();
  if (listIdsNeedingEstimate.length > 0) {
    const blockedEmails = await getBlockedEmails(organizationId);
    const counts = await Promise.all(
      listIdsNeedingEstimate.map((listId) =>
        prisma.contact.count({ where: eligibleContactsWhere(organizationId, listId, blockedEmails) })
      )
    );
    listIdsNeedingEstimate.forEach((listId, index) => estimates.set(listId, counts[index]));
  }

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    contactListId: c.contactListId,
    contactListName: c.contactList?.name ?? null,
    templateId: c.templateId,
    templateName: c.template?.name ?? null,
    estimatedRecipients:
      DELETABLE_STATUSES.includes(c.status) && c.contactListId ? (estimates.get(c.contactListId) ?? 0) : null,
    totalRecipients: c.totalRecipients,
    totalSent: c.totalSent,
    scheduledAt: c.scheduledAt,
    createdAt: c.createdAt,
  }));
}

export async function getCampaign(organizationId: string, id: string) {
  return prisma.campaign.findFirst({
    where: { id, organizationId },
    include: {
      contactList: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, subject: true, previewText: true, htmlContent: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

// List and template ids come from the client, so confirm they belong to the
// caller's organization before linking them.
async function assertReferences(organizationId: string, input: CampaignFormData) {
  const [list, template] = await Promise.all([
    input.contactListId
      ? prisma.contactList.findFirst({ where: { id: input.contactListId, organizationId }, select: { id: true } })
      : null,
    input.templateId
      ? prisma.emailTemplate.findFirst({ where: { id: input.templateId, organizationId }, select: { id: true } })
      : null,
  ]);
  if (input.contactListId && !list) throw new CampaignInvalidReferenceError("contactListId");
  if (input.templateId && !template) throw new CampaignInvalidReferenceError("templateId");
}

function normalizeInput(input: CampaignFormData) {
  return {
    name: input.name.trim(),
    subject: input.subject.trim(),
    contactListId: input.contactListId ?? null,
    templateId: input.templateId ?? null,
  };
}

// Distinguishes "doesn't exist" from "exists but isn't in an editable state"
// after a conditional updateMany/deleteMany matched nothing.
async function throwForUnmatched(organizationId: string, id: string): Promise<never> {
  const existing = await prisma.campaign.findFirst({ where: { id, organizationId }, select: { status: true } });
  if (!existing) throw new CampaignNotFoundError();
  throw new CampaignNotEditableError(existing.status);
}

export async function createCampaign(organizationId: string, userId: string | null, input: CampaignFormData) {
  await assertReferences(organizationId, input);
  return prisma.campaign.create({
    data: { organizationId, createdById: userId, status: "DRAFT", ...normalizeInput(input) },
  });
}

export async function updateCampaign(organizationId: string, id: string, input: CampaignFormData) {
  await assertReferences(organizationId, input);
  const result = await prisma.campaign.updateMany({
    where: { id, organizationId, status: "DRAFT" },
    data: normalizeInput(input),
  });
  if (result.count === 0) await throwForUnmatched(organizationId, id);
}

export async function duplicateCampaign(organizationId: string, userId: string | null, id: string) {
  const original = await prisma.campaign.findFirst({ where: { id, organizationId } });
  if (!original) throw new CampaignNotFoundError();

  const baseName = original.name.slice(0, MAX_NAME_LENGTH - COPY_SUFFIX.length);
  return prisma.campaign.create({
    data: {
      organizationId,
      createdById: userId,
      name: `${baseName}${COPY_SUFFIX}`,
      subject: original.subject,
      status: "DRAFT",
      contactListId: original.contactListId,
      templateId: original.templateId,
    },
  });
}

// Only campaigns that never started sending can be deleted.
export async function deleteCampaign(organizationId: string, id: string) {
  const result = await prisma.campaign.deleteMany({
    where: { id, organizationId, status: { in: DELETABLE_STATUSES }, sentAt: null, totalSent: 0 },
  });
  if (result.count === 0) await throwForUnmatched(organizationId, id);
}

// Marks a draft as SCHEDULED. Nothing is sent here: a dispatcher (not built
// yet) will pick up due campaigns and do the actual sending.
export async function scheduleCampaign(organizationId: string, id: string, scheduledAt: Date) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId },
    select: { status: true, contactListId: true, templateId: true },
  });
  if (!campaign) throw new CampaignNotFoundError();
  if (campaign.status !== "DRAFT") throw new CampaignNotEditableError(campaign.status);
  if (!campaign.contactListId || !campaign.templateId) throw new CampaignNotReadyError();

  const result = await prisma.campaign.updateMany({
    where: { id, organizationId, status: "DRAFT" },
    data: { status: "SCHEDULED", scheduledAt },
  });
  if (result.count === 0) await throwForUnmatched(organizationId, id);
}

export async function unscheduleCampaign(organizationId: string, id: string) {
  const result = await prisma.campaign.updateMany({
    where: { id, organizationId, status: "SCHEDULED" },
    data: { status: "DRAFT", scheduledAt: null },
  });
  if (result.count === 0) await throwForUnmatched(organizationId, id);
}