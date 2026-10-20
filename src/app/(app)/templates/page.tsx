import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplatesFilterBar } from "@/components/templates/templates-filter-bar";
import { listTemplates, getTemplateCount, type TemplateFilter } from "@/services/template-service";

type TemplatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const search = firstParam(params.q);
  const filterParam = firstParam(params.filter);
  const filter: TemplateFilter = filterParam === "recent" ? "recent" : "all";

  const [templates, totalTemplates] = await Promise.all([
    listTemplates({ organizationId: user.organizationId, search, filter }),
    getTemplateCount(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email Templates"
        description="Create and manage reusable email templates for your campaigns."
        actions={
          <Button asChild>
            <Link href="/templates/create">
              <Plus />
              Create Template
            </Link>
          </Button>
        }
      />

      {totalTemplates === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create your first email template to reuse across campaigns."
          action={
            <Button asChild>
              <Link href="/templates/create">
                <Plus />
                Create Template
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <TemplatesFilterBar />
          {templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates match your search"
              description="Try a different search term or clear the filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
