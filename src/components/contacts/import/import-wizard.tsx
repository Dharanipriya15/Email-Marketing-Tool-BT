"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ImportStepper, type ImportStep } from "@/components/contacts/import/import-stepper";
import { StepUpload } from "@/components/contacts/import/step-upload";
import { StepPreview } from "@/components/contacts/import/step-preview";
import { StepMapping } from "@/components/contacts/import/step-mapping";
import { StepValidate } from "@/components/contacts/import/step-validate";
import { StepImport } from "@/components/contacts/import/step-import";
import {
  parseCsvFile,
  detectColumnMapping,
  type ParsedCsv,
  type ColumnMapping,
} from "@/lib/csv";
import {
  buildImportRows,
  applyExistingEmails,
  summarizeRows,
  type ImportRow,
  type ImportSummary,
} from "@/lib/contact-import";
import { checkExistingEmailsAction } from "@/app/(app)/contacts/import/actions";
import type { ContactListRow } from "@/services/contact-list-service";

const EXISTING_CHECK_BATCH_SIZE = 500;

type ImportWizardProps = {
  lists: ContactListRow[];
};

export function ImportWizard({ lists }: ImportWizardProps) {
  const [step, setStep] = useState<ImportStep>("upload");

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);

  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  function handleFileSelected(selected: File) {
    setFile(selected);
    setUploadError(null);
  }

  function handleRemoveFile() {
    setFile(null);
    setCsv(null);
    setUploadError(null);
  }

  async function handleUploadContinue() {
    if (!file) return;
    setIsParsing(true);
    setUploadError(null);
    const { data, error } = await parseCsvFile(file);
    setIsParsing(false);

    if (error || !data) {
      if (error?.type === "empty") {
        setUploadError("This CSV file has no data rows.");
      } else if (error?.type === "no-headers") {
        setUploadError("Couldn't find any column headers in this file.");
      } else {
        setUploadError("Couldn't read this file. Please check that it's a valid CSV.");
      }
      return;
    }

    setCsv(data);
    setMapping(detectColumnMapping(data.headers));
    setStep("preview");
  }

  async function runValidation() {
    if (!csv) return;
    setStep("validate");
    setIsValidating(true);

    const rows = buildImportRows(csv, mapping);
    const candidateEmails = rows.filter((r) => r.outcome === "valid").map((r) => r.email);
    const existingEmails = new Set<string>();

    for (let i = 0; i < candidateEmails.length; i += EXISTING_CHECK_BATCH_SIZE) {
      const chunk = candidateEmails.slice(i, i + EXISTING_CHECK_BATCH_SIZE);
      const result = await checkExistingEmailsAction(chunk);
      if (result.success) {
        for (const email of result.data) existingEmails.add(email);
      } else {
        toast.error(result.error);
        break;
      }
    }

    const finalRows = applyExistingEmails(rows, existingEmails);
    setImportRows(finalRows);
    setSummary(summarizeRows(finalRows));
    setIsValidating(false);
  }

  function handleStartOver() {
    setStep("upload");
    setFile(null);
    setCsv(null);
    setMapping({});
    setImportRows(null);
    setSummary(null);
    setUploadError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <ImportStepper current={step} />

      <Card>
        <CardContent className="pt-6">
          {step === "upload" && (
            <StepUpload
              file={file}
              onFileSelected={handleFileSelected}
              onRemoveFile={handleRemoveFile}
              onContinue={handleUploadContinue}
              isParsing={isParsing}
              error={uploadError}
            />
          )}

          {step === "preview" && csv && (
            <StepPreview
              csv={csv}
              onBack={() => setStep("upload")}
              onContinue={() => setStep("mapping")}
            />
          )}

          {step === "mapping" && csv && (
            <StepMapping
              csv={csv}
              mapping={mapping}
              onMappingChange={setMapping}
              onBack={() => setStep("preview")}
              onContinue={runValidation}
            />
          )}

          {step === "validate" && (
            <StepValidate
              rows={importRows}
              summary={summary}
              isValidating={isValidating}
              onBack={() => setStep("mapping")}
              onContinue={() => setStep("import")}
            />
          )}

          {step === "import" && importRows && summary && (
            <StepImport
              validRows={importRows.filter((r) => r.outcome === "valid")}
              summary={summary}
              lists={lists}
              onBack={() => setStep("validate")}
              onStartOver={handleStartOver}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
