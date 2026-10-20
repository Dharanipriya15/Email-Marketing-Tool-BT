import { prisma } from "@/db/client";
import type { ImportContactRowInput } from "@/schemas/contact-import";

// Bound how many rows a single request may carry, independent of whatever
// batch size the client happens to use — defense in depth against a
// malicious or buggy client sending an oversized payload.
export const MAX_BATCH_SIZE = 500;

export async function checkExistingEmails(
  organizationId: string,
  emails: string[]
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();

  const existing = await prisma.contact.findMany({
    where: { organizationId, email: { in: emails } },
    select: { email: true },
  });

  return new Set(existing.map((c) => c.email));
}

export type ImportBatchResult = {
  importedCount: number;
  importedIds: string[];
};

export async function importContactsBatch(
  organizationId: string,
  rows: ImportContactRowInput[]
): Promise<ImportBatchResult> {
  if (rows.length === 0) return { importedCount: 0, importedIds: [] };
  if (rows.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch too large (max ${MAX_BATCH_SIZE} rows).`);
  }

  const created = await prisma.contact.createManyAndReturn({
    data: rows.map((row) => ({ organizationId, ...row })),
    skipDuplicates: true,
    select: { id: true },
  });

  return { importedCount: created.length, importedIds: created.map((c) => c.id) };
}
