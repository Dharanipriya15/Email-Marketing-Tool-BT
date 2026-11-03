// Pure role helpers (no server imports) so they can be unit tested and shared.
export const ADMIN_REQUIRED_ERROR = "Only an admin can do this. Ask an admin on your team for help.";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN";
}
