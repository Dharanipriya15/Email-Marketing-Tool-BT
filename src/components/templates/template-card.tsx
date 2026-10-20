"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Copy, Eye, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TemplatePreviewDialog } from "@/components/templates/template-preview-dialog";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { deleteTemplateAction, duplicateTemplateAction } from "@/app/(app)/templates/actions";
import type { EmailTemplate } from "@prisma/client";

type TemplateCardProps = {
  template: Pick<
    EmailTemplate,
    "id" | "name" | "subject" | "previewText" | "htmlContent" | "createdAt" | "updatedAt"
  >;
};

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDuplicating, startDuplicate] = useTransition();
  const editHref = `/templates/${template.id}`;

  function handleDuplicate() {
    startDuplicate(async () => {
      const result = await duplicateTemplateAction(template.id);
      if (result.success) {
        toast.success("Template duplicated", {
          action: { label: "Edit copy", onClick: () => router.push(`/templates/${result.data.id}`) },
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleDelete() {
    const result = await deleteTemplateAction(template.id);
    if (result.success) {
      toast.success(`"${template.name}" deleted`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <Link href={editHref} aria-label={`Edit ${template.name}`} className="block">
        <TemplateThumbnail subject={template.subject} html={template.htmlContent} />
      </Link>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={editHref} className="block truncate text-sm font-semibold hover:underline">
              {template.name}
            </Link>
            <p className="truncate text-sm text-muted-foreground" title={template.subject}>
              {template.subject}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${template.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={editHref}>
                  <Pencil />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
                <Eye />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDuplicate} disabled={isDuplicating}>
                <Copy />
                {isDuplicating ? "Duplicating..." : "Duplicate"}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/campaigns?templateId=${template.id}`}>
                  <Send />
                  Use in Campaign
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(template.updatedAt, { addSuffix: true })}
          <span aria-hidden="true"> · </span>
          Created {format(template.createdAt, "MMM d, yyyy")}
        </p>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={editHref}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewOpen(true)}>
            <Eye />
            Preview
          </Button>
        </div>
      </div>

      <TemplatePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={template.subject}
        previewText={template.previewText}
        htmlContent={template.htmlContent}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this template?"
        description={`"${template.name}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete Template"
        onConfirm={handleDelete}
      />
    </Card>
  );
}
