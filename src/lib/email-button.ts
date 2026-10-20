import { escapeHtml } from "@/lib/email-html";
import { EMAIL_FONT_STACK } from "@/lib/email-styles";

export type EmailButtonAlign = "left" | "center" | "right";

export type EmailButtonAttrs = {
  text: string;
  href: string;
  align: EmailButtonAlign;
  color: string;
};

export const EMAIL_BUTTON_TYPE = "email-button";

export const EMAIL_BUTTON_DEFAULTS: EmailButtonAttrs = {
  text: "Learn More",
  href: "https://example.com",
  align: "center",
  color: "#2a78d6",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// A nested [tag, attrs, ...children] tuple. It is directly usable as a
// ProseMirror DOMOutputSpec (so the editor node renders it) and can be
// serialized to a string (so server code can produce identical markup).
export type HtmlSpec = [string, Record<string, string>, ...(HtmlSpec | string)[]];

function resolveAttrs(attrs: Partial<EmailButtonAttrs>): EmailButtonAttrs {
  const align = attrs.align && ["left", "center", "right"].includes(attrs.align)
    ? attrs.align
    : EMAIL_BUTTON_DEFAULTS.align;
  return {
    text: attrs.text?.trim() || EMAIL_BUTTON_DEFAULTS.text,
    href: attrs.href?.trim() || "#",
    align,
    color: attrs.color && HEX_COLOR.test(attrs.color) ? attrs.color : EMAIL_BUTTON_DEFAULTS.color,
  };
}

// Table-based "bulletproof" button: renders as a real button in Outlook and
// other clients that ignore padding on <a> elements.
export function buildButtonSpec(input: Partial<EmailButtonAttrs>): HtmlSpec {
  const { text, href, align, color } = resolveAttrs(input);
  const presentation = { role: "presentation", border: "0", cellpadding: "0", cellspacing: "0" };

  return [
    "table",
    { ...presentation, width: "100%", "data-type": EMAIL_BUTTON_TYPE },
    [
      "tbody",
      {},
      [
        "tr",
        {},
        [
          "td",
          { align, style: "padding:8px 0 24px 0;" },
          [
            "table",
            { ...presentation, align },
            [
              "tbody",
              {},
              [
                "tr",
                {},
                [
                  "td",
                  { align: "center", bgcolor: color, style: `border-radius:6px;background-color:${color};` },
                  [
                    "a",
                    {
                      href,
                      target: "_blank",
                      style: `display:inline-block;padding:12px 28px;font-family:${EMAIL_FONT_STACK};font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;`,
                    },
                    text,
                  ],
                ],
              ],
            ],
          ],
        ],
      ],
    ],
  ];
}

function serializeSpec(spec: HtmlSpec | string): string {
  if (typeof spec === "string") return escapeHtml(spec);
  const [tag, attrs, ...children] = spec;
  const attrString = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join("");
  return `<${tag}${attrString}>${children.map(serializeSpec).join("")}</${tag}>`;
}

export function buildButtonHtml(attrs: Partial<EmailButtonAttrs>): string {
  return serializeSpec(buildButtonSpec(attrs));
}
