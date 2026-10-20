"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Save, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SendNowDialog } from "@/components/campaigns/send-now-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { renderPersonalizedEmail } from "@/lib/email-render";
import { SAMPLE_PERSONALIZATION_DATA, applyPersonalization } from "@/lib/personalization";
import { campaignFormSchema } from "@/schemas/campaign";
import {
  createCampaignAction,
  getAudienceInfoAction,
  scheduleCampaignAction,
  sendCampaignNowAction,
  updateCampaignAction,
} from "@/app/(app)/campaigns/actions";
import type { AudienceInfo } from "@/services/campaign-service";
import type { SendingReadiness } from "@/services/email/provider";

export type WizardList = { id: string; name: string; contactCount: number };
export type WizardTemplate = {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  htmlContent: string;
};

export type CampaignWizardValues = {
  name: string;
  subject: string;
  contactListId: string;
  templateId: string;
};

type CampaignWizardProps = {
  campaignId?: string;
  defaultValues: CampaignWizardValues;
  lists: WizardList[];
  templates: WizardTemplate[];
  // Audience info for the preselected list, loaded on the server.
  initialAudience?: AudienceInfo | null;
  // Whether real sending is allowed (provider configured + kill switch on).
  sendReadiness: SendingReadiness;
};

const STEPS = ["Details", "Audience", "Template", "Review"] as const;

function PreviewFrame({
  title,
  html,
  className,
  tabIndex,
}: {
  title: string;
  html: string;
  className?: string;
  tabIndex?: number;
}) {
  // sandbox="" blocks scripts, forms, and navigation inside the preview.
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox=""
      tabIndex={tabIndex}
      className={cn("w-full border-0 bg-white", className)}
    />
  );
}

