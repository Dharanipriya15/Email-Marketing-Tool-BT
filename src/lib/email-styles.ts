// Shared visual constants for generated email HTML. The editor canvas
// (.email-canvas in globals.css) mirrors these so editing is WYSIWYG.

export const EMAIL_FONT_STACK = "Arial, Helvetica, sans-serif";

export const EMAIL_COLORS = {
  text: "#374151",
  heading: "#111827",
  muted: "#6b7280",
  link: "#2a78d6",
  border: "#e5e7eb",
  background: "#f4f4f5",
  surface: "#ffffff",
} as const;

export const EMAIL_CONTENT_WIDTH = 600;

// Paragraph variant used for footers and fine print. The editor stores it as
// this exact inline style so it survives saving and re-parsing.
export const SMALL_TEXT_STYLE = `font-size:13px;line-height:1.5;color:${EMAIL_COLORS.muted}`;
export const SMALL_TEXT_FONT_SIZE = "13px";
