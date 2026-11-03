import { z } from "zod";

export const MAX_SUPPRESSION_IMPORT = 10_000;

export const suppressionEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(320, "Email is too long.");

// Splits raw imported values into valid (normalized, de-duplicated) and invalid entries.
export function normalizeSuppressionEmails(values: string[]): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const value of values) {
    if (!value || !value.trim()) continue;
    const parsed = suppressionEmailSchema.safeParse(value);
    if (parsed.success) valid.add(parsed.data);
    else invalid.push(value.trim());
  }
  return { valid: [...valid], invalid };
}

// Picks the email column of a parsed CSV: a header named like "email", else
// the first column whose first value looks like an address.
export function pickEmailColumn(headers: string[], rows: Record<string, string>[]): string | null {
  const byName = headers.find((h) => ["email", "emailaddress", "e-mail", "mail"].includes(h.trim().toLowerCase().replace(/[\s_]/g, "")));
  if (byName) return byName;
  const first = rows[0] ?? {};
  return headers.find((h) => (first[h] ?? "").includes("@")) ?? null;
}
