import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  emailTemplate: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  campaign: { count: vi.fn() },
  organization: { findUnique: vi.fn() },
}));

vi.mock("@/db/client", () => ({ prisma: prismaMock }));

import {
  TemplateInUseError,
  TemplateNotFoundError,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getStarterTemplateHtml,
  listTemplates,
  updateTemplate,
} from "@/services/template-service";

const ORG = "org_1";
const input = {
  name: " Welcome ",
  subject: "Hi {{first_name}}",
  previewText: "",
  htmlContent: '<p>Hi {{first_name}}</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTemplate", () => {
  it("sanitizes HTML, keeps variables, stores a text version, and scopes to the organization", async () => {
    prismaMock.emailTemplate.create.mockResolvedValue({ id: "t1" });
    await createTemplate(ORG, input);

    const { data } = prismaMock.emailTemplate.create.mock.calls[0][0];
    expect(data.organizationId).toBe(ORG);
    expect(data.name).toBe("Welcome");
    expect(data.previewText).toBeNull();
    expect(data.htmlContent).toContain("{{first_name}}");
    expect(data.htmlContent).not.toContain("<script");
    expect(data.htmlContent).not.toContain("onerror");
    expect(data.textContent).toBe("Hi {{first_name}}");
  });
});

describe("updateTemplate", () => {
  it("only updates templates in the caller's organization", async () => {
    prismaMock.emailTemplate.updateMany.mockResolvedValue({ count: 1 });
    await updateTemplate(ORG, "t1", input);
    expect(prismaMock.emailTemplate.updateMany.mock.calls[0][0].where).toEqual({ id: "t1", organizationId: ORG });
  });

  it("throws TemplateNotFoundError for a template in another organization", async () => {
    prismaMock.emailTemplate.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateTemplate(ORG, "other", input)).rejects.toBeInstanceOf(TemplateNotFoundError);
  });
});

describe("deleteTemplate", () => {
  it("refuses to delete a template used by campaigns", async () => {
    prismaMock.campaign.count.mockResolvedValue(2);
    const error = await deleteTemplate(ORG, "t1").catch((e) => e);
    expect(error).toBeInstanceOf(TemplateInUseError);
    expect(error.campaignCount).toBe(2);
    expect(prismaMock.emailTemplate.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an unused template scoped to the organization", async () => {
    prismaMock.campaign.count.mockResolvedValue(0);
    prismaMock.emailTemplate.deleteMany.mockResolvedValue({ count: 1 });
    await deleteTemplate(ORG, "t1");
    expect(prismaMock.emailTemplate.deleteMany).toHaveBeenCalledWith({ where: { id: "t1", organizationId: ORG } });
  });
});

describe("duplicateTemplate", () => {
  it("copies content with a '(Copy)' name that stays within the length limit", async () => {
    prismaMock.emailTemplate.findFirst.mockResolvedValue({
      name: "x".repeat(150),
      subject: "S",
      previewText: "P",
      htmlContent: "<p>Hi</p>",
      textContent: "Hi",
    });
    prismaMock.emailTemplate.create.mockResolvedValue({ id: "t2" });

    await duplicateTemplate(ORG, "t1");

    expect(prismaMock.emailTemplate.findFirst).toHaveBeenCalledWith({ where: { id: "t1", organizationId: ORG } });
    const { data } = prismaMock.emailTemplate.create.mock.calls[0][0];
    expect(data.name).toHaveLength(150);
    expect(data.name.endsWith(" (Copy)")).toBe(true);
    expect(data).toMatchObject({ organizationId: ORG, subject: "S", previewText: "P", htmlContent: "<p>Hi</p>" });
  });

  it("throws TemplateNotFoundError when the source doesn't exist", async () => {
    prismaMock.emailTemplate.findFirst.mockResolvedValue(null);
    await expect(duplicateTemplate(ORG, "missing")).rejects.toBeInstanceOf(TemplateNotFoundError);
  });
});

describe("listTemplates", () => {
  it("scopes search and the recently-updated filter to the organization", async () => {
    prismaMock.emailTemplate.findMany.mockResolvedValue([]);
    await listTemplates({ organizationId: ORG, search: "promo", filter: "recent" });
    const { where } = prismaMock.emailTemplate.findMany.mock.calls[0][0];
    expect(where.organizationId).toBe(ORG);
    expect(where.OR).toHaveLength(2);
    expect(where.updatedAt.gte).toBeInstanceOf(Date);
  });
});

describe("getStarterTemplateHtml", () => {
  it("prefers the company name from Settings over the organization name", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      name: "Org Name",
      settings: { companyName: "Settings Co" },
    });
    const html = await getStarterTemplateHtml(ORG);
    expect(html).toContain("Settings Co");
    expect(html).not.toContain("Org Name");
  });
});
