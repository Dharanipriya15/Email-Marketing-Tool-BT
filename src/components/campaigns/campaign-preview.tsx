"use client";

import { useMemo } from "react";
import { renderPersonalizedEmail } from "@/lib/email-render";

type CampaignPreviewProps = {
  subject: string;
  previewText: string | null;
  htmlContent: string;
  sampleData?: Record<string, string> | null;
};

// Read-only rendered preview of a campaign's email (sample personalization).
export function CampaignPreview({ subject, previewText, htmlContent, sampleData }: CampaignPreviewProps) {
  const rendered = useMemo(
    () => renderPersonalizedEmail({ subject, previewText, htmlContent }, sampleData ?? undefined),
    [subject, previewText, htmlContent, sampleData]
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2 text-sm">
        <p className="truncate font-medium">{rendered.subject}</p>
      </div>
      {/* sandbox="" blocks scripts, forms, and navigation inside the preview. */}
      <iframe title="Campaign preview" srcDoc={rendered.html} sandbox="" className="h-[60vh] w-full border-0 bg-white" />
    </div>
  );
}