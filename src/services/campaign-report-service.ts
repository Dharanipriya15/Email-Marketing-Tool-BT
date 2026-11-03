import type { CampaignRecipientStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { rowsToCsv } from "@/lib/csv";

export const REPORT_PAGE_SIZE = 50;
export const RECIPIENT_STATUSES: CampaignRecipientStatus[] = [
  "PENDING",
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "BOUNCED",
  "FAILED",
  "UNSUBSCRIBED",
  "SUPPRESSED",
  "CANCELLED",
];

export function parseRecipientStatus(value: string | undefined): CampaignRecipientStatus | undefined {
  return RECIPIENT_STATUSES.find((status) => status === value);
}

export async function getCampaignReportSummary(organizationId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      sentAt: true,
      completedAt: true,
      totalRecipients: true,
      totalSent: true,
      totalDelivered: true,
      totalOpened: true,
      totalClicked: true,
      totalBounced: true,
      totalFailed: true,
      totalUnsubscribed: true,
    },
  });
  if (!campaign) return null;

  const [groups, complaints] = await Promise.all([
    prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId, organizationId },
      _count: { _all: true },
    }),
    prisma.emailEvent.count({ where: { campaignId, organizationId, type: "COMPLAINED" } }),
  ]);
  const byStatus: Partial<Record<CampaignRecipientStatus, number>> = {};
  for (const group of groups) byStatus[group.status] = group._count._all;
  return { campaign, byStatus, complaints };
}

function recipientWhere(organizationId: string, campaignId: string, status?: CampaignRecipientStatus): Prisma.CampaignRecipientWhereInput {
  return { organizationId, campaignId, ...(status ? { status } : {}) };
}

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lastError: true,
  retryCount: true,
  sentAt: true,
  deliveredAt: true,
  openedAt: true,
  clickedAt: true,
  bouncedAt: true,
  failedAt: true,
  unsubscribedAt: true,
} satisfies Prisma.CampaignRecipientSelect;

export async function listCampaignRecipients(params: {
  organizationId: string;
  campaignId: string;
  status?: CampaignRecipientStatus;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = params.pageSize ?? REPORT_PAGE_SIZE;
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const where = recipientWhere(params.organizationId, params.campaignId, params.status);
  const [rows, total] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: RECIPIENT_SELECT,
    }),
    prisma.campaignRecipient.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export const EXPORT_COLUMNS = [
  "email",
  "firstName",
  "lastName",
  "status",
  "error",
  "retryCount",
  "sentAt",
  "deliveredAt",
  "openedAt",
  "clickedAt",
  "bouncedAt",
  "failedAt",
  "unsubscribedAt",
];

// Spreadsheet apps execute cells starting with = + - @ (or tab/CR) as
// formulas; prefix them so exported data can't inject one.
export function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const iso = (d: Date | null) => (d ? d.toISOString() : "");

export async function exportCampaignRecipientsCsv(
  organizationId: string,
  campaignId: string,
  status?: CampaignRecipientStatus
): Promise<string> {
  const out: Record<string, string>[] = [];
  let cursor: string | undefined;
  // Page through by id so large campaigns don't load in one query.
  for (;;) {
    const batch = await prisma.campaignRecipient.findMany({
      where: recipientWhere(organizationId, campaignId, status),
      orderBy: { id: "asc" },
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: RECIPIENT_SELECT,
    });
    for (const r of batch) {
      out.push({
        email: csvSafe(r.email),
        firstName: csvSafe(r.firstName ?? ""),
        lastName: csvSafe(r.lastName ?? ""),
        status: r.status,
        error: csvSafe(r.lastError ?? ""),
        retryCount: String(r.retryCount),
        sentAt: iso(r.sentAt),
        deliveredAt: iso(r.deliveredAt),
        openedAt: iso(r.openedAt),
        clickedAt: iso(r.clickedAt),
        bouncedAt: iso(r.bouncedAt),
        failedAt: iso(r.failedAt),
        unsubscribedAt: iso(r.unsubscribedAt),
      });
    }
    if (batch.length < 1000) break;
    cursor = batch[batch.length - 1].id;
  }
  return rowsToCsv(out, EXPORT_COLUMNS);
}
