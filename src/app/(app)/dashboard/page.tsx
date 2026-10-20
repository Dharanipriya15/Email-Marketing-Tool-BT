import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RecentCampaignsTable } from "@/components/dashboard/recent-campaigns-table";
import { CampaignPerformanceChart } from "@/components/dashboard/campaign-performance-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import {
  getDashboardStats,
  getRecentCampaigns,
  getCampaignPerformance,
  getRecentActivity,
} from "@/services/dashboard-service";

export default async function DashboardPage() {
  const user = await requireUser();

  const [stats, recentCampaigns, performance, activity] = await Promise.all([
    getDashboardStats(user.organizationId),
    getRecentCampaigns(user.organizationId),
    getCampaignPerformance(user.organizationId),
    getRecentActivity(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${user.name}`}
        description="Here's what's happening with your email campaigns."
      />

      <KpiCards stats={stats} />

      <RecentCampaignsTable campaigns={recentCampaigns} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CampaignPerformanceChart data={performance} />
        <RecentActivity items={activity} />
      </div>
    </div>
  );
}
