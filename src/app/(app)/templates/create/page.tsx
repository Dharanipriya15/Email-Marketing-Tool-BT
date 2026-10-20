import { requireUser } from "@/lib/auth";
import { TemplateEditorForm } from "@/components/templates/template-editor-form";
import { getStarterTemplateHtml } from "@/services/template-service";
import { isEmailProviderConfigured } from "@/services/email/provider";

export default async function CreateTemplatePage() {
  const user = await requireUser();
  const starterHtml = await getStarterTemplateHtml(user.organizationId);

  return (
    <TemplateEditorForm
      title="Create Template"
      description="Start from the layout below and make it your own."
      defaultValues={{ name: "", subject: "", previewText: "", htmlContent: starterHtml }}
      emailConfigured={isEmailProviderConfigured()}
      userEmail={user.email}
    />
  );
}
