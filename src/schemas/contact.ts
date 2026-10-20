import { z } from "zod";

export const CONTACT_STATUS_VALUES = [
  "ACTIVE",
  "UNSUBSCRIBED",
  "BOUNCED",
  "SUPPRESSED",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""));

export const contactFormSchema = z.object({
  firstName: optionalText(100),
  lastName: optionalText(100),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  company: optionalText(150),
  phone: optionalText(30),
  industry: optionalText(100),
  location: optionalText(100),
  status: z.enum(CONTACT_STATUS_VALUES),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

const MAX_BULK_CONTACT_IDS = 1000;

// Server-side guard for bulk actions (delete, add to / remove from list).
export const bulkContactIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(MAX_BULK_CONTACT_IDS);

export const listIdSchema = z.string().trim().min(1);
