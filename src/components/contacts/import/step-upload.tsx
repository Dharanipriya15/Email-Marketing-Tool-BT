"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type StepUploadProps = {
  file: File | null;
  onFileSelected: (file: File) => void;
  onRemoveFile: () => void;
  onContinue: () => void;
  isParsing: boolean;
  error: string | null;
};

export function StepUpload({
  file,
  onFileSelected,
  onRemoveFile,
  onContinue,
  isParsing,
  error,
}: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function validateAndSelect(candidate: File) {
    setLocalError(null);

    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      setLocalError("Only .csv files are supported.");
      return;
    }
    if (candidate.size === 0) {
      setLocalError("This file is empty.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      setLocalError(`File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
      return;
    }

    onFileSelected(candidate);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) validateAndSelect(dropped);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Import Contacts</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV file to add contacts to your database.
        </p>
      </div>

      {(localError || error) && (
        <Alert variant="destructive">
          <AlertDescription>{localError || error}</AlertDescription>
        </Alert>
      )}

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Upload className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Drag and drop your CSV file here, or{" "}
              <span className="text-primary underline">browse files</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV files only · Maximum size {formatFileSize(MAX_FILE_SIZE_BYTES)}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) validateAndSelect(selected);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileSpreadsheet className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={onRemoveFile}>
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!file || isParsing}>
          {isParsing ? "Reading file..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
