"use server";

import { prisma } from "@/db/client";
import { getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema, type ChangePasswordInput } from "@/schemas/change-password";

export type ChangePasswordState = { success?: boolean; error?: string };

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in to change your password." };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { currentPassword, newPassword } = parsed.data;

  const rateKey = `change-password:${session.userId}`;
  if (!checkRateLimit(rateKey).allowed) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: session.userId, organizationId: session.organizationId },
      select: { id: true, passwordHash: true },
    });
    if (!user || !user.passwordHash) {
      return { error: "Current password is incorrect." };
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return { error: "Current password is incorrect." };

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    resetRateLimit(rateKey);
    return { success: true };
  } catch (error) {
    // Never log the passwords themselves.
    console.error("Change password failed:", error instanceof Error ? error.message : "unknown error");
    return { error: "Something went wrong. Please try again." };
  }
}