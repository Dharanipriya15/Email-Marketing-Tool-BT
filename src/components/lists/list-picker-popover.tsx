"use client";

import { useState, useTransition } from "react";
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

type ListPickerPopoverProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  lists: { id: string; name: string }[];
  onConfirm: (listId: string) => Promise<void>;
};

export function ListPickerPopover({
  label,
  icon: Icon,
  lists,
  onConfirm,
}: ListPickerPopoverProps) {
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
            <SelectTrigger className="w-full" aria-label="List">
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
