// Signed, stateless unsubscribe tokens: base64url(JSON payload) + "." +
// base64url(HMAC-SHA256). Server-side only.
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/email-sending-config";

export type UnsubscribePayload = {
  organizationId: string;
  email: string;
  contactId?: string | null;
  campaignId?: string | null;
};

type WirePayload = { o: string; e: string; c?: string; m?: string };

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET or AUTH_SECRET must be set to sign unsubscribe links.");
  }
  return secret;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createUnsubscribeToken(payload: UnsubscribePayload): string {
  const wire: WirePayload = { o: payload.organizationId, e: payload.email.trim().toLowerCase() };
  if (payload.contactId) wire.c = payload.contactId;
  if (payload.campaignId) wire.m = payload.campaignId;
  const data = Buffer.from(JSON.stringify(wire), "utf8").toString("base64url");
  return `${data}.${sign(data, getSecret())}`;
}

// Returns the payload for a genuine token, or null for anything malformed,
// tampered with, or signed with a different secret.
export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribePayload | null {
  if (typeof token !== "string" || token.length > 2000) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [data, signature] = parts;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const wire = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<WirePayload>;
    if (typeof wire.o !== "string" || typeof wire.e !== "string" || !wire.o || !wire.e.includes("@")) {
      return null;
    }
    return {
      organizationId: wire.o,
      email: wire.e,
      contactId: typeof wire.c === "string" ? wire.c : null,
      campaignId: typeof wire.m === "string" ? wire.m : null,
    };
  } catch {
    return null;
  }
}

// Page a recipient can open to confirm unsubscribing.
export function buildUnsubscribePageUrl(token: string): string {
  return `${getAppUrl()}/unsubscribe/${token}`;
}

// RFC 8058 one-click endpoint used in the List-Unsubscribe header.
export function buildOneClickUnsubscribeUrl(token: string): string {
  return `${getAppUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}