export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_SCHEME = /^(https?:|mailto:)/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LOOKS_LIKE_EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

// Turns what a non-technical user types ("example.com", "sales@acme.com")
// into a usable absolute URL. Returns "" for unsafe schemes (javascript:,
// data:, ...) so callers can treat it as invalid input.
export function normalizeUrl(input: string): string {
  const url = input.trim();
  if (!url) return "";
  if (SAFE_SCHEME.test(url)) return url;
  if (ANY_SCHEME.test(url)) return "";
  if (LOOKS_LIKE_EMAIL.test(url)) return `mailto:${url}`;
  return `https://${url.replace(/^\/+/, "")}`;
}
