"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addContactsToListAction } from "@/app/(app)/contacts/actions";
import { createContactListAction } from "@/app/(app)/lists/actions";
import type { ContactListRow } from "@/services/contact-list-service";

type Choice = "existing" | "new" | "skip";

type PostImportListPanelProps = {
  importedContactIds: string[];
  lists: ContactListRow[];
};

export function PostImportListPanel({
  importedContactIds,
  lists,
}: PostImportListPanelProps) {
  const [choice, setChoice] = useState<Choice>(lists.length > 0 ? "existing" : "new");
  const [existingListId, setExistingListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleApply() {
    if (choice === "skip") return;

    startTransition(async () => {
      if (choice === "existing") {
        if (!existingListId) {
          toast.error("Choose a list.");
          return;
        }
        const result = await addContactsToListAction(importedContactIds, existingListId);
        if (result.success) {
          toast.success("Contacts added to list");
          setDone(true);
        } else {
          toast.error(result.error);
        }
        return;
      }

      if (choice === "new") {
        if (!newListName.trim()) {
          toast.error("Enter a list name.");
          return;
        }
        const createResult = await createContactListAction({
          name: newListName.trim(),
          description: "",
        });
        if (!createResult.success) {
          toast.error(createResult.error);
          return;
        }
        const addResult = await addContactsToListAction(
          importedContactIds,
          createResult.data.id
        );
        if (addResult.success) {
          toast.success(`List "${newListName.trim()}" created and contacts added`);
          setDone(true);
        } else {
          toast.error(addResult.error);
        }
      }
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Imported contacts were added to the list.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add imported contacts to a list?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RadioGroup value={choice} onValueChange={(v) => setChoice(v as Choice)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="existing" id="choice-existing" disabled={lists.length === 0} />
            <Label htmlFor="choice-existing" className="font-normal">
              Add to existing list
            </Label>
          </div>
          {choice === "existing" && (
            <Select value={existingListId} onValueChange={setExistingListId}>
              <SelectTrigger className="ml-6 w-64">
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
          )}

          <div className="flex items-center gap-2">
            <RadioGroupItem value="new" id="choice-new" />
            <Label htmlFor="choice-new" className="font-normal">
              Create new list
            </Label>
          </div>
          {choice === "new" && (
            <Input
              className="ml-6 w-64"
              placeholder="New list name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
          )}

          <div className="flex items-center gap-2">
            <RadioGroupItem value="skip" id="choice-skip" />
            <Label htmlFor="choice-skip" className="font-normal">
              Skip
            </Label>
          </div>
        </RadioGroup>

        {choice !== "skip" && (
          <Button size="sm" className="self-start" onClick={handleApply} disabled={isPending}>
            {isPending ? "Adding..." : "Add Contacts"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
