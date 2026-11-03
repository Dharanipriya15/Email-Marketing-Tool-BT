import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaignRecipient: { findFirst: vi.fn(), updateMany: vi.fn() },
  suppression: { upsert: vi.fn() },
  contact: { updateMany: vi.fn() },
  campaign: { update: vi.fn() },
  emailEvent: { create: vi.fn(), count: vi.fn() },
}));
vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import { applySesFeedback, parseSesFeedback } from "@/services/ses-feedback-service";

const bounce = (bounceType: string) =>
  JSON.stringify({
    notificationType: "Bounce",
    mail: { messageId: "m-1" },
    bounce: { bounceType, bouncedRecipients: [{ emailAddress: "Bounce@Simulator.amazonses.com" }] },
  });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 1 });
});

describe("parseSesFeedback", () => {
  it("parses permanent bounces and complaints, ignores transient", () => {
    expect(parseSesFeedback(bounce("Permanent"))).toMatchObject({ kind: "bounce", messageId: "m-1" });
    expect(parseSesFeedback(bounce("Transient"))).toBeNull();
    expect(
      parseSesFeedback(JSON.stringify({ eventType: "Complaint", mail: { messageId: "m-2" }, complaint: { complainedRecipients: [{ emailAddress: "a@b.c" }] } }))
    ).toMatchObject({ kind: "complaint", emails: ["a@b.c"] });
    expect(parseSesFeedback("not json")).toBeNull();
  });
});

describe("applySesFeedback", () => {
  it("suppresses the address in the sending org and marks the recipient bounced", async () => {
    prismaMock.campaignRecipient.findFirst.mockResolvedValue({ id: "r1", organizationId: "org", campaignId: "c1", contactId: "k1", email: "x", status: "SENT" });
    const result = await applySesFeedback(parseSesFeedback(bounce("Permanent"))!);
    expect(result.suppressed).toBe(1);
    expect(prismaMock.suppression.upsert.mock.calls[0][0].create).toMatchObject({ organizationId: "org", email: "bounce@simulator.amazonses.com", reason: "BOUNCED" });
    expect(prismaMock.campaign.update).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown message ids", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    prismaMock.campaignRecipient.findFirst.mockResolvedValue(null);
    expect(await applySesFeedback({ kind: "complaint", messageId: "zz", emails: ["a@b.c"] })).toEqual({ suppressed: 0 });
    expect(prismaMock.suppression.upsert).not.toHaveBeenCalled();
  });

  it("parses deliveries and records them once", async () => {
    const raw = JSON.stringify({ notificationType: "Delivery", mail: { messageId: "m-9" }, delivery: { recipients: ["a@b.c"] } });
    expect(parseSesFeedback(raw)).toEqual({ kind: "delivery", messageId: "m-9", emails: ["a@b.c"] });
    prismaMock.campaignRecipient.findFirst.mockResolvedValue({ id: "r1", organizationId: "org", campaignId: "c1", contactId: null, email: "a@b.c", status: "SENT" });
    prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 1 });
    expect(await applySesFeedback({ kind: "delivery", messageId: "m-9", emails: [] })).toEqual({ suppressed: 0 });
    expect(prismaMock.campaign.update.mock.calls[0][0].data).toEqual({ totalDelivered: { increment: 1 } });
    expect(prismaMock.emailEvent.create.mock.calls[0][0].data.type).toBe("DELIVERED");
    expect(prismaMock.suppression.upsert).not.toHaveBeenCalled();

    vi.clearAllMocks();
    prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 0 });
    await applySesFeedback({ kind: "delivery", messageId: "m-9", emails: [] });
    expect(prismaMock.campaign.update).not.toHaveBeenCalled();
  });

  it("records a complaint event once and suppresses", async () => {
    prismaMock.campaignRecipient.findFirst.mockResolvedValue({ id: "r1", organizationId: "org", campaignId: "c1", contactId: null, email: "a@b.c", status: "SENT" });
    prismaMock.emailEvent.count.mockResolvedValue(0);
    await applySesFeedback({ kind: "complaint", messageId: "m-1", emails: ["a@b.c"] });
    expect(prismaMock.emailEvent.create.mock.calls[0][0].data.type).toBe("COMPLAINED");
    expect(prismaMock.suppression.upsert.mock.calls[0][0].create.reason).toBe("COMPLAINED");
    vi.clearAllMocks();
    prismaMock.emailEvent.count.mockResolvedValue(1);
    await applySesFeedback({ kind: "complaint", messageId: "m-1", emails: ["a@b.c"] });
    expect(prismaMock.emailEvent.create).not.toHaveBeenCalled();
  });
});
