"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import {
  contactFormSchema,
  CONTACT_STATUS_VALUES,
  type ContactFormInput,
} from "@/schemas/contact";
import { createContactAction, updateContactAction } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<(typeof CONTACT_STATUS_VALUES)[number], string> = {
  ACTIVE: "Active",
  UNSUBSCRIBED: "Unsubscribed",
  BOUNCED: "Bounced",
  SUPPRESSED: "Suppressed",
};

type ContactFormDialogProps = {
  mode: "create" | "edit";
  contactId?: string;
  defaultValues?: Partial<ContactFormInput>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const emptyValues: ContactFormInput = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  phone: "",
  industry: "",
  location: "",
  status: "ACTIVE",
};

export function ContactFormDialog({
  mode,
  contactId,
  defaultValues,
  trigger,
  open,
  onOpenChange,
}: ContactFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;

  function setOpen(value: boolean) {
    if (!isControlled) setUncontrolledOpen(value);
    onOpenChange?.(value);
  }

  const form = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { ...emptyValues, ...defaultValues },
  });

  // Reset the form each time the dialog transitions to open, so a persistently
  // mounted instance (the "Add Contact" trigger, the detail-page edit dialog)
  // doesn't show stale values from its previous use. form.reset() is an
  // imperative call into react-hook-form's internal state, so it belongs in
  // an effect (syncing to an external system), not the render body.
  useEffect(() => {
    if (resolvedOpen) {
      form.reset({ ...emptyValues, ...defaultValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOpen]);

  // The server error is plain component state, so it's safe to clear directly
  // during render (React's documented pattern for "adjusting state when a
  // prop changes") rather than via a second effect.
  const [wasOpen, setWasOpen] = useState(resolvedOpen);
  if (resolvedOpen !== wasOpen) {
    setWasOpen(resolvedOpen);
    if (resolvedOpen) setServerError(null);
  }

  function onSubmit(values: ContactFormInput) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createContactAction(values)
          : await updateContactAction(contactId!, values);

      if (!result.success) {
        setServerError(result.error);
        return;
      }

      toast.success(mode === "create" ? "Contact added" : "Contact updated");
      setOpen(false);
    });
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Contact" : "Edit Contact"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new contact to your database."
              : "Update this contact's information."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONTACT_STATUS_VALUES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : mode === "create"
                    ? "Add Contact"
                    : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
