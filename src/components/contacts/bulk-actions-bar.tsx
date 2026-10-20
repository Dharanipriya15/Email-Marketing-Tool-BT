"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ListPlus, ListMinus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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

function ListPickerPopover({
  label,
  icon: Icon,
  lists,
  onConfirm,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  lists: { id: string; name: string }[];
  onConfirm: (listId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [listId, setListId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={lists.length === 0}>
          <Icon className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="flex flex-col gap-3">
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a list" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!listId || isPending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm(listId);
                setOpen(false);
                setListId("");
              })
            }
          >
            {isPending ? "Please wait..." : "Confirm"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BulkActionsBar({ selectedIds, lists, onDone }: BulkActionsBarProps) {
  async function handleAddToList(listId: string) {
    const result = await addContactsToListAction(selectedIds, listId);
    if (result.success) {
      toast.success(`Added ${selectedIds.length} contact(s) to list`);
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
          label="Add to List"
          icon={ListPlus}
          lists={lists}
          onConfirm={handleAddToList}
        />
        <ListPickerPopover
          label="Remove from List"
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
