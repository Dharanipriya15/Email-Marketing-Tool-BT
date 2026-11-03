import { prisma } from "@/db/client";
import type { CampaignStatus } from "@prisma/client";

// Rate over delivered, or over sent when delivery notifications aren't set up.
export function rate(count: number, delivered: number, sent: number): number {
  const base = delivered > 0 ? delivered : sent;
  return base > 0 ? (count / base) * 100 : 0;
}

export type DashboardStats = {
  totalContacts: number;
  totalCampaigns: number;
  emailsSent: number;
  averageOpenRate: number;
};

export async function getDashboardStats(organizationId: string): Promise<DashboardStats> {
  const [totalContacts, totalCampaigns, totals] = await Promise.all([
    prisma.contact.count({ where: { organizationId } }),
    prisma.campaign.count({ where: { organizationId } }),
    prisma.campaign.aggregate({
      where: { organizationId },
      _sum: { totalSent: true, totalDelivered: true, totalOpened: true },
    }),
  ]);

  const emailsSent = totals._sum.totalSent ?? 0;
  const delivered = totals._sum.totalDelivered ?? 0;
  const opened = totals._sum.totalOpened ?? 0;
  // Without SES delivery notifications, fall back to sent as the base.
  const base = delivered > 0 ? delivered : emailsSent;
  const averageOpenRate = base > 0 ? (opened / base) * 100 : 0;

  return { totalContacts, totalCampaigns, emailsSent, averageOpenRate };
}

export type RecentCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  totalRecipients: number;
  totalSent: number;
  openRate: number;
  clickRate: number;
  createdAt: Date;
};

export async function getRecentCampaigns(
  organizationId: string,
  limit = 5
): Promise<RecentCampaign[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      totalRecipients: true,
      totalSent: true,
      totalDelivered: true,
      totalOpened: true,
      totalClicked: true,
      createdAt: true,
    },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    totalRecipients: c.totalRecipients,
    totalSent: c.totalSent,
    openRate: rate(c.totalOpened, c.totalDelivered, c.totalSent),
    clickRate: rate(c.totalClicked, c.totalDelivered, c.totalSent),
    createdAt: c.createdAt,
  }));
}

export type CampaignPerformancePoint = {
  id: string;
  name: string;
  openRate: number;
  clickRate: number;
};

export async function getCampaignPerformance(
  organizationId: string,
  limit = 6
): Promise<CampaignPerformancePoint[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId, OR: [{ totalDelivered: { gt: 0 } }, { totalSent: { gt: 0 } }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      totalSent: true,
      totalDelivered: true,
      totalOpened: true,
      totalClicked: true,
    },
  });

  return campaigns
    .map((c) => ({
      id: c.id,
      name: c.name,
      openRate: rate(c.totalOpened, c.totalDelivered, c.totalSent),
      clickRate: rate(c.totalClicked, c.totalDelivered, c.totalSent),
    }))
    .reverse();
}

export type ActivityItem = {
  id: string;
  message: string;
  timestamp: Date;
};

export async function getRecentActivity(
  organizationId: string,
  limit = 6
): Promise<ActivityItem[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId, status: { not: "DRAFT" } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      scheduledAt: true,
      updatedAt: true,
    },
  });

  return campaigns.map((c) => ({
    id: c.id,
    message: describeCampaignActivity(c.name, c.status, c.scheduledAt),
    timestamp: c.updatedAt,
  }));
}

function describeCampaignActivity(
  name: string,
  status: CampaignStatus,
  scheduledAt: Date | null
): string {
  switch (status) {
    case "SCHEDULED":
      return scheduledAt
        ? `"${name}" scheduled for ${scheduledAt.toLocaleDateString()}`
        : `"${name}" was scheduled`;
    case "SENDING":
      return `"${name}" is sending`;
    case "COMPLETED":
      return `"${name}" finished sending`;
    case "PAUSED":
      return `"${name}" was paused`;
    case "FAILED":
      return `"${name}" failed to send`;
    default:
      return `"${name}" was updated`;
  }
}
