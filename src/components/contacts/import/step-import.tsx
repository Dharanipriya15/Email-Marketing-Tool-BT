"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { importContactsBatchAction } from "@/app/(app)/contacts/import/actions";
import { PostImportListPanel } from "@/components/contacts/import/post-import-list-panel";
import type { ImportRow, ImportSummary } from "@/lib/contact-import";
import type { ContactListRow } from "@/services/contact-list-service";

const IMPORT_BATCH_SIZE = 150;

type ImportPhase = "confirm" | "importing" | "done";

type StepImportProps = {
  validRows: ImportRow[];
  summary: ImportSummary;
  lists: ContactListRow[];
  onBack: () => void;
  onStartOver: () => void;
};

export function StepImport({
  validRows,
  summary,
  lists,
  onBack,
  onStartOver,
}: StepImportProps) {
  const [phase, setPhase] = useState<ImportPhase>("confirm");
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const skippedCount = summary.invalid + summary.duplicate + summary.existing;

  async function runImport() {
    setPhase("importing");
    setImportError(null);
    let totalImported = 0;
    const allIds: string[] = [];

    for (let i = 0; i < validRows.length; i += IMPORT_BATCH_SIZE) {
      const batch = validRows.slice(i, i + IMPORT_BATCH_SIZE).map((r) => r.data);
      const result = await importContactsBatchAction(batch);

      if (!result.success) {
        setImportError(result.error);
        setPhase("done");
        return;
      }

      totalImported += result.data.importedCount;
      allIds.push(...result.data.importedIds);
      setImportedCount(totalImported);
      setImportedIds(allIds);
      setProgress(Math.min(i + IMPORT_BATCH_SIZE, validRows.length));
    }

    setPhase("done");
  }

  if (phase === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Ready to Import</h2>
          <p className="text-sm text-muted-foreground">
            Review the summary before importing.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            You are about to import <strong>{summary.valid.toLocaleString()} contacts</strong>.
            {skippedCount > 0 &&
              ` Duplicates and invalid records (${skippedCount.toLocaleString()}) will be skipped.`}
          </AlertDescription>
        </Alert>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={runImport}>Import Contacts</Button>
        </div>
      </div>
    );
  }

  if (phase === "importing") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm font-medium">Importing contacts...</p>
        <div className="w-full max-w-sm">
          <Progress value={(progress / validRows.length) * 100} />
        </div>
        <p className="text-sm text-muted-foreground">
          {progress.toLocaleString()} / {validRows.length.toLocaleString()}
        </p>
      </div>
    );
  }

  // done
  return (
    <div className="flex flex-col gap-6">
      {importError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Import stopped after {importedCount.toLocaleString()} contact(s): {importError}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold">Import Complete</h2>
          <p className="text-sm text-muted-foreground">
            {summary.total.toLocaleString()} contacts processed
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Imported" value={importedCount} />
        <SummaryStat label="Duplicates skipped" value={summary.duplicate} />
        <SummaryStat label="Invalid skipped" value={summary.invalid} />
        <SummaryStat label="Existing skipped" value={summary.existing} />
      </div>

      {importedIds.length > 0 && (
        <PostImportListPanel importedContactIds={importedIds} lists={lists} />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onStartOver}>
          Import Another CSV
        </Button>
        <Button asChild>
          <Link href="/contacts">View Contacts</Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}
