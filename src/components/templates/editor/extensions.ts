import { Extension, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import {
  EMAIL_BUTTON_DEFAULTS,
  EMAIL_BUTTON_TYPE,
  buildButtonSpec,
  type EmailButtonAttrs,
} from "@/lib/email-button";
import { SMALL_TEXT_FONT_SIZE, SMALL_TEXT_STYLE } from "@/lib/email-styles";

export const EMAIL_BUTTON_NODE = "emailButton";
export const SMALL_TEXT_SIZE = "small";

// CTA button as a single, non-editable block. Its settings (text, link,
// color, alignment) are edited from the toolbar, and it is stored as
// table-based markup that renders correctly across email clients.
export const EmailButton = Node.create({
  name: EMAIL_BUTTON_NODE,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      text: {
        default: EMAIL_BUTTON_DEFAULTS.text,
        rendered: false,
        parseHTML: (element) => element.querySelector("a")?.textContent?.trim() || null,
      },
      href: {
        default: EMAIL_BUTTON_DEFAULTS.href,
        rendered: false,
        parseHTML: (element) => element.querySelector("a")?.getAttribute("href") || null,
      },
      align: {
        default: EMAIL_BUTTON_DEFAULTS.align,
        rendered: false,
        parseHTML: (element) => element.querySelector("td[align]")?.getAttribute("align") || null,
      },
      color: {
        default: EMAIL_BUTTON_DEFAULTS.color,
        rendered: false,
        parseHTML: (element) => element.querySelector("td[bgcolor]")?.getAttribute("bgcolor") || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: `table[data-type="${EMAIL_BUTTON_TYPE}"]` }];
  },

  renderHTML({ node }) {
    return buildButtonSpec(node.attrs as EmailButtonAttrs);
  },
});

// Inline images live inside paragraphs, so the paragraph's text alignment
// positions them — the most portable way to align images in email.
export const EmailImage = Image.configure({ inline: true, allowBase64: false });

// "Small text" paragraph style for footers and fine print.
export const SmallText = Extension.create({
  name: "smallText",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          textSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize === SMALL_TEXT_FONT_SIZE ? SMALL_TEXT_SIZE : null,
            renderHTML: (attributes) =>
              attributes.textSize === SMALL_TEXT_SIZE ? { style: SMALL_TEXT_STYLE } : {},
          },
        },
      },
    ];
  },
});
