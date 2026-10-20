import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaign: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  contactList: { findFirst: vi.fn() },
  emailTemplate: { findFirst: vi.fn() },
  contact: { count: vi.fn(), findFirst: vi.fn() },
  suppression: { findMany: vi.fn() },
  unsubscribe: { findMany: vi.fn() },
}));

vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import {
  CampaignInvalidReferenceError,
  CampaignNotEditableError,
  CampaignNotFoundError,
  CampaignNotReadyError,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  estimateRecipients,
  getAudienceInfo,
  listCampaigns,
  scheduleCampaign,
  unscheduleCampaign,
  updateCampaign,
} from "@/services/campaign-service";

const ORG = "org_1";
const input = { name: " Launch ", subject: " Hello ", contactListId: "l1", templateId: "t1" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.contactList.findFirst.mockResolvedValue({ id: "l1" });
  prismaMock.emailTemplate.findFirst.mockResolvedValue({ id: "t1" });
  prismaMock.suppression.findMany.mockResolvedValue([]);
  prismaMock.unsubscribe.findMany.mockResolvedValue([]);
});

describe("createCampaign", () => {
  it("creates a trimmed DRAFT scoped to the organization", async () => {
    prismaMock.campaign.create.mockResolvedValue({ id: "c1" });
    await createCampaign(ORG, "u1", input);
    const { data } = prismaMock.campaign.create.mock.calls[0][0];
    expect(data).toEqual({
      organizationId: ORG,
      createdById: "u1",
      status: "DRAFT",
      name: "Launch",
      subject: "Hello",
      contactListId: "l1",
      templateId: "t1",
    });
    expect(prismaMock.contactList.findFirst.mock.calls[0][0].where).toEqual({ id: "l1", organizationId: ORG });
    expect(prismaMock.emailTemplate.findFirst.mock.calls[0][0].where).toEqual({ id: "t1", organizationId: ORG });
  });

  it("rejects a list from another organization", async () => {
    prismaMock.contactList.findFirst.mockResolvedValue(null);
    await expect(createCampaign(ORG, "u1", input)).rejects.toBeInstanceOf(CampaignInvalidReferenceError);
    expect(prismaMock.campaign.create).not.toHaveBeenCalled();
  });

  it("allows drafts without list or template", async () => {
    prismaMock.campaign.create.mockResolvedValue({ id: "c1" });
    await createCampaign(ORG, null, { name: "A", subject: "B" });
    const { data } = prismaMock.campaign.create.mock.calls[0][0];
    expect(data.contactListId).toBeNull();
    expect(data.templateId).toBeNull();
    expect(prismaMock.contactList.findFirst).not.toHaveBeenCalled();
  });
});

describe("updateCampaign", () => {
  it("only updates DRAFT campaigns in the caller's organization", async () => {
    prismaMock.campaign.updateMany.mockResolvedValue({ count: 1 });
    await updateCampaign(ORG, "c1", input);
    expect(prismaMock.campaign.updateMany.mock.calls[0][0].where).toEqual({ id: "c1", organizationId: ORG, status: "DRAFT" });
  });

  it("throws CampaignNotEditableError for a scheduled campaign", async () => {
    prismaMock.campaign.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.campaign.findFirst.mockResolvedValue({ status: "SCHEDULED" });
    await expect(updateCampaign(ORG, "c1", input)).rejects.toBeInstanceOf(CampaignNotEditableError);
  });

  it("throws CampaignNotFoundError when the campaign doesn't exist", async () => {
    prismaMock.campaign.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    await expect(updateCampaign(ORG, "x", input)).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});

describe("duplicateCampaign", () => {
  it("copies into a fresh DRAFT with a '(Copy)' name within the length limit", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({
      name: "x".repeat(150),
      subject: "S",
      status: "COMPLETED",
      contactListId: "l1",
      templateId: "t1",
      totalSent: 50,
    });
    prismaMock.campaign.create.mockResolvedValue({ id: "c2" });
    await duplicateCampaign(ORG, "u1", "c1");
    expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith({ where: { id: "c1", organizationId: ORG } });
    const { data } = prismaMock.campaign.create.mock.calls[0][0];
    expect(data.name).toHaveLength(150);
    expect(data.name.endsWith(" (Copy)")).toBe(true);
    expect(data).toMatchObject({ organizationId: ORG, status: "DRAFT", subject: "S", contactListId: "l1", templateId: "t1" });
    expect(data.totalSent).toBeUndefined();
  });

  it("throws CampaignNotFoundError for a missing source", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null);
    await expect(duplicateCampaign(ORG, "u1", "x")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});

describe("deleteCampaign", () => {
  it("only deletes never-sent campaigns", async () => {
    prismaMock.campaign.deleteMany.mockResolvedValue({ count: 1 });
    await deleteCampaign(ORG, "c1");
    expect(prismaMock.campaign.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: ORG, status: { in: ["DRAFT", "SCHEDULED"] }, sentAt: null, totalSent: 0 },
    });
  });

  it("refuses to delete a completed campaign", async () => {
    prismaMock.campaign.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.campaign.findFirst.mockResolvedValue({ status: "COMPLETED" });
    await expect(deleteCampaign(ORG, "c1")).rejects.toBeInstanceOf(CampaignNotEditableError);
  });
});

