import type { ColumnMapping, ParsedCsv } from "@/lib/csv";
import type { ContactStatus } from "@prisma/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_ALIASES: Record<string, ContactStatus> = {
  active: "ACTIVE",
  unsubscribed: "UNSUBSCRIBED",
  bounced: "BOUNCED",
  suppressed: "SUPPRESSED",
};

function normalizeStatus(value: string | undefined): ContactStatus {
  if (!value) return "ACTIVE";
  const normalized = STATUS_ALIASES[value.trim().toLowerCase()];
  return normalized ?? "ACTIVE";
}

export type ImportContactData = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  phone: string | null;
  industry: string | null;
  location: string | null;
  status: ContactStatus;
};

export type ImportRowOutcome = "valid" | "invalid" | "duplicate" | "existing";

export type ImportRow = {
  rowNumber: number;
  email: string;
  data: ImportContactData;
  outcome: ImportRowOutcome;
  problem: string | null;
};

function fieldValue(
  row: Record<string, string>,
  mapping: ColumnMapping,
  field: string
): string | undefined {
  const column = Object.entries(mapping).find(([, mapped]) => mapped === field)?.[0];
  if (!column) return undefined;
  return row[column]?.trim();
}

export function buildImportRows(csv: ParsedCsv, mapping: ColumnMapping): ImportRow[] {
  const seenEmails = new Set<string>();

  return csv.rows.map((row, index) => {
    const rowNumber = index + 1;
    const rawEmail = fieldValue(row, mapping, "email") ?? "";
    const email = rawEmail.toLowerCase().trim();

    const data: ImportContactData = {
      firstName: fieldValue(row, mapping, "firstName") || null,
      lastName: fieldValue(row, mapping, "lastName") || null,
      email,
      company: fieldValue(row, mapping, "company") || null,
      phone: fieldValue(row, mapping, "phone") || null,
      industry: fieldValue(row, mapping, "industry") || null,
      location: fieldValue(row, mapping, "location") || null,
      status: normalizeStatus(fieldValue(row, mapping, "status")),
    };

    if (!rawEmail) {
      return { rowNumber, email, data, outcome: "invalid", problem: "Missing email" };
    }

    if (!EMAIL_REGEX.test(email)) {
      return { rowNumber, email, data, outcome: "invalid", problem: "Invalid email format" };
    }

    if (seenEmails.has(email)) {
      return { rowNumber, email, data, outcome: "duplicate", problem: "Duplicate in file" };
    }
    seenEmails.add(email);

    return { rowNumber, email, data, outcome: "valid", problem: null };
  });
}

export function applyExistingEmails(rows: ImportRow[], existingEmails: Set<string>): ImportRow[] {
  return rows.map((row) => {
    if (row.outcome === "valid" && existingEmails.has(row.email)) {
      return { ...row, outcome: "existing" as const, problem: "Already exists" };
    }
    return row;
  });
}

export type ImportSummary = {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  existing: number;
};

export function summarizeRows(rows: ImportRow[]): ImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((r) => r.outcome === "valid").length,
    invalid: rows.filter((r) => r.outcome === "invalid").length,
    duplicate: rows.filter((r) => r.outcome === "duplicate").length,
    existing: rows.filter((r) => r.outcome === "existing").length,
  };
}
