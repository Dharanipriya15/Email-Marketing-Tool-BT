import { z } from "zod";

export const contactListFormSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ContactListFormInput = z.infer<typeof contactListFormSchema>;
