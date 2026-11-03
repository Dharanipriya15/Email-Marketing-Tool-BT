"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { companySettingsFormSchema, type CompanySettingsInput } from "@/schemas/company-settings";
import { updateCompanySettingsAction } from "./actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CompanySettingsForm({ defaultValues }: { defaultValues: CompanySettingsInput }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsFormSchema),
    defaultValues,
  });

  function onSubmit(values: CompanySettingsInput) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateCompanySettingsAction(values);
      if (result.success) setSuccess(true);
      else setServerError(result.error);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Company details</CardTitle>
        <CardDescription>
          These appear in the footer of every campaign email next to the unsubscribe link. A physical mailing
          address is required before any campaign can be sent or scheduled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertDescription>Company details saved.</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input autoComplete="organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mailing address (required)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} autoComplete="street-address" {...field} />
                  </FormControl>
                  <FormDescription>Your physical postal address, for example street, city, PIN code, country.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unsubscribeFooterText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer text (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>
                    Shown above your address, e.g. &ldquo;You&rsquo;re receiving this because you signed up at our website.&rdquo;
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
