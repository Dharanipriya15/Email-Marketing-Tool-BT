import Link from "next/link";
import { Building2, KeyRound, Settings, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

function SettingsLink({ href, icon: Icon, title, description }: { href: string; icon: typeof KeyRound; title: string; description: string }) {
  return (
    <Link href={href} className="flex max-w-lg items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted">
      <Icon className="size-5 text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const admin = isAdminRole(user.role);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your account and email sending configuration" />
      <div className="flex flex-col gap-3">
        <SettingsLink href="/settings/password" icon={KeyRound} title="Change password" description="Update the password you use to sign in" />
        {admin && (
          <SettingsLink
            href="/settings/company"
            icon={Building2}
            title="Company"
            description="Company name, mailing address and footer text for campaign emails"
          />
        )}
        {admin && (
          <SettingsLink
            href="/settings/suppressions"
            icon={ShieldOff}
            title="Suppression list"
            description="Addresses that will never receive campaign email"
          />
        )}
      </div>
      <EmptyState
        icon={Settings}
        title="More settings coming soon"
        description="Email sending, tracking, and team settings will appear here."
      />
    </div>
  );
}
