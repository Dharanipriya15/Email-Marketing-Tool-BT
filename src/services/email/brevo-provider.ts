// Brevo (formerly Sendinblue) transactional email provider.
// Server-side only: reads the API key from process.env and must never be
// imported from client components.
import type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";

export const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_TIMEOUT_MS = 15_000;

export type BrevoProviderConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  timeoutMs?: number;
};

function safeText(value: unknown, max = 300): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export class BrevoProvider implements EmailProvider {
  private readonly config: BrevoProviderConfig;

  constructor(config: BrevoProviderConfig) {
    this.config = config;
  }

  private scrub(message: string): string {
    const { apiKey } = this.config;
    return apiKey ? message.split(apiKey).join("[redacted]") : message;
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { apiKey, fromEmail, fromName, timeoutMs = DEFAULT_TIMEOUT_MS } = this.config;

    const body: Record<string, unknown> = {
      sender: { email: fromEmail, name: fromName },
      to: [params.toName ? { email: params.to, name: params.toName } : { email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    };
    if (params.text) body.textContent = params.text;
    if (params.headers && Object.keys(params.headers).length > 0) body.headers = params.headers;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(BREVO_SEND_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      let json: Record<string, unknown> = {};
      try {
        json = ((await response.json()) ?? {}) as Record<string, unknown>;
      } catch {
        json = {};
      }

      if (response.ok) {
        const messageId = safeText(json.messageId, 500);
        return { success: true, messageId };
      }

      const code = safeText(json.code, 100);
      const message = safeText(json.message);
      const detail = [code, message].filter(Boolean).join(": ");
      const error = this.scrub(
        `Brevo request failed (HTTP ${response.status})${detail ? ` - ${detail}` : ""}`
      );
      console.error("[brevo] send failed", { status: response.status, code: code || undefined });
      return { success: false, error };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const error = aborted
        ? `Brevo request timed out after ${timeoutMs}ms`
        : this.scrub(`Brevo request error: ${err instanceof Error ? err.message : "unknown error"}`);
      console.error("[brevo] send error", { aborted });
      return { success: false, error };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createBrevoProviderFromEnv(): BrevoProvider | null {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;
  if (!apiKey || !fromEmail || !fromName) return null;
  return new BrevoProvider({ apiKey, fromEmail, fromName });
}
