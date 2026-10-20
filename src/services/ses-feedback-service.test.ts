import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaignRecipient: { findFirst: vi.fn(), updateMany: vi.fn() },
  suppression: { upsert: vi.fn() },
  contact: { updateMany: vi.fn() },
  campaign: { update: vi.fn() },
  emailEvent: { create: vi.fn() },
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
});
