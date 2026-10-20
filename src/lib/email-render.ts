import { escapeHtml } from "@/lib/email-html";
import { EMAIL_COLORS, EMAIL_CONTENT_WIDTH, EMAIL_FONT_STACK } from "@/lib/email-styles";
import {
  SAMPLE_PERSONALIZATION_DATA,
  applyPersonalization,
  personalizeHtml,
} from "@/lib/personalization";

// Inline default styles per tag. Many email clients (notably Gmail and
// Outlook) ignore or strip <style> blocks, so every element carries its own
// styling. Styles already on an element come after the defaults and win.
const BODY_TEXT = `font-family:${EMAIL_FONT_STACK};font-size:16px;line-height:1.6;color:${EMAIL_COLORS.text};`;

const DEFAULT_TAG_STYLES: Record<string, string> = {
  h1: `margin:0 0 16px 0;font-family:${EMAIL_FONT_STACK};font-size:28px;line-height:1.25;font-weight:700;color:${EMAIL_COLORS.heading};`,
  h2: `margin:0 0 14px 0;font-family:${EMAIL_FONT_STACK};font-size:22px;line-height:1.3;font-weight:700;color:${EMAIL_COLORS.heading};`,
  h3: `margin:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:18px;line-height:1.35;font-weight:600;color:${EMAIL_COLORS.heading};`,
  p: `margin:0 0 16px 0;${BODY_TEXT}`,
  ul: `margin:0 0 16px 0;padding:0 0 0 24px;${BODY_TEXT}`,
  ol: `margin:0 0 16px 0;padding:0 0 0 24px;${BODY_TEXT}`,
  li: "margin:0 0 6px 0;",
  a: `color:${EMAIL_COLORS.link};text-decoration:underline;`,
  img: "max-width:100%;height:auto;border:0;outline:none;text-decoration:none;",
  hr: `border:0;border-top:1px solid ${EMAIL_COLORS.border};margin:24px 0;height:0;`,
};

// Matches an opening tag with any attributes, including quoted values that
// contain ">" characters.
const STYLED_TAG =
  /<(h1|h2|h3|p|ul|ol|li|a|img|hr)\b((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
const STYLE_ATTR = /\sstyle\s*=\s*"([^"]*)"/i;

function withDefaultStyles(html: string): string {
  return html.replace(STYLED_TAG, (_match, rawTag: string, attrs: string, selfClose: string) => {
    const tag = rawTag.toLowerCase();
    const defaults = DEFAULT_TAG_STYLES[tag];
    const existing = attrs.match(STYLE_ATTR);
    const merged = existing
      ? attrs.replace(STYLE_ATTR, ` style="${defaults}${existing[1]}"`)
      : `${attrs} style="${defaults}"`;
    return `<${tag}${merged}${selfClose ? " /" : ""}>`;
  });
}

function normalizeStructure(html: string): string {
  return (
    html
      // Empty paragraphs collapse to zero height in most clients; a
      // non-breaking space keeps intentional blank lines (spacing) visible.
      .replace(/<p(\s[^>]*)?><\/p>/gi, "<p$1>&nbsp;</p>")
      // The editor wraps list item text in <p>; unwrap single paragraphs so
      // list items don't inherit paragraph margins.
      .replace(/<li([^>]*)>\s*<p(?:\s[^>]*)?>([\s\S]*?)<\/p>\s*<\/li>/gi, (match, liAttrs, inner) =>
        /<p[\s>]/i.test(inner) ? match : `<li${liAttrs}>${inner}</li>`
      )
  );
}

// Converts editor output into email-ready body markup. Input must already be
// trusted (sanitized server-side, or rendered in a sandboxed iframe).
export function styleEmailBody(html: string): string {
  return withDefaultStyles(normalizeStructure(html));
}

// Hidden preheader filler stops inbox previews from showing body text right
// after the preview text.
const PREHEADER_FILLER = "&#847;&zwnj;&nbsp;".repeat(40);

