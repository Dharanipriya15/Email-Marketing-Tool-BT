"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { sendTestEmailAction } from "@/app/(app)/templates/actions";
import { testEmailSchema, type TestEmailInput } from "@/schemas/template";
import { EMAIL_NOT_CONFIGURED_MESSAGE } from "@/lib/email-messages";

type SendTestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailConfigured: boolean;
  defaultEmail?: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
};

export function SendTestDialog({
  open,
  onOpenChange,
  emailConfigured,
  defaultEmail = "",
  subject,
  previewText,
  htmlContent,
}: SendTestDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<TestEmailInput>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: { testEmail: defaultEmail },
  });

  function handleOpenChange(next: boolean) {
    if (!next) setServerError(null);
    onOpenChange(next);
  }

  function onSubmit({ testEmail }: TestEmailInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await sendTestEmailAction({ testEmail, subject, previewText, htmlContent });
      if (result.success) {
        toast.success(`Test email sent to ${testEmail}`);
        handleOpenChange(false);
      } else {
        setServerError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Test Email</DialogTitle>
          <DialogDescription>
            Send the current version of this email to your inbox. Unsaved changes are included,
            and personalization variables are filled with sample details.
          </DialogDescription>
        </DialogHeader>

        {!emailConfigured ? (
          <>
            <Alert>
              <Info />
              <AlertTitle>Email sending isn&apos;t set up</AlertTitle>
              <AlertDescription>{EMAIL_NOT_CONFIGURED_MESSAGE}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button asChild>
                <Link href="/settings">Go to Settings</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              {serverError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="testEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@company.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormDescription>The subject will start with [Test].</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Sending..." : "Send Test"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
