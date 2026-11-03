import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaignRecipient: { findUnique: vi.fn(), updateMany: vi.fn() },
  campaign: { update: vi.fn() },
  emailEvent: { create: vi.fn() },
}));
vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import { recordClick, recordOpen } from "@/services/tracking-service";

const recipient = { id: "r1", organizationId: "org", campaignId: "c1", sentAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaignRecipient.findUnique.mockResolvedValue(recipient);
  prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 1 });
});

describe("tracking service", () => {
  it("counts the first open only", async () => {
    expect(await recordOpen("r1")).toBe(true);
    expect(prismaMock.campaign.update.mock.calls[0][0].data).toEqual({ totalOpened: { increment: 1 } });
    expect(prismaMock.emailEvent.create.mock.calls[0][0].data.type).toBe("OPENED");

    vi.clearAllMocks();
    prismaMock.campaignRecipient.findUnique.mockResolvedValue(recipient);
    prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 0 });
    expect(await recordOpen("r1")).toBe(false);
    expect(prismaMock.campaign.update).not.toHaveBeenCalled();
    expect(prismaMock.emailEvent.create).not.toHaveBeenCalled();
  });

  it("ignores unknown or unsent recipients", async () => {
    prismaMock.campaignRecipient.findUnique.mockResolvedValue(null);
    expect(await recordOpen("x")).toBe(false);
    prismaMock.campaignRecipient.findUnique.mockResolvedValue({ ...recipient, sentAt: null });
    expect(await recordClick("r1", "https://a.com")).toBe(false);
    expect(prismaMock.campaignRecipient.updateMany).not.toHaveBeenCalled();
  });

  it("records a unique click (and the implied open) with the URL", async () => {
    expect(await recordClick("r1", "https://a.com")).toBe(true);
    const increments = prismaMock.campaign.update.mock.calls.map((c) => c[0].data);
    expect(increments).toEqual([{ totalOpened: { increment: 1 } }, { totalClicked: { increment: 1 } }]);
    const click = prismaMock.emailEvent.create.mock.calls.find((c) => c[0].data.type === "CLICKED");
    expect(click?.[0].data.metadata).toEqual({ url: "https://a.com" });
  });

  it("does not double count repeat clicks", async () => {
    prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 0 });
    expect(await recordClick("r1", "https://a.com")).toBe(false);
    expect(prismaMock.campaign.update).not.toHaveBeenCalled();
  });
});
