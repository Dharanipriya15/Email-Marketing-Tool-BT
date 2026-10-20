import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const importContactRowSchema = z.object({
  firstName: nullableText(100),
  lastName: nullableText(100),
  email: z.string().trim().toLowerCase().email(),
  company: nullableText(150),
  phone: nullableText(30),
  industry: nullableText(100),
  location: nullableText(100),
  status: z.enum(["ACTIVE", "UNSUBSCRIBED", "BOUNCED", "SUPPRESSED"]),
});

export type ImportContactRowInput = z.infer<typeof importContactRowSchema>;