export function CampaignWizard({
  campaignId,
  defaultValues,
  lists,
  templates,
  initialAudience = null,
  sendReadiness,
}: CampaignWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<CampaignWizardValues>(defaultValues);
  const [savedId, setSavedId] = useState<string | undefined>(campaignId);
  const [audience, setAudience] = useState<AudienceInfo | null>(initialAudience);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [isPending, setIsPending] = useState(false);

  const selectedList = lists.find((list) => list.id === values.contactListId);
  const selectedTemplate = templates.find((template) => template.id === values.templateId);

  // Guards against out-of-order responses when the list changes quickly.
  const latestListRequest = useRef<string>("");

  async function loadAudience(contactListId: string) {
    latestListRequest.current = contactListId;
    if (!contactListId) {
      setAudience(null);
      return;
    }
    setAudienceLoading(true);
    const result = await getAudienceInfoAction(contactListId);
    if (latestListRequest.current !== contactListId) return;
    setAudienceLoading(false);
    if (result.success) {
      setAudience(result.data);
    } else {
      setAudience(null);
      toast.error(result.error);
    }
  }

  const previewData = audience?.sampleData ?? SAMPLE_PERSONALIZATION_DATA;
  const rendered = useMemo(() => {
    if (!selectedTemplate) return null;
    return renderPersonalizedEmail(
      {
        subject: values.subject || selectedTemplate.subject,
        previewText: selectedTemplate.previewText,
        htmlContent: selectedTemplate.htmlContent,
      },
      previewData
    );
  }, [selectedTemplate, values.subject, previewData]);

  function update<K extends keyof CampaignWizardValues>(key: K, value: CampaignWizardValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function selectTemplate(template: WizardTemplate) {
    setValues((current) => ({
      ...current,
      templateId: template.id,
      // Start from the template's subject line if the user hasn't written one.
      subject: current.subject.trim() ? current.subject : template.subject,
    }));
  }

  function stepError(index: number): string | null {
    if (index === 0) {
      const parsed = campaignFormSchema.safeParse(values);
      return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Check the campaign details");
    }
    if (index === 1 && !values.contactListId) return "Choose a contact list";
    if (index === 2 && !values.templateId) return "Choose a template";
    return null;
  }

  // Validates every step before `index`; jumps to the first invalid one.
  function validateUpTo(index: number): boolean {
    for (let i = 0; i < index; i++) {
      const error = stepError(i);
      if (error) {
        setStep(i);
        toast.error(error);
        return false;
      }
    }
    return true;
  }

  function goNext() {
    const error = stepError(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goToStep(index: number) {
    if (index <= step || validateUpTo(index)) {
      setStep(index);
    }
  }

  async function persist(): Promise<string | null> {
    const parsed = campaignFormSchema.safeParse(values);
    if (!parsed.success) {
      setStep(0);
      toast.error(parsed.error.issues[0]?.message ?? "Check the campaign details");
      return null;
    }
    if (savedId) {
      const result = await updateCampaignAction(savedId, values);
      if (!result.success) {
        toast.error(result.error);
        return null;
      }
      return savedId;
    }
    const result = await createCampaignAction(values);
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    setSavedId(result.data.id);
    return result.data.id;
  }

  async function handleSaveDraft() {
    setIsPending(true);
    try {
      const id = await persist();
      if (!id) return;
      toast.success("Draft saved");
      if (!campaignId) {
        router.push(`/campaigns/${id}`);
      } else {
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  // Saves the campaign and marks it SCHEDULED. Nothing is sent from here.
  async function handleSchedule() {
    if (!validateUpTo(STEPS.length - 1)) return;
    const date = scheduledAt ? new Date(scheduledAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
      toast.error("Choose a date and time to schedule");
      return;
    }

    setIsPending(true);
    try {
      const id = await persist();
      if (!id) return;
      const result = await scheduleCampaignAction(id, { scheduledAt: date.toISOString() });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Campaign scheduled");
      router.push(`/campaigns/${id}`);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  // Saves the latest edits, then prepares recipients and sends the first batch.
  async function handleSendNow(): Promise<boolean> {
    if (!validateUpTo(STEPS.length - 1)) return false;
    const id = await persist();
    if (!id) return false;
    const result = await sendCampaignNowAction(id, "SEND");
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(
      `Sending started: ${result.data.sent} sent, ${result.data.remaining} remaining${result.data.skipped ? `, ${result.data.skipped} skipped` : ""}.`
    );
    router.push(`/campaigns/${id}`);
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToStep(index)}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                index === step
                  ? "border-primary bg-primary text-primary-foreground"
                  : index < step
                    ? "border-primary/40 text-foreground hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-background/20 text-xs tabular-nums">
                {index < step ? <Check className="size-3" /> : index + 1}
              </span>
              {label}
            </button>
            {index < STEPS.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border p-6">
        {step === 0 && (
          <div className="grid max-w-xl gap-5">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={values.name}
                maxLength={150}
                placeholder="e.g. October Newsletter"
                onChange={(event) => update("name", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Internal name, not shown to recipients.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-subject">Subject line</Label>
              <Input
                id="campaign-subject"
                value={values.subject}
                maxLength={200}
                placeholder="e.g. Hi {{first_name}}, here's what's new"
                onChange={(event) => update("subject", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Supports personalization like {"{{first_name}}"}. Preview text comes from the selected template.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid max-w-xl gap-5">
            <div className="grid gap-2">
              <Label htmlFor="campaign-list">Contact list</Label>
              {lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have any contact lists yet. Create a list and add contacts before scheduling.
                </p>
              ) : (
                <Select
                  value={values.contactListId}
                  onValueChange={(value) => {
                    update("contactListId", value);
                    void loadAudience(value);
                  }}
                >
                  <SelectTrigger id="campaign-list" className="w-full">
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.contactCount.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {values.contactListId && (
              <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4 text-sm">
                <Users className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {audienceLoading
                      ? "Counting eligible recipients..."
                      : `${(audience?.eligibleRecipients ?? 0).toLocaleString()} eligible recipients`}
                  </p>
                  <p className="text-muted-foreground">
                    Only active contacts are included. Unsubscribed, bounced, and suppressed addresses are excluded.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">You don&apos;t have any templates yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const selected = template.id === values.templateId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template)}
                      aria-pressed={selected}
                      className={cn(
                        "flex flex-col overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-sm",
                        selected && "ring-2 ring-primary"
                      )}
                    >
                      <div className="pointer-events-none h-40 overflow-hidden border-b bg-muted/40">
                        <TemplateThumbnailFrame template={template} />
                      </div>
                      <div className="flex items-start justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{template.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {applyPersonalization(template.subject)}
                          </p>
                        </div>
                        {selected && <Check className="size-4 shrink-0 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <dl className="grid content-start gap-4 text-sm">
              <SummaryItem label="Campaign name" value={values.name} />
              <SummaryItem label="Subject" value={values.subject} />
              <SummaryItem label="Audience" value={selectedList?.name ?? "Not selected"} />
              <SummaryItem
                label="Eligible recipients"
                value={values.contactListId ? (audience?.eligibleRecipients ?? 0).toLocaleString() : "\u2014"}
              />
              <SummaryItem label="Template" value={selectedTemplate?.name ?? "Not selected"} />
              <div className="grid gap-2 border-t pt-4">
                <Label htmlFor="campaign-schedule">Schedule for</Label>
                <Input
                  id="campaign-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Uses your local time zone. Scheduled campaigns can be unscheduled any time before sending.
                </p>
              </div>
            </dl>
            <div className="grid content-start gap-2">
              <p className="text-sm text-muted-foreground">
                Preview personalized with{" "}
                {audience?.sampleData ? "the first contact in this list" : "sample contact details"}.
              </p>
              {rendered ? (
                <div className="overflow-hidden rounded-lg border">
                  <div className="border-b bg-muted/40 px-4 py-2 text-sm">
                    <p className="truncate font-medium">{rendered.subject}</p>
                  </div>
                  <PreviewFrame title="Campaign preview" html={rendered.html} className="h-[60vh]" />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Choose a template to see a preview.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0 || isPending}
          >
            <ChevronLeft />
            Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button variant="outline" onClick={goNext} disabled={isPending}>
              Next
              <ChevronRight />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isPending}>
            <Save />
            {isPending ? "Saving..." : "Save as Draft"}
          </Button>
          {step === STEPS.length - 1 && (
            <>
              <Button onClick={handleSchedule} disabled={isPending || !scheduledAt}>
                <CalendarClock />
                Schedule
              </Button>
              <SendNowDialog
                readiness={sendReadiness}
                recipientCount={values.contactListId ? (audience?.eligibleRecipients ?? 0) : null}
                onConfirm={handleSendNow}
                disabled={isPending || audienceLoading}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value || "\u2014"}</dd>
    </div>
  );
}

// Scaled-down live render of a template for the picker.
function TemplateThumbnailFrame({ template }: { template: WizardTemplate }) {
  const html = useMemo(
    () =>
      renderPersonalizedEmail({
        subject: template.subject,
        previewText: template.previewText,
        htmlContent: template.htmlContent,
      }).html,
    [template]
  );
  return (
    <div className="h-[640px] w-[200%] origin-top-left scale-50">
      <PreviewFrame title={`${template.name} thumbnail`} html={html} className="h-full" tabIndex={-1} />
    </div>
  );
}