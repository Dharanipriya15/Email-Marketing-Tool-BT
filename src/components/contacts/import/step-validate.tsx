"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState } from "@/components/shared/loading-state";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rowsToCsv } from "@/lib/csv";
import type { ImportRow, ImportSummary } from "@/lib/contact-import";

const MAX_DETAIL_ROWS_SHOWN = 100;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function outcomeBadge(outcome: ImportRow["outcome"]) {
  switch (outcome) {
    case "valid":
      return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">Valid</Badge>;
    case "invalid":
      return <Badge className="border-red-200 bg-red-50 text-red-700" variant="outline">Invalid</Badge>;
    case "duplicate":
      return <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">Duplicate</Badge>;
    case "existing":
      return <Badge className="border-slate-200 bg-slate-100 text-slate-700" variant="outline">Existing</Badge>;
  }
}

type StepValidateProps = {
  rows: ImportRow[] | null;
  summary: ImportSummary | null;
  isValidating: boolean;
  onBack: () => void;
  onContinue: () => void;
};

export function StepValidate({
  rows,
  summary,
  isValidating,
  onBack,
  onContinue,
}: StepValidateProps) {
  const [showAllProblems, setShowAllProblems] = useState(false);

  const problemRows = useMemo(() => (rows ?? []).filter((r) => r.outcome !== "valid"), [rows]);
  const visibleProblemRows = showAllProblems
    ? problemRows
    : problemRows.slice(0, MAX_DETAIL_ROWS_SHOWN);

  function downloadErrors() {
    const csv = rowsToCsv(
      problemRows.map((r) => ({
        Row: String(r.rowNumber),
        Email: r.email,
        Problem: r.problem ?? "",
        Status: r.outcome,
      })),
      ["Row", "Email", "Problem", "Status"]
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-errors.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isValidating || !rows || !summary) {
    return <LoadingState message="Validating rows..." className="py-24" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Validation</h2>
        <p className="text-sm text-muted-foreground">
          We checked every row for valid emails, duplicates, and existing contacts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total Rows" value={summary.total} />
        <StatCard label="Valid" value={summary.valid} />
        <StatCard label="Invalid" value={summary.invalid} />
        <StatCard label="Duplicates" value={summary.duplicate} />
        <StatCard label="Already Existing" value={summary.existing} />
      </div>

      <Alert>
        <AlertDescription>
          {summary.valid.toLocaleString()} contact(s) will be imported.{" "}
          {summary.invalid + summary.duplicate + summary.existing > 0
            ? `${(summary.invalid + summary.duplicate + summary.existing).toLocaleString()} row(s) will be skipped (invalid, duplicate, or already existing) — nothing is deleted or overwritten.`
            : ""}
        </AlertDescription>
      </Alert>

      {problemRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Rows that will be skipped</h3>
            <Button variant="outline" size="sm" onClick={downloadErrors}>
              <Download className="size-4" />
              Download as CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProblemRows.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell className="max-w-56 truncate">{row.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.problem}</TableCell>
                    <TableCell>{outcomeBadge(row.outcome)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {problemRows.length > MAX_DETAIL_ROWS_SHOWN && !showAllProblems && (
            <Button variant="link" className="self-start px-0" onClick={() => setShowAllProblems(true)}>
              Show all {problemRows.length.toLocaleString()} rows
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={summary.valid === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}
