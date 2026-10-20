const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&middot;": "·",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|nbsp|middot);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

// Plain-text alternative sent alongside the HTML part. Multipart emails are
// more readable in text-only clients and less likely to be flagged as spam.
export function htmlToPlainText(html: string): string {
  const text = html
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]*>/g, "").trim();
      return label && label !== href ? `${label} (${href})` : href;
    })
    .replace(/<img\b[^>]*alt="([^"]+)"[^>]*>/gi, "[$1]")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n----------\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h1|h2|h3|ul|ol|table)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
