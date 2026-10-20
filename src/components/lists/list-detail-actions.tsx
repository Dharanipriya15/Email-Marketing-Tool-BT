"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContactListFormDialog } from "@/components/lists/contact-list-form-dialog";
import { AddContactsToListDialog } from "@/components/lists/add-contacts-to-list-dialog";
import { deleteContactListAction } from "@/app/(app)/lists/actions";
import type { ContactListFormInput } from "@/schemas/contact-list";

type ListDetailActionsProps = {
  listId: string;
  listName: string;
  defaultValues: ContactListFormInput;
};

export function ListDetailActions({
  listId,
  listName,
  defaultValues,
}: ListDetailActionsProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    const result = await deleteContactListAction(listId);
    if (result.success) {
      toast.success("List deleted");
      startTransition(() => router.push("/lists"));
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => setAddOpen(true)}>
        <UserPlus />
        Add Contacts
      </Button>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil />
        Edit
      </Button>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 />
        Delete
      </Button>

      <AddContactsToListDialog listId={listId} open={addOpen} onOpenChange={setAddOpen} />

      <ContactListFormDialog
        mode="edit"
        listId={listId}
        defaultValues={defaultValues}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this list?"
        description={`"${listName}" will be removed along with its memberships. The contacts themselves will not be deleted.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
