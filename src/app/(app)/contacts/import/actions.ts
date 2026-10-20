"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { importContactRowSchema, type ImportContactRowInput } from "@/schemas/contact-import";
import * as importService from "@/services/contact-import-service";
import type { ActionResult } from "@/types/action";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const MAX_EMAILS_PER_CHECK = 1000;

export async function checkExistingEmailsAction(
  emails: string[]
): Promise<ActionResult<string[]>> {
  const user = await requireUser();

  if (!Array.isArray(emails) || emails.length === 0) {
    return { success: true, data: [] };
  }
  if (emails.length > MAX_EMAILS_PER_CHECK) {
    return { success: false, error: "Too many emails in one check." };
  }

  const normalized = emails
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase());

  try {
    const existing = await importService.checkExistingEmails(user.organizationId, normalized);
    return { success: true, data: Array.from(existing) };
  } catch (error) {
    console.error("Failed to check existing emails:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function importContactsBatchAction(
  rows: ImportContactRowInput[]
): Promise<ActionResult<{ importedCount: number; importedIds: string[] }>> {
  const user = await requireUser();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: true, data: { importedCount: 0, importedIds: [] } };
  }
  if (rows.length > importService.MAX_BATCH_SIZE) {
    return { success: false, error: `Batch too large (max ${importService.MAX_BATCH_SIZE} rows).` };
  }

  const parsed = rows.map((row) => importContactRowSchema.safeParse(row));
  const invalidIndex = parsed.findIndex((p) => !p.success);
  if (invalidIndex !== -1) {
    console.error("Import batch contained an invalid row:", parsed[invalidIndex]);
    return { success: false, error: "One or more rows failed validation." };
  }

  const validRows = parsed.map((p) => (p as { success: true; data: ImportContactRowInput }).data);

  try {
    const result = await importService.importContactsBatch(user.organizationId, validRows);
    revalidatePath("/contacts");
    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to import contact batch:", error);
    return { success: false, error: GENERIC_ERROR };
  }
}
