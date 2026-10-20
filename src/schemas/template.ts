import { z } from "zod";
import { EMAIL_BUTTON_TYPE } from "@/lib/email-button";

const MAX_HTML_LENGTH = 500_000;

// Lightweight check shared by client and server (no HTML parser in the
// browser bundle). Content counts if it has visible text, an image, or a
// CTA button — an image-only email is still a valid email.
function hasEmailContent(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0 || /<img\b/i.test(html) || html.includes(`data-type="${EMAIL_BUTTON_TYPE}"`);
}

const htmlContentSchema = z
  .string()
  .max(MAX_HTML_LENGTH, "Email content is too long")
  .refine(hasEmailContent, "Email content is required");

const subjectSchema = z
  .string()
  .trim()
  .min(1, "Subject line is required")
  .max(200, "Subject line must be 200 characters or fewer");

const previewTextSchema = z
  .string()
  .trim()
  .max(200, "Preview text must be 200 characters or fewer")
  .optional()
  .or(z.literal(""));

export const templateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required")
    .max(150, "Template name must be 150 characters or fewer"),
  subject: subjectSchema,
  previewText: previewTextSchema,
  htmlContent: htmlContentSchema,
});

export type TemplateFormInput = z.infer<typeof templateFormSchema>;

export const testEmailSchema = z.object({
  testEmail: z.string().trim().min(1, "Email address is required").email("Enter a valid email address"),
});

export type TestEmailInput = z.infer<typeof testEmailSchema>;

// Server-side: validates the current (possibly unsaved) editor content
// together with the recipient address.
export const sendTestEmailSchema = testEmailSchema.extend({
  subject: subjectSchema,
  previewText: previewTextSchema,
  htmlContent: htmlContentSchema,
});

export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;
