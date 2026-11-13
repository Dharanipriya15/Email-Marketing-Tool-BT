"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ListPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListPickerPopover } from "@/components/lists/list-picker-popover";
import { formatAddToListResult } from "@/lib/list-membership";
import {
  addContactsToListAction,
  removeContactsFromListAction,
} from "@/app/(app)/contacts/actions";

type ListOption = { id: string; name: string };

type ContactListsCardActionsProps = {
  contactId: string;
  memberships: ListOption[];
  allLists: ListOption[];
};

export function ContactListsAddButton({
  contactId,
  memberships,
  allLists,
}: ContactListsCardActionsProps) {
  const memberIds = new Set(memberships.map((l) => l.id));
  const available = allLists.filter((l) => !memberIds.has(l.id));

  async function handleAdd(listId: string) {
    const result = await addContactsToListAction([contactId], listId);
    if (!result.success) {
      toast.error(result.error);
    } else if (result.data.added > 0) {
      toast.success(formatAddToListResult(result.data));
    } else {
      toast.warning(formatAddToListResult(result.data));
    }
  }

  return (
    <ListPickerPopover
      label="Add to list"
      icon={ListPlus}
      lists={available}
      onConfirm={handleAdd}
    />
  );
}

export function ContactListBadges({
  contactId,
  memberships,
}: Pick<ContactListsCardActionsProps, "contactId" | "memberships">) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(list: ListOption) {
    startTransition(async () => {
      const result = await removeContactsFromListAction([contactId], list.id);
      if (result.success) {
        toast.success(`Removed from "${list.name}"`);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (memberships.length === 0) {
    return <p className="text-sm text-muted-foreground">Not part of any list yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {memberships.map((list) => (
        <Badge key={list.id} variant="secondary" className="gap-1 pr-1">
          {list.name}
          <button
            type="button"
            onClick={() => handleRemove(list)}
            disabled={isPending}
            aria-label={`Remove from ${list.name}`}
            title="Remove from list"
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
