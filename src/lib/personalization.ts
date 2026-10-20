import { escapeHtml } from "@/lib/email-html";

export type PersonalizationVariable = {
  token: string;
  label: string;
};

export const PERSONALIZATION_VARIABLES: PersonalizationVariable[] = [
  { token: "{{first_name}}", label: "First Name" },
  { token: "{{last_name}}", label: "Last Name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{industry}}", label: "Industry" },
  { token: "{{location}}", label: "Location" },
];

// Realistic sample values used only for preview/test rendering — the saved
// template HTML always keeps the literal {{token}} syntax untouched.
export const SAMPLE_PERSONALIZATION_DATA: Record<string, string> = {
  first_name: "Jane",
  last_name: "Doe",
  company: "Acme Inc",
  industry: "Technology",
  location: "Austin, TX",
};

const TOKEN_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

function replaceTokens(
  source: string,
  data: Record<string, string>,
  transform: (value: string) => string
): string {
  return source.replace(TOKEN_PATTERN, (match, key: string) => {
    const value = data[key.toLowerCase()];
    return value !== undefined ? transform(value) : match;
  });
}

// For plain-text contexts (subject line, preview text, text part).
export function applyPersonalization(
  text: string,
  data: Record<string, string> = SAMPLE_PERSONALIZATION_DATA
): string {
  return replaceTokens(text, data, (value) => value);
}

// For HTML contexts. Contact data is user-supplied (e.g. CSV imports), so
// values are escaped to stop them from injecting markup into the email.
export function personalizeHtml(
  html: string,
  data: Record<string, string> = SAMPLE_PERSONALIZATION_DATA
): string {
  return replaceTokens(html, data, escapeHtml);
}
