import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardStats } from "@/services/dashboard-service";

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Total Contacts" value={formatCompactNumber(stats.totalContacts)} />
      <StatTile label="Campaigns" value={formatCompactNumber(stats.totalCampaigns)} />
      <StatTile label="Emails Sent" value={formatCompactNumber(stats.emailsSent)} />
      <StatTile
        label="Average Open Rate"
        value={`${stats.averageOpenRate.toFixed(1)}%`}
      />
    </div>
  );
}
