import { PageHeader } from "@/components/shared/page-header";
import { requireAdminPage } from "@/lib/auth";
import { getCompanySettings } from "@/services/settings-service";
import { CompanySettingsForm } from "./company-settings-form";

export default async function CompanySettingsPage() {
  const user = await requireAdminPage();
  const settings = await getCompanySettings(user.organizationId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Company"
        description="Sender identity shown in the footer of every campaign email"
      />
      <CompanySettingsForm
        defaultValues={{
          companyName: settings.companyName ?? "",
          companyAddress: settings.companyAddress ?? "",
          unsubscribeFooterText: settings.unsubscribeFooterText ?? "",
        }}
      />
    </div>
  );
}
