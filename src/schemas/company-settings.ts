import { z } from "zod";

// Plain-string schema used by the form (react-hook-form keeps strings).
export const companySettingsFormSchema = z.object({
  companyName: z.string().trim().max(120, "Company name must be 120 characters or fewer."),
  // Required: CAN-SPAM and similar laws require a valid physical postal
  // address in every commercial email, and campaigns can't start without it.
  companyAddress: z
    .string()
    .trim()
    .min(5, "Enter your company's physical mailing address.")
    .max(300, "Company address must be 300 characters or fewer."),
  unsubscribeFooterText: z.string().trim().max(500, "Footer text must be 500 characters or fewer."),
});

// Server-side schema: same rules, empty optional fields stored as null.
export const companySettingsSchema = companySettingsFormSchema.transform((value) => ({
  companyName: value.companyName || null,
  companyAddress: value.companyAddress,
  unsubscribeFooterText: value.unsubscribeFooterText || null,
}));

export type CompanySettingsInput = z.input<typeof companySettingsFormSchema>;
export type CompanySettingsData = z.output<typeof companySettingsSchema>;
