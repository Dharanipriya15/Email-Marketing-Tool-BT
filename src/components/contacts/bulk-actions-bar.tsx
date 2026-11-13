"use client";

import { toast } from "sonner";
import { ListPlus, ListMinus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListPickerPopover } from "@/components/lists/list-picker-popover";
import { formatAddToListResult } from "@/lib/list-membership";
import {
  addContactsToListAction,
  removeContactsFromListAction,
  deleteContactsAction,
} from "@/app/(app)/contacts/actions";

type BulkActionsBarProps = {
  selectedIds: string[];
  lists: { id: string; name: string }[];
  onDone: () => void;
};

export function BulkActionsBar({ selectedIds, lists, onDone }: BulkActionsBarProps) {
  async function handleAddToList(listId: string) {
    const result = await addContactsToListAction(selectedIds, listId);
    if (result.success) {
      toast.success(formatAddToListResult(result.data));
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemoveFromList(listId: string) {
    const result = await removeContactsFromListAction(selectedIds, listId);
    if (result.success) {
      toast.success(`Removed ${selectedIds.length} contact(s) from list`);
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    const result = await deleteContactsAction(selectedIds);
    if (result.success) {
      toast.success(`Deleted ${selectedIds.length} contact(s)`);
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">
        {selectedIds.length} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ListPickerPopover
          label="Add to list"
          icon={ListPlus}
          lists={lists}
          onConfirm={handleAddToList}
        />
        <ListPickerPopover
          label="Remove from list"
          icon={ListMinus}
          lists={lists}
          onConfirm={handleRemoveFromList}
        />
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="sm">
              <Trash2 className="size-4" />
              Delete
            </Button>
          }
          title={`Delete ${selectedIds.length} contact(s)?`}
          description="This action cannot be undone. These contacts will be permanently removed."
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
