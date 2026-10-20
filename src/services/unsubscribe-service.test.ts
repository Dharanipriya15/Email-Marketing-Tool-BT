import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    organization: { findUnique: vi.fn() },
    contact: { findFirst: vi.fn(), updateMany: vi.fn() },
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    campaignRecipient: { updateMany: vi.fn() },
    unsubscribe: { findFirst: vi.fn(), create: vi.fn() },
    suppression: { upsert: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import { unsubscribeRecipient } from "@/services/unsubscribe-service";

const ORG = "org_1";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.organization.findUnique.mockResolvedValue({ id: ORG });
  prismaMock.contact.findFirst.mockResolvedValue({ id: "c1" });
  prismaMock.campaign.findFirst.mockResolvedValue({ id: "m1" });
  prismaMock.contact.updateMany.mockResolvedValue({ count: 1 });
});

describe("unsubscribeRecipient", () => {
  it("records unsubscribe + suppression and flips the active contact", async () => {
    prismaMock.unsubscribe.findFirst.mockResolvedValue(null);
    const result = await unsubscribeRecipient({ organizationId: ORG, email: "Ada@X.com", campaignId: "m1" }, "link");

    expect(result).toEqual({ alreadyUnsubscribed: false });
    expect(prismaMock.unsubscribe.create.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      email: "ada@x.com",
      contactId: "c1",
      campaignId: "m1",
    });
    expect(prismaMock.suppression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_email: { organizationId: ORG, email: "ada@x.com" } },
        update: {},
      })
    );
    expect(prismaMock.contact.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, email: "ada@x.com", status: "ACTIVE" },
      data: { status: "UNSUBSCRIBED" },
    });
    expect(prismaMock.campaign.update).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a repeat doesn't create duplicates or double-count", async () => {
    prismaMock.unsubscribe.findFirst.mockResolvedValue({ id: "u1" });
    const result = await unsubscribeRecipient({ organizationId: ORG, email: "ada@x.com", campaignId: "m1" }, "one-click");

    expect(result).toEqual({ alreadyUnsubscribed: true });
    expect(prismaMock.unsubscribe.create).not.toHaveBeenCalled();
    expect(prismaMock.campaign.update).not.toHaveBeenCalled();
    expect(prismaMock.suppression.upsert).toHaveBeenCalledTimes(1);
  });

  it("ignores a campaign id from another organization", async () => {
    prismaMock.unsubscribe.findFirst.mockResolvedValue(null);
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    await unsubscribeRecipient({ organizationId: ORG, email: "ada@x.com", campaignId: "foreign" }, "link");
    expect(prismaMock.campaign.findFirst.mock.calls[0][0].where).toEqual({ id: "foreign", organizationId: ORG });
    expect(prismaMock.unsubscribe.create.mock.calls[0][0].data.campaignId).toBeNull();
    expect(prismaMock.campaign.update).not.toHaveBeenCalled();
  });

  it("rejects tokens for unknown organizations", async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);
    await expect(unsubscribeRecipient({ organizationId: "nope", email: "a@x.com" }, "link")).rejects.toThrow();
    expect(prismaMock.suppression.upsert).not.toHaveBeenCalled();
  });
});