import { z } from "zod";

// Optional foreign-key field: an empty select value means "not chosen yet".
const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

// Drafts can be saved before an audience or template is picked; scheduling
// requires both (enforced by the service against the saved campaign).
export const campaignFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(150, "Campaign name must be 150 characters or fewer"),
  subject: z
    .string()
    .trim()
    .min(1, "Subject line is required")
    .max(200, "Subject line must be 200 characters or fewer"),
  contactListId: optionalId,
  templateId: optionalId,
});

export type CampaignFormInput = z.input<typeof campaignFormSchema>;
export type CampaignFormData = z.output<typeof campaignFormSchema>;

// Small grace window so a time picked "now-ish" isn't rejected by clock drift
// between browser and server, while still refusing times in the past.
const SCHEDULE_GRACE_MS = 60 * 1000;

export const scheduleCampaignSchema = z.object({
  scheduledAt: z.coerce
    .date({ invalid_type_error: "Choose a valid date and time" })
    .refine((date) => !Number.isNaN(date.getTime()), "Choose a valid date and time")
    .refine(
      (date) => date.getTime() > Date.now() - SCHEDULE_GRACE_MS,
      "Scheduled time must be in the future"
    ),
});

// Accepts an ISO string from the client (z.coerce.date types its input as Date).
export type ScheduleCampaignInput = { scheduledAt: string | Date };