// Pure helpers for template image uploads, shared by the browser (file
// picker filter, size check) and the server (authoritative validation).

export const MAX_TEMPLATE_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export const TEMPLATE_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

export type TemplateImageMimeType = keyof typeof TEMPLATE_IMAGE_TYPES;

// Value for <input type="file" accept>. Only a convenience filter in the
// picker; the server checks the actual file contents.
export const TEMPLATE_IMAGE_ACCEPT = [
  ...Object.keys(TEMPLATE_IMAGE_TYPES),
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
].join(",");

export const TEMPLATE_IMAGE_TYPE_ERROR = "Only JPG, PNG, GIF, or WebP images can be uploaded.";
export const TEMPLATE_IMAGE_SIZE_ERROR = "This image is larger than 2 MB. Please choose a smaller file.";

// Inline style applied to inserted images so they scale down on small screens.
export const TEMPLATE_IMAGE_STYLE = "max-width:100%;height:auto;";

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

// Identifies the image type from the file's leading "magic" bytes, ignoring
// the file name and the browser-reported MIME type (both client-controlled).
export function detectTemplateImageType(bytes: Uint8Array): TemplateImageMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
