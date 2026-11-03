import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Change password" description="Update the password for your account" />
      <ChangePasswordForm />
    </div>
  );
}