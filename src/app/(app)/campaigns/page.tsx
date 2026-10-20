import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { listCampaigns } from "@/services/campaign-service";

type CampaignsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  // "Use in Campaign" on a template card links here with ?templateId=.
  if (typeof params.templateId === "string" && params.templateId) {
    redirect(`/campaigns/create?templateId=${encodeURIComponent(params.templateId)}`);
  }

  const campaigns = await listCampaigns(user.organizationId);

  const createButton = (
    <Button asChild>
      <Link href="/campaigns/create">
        <Plus />
        Create Campaign
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="Create and schedule email campaigns"
        actions={campaigns.length > 0 ? createButton : undefined}
      />
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No campaigns yet"
          description="Pick a list and a template to build your first campaign."
          action={createButton}
        />
      ) : (
        <CampaignsTable campaigns={campaigns} />
      )}
    </div>
  );
}