describe("scheduleCampaign", () => {
  const when = new Date(Date.now() + 3_600_000);

  it("sets SCHEDULED and scheduledAt on a ready draft", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ status: "DRAFT", contactListId: "l1", templateId: "t1" });
    prismaMock.campaign.updateMany.mockResolvedValue({ count: 1 });
    await scheduleCampaign(ORG, "c1", when);
    expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: ORG, status: "DRAFT" },
      data: { status: "SCHEDULED", scheduledAt: when },
    });
  });

  it("requires a list and template", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ status: "DRAFT", contactListId: null, templateId: "t1" });
    await expect(scheduleCampaign(ORG, "c1", when)).rejects.toBeInstanceOf(CampaignNotReadyError);
    expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled();
  });

  it("refuses non-draft campaigns", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ status: "SENDING", contactListId: "l1", templateId: "t1" });
    await expect(scheduleCampaign(ORG, "c1", when)).rejects.toBeInstanceOf(CampaignNotEditableError);
  });
});

describe("unscheduleCampaign", () => {
  it("returns a scheduled campaign to DRAFT", async () => {
    prismaMock.campaign.updateMany.mockResolvedValue({ count: 1 });
    await unscheduleCampaign(ORG, "c1");
    expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: ORG, status: "SCHEDULED" },
      data: { status: "DRAFT", scheduledAt: null },
    });
  });
});

describe("estimateRecipients", () => {
  it("counts ACTIVE list members excluding suppressed and unsubscribed emails", async () => {
    prismaMock.suppression.findMany.mockResolvedValue([{ email: "A@x.com" }]);
    prismaMock.unsubscribe.findMany.mockResolvedValue([{ email: "b@x.com" }, { email: "a@x.com" }]);
    prismaMock.contact.count.mockResolvedValue(7);

    await expect(estimateRecipients(ORG, "l1")).resolves.toBe(7);
    const { where } = prismaMock.contact.count.mock.calls[0][0];
    expect(where).toEqual({
      organizationId: ORG,
      status: "ACTIVE",
      listMemberships: { some: { contactListId: "l1" } },
      unsubscribes: { none: {} },
      email: { notIn: ["a@x.com", "b@x.com"] },
    });
  });

  it("returns 0 for a list in another organization without counting", async () => {
    prismaMock.contactList.findFirst.mockResolvedValue(null);
    await expect(estimateRecipients(ORG, "other")).resolves.toBe(0);
    expect(prismaMock.contact.count).not.toHaveBeenCalled();
  });
});

describe("getAudienceInfo", () => {
  it("returns the count and personalization data from the first eligible contact", async () => {
    prismaMock.contact.count.mockResolvedValue(3);
    prismaMock.contact.findFirst.mockResolvedValue({
      firstName: "Ada",
      lastName: null,
      company: "Acme",
      industry: null,
      location: null,
      email: "ada@x.com",
    });
    const info = await getAudienceInfo(ORG, "l1");
    expect(info.eligibleRecipients).toBe(3);
    expect(info.sampleData).toMatchObject({ first_name: "Ada", last_name: "", company: "Acme" });
  });

  it("falls back to null sample data for an empty audience", async () => {
    prismaMock.contact.count.mockResolvedValue(0);
    prismaMock.contact.findFirst.mockResolvedValue(null);
    await expect(getAudienceInfo(ORG, "l1")).resolves.toEqual({ eligibleRecipients: 0, sampleData: null });
  });
});

describe("listCampaigns", () => {
  it("scopes to the organization and estimates recipients only for unsent campaigns", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { id: "c1", status: "DRAFT", contactListId: "l1", contactList: { name: "L" }, template: null, totalRecipients: 0, totalSent: 0 },
      { id: "c2", status: "COMPLETED", contactListId: "l1", contactList: { name: "L" }, template: { name: "T" }, totalRecipients: 9, totalSent: 9 },
    ]);
    prismaMock.contact.count.mockResolvedValue(4);

    const rows = await listCampaigns(ORG);
    expect(prismaMock.campaign.findMany.mock.calls[0][0].where).toEqual({ organizationId: ORG });
    expect(rows[0]).toMatchObject({ estimatedRecipients: 4, contactListName: "L", templateName: null });
    expect(rows[1]).toMatchObject({ estimatedRecipients: null, templateName: "T", totalSent: 9 });
    expect(prismaMock.contact.count).toHaveBeenCalledTimes(1);
  });
});