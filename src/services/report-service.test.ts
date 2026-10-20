import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaign: { findMany: vi.fn() },
  campaignRecipient: { groupBy: vi.fn() },
  unsubscribe: { count: vi.fn(), findMany: vi.fn() },
  contact: { count: vi.fn() },
}));

vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import { deliveryRate, getReport, parseReportRange, rangeStart } from "@/services/report-service";

const ORG = "org_1";
const NOW = new Date("2026-10-14T00:00:00Z");

function campaign(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `Campaign ${id}`,
    status,
    sentAt: null,
    totalRecipients: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    _count: { unsubscribes: 0 },
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaign.findMany.mockResolvedValue([]);
  prismaMock.campaignRecipient.groupBy.mockResolvedValue([]);
  prismaMock.unsubscribe.count.mockResolvedValue(0);
  prismaMock.unsubscribe.findMany.mockResolvedValue([]);
  prismaMock.contact.count.mockResolvedValue(0);
});

describe("helpers", () => {
  it("parses ranges with an 'all' fallback", () => {
    expect(parseReportRange("30")).toBe("30");
    expect(parseReportRange("365")).toBe("all");
    expect(parseReportRange(undefined)).toBe("all");
  });

  it("computes range start and delivery rate", () => {
    expect(rangeStart("all", NOW)).toBeNull();
    expect(rangeStart("7", NOW)?.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(deliveryRate(0, 0)).toBeNull();
    expect(deliveryRate(3, 1)).toBe(75);
  });
});

describe("getReport", () => {
  it("aggregates recipient statuses per campaign and overall", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      campaign("c1", "COMPLETED", { totalRecipients: 5, totalOpened: 2, totalBounced: 1, _count: { unsubscribes: 1 } }),
      campaign("c2", "DRAFT"),
      campaign("c3", "COMPLETED", { totalRecipients: 1 }),
    ]);
    prismaMock.campaignRecipient.groupBy.mockResolvedValue([
      { campaignId: "c1", status: "SENT", _count: { _all: 2 } },
      { campaignId: "c1", status: "DELIVERED", _count: { _all: 1 } },
      { campaignId: "c1", status: "FAILED", _count: { _all: 1 } },
      { campaignId: "c1", status: "SUPPRESSED", _count: { _all: 1 } },
      { campaignId: "c3", status: "PENDING", _count: { _all: 1 } },
    ]);
    prismaMock.contact.count.mockResolvedValue(42);

    const report = await getReport(ORG, "all", NOW);

    expect(report.overview).toMatchObject({
      totalCampaigns: 3,
      campaignsByStatus: { COMPLETED: 2, DRAFT: 1 },
      totalRecipients: 6,
      recipients: { sent: 3, failed: 1, skipped: 1, pending: 1 },
      deliveryRate: 75,
      activeContacts: 42,
      opened: 2,
      bounced: 1,
    });
    expect(report.campaigns[0]).toMatchObject({ id: "c1", sent: 3, failed: 1, skipped: 1, unsubscribes: 1, deliveryRate: 75 });
    expect(report.campaigns[1]).toMatchObject({ id: "c2", sent: 0, deliveryRate: null });
  });

  it("scopes every query to the organization and applies the date range", async () => {
    await getReport(ORG, "30", NOW);
    const since = new Date("2026-09-14T00:00:00Z");

    expect(prismaMock.campaign.findMany.mock.calls[0][0].where).toEqual({ organizationId: ORG, createdAt: { gte: since } });
    expect(prismaMock.campaignRecipient.groupBy.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
      campaign: { organizationId: ORG, createdAt: { gte: since } },
    });
    for (const call of prismaMock.unsubscribe.count.mock.calls) {
      expect(call[0].where.organizationId).toBe(ORG);
    }
    expect(prismaMock.contact.count.mock.calls[0][0].where).toEqual({ organizationId: ORG, status: "ACTIVE" });
  });

  it("returns empty-state friendly values when nothing has been sent", async () => {
    const report = await getReport(ORG, "all", NOW);
    expect(report.overview.deliveryRate).toBeNull();
    expect(report.overview.totalCampaigns).toBe(0);
    expect(report.campaigns).toEqual([]);
    expect(report.recentUnsubscribes).toEqual([]);
  });

  it("maps recent unsubscribes with their campaign name", async () => {
    const createdAt = new Date("2026-10-10T00:00:00Z");
    prismaMock.unsubscribe.findMany.mockResolvedValue([
      { id: "u1", email: "a@x.com", createdAt, campaignId: "c1", campaign: { name: "Launch" } },
      { id: "u2", email: "b@x.com", createdAt, campaignId: null, campaign: null },
    ]);
    const report = await getReport(ORG, "all", NOW);
    expect(report.recentUnsubscribes).toEqual([
      { id: "u1", email: "a@x.com", createdAt, campaignId: "c1", campaignName: "Launch" },
      { id: "u2", email: "b@x.com", createdAt, campaignId: null, campaignName: null },
    ]);
  });
});