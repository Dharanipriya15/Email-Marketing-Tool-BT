"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { parseCsvFile } from "@/lib/csv";
import { MAX_SUPPRESSION_IMPORT, pickEmailColumn } from "@/schemas/suppression";
import {
  addSuppressionAction,
  importSuppressionsAction,
  removeSuppressionAction,
} from "@/app/(app)/settings/suppressions/actions";

export function AddSuppressionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addSuppressionAction(email);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.added ? "Address suppressed" : "That address was already suppressed");
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        className="w-64"
        aria-label="Email to suppress"
      />
      <Button type="submit" disabled={isPending || !email}>
        <Plus />
        {isPending ? "Adding..." : "Add"}
      </Button>
    </form>
  );
}

export function ImportSuppressionsButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const { data, error } = await parseCsvFile(file);
    if (!data || error) {
      toast.error("Couldn't read that CSV file.");
      return;
    }
    const column = pickEmailColumn(data.headers, data.rows);
    if (!column) {
      toast.error("No email column found. Add a header named \u201cemail\u201d.");
      return;
    }
    const emails = data.rows.map((row) => row[column] ?? "").filter(Boolean);
    if (emails.length > MAX_SUPPRESSION_IMPORT) {
      toast.error(`Import up to ${MAX_SUPPRESSION_IMPORT.toLocaleString()} addresses at a time.`);
      return;
    }
    startTransition(async () => {
      const result = await importSuppressionsAction(emails);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { added, alreadySuppressed, invalid } = result.data;
      toast.success(`Imported ${added.toLocaleString()} new address(es). ${alreadySuppressed.toLocaleString()} already suppressed, ${invalid.toLocaleString()} invalid.`);
      router.refresh();
    });
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={isPending}>
        <Upload />
        {isPending ? "Importing..." : "Import CSV"}
      </Button>
    </>
  );
}

export function RemoveSuppressionButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${email}`}>
          <Trash2 className="size-4" />
        </Button>
      }
      title="Remove from suppression list?"
      description={`${email} will be able to receive campaign emails again (unless they unsubscribed or their contact is not active). Only do this if you're sure they want your emails.`}
      confirmLabel="Remove"
      onConfirm={async () => {
        const result = await removeSuppressionAction(id);
        if (result.success) {
          toast.success("Removed from suppression list");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }}
    />
  );
}
