import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    campaign: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    contact: { findMany: vi.fn() },
    contactList: { findFirst: vi.fn() },
    campaignRecipient: { createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    emailEvent: { create: vi.fn() },
    suppression: { findMany: vi.fn() },
    unsubscribe: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return mock;
});

// The provider module is mocked so no real email can ever be sent from tests.
const providerMock = vi.hoisted(() => ({ getEmailProvider: vi.fn() }));

vi.mock("@/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/services/email/provider", () => providerMock);

import {
  CampaignNotSendableError,
  ProviderNotConfiguredError,
  RecipientCapExceededError,
  SendingDisabledError,
  prepareCampaign,
  processCampaignBatch,
} from "@/services/campaign-send-service";

const ORG = "org_1";
const sendEmail = vi.fn();
const provider = { sendEmail };
const noSleep = () => Promise.resolve();

function recipient(id: string, email: string, retryCount = 0) {
  return {
    id,
    email,
    firstName: "Ada",
    lastName: null,
    retryCount,
    contactId: `c_${id}`,
    contact: { status: "ACTIVE", company: "Acme", industry: null, location: null },
  };
}

const sendingCampaign = {
  id: "m1",
  organizationId: ORG,
  status: "SENDING",
  subject: "Hi {{first_name}}",
  template: { previewText: null, htmlContent: "<p>Hello {{first_name}} from {{company}}</p>" },
  organization: { name: "Org", settings: { companyName: "BoilerTech", companyAddress: "1 Main St", unsubscribeFooterText: null } },
};

// findMany returns the given batch once, then nothing.
function queueRecipients(rows: ReturnType<typeof recipient>[]) {
  prismaMock.campaignRecipient.findMany.mockResolvedValueOnce(rows).mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_SENDING_ENABLED", "true");
  vi.stubEnv("EMAIL_TEST_ALLOWLIST", "");
  vi.stubEnv("EMAIL_MAX_CAMPAIGN_RECIPIENTS", "");
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.spyOn(console, "info").mockImplementation(() => {});
  providerMock.getEmailProvider.mockReturnValue(provider);
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
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

describe("safety switches", () => {
  it("refuses to prepare or send when EMAIL_SENDING_ENABLED isn't 'true'", async () => {
    vi.stubEnv("EMAIL_SENDING_ENABLED", "yes");
    await expect(prepareCampaign(ORG, "m1")).rejects.toBeInstanceOf(SendingDisabledError);
    await expect(processCampaignBatch("m1", { sleep: noSleep })).rejects.toBeInstanceOf(SendingDisabledError);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prismaMock.campaign.findFirst).not.toHaveBeenCalled();
  });

  it("refuses when no provider is configured", async () => {
    providerMock.getEmailProvider.mockReturnValue(null);
    await expect(processCampaignBatch("m1", { sleep: noSleep })).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe("prepareCampaign", () => {
  beforeEach(() => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "m1", status: "DRAFT", contactListId: "l1", templateId: "t1" });
  });

  it("snapshots eligible recipients, excluding suppressed/unsubscribed, and moves to SENDING", async () => {
    prismaMock.suppression.findMany.mockResolvedValue([{ email: "blocked@x.com" }]);
    prismaMock.unsubscribe.findMany.mockResolvedValue([{ email: "Gone@x.com" }]);
    prismaMock.contact.findMany.mockResolvedValue([
      { id: "c1", email: "Ada@x.com", firstName: "Ada", lastName: null },
      { id: "c2", email: "bob@x.com", firstName: null, lastName: "B" },
    ]);

    await expect(prepareCampaign(ORG, "m1", { provider })).resolves.toEqual({ totalRecipients: 2 });

    const { where } = prismaMock.contact.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      organizationId: ORG,
      status: "ACTIVE",
      listMemberships: { some: { contactListId: "l1" } },
      unsubscribes: { none: {} },
      email: { notIn: ["blocked@x.com", "gone@x.com"] },
    });
    expect(prismaMock.campaign.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "m1", organizationId: ORG, status: { in: ["DRAFT", "SCHEDULED"] } },
      data: { status: "SENDING", totalRecipients: 2 },
    });
    const createArgs = prismaMock.campaignRecipient.createMany.mock.calls[0][0];
    expect(createArgs.skipDuplicates).toBe(true);
    expect(createArgs.data.map((r: { email: string }) => r.email)).toEqual(["ada@x.com", "bob@x.com"]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("enforces EMAIL_MAX_CAMPAIGN_RECIPIENTS", async () => {
    vi.stubEnv("EMAIL_MAX_CAMPAIGN_RECIPIENTS", "1");
    prismaMock.contact.findMany.mockResolvedValue([
      { id: "c1", email: "a@x.com", firstName: null, lastName: null },
      { id: "c2", email: "b@x.com", firstName: null, lastName: null },
    ]);
    const error = await prepareCampaign(ORG, "m1", { provider }).catch((e) => e);
    expect(error).toBeInstanceOf(RecipientCapExceededError);
    expect(error.cap).toBe(1);
    expect(prismaMock.campaignRecipient.createMany).not.toHaveBeenCalled();
    expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled();
  });

  it("defaults the cap to 100", async () => {
    prismaMock.contact.findMany.mockResolvedValue(
      Array.from({ length: 101 }, (_, i) => ({ id: `c${i}`, email: `u${i}@x.com`, firstName: null, lastName: null }))
    );
    await expect(prepareCampaign(ORG, "m1", { provider })).rejects.toBeInstanceOf(RecipientCapExceededError);
  });

  it("only prepares DRAFT/SCHEDULED campaigns that have list and template", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "m1", status: "COMPLETED", contactListId: "l1", templateId: "t1" });
    await expect(prepareCampaign(ORG, "m1", { provider })).rejects.toBeInstanceOf(CampaignNotSendableError);
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "m1", status: "DRAFT", contactListId: null, templateId: "t1" });
    await expect(prepareCampaign(ORG, "m1", { provider })).rejects.toBeInstanceOf(CampaignNotSendableError);
  });
});

