import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignStatusBadge } from "@/components/shared/status-badge";
import type { RecentCampaign } from "@/services/dashboard-service";

export function RecentCampaignsTable({ campaigns }: { campaigns: RecentCampaign[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Campaigns</CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No campaigns yet"
            description="Campaigns you create will show up here with their performance."
            className="border-0 py-10"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.totalRecipients.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.totalSent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.openRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.clickRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDistanceToNow(campaign.createdAt, { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
