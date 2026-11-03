import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportCampaignRecipientsCsv, getCampaignReportSummary, parseRecipientStatus } from "@/services/campaign-report-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const summary = await getCampaignReportSummary(user.organizationId, id);
  if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = parseRecipientStatus(new URL(request.url).searchParams.get("status") ?? undefined);
  const csv = await exportCampaignRecipientsCsv(user.organizationId, id, status);
  const safeName = summary.campaign.name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "campaign";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-recipients${status ? `-${status.toLowerCase()}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
