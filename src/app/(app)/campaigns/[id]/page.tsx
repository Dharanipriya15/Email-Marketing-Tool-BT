import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { CampaignStatusBadge } from "@/components/shared/status-badge";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { CampaignDetailActions } from "@/components/campaigns/campaign-detail-actions";
import { CampaignPreview } from "@/components/campaigns/campaign-preview";
import { getAudienceInfo, getCampaign } from "@/services/campaign-service";
import { listContactLists } from "@/services/contact-list-service";
import { listTemplates } from "@/services/template-service";
import { getSendingReadiness } from "@/services/email/provider";
import { getCampaignProgress } from "@/services/campaign-send-service";
import { CampaignSendingPanel } from "@/components/campaigns/campaign-sending-panel";

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const campaign = await getCampaign(user.organizationId, id);
  if (!campaign) {
    notFound();
  }

  const isDraft = campaign.status === "DRAFT";
  const deletable = (isDraft || campaign.status === "SCHEDULED") && !campaign.sentAt && campaign.totalSent === 0;
  const audience = campaign.contactListId
    ? await getAudienceInfo(user.organizationId, campaign.contactListId)
    : null;

  const sendReadiness = getSendingReadiness();

  const header = (
    <PageHeader
      title={campaign.name}
      description={`Created ${format(campaign.createdAt, "MMM d, yyyy")}`}
      actions={
        <CampaignDetailActions
          campaignId={campaign.id}
          campaignName={campaign.name}
          status={campaign.status}
          deletable={deletable}
          sendReadiness={sendReadiness}
          recipientCount={audience?.eligibleRecipients ?? null}
        />
      }
    />
  );

  if (isDraft) {
    const [lists, templates] = await Promise.all([
      listContactLists(user.organizationId),
      listTemplates({ organizationId: user.organizationId }),
    ]);

    return (
      <div className="flex flex-col gap-6">
        {header}
        <div>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        <CampaignWizard
          key={campaign.id}
          campaignId={campaign.id}
          defaultValues={{
            name: campaign.name,
            subject: campaign.subject,
            contactListId: campaign.contactListId ?? "",
            templateId: campaign.templateId ?? "",
          }}
          initialAudience={audience}
          sendReadiness={sendReadiness}
          lists={lists.map((list) => ({ id: list.id, name: list.name, contactCount: list.contactCount }))}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            previewText: t.previewText,
            htmlContent: t.htmlContent,
          }))}
        />
      </div>
    );
  }

  const notSent = campaign.status === "SCHEDULED";
  const showSending = campaign.status === "SENDING" || campaign.status === "PAUSED";
  const progress = showSending ? await getCampaignProgress(user.organizationId, campaign.id) : null;

  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <CampaignStatusBadge status={campaign.status} />
        {campaign.scheduledAt && <span>Scheduled for {format(campaign.scheduledAt, "MMM d, yyyy h:mm a")}</span>}
        {campaign.sentAt && <span>Sent {format(campaign.sentAt, "MMM d, yyyy h:mm a")}</span>}
      </div>
      {notSent && (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Scheduled campaigns can&apos;t be edited. Unschedule to make changes. It is sent automatically by the
          dispatcher (/api/cron/dispatch) once the scheduled time passes and sending is enabled.
        </p>
      )}

      {progress && (
        <CampaignSendingPanel
          campaignId={campaign.id}
          status={campaign.status}
          progress={progress}
          sendingReady={sendReadiness.ready}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {notSent ? (
          <Stat label="Eligible recipients" value={(audience?.eligibleRecipients ?? 0).toLocaleString()} />
        ) : (
          <Stat label="Recipients" value={campaign.totalRecipients.toLocaleString()} />
        )}
        <Stat label="Sent" value={campaign.totalSent.toLocaleString()} />
        <Stat label="Opened" value={campaign.totalOpened.toLocaleString()} />
        <Stat label="Clicked" value={campaign.totalClicked.toLocaleString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <dl className="grid content-start gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="font-medium break-words">{campaign.subject}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Audience</dt>
            <dd className="font-medium">{campaign.contactList?.name ?? "\u2014"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Template</dt>
            <dd className="font-medium">{campaign.template?.name ?? "\u2014"}</dd>
          </div>
        </dl>
        {campaign.template ? (
          <CampaignPreview
            subject={campaign.subject}
            previewText={campaign.template.previewText}
            htmlContent={campaign.template.htmlContent}
            sampleData={audience?.sampleData}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No template selected.</p>
        )}
      </div>
    </div>
  );
}