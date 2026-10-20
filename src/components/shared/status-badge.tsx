import type { CampaignStatus, ContactStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "destructive";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  destructive: "border-red-200 bg-red-50 text-red-700",
};

const dotClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-red-500",
};

// Status is always conveyed by the label text as well as color, so this
// remains legible for colorblind users and doesn't rely on color alone.
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", toneClasses[tone])}>
      <span className={cn("size-1.5 rounded-full", dotClasses[tone])} />
      {label}
    </Badge>
  );
}

const contactStatusMeta: Record<ContactStatus, { label: string; tone: StatusTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  UNSUBSCRIBED: { label: "Unsubscribed", tone: "neutral" },
  BOUNCED: { label: "Bounced", tone: "destructive" },
  SUPPRESSED: { label: "Suppressed", tone: "warning" },
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const meta = contactStatusMeta[status];
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}

const campaignStatusMeta: Record<CampaignStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  SENDING: { label: "Sending", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  PAUSED: { label: "Paused", tone: "warning" },
  FAILED: { label: "Failed", tone: "destructive" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const meta = campaignStatusMeta[status];
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}
