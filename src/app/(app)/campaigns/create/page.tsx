import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { listContactLists } from "@/services/contact-list-service";
import { listTemplates } from "@/services/template-service";
import { getSendingReadiness } from "@/services/email/provider";

type CreateCampaignPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateCampaignPage({ searchParams }: CreateCampaignPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const [lists, templates] = await Promise.all([
    listContactLists(user.organizationId),
    listTemplates({ organizationId: user.organizationId }),
  ]);

  // Prefill from "Use in Campaign" only when the template belongs to this organization.
  const prefill =
    typeof params.templateId === "string" ? templates.find((t) => t.id === params.templateId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Create Campaign" description="Set up the details, audience, and content." />
      <CampaignWizard
        sendReadiness={getSendingReadiness()}
        defaultValues={{
          name: "",
          subject: prefill?.subject ?? "",
          contactListId: "",
          templateId: prefill?.id ?? "",
        }}
        lists={lists.map(({ id, name, contactCount }) => ({ id, name, contactCount }))}
        templates={templates.map(({ id, name, subject, previewText, htmlContent }) => ({
          id,
          name,
          subject,
          previewText,
          htmlContent,
        }))}
      />
    </div>
  );
}