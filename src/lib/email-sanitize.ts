import sanitizeHtml from "sanitize-html";

// Whitelist matches exactly what the Tiptap editor schema can produce
// (including the table-based CTA button from lib/email-button.ts).
// Defense in depth: even though the editor's own schema already constrains
// output, a malicious client could still send arbitrary HTML straight to
// the Server Action, so this is never skipped server-side.
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "strong",
  "em",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "hr",
  "br",
  "div",
  "span",
  "table",
  "tbody",
  "tr",
  "td",
];

const COLOR = [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/];
const LENGTH = /^\d+(\.\d+)?(px|em|rem|%)?$/;
const BOX_LENGTHS = /^(\d+(\.\d+)?(px|em|rem|%)?)(\s+\d+(\.\d+)?(px|em|rem|%)?){0,3}$/;

const ALLOWED_STYLES = {
  "*": {
    color: COLOR,
    "background-color": COLOR,
    "text-align": [/^left$|^center$|^right$/],
    "font-size": [LENGTH],
    "font-weight": [/^\d+$|^bold$|^normal$/],
    "font-family": [/^[\w\s,'"-]+$/],
    "line-height": [LENGTH],
    padding: [BOX_LENGTHS],
    margin: [BOX_LENGTHS],
    "border-radius": [LENGTH],
    "text-decoration": [/^none$|^underline$/],
    display: [/^inline-block$|^block$/],
    width: [LENGTH],
    "max-width": [LENGTH],
    height: [/^auto$/, LENGTH],
  },
};

const TABLE_LAYOUT_ATTRIBUTES = ["role", "width", "border", "cellpadding", "cellspacing", "align"];

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel", "style"],
      img: ["src", "alt", "title", "style", "width", "height"],
      table: [...TABLE_LAYOUT_ATTRIBUTES, "data-type"],
      td: ["align", "valign", "bgcolor", "width"],
      "*": ["style"],
    },
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
