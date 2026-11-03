"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { companySettingsSchema, type CompanySettingsInput } from "@/schemas/company-settings";
import { updateCompanySettings } from "@/services/settings-service";
import type { ActionResult } from "@/types/action";

export async function updateCompanySettingsAction(input: CompanySettingsInput): Promise<ActionResult> {
  const { user, error } = await requireAdmin();
  if (!user) return { success: false, error };

  const parsed = companySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  try {
    await updateCompanySettings(user.organizationId, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/settings/company");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("Failed to update company settings:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
