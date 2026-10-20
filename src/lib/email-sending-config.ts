// Server-side sending configuration read from environment variables.
// Only variable NAMES appear in user-facing messages, never their values.

export type EmailProviderName = "ses" | "brevo";

const DEFAULT_SEND_RATE_PER_SEC = 5;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_CAMPAIGN_RECIPIENTS = 100;
const DEFAULT_APP_URL = "http://localhost:3000";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// EMAIL_PROVIDER picks the provider explicitly; otherwise Brevo is used when
// its API key is present (keeps existing setups working unchanged).
export function getEmailProviderName(): EmailProviderName | null {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (explicit === "ses" || explicit === "brevo") return explicit;
  if (process.env.EMAIL_PROVIDER_API_KEY) return "brevo";
  return null;
}

// Names of env vars still missing for the selected provider.
export function getMissingProviderSettings(): string[] {
  const name = getEmailProviderName();
  const common = ["EMAIL_FROM_ADDRESS", "EMAIL_FROM_NAME"];
  const required =
    name === "ses"
      ? ["AWS_SES_REGION", "AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", ...common]
      : name === "brevo"
        ? ["EMAIL_PROVIDER_API_KEY", ...common]
        : ["EMAIL_PROVIDER", ...common];
  return required.filter((key) => !process.env[key]);
}

// Global kill switch: campaign sending only happens when this is exactly "true".
export function isSendingEnabled(): boolean {
  return process.env.EMAIL_SENDING_ENABLED === "true";
}

export function getSendRatePerSecond(): number {
  return positiveInt(process.env.EMAIL_SEND_RATE_PER_SEC, DEFAULT_SEND_RATE_PER_SEC);
}

// Minutes a recipient may stay in SENDING before it is flagged for manual review.
export function getStuckSendingMinutes(): number {
  return positiveInt(process.env.EMAIL_STUCK_SENDING_MINUTES, 15);
}

export function getBatchSize(): number {
  return positiveInt(process.env.EMAIL_BATCH_SIZE, DEFAULT_BATCH_SIZE);
}

export function getMaxCampaignRecipients(): number {
  return positiveInt(process.env.EMAIL_MAX_CAMPAIGN_RECIPIENTS, DEFAULT_MAX_CAMPAIGN_RECIPIENTS);
}

// Comma-separated emails and/or domains (e.g. "me@acme.com, acme.com").
// Empty means "no allowlist" (everyone eligible may be sent to).
export function getTestAllowlist(): string[] {
  return (process.env.EMAIL_TEST_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isAllowedByAllowlist(email: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";
  return allowlist.some((entry) => (entry.includes("@") ? entry === normalized : entry === domain));
}

export function getAppUrl(): string {
  return (process.env.APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
}