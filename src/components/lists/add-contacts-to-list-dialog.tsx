"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { searchContactsForListAction } from "@/app/(app)/lists/actions";
import { addContactsToListAction } from "@/app/(app)/contacts/actions";
import { formatAddToListResult } from "@/lib/list-membership";
import type { SelectableContact } from "@/services/contact-service";

type AddContactsToListDialogProps = {
  listId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function contactLabel(contact: SelectableContact) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return name || contact.email;
}

export function AddContactsToListDialog({
  listId,
  open,
  onOpenChange,
}: AddContactsToListDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SelectableContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSearching, startSearch] = useTransition();
  const [isSaving, startSave] = useTransition();

  // Reset selection/search state when the dialog opens, so a persistently
  // mounted instance doesn't show a stale pick list from its previous use.
  // Adjusted during render (plain component state) rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch("");
      setSelected(new Set());
    }
  }

  // Fetch matching contacts whenever the dialog is open and the search term
  // (or list) changes — debounced so we don't fire on every keystroke, but
  // fires immediately for the initial empty-search load.
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(
      () => {
        startSearch(async () => {
          const result = await searchContactsForListAction(listId, search);
          if (result.success) setResults(result.data);
        });
      },
      search ? 300 : 0
    );
    return () => clearTimeout(timeout);
  }, [open, listId, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    startSave(async () => {
      const result = await addContactsToListAction(Array.from(selected), listId);
      if (result.success) {
        toast.success(formatAddToListResult(result.data));
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Contacts to List</DialogTitle>
          <DialogDescription>
            Select contacts to add. Contacts already in this list aren&apos;t shown.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {results.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={isSearching ? "Searching..." : "No contacts found"}
              className="border-0 py-8"
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {results.map((contact) => (
                <li key={contact.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggle(contact.id)}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {contactLabel(contact)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {contact.email}
                        {contact.company ? ` · ${contact.company}` : ""}
                      </span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.size} selected
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0 || isSaving}>
              {isSaving ? "Adding..." : `Add ${selected.size || ""} Contact${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
