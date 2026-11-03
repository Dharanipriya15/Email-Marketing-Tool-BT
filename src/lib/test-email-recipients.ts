// Who may receive a "Send test" email. Unlike campaign sends, an EMPTY
// EMAIL_TEST_ALLOWLIST does NOT allow everyone here: a test email may only go
// to an allowlisted address/domain or to a user of the same organization, so
// the test button can't be used to email arbitrary people.
import { isAllowedByAllowlist } from "@/lib/email-sending-config";

export const TEST_RECIPIENT_NOT_ALLOWED_ERROR =
  "Test emails can only be sent to members of your team or to addresses in EMAIL_TEST_ALLOWLIST.";

export function isAllowedTestRecipient(email: string, allowlist: string[], orgUserEmails: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  if (orgUserEmails.some((userEmail) => userEmail.trim().toLowerCase() === normalized)) return true;
  return allowlist.length > 0 && isAllowedByAllowlist(normalized, allowlist);
}
