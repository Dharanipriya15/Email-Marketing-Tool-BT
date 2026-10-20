import Papa from "papaparse";

export const SYSTEM_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "company",
  "phone",
  "industry",
  "location",
  "status",
] as const;

export type SystemField = (typeof SYSTEM_FIELDS)[number];

export const SYSTEM_FIELD_LABELS: Record<SystemField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  company: "Company",
  phone: "Phone",
  industry: "Industry",
  location: "Location",
  status: "Status",
};

export const REQUIRED_SYSTEM_FIELDS: SystemField[] = ["email"];

// A CSV column maps to at most one system field, or is left unmapped ("skip").
export type ColumnMapping = Record<string, SystemField | null>;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_ALIASES: Record<SystemField, string[]> = {
  firstName: ["firstname", "fname", "givenname"],
  lastName: ["lastname", "lname", "surname", "familyname"],
  email: ["email", "emailaddress", "email1", "primaryemail"],
  company: ["company", "companyname", "organization", "organisation", "employer"],
  phone: ["phone", "phonenumber", "mobile", "telephone", "cell"],
  industry: ["industry", "sector"],
  location: ["location", "city", "region", "address"],
  status: ["status", "contactstatus"],
};

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const claimed = new Set<SystemField>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matched: SystemField | null = null;

    for (const field of SYSTEM_FIELDS) {
      if (claimed.has(field)) continue;
      if (FIELD_ALIASES[field].includes(normalized)) {
        matched = field;
        break;
      }
    }

    mapping[header] = matched;
    if (matched) claimed.add(matched);
  }

  return mapping;
}

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export type CsvParseError =
  | { type: "empty" }
  | { type: "no-headers" }
  | { type: "parse-error"; message: string };

// Pure, synchronous, DOM-free parsing of CSV text — the core logic, fully
// unit-testable in plain Node with no FileReader/jsdom dependency.
export function parseCsvText(text: string): {
  data: ParsedCsv | null;
  error: CsvParseError | null;
} {
  const results = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (results.errors.length > 0 && results.data.length === 0) {
    return { data: null, error: { type: "parse-error", message: results.errors[0].message } };
  }

  const headers = results.meta.fields?.filter((h) => h && h.length > 0) ?? [];

  if (headers.length === 0) {
    return { data: null, error: { type: "no-headers" } };
  }

  if (results.data.length === 0) {
    return { data: null, error: { type: "empty" } };
  }

  return { data: { headers, rows: results.data }, error: null };
}

// Thin browser adapter: File.text() is part of the standard Blob interface
// (native in Node 20+ too), so this stays a simple wrapper around the pure
// string parser above rather than using Papaparse's own file/FileReader mode.
export async function parseCsvFile(
  file: File
): Promise<{ data: ParsedCsv | null; error: CsvParseError | null }> {
  const text = await file.text();
  return parseCsvText(text);
}

export function rowsToCsv(rows: Record<string, string>[], columns: string[]): string {
  return Papa.unparse({ fields: columns, data: rows.map((row) => columns.map((c) => row[c] ?? "")) });
}
