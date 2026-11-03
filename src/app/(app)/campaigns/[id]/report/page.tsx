import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";
import type { CampaignRecipientStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { SimplePager } from "@/components/shared/simple-pager";
import { CampaignStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RECIPIENT_STATUSES,
  getCampaignReportSummary,
  listCampaignRecipients,
  parseRecipientStatus,
} from "@/services/campaign-report-service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const fmt = (d: Date | null) => (d ? format(d, "MMM d, h:mm a") : "\u2014");
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "\u2014");

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function latestActivity(r: { sentAt: Date | null; deliveredAt: Date | null; openedAt: Date | null; clickedAt: Date | null; bouncedAt: Date | null; failedAt: Date | null; unsubscribedAt: Date | null }) {
  const dates = [r.clickedAt, r.openedAt, r.deliveredAt, r.bouncedAt, r.failedAt, r.unsubscribedAt, r.sentAt].filter(Boolean) as Date[];
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}

export default async function CampaignReportPage({ params, searchParams }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const summary = await getCampaignReportSummary(user.organizationId, id);
  if (!summary) notFound();

  const status = parseRecipientStatus(first(query.status));
  const page = Math.max(1, Number(first(query.page)) || 1);
  const { rows, total, pageSize } = await listCampaignRecipients({ organizationId: user.organizationId, campaignId: id, status, page });
  const { campaign, byStatus, complaints } = summary;
  const delivered = campaign.totalDelivered;
  const sent = campaign.totalSent;
  const basePath = `/campaigns/${id}/report`;
  const exportHref = `${basePath}/export${status ? `?status=${status}` : ""}`;
  const statusesWithRows = RECIPIENT_STATUSES.filter((s) => (byStatus[s] ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Report: ${campaign.name}`}
        description={campaign.subject}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/campaigns/${id}`}>
                <ArrowLeft />
                Back to campaign
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={exportHref}>
                <Download />
                Export CSV
              </a>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <CampaignStatusBadge status={campaign.status} />
        {campaign.sentAt && <span>Started {format(campaign.sentAt, "MMM d, yyyy h:mm a")}</span>}
        {campaign.completedAt && <span>Finished {format(campaign.completedAt, "MMM d, yyyy h:mm a")}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Recipients" value={campaign.totalRecipients} />
        <Stat label="Sent" value={sent} />
        <Stat label="Delivered" value={delivered} hint={pct(delivered, sent)} />
        <Stat label="Unique opens" value={campaign.totalOpened} hint={pct(campaign.totalOpened, delivered || sent)} />
        <Stat label="Unique clicks" value={campaign.totalClicked} hint={pct(campaign.totalClicked, delivered || sent)} />
        <Stat label="Bounced" value={campaign.totalBounced} hint={pct(campaign.totalBounced, sent)} />
        <Stat label="Failed" value={campaign.totalFailed} />
        <Stat label="Unsubscribed" value={campaign.totalUnsubscribed} />
        <Stat label="Complaints" value={complaints} />
      </div>
      <p className="text-xs text-muted-foreground">
        Opens are approximate: some email apps block or pre-load tracking images. Delivered counts need SES delivery
        notifications to be configured.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          href={basePath}
          className={cn("rounded-full border px-3 py-1 text-xs", !status ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          All ({campaign.totalRecipients.toLocaleString()})
        </Link>
        {statusesWithRows.map((s: CampaignRecipientStatus) => (
          <Link
            key={s}
            href={`${basePath}?status=${s}`}
            className={cn("rounded-full border px-3 py-1 text-xs", status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {label(s)} ({(byStatus[s] ?? 0).toLocaleString()})
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Clicked</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Error / note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No recipients{status ? ` with status ${label(status)}` : ""}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "\u2014"}</TableCell>
                  <TableCell>{label(r.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(r.sentAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(r.openedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(r.clickedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(latestActivity(r))}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={r.lastError ?? undefined}>
                    {r.lastError ?? "\u2014"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <SimplePager basePath={basePath} params={{ status }} page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