export type EmailDocumentInput = {
  subject: string;
  previewText?: string | null;
  bodyHtml: string;
};

export function renderEmailDocument({ subject, previewText, bodyHtml }: EmailDocumentInput): string {
  const preheader = previewText?.trim()
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_COLORS.background};">${escapeHtml(previewText.trim())}${PREHEADER_FILLER}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(subject)}</title>
<style>
body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
img { border:0; outline:none; text-decoration:none; }
@media only screen and (max-width: ${EMAIL_CONTENT_WIDTH + 20}px) {
  .email-container { width:100% !important; }
  .email-body { padding:28px 20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_COLORS.background};">
${preheader}
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${EMAIL_COLORS.background}" style="background-color:${EMAIL_COLORS.background};">
<tr>
<td align="center" style="padding:24px 10px;">
<table role="presentation" class="email-container" width="${EMAIL_CONTENT_WIDTH}" border="0" cellpadding="0" cellspacing="0" bgcolor="${EMAIL_COLORS.surface}" style="width:${EMAIL_CONTENT_WIDTH}px;max-width:100%;background-color:${EMAIL_COLORS.surface};border-radius:8px;">
<tr>
<td class="email-body" style="padding:40px;${BODY_TEXT}text-align:left;">
${styleEmailBody(bodyHtml)}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export type TemplateContent = {
  subject: string;
  previewText?: string | null;
  htmlContent: string;
};

// Renders a template the way a recipient would see it, with personalization
// variables filled in (sample data unless real contact data is supplied).
export function renderPersonalizedEmail(
  template: TemplateContent,
  data: Record<string, string> = SAMPLE_PERSONALIZATION_DATA,
  footer?: EmailFooter
): { subject: string; html: string } {
  const subject = applyPersonalization(template.subject, data);
  const html = renderEmailDocument({
    subject,
    previewText: template.previewText ? applyPersonalization(template.previewText, data) : null,
    // The footer is appended after personalization so its values are never
    // treated as {{tokens}}; buildEmailFooterHtml escapes them itself.
    bodyHtml: personalizeHtml(template.htmlContent, data) + (footer ? buildEmailFooterHtml(footer) : ""),
  });
  return { subject, html };
}

export type EmailFooter = {
  unsubscribeUrl: string;
  companyName?: string | null;
  companyAddress?: string | null;
  footerText?: string | null;
};

const FOOTER_TEXT_STYLE = `margin:0 0 8px 0;font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:1.5;color:#6b7280;text-align:center;`;

// Compliance footer for campaign emails: sender identity + unsubscribe link.
export function buildEmailFooterHtml({ unsubscribeUrl, companyName, companyAddress, footerText }: EmailFooter): string {
  const identity = [companyName?.trim(), companyAddress?.trim()].filter(Boolean).map((v) => escapeHtml(v as string));
  const lines = [
    footerText?.trim() ? `<p style="${FOOTER_TEXT_STYLE}">${escapeHtml(footerText.trim())}</p>` : "",
    identity.length > 0 ? `<p style="${FOOTER_TEXT_STYLE}">${identity.join(" &middot; ")}</p>` : "",
    `<p style="${FOOTER_TEXT_STYLE}"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>`,
  ];
  return `<hr style="border:0;border-top:1px solid ${EMAIL_COLORS.border};margin:32px 0 16px 0;height:0;" />${lines.join("")}`;
}

// Plain-text equivalent of the footer for the text/plain part.
export function buildEmailFooterText({ unsubscribeUrl, companyName, companyAddress, footerText }: EmailFooter): string {
  const identity = [companyName?.trim(), companyAddress?.trim()].filter(Boolean).join(" - ");
  const lines = ["", "--"];
  if (footerText?.trim()) lines.push(footerText.trim());
  if (identity) lines.push(identity);
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  return lines.join("\n");
}
