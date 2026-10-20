import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaign: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  contact: { findMany: vi.fn() },
  campaignRecipient: { createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  emailEvent: { create: vi.fn() },
  suppression: { findMany: vi.fn() },
  unsubscribe: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const providerMock = vi.hoisted(() => ({ getEmailProvider: vi.fn() }));
vi.mock("@/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/services/email/provider", () => providerMock);

import {
  STUCK_REVIEW_PREFIX,
  dispatchDueCampaigns,
  processCampaignBatch,
  reconcileStuckRecipients,
} from "@/services/campaign-send-service";

const sendEmail = vi.fn();
const provider = { sendEmail };
const noSleep = () => Promise.resolve();
const dropped = () => Object.assign(new Error("Server has closed the connection."), { code: "P1017" });

const sendingCampaign = {
  id: "m1",
  organizationId: "org_1",
  status: "SENDING",
  subject: "Hi",
  template: { previewText: null, htmlContent: "<p>Hello</p>" },
  organization: { name: "Org", settings: null },
};
const row = (id: string) => ({
  id, email: `${id}@example.com`, firstName: null, lastName: null, retryCount: 0, contactId: null,
  contact: { status: "ACTIVE", company: null, industry: null, location: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_SENDING_ENABLED", "true");
  vi.stubEnv("EMAIL_TEST_ALLOWLIST", "");
  vi.stubEnv("EMAIL_SEND_RATE_PER_SEC", "1");
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  providerMock.getEmailProvider.mockReturnValue(provider);
  prismaMock.suppression.findMany.mockResolvedValue([]);
  prismaMock.unsubscribe.findMany.mockResolvedValue([]);
  prismaMock.campaignRecipient.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.campaignRecipient.count.mockResolvedValue(0);
  prismaMock.campaign.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.campaign.findFirst.mockResolvedValue(sendingCampaign);
  sendEmail.mockResolvedValue({ success: true, messageId: "msg-1" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("DB resilience in the send loop", () => {
  it("retries a dropped connection after the provider call and never re-sends", async () => {
    prismaMock.campaignRecipient.findMany.mockResolvedValueOnce([row("r1")]).mockResolvedValue([]);
    prismaMock.campaignRecipient.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockRejectedValueOnce(dropped()) // SENT write fails once
      .mockResolvedValue({ count: 1 });
    const result = await processCampaignBatch("m1", { sleep: noSleep });
    expect(result.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(prismaMock.campaign.update).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-transient DB errors", async () => {
    prismaMock.campaignRecipient.findMany.mockResolvedValueOnce([row("r1")]).mockResolvedValue([]);
    prismaMock.campaignRecipient.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    await expect(processCampaignBatch("m1", { sleep: noSleep })).rejects.toMatchObject({ code: "P2002" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("reconcileStuckRecipients", () => {
  it("flags old SENDING rows as FAILED for review without sending", async () => {
    vi.stubEnv("EMAIL_STUCK_SENDING_MINUTES", "10");
    prismaMock.campaignRecipient.updateMany.mockResolvedValueOnce({ count: 2 });
    const now = new Date("2026-10-20T10:00:00Z");
    expect(await reconcileStuckRecipients(now)).toBe(2);
    const args = prismaMock.campaignRecipient.updateMany.mock.calls[0][0];
    expect(args.where.status).toBe("SENDING");
    expect(args.where.OR[0].queuedAt.lt).toEqual(new Date("2026-10-20T09:50:00Z"));
    expect(args.data.status).toBe("FAILED");
    expect(args.data.lastError.startsWith(STUCK_REVIEW_PREFIX)).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("dispatchDueCampaigns", () => {
  it("processes sending campaigns within the time budget", async () => {
    let now = 0;
    const clock = () => now;
    const sleep = async (ms: number) => { now += ms; };
    prismaMock.campaign.findMany
      .mockResolvedValueOnce([]) // due scheduled
      .mockResolvedValue([{ id: "m1" }]); // sending
    let n = 0;
    prismaMock.campaignRecipient.findMany.mockImplementation(async (args: { take: number }) =>
      Array.from({ length: args.take }, () => row(`r${++n}`))
    );
    prismaMock.campaignRecipient.count.mockResolvedValue(100);
    sendEmail.mockImplementation(async () => { now += 10; return { success: true, messageId: "x" }; });
    const summary = await dispatchDueCampaigns(new Date(), { timeBudgetMs: 5000, clock, sleep });
    // 1 msg/sec within a 5s budget: at most 5 sends.
    expect(sendEmail.mock.calls.length).toBeGreaterThan(0);
    expect(sendEmail.mock.calls.length).toBeLessThanOrEqual(5);
    expect(summary.elapsedMs).toBeLessThanOrEqual(5100);
  });

  it("stops when no campaign is sending", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([]);
    const summary = await dispatchDueCampaigns(new Date(), { timeBudgetMs: 5000, sleep: noSleep });
    expect(summary.processed).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
