import { createBrevoProviderFromEnv } from "./brevo-provider";
import { createSesProviderFromEnv } from "./ses-provider";
import {
  getEmailProviderName,
  getMissingProviderSettings,
  isSendingEnabled,
} from "@/lib/email-sending-config";

// Email provider abstraction. Callers code against this contract; the
// concrete provider (Amazon SES or Brevo) is chosen by EMAIL_PROVIDER.

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  toName?: string;
  // Optional custom headers, e.g. List-Unsubscribe.
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

export interface EmailProvider {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}

export function isEmailProviderConfigured(): boolean {
  return getEmailProviderName() !== null && getMissingProviderSettings().length === 0;
}

export { EMAIL_NOT_CONFIGURED_MESSAGE } from "@/lib/email-messages";

// Returns null when no provider is configured.
export function getEmailProvider(): EmailProvider | null {
  if (!isEmailProviderConfigured()) return null;
  return getEmailProviderName() === "ses" ? createSesProviderFromEnv() : createBrevoProviderFromEnv();
}

export type SendingReadiness = {
  ready: boolean;
  // Env variable NAMES that still need to be set (never values).
  missing: string[];
};

// Whether real campaign sends may happen: provider configured AND the
// EMAIL_SENDING_ENABLED kill switch turned on.
export function getSendingReadiness(): SendingReadiness {
  const missing = [...getMissingProviderSettings()];
  if (!isSendingEnabled()) missing.push("EMAIL_SENDING_ENABLED=true");
  return { ready: missing.length === 0, missing };
}