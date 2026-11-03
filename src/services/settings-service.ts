import { prisma } from "@/db/client";
import type { CompanySettingsData } from "@/schemas/company-settings";

export type CompanySettings = {
  companyName: string | null;
  companyAddress: string | null;
  unsubscribeFooterText: string | null;
};

export async function getCompanySettings(organizationId: string): Promise<CompanySettings> {
  const settings = await prisma.settings.findUnique({
    where: { organizationId },
    select: { companyName: true, companyAddress: true, unsubscribeFooterText: true },
  });
  return {
    companyName: settings?.companyName ?? null,
    companyAddress: settings?.companyAddress ?? null,
    unsubscribeFooterText: settings?.unsubscribeFooterText ?? null,
  };
}

export async function updateCompanySettings(organizationId: string, data: CompanySettingsData): Promise<void> {
  await prisma.settings.upsert({
    where: { organizationId },
    update: data,
    create: { organizationId, ...data },
  });
}

// Every campaign email carries the company's postal address in its footer,
// so a campaign may not be scheduled or started without one.
export async function hasCompanyAddress(organizationId: string): Promise<boolean> {
  const settings = await prisma.settings.findUnique({
    where: { organizationId },
    select: { companyAddress: true },
  });
  return Boolean(settings?.companyAddress?.trim());
}

export class CompanyAddressMissingError extends Error {
  constructor() {
    super("Company mailing address is not set.");
  }
}

export async function assertCompanyAddress(organizationId: string): Promise<void> {
  if (!(await hasCompanyAddress(organizationId))) throw new CompanyAddressMissingError();
}

export const MISSING_COMPANY_ADDRESS_ERROR =
  "Add your company's mailing address in Settings → Company before sending or scheduling a campaign. It's legally required in the email footer.";
