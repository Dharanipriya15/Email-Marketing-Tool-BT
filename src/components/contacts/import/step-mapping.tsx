"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SYSTEM_FIELDS,
  SYSTEM_FIELD_LABELS,
  REQUIRED_SYSTEM_FIELDS,
  type ColumnMapping,
  type SystemField,
} from "@/lib/csv";
import type { ParsedCsv } from "@/lib/csv";

const SKIP_VALUE = "__skip__";

type StepMappingProps = {
  csv: ParsedCsv;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepMapping({
  csv,
  mapping,
  onMappingChange,
  onBack,
  onContinue,
}: StepMappingProps) {
  const isEmailMapped = Object.values(mapping).includes("email");

  function handleChange(header: string, value: string) {
    const field = value === SKIP_VALUE ? null : (value as SystemField);
    const next = { ...mapping };

    // Each system field can only come from one CSV column at a time.
    if (field) {
      for (const key of Object.keys(next)) {
        if (next[key] === field) next[key] = null;
      }
    }

    next[header] = field;
    onMappingChange(next);
  }

  function usedElsewhere(header: string, field: SystemField): boolean {
    return Object.entries(mapping).some(([key, value]) => key !== header && value === field);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Map Columns</h2>
        <p className="text-sm text-muted-foreground">
          Match each CSV column to a contact field. Email is required.
        </p>
      </div>

      {!isEmailMapped && (
        <Alert variant="destructive">
          <AlertDescription>
            Map a column to Email before continuing.
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CSV Column</TableHead>
              <TableHead>Sample Value</TableHead>
              <TableHead>System Field</TableHead>
              <TableHead>Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {csv.headers.map((header) => {
              const field = mapping[header];
              const isRequired = field ? REQUIRED_SYSTEM_FIELDS.includes(field) : false;
              const sample = csv.rows.find((r) => r[header])?.[header] ?? "—";

              return (
                <TableRow key={header}>
                  <TableCell className="font-medium">{header}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {sample}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={field ?? SKIP_VALUE}
                      onValueChange={(value) => handleChange(header, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_VALUE}>Do not import</SelectItem>
                        {SYSTEM_FIELDS.map((f) => (
                          <SelectItem
                            key={f}
                            value={f}
                            disabled={usedElsewhere(header, f)}
                          >
                            {SYSTEM_FIELD_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {field ? (
                      <Badge variant={isRequired ? "default" : "outline"}>
                        {isRequired ? "Required" : "Optional"}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!isEmailMapped}>
          Continue
        </Button>
      </div>
    </div>
  );
}
