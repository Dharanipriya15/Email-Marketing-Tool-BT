// Amazon SNS message verification (signature versions 1 and 2). Server-side only.
// https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
import { createVerify } from "node:crypto";

export type SnsMessage = {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation" | string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

// Only fetch certificates / confirmation URLs from genuine SNS endpoints over https.
export function isSnsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SNS_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export function buildStringToSign(message: SnsMessage): string {
  const keys =
    message.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  let result = "";
  for (const key of keys) {
    const value = (message as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    result += `${key}\n${String(value)}\n`;
  }
  return result;
}

export function parseSnsMessage(body: unknown): SnsMessage | null {
  if (!body || typeof body !== "object") return null;
  const m = body as Record<string, unknown>;
  for (const key of ["Type", "MessageId", "TopicArn", "Message", "Timestamp", "SignatureVersion", "Signature", "SigningCertURL"]) {
    if (typeof m[key] !== "string") return null;
  }
  return m as unknown as SnsMessage;
}

const certCache = new Map<string, string>();

async function defaultFetchCert(url: string): Promise<string> {
  const cached = certCache.get(url);
  if (cached) return cached;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`certificate fetch failed (${response.status})`);
  const pem = await response.text();
  certCache.set(url, pem);
  return pem;
}

export async function verifySnsMessage(
  message: SnsMessage,
  fetchCert: (url: string) => Promise<string> = defaultFetchCert
): Promise<boolean> {
  if (!isSnsUrl(message.SigningCertURL)) return false;
  const algorithm = message.SignatureVersion === "1" ? "RSA-SHA1" : message.SignatureVersion === "2" ? "RSA-SHA256" : null;
  if (!algorithm) return false;
  try {
    const pem = await fetchCert(message.SigningCertURL);
    const verifier = createVerify(algorithm);
    verifier.update(buildStringToSign(message), "utf8");
    return verifier.verify(pem, message.Signature, "base64");
  } catch {
    return false;
  }
}

export function isAllowedTopic(topicArn: string): boolean {
  const allowed = (process.env.AWS_SNS_TOPIC_ARN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(topicArn);
}
