"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { deleteContactsAction } from "@/app/(app)/contacts/actions";
import type { ContactFormInput } from "@/schemas/contact";

type ContactDetailActionsProps = {
  contactId: string;
  contactName: string;
  defaultValues: ContactFormInput;
};

export function ContactDetailActions({
  contactId,
  contactName,
  defaultValues,
}: ContactDetailActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    const result = await deleteContactsAction([contactId]);
    if (result.success) {
      toast.success("Contact deleted");
      startTransition(() => router.push("/contacts"));
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil />
        Edit
      </Button>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 />
        Delete
      </Button>

      <ContactFormDialog
        mode="edit"
        contactId={contactId}
        defaultValues={defaultValues}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this contact?"
        description={`${contactName} will be permanently removed. This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
