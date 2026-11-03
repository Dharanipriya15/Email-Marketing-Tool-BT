import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaign: { findFirst: vi.fn() },
  campaignRecipient: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  emailEvent: { count: vi.fn() },
}));
vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import {
  csvSafe,
  exportCampaignRecipientsCsv,
  getCampaignReportSummary,
  listCampaignRecipients,
  parseRecipientStatus,
} from "@/services/campaign-report-service";

beforeEach(() => vi.clearAllMocks());

describe("campaign report", () => {
  it("returns null for another org's campaign", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    expect(await getCampaignReportSummary("org", "c1")).toBeNull();
    expect(prismaMock.campaign.findFirst.mock.calls[0][0].where).toEqual({ id: "c1", organizationId: "org" });
  });

  it("counts recipients by status and complaints", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.campaignRecipient.groupBy.mockResolvedValue([
      { status: "SENT", _count: { _all: 3 } },
      { status: "BOUNCED", _count: { _all: 1 } },
    ]);
    prismaMock.emailEvent.count.mockResolvedValue(2);
    const summary = await getCampaignReportSummary("org", "c1");
    expect(summary?.byStatus).toEqual({ SENT: 3, BOUNCED: 1 });
    expect(summary?.complaints).toBe(2);
  });

  it("filters and paginates recipients", async () => {
    prismaMock.campaignRecipient.findMany.mockResolvedValue([]);
    prismaMock.campaignRecipient.count.mockResolvedValue(0);
    await listCampaignRecipients({ organizationId: "org", campaignId: "c1", status: "FAILED", page: 2, pageSize: 25 });
    const args = prismaMock.campaignRecipient.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: "org", campaignId: "c1", status: "FAILED" });
    expect(args.skip).toBe(25);
  });

  it("parses only known statuses", () => {
    expect(parseRecipientStatus("FAILED")).toBe("FAILED");
    expect(parseRecipientStatus("DROP TABLE")).toBeUndefined();
  });

  it("exports CSV with formula-injection protection", async () => {
    prismaMock.campaignRecipient.findMany.mockResolvedValueOnce([
      {
        id: "r1", email: "a@x.com", firstName: "=HYPERLINK(1)", lastName: null, status: "FAILED", lastError: "Throttled",
        retryCount: 3, sentAt: null, deliveredAt: null, openedAt: null, clickedAt: null, bouncedAt: null,
        failedAt: new Date("2026-10-23T05:00:00Z"), unsubscribedAt: null,
      },
    ]);
    const csv = await exportCampaignRecipientsCsv("org", "c1");
    const [header, row] = csv.split(/\r?\n/);
    expect(header.startsWith("email,firstName,lastName,status,error")).toBe(true);
    expect(row).toContain("'=HYPERLINK(1)");
    expect(row).toContain("2026-10-23T05:00:00.000Z");
    expect(csvSafe("+1")).toBe("'+1");
    expect(csvSafe("ok")).toBe("ok");
  });
});