describe("processCampaignBatch", () => {
  it("sends with personalization, footer and List-Unsubscribe headers, then marks SENT and completes", async () => {
    queueRecipients([recipient("r1", "ada@x.com")]);

    const result = await processCampaignBatch("m1", { sleep: noSleep });

    expect(result).toMatchObject({ sent: 1, failed: 0, skipped: 0, remaining: 0, completed: true });
    const params = sendEmail.mock.calls[0][0];
    expect(params.to).toBe("ada@x.com");
    expect(params.subject).toBe("Hi Ada");
    expect(params.html).toContain("Hello Ada from Acme");
    expect(params.html).toContain("https://app.example.com/unsubscribe/");
    expect(params.html).toContain("BoilerTech");
    expect(params.text).toContain("Unsubscribe: https://app.example.com/unsubscribe/");
    expect(params.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/app\.example\.com\/api\/unsubscribe\?token=.+>$/);
    expect(params.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    const updates = prismaMock.campaignRecipient.updateMany.mock.calls.map((c) => c[0]);
    expect(updates[0]).toMatchObject({ where: { id: "r1", status: "PENDING" }, data: { status: "SENDING" } });
    expect(updates[1]).toMatchObject({
      where: { id: "r1", status: "SENDING" },
      data: { status: "SENT", providerMessageId: "msg-1" },
    });
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { totalSent: { increment: 1 } } });
    expect(prismaMock.campaign.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: "m1", status: "SENDING" }, data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("re-queues a failed send with retryCount++ and marks FAILED after 3 attempts", async () => {
    sendEmail.mockResolvedValue({ success: false, error: "Throttled" });
    prismaMock.campaignRecipient.count.mockResolvedValue(1);
    queueRecipients([recipient("r1", "a@x.com", 0), recipient("r2", "b@x.com", 2)]);

    const result = await processCampaignBatch("m1", { sleep: noSleep });

    expect(result).toMatchObject({ sent: 0, retried: 1, failed: 1, completed: false });
    const updates = prismaMock.campaignRecipient.updateMany.mock.calls.map((c) => c[0]);
    expect(updates).toContainEqual({
      where: { id: "r1", status: "SENDING" },
      data: { status: "PENDING", retryCount: 1, lastError: "Throttled" },
    });
    expect(updates).toContainEqual(
      expect.objectContaining({
        where: { id: "r2", status: "SENDING" },
        data: expect.objectContaining({ status: "FAILED", retryCount: 3 }),
      })
    );
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { totalFailed: { increment: 1 } } });
  });

  it("treats a thrown provider error as a failed attempt", async () => {
    sendEmail.mockRejectedValue(new Error("network down"));
    queueRecipients([recipient("r1", "a@x.com", 2)]);
    const result = await processCampaignBatch("m1", { sleep: noSleep });
    expect(result.failed).toBe(1);
  });

  it("re-checks suppression right before sending", async () => {
    prismaMock.suppression.findMany.mockResolvedValue([{ email: "ada@x.com" }]);
    queueRecipients([recipient("r1", "ada@x.com")]);
    const result = await processCampaignBatch("m1", { sleep: noSleep });
    expect(result.skipped).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prismaMock.campaignRecipient.updateMany.mock.calls[1][0].data.status).toBe("SUPPRESSED");
  });

  it("skips contacts that are no longer ACTIVE", async () => {
    const r = recipient("r1", "ada@x.com");
    r.contact.status = "UNSUBSCRIBED";
    queueRecipients([r]);
    await processCampaignBatch("m1", { sleep: noSleep });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("with EMAIL_TEST_ALLOWLIST only sends to listed emails/domains", async () => {
    vi.stubEnv("EMAIL_TEST_ALLOWLIST", "me@team.com, @safe.org");
    queueRecipients([
      recipient("r1", "me@team.com"),
      recipient("r2", "boss@team.com"),
      recipient("r3", "anyone@safe.org"),
      recipient("r4", "customer@real.com"),
    ]);
    const result = await processCampaignBatch("m1", { sleep: noSleep });
    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(["me@team.com", "anyone@safe.org"]);
    expect(result).toMatchObject({ sent: 2, skipped: 2 });
  });

  it("never double-sends a recipient another worker already claimed", async () => {
    queueRecipients([recipient("r1", "a@x.com")]);
    prismaMock.campaignRecipient.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await processCampaignBatch("m1", { sleep: noSleep });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("does nothing for paused campaigns", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ ...sendingCampaign, status: "PAUSED" });
    prismaMock.campaignRecipient.count.mockResolvedValue(5);
    const result = await processCampaignBatch("m1", { sleep: noSleep });
    expect(result).toMatchObject({ sent: 0, remaining: 5, completed: false });
    expect(prismaMock.campaignRecipient.findMany).not.toHaveBeenCalled();
  });

  it("respects maxPerRun and throttles between sends", async () => {
    vi.stubEnv("EMAIL_SEND_RATE_PER_SEC", "2");
    const sleep = vi.fn(() => Promise.resolve());
    prismaMock.campaignRecipient.findMany.mockResolvedValue([recipient("r1", "a@x.com"), recipient("r2", "b@x.com")]);
    prismaMock.campaignRecipient.count.mockResolvedValue(3);
    const result = await processCampaignBatch("m1", { sleep, batchSize: 2, maxPerRun: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(prismaMock.campaignRecipient.findMany.mock.calls[0][0].take).toBe(2);
  });

  it("scopes to the organization when one is given", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    await expect(processCampaignBatch("m1", { organizationId: ORG, sleep: noSleep })).rejects.toBeInstanceOf(
      CampaignNotSendableError
    );
    expect(prismaMock.campaign.findFirst.mock.calls[0][0].where).toEqual({ id: "m1", organizationId: ORG });
  });
});