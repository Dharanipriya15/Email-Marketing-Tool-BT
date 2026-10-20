// Amazon SES (v2 API) email provider.
// Server-side only: reads AWS credentials from process.env and must never be
// imported from client components.
import { SESv2Client, SendEmailCommand, type MessageHeader } from "@aws-sdk/client-sesv2";
import type { EmailProvider, SendEmailParams, SendEmailResult } from "./provider";

export type SesProviderConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;
  fromName: string;
  configurationSet?: string;
};

type SesClientLike = Pick<SESv2Client, "send">;

// Strip CR/LF so user data can never inject extra headers.
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

// RFC 5322 display name; non-ASCII names are RFC 2047 encoded as SES requires.
export function formatAddress(email: string, name?: string): string {
  const cleanEmail = headerSafe(email);
  const cleanName = name ? headerSafe(name) : "";
  if (!cleanName) return cleanEmail;
  if (/[^\x20-\x7e]/.test(cleanName)) {
    return `=?UTF-8?B?${Buffer.from(cleanName, "utf8").toString("base64")}?= <${cleanEmail}>`;
  }
  return `"${cleanName.replace(/["\\]/g, "\\$&")}" <${cleanEmail}>`;
}

export class SesProvider implements EmailProvider {
  private readonly config: SesProviderConfig;
  private readonly client: SesClientLike;

  constructor(config: SesProviderConfig, client?: SesClientLike) {
    this.config = config;
    this.client =
      client ??
      new SESv2Client({
        region: config.region,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      });
  }

  private scrub(message: string): string {
    let result = message;
    for (const secret of [this.config.secretAccessKey, this.config.accessKeyId]) {
      if (secret) result = result.split(secret).join("[redacted]");
    }
    return result.slice(0, 300);
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { fromEmail, fromName, configurationSet } = this.config;

    const headers: MessageHeader[] = Object.entries(params.headers ?? {}).map(([name, value]) => ({
      Name: headerSafe(name),
      Value: headerSafe(value),
    }));

    const command = new SendEmailCommand({
      FromEmailAddress: formatAddress(fromEmail, fromName),
      Destination: { ToAddresses: [formatAddress(params.to, params.toName)] },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: params.html, Charset: "UTF-8" },
            ...(params.text ? { Text: { Data: params.text, Charset: "UTF-8" } } : {}),
          },
          ...(headers.length > 0 ? { Headers: headers } : {}),
        },
      },
      ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
    });

    try {
      const response = await this.client.send(command);
      return { success: true, messageId: response.MessageId ?? "" };
    } catch (err) {
      const name = err instanceof Error ? err.name : "UnknownError";
      const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      const message = err instanceof Error ? err.message : "unknown error";
      console.error("[ses] send failed", { name, status });
      return {
        success: false,
        error: this.scrub(`SES request failed${status ? ` (HTTP ${status})` : ""} - ${name}: ${message}`),
      };
    }
  }
}

export function createSesProviderFromEnv(): SesProvider | null {
  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;
  if (!region || !accessKeyId || !secretAccessKey || !fromEmail || !fromName) return null;
  return new SesProvider({
    region,
    accessKeyId,
    secretAccessKey,
    fromEmail,
    fromName,
    configurationSet: process.env.AWS_SES_CONFIGURATION_SET || undefined,
  });
}