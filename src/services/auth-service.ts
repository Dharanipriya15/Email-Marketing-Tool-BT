import { prisma } from "@/db/client";
import { verifyPassword } from "@/lib/password";

export type AuthResult =
  | { success: true; userId: string; organizationId: string; role: "ADMIN" | "MEMBER" }
  | { success: false };

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, organizationId: true, role: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return { success: false };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false };
  }

  return {
    success: true,
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  };
}
