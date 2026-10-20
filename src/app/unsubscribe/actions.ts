"use server";

import { revalidatePath } from "next/cache";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { unsubscribeRecipient } from "@/services/unsubscribe-service";
import type { ActionResult } from "@/types/action";

// Public (no login): the signed token is the authorization.
export async function confirmUnsubscribeAction(token: string): Promise<ActionResult> {
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return { success: false, error: "This unsubscribe link is invalid." };
  }

  try {
    await unsubscribeRecipient(payload, "link");
    revalidatePath(`/unsubscribe/${token}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to process unsubscribe:", error instanceof Error ? error.message : "unknown error");
    return { success: false, error: "Something went wrong. Please try again." };
  }
}