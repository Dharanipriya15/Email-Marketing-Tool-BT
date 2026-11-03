"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { MAX_SUPPRESSION_IMPORT, normalizeSuppressionEmails, suppressionEmailSchema } from "@/schemas/suppression";
import * as suppressionService from "@/services/suppression-service";
import type { ActionResult } from "@/types/action";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function addSuppressionAction(email: string): Promise<ActionResult<{ added: boolean }>> {
  const { user, error } = await requireAdmin();
  if (!user) return { success: false, error };
  const parsed = suppressionEmailSchema.safeParse(email);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  try {
    const added = await suppressionService.addManualSuppression(user.organizationId, parsed.data);
    revalidatePath("/settings/suppressions");
    return { success: true, data: { added } };
  } catch (err) {
    console.error("Failed to add suppression:", err);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function removeSuppressionAction(id: string): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { success: false, error };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { success: false, error: GENERIC_ERROR };
  try {
    const removed = await suppressionService.removeSuppression(user.organizationId, id);
    revalidatePath("/settings/suppressions");
    return removed ? { success: true, data: undefined } : { success: false, error: "That entry no longer exists." };
  } catch (err) {
    console.error("Failed to remove suppression:", err);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function importSuppressionsAction(
  emails: string[]
): Promise<ActionResult<{ added: number; alreadySuppressed: number; invalid: number }>> {
  const { user, error } = await requireAdmin();
  if (!user) return { success: false, error };
  if (!Array.isArray(emails) || emails.length === 0) return { success: false, error: "The file has no email addresses." };
  if (emails.length > MAX_SUPPRESSION_IMPORT) {
    return { success: false, error: `Import up to ${MAX_SUPPRESSION_IMPORT.toLocaleString()} addresses at a time.` };
  }
  const { valid, invalid } = normalizeSuppressionEmails(emails.map((e) => String(e ?? "")));
  if (valid.length === 0) return { success: false, error: "No valid email addresses were found in the file." };
  try {
    const result = await suppressionService.importSuppressions(user.organizationId, valid);
    revalidatePath("/settings/suppressions");
    return { success: true, data: { ...result, invalid: invalid.length } };
  } catch (err) {
    console.error("Failed to import suppressions:", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
