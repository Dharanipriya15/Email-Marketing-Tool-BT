"use server";

import { redirect } from "next/navigation";
import { loginSchema, type LoginInput } from "@/schemas/auth";
import { verifyCredentials } from "@/services/auth-service";
import { setSessionCookie } from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export type LoginState = {
  error?: string;
};

const GENERIC_ERROR = "Invalid email or password.";

export async function login(input: LoginInput): Promise<LoginState> {
  // Re-validate server-side; never trust client-side validation alone.
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const { email, password } = parsed.data;
  const rateLimitKey = email.toLowerCase().trim();

  const { allowed } = checkRateLimit(rateLimitKey);
  if (!allowed) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  let result;
  try {
    result = await verifyCredentials(email, password);
  } catch (error) {
    console.error("Login failed due to an unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  if (!result.success) {
    return { error: GENERIC_ERROR };
  }

  resetRateLimit(rateLimitKey);

  await setSessionCookie({
    userId: result.userId,
    organizationId: result.organizationId,
    role: result.role,
  });

  redirect("/dashboard");
}
