import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your account and email sending configuration" />
      <EmptyState
        icon={Settings}
        title="Settings coming soon"
        description="Account, email sending, company info, tracking, and unsubscribe settings will appear here."
      />
    </div>
  );
}
