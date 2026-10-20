import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { TemplateEditorForm } from "@/components/templates/template-editor-form";
import { getTemplate } from "@/services/template-service";
import { isEmailProviderConfigured } from "@/services/email/provider";

type EditTemplatePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const user = await requireUser();
  const { id } = await params;

  const template = await getTemplate(user.organizationId, id);
  if (!template) {
    notFound();
  }

  return (
    <TemplateEditorForm
      // Remount on navigation between templates so the editor reloads content.
      key={template.id}
      title={template.name}
      description="Edit this email template."
      templateId={template.id}
      defaultValues={{
        name: template.name,
        subject: template.subject,
        previewText: template.previewText ?? "",
        htmlContent: template.htmlContent,
      }}
      emailConfigured={isEmailProviderConfigured()}
      userEmail={user.email}
    />
  );
}
