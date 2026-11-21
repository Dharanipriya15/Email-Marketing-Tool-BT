"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, Eye, Save, Send } from "lucide-react";

import { templateFormSchema, type TemplateFormInput } from "@/schemas/template";
import { createTemplateAction, updateTemplateAction } from "@/app/(app)/templates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/shared/page-header";
import { EmailEditor } from "@/components/templates/editor/email-editor";
import { PersonalizeMenu } from "@/components/templates/personalize-menu";
import { TemplatePreviewDialog } from "@/components/templates/template-preview-dialog";
import { SendTestDialog } from "@/components/templates/send-test-dialog";

type TemplateEditorFormProps = {
  title: string;
  description: string;
  templateId?: string;
  defaultValues: TemplateFormInput;
  emailConfigured: boolean;
  userEmail?: string;
  canDeleteImages?: boolean;
};

// Warns before closing/reloading the tab with unsaved edits.
function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);
}

export function TemplateEditorForm({
  title,
  description,
  templateId,
  defaultValues,
  emailConfigured,
  userEmail,
  canDeleteImages = false,
}: TemplateEditorFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<TemplateFormInput>({
    resolver: zodResolver(templateFormSchema),
    defaultValues,
  });

  const [subject, previewText, htmlContent] = useWatch({
    control: form.control,
    name: ["subject", "previewText", "htmlContent"],
  });
  const { isDirty } = form.formState;

  useUnsavedChangesWarning(isDirty && !isPending);

  function insertIntoSubject(token: string) {
    const input = subjectInputRef.current;
    const value = form.getValues("subject");
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    form.setValue("subject", value.slice(0, start) + token + value.slice(end), {
      shouldDirty: true,
      shouldValidate: true,
    });
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function onSubmit(values: TemplateFormInput) {
    setServerError(null);
    startTransition(async () => {
      if (templateId) {
        const result = await updateTemplateAction(templateId, values);
        if (!result.success) {
          setServerError(result.error);
          return;
        }
        form.reset(values);
        toast.success("Template saved");
        router.refresh();
        return;
      }

      const result = await createTemplateAction(values);
      if (!result.success) {
        setServerError(result.error);
        return;
      }
      form.reset(values);
      toast.success("Template created");
      router.replace(`/templates/${result.data.id}`);
    });
  }

  function onInvalid() {
    toast.error("Please fix the highlighted fields before saving.");
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="flex flex-col gap-6"
        noValidate
      >
        <PageHeader
          title={title}
          description={description}
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => setSendTestOpen(true)}>
                <Send />
                Send Test
              </Button>
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye />
                Preview
              </Button>
              <Button type="submit" disabled={isPending}>
                <Save />
                {isPending ? "Saving..." : "Save Draft"}
              </Button>
            </>
          }
        />

        {serverError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Card className="py-5">
          <CardContent className="flex flex-col gap-5 px-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Product Introduction" maxLength={150} {...field} />
                    </FormControl>
                    <FormDescription>Only visible to your team.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex h-4 items-center justify-between gap-2">
                      <FormLabel>Subject Line</FormLabel>
                      <div className="-mr-2">
                        <PersonalizeMenu onInsert={insertIntoSubject} />
                      </div>
                    </div>
                    <FormControl>
                      <Input
                        placeholder="e.g. A smarter solution for {{company}}"
                        maxLength={200}
                        {...field}
                        ref={(element) => {
                          field.ref(element);
                          subjectInputRef.current = element;
                        }}
                      />
                    </FormControl>
                    <FormDescription>What recipients see in their inbox.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="previewText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Preview Text <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. See how teams like yours are cutting energy costs"
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The short summary shown after the subject line in most inboxes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="htmlContent"
          render={() => (
            <FormItem>
              <FormLabel>Email Content</FormLabel>
              <FormDescription>
                Click any text to edit it. Use the toolbar to add images, buttons, and
                personalization.
              </FormDescription>
              <FormControl>
                <EmailEditor
                  initialContent={defaultValues.htmlContent}
                  canDeleteImages={canDeleteImages}
                  onChange={(html) =>
                    form.setValue("htmlContent", html, { shouldValidate: true, shouldDirty: true })
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>

      <TemplatePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={subject}
        previewText={previewText}
        htmlContent={htmlContent}
      />
      <SendTestDialog
        open={sendTestOpen}
        onOpenChange={setSendTestOpen}
        emailConfigured={emailConfigured}
        defaultEmail={userEmail}
        subject={subject}
        previewText={previewText}
        htmlContent={htmlContent}
      />
    </Form>
  );
}
