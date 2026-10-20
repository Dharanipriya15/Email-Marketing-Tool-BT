"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParsedCsv } from "@/lib/csv";

const PREVIEW_ROW_COUNT = 15;

type StepPreviewProps = {
  csv: ParsedCsv;
  onBack: () => void;
  onContinue: () => void;
};

export function StepPreview({ csv, onBack, onContinue }: StepPreviewProps) {
  const previewRows = csv.rows.slice(0, PREVIEW_ROW_COUNT);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Preview</h2>
        <p className="text-sm text-muted-foreground">
          {csv.rows.length.toLocaleString()} contacts found. Showing the first{" "}
          {Math.min(PREVIEW_ROW_COUNT, csv.rows.length)} rows.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {csv.headers.map((header) => (
                <TableHead key={header} className="whitespace-nowrap">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row, index) => (
              <TableRow key={index}>
                {csv.headers.map((header) => (
                  <TableCell key={header} className="max-w-48 truncate whitespace-nowrap">
                    {row[header] || "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </div>
  );
}
