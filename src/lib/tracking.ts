// Signed open/click tracking links. Server-side only.
// Key is derived from UNSUBSCRIBE_SECRET/AUTH_SECRET with a separate context,
// so tracking signatures can never be replayed as unsubscribe tokens.
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/email-sending-config";

export const TRACKING_PREFIX = "/api/t";

function getKey(): Buffer {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET or AUTH_SECRET must be set for tracking links.");
  return createHmac("sha256", secret).update("email-tracking-v1").digest();
}

function sign(data: string, key: Buffer = getKey()): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildOpenPixelUrl(recipientId: string): string {
  return `${getAppUrl()}${TRACKING_PREFIX}/o/${recipientId}.${sign(`o:${recipientId}`)}`;
}

export function verifyOpenToken(token: string | undefined | null): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const cleaned = token.replace(/\.gif$/, "");
  const [id, sig, extra] = cleaned.split(".");
  if (extra !== undefined || !id || !sig || !ID_RE.test(id)) return null;
  try {
    return safeEqual(sig, sign(`o:${id}`)) ? id : null;
  } catch {
    return null;
  }
}

export function buildClickUrl(recipientId: string, targetUrl: string, key?: Buffer): string {
  const u = Buffer.from(targetUrl, "utf8").toString("base64url");
  const s = sign(`c:${recipientId}\n${targetUrl}`, key ?? getKey());
  return `${getAppUrl()}${TRACKING_PREFIX}/c?r=${recipientId}&u=${u}&s=${s}`;
}

// Only URLs we signed for this recipient while rendering the campaign are
// accepted, and only http(s): there is no open redirect.
export function verifyClick(params: URLSearchParams): { recipientId: string; url: string } | null {
  const r = params.get("r");
  const u = params.get("u");
  const s = params.get("s");
  if (!r || !u || !s || !ID_RE.test(r) || u.length > 8000) return null;
  let url: string;
  try {
    url = Buffer.from(u, "base64url").toString("utf8");
    if (!safeEqual(s, sign(`c:${r}\n${url}`))) return null;
  } catch {
    return null;
  }
  return isHttpUrl(url) ? { recipientId: r, url } : null;
}

const decodeHref = (v: string) =>
  v.replace(/&amp;/gi, "&").replace(/&#38;/g, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
const encodeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Rewrites http(s) <a href> links to the signed click redirect. Links in
// `skip` (the unsubscribe URL) and non-http links (mailto:, tel:, #) are kept.
export function rewriteLinksForTracking(html: string, recipientId: string, skip: string[] = []): string {
  const key = getKey();
  const skipSet = new Set(skip);
  return html.replace(
    /(<a\b[^>]*?\shref\s*=\s*)(["'])(.*?)\2/gi,
    (match, prefix: string, quote: string, rawHref: string) => {
      const href = decodeHref(rawHref.trim());
      if (!isHttpUrl(href) || skipSet.has(href) || href.startsWith(`${getAppUrl()}/unsubscribe`)) return match;
      return `${prefix}${quote}${encodeAttr(buildClickUrl(recipientId, href, key))}${quote}`;
    }
  );
}

export function addOpenPixel(html: string, recipientId: string): string {
  const img = `<img src="${buildOpenPixelUrl(recipientId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${img}</body>`) : `${html}${img}`;
}

// Tracking links point at APP_URL. If that isn't a public https address
// (e.g. http://localhost:3000 in dev), recipients' clicks would break, so
// links and the pixel are left untouched.
export function isTrackingAvailable(appUrl: string = getAppUrl()): boolean {
  try {
    const url = new URL(appUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    return !(host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]");
  } catch {
    return false;
  }
}

export function applyTracking(
  html: string,
  recipientId: string,
  options: { trackOpens: boolean; trackClicks: boolean; skipUrls?: string[] }
): string {
  if (!isTrackingAvailable()) return html;
  let out = html;
  if (options.trackClicks) out = rewriteLinksForTracking(out, recipientId, options.skipUrls);
  if (options.trackOpens) out = addOpenPixel(out, recipientId);
  return out;
}
