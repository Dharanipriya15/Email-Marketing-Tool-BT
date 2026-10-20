"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import {
  contactListFormSchema,
  type ContactListFormInput,
} from "@/schemas/contact-list";
import {
  createContactListAction,
  updateContactListAction,
} from "@/app/(app)/lists/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type ContactListFormDialogProps = {
  mode: "create" | "edit";
  listId?: string;
  defaultValues?: Partial<ContactListFormInput>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
};

const emptyValues: ContactListFormInput = { name: "", description: "" };

export function ContactListFormDialog({
  mode,
  listId,
  defaultValues,
  trigger,
  open,
  onOpenChange,
  onCreated,
}: ContactListFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;

  function setOpen(value: boolean) {
    if (!isControlled) setUncontrolledOpen(value);
    onOpenChange?.(value);
  }

  const form = useForm<ContactListFormInput>({
    resolver: zodResolver(contactListFormSchema),
    defaultValues: { ...emptyValues, ...defaultValues },
  });

  useEffect(() => {
    if (resolvedOpen) {
      form.reset({ ...emptyValues, ...defaultValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOpen]);

  const [wasOpen, setWasOpen] = useState(resolvedOpen);
  if (resolvedOpen !== wasOpen) {
    setWasOpen(resolvedOpen);
    if (resolvedOpen) setServerError(null);
  }

  function onSubmit(values: ContactListFormInput) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createContactListAction(values)
          : await updateContactListAction(listId!, values);

      if (!result.success) {
        setServerError(result.error);
        return;
      }

      toast.success(mode === "create" ? "List created" : "List updated");
      setOpen(false);
      if (mode === "create" && result.data) {
        onCreated?.(result.data.id);
      }
    });
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create List" : "Edit List"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a list to organize contacts for targeted campaigns."
              : "Update this list's name and description."}
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

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>List Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Newsletter Subscribers" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this list used for?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    ? "Create List"
                    : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
