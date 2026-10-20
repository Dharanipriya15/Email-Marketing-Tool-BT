import Link from "next/link";
import { format } from "date-fns";
import { BarChart3, UserMinus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReport, parseReportRange, type ReportRange } from "@/services/report-service";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const RANGE_LABELS: Record<ReportRange, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

function formatRate(rate: number | null): string {
  return rate === null ? "\u2014" : `${rate.toFixed(1)}%`;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const range = parseReportRange(params.range);
  const report = await getReport(user.organizationId, range);
  const { overview } = report;
  const n = (value: number) => value.toLocaleString();
  const byStatus = Object.entries(overview.campaignsByStatus)
    .map(([status, count]) => `${count} ${status.toLowerCase()}`)
    .join(", ");
  const tracking = "Tracking coming soon";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Track campaign delivery and unsubscribes"
        actions={(Object.keys(RANGE_LABELS) as ReportRange[]).map((value) => (
          <Button key={value} asChild size="sm" variant={value === range ? "default" : "outline"}>
            <Link href={value === "all" ? "/reports" : `/reports?range=${value}`}>{RANGE_LABELS[value]}</Link>
          </Button>
        ))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Campaigns" value={n(overview.totalCampaigns)} hint={byStatus || "None in this period"} />
        <StatTile label="Total recipients" value={n(overview.totalRecipients)} />
        <StatTile label="Sent" value={n(overview.recipients.sent)} hint={`${n(overview.recipients.pending)} pending`} />
        <StatTile label="Delivery rate" value={formatRate(overview.deliveryRate)} hint="Sent / attempted" />
        <StatTile label="Failed" value={n(overview.recipients.failed)} />
        <StatTile label="Suppressed / skipped" value={n(overview.recipients.skipped)} />
        <StatTile
          label="Unsubscribes"
          value={n(overview.unsubscribesInRange)}
          hint={`${n(overview.unsubscribesLast30Days)} in last 30 days / ${n(overview.unsubscribesAllTime)} all time`}
        />
        <StatTile label="Active contacts" value={n(overview.activeContacts)} />
        <StatTile label="Opened" value={n(overview.opened)} hint={tracking} />
        <StatTile label="Clicked" value={n(overview.clicked)} hint={tracking} />
        <StatTile label="Bounced" value={n(overview.bounced)} hint={tracking} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        {report.campaigns.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No campaign data yet"
            description="Results will appear here once campaigns are sent."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent date</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Unsubscribes</TableHead>
                  <TableHead className="text-right">Delivery rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.campaigns.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xs">
                      <Link href={`/campaigns/${row.id}`} className="block truncate font-medium hover:underline">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CampaignStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.sentAt ? format(row.sentAt, "MMM d, yyyy h:mm a") : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{n(row.totalRecipients)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(row.sent)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", row.failed > 0 && "text-destructive")}>
                      {n(row.failed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{n(row.skipped)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(row.unsubscribes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRate(row.deliveryRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent unsubscribes</h2>
        {report.recentUnsubscribes.length === 0 ? (
          <EmptyState icon={UserMinus} title="No unsubscribes" description="Nobody has unsubscribed in this period." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.recentUnsubscribes.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.email}</TableCell>
                    <TableCell className="text-muted-foreground">{format(row.createdAt, "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell>
                      {row.campaignId && row.campaignName ? (
                        <Link href={`/campaigns/${row.campaignId}`} className="hover:underline">
                          {row.campaignName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}