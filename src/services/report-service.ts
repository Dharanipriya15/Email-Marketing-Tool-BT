import { prisma } from "@/db/client";
import type { CampaignRecipientStatus, CampaignStatus, Prisma } from "@prisma/client";

export const REPORT_RANGES = ["7", "30", "90", "all"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_UNSUBSCRIBES_LIMIT = 10;

export function parseReportRange(value: unknown): ReportRange {
  return REPORT_RANGES.includes(value as ReportRange) ? (value as ReportRange) : "all";
}

export function rangeStart(range: ReportRange, now: Date = new Date()): Date | null {
  return range === "all" ? null : new Date(now.getTime() - Number(range) * DAY_MS);
}

export type RecipientBreakdown = { sent: number; failed: number; skipped: number; pending: number };

// SENT and later delivery stages all count as "sent"; skipped = not sent on
// purpose (suppressed, unsubscribed, or outside the test allowlist).
export function bucketRecipientStatus(status: CampaignRecipientStatus): keyof RecipientBreakdown {
  switch (status) {
    case "SENT":
    case "DELIVERED":
    case "OPENED":
    case "CLICKED":
      return "sent";
    case "FAILED":
    case "BOUNCED":
      return "failed";
    case "SUPPRESSED":
    case "UNSUBSCRIBED":
      return "skipped";
    default:
      return "pending";
  }
}

// Sent / attempted (sent + failed). Null when nothing was attempted.
export function deliveryRate(sent: number, failed: number): number | null {
  const attempted = sent + failed;
  return attempted > 0 ? (sent / attempted) * 100 : null;
}

export type ReportOverview = {
  totalCampaigns: number;
  campaignsByStatus: Partial<Record<CampaignStatus, number>>;
  totalRecipients: number;
  recipients: RecipientBreakdown;
  deliveryRate: number | null;
  unsubscribesInRange: number;
  unsubscribesLast30Days: number;
  unsubscribesAllTime: number;
  activeContacts: number;
  // Campaign counters; stay 0 until open/click/bounce tracking exists.
  opened: number;
  clicked: number;
  bounced: number;
};

export type CampaignReportRow = RecipientBreakdown & {
  id: string;
  name: string;
  status: CampaignStatus;
  sentAt: Date | null;
  totalRecipients: number;
  unsubscribes: number;
  deliveryRate: number | null;
};

export type RecentUnsubscribe = {
  id: string;
  email: string;
  createdAt: Date;
  campaignId: string | null;
  campaignName: string | null;
};

export type Report = {
  range: ReportRange;
  overview: ReportOverview;
  campaigns: CampaignReportRow[];
  recentUnsubscribes: RecentUnsubscribe[];
};

function emptyBreakdown(): RecipientBreakdown {
  return { sent: 0, failed: 0, skipped: 0, pending: 0 };
}

export async function getReport(organizationId: string, range: ReportRange, now: Date = new Date()): Promise<Report> {
  const since = rangeStart(range, now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  // Campaigns are in range by creation date; unsubscribes by their own date.
  const campaignWhere: Prisma.CampaignWhereInput = { organizationId, ...(since ? { createdAt: { gte: since } } : {}) };
  const unsubscribeWhere: Prisma.UnsubscribeWhereInput = {
    organizationId,
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [campaigns, recipientGroups, unsubscribesInRange, unsubscribesLast30Days, unsubscribesAllTime, activeContacts, recent] =
    await Promise.all([
      prisma.campaign.findMany({
        where: campaignWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          sentAt: true,
          totalRecipients: true,
          totalOpened: true,
          totalClicked: true,
          totalBounced: true,
          _count: { select: { unsubscribes: true } },
        },
      }),
      prisma.campaignRecipient.groupBy({
        by: ["campaignId", "status"],
        where: { organizationId, campaign: campaignWhere },
        _count: { _all: true },
      }),
      prisma.unsubscribe.count({ where: unsubscribeWhere }),
      prisma.unsubscribe.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.unsubscribe.count({ where: { organizationId } }),
      prisma.contact.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.unsubscribe.findMany({
        where: unsubscribeWhere,
        orderBy: { createdAt: "desc" },
        take: RECENT_UNSUBSCRIBES_LIMIT,
        select: { id: true, email: true, createdAt: true, campaignId: true, campaign: { select: { name: true } } },
      }),
    ]);

  const perCampaign = new Map<string, RecipientBreakdown>();
  const totals = emptyBreakdown();
  for (const group of recipientGroups) {
    const bucket = bucketRecipientStatus(group.status);
    const count = group._count._all;
    const breakdown = perCampaign.get(group.campaignId) ?? emptyBreakdown();
    breakdown[bucket] += count;
    perCampaign.set(group.campaignId, breakdown);
    totals[bucket] += count;
  }

  const campaignsByStatus: Partial<Record<CampaignStatus, number>> = {};
  let totalRecipients = 0;
  let opened = 0;
  let clicked = 0;
  let bounced = 0;
  for (const campaign of campaigns) {
    campaignsByStatus[campaign.status] = (campaignsByStatus[campaign.status] ?? 0) + 1;
    totalRecipients += campaign.totalRecipients;
    opened += campaign.totalOpened;
    clicked += campaign.totalClicked;
    bounced += campaign.totalBounced;
  }

  return {
    range,
    overview: {
      totalCampaigns: campaigns.length,
      campaignsByStatus,
      totalRecipients,
      recipients: totals,
      deliveryRate: deliveryRate(totals.sent, totals.failed),
      unsubscribesInRange,
      unsubscribesLast30Days,
      unsubscribesAllTime,
      activeContacts,
      opened,
      clicked,
      bounced,
    },
    campaigns: campaigns.map((campaign) => {
      const breakdown = perCampaign.get(campaign.id) ?? emptyBreakdown();
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sentAt: campaign.sentAt,
        totalRecipients: campaign.totalRecipients,
        unsubscribes: campaign._count.unsubscribes,
        ...breakdown,
        deliveryRate: deliveryRate(breakdown.sent, breakdown.failed),
      };
    }),
    recentUnsubscribes: recent.map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: row.createdAt,
      campaignId: row.campaignId,
      campaignName: row.campaign?.name ?? null,
    })),
  };
}