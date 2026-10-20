"use client";

import { useMemo } from "react";
import { Monitor, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { renderPersonalizedEmail } from "@/lib/email-render";
import { applyPersonalization } from "@/lib/personalization";

type TemplatePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  previewText?: string | null;
  htmlContent: string;
};

const MOBILE_WIDTH_PX = 375;

function PreviewFrame({ title, html }: { title: string; html: string }) {
  // sandbox="" blocks scripts, forms, and navigation inside the preview.
  return <iframe title={title} srcDoc={html} sandbox="" className="h-full w-full border-0 bg-white" />;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  subject,
  previewText,
  htmlContent,
}: TemplatePreviewDialogProps) {
  const rendered = useMemo(
    () => renderPersonalizedEmail({ subject, previewText, htmlContent }),
    [subject, previewText, htmlContent]
  );
  const personalizedPreviewText = previewText ? applyPersonalization(previewText) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>
            Personalization variables are shown with sample contact details.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="truncate font-medium">{rendered.subject || "(No subject)"}</p>
          {personalizedPreviewText && (
            <p className="truncate text-muted-foreground">{personalizedPreviewText}</p>
          )}
        </div>

        <Tabs defaultValue="desktop" className="min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="desktop">
              <Monitor />
              Desktop
            </TabsTrigger>
            <TabsTrigger value="mobile">
              <Smartphone />
              Mobile
            </TabsTrigger>
          </TabsList>
          <TabsContent value="desktop" className="h-[60vh] overflow-hidden rounded-lg border">
            <PreviewFrame title="Desktop preview" html={rendered.html} />
          </TabsContent>
          <TabsContent value="mobile" className="h-[60vh] rounded-lg bg-muted/40 py-4">
            <div
              className="mx-auto h-full max-w-full overflow-hidden rounded-2xl border-4 border-foreground/80 shadow-sm"
              style={{ width: MOBILE_WIDTH_PX + 8 }}
            >
              <PreviewFrame title="Mobile preview" html={rendered.html} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
