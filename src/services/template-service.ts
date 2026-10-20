import { prisma } from "@/db/client";
import type { Prisma } from "@prisma/client";
import { sanitizeEmailHtml } from "@/lib/email-sanitize";
import { htmlToPlainText } from "@/lib/email-text";
import { buildStarterTemplateHtml } from "@/lib/starter-template";
import type { TemplateFormInput } from "@/schemas/template";

const RECENTLY_UPDATED_DAYS = 7;
const MAX_NAME_LENGTH = 150;
const COPY_SUFFIX = " (Copy)";

export type TemplateFilter = "all" | "recent";

export type ListTemplatesParams = {
  organizationId: string;
  search?: string;
  filter?: TemplateFilter;
};

export class TemplateNotFoundError extends Error {
  constructor() {
    super("Template not found.");
  }
}

export class TemplateInUseError extends Error {
  constructor(public readonly campaignCount: number) {
    super("Template is used by one or more campaigns.");
  }
}

export async function listTemplates(params: ListTemplatesParams) {
  const { organizationId, search, filter } = params;

  const where: Prisma.EmailTemplateWhereInput = { organizationId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
    ];
  }

  if (filter === "recent") {
    const since = new Date();
    since.setDate(since.getDate() - RECENTLY_UPDATED_DAYS);
    where.updatedAt = { gte: since };
  }

  return prisma.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getTemplate(organizationId: string, id: string) {
  return prisma.emailTemplate.findFirst({ where: { id, organizationId } });
}

export async function getTemplateCount(organizationId: string): Promise<number> {
  return prisma.emailTemplate.count({ where: { organizationId } });
}

// Starter content for new templates, personalized with the organization's
// own company name (from Settings, falling back to the organization name).
export async function getStarterTemplateHtml(organizationId: string): Promise<string> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, settings: { select: { companyName: true } } },
  });
  return buildStarterTemplateHtml({
    companyName: organization?.settings?.companyName ?? organization?.name,
  });
}

function normalizeInput(input: TemplateFormInput) {
  const htmlContent = sanitizeEmailHtml(input.htmlContent);
  return {
    name: input.name.trim(),
    subject: input.subject.trim(),
    previewText: input.previewText?.trim() || null,
    htmlContent,
    textContent: htmlToPlainText(htmlContent),
  };
}

export async function createTemplate(organizationId: string, input: TemplateFormInput) {
  return prisma.emailTemplate.create({
    data: { organizationId, ...normalizeInput(input) },
  });
}

export async function updateTemplate(
  organizationId: string,
  id: string,
  input: TemplateFormInput
) {
  const result = await prisma.emailTemplate.updateMany({
    where: { id, organizationId },
    data: normalizeInput(input),
  });
  if (result.count === 0) {
    throw new TemplateNotFoundError();
  }
}

// Campaigns keep a reference to their template (onDelete: Restrict), so a
// template that is in use cannot be deleted. Checked up front to give the
// user a clear explanation instead of a database constraint error.
export async function deleteTemplate(organizationId: string, id: string) {
  const campaignCount = await prisma.campaign.count({
    where: { organizationId, templateId: id },
  });
  if (campaignCount > 0) {
    throw new TemplateInUseError(campaignCount);
  }

  const result = await prisma.emailTemplate.deleteMany({ where: { id, organizationId } });
  if (result.count === 0) {
    throw new TemplateNotFoundError();
  }
}

export async function duplicateTemplate(organizationId: string, id: string) {
  const original = await prisma.emailTemplate.findFirst({ where: { id, organizationId } });
  if (!original) {
    throw new TemplateNotFoundError();
  }

  const baseName = original.name.slice(0, MAX_NAME_LENGTH - COPY_SUFFIX.length);

  return prisma.emailTemplate.create({
    data: {
      organizationId,
      name: `${baseName}${COPY_SUFFIX}`,
      subject: original.subject,
      previewText: original.previewText,
      htmlContent: original.htmlContent,
      textContent: original.textContent,
    },
  });
}